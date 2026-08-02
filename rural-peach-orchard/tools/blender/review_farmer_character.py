"""Strict delivery and evidence gate for character.farmer-a."""

from __future__ import annotations

import hashlib
import json
import math
import struct
from pathlib import Path
from typing import Any

import bpy
from mathutils import Matrix, Vector


REPOSITORY = Path(__file__).resolve().parents[2]

REQUIRED_ANIMATIONS = {
    "idle", "walk", "enter_vehicle", "drive", "exit_vehicle", "pick_low",
    "pick_mid", "pick_high", "carry_crate", "lift_crate", "load_crate",
}
REQUIRED_BONES = {
    "root", "pelvis", "spine_01", "spine_02", "neck", "head",
    "clavicle_l", "upper_arm_l", "lower_arm_l", "hand_l", "clavicle_r",
    "upper_arm_r", "lower_arm_r", "hand_r", "thigh_l", "calf_l", "foot_l",
    "thigh_r", "calf_r", "foot_r",
}
REQUIRED_INTERFACES = {"hand_grip_left", "hand_grip_right", "basket_mount", "root_motion"}
EXPECTED_EVENTS = {
    "pick_low": [{"name": "fruit_contact", "normalizedTime": 0.58}],
    "pick_mid": [{"name": "fruit_contact", "normalizedTime": 0.58}],
    "pick_high": [{"name": "fruit_contact", "normalizedTime": 0.58}],
    "carry_crate": [{"name": "crate_gripped", "normalizedTime": 0.31}],
    "lift_crate": [{"name": "crate_gripped", "normalizedTime": 0.31}],
    "load_crate": [{"name": "crate_released", "normalizedTime": 0.76}],
}
VEHICLE_FIXTURE_OBJECTS = {
    "driverSeat": "driver_seat",
    "exitLeft": "exit_left",
    "frontWheel": "wheel_front",
    "gripLeft": "handle_grip_left",
    "gripRight": "handle_grip_right",
    "footboardLeft": "footboard_left",
    "footboardRight": "footboard_right",
    "cargoSlot": "cargo_slot_01",
    "chassis": "box_chassis",
    "cargoBed": "box_bed_floor",
    "cargoWallLeft": "box_bed_left_wall",
    "cargoWallRight": "box_bed_right_wall",
    "cargoWallFront": "box_bed_front_wall",
    "cargoWallRear": "box_bed_rear_wall",
}
CHARACTER_FIXTURE_OBJECTS = {
    "crateLeft": "fixture_crate_handhold_left",
    "crateRight": "fixture_crate_handhold_right",
    "pickLow": "review_fruit_pick_low",
    "pickMid": "review_fruit_pick_mid",
    "pickHigh": "review_fruit_pick_high",
    "ground": "fixture_ground_plane",
}
REQUIRED_EVIDENCE = {
    "a-pose-front.png", "a-pose-left.png", "a-pose-right.png", "a-pose-rear.png",
    "a-pose-top.png", "hero.png", "head-unhatted-front.png",
    "head-unhatted-profile.png", "head-unhatted-three-quarter.png",
    "hands-closeup.png", "clothing-layers.png", "material-id.png",
    "rig-bone-overlay.png", "weight-heatmap.png", "joint-deformation-sheet.png",
    "walk-stride.png", "drive-tricycle-fit.png", "enter-vehicle-path.png",
    "exit-vehicle-path.png", "pick-low-silhouette.png", "pick-mid-silhouette.png",
    "pick-high-silhouette.png", "carry-crate.png", "lift-crate.png",
    "load-crate.png", "neutral-third-person.png", "warm-third-person.png",
    "uv-texel-proof.png",
}


def read_glb(path: Path) -> dict[str, Any]:
    data = path.read_bytes()
    if len(data) < 20:
        raise ValueError("not a GLB")
    magic, version, length = struct.unpack_from("<III", data, 0)
    if magic != 0x46546C67 or version != 2 or length != len(data):
        raise ValueError("invalid GLB header")
    json_length, json_type = struct.unpack_from("<II", data, 12)
    if json_type != 0x4E4F534A:
        raise ValueError("missing GLB JSON chunk")
    return json.loads(data[20 : 20 + json_length].decode("utf-8").rstrip(" \t\r\n\0"))


def _issue(issues: list[dict[str, str]], code: str, message: str) -> None:
    issues.append({"code": code, "message": message})


def measure_fixture_objects(objects: dict[str, Any]) -> dict[str, Vector]:
    """Measure semantic points from actual object geometry/bounds."""
    measured: dict[str, Vector] = {}
    for semantic, obj in objects.items():
        if obj.type == "MESH" and obj.bound_box:
            measured[semantic] = sum(
                (obj.matrix_world @ Vector(corner) for corner in obj.bound_box), Vector()
            ) / 8.0
        else:
            measured[semantic] = obj.matrix_world.translation.copy()
    return measured


def measure_vehicle_fixture(blend_path: Path) -> dict[str, Vector]:
    """Append the real tricycle sockets/surfaces and derive their coordinates."""
    names = set(VEHICLE_FIXTURE_OBJECTS.values())
    collection = bpy.data.collections.new("_MEASURE_VEHICLE_FIXTURE")
    bpy.context.scene.collection.children.link(collection)
    with bpy.data.libraries.load(str(blend_path), link=False) as (source, destination):
        destination.objects = [name for name in source.objects if name in names]
    loaded = [obj for obj in destination.objects if obj is not None]
    for obj in loaded:
        collection.objects.link(obj)
    bpy.context.view_layer.update()
    by_name = {obj.name: obj for obj in loaded}
    missing = names - set(by_name)
    if missing:
        raise RuntimeError(f"vehicle fixture is missing {sorted(missing)}")
    measured = measure_fixture_objects(
        {semantic: by_name[name] for semantic, name in VEHICLE_FIXTURE_OBJECTS.items()}
    )
    for obj in loaded:
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.collections.remove(collection)
    return measured


def measure_vehicle_bounds(blend_path: Path) -> dict[str, tuple[Vector, Vector]]:
    """Read actual fixture AABBs for swept clearance and cargo-fit checks."""
    names = set(VEHICLE_FIXTURE_OBJECTS.values())
    collection = bpy.data.collections.new("_MEASURE_VEHICLE_BOUNDS")
    bpy.context.scene.collection.children.link(collection)
    with bpy.data.libraries.load(str(blend_path), link=False) as (source, destination):
        destination.objects = [name for name in source.objects if name in names]
    loaded = [obj for obj in destination.objects if obj is not None]
    for obj in loaded:
        collection.objects.link(obj)
    bpy.context.view_layer.update()
    by_name = {obj.name: obj for obj in loaded}
    bounds: dict[str, tuple[Vector, Vector]] = {}
    for semantic, name in VEHICLE_FIXTURE_OBJECTS.items():
        obj = by_name[name]
        corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box] if obj.type == "MESH" else [obj.matrix_world.translation]
        bounds[semantic] = (
            Vector(tuple(min(point[axis] for point in corners) for axis in range(3))),
            Vector(tuple(max(point[axis] for point in corners) for axis in range(3))),
        )
    for obj in loaded:
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.collections.remove(collection)
    return bounds


def measure_character_fixture(blend_path: Path) -> dict[str, Vector]:
    """Append the source-authored crate, fruit, and ground geometry."""
    names = set(CHARACTER_FIXTURE_OBJECTS.values())
    collection = bpy.data.collections.new("_MEASURE_CHARACTER_FIXTURE")
    bpy.context.scene.collection.children.link(collection)
    with bpy.data.libraries.load(str(blend_path), link=False) as (source, destination):
        destination.objects = [name for name in source.objects if name in names]
    loaded = [obj for obj in destination.objects if obj is not None]
    for obj in loaded:
        collection.objects.link(obj)
        obj.hide_viewport = False
    bpy.context.view_layer.update()
    by_name = {obj.name: obj for obj in loaded}
    missing = names - set(by_name)
    if missing:
        raise RuntimeError(f"character fixture is missing {sorted(missing)}")
    measured = measure_fixture_objects(
        {semantic: by_name[name] for semantic, name in CHARACTER_FIXTURE_OBJECTS.items()}
    )
    for obj in loaded:
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.collections.remove(collection)
    return measured


def evaluate_motion_metrics(samples: dict[str, dict[str, Any]]) -> list[dict[str, str]]:
    issues: list[dict[str, str]] = []
    enter = samples.get("enter_vehicle", {})
    exit_clip = samples.get("exit_vehicle", {})
    if min(float(enter.get("rootTravel", 0)), float(exit_clip.get("rootTravel", 0))) < 0.35:
        _issue(issues, "VEHICLE_PATH_STATIC", "enter/exit root travel must each exceed 0.35 m")
    if enter.get("poseSignature") == exit_clip.get("poseSignature"):
        _issue(issues, "ENTER_EXIT_DUPLICATE", "enter and exit sampled signatures are identical")
    walk = samples.get("walk", {})
    if float(walk.get("footTravel", 0)) < 0.18 or int(walk.get("plantedFrames", 0)) < 2:
        _issue(issues, "WALK_MECHANICS_MISSING", "walk lacks stride travel or planted-foot samples")
    if int(walk.get("groundedFrames", 0)) < 4 or int(walk.get("airborneFrames", 99)) > 0:
        _issue(
            issues,
            "WALK_GROUND_CONTACT_LOST",
            f"grounded={walk.get('groundedFrames', 0)} airborne={walk.get('airborneFrames', 99)}",
        )
    if float(walk.get("minimumSoleArea", 0.0)) < 0.002 or float(walk.get("maximumSoleTiltDegrees", 90.0)) > 28.0:
        _issue(
            issues,
            "WALK_SOLE_SUPPORT_INVALID",
            f"area={walk.get('minimumSoleArea')} tilt={walk.get('maximumSoleTiltDegrees')}",
        )
    if float(walk.get("maximumFootSlide", 99.0)) > 0.10:
        _issue(issues, "WALK_FOOT_SLIDE", str(walk.get("maximumFootSlide")))
    if float(walk.get("phaseSeparation", 0.0)) < 0.16:
        _issue(issues, "WALK_PHASES_INSUFFICIENT", str(walk.get("phaseSeparation")))
    lift = samples.get("lift_crate", {})
    if int(lift.get("groundedFrames", 0)) < 4 or int(lift.get("airborneFrames", 99)) > 0:
        _issue(
            issues,
            "LIFT_GROUND_CONTACT_LOST",
            f"grounded={lift.get('groundedFrames', 0)} airborne={lift.get('airborneFrames', 99)}",
        )
    if (
        int(lift.get("bilateralSupportFrames", 0)) < 4
        or float(lift.get("minimumSoleArea", 0.0)) < 0.002
        or float(lift.get("splitStance", 0.0)) < 0.12
        or float(lift.get("loadDistance", 99.0)) > 0.42
        or float(lift.get("backwardLeanDegrees", 99.0)) > 25.0
    ):
        _issue(issues, "LIFT_MECHANICS_UNSAFE", str(lift))
    pick_heights = [float(samples.get(name, {}).get("handHeight", 0)) for name in ("pick_low", "pick_mid", "pick_high")]
    if not (0.45 <= pick_heights[0] <= 0.9 and 1.0 <= pick_heights[1] <= 1.45 and 1.5 <= pick_heights[2] <= 1.9):
        _issue(issues, "PICK_HEIGHT_BANDS_INVALID", f"sampled heights are {pick_heights}")
    return issues


def evaluate_geometry_metrics(metrics: dict[str, Any]) -> list[dict[str, str]]:
    issues: list[dict[str, str]] = []
    if int(metrics.get("bodyComponents", 999)) != 1 or float(metrics.get("bodyLargestComponentRatio", 0)) < 0.98:
        _issue(issues, "BODY_TOPOLOGY_DISCONNECTED", str(metrics))
    if float(metrics.get("uvNonDegenerateRatio", 0)) < 0.98:
        _issue(issues, "UV_DEGENERATE", str(metrics.get("uvNonDegenerateRatio")))
    if float(metrics.get("uvOverlapRatio", 1.0)) > 0.08:
        _issue(issues, "UV_OVERLAP_EXCESSIVE", str(metrics.get("uvOverlapRatio")))
    if int(metrics.get("maxInfluences", 5)) > 4:
        _issue(issues, "WEIGHT_LIMIT_EXCEEDED", str(metrics.get("maxInfluences")))
    digit_branches = metrics.get("digitBranches", {})
    if any(int(digit_branches.get(side, 0)) != 5 for side in ("left", "right")):
        _issue(issues, "HAND_DIGIT_COUNT_INVALID", str(digit_branches))
    expected_components = {"body": 1, "workwear": 2, "gear": 5}
    surface_components = metrics.get("surfaceComponents", {})
    if any(int(surface_components.get(name, 999)) != expected for name, expected in expected_components.items()):
        _issue(issues, "DEFORMATION_SURFACE_DISCONNECTED", str(surface_components))
    non_manifold = metrics.get("nonManifoldEdges", {})
    if any(int(non_manifold.get(name, 999)) != 0 for name in expected_components):
        _issue(issues, "DEFORMATION_TOPOLOGY_NON_MANIFOLD", str(non_manifold))
    return issues


def evaluate_interaction_metrics(metrics: dict[str, Any]) -> list[dict[str, str]]:
    issues: list[dict[str, str]] = []
    vehicle_names = ("enterClearance", "exitClearance", "frontWheelClearance")
    if any(float(metrics.get(name, -99.0)) < 0.015 for name in vehicle_names):
        _issue(issues, "VEHICLE_SWEEP_COLLISION", str({name: metrics.get(name) for name in vehicle_names}))
    cargo_names = ("cargoApproachClearance", "cargoFitMargin", "cargoWithdrawClearance")
    if any(float(metrics.get(name, -99.0)) < 0.015 for name in cargo_names):
        _issue(issues, "CARGO_PATH_COLLISION", str({name: metrics.get(name) for name in cargo_names}))
    return issues


def _mesh_component_metrics(mesh: Any) -> tuple[int, float]:
    # glTF legitimately duplicates vertices along UV/material seams. Weld by
    # decoded position before evaluating connectivity so the gate measures
    # surface islands, not serialization splits.
    keys = [tuple(round(float(value), 5) for value in vertex.co) for vertex in mesh.vertices]
    adjacency = {key: set() for key in keys}
    for edge in mesh.edges:
        a, b = edge.vertices
        key_a, key_b = keys[a], keys[b]
        adjacency[key_a].add(key_b)
        adjacency[key_b].add(key_a)
    unseen = set(adjacency)
    sizes: list[int] = []
    while unseen:
        stack = [unseen.pop()]
        size = 0
        while stack:
            vertex = stack.pop()
            size += 1
            neighbors = adjacency[vertex] & unseen
            unseen.difference_update(neighbors)
            stack.extend(neighbors)
        sizes.append(size)
    return len(sizes), (max(sizes) / max(1, sum(sizes)))


def _mesh_non_manifold_edges(mesh: Any) -> int:
    face_uses: dict[tuple[tuple[float, float, float], tuple[float, float, float]], int] = {}
    positions = [tuple(round(float(value), 5) for value in vertex.co) for vertex in mesh.vertices]
    for polygon in mesh.polygons:
        indices = list(polygon.vertices)
        for index, first in enumerate(indices):
            pair = tuple(sorted((positions[first], positions[indices[(index + 1) % len(indices)]])))
            face_uses[pair] = face_uses.get(pair, 0) + 1
    return sum(count != 2 for count in face_uses.values())


def measure_source_digit_branches(blend_path: Path) -> dict[str, int]:
    """Count non-empty evaluated digit endpoint groups from the saved source geometry."""
    with bpy.data.libraries.load(str(blend_path), link=False) as (source, destination):
        if "farmer_hat_gloves_shoes" not in source.objects:
            return {"left": 0, "right": 0}
        destination.objects = ["farmer_hat_gloves_shoes"]
    obj = destination.objects[0]
    bpy.context.scene.collection.objects.link(obj)
    result: dict[str, int] = {}
    for side, label in (("l", "left"), ("r", "right")):
        groups = [group for group in obj.vertex_groups if group.name.startswith(f"digit_{side}_")]
        nonempty = 0
        for group in groups:
            if any(any(membership.group == group.index for membership in vertex.groups) for vertex in obj.data.vertices):
                nonempty += 1
        result[label] = nonempty
    bpy.data.objects.remove(obj, do_unlink=True)
    return result


def _uv_nondegenerate_ratio(mesh: Any) -> float:
    if not mesh.uv_layers:
        return 0.0
    mesh.calc_loop_triangles()
    uv = mesh.uv_layers.active.data
    valid = 0
    measurable = 0
    for triangle in mesh.loop_triangles:
        p0, p1, p2 = (mesh.vertices[index].co for index in triangle.vertices)
        if (p1 - p0).cross(p2 - p0).length <= 1e-10:
            continue
        measurable += 1
        a, b, c = (uv[index].uv for index in triangle.loops)
        area = abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) * 0.5
        valid += area > 1e-8
    return valid / max(1, measurable)


def _uv_overlap_ratio(mesh: Any, resolution: int = 2048) -> float:
    """Estimate true face overlap from independent interior samples.

    Samples stay away from triangle borders, so ordinary shared UV edges do
    not read as overlap.  This is intentionally derived from decoded GLB UVs;
    no source audit or authored island claim participates in the result.
    """
    if not mesh.uv_layers:
        return 1.0
    mesh.calc_loop_triangles()
    uv = mesh.uv_layers.active.data
    barycentric = ((1 / 3, 1 / 3, 1 / 3), (0.60, 0.20, 0.20), (0.20, 0.60, 0.20), (0.20, 0.20, 0.60))
    occupied: dict[tuple[int, int], list[frozenset[int]]] = {}
    duplicates = 0
    samples = 0
    for triangle in mesh.loop_triangles:
        points = [uv[index].uv for index in triangle.loops]
        vertices = frozenset(triangle.vertices)
        for wa, wb, wc in barycentric:
            u = points[0].x * wa + points[1].x * wb + points[2].x * wc
            v = points[0].y * wa + points[1].y * wb + points[2].y * wc
            key = (round(u * resolution), round(v * resolution))
            prior = occupied.setdefault(key, [])
            duplicates += any(vertices.isdisjoint(other) for other in prior)
            prior.append(vertices)
            samples += 1
    return duplicates / max(1, samples)


def measure_decoded_glb(visual_path: Path) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    """Import the delivered GLB and derive motion/contact/topology metrics independently."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(visual_path))
    rig = next(obj for obj in bpy.data.objects if obj.type == "ARMATURE")
    scene = bpy.context.scene
    formal_meshes = [obj for obj in bpy.data.objects if obj.type == "MESH" and obj.name.startswith("farmer_")]
    interaction_fixture = measure_character_fixture(
        REPOSITORY / "resources/blender/character/farmer-a.blend"
    )
    ground_z = interaction_fixture["ground"].z

    def activate_action(name: str) -> Any:
        # Imported glTF clips do not necessarily key every bone. Reset the
        # pose basis before changing clips so measurements cannot inherit
        # channels from the previously sampled action.
        for pose_bone in rig.pose.bones:
            pose_bone.matrix_basis = Matrix.Identity(4)
        action = bpy.data.actions[name]
        rig.animation_data.action = action
        scene.frame_set(int(round(action.frame_range[0])))
        return action

    def bone_position(name: str, frame: int) -> Vector:
        scene.frame_set(frame)
        return rig.matrix_world @ rig.pose.bones[name].head

    def lowest_weighted_vertex(bone_name: str, frame: int) -> float:
        """Measure the actual deformed sole/contact surface, not a bone proxy."""
        scene.frame_set(frame)
        depsgraph = bpy.context.evaluated_depsgraph_get()
        lowest: list[float] = []
        for obj in formal_meshes:
            group = obj.vertex_groups.get(bone_name)
            if group is None:
                continue
            indices = [
                vertex.index
                for vertex in obj.data.vertices
                if any(
                    membership.group == group.index and membership.weight >= 0.35
                    for membership in vertex.groups
                )
            ]
            if not indices:
                continue
            evaluated = obj.evaluated_get(depsgraph)
            evaluated_mesh = evaluated.to_mesh()
            try:
                lowest.append(
                    min((evaluated.matrix_world @ evaluated_mesh.vertices[index].co).z for index in indices)
                )
            finally:
                evaluated.to_mesh_clear()
        absolute_height = min(lowest) if lowest else bone_position(bone_name, frame).z - 0.10
        return absolute_height - ground_z

    def weighted_vertices_world(bone_name: str, frame: int) -> list[Vector]:
        scene.frame_set(frame)
        depsgraph = bpy.context.evaluated_depsgraph_get()
        points: list[Vector] = []
        for obj in formal_meshes:
            if bone_name.startswith("foot_") and obj.name != "farmer_hat_gloves_shoes":
                continue
            group = obj.vertex_groups.get(bone_name)
            if group is None:
                continue
            indices = [
                vertex.index
                for vertex in obj.data.vertices
                if (not bone_name.startswith("foot_") or vertex.co.z < 0.20)
                and any(membership.group == group.index and membership.weight >= 0.35 for membership in vertex.groups)
            ]
            evaluated = obj.evaluated_get(depsgraph)
            evaluated_mesh = evaluated.to_mesh()
            try:
                points.extend(evaluated.matrix_world @ evaluated_mesh.vertices[index].co for index in indices)
            finally:
                evaluated.to_mesh_clear()
        return points

    def sole_patch(bone_name: str, frame: int) -> tuple[float, float, Vector]:
        points = weighted_vertices_world(bone_name, frame)
        if not points:
            return 0.0, 90.0, bone_position(bone_name, frame)
        lowest = min(point.z for point in points)
        contact = [point for point in points if point.z <= max(ground_z + 0.035, lowest + 0.022)]
        if len(contact) < 3:
            return 0.0, 90.0, sum(contact, Vector()) / max(1, len(contact))
        span_x = max(point.x for point in contact) - min(point.x for point in contact)
        span_y = max(point.y for point in contact) - min(point.y for point in contact)
        area = span_x * span_y
        height_range = max(point.z for point in contact) - min(point.z for point in contact)
        tilt = math.degrees(math.atan2(height_range, max(0.001, max(span_x, span_y))))
        return area, tilt, sum(contact, Vector()) / len(contact)

    def nearest_weighted_vertex_distance(bone_name: str, frame: int, target: Vector) -> float:
        """Measure the delivered deformed contact surface, not a bone proxy."""
        scene.frame_set(frame)
        depsgraph = bpy.context.evaluated_depsgraph_get()
        distances: list[float] = []
        for obj in formal_meshes:
            group = obj.vertex_groups.get(bone_name)
            if group is None:
                continue
            indices = [
                vertex.index
                for vertex in obj.data.vertices
                if any(
                    membership.group == group.index and membership.weight >= 0.35
                    for membership in vertex.groups
                )
            ]
            if not indices:
                continue
            evaluated = obj.evaluated_get(depsgraph)
            evaluated_mesh = evaluated.to_mesh()
            try:
                distances.append(
                    min((evaluated.matrix_world @ evaluated_mesh.vertices[index].co - target).length for index in indices)
                )
            finally:
                evaluated.to_mesh_clear()
        return min(distances) if distances else (bone_position(bone_name, frame) - target).length

    samples: dict[str, dict[str, Any]] = {}
    for action_name in REQUIRED_ANIMATIONS:
        action = activate_action(action_name)
        start, end = (int(round(value)) for value in action.frame_range)
        frames = sorted({start, end, round(start + (end - start) * 0.25), round(start + (end - start) * 0.5), round(start + (end - start) * 0.75)})
        root_positions = [bone_position("root", frame) for frame in frames]
        signature = [
            round(value, 3)
            for frame in frames
            for bone_name in ("root", "pelvis", "hand_l", "hand_r", "foot_l", "foot_r")
            for value in bone_position(bone_name, frame)
        ]
        samples[action_name] = {
            "rootTravel": round(max((position - root_positions[0]).length for position in root_positions), 4),
            "poseSignature": signature,
        }

    walk_action = activate_action("walk")
    walk_frames = (1, 8, 16, 23, 30)
    feet = [bone_position(side, frame) for frame in walk_frames for side in ("foot_l", "foot_r")]
    samples["walk"]["footTravel"] = round(max((a - b).length for a in feet for b in feet), 4)
    walk_soles = {
        frame: [lowest_weighted_vertex(side, frame) for side in ("foot_l", "foot_r")]
        for frame in walk_frames
    }
    walk_patches = {
        frame: {side: sole_patch(side, frame) for side in ("foot_l", "foot_r")}
        for frame in walk_frames
    }
    shoe_centers = {
        frame: {
            side: (lambda points: sum(points, Vector()) / max(1, len(points)))(weighted_vertices_world(side, frame))
            for side in ("foot_l", "foot_r")
        }
        for frame in walk_frames
    }
    support_patches = [
        patch
        for frame in walk_frames
        for side, patch in walk_patches[frame].items()
        if -0.025 <= walk_soles[frame][0 if side == "foot_l" else 1] <= 0.045
    ]
    slides: list[float] = []
    for side in ("foot_l", "foot_r"):
        index = 0 if side == "foot_l" else 1
        for prior, current in zip(walk_frames, walk_frames[1:]):
            if (
                -0.025 <= walk_soles[prior][index] <= 0.045
                and -0.025 <= walk_soles[current][index] <= 0.045
                and walk_patches[prior][side][0] >= 0.002
                and walk_patches[current][side][0] >= 0.002
            ):
                slides.append((shoe_centers[current][side] - shoe_centers[prior][side]).xy.length)
    grounded = sum(any(-0.025 <= height <= 0.045 for height in heights) for heights in walk_soles.values())
    airborne = sum(all(height > 0.065 for height in heights) for heights in walk_soles.values())
    samples["walk"].update(
        {
            "plantedFrames": grounded,
            "groundedFrames": grounded,
            "airborneFrames": airborne,
            "soleHeights": {str(frame): [round(value, 4) for value in heights] for frame, heights in walk_soles.items()},
            "minimumSoleHeight": round(min(value for heights in walk_soles.values() for value in heights), 4),
            "minimumSoleArea": round(min((patch[0] for patch in support_patches), default=0.0), 5),
            "maximumSoleTiltDegrees": round(max((patch[1] for patch in support_patches), default=90.0), 2),
            "maximumFootSlide": round(max(slides, default=0.0), 4),
            "phaseSeparation": round(
                max((bone_position("foot_l", frame) - bone_position("foot_r", frame)).length for frame in walk_frames),
                4,
            ),
        }
    )
    activate_action("lift_crate")
    lift_frames = (1, 22, 48, 70)
    lift_soles = {
        frame: [lowest_weighted_vertex(side, frame) for side in ("foot_l", "foot_r")]
        for frame in lift_frames
    }
    lift_patches = {
        frame: [sole_patch(side, frame) for side in ("foot_l", "foot_r")]
        for frame in lift_frames
    }
    bilateral = sum(
        all(-0.025 <= height <= 0.045 for height in heights)
        and all(patch[0] >= 0.002 for patch in lift_patches[frame])
        for frame, heights in lift_soles.items()
    )
    crate_center = (interaction_fixture["crateLeft"] + interaction_fixture["crateRight"]) * 0.5
    lift_load_distances: list[float] = []
    lean_angles: list[float] = []
    for frame in lift_frames:
        hands = (bone_position("hand_l", frame) + bone_position("hand_r", frame)) * 0.5
        pelvis = bone_position("pelvis", frame)
        head = bone_position("head", frame)
        lift_load_distances.append((hands - pelvis).length)
        torso = head - pelvis
        lean_angles.append(math.degrees(torso.angle(Vector((0.0, 0.0, 1.0)))))
    samples["lift_crate"].update(
        {
            "groundedFrames": sum(any(-0.025 <= height <= 0.045 for height in heights) for heights in lift_soles.values()),
            "airborneFrames": sum(all(height > 0.065 for height in heights) for heights in lift_soles.values()),
            "soleHeights": {str(frame): [round(value, 4) for value in heights] for frame, heights in lift_soles.items()},
            "bilateralSupportFrames": bilateral,
            "minimumSoleArea": round(min((patch[0] for patches in lift_patches.values() for patch in patches), default=0.0), 5),
            "splitStance": round(
                min((bone_position("foot_l", frame) - bone_position("foot_r", frame)).xy.length for frame in lift_frames),
                4,
            ),
            "loadDistance": round(max(lift_load_distances), 4),
            "backwardLeanDegrees": round(max(0.0, max(lean_angles) - 8.0), 2),
        }
    )
    for name, frame in (("pick_low", 35), ("pick_mid", 29), ("pick_high", 38)):
        activate_action(name)
        samples[name]["handHeight"] = round(bone_position("hand_l", frame).z, 4)

    body = bpy.data.objects.get("farmer_body_continuous")
    if body is None:
        geometry = {"bodyComponents": 999, "bodyLargestComponentRatio": 0, "uvNonDegenerateRatio": 0, "maxInfluences": 999}
    else:
        components, largest = _mesh_component_metrics(body.data)
        semantic_meshes = {
            "body": body,
            "workwear": bpy.data.objects.get("farmer_layered_workwear"),
            "gear": bpy.data.objects.get("farmer_hat_gloves_shoes"),
        }
        geometry = {
            "bodyComponents": components,
            "bodyLargestComponentRatio": round(largest, 5),
            "uvNonDegenerateRatio": round(min(_uv_nondegenerate_ratio(obj.data) for obj in formal_meshes), 5),
            "uvOverlapRatio": round(max(_uv_overlap_ratio(obj.data) for obj in formal_meshes), 5),
            "maxInfluences": max(len(vertex.groups) for obj in formal_meshes for vertex in obj.data.vertices),
            "surfaceComponents": {
                name: (_mesh_component_metrics(obj.data)[0] if obj is not None else 999)
                for name, obj in semantic_meshes.items()
            },
            "nonManifoldEdges": {
                name: (_mesh_non_manifold_edges(obj.data) if obj is not None else 999)
                for name, obj in semantic_meshes.items()
            },
        }

    contacts: dict[str, Any] = {}
    targets = {
        "pick_low": (35, "hand_l", interaction_fixture["pickLow"]),
        "pick_mid": (29, "hand_l", interaction_fixture["pickMid"]),
        "pick_high": (38, "hand_l", interaction_fixture["pickHigh"]),
    }
    for name, (frame, bone_name, target) in targets.items():
        activate_action(name)
        contacts[name] = round(nearest_weighted_vertex_distance(bone_name, frame, target), 4)
    activate_action("carry_crate")
    contacts["carryLeft"] = round(nearest_weighted_vertex_distance("hand_l", 20, interaction_fixture["crateLeft"]), 4)
    contacts["carryRight"] = round(nearest_weighted_vertex_distance("hand_r", 20, interaction_fixture["crateRight"]), 4)
    vehicle = measure_vehicle_fixture(REPOSITORY / "resources/blender/vehicle/electric-tricycle-a.blend")
    activate_action("drive")
    contacts["driveLeft"] = round(nearest_weighted_vertex_distance("hand_l", 30, vehicle["gripLeft"]), 4)
    contacts["driveRight"] = round(nearest_weighted_vertex_distance("hand_r", 30, vehicle["gripRight"]), 4)
    contacts["driverSeat"] = round((bone_position("pelvis", 30) - vehicle["driverSeat"]).length, 4)
    contacts["driveFootLeft"] = round((bone_position("foot_l", 30) - (vehicle["footboardLeft"] + Vector((0, 0, 0.025)))).length, 4)
    contacts["driveFootRight"] = round((bone_position("foot_r", 30) - (vehicle["footboardRight"] + Vector((0, 0, 0.025)))).length, 4)
    activate_action("enter_vehicle")
    contacts["enterStartAtExitSocket"] = round((bone_position("root", 1) - vehicle["exitLeft"]).length, 4)
    activate_action("exit_vehicle")
    contacts["exitEndAtExitSocket"] = round((bone_position("root", 70) - vehicle["exitLeft"]).length, 4)
    vehicle_bounds = measure_vehicle_bounds(REPOSITORY / "resources/blender/vehicle/electric-tricycle-a.blend")

    def point_aabb_clearance(point: Vector, bounds: tuple[Vector, Vector], radius: float = 0.0) -> float:
        low, high = bounds
        outside = Vector(tuple(max(low[axis] - point[axis], 0.0, point[axis] - high[axis]) for axis in range(3)))
        if outside.length > 0:
            return outside.length - radius
        penetration = min(point[axis] - low[axis] for axis in range(3))
        penetration = min(penetration, *(high[axis] - point[axis] for axis in range(3)))
        return -penetration - radius

    def sweep_clearance(action_name: str) -> tuple[float, float]:
        action = activate_action(action_name)
        start, end = (int(round(value)) for value in action.frame_range)
        frames = range(start, end + 1, 4)
        body_points = ("pelvis", "spine_01", "spine_02", "head", "hand_l", "hand_r")
        structural = (vehicle_bounds["chassis"], vehicle_bounds["cargoBed"])
        structure_clearance = min(
            point_aabb_clearance(bone_position(bone, frame), bounds, 0.025)
            for frame in frames for bone in body_points for bounds in structural
        )
        wheel_clearance = min(
            point_aabb_clearance(bone_position(bone, frame), vehicle_bounds["frontWheel"], 0.025)
            for frame in frames for bone in body_points + ("foot_l", "foot_r")
        )
        return structure_clearance, wheel_clearance

    enter_clearance, enter_wheel = sweep_clearance("enter_vehicle")
    exit_clearance, exit_wheel = sweep_clearance("exit_vehicle")
    slot_center = (vehicle_bounds["cargoSlot"][0] + vehicle_bounds["cargoSlot"][1]) * 0.5
    left_inner = vehicle_bounds["cargoWallLeft"][1].x
    right_inner = vehicle_bounds["cargoWallRight"][0].x
    front_inner = vehicle_bounds["cargoWallFront"][1].y
    rear_inner = vehicle_bounds["cargoWallRear"][0].y
    crate_half = Vector((0.25, 0.175, 0.145))
    cargo_fit = min(
        slot_center.x - crate_half.x - left_inner,
        right_inner - slot_center.x - crate_half.x,
        slot_center.y - crate_half.y - front_inner,
        rear_inner - slot_center.y - crate_half.y,
    )
    activate_action("load_crate")
    approach_center = (bone_position("hand_l", 30) + bone_position("hand_r", 30)) * 0.5 - Vector((0.0, 0.0, 0.061))
    wall_bounds = tuple(vehicle_bounds[name] for name in ("cargoWallLeft", "cargoWallRight", "cargoWallFront", "cargoWallRear"))
    crate_corners = [
        approach_center + Vector((sx * crate_half.x, sy * crate_half.y, sz * crate_half.z))
        for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)
    ]
    cargo_approach = min(point_aabb_clearance(corner, bounds) for corner in crate_corners for bounds in wall_bounds)
    withdraw_hands = [bone_position(name, 65) for name in ("hand_l", "hand_r")]
    cargo_withdraw = min(point_aabb_clearance(point, bounds, 0.025) for point in withdraw_hands for bounds in wall_bounds)
    samples["interaction"] = {
        "enterClearance": round(enter_clearance, 4),
        "exitClearance": round(exit_clearance, 4),
        "frontWheelClearance": round(min(enter_wheel, exit_wheel), 4),
        "cargoApproachClearance": round(cargo_approach, 4),
        "cargoFitMargin": round(cargo_fit, 4),
        "cargoWithdrawClearance": round(cargo_withdraw, 4),
    }
    return samples, geometry, contacts


def evaluate_contacts(contacts: dict[str, Any]) -> list[dict[str, str]]:
    issues: list[dict[str, str]] = []
    for name, distance in contacts.items():
        if float(distance) > 0.10:
            _issue(issues, "CONTACT_DISTANCE_EXCEEDED", f"{name}: {distance} m")
    return issues


def evidence_image_metrics(review_dir: Path) -> dict[str, Any]:
    import numpy as np
    def load(name: str) -> tuple[Any, Any]:
        image = bpy.data.images.load(str(review_dir / name), check_existing=False)
        pixels = np.array(image.pixels[:], dtype=np.float32)
        size = tuple(image.size)
        bpy.data.images.remove(image)
        return pixels, size
    enter_pixels, enter_size = load("enter-vehicle-path.png")
    exit_pixels, exit_size = load("exit-vehicle-path.png")
    hands_pixels, hands_size = load("hands-closeup.png")
    rig_pixels, rig_size = load("rig-bone-overlay.png")
    joint_pixels, joint_size = load("joint-deformation-sheet.png")
    _ = hands_pixels
    _ = joint_pixels
    changed_ratio = 1.0
    if enter_size == exit_size:
        enter_rgba = enter_pixels.reshape(enter_size[1], enter_size[0], 4)
        exit_rgba = exit_pixels.reshape(exit_size[1], exit_size[0], 4)
        changed_ratio = float(np.mean(np.max(np.abs(enter_rgba[:, :, :3] - exit_rgba[:, :, :3]), axis=2) > 0.05))
    return {
        "enterExitMeanDifference": round(float(np.mean(np.abs(enter_pixels - exit_pixels))), 6) if enter_size == exit_size else 1.0,
        "enterExitChangedPixelRatio": round(changed_ratio, 6),
        "handsAspect": round(hands_size[0] / max(1, hands_size[1]), 4),
        "rigLabelPixels": int(
            np.sum(
                (rig_pixels.reshape(rig_size[1], rig_size[0], 4)[:, :, 0] < 0.35)
                & (rig_pixels.reshape(rig_size[1], rig_size[0], 4)[:, :, 1] > 0.55)
                & (rig_pixels.reshape(rig_size[1], rig_size[0], 4)[:, :, 2] > 0.55)
            )
        ),
        "jointSheetAspect": round(joint_size[0] / max(1, joint_size[1]), 4),
    }


def evaluate_evidence_metrics(metrics: dict[str, Any]) -> list[dict[str, str]]:
    issues: list[dict[str, str]] = []
    if float(metrics.get("enterExitChangedPixelRatio", 0)) < 0.01:
        _issue(issues, "ENTER_EXIT_EVIDENCE_DUPLICATE", str(metrics))
    if float(metrics.get("handsAspect", 0)) < 1.7:
        _issue(issues, "HANDS_EVIDENCE_NOT_CLOSEUP", str(metrics))
    if int(metrics.get("rigLabelPixels", 0)) < 100:
        _issue(issues, "RIG_LABEL_PROOF_MISSING", str(metrics.get("rigLabelPixels", 0)))
    if not 1.35 <= float(metrics.get("jointSheetAspect", 0)) <= 1.65:
        _issue(issues, "JOINT_SHEET_LAYOUT_INVALID", str(metrics.get("jointSheetAspect", 0)))
    return issues


def review_delivery(root: Path = REPOSITORY) -> dict[str, Any]:
    source = root / "resources/blender/character/farmer-a.blend"
    asset_dir = root / "public/assets/character/farmer-a"
    visual = asset_dir / "visual.glb"
    collision = asset_dir / "collision.glb"
    metrics_path = asset_dir / "export-metrics.json"
    review_dir = root / "artifacts/review/character/farmer-a"
    audit_path = review_dir / "character-review-audit.json"
    issues: list[dict[str, str]] = []

    for path, code in ((source, "SOURCE_MISSING"), (visual, "VISUAL_MISSING"), (collision, "COLLISION_MISSING")):
        if not path.is_file():
            _issue(issues, code, str(path))
    if issues:
        return {"assetId": "character.farmer-a", "valid": False, "issues": issues}

    try:
        visual_doc = read_glb(visual)
        collision_doc = read_glb(collision)
    except (OSError, ValueError, json.JSONDecodeError) as error:
        _issue(issues, "GLB_PARSE_FAILED", str(error))
        return {"assetId": "character.farmer-a", "valid": False, "issues": issues}

    nodes = visual_doc.get("nodes", [])
    node_names = {node.get("name") for node in nodes if isinstance(node.get("name"), str)}
    missing_bones = sorted(REQUIRED_BONES - node_names)
    missing_interfaces = sorted(REQUIRED_INTERFACES - node_names)
    if missing_bones:
        _issue(issues, "BONES_MISSING", ", ".join(missing_bones))
    if missing_interfaces:
        _issue(issues, "INTERFACES_MISSING", ", ".join(missing_interfaces))

    animations = {
        animation.get("name"): animation
        for animation in visual_doc.get("animations", [])
        if isinstance(animation.get("name"), str)
    }
    actual_animation_names = set(animations)
    if actual_animation_names != REQUIRED_ANIMATIONS:
        _issue(issues, "ANIMATION_SET_MISMATCH", f"actual={sorted(actual_animation_names)}")
    for name in sorted(REQUIRED_ANIMATIONS):
        actual_events = animations.get(name, {}).get("extras", {}).get("events", [])
        expected_events = EXPECTED_EVENTS.get(name, [])
        if actual_events != expected_events:
            _issue(issues, "ANIMATION_EVENT_MISMATCH", f"{name}: {actual_events!r}")

    if len(visual_doc.get("skins", [])) != 1:
        _issue(issues, "SKIN_COUNT_INVALID", str(len(visual_doc.get("skins", []))))
    mesh_nodes = [node for node in nodes if "mesh" in node]
    if not mesh_nodes or any("skin" not in node for node in mesh_nodes):
        _issue(issues, "UNSKINNED_RUNTIME_MESH", f"meshNodes={len(mesh_nodes)}")
    primitives = [primitive for mesh in visual_doc.get("meshes", []) for primitive in mesh.get("primitives", [])]
    for index, primitive in enumerate(primitives):
        attributes = primitive.get("attributes", {})
        if "JOINTS_0" not in attributes or "WEIGHTS_0" not in attributes:
            _issue(issues, "SKIN_ATTRIBUTES_MISSING", str(index))
        if "COLOR_0" not in attributes:
            _issue(issues, "RUNTIME_COLOR_MISSING", str(index))
    material_names = {material.get("name") for material in visual_doc.get("materials", [])}
    expected_materials = {"M_Farmer_Skin", "M_Farmer_EyesHair", "M_Farmer_Cloth", "M_Farmer_Gear"}
    if material_names != expected_materials:
        _issue(issues, "MATERIAL_SET_MISMATCH", str(sorted(material_names)))
    if visual_doc.get("cameras") or any("camera" in node for node in nodes):
        _issue(issues, "CAMERA_LEAK", "visual.glb contains a camera")
    extensions = visual_doc.get("extensions", {})
    if "KHR_lights_punctual" in extensions:
        _issue(issues, "LIGHT_LEAK", "visual.glb contains lights")
    forbidden = sorted(name for name in node_names if any(token in name.lower() for token in ("review", "crate", "tricycle", "peach_fixture")))
    if forbidden:
        _issue(issues, "REVIEW_FIXTURE_LEAK", ", ".join(forbidden))
    if collision_doc.get("nodes") or collision_doc.get("meshes"):
        _issue(issues, "COLLISION_NOT_EMPTY", "runtime capsule must remain downstream")

    metrics: dict[str, Any] = {}
    if metrics_path.is_file():
        metrics = json.loads(metrics_path.read_text(encoding="utf-8"))
        if int(metrics.get("triangleCount", 60001)) > 60000:
            _issue(issues, "TRIANGLE_BUDGET_EXCEEDED", str(metrics.get("triangleCount")))
        if int(metrics.get("materialCount", 5)) > 4:
            _issue(issues, "MATERIAL_BUDGET_EXCEEDED", str(metrics.get("materialCount")))
        if int(metrics.get("textureCount", 7)) > 6:
            _issue(issues, "TEXTURE_BUDGET_EXCEEDED", str(metrics.get("textureCount")))
    else:
        _issue(issues, "METRICS_MISSING", str(metrics_path))

    available_evidence = {path.name for path in review_dir.glob("*.png")}
    missing_evidence = sorted(REQUIRED_EVIDENCE - available_evidence)
    if missing_evidence:
        _issue(issues, "EVIDENCE_MISSING", ", ".join(missing_evidence))
    audit: dict[str, Any] = {}
    if audit_path.is_file():
        audit = json.loads(audit_path.read_text(encoding="utf-8"))
        action_audit = audit.get("animations", {})
        if set(action_audit) != REQUIRED_ANIMATIONS:
            _issue(issues, "ANIMATION_AUDIT_INCOMPLETE", str(sorted(action_audit)))
        fingerprints: set[str] = set()
        for name, stats in sorted(action_audit.items()):
            if len(stats.get("keyedFrames", [])) < 3 or not stats.get("changedBones"):
                _issue(issues, "STATIC_ANIMATION", name)
            fingerprint = json.dumps(
                [stats.get("keyedFrames"), stats.get("changedBones"), stats.get("valueRange")],
                sort_keys=True,
            )
            if fingerprint in fingerprints:
                _issue(issues, "DUPLICATE_ANIMATION", name)
            fingerprints.add(fingerprint)
        if not audit.get("runtimeCapsule", {}).get("sourceCollisionCollectionEmpty"):
            _issue(issues, "RUNTIME_CAPSULE_POLICY_MISSING", "audit does not confirm empty source collision")
    else:
        _issue(issues, "REVIEW_AUDIT_MISSING", str(audit_path))

    image_metrics = evidence_image_metrics(review_dir)
    issues.extend(evaluate_evidence_metrics(image_metrics))
    motion_metrics, geometry_metrics, contact_metrics = measure_decoded_glb(visual)
    geometry_metrics["digitBranches"] = measure_source_digit_branches(source)
    issues.extend(evaluate_motion_metrics(motion_metrics))
    issues.extend(evaluate_geometry_metrics(geometry_metrics))
    issues.extend(evaluate_interaction_metrics(motion_metrics.get("interaction", {})))
    issues.extend(evaluate_contacts(contact_metrics))

    hashes = {
        path.name: hashlib.sha256(path.read_bytes()).hexdigest()
        for path in (source, visual, collision)
    }
    return {
        "assetId": "character.farmer-a",
        "valid": not issues,
        "issues": sorted(issues, key=lambda issue: (issue["code"], issue["message"])),
        "metrics": metrics,
        "runtime": {
            "nodeCount": len(nodes),
            "meshNodeCount": len(mesh_nodes),
            "skinCount": len(visual_doc.get("skins", [])),
            "animationCount": len(animations),
            "collisionNodeCount": len(collision_doc.get("nodes", [])),
        },
        "evidence": {"required": len(REQUIRED_EVIDENCE), "available": len(REQUIRED_EVIDENCE & available_evidence)},
        "decodedGlbMeasurements": {
            "motion": motion_metrics,
            "geometry": geometry_metrics,
            "contacts": contact_metrics,
            "images": image_metrics,
        },
        "sha256": hashes,
    }


if __name__ == "__main__":
    result = review_delivery()
    print(json.dumps(result, indent=2, sort_keys=True))
    raise SystemExit(0 if result["valid"] else 1)
