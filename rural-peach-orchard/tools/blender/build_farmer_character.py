"""Build the original rigged farmer-a character and render review evidence.

Build:
  blender --background --python tools/blender/build_farmer_character.py

Render from the saved source (the required review path):
  blender --background resources/blender/character/farmer-a.blend \
    --python tools/blender/build_farmer_character.py -- --render-only
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from typing import Any

import bpy
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from farmer_character_geometry import build_character_geometry
from review_farmer_character import measure_fixture_objects, measure_vehicle_fixture


REPOSITORY = Path(__file__).resolve().parents[2]
BLEND_PATH = REPOSITORY / "resources/blender/character/farmer-a.blend"
REVIEW_DIR = REPOSITORY / "artifacts/review/character/farmer-a"
TRICYCLE_BLEND = REPOSITORY / "resources/blender/vehicle/electric-tricycle-a.blend"
TEXTURE_DIR = REPOSITORY / "public/assets/character/farmer-a/textures"

M_SKIN = "M_Farmer_Skin"
M_HAIR = "M_Farmer_EyesHair"
M_CLOTH = "M_Farmer_Cloth"
M_GEAR = "M_Farmer_Gear"

CLIPS = {
    "idle": (90, True),
    "walk": (30, True),
    "enter_vehicle": (75, False),
    "drive": (60, True),
    "exit_vehicle": (70, False),
    "pick_low": (60, False),
    "pick_mid": (50, False),
    "pick_high": (65, False),
    "carry_crate": (40, True),
    "lift_crate": (70, False),
    "load_crate": (65, False),
}

EVENTS = {
    "pick_low": [{"name": "fruit_contact", "normalizedTime": 0.58}],
    "pick_mid": [{"name": "fruit_contact", "normalizedTime": 0.58}],
    "pick_high": [{"name": "fruit_contact", "normalizedTime": 0.58}],
    "carry_crate": [{"name": "crate_gripped", "normalizedTime": 0.31}],
    "lift_crate": [{"name": "crate_gripped", "normalizedTime": 0.31}],
    "load_crate": [{"name": "crate_released", "normalizedTime": 0.76}],
}


def args_after_separator() -> list[str]:
    if "--" not in sys.argv:
        return []
    return sys.argv[sys.argv.index("--") + 1 :]


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.name = "SCENE"
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.unit_settings.length_unit = "METERS"
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    for name in ("VISUAL", "COLLISION", "SOCKETS", "RIG"):
        scene.collection.children.link(bpy.data.collections.new(name))
    for name in ("LOD0", "LOD1", "LOD2"):
        bpy.data.collections["VISUAL"].children.link(bpy.data.collections.new(name))


def create_materials() -> dict[str, Any]:
    definitions = {
        M_SKIN: ((0.56, 0.31, 0.20, 1.0), 0.60),
        M_HAIR: ((0.045, 0.035, 0.028, 1.0), 0.66),
        M_CLOTH: ((0.078, 0.14, 0.086, 1.0), 0.81),
        M_GEAR: ((0.33, 0.31, 0.23, 1.0), 0.70),
    }
    output: dict[str, Any] = {}
    TEXTURE_DIR.mkdir(parents=True, exist_ok=True)
    for name, (base_color, roughness) in definitions.items():
        material = bpy.data.materials.new(name)
        material.use_nodes = True
        material.diffuse_color = base_color
        shader = material.node_tree.nodes.get("Principled BSDF")
        shader.inputs["Base Color"].default_value = base_color
        shader.inputs["Roughness"].default_value = roughness
        shader.inputs["Metallic"].default_value = 0.0
        vertex = material.node_tree.nodes.new("ShaderNodeVertexColor")
        vertex.layer_name = "wear_color"
        size = 256
        yy, xx = np.indices((size, size), dtype=np.float32)
        weave = 0.035 * np.sin(xx * math.tau / 7.0) * np.sin(yy * math.tau / 9.0)
        broad = 0.025 * np.sin((xx + yy) * math.tau / 83.0)
        if name == M_SKIN:
            weave *= 0.20
            broad *= 0.35
        elif name == M_HAIR:
            weave = 0.05 * np.sin((xx * 0.32 + yy * 0.06) * math.tau)
            broad *= 0.25
        elif name == M_GEAR:
            weave *= 0.55
        value = np.clip(0.94 + weave + broad, 0.82, 1.0)
        pixels = np.empty((size, size, 4), dtype=np.float32)
        pixels[:, :, 0] = value
        pixels[:, :, 1] = value
        pixels[:, :, 2] = value
        pixels[:, :, 3] = 1.0
        image = bpy.data.images.new(f"T_{name[2:]}_BaseColor", width=size, height=size, alpha=True)
        image.pixels.foreach_set(pixels.ravel())
        image.file_format = "PNG"
        image.filepath_raw = str(TEXTURE_DIR / f"{name[2:].lower()}-basecolor.png")
        image.save()
        texture = material.node_tree.nodes.new("ShaderNodeTexImage")
        texture.image = image
        texture.interpolation = "Linear"
        multiply = material.node_tree.nodes.new("ShaderNodeMixRGB")
        multiply.blend_type = "MULTIPLY"
        multiply.inputs[0].default_value = 1.0
        material.node_tree.links.new(vertex.outputs["Color"], multiply.inputs[1])
        material.node_tree.links.new(texture.outputs["Color"], multiply.inputs[2])
        material.node_tree.links.new(multiply.outputs["Color"], shader.inputs["Base Color"])
        output[name] = material
    return output


def build_body(materials: dict[str, Any]) -> list[Any]:
    """Build only the current welded production geometry."""
    return build_character_geometry(materials)


def create_rig() -> Any:
    data = bpy.data.armatures.new("farmer_humanoid_armature")
    rig = bpy.data.objects.new("farmer_rig", data)
    bpy.data.collections["RIG"].objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")

    def bone(name: str, head: tuple[float, float, float], tail: tuple[float, float, float], parent: str | None = None) -> None:
        edit = data.edit_bones.new(name)
        edit.head = head
        edit.tail = tail
        if parent:
            edit.parent = data.edit_bones[parent]

    bone("root", (0, 0, 0), (0, 0, 0.10))
    bone("pelvis", (0, 0, 0.94), (0, 0, 1.04), "root")
    bone("spine_01", (0, 0, 1.04), (0, 0, 1.21), "pelvis")
    bone("spine_02", (0, 0, 1.21), (0, 0, 1.37), "spine_01")
    bone("neck", (0, 0, 1.37), (0, 0, 1.48), "spine_02")
    bone("head", (0, 0, 1.48), (0, 0, 1.66), "neck")
    for suffix, side in (("l", -1), ("r", 1)):
        x = float(side)
        bone(f"clavicle_{suffix}", (0, 0, 1.35), (x * 0.21, 0, 1.34), "spine_02")
        bone(f"upper_arm_{suffix}", (x * 0.21, 0, 1.34), (x * 0.50, 0, 1.14), f"clavicle_{suffix}")
        bone(f"lower_arm_{suffix}", (x * 0.50, 0, 1.14), (x * 0.70, 0, 1.035), f"upper_arm_{suffix}")
        bone(f"hand_{suffix}", (x * 0.70, 0, 1.035), (x * 0.81, 0, 1.00), f"lower_arm_{suffix}")
        bone(f"thigh_{suffix}", (x * 0.087, 0, 0.95), (x * 0.085, 0, 0.52), "pelvis")
        bone(f"calf_{suffix}", (x * 0.085, 0, 0.52), (x * 0.075, 0, 0.10), f"thigh_{suffix}")
        bone(f"foot_{suffix}", (x * 0.075, 0, 0.10), (x * 0.075, -0.18, 0.04), f"calf_{suffix}")
        for finger_index, finger_name in enumerate(("thumb", "index", "middle", "ring", "little")):
            y = -0.025 + finger_index * 0.012
            start_x = x * 0.79
            mid_x = x * 0.825
            end_x = x * (0.85 if finger_name not in ("thumb", "little") else 0.84)
            bone(f"{finger_name}_01_{suffix}", (start_x, y, 1.005), (mid_x, y, 1.00), f"hand_{suffix}")
            bone(f"{finger_name}_02_{suffix}", (mid_x, y, 1.00), (end_x, y, 0.997), f"{finger_name}_01_{suffix}")
    bpy.ops.object.mode_set(mode="OBJECT")
    rig.select_set(False)
    rig["runtime_capsule_recommendation"] = json.dumps(
        {
            "standing": {"radius": 0.29, "height": 1.62, "centerZ": 0.81},
            "interaction": {"radius": 0.27, "height": 1.50, "centerZ": 0.75},
            "vehicle": {"radius": 0.25, "height": 1.18, "centerZ": 0.69},
            "implementation": "runtime-only; COLLISION collection intentionally empty",
        },
        sort_keys=True,
    )
    return rig


def distance_to_segment(point: Vector, a: Vector, b: Vector) -> tuple[float, float]:
    ab = b - a
    t = max(0.0, min(1.0, (point - a).dot(ab) / max(ab.length_squared, 1e-8)))
    return (point - (a + ab * t)).length, t


def skin_meshes(objects: list[Any], rig: Any) -> None:
    deform_bones = [bone for bone in rig.data.bones if bone.name != "root"]
    for obj in objects:
        groups = {bone.name: obj.vertex_groups.new(name=bone.name) for bone in deform_bones}
        for vertex in obj.data.vertices:
            point = vertex.co
            side = "l" if point.x < 0 else "r"
            # Restrict each vertex to its anatomical chain before distance
            # weighting. Global nearest-bone weighting let fingers steal shirt
            # vertices and opposite limbs influence the crotch.
            if point.z > 1.43 and abs(point.x) < 0.19:
                candidate_names = ("neck", "head")
            elif point.z > 0.96 and abs(point.x) < 0.205:
                candidate_names = ("pelvis", "spine_01", "spine_02", "neck")
            elif point.z > 0.94 and abs(point.x) >= 0.205:
                candidate_names = (
                    f"clavicle_{side}", f"upper_arm_{side}",
                    f"lower_arm_{side}", f"hand_{side}",
                )
            elif point.z > 0.49:
                candidate_names = ("pelvis", f"thigh_{side}", f"calf_{side}")
            else:
                candidate_names = (f"thigh_{side}", f"calf_{side}", f"foot_{side}")
            candidates = [rig.data.bones[name] for name in candidate_names]
            ranked = sorted(
                (
                    (distance_to_segment(point, bone.head_local, bone.tail_local)[0], bone.name)
                    for bone in candidates
                ),
                key=lambda item: item[0],
            )[:2]
            weights = [1.0 / max(distance, 0.015) ** 2 for distance, _ in ranked]
            total = sum(weights)
            for weight, (_, bone_name) in zip(weights, ranked):
                groups[bone_name].add([vertex.index], weight / total, "REPLACE")
        modifier = obj.modifiers.new("Humanoid skin", "ARMATURE")
        modifier.object = rig
        modifier.use_deform_preserve_volume = True
        obj.parent = rig


def create_interfaces(rig: Any) -> None:
    definitions = {
        "hand_grip_left": "hand_l",
        "hand_grip_right": "hand_r",
        "basket_mount": "pelvis",
        "root_motion": "root",
    }
    for name, bone_name in definitions.items():
        empty = bpy.data.objects.new(name, None)
        bpy.data.collections["SOCKETS"].objects.link(empty)
        empty.parent = rig
        empty.parent_type = "BONE"
        empty.parent_bone = bone_name
        empty.matrix_parent_inverse = Matrix.Identity(4)
        empty.empty_display_size = 0.04
        empty["interface"] = True


def set_pose_values(rig: Any, values: dict[str, tuple[float, float, float]], frame: int) -> None:
    for bone_name, rotation in values.items():
        if bone_name.startswith("__"):
            continue
        pose = rig.pose.bones[bone_name]
        pose.rotation_mode = "XYZ"
        pose.rotation_euler = rotation
        pose.keyframe_insert(data_path="rotation_euler", frame=frame, group=bone_name)
    rig.pose.bones["root"].location = values.get("__root_location", (0.0, 0.0, 0.0))
    rig.pose.bones["pelvis"].location = values.get("__pelvis_location", (0.0, 0.0, 0.0))
    for bone_name in ("root", "pelvis"):
        rig.pose.bones[bone_name].keyframe_insert(data_path="location", frame=frame, group=bone_name)


def reset_pose(rig: Any) -> None:
    for pose in rig.pose.bones:
        pose.rotation_mode = "XYZ"
        pose.rotation_euler = (0, 0, 0)
        pose.location = (0, 0, 0)


def ground_action_frames(rig: Any, action_name: str, frames: tuple[int, ...]) -> None:
    """Place the lowest actually deformed shoe sole on the authored ground."""
    scene = bpy.context.scene
    rig.animation_data.action = bpy.data.actions[action_name]
    meshes = [
        obj
        for obj in bpy.data.collections["LOD0"].all_objects
        if obj.type == "MESH" and obj.name.startswith("farmer_")
    ]
    for frame in frames:
        scene.frame_set(frame)
        depsgraph = bpy.context.evaluated_depsgraph_get()
        lowest = math.inf
        for obj in meshes:
            evaluated = obj.evaluated_get(depsgraph)
            evaluated_mesh = evaluated.to_mesh()
            try:
                if evaluated_mesh.vertices:
                    lowest = min(
                        lowest,
                        min((evaluated.matrix_world @ vertex.co).z for vertex in evaluated_mesh.vertices),
                    )
            finally:
                evaluated.to_mesh_clear()
        if not math.isfinite(lowest):
            raise RuntimeError(f"cannot ground {action_name} frame {frame}: no evaluated vertices")
        root = rig.pose.bones["root"]
        # A pose-bone's local Y axis follows the root bone, so it is world Z
        # here.  Keying local Z merely shifts the character sideways after
        # glTF axis conversion and was the round-1 source of airborne poses.
        root.location.y -= lowest
        root.keyframe_insert(data_path="location", index=1, frame=frame, group="root")
        scene.frame_set(frame)


def bake_two_hand_ik(
    rig: Any,
    action_name: str,
    frame: int,
    targets: dict[str, tuple[float, float, float]],
) -> None:
    """Bake evaluated two-bone contacts into the authored action."""
    reset_pose(rig)
    rig.animation_data.action = bpy.data.actions[action_name]
    bpy.context.scene.frame_set(frame)
    temporary: list[Any] = []
    constrained: list[Any] = []
    for suffix, target_location in targets.items():
        target = bpy.data.objects.new(f"_BAKE_IK_{action_name}_{suffix}", None)
        bpy.context.scene.collection.objects.link(target)
        target.location = target_location
        constraint = rig.pose.bones[f"lower_arm_{suffix}"].constraints.new("IK")
        constraint.target = target
        constraint.chain_count = 2
        constraint.use_rotation = False
        temporary.append(target)
        constrained.append(constraint)
    bpy.context.view_layer.update()
    matrices = {
        bone_name: rig.pose.bones[bone_name].matrix.copy()
        for suffix in targets
        for bone_name in (f"upper_arm_{suffix}", f"lower_arm_{suffix}")
    }
    for suffix in targets:
        pose = rig.pose.bones[f"lower_arm_{suffix}"]
        for constraint in list(pose.constraints):
            if constraint.name == "IK":
                pose.constraints.remove(constraint)
    for target in temporary:
        bpy.data.objects.remove(target, do_unlink=True)
    for bone_name, matrix in matrices.items():
        pose = rig.pose.bones[bone_name]
        pose.matrix = matrix
        pose.rotation_mode = "XYZ"
        pose.keyframe_insert(data_path="rotation_euler", frame=frame, group=bone_name)


def bake_two_leg_ik(
    rig: Any,
    action_name: str,
    frame: int,
    targets: dict[str, tuple[float, float, float]],
) -> None:
    """Bake seated foot support against actual footboard geometry."""
    reset_pose(rig)
    rig.animation_data.action = bpy.data.actions[action_name]
    bpy.context.scene.frame_set(frame)
    temporary: list[Any] = []
    for suffix, target_location in targets.items():
        target = bpy.data.objects.new(f"_BAKE_LEG_IK_{action_name}_{suffix}", None)
        bpy.context.scene.collection.objects.link(target)
        target.location = target_location
        constraint = rig.pose.bones[f"calf_{suffix}"].constraints.new("IK")
        constraint.target = target
        constraint.chain_count = 2
        constraint.use_rotation = False
        temporary.append(target)
    bpy.context.view_layer.update()
    matrices = {
        bone_name: rig.pose.bones[bone_name].matrix.copy()
        for suffix in targets
        for bone_name in (f"thigh_{suffix}", f"calf_{suffix}")
    }
    for suffix in targets:
        pose = rig.pose.bones[f"calf_{suffix}"]
        for constraint in list(pose.constraints):
            if constraint.name == "IK":
                pose.constraints.remove(constraint)
    for target in temporary:
        bpy.data.objects.remove(target, do_unlink=True)
    for bone_name, matrix in matrices.items():
        pose = rig.pose.bones[bone_name]
        pose.matrix = matrix
        pose.rotation_mode = "XYZ"
        pose.keyframe_insert(data_path="rotation_euler", frame=frame, group=bone_name)


def bake_flat_feet(rig: Any, action_name: str, frame: int, sides: tuple[str, ...] = ("l", "r")) -> None:
    """Counter-rotate feet to the authored flat shoe-last orientation."""
    reset_pose(rig)
    rig.animation_data.action = bpy.data.actions[action_name]
    bpy.context.scene.frame_set(frame)
    for suffix in sides:
        name = f"foot_{suffix}"
        pose = rig.pose.bones[name]
        head = pose.head.copy()
        rest_orientation = rig.data.bones[name].matrix_local.to_3x3().to_4x4()
        pose.matrix = Matrix.Translation(head) @ rest_orientation
        pose.rotation_mode = "XYZ"
        pose.keyframe_insert(data_path="rotation_euler", frame=frame, group=name)


def author_animations(rig: Any, interaction_fixtures: dict[str, Vector]) -> None:
    bpy.context.scene.render.fps = 30
    for name, (frames, loop) in CLIPS.items():
        action = bpy.data.actions.new(name)
        action.use_fake_user = True
        action["clip_frames"] = frames
        action["loop"] = loop
        action["events_json"] = json.dumps(EVENTS.get(name, []), separators=(",", ":"), sort_keys=True)
        if rig.animation_data is None:
            rig.animation_data_create()
        rig.animation_data.action = action
        reset_pose(rig)
        keys: list[tuple[int, dict[str, tuple[float, float, float]]]] = []
        if name == "idle":
            keys = [(1, {}), (30, {"spine_02": (0.02, 0, -0.015), "head": (-0.01, 0.02, 0)}), (60, {"spine_01": (-0.015, 0, 0.018), "head": (0.012, -0.02, 0)}), (90, {})]
        elif name == "walk":
            keys = [
                (1, {"__root_location": (0, -0.060, 0), "pelvis": (0.015, 0, -0.025), "spine_01": (-0.025, 0, 0.025), "thigh_l": (0.36, 0, 0), "calf_l": (-0.22, 0, 0), "foot_l": (0.14, 0, 0), "thigh_r": (-0.30, 0, 0), "calf_r": (-0.18, 0, 0), "foot_r": (-0.22, 0, 0), "upper_arm_l": (-0.58, 0.04, 0.15), "lower_arm_l": (-0.18, 0, 0), "upper_arm_r": (-0.78, -0.04, -0.15), "lower_arm_r": (-0.28, 0, 0)}),
                (8, {"__root_location": (0, -0.010, 0), "pelvis": (-0.025, 0, 0.018), "spine_01": (0.030, 0, -0.020), "thigh_l": (0.08, 0, 0), "calf_l": (-0.40, 0, 0), "foot_l": (-0.02, 0, 0), "thigh_r": (0.02, 0, 0), "calf_r": (-0.55, 0, 0), "foot_r": (-0.18, 0, 0), "upper_arm_l": (-0.64, 0.02, 0.08), "upper_arm_r": (-0.72, -0.02, -0.08)}),
                (16, {"__root_location": (0, -0.060, 0), "pelvis": (0.015, 0, 0.025), "spine_01": (-0.025, 0, -0.025), "thigh_l": (-0.30, 0, 0), "calf_l": (-0.18, 0, 0), "foot_l": (-0.22, 0, 0), "thigh_r": (0.36, 0, 0), "calf_r": (-0.22, 0, 0), "foot_r": (0.14, 0, 0), "upper_arm_l": (-0.78, 0.04, -0.15), "lower_arm_l": (-0.28, 0, 0), "upper_arm_r": (-0.58, -0.04, 0.15), "lower_arm_r": (-0.18, 0, 0)}),
                (23, {"__root_location": (0, -0.010, 0), "pelvis": (-0.025, 0, -0.018), "spine_01": (0.030, 0, 0.020), "thigh_l": (0.02, 0, 0), "calf_l": (-0.55, 0, 0), "foot_l": (-0.18, 0, 0), "thigh_r": (0.08, 0, 0), "calf_r": (-0.40, 0, 0), "foot_r": (-0.02, 0, 0), "upper_arm_l": (-0.72, 0.02, -0.08), "upper_arm_r": (-0.64, -0.02, 0.08)}),
                (30, {"__root_location": (0, -0.060, 0), "pelvis": (0.015, 0, -0.025), "spine_01": (-0.025, 0, 0.025), "thigh_l": (0.36, 0, 0), "calf_l": (-0.22, 0, 0), "foot_l": (0.14, 0, 0), "thigh_r": (-0.30, 0, 0), "calf_r": (-0.18, 0, 0), "foot_r": (-0.22, 0, 0), "upper_arm_l": (-0.58, 0.04, 0.15), "upper_arm_r": (-0.78, -0.04, -0.15)}),
            ]
        elif name == "enter_vehicle":
            keys = [
                (1, {"__root_location": (-0.55, 0.0, 0.34), "head": (0.04, 0, -0.22)}),
                (18, {"__root_location": (-0.42, 0.0, 0.31), "upper_arm_l": (-0.55, 0.15, -0.40), "head": (0.08, 0, -0.28)}),
                (38, {"__root_location": (-0.24, 0.02, 0.27), "thigh_l": (1.05, 0, 0.28), "calf_l": (-1.30, 0, 0), "spine_01": (0.16, 0, -0.15)}),
                (58, {"__root_location": (-0.08, -0.07, 0.22), "thigh_l": (1.18, 0, 0), "thigh_r": (0.72, 0, 0), "calf_l": (-1.42, 0, 0), "upper_arm_l": (-0.92, 0.2, -0.28)}),
                (75, {"__root_location": (0.0, -0.14, 0.19), "thigh_l": (1.18, 0, 0), "thigh_r": (1.18, 0, 0), "calf_l": (-1.38, 0, 0), "calf_r": (-1.38, 0, 0), "upper_arm_l": (-0.82, 0.18, -0.38), "upper_arm_r": (-0.82, -0.18, 0.38)}),
            ]
        elif name == "exit_vehicle":
            keys = [
                (1, {"__root_location": (0.0, -0.14, 0.19), "thigh_l": (1.18, 0, 0), "thigh_r": (1.18, 0, 0), "calf_l": (-1.38, 0, 0), "calf_r": (-1.38, 0, 0)}),
                (16, {"__root_location": (-0.10, -0.07, 0.22), "head": (0.02, 0, 0.30), "upper_arm_r": (-0.55, -0.18, 0.52)}),
                (34, {"__root_location": (-0.28, 0.03, 0.27), "thigh_r": (1.12, 0, -0.25), "calf_r": (-1.25, 0, 0), "spine_01": (0.20, 0, 0.18)}),
                (52, {"__root_location": (-0.44, 0.0, 0.32), "thigh_l": (0.25, 0, 0), "thigh_r": (-0.35, 0, 0), "upper_arm_r": (-0.38, -0.12, 0.45)}),
                (70, {"__root_location": (-0.55, 0.0, 0.34), "head": (0, 0, 0.12)}),
            ]
        elif name == "drive":
            seated = {"__root_location": (0.0, -0.14, 0.19), "thigh_l": (1.18, 0, 0), "thigh_r": (1.18, 0, 0), "calf_l": (-1.38, 0, 0), "calf_r": (-1.38, 0, 0), "upper_arm_l": (-0.82, 0.18, -0.38), "upper_arm_r": (-0.82, -0.18, 0.38), "lower_arm_l": (-0.48, 0, 0), "lower_arm_r": (-0.48, 0, 0)}
            scan = dict(seated, head=(0, 0, -0.24))
            keys = [(1, seated), (30, scan), (60, seated)]
        elif name.startswith("pick_"):
            bend = {"pick_low": (0.68, 0.28), "pick_mid": (0.12, 0.0), "pick_high": (-0.35, -0.22)}[name]
            spine, knee = bend
            reach = -1.05 if name != "pick_high" else -2.15
            arm_roll = -0.18 if name != "pick_high" else -0.45
            keys = [(1, {}), (int(frames * 0.34), {"spine_01": (spine, 0, 0), "thigh_l": (knee, 0, 0), "thigh_r": (knee * 0.55, 0, 0), "calf_l": (-knee * 0.8, 0, 0), "upper_arm_l": (reach, 0.05, arm_roll), "lower_arm_l": (-0.55, 0, 0)}), (round(frames * 0.58), {"spine_01": (spine, 0, 0), "thigh_l": (knee, 0, 0), "thigh_r": (knee * 0.55, 0, 0), "calf_l": (-knee * 0.8, 0, 0), "upper_arm_l": (reach, 0.08, arm_roll), "lower_arm_l": (-0.30 if name == "pick_high" else -0.82, 0, 0), "hand_l": (0.18, 0.2, 0.25)}), (frames, {})]
        elif name == "carry_crate":
            pose_a = {"upper_arm_l": (-0.72, 0.18, -0.45), "upper_arm_r": (-0.72, -0.18, 0.45), "lower_arm_l": (-1.05, 0, 0), "lower_arm_r": (-1.05, 0, 0), "thigh_l": (0.18, 0, 0), "thigh_r": (-0.16, 0, 0)}
            pose_b = dict(pose_a, thigh_l=(-0.16, 0, 0), thigh_r=(0.18, 0, 0))
            keys = [(1, pose_a), (20, pose_b), (40, pose_a)]
        elif name == "lift_crate":
            keys = [
                (1, {"__root_location": (0, 0.035, 0), "pelvis": (0.18, 0, 0), "spine_01": (0.30, 0, 0), "spine_02": (-0.08, 0, 0), "thigh_l": (0.68, 0, 0.08), "thigh_r": (0.54, 0, -0.08), "calf_l": (-1.02, 0, 0), "calf_r": (-0.88, 0, 0), "foot_l": (0.08, 0, 0), "foot_r": (0.04, 0, 0), "upper_arm_l": (-1.02, 0.2, -0.4), "upper_arm_r": (-1.02, -0.2, 0.4), "lower_arm_l": (-0.72, 0, 0), "lower_arm_r": (-0.72, 0, 0)}),
                (22, {"__root_location": (0, 0.025, 0), "pelvis": (0.16, 0, 0), "spine_01": (0.26, 0, 0), "spine_02": (-0.07, 0, 0), "thigh_l": (0.62, 0, 0.08), "thigh_r": (0.50, 0, -0.08), "calf_l": (-0.98, 0, 0), "calf_r": (-0.84, 0, 0), "upper_arm_l": (-1.12, 0.2, -0.42), "upper_arm_r": (-1.12, -0.2, 0.42), "lower_arm_l": (-0.8, 0, 0), "lower_arm_r": (-0.8, 0, 0)}),
                (48, {"__root_location": (0, 0.010, 0), "pelvis": (0.07, 0, 0), "spine_01": (0.10, 0, 0), "spine_02": (-0.03, 0, 0), "thigh_l": (0.28, 0, 0.06), "thigh_r": (0.22, 0, -0.06), "calf_l": (-0.46, 0, 0), "calf_r": (-0.38, 0, 0), "upper_arm_l": (-0.74, 0.18, -0.42), "upper_arm_r": (-0.74, -0.18, 0.42), "lower_arm_l": (-1.05, 0, 0), "lower_arm_r": (-1.05, 0, 0)}),
                (70, {"pelvis": (0.02, 0, 0), "spine_01": (0.03, 0, 0), "thigh_l": (0.12, 0, 0.05), "thigh_r": (0.08, 0, -0.05), "calf_l": (-0.20, 0, 0), "calf_r": (-0.16, 0, 0), "upper_arm_l": (-0.72, 0.18, -0.45), "upper_arm_r": (-0.72, -0.18, 0.45), "lower_arm_l": (-1.05, 0, 0), "lower_arm_r": (-1.05, 0, 0)}),
            ]
        elif name == "load_crate":
            carry = {"upper_arm_l": (-0.72, 0.18, -0.45), "upper_arm_r": (-0.72, -0.18, 0.45), "lower_arm_l": (-1.05, 0, 0), "lower_arm_r": (-1.05, 0, 0)}
            place = {"spine_01": (0.16, 0, 0), "upper_arm_l": (-1.05, 0.10, -0.34), "upper_arm_r": (-1.05, -0.10, 0.34), "lower_arm_l": (-0.48, 0, 0), "lower_arm_r": (-0.48, 0, 0)}
            release = dict(place, hand_l=(0, 0, -0.45), hand_r=(0, 0, 0.45))
            keys = [(1, carry), (30, place), (round(frames * 0.76), release), (65, {})]
        for frame, values in keys:
            reset_pose(rig)
            set_pose_values(rig, values, frame)
        for fcurve in action.fcurves:
            for point in fcurve.keyframe_points:
                point.interpolation = "BEZIER"
        action.frame_start = 1
        action.frame_end = frames
    for clip, frames in {
        "idle": (1, 30, 60, 90),
        "walk": (1, 8, 16, 23, 30),
        "pick_low": (1, 20, 35, 60),
        "pick_mid": (1, 17, 29, 50),
        "pick_high": (1, 22, 38, 65),
        "carry_crate": (1, 20, 40),
        "lift_crate": (1, 22, 48, 70),
        "load_crate": (1, 30, 49, 65),
    }.items():
        ground_action_frames(rig, clip, frames)
    # Explicit ankle targets give the in-place gameplay cycle true planted
    # intervals: heel strike/load share one support point, followed by
    # mid-stance/toe-off and a flexed recovery swing on the opposite side.
    walk_targets = {
        1: {"l": (-0.105, 0.22, 0.10), "r": (0.105, -0.31, 0.25)},
        8: {"l": (-0.105, 0.22, 0.10), "r": (0.105, -0.05, 0.28)},
        16: {"l": (-0.105, -0.31, 0.25), "r": (0.105, 0.22, 0.10)},
        23: {"l": (-0.105, -0.05, 0.28), "r": (0.105, 0.22, 0.10)},
        30: {"l": (-0.105, 0.22, 0.10), "r": (0.105, -0.31, 0.25)},
    }
    for frame, targets in walk_targets.items():
        bake_two_leg_ik(rig, "walk", frame, targets)
        bake_flat_feet(rig, "walk", frame)
    lift_targets = {
        1: {"l": (-0.11, 0.18, 0.10), "r": (0.11, -0.10, 0.10)},
        22: {"l": (-0.11, 0.18, 0.10), "r": (0.11, -0.10, 0.10)},
        48: {"l": (-0.11, 0.12, 0.10), "r": (0.11, -0.08, 0.10)},
        70: {"l": (-0.10, 0.08, 0.10), "r": (0.10, -0.06, 0.10)},
    }
    for frame, targets in lift_targets.items():
        bake_two_leg_ik(rig, "lift_crate", frame, targets)
        bake_flat_feet(rig, "lift_crate", frame)
    # Contact mechanics are solved against real authored target locations and
    # baked into the actions; no runtime IK dependency enters the GLB.
    bake_two_hand_ik(rig, "pick_low", 35, {"l": tuple(interaction_fixtures["pickLow"])})
    bake_two_hand_ik(rig, "pick_mid", 29, {"l": tuple(interaction_fixtures["pickMid"])})
    bake_two_hand_ik(rig, "pick_high", 38, {"l": tuple(interaction_fixtures["pickHigh"])})
    for clip, frame, height in (
        ("carry_crate", 1, 0.86),
        ("carry_crate", 20, 0.86),
        ("carry_crate", 40, 0.86),
        ("lift_crate", 22, 0.60),
        ("lift_crate", 48, 0.86),
        ("load_crate", 30, 0.96),
        ("load_crate", 49, 0.96),
    ):
        target_height = interaction_fixtures["crateLeft"].z if clip == "carry_crate" else height
        offset = Vector((0.0, 0.0, target_height - interaction_fixtures["crateLeft"].z))
        solver_compensation = Vector((0.0, -0.07, -0.10)) if clip == "carry_crate" else Vector()
        bake_two_hand_ik(
            rig,
            clip,
            frame,
            {
                "l": tuple(interaction_fixtures["crateLeft"] + offset + solver_compensation),
                "r": tuple(interaction_fixtures["crateRight"] + offset + solver_compensation),
            },
        )
    vehicle = measure_vehicle_fixture(TRICYCLE_BLEND)
    # The load action now follows the actual cargo_slot_01 geometry. The crate
    # approaches raised above the front wall, settles with its 0.145 m half
    # height on the measured bed surface, releases, then the hands withdraw.
    slot = vehicle["cargoSlot"]
    crate_center_release = Vector((slot.x, slot.y, vehicle["cargoBed"].z + 0.185))
    crate_center_approach = crate_center_release + Vector((0.10, -0.80, 0.38))
    for frame, center in ((30, crate_center_approach), (49, crate_center_release)):
        bake_two_hand_ik(
            rig,
            "load_crate",
            frame,
            {
                "l": tuple(center + Vector((-0.238, 0.0, 0.061))),
                "r": tuple(center + Vector((0.238, 0.0, 0.061))),
            },
        )
    grips = {"l": tuple(vehicle["gripLeft"]), "r": tuple(vehicle["gripRight"])}
    footboards = {
        "l": tuple(vehicle["footboardLeft"] + Vector((0.0, 0.0, 0.025))),
        "r": tuple(vehicle["footboardRight"] + Vector((0.0, 0.0, 0.025))),
    }
    for clip, frame in (("drive", 1), ("drive", 30), ("drive", 60), ("enter_vehicle", 75), ("exit_vehicle", 1)):
        bake_two_hand_ik(rig, clip, frame, grips)
        bake_two_leg_ik(rig, clip, frame, footboards)
    neutral_hands = {"l": (-0.285, -0.045, 0.84), "r": (0.285, -0.045, 0.84)}
    for frame in (1, 30, 60, 90):
        bake_two_hand_ik(rig, "idle", frame, neutral_hands)
    rig.animation_data.action = bpy.data.actions["idle"]
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 90
    bpy.context.scene.frame_set(1)


def build() -> None:
    reset_scene()
    materials = create_materials()
    meshes = build_body(materials)
    rig = create_rig()
    skin_meshes(meshes, rig)
    create_interfaces(rig)
    interaction_fixtures = create_authoring_fixtures()
    author_animations(rig, interaction_fixtures)
    scene = bpy.context.scene
    scene["asset_id"] = "character.farmer-a"
    scene["creation_route"] = "original-Blender-Python-custom-topology"
    scene["concept_reference"] = "generated/farmer-a-concept-v1.png; reference-only; no pixels reused"
    scene["authoring_forward"] = "-Y"
    scene["collision_policy"] = "runtime capsule; source COLLISION intentionally empty"
    BLEND_PATH.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH), compress=True)


def look_at(obj: Any, target: tuple[float, float, float]) -> None:
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def setup_review_scene() -> tuple[Any, list[Any]]:
    review = bpy.data.collections.new("REVIEW_ONLY")
    bpy.context.scene.collection.children.link(review)
    camera = bpy.data.objects.new("ReviewCamera", bpy.data.cameras.new("ReviewCameraData"))
    review.objects.link(camera)
    bpy.context.scene.camera = camera
    camera.data.lens = 50
    camera.data.sensor_width = 40
    lights: list[Any] = []
    for name, location, energy, color, size in (
        ("Key6500K", (-3, -4, 4.5), 950, (0.82, 0.90, 1.0), 3.0),
        ("Fill", (3, 1, 3), 550, (1.0, 0.82, 0.65), 4.0),
    ):
        light = bpy.data.objects.new(name, bpy.data.lights.new(f"{name}Data", "AREA"))
        review.objects.link(light)
        light.location = location
        light.data.energy = energy
        light.data.color = color
        light.data.shape = "DISK"
        light.data.size = size
        look_at(light, (0, 0, 0.9))
        lights.append(light)
    world = bpy.data.worlds.new("ReviewWorld")
    bpy.context.scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.055, 0.055, 0.055, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.65
    bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, -0.005))
    ground = bpy.context.object
    ground.name = "review_only_ground"
    for collection in list(ground.users_collection):
        collection.objects.unlink(ground)
    review.objects.link(ground)
    material = bpy.data.materials.new("review_only_18pct_grey")
    material.diffuse_color = (0.18, 0.18, 0.18, 1)
    ground.data.materials.append(material)
    scene = bpy.context.scene
    scene.render.resolution_x = 640
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.image_settings.color_mode = "RGBA"
    return camera, lights


def set_action(name: str, frame: int) -> None:
    rig = bpy.data.objects["farmer_rig"]
    reset_pose(rig)
    rig.animation_data.action = bpy.data.actions[name]
    bpy.context.scene.frame_set(frame)


def set_rest_pose() -> None:
    rig = bpy.data.objects["farmer_rig"]
    rig.animation_data.action = None
    reset_pose(rig)
    bpy.context.scene.frame_set(1)


def render_view(camera: Any, name: str, location: tuple[float, float, float], target=(0, 0, 0.9), ortho=False, ortho_scale=2.05) -> None:
    camera.location = location
    camera.data.type = "ORTHO" if ortho else "PERSP"
    camera.data.ortho_scale = ortho_scale
    look_at(camera, target)
    path = REVIEW_DIR / name
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def add_review_label(camera: Any, body: str, location: tuple[float, float, float], size: float = 0.055) -> Any:
    """Create a camera-facing cyan evidence label inside REVIEW_ONLY."""
    material = bpy.data.materials.get("review_only_evidence_label_cyan")
    if material is None:
        material = bpy.data.materials.new("review_only_evidence_label_cyan")
        material.diffuse_color = (0.02, 0.85, 1.0, 1.0)
        material.use_nodes = True
        shader = material.node_tree.nodes["Principled BSDF"]
        shader.inputs["Base Color"].default_value = (0.02, 0.85, 1.0, 1.0)
        shader.inputs["Emission Color"].default_value = (0.02, 0.45, 0.65, 1.0)
        shader.inputs["Emission Strength"].default_value = 0.35
    data = bpy.data.curves.new(f"review_evidence_label_{body}", "FONT")
    data.body = body
    data.size = size
    data.extrude = 0.0008
    data.align_x = "CENTER"
    label = bpy.data.objects.new(f"review_evidence_label_{body}", data)
    label.location = location
    label.rotation_euler = (camera.location - label.location).to_track_quat("Z", "Y").to_euler()
    bpy.data.collections["REVIEW_ONLY"].objects.link(label)
    label.data.materials.append(material)
    return label


def add_walk_contact_markers() -> list[Any]:
    """Mark the currently loaded supporting foot directly on the ground."""
    rig = bpy.data.objects["farmer_rig"]
    positions = [rig.matrix_world @ rig.pose.bones[name].head for name in ("foot_l", "foot_r")]
    minimum = min(position.z for position in positions)
    material = bpy.data.materials.get("review_only_contact_cyan")
    if material is None:
        material = bpy.data.materials.new("review_only_contact_cyan")
        material.diffuse_color = (0.02, 0.85, 1.0, 1.0)
        material.use_nodes = True
        material.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.02, 0.85, 1.0, 1.0)
    markers: list[Any] = []
    for position in positions:
        if position.z > minimum + 0.045:
            continue
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.065, depth=0.006, location=(position.x, position.y, 0.003))
        marker = bpy.context.object
        marker.name = "review_walk_ground_contact"
        for owner in list(marker.users_collection):
            owner.objects.unlink(marker)
        bpy.data.collections["REVIEW_ONLY"].objects.link(marker)
        marker.data.materials.append(material)
        markers.append(marker)
    return markers


def compose_strip(source_paths: list[Path], destination: Path) -> None:
    """Compose equally sized Blender renders into one reproducible proof strip."""
    arrays: list[Any] = []
    loaded: list[Any] = []
    for path in source_paths:
        image = bpy.data.images.load(str(path), check_existing=False)
        loaded.append(image)
        arrays.append(np.asarray(image.pixels[:], dtype=np.float32).reshape(image.size[1], image.size[0], 4))
    strip = np.concatenate(arrays, axis=1)
    output = bpy.data.images.new(
        destination.stem,
        width=strip.shape[1],
        height=strip.shape[0],
        alpha=True,
        float_buffer=False,
    )
    output.pixels.foreach_set(strip.ravel())
    output.file_format = "PNG"
    output.filepath_raw = str(destination)
    output.save()
    bpy.data.images.remove(output)
    for image in loaded:
        bpy.data.images.remove(image)
    for path in source_paths:
        path.unlink(missing_ok=True)


def compose_grid(source_paths: list[Path], destination: Path, columns: int) -> None:
    """Compose equal review panels into a deterministic multi-row sheet."""
    arrays: list[Any] = []
    loaded: list[Any] = []
    for path in source_paths:
        image = bpy.data.images.load(str(path), check_existing=False)
        loaded.append(image)
        arrays.append(np.asarray(image.pixels[:], dtype=np.float32).reshape(image.size[1], image.size[0], 4))
    rows = [np.concatenate(arrays[index:index + columns], axis=1) for index in range(0, len(arrays), columns)]
    grid = np.concatenate(rows, axis=0)
    output = bpy.data.images.new(destination.stem, width=grid.shape[1], height=grid.shape[0], alpha=True)
    output.pixels.foreach_set(grid.ravel())
    output.file_format = "PNG"
    output.filepath_raw = str(destination)
    output.save()
    bpy.data.images.remove(output)
    for image in loaded:
        bpy.data.images.remove(image)
    for path in source_paths:
        path.unlink(missing_ok=True)


def render_action_strip(
    camera: Any,
    action_name: str,
    frames: tuple[int, ...],
    destination: str,
    location: tuple[float, float, float],
    target: tuple[float, float, float],
    labels: tuple[str, ...] | None = None,
) -> None:
    scene = bpy.context.scene
    previous_resolution = (scene.render.resolution_x, scene.render.resolution_y)
    scene.render.resolution_x = 420
    scene.render.resolution_y = 420
    sources: list[Path] = []
    for index, frame in enumerate(frames):
        set_action(action_name, frame)
        camera.location = location
        look_at(camera, target)
        label = None
        if labels:
            label = add_review_label(camera, labels[index], (-0.36, -0.18, 1.76), 0.050)
        markers = add_walk_contact_markers() if action_name == "walk" else []
        temporary_name = f".tmp-{destination}-{index}.png"
        render_view(camera, temporary_name, location, target, False)
        sources.append(REVIEW_DIR / temporary_name)
        if label is not None:
            bpy.data.objects.remove(label, do_unlink=True)
        for marker in markers:
            bpy.data.objects.remove(marker, do_unlink=True)
    compose_strip(sources, REVIEW_DIR / destination)
    scene.render.resolution_x, scene.render.resolution_y = previous_resolution


def add_review_crate(review: Any) -> list[Any]:
    objects = []
    material = bpy.data.materials.new("review_only_crate_green")
    material.diffuse_color = (0.08, 0.28, 0.13, 1)
    parts = [
        (0, 0, 0.012, 0.50, 0.35, 0.024),
        (0, 0, 0.275, 0.50, 0.35, 0.025),
    ]
    for x in (-0.238, 0.238):
        for y in (-0.155, 0.155):
            parts.append((x, y, 0.14, 0.024, 0.024, 0.28))
        # Integral handhold bars on the short sides, with open space beneath.
        parts.append((x, 0, 0.205, 0.026, 0.19, 0.028))
        for y in (-0.13, 0.13):
            parts.append((x, y, 0.105, 0.024, 0.055, 0.17))
    for y in (-0.163, 0.163):
        for x in (-0.18, -0.06, 0.06, 0.18):
            parts.append((x, y, 0.14, 0.025, 0.024, 0.22))
        for z in (0.055, 0.13, 0.205):
            parts.append((0, y, z, 0.45, 0.022, 0.022))
    for index, (x, y, z, sx, sy, sz) in enumerate(parts):
        bpy.ops.mesh.primitive_cube_add(location=(x, y - 0.40, z + 0.56))
        obj = bpy.context.object
        obj.scale = (sx / 2, sy / 2, sz / 2)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        for collection in list(obj.users_collection):
            collection.objects.unlink(obj)
        review.objects.link(obj)
        obj.name = f"review_crate_part_{index:02d}"
        if abs(y) < 1e-5 and abs(z - 0.205) < 1e-5 and abs(abs(x) - 0.238) < 1e-5:
            obj.name = "fixture_crate_handhold_left" if x < 0 else "fixture_crate_handhold_right"
        obj.data.materials.append(material)
        objects.append(obj)
    return objects


def add_review_fruit_targets(review: Any) -> dict[str, list[Any]]:
    material = bpy.data.materials.new("review_only_peach")
    material.diffuse_color = (0.90, 0.24, 0.20, 1.0)
    targets: dict[str, list[Any]] = {}
    for name, location in (
        ("pick_low", (-0.57, -0.345, 0.85)),
        ("pick_mid", (-0.70, -0.40, 1.20)),
        ("pick_high", (-0.55, -0.32, 1.67)),
    ):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=0.07, location=location)
        fruit = bpy.context.object
        fruit.name = f"review_fruit_{name}"
        for collection in list(fruit.users_collection):
            collection.objects.unlink(fruit)
        review.objects.link(fruit)
        fruit.data.materials.append(material)
        fruit.hide_render = True
        targets[name] = [fruit]
    return targets


def create_authoring_fixtures() -> dict[str, Vector]:
    """Persist non-exported interaction geometry as the animation authority."""
    collection = bpy.data.collections.new("AUTHORING_FIXTURES")
    bpy.context.scene.collection.children.link(collection)
    crate = add_review_crate(collection)
    fruits = add_review_fruit_targets(collection)
    bpy.ops.mesh.primitive_plane_add(size=4.0, location=(0.0, 0.0, 0.0))
    ground = bpy.context.object
    ground.name = "fixture_ground_plane"
    for owner in list(ground.users_collection):
        owner.objects.unlink(ground)
    collection.objects.link(ground)
    semantic_objects = {
        "crateLeft": next(obj for obj in crate if obj.name == "fixture_crate_handhold_left"),
        "crateRight": next(obj for obj in crate if obj.name == "fixture_crate_handhold_right"),
        "pickLow": fruits["pick_low"][0],
        "pickMid": fruits["pick_mid"][0],
        "pickHigh": fruits["pick_high"][0],
        "ground": ground,
    }
    # Authoring fixtures participate in source validation, so bake their world
    # placement into vertices and leave clean identity transforms.
    fixture_objects = list(collection.all_objects)
    for obj in fixture_objects:
        if obj.type != "MESH":
            continue
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    measured = measure_fixture_objects(semantic_objects)
    for obj in fixture_objects:
        obj.select_set(False)
        obj.hide_render = True
        obj.hide_viewport = True
        obj["authoring_fixture"] = True
    collection.hide_render = True
    collection.hide_viewport = True
    return measured


def create_bone_overlay(review: Any) -> list[Any]:
    rig = bpy.data.objects["farmer_rig"]
    material = bpy.data.materials.new("review_only_bone_yellow")
    material.diffuse_color = (1.0, 0.48, 0.02, 1.0)
    label_material = bpy.data.materials.new("review_only_bone_label_cyan")
    label_material.diffuse_color = (0.02, 0.85, 1.0, 1.0)
    label_material.use_nodes = True
    label_shader = label_material.node_tree.nodes["Principled BSDF"]
    label_shader.inputs["Base Color"].default_value = (0.02, 0.85, 1.0, 1.0)
    label_shader.inputs["Roughness"].default_value = 0.35
    overlays: list[Any] = []
    for bone in rig.data.bones:
        if bone.name not in {
            "root", "pelvis", "spine_01", "spine_02", "neck", "head",
            "clavicle_l", "upper_arm_l", "lower_arm_l", "hand_l",
            "clavicle_r", "upper_arm_r", "lower_arm_r", "hand_r",
            "thigh_l", "calf_l", "foot_l", "thigh_r", "calf_r", "foot_r",
        }:
            continue
        # Pull the diagnostic skeleton toward the review camera so it remains
        # visible as an overlay while preserving projected joint alignment.
        head = Vector(bone.head_local) + Vector((0, -0.13, 0))
        tail = Vector(bone.tail_local) + Vector((0, -0.13, 0))
        midpoint = (head + tail) * 0.5
        length = (tail - head).length
        bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.012, depth=length, location=midpoint)
        obj = bpy.context.object
        obj.name = f"review_bone_{bone.name}"
        obj.rotation_euler = (tail - head).to_track_quat("Z", "Y").to_euler()
        for collection in list(obj.users_collection):
            collection.objects.unlink(obj)
        review.objects.link(obj)
        obj.data.materials.append(material)
        obj.hide_render = True
        overlays.append(obj)
        text_data = bpy.data.curves.new(f"review_label_data_{bone.name}", "FONT")
        text_data.body = bone.name
        text_data.size = 0.032
        text_data.extrude = 0.0005
        text_data.align_x = "LEFT"
        label = bpy.data.objects.new(f"review_label_{bone.name}", text_data)
        label.location = midpoint + Vector((0.018 if midpoint.x >= 0 else -0.14, -0.025, 0.012))
        label.rotation_euler = (math.pi / 2, 0, 0)
        review.objects.link(label)
        label.data.materials.append(label_material)
        label.hide_render = True
        overlays.append(label)
    return overlays


def create_review_materials(meshes: list[Any]) -> tuple[dict[str, Any], Any, Any]:
    id_colors = {
        M_SKIN: (0.95, 0.20, 0.12, 1),
        M_HAIR: (0.10, 0.30, 0.95, 1),
        M_CLOTH: (0.12, 0.85, 0.25, 1),
        M_GEAR: (0.95, 0.75, 0.08, 1),
    }
    id_materials: dict[str, Any] = {}
    for name, color in id_colors.items():
        material = bpy.data.materials.new(f"review_id_{name}")
        material.diffuse_color = color
        material.use_nodes = True
        shader = material.node_tree.nodes["Principled BSDF"]
        shader.inputs["Base Color"].default_value = color
        shader.inputs["Roughness"].default_value = 0.65
        id_materials[name] = material

    weight = bpy.data.materials.new("review_weight_heatmap")
    weight.use_nodes = True
    vertex = weight.node_tree.nodes.new("ShaderNodeVertexColor")
    vertex.layer_name = "weight_review"
    shader = weight.node_tree.nodes["Principled BSDF"]
    weight.node_tree.links.new(vertex.outputs["Color"], shader.inputs["Base Color"])
    shader.inputs["Roughness"].default_value = 0.7
    for obj in meshes:
        attribute = obj.data.color_attributes.get("weight_review") or obj.data.color_attributes.new(
            name="weight_review", type="BYTE_COLOR", domain="CORNER"
        )
        group = obj.vertex_groups.get("upper_arm_l")
        weights_by_vertex: dict[int, float] = {}
        if group:
            for vertex_data in obj.data.vertices:
                weights_by_vertex[vertex_data.index] = next(
                    (
                        membership.weight
                        for membership in vertex_data.groups
                        if membership.group == group.index
                    ),
                    0.0,
                )
        for loop in obj.data.loops:
            value = weights_by_vertex.get(loop.vertex_index, 0.0)
            attribute.data[loop.index].color = (value, 0.05, 1.0 - value, 1.0)

    checker = bpy.data.materials.new("review_uv_checker")
    checker.use_nodes = True
    tree = checker.node_tree
    texcoord = tree.nodes.new("ShaderNodeTexCoord")
    mapping = tree.nodes.new("ShaderNodeMapping")
    checker_node = tree.nodes.new("ShaderNodeTexChecker")
    wire = tree.nodes.new("ShaderNodeWireframe")
    wire.inputs["Size"].default_value = 0.0005
    wire.use_pixel_size = False
    mix = tree.nodes.new("ShaderNodeMixRGB")
    mix.blend_type = "MIX"
    mix.inputs[2].default_value = (0.02, 0.22, 0.65, 1.0)
    checker_node.inputs["Color1"].default_value = (0.02, 0.02, 0.02, 1)
    checker_node.inputs["Color2"].default_value = (0.95, 0.95, 0.95, 1)
    checker_node.inputs["Scale"].default_value = 10.0
    shader = tree.nodes["Principled BSDF"]
    tree.links.new(texcoord.outputs["UV"], mapping.inputs["Vector"])
    tree.links.new(mapping.outputs["Vector"], checker_node.inputs["Vector"])
    tree.links.new(checker_node.outputs["Color"], mix.inputs[1])
    tree.links.new(wire.outputs["Fac"], mix.inputs[0])
    tree.links.new(mix.outputs["Color"], shader.inputs["Base Color"])
    shader.inputs["Roughness"].default_value = 0.75
    return id_materials, weight, checker


def swap_materials(meshes: list[Any], replacement: Any | dict[str, Any] | None, originals: dict[str, list[Any]]) -> None:
    for obj in meshes:
        if replacement is None:
            for index, material in enumerate(originals[obj.name]):
                obj.data.materials[index] = material
        elif isinstance(replacement, dict):
            for index, material in enumerate(originals[obj.name]):
                obj.data.materials[index] = replacement[material.name]
        else:
            for index in range(len(originals[obj.name])):
                obj.data.materials[index] = replacement


def append_tricycle(review: Any) -> list[Any]:
    if not TRICYCLE_BLEND.is_file():
        return []
    with bpy.data.libraries.load(str(TRICYCLE_BLEND), link=False) as (source, destination):
        destination.objects = [name for name in source.objects if name not in {"ReviewCamera"}]
    objects = []
    for obj in destination.objects:
        if obj is None or obj.type not in {"MESH", "EMPTY"}:
            continue
        review.objects.link(obj)
        objects.append(obj)
    return objects


def animation_audit() -> dict[str, Any]:
    result: dict[str, Any] = {}
    for name, (frames, loop) in CLIPS.items():
        action = bpy.data.actions[name]
        keyframes = sorted({round(point.co.x, 4) for curve in action.fcurves for point in curve.keyframe_points})
        values = [round(point.co.y, 5) for curve in action.fcurves for point in curve.keyframe_points]
        changed_bones = sorted({curve.data_path.split('pose.bones["', 1)[1].split('"', 1)[0] for curve in action.fcurves if 'pose.bones["' in curve.data_path and any(abs(point.co.y) > 1e-5 for point in curve.keyframe_points)})
        result[name] = {
            "frames": frames,
            "loop": loop,
            "keyedFrames": keyframes,
            "keyframePointCount": sum(len(curve.keyframe_points) for curve in action.fcurves),
            "changedBones": changed_bones,
            "valueRange": [min(values) if values else 0, max(values) if values else 0],
            "events": EVENTS.get(name, []),
        }
    return result


def source_geometry_audit() -> dict[str, Any]:
    meshes = [
        bpy.data.objects[name]
        for name in (
            "farmer_body_continuous",
            "farmer_layered_workwear",
            "farmer_workwear_details",
            "farmer_hat_gloves_shoes",
            "farmer_face_detail",
        )
    ]
    coordinates = [obj.matrix_world @ vertex.co for obj in meshes for vertex in obj.data.vertices]
    for obj in meshes:
        obj.data.calc_loop_triangles()
    rig = bpy.data.objects["farmer_rig"]
    return {
        "meshCount": len(meshes),
        "allMeshesSkinned": all(
            any(modifier.type == "ARMATURE" and modifier.object == rig for modifier in obj.modifiers)
            for obj in meshes
        ),
        "allMeshesHaveUV": all(bool(obj.data.uv_layers) for obj in meshes),
        "vertexCount": sum(len(obj.data.vertices) for obj in meshes),
        "sourceTriangleCount": sum(len(obj.data.loop_triangles) for obj in meshes),
        "maxInfluencesPerVertex": max(
            len([membership for membership in vertex.groups if membership.weight > 1e-6])
            for obj in meshes
            for vertex in obj.data.vertices
        ),
        "boundsM": {
            "min": [round(min(point[axis] for point in coordinates), 4) for axis in range(3)],
            "max": [round(max(point[axis] for point in coordinates), 4) for axis in range(3)],
        },
        "armature": {
            "object": rig.name,
            "boneCount": len(rig.data.bones),
            "scale": [round(value, 4) for value in rig.scale],
            "negativeScale": any(value < 0 for value in rig.scale),
            "rootHead": [round(value, 4) for value in rig.data.bones["root"].head_local],
        },
        "materialNames": sorted({material.name for obj in meshes for material in obj.data.materials}),
        "collisionObjectCount": len(bpy.data.collections["COLLISION"].all_objects),
        "socketNames": sorted(obj.name for obj in bpy.data.collections["SOCKETS"].all_objects),
    }


def render_reviews() -> None:
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    camera, lights = setup_review_scene()
    views = {
        "a-pose-front.png": ((0, -4.0, 1.02), True),
        "a-pose-left.png": ((-4.0, 0, 1.02), True),
        "a-pose-right.png": ((4.0, 0, 1.02), True),
        "a-pose-rear.png": ((0, 4.0, 1.02), True),
        "a-pose-top.png": ((0, 0, 4.2), True),
        "hero.png": ((0.82, -3.15, 1.62), False),
        "neutral-third-person.png": ((1.15, 4.6, 1.85), False),
    }
    for name, (location, ortho) in views.items():
        if name.startswith("a-pose-"):
            set_rest_pose()
        else:
            set_action("idle", 30)
        render_view(camera, name, location, ortho=ortho)

    hat = bpy.data.objects["farmer_hat_gloves_shoes"]
    hat.hide_render = True
    set_action("idle", 30)
    render_view(camera, "head-unhatted-front.png", (0, -0.68, 1.60), (0, 0, 1.59), False)
    set_action("idle", 30)
    render_view(camera, "head-unhatted-profile.png", (-0.68, 0, 1.60), (0, 0, 1.59), False)
    set_action("idle", 30)
    render_view(camera, "head-unhatted-three-quarter.png", (0.46, -0.54, 1.63), (0, 0, 1.59), False)
    hat.hide_render = False
    scene = bpy.context.scene
    old_resolution = (scene.render.resolution_x, scene.render.resolution_y)
    scene.render.resolution_x, scene.render.resolution_y = (420, 420)
    hand_detail_hidden = [
        bpy.data.objects["farmer_body_continuous"],
        bpy.data.objects["farmer_layered_workwear"],
        bpy.data.objects["farmer_workwear_details"],
        bpy.data.objects["farmer_face_detail"],
    ]
    for obj in hand_detail_hidden:
        obj.hide_render = True
    hand_sources: list[Path] = []
    for index, x in enumerate((-0.25, 0.25)):
        set_action("carry_crate", 1)
        temporary_name = f".tmp-hands-{index}.png"
        render_view(camera, temporary_name, (x, -1.05, 0.84), (x, -0.44, 0.79), False)
        hand_sources.append(REVIEW_DIR / temporary_name)
    compose_strip(hand_sources, REVIEW_DIR / "hands-closeup.png")
    for obj in hand_detail_hidden:
        obj.hide_render = False
    scene.render.resolution_x, scene.render.resolution_y = old_resolution
    set_action("idle", 1)
    render_view(camera, "clothing-layers.png", (1.8, -2.8, 1.5), (0, 0, 1.05), False)

    rig = bpy.data.objects["farmer_rig"]
    overlays = create_bone_overlay(bpy.data.collections["REVIEW_ONLY"])
    for obj in overlays:
        obj.hide_render = False
    formal_meshes = [
        bpy.data.objects[name]
        for name in (
            "farmer_body_continuous",
            "farmer_layered_workwear",
            "farmer_workwear_details",
            "farmer_hat_gloves_shoes",
            "farmer_face_detail",
        )
    ]
    set_rest_pose()
    previous_resolution = (bpy.context.scene.render.resolution_x, bpy.context.scene.render.resolution_y)
    bpy.context.scene.render.resolution_x = 960
    bpy.context.scene.render.resolution_y = 1080
    render_view(camera, "rig-bone-overlay.png", (0.0, -4.1, 1.45), (0, 0, 0.92), False)
    bpy.context.scene.render.resolution_x, bpy.context.scene.render.resolution_y = previous_resolution
    for obj in overlays:
        obj.hide_render = True

    # Evidence views at audited action frames.
    action_views = [
        ("pick_low", 35, "pick-low-silhouette.png"),
        ("pick_mid", 29, "pick-mid-silhouette.png"),
        ("pick_high", 38, "pick-high-silhouette.png"),
        ("carry_crate", 20, "carry-crate.png"),
        ("lift_crate", 22, "lift-crate.png"),
    ]
    review = bpy.data.collections["REVIEW_ONLY"]
    crates = add_review_crate(review)
    crate_base_locations = {obj.name: obj.location.copy() for obj in crates}
    for obj in crates:
        obj.hide_render = True
    fruits = add_review_fruit_targets(review)
    trike = append_tricycle(review)
    for obj in trike:
        obj.hide_render = True
    render_action_strip(
        camera, "walk", (1, 8, 16, 23, 30), "walk-stride.png",
        (1.45, -3.2, 1.45), (0, 0, 0.82),
        ("HEEL STRIKE", "LOAD", "SUPPORT", "TOE OFF", "SWING"),
    )
    for name, frame, filename in action_views:
        set_action(name, frame)
        for obj in crates:
            obj.hide_render = name not in {"carry_crate", "lift_crate", "load_crate"}
            lift_offset = -0.165 if name == "lift_crate" else 0.0
            load_offset = 0.19 if name == "load_crate" else 0.0
            obj.location = crate_base_locations[obj.name] + Vector((0, 0, lift_offset + load_offset))
        for target_name, objects in fruits.items():
            for obj in objects:
                obj.hide_render = target_name != name
        for obj in trike:
            obj.hide_render = True
        render_view(camera, filename, (2.8, -3.8, 2.0), (0, 0, 0.92), False)

    # Ingress and egress proofs show start, transfer, and endpoint against the
    # real authored vehicle instead of a single ambiguous near-seat still.
    for obj in trike:
        obj.hide_render = False
    render_action_strip(
        camera, "enter_vehicle", (1, 38, 75), "enter-vehicle-path.png",
        (1.0, -6.5, 3.2), (-0.18, -0.34, 0.82),
    )
    render_action_strip(
        camera, "exit_vehicle", (1, 34, 70), "exit-vehicle-path.png",
        (1.0, -6.5, 3.2), (-0.18, -0.34, 0.82),
    )

    set_action("drive", 30)
    for obj in trike:
        obj.hide_render = False
    previous_resolution = (scene.render.resolution_x, scene.render.resolution_y)
    scene.render.resolution_x = 420
    scene.render.resolution_y = 420
    drive_paths: list[Path] = []
    for index, location in enumerate(((3.4, -4.8, 2.25), (-3.4, -4.8, 2.25))):
        name = f".tmp-drive-fit-{index}.png"
        camera.location = location
        look_at(camera, (0, -0.45, 0.74))
        label = add_review_label(camera, "RIGHT FIT" if index == 0 else "LEFT FIT", (0.0, -0.90, 1.62), 0.060)
        render_view(camera, name, location, (0, -0.45, 0.74), False, 2.8)
        drive_paths.append(REVIEW_DIR / name)
        bpy.data.objects.remove(label, do_unlink=True)
    compose_strip(drive_paths, REVIEW_DIR / "drive-tricycle-fit.png")
    scene.render.resolution_x, scene.render.resolution_y = previous_resolution

    # Cargo loading proof: approach at the near side, release into the actual
    # measured cargo slot, then withdraw while the crate remains in the bed.
    cargo_socket = next(obj for obj in trike if obj.name == "cargo_slot_01")
    cargo_slot = measure_fixture_objects({"cargoSlot": cargo_socket})["cargoSlot"]
    crate_center = Vector((0.0, -0.40, 0.70))
    bed_floor = next(obj for obj in trike if obj.name == "box_bed_floor")
    bed_center = measure_fixture_objects({"cargoBed": bed_floor})["cargoBed"]
    release_center = Vector((cargo_slot.x, cargo_slot.y, bed_center.z + 0.185))
    approach_center = release_center + Vector((0.10, -0.80, 0.38))
    previous_resolution = (scene.render.resolution_x, scene.render.resolution_y)
    scene.render.resolution_x = 420
    scene.render.resolution_y = 420
    load_paths: list[Path] = []
    for index, (frame, phase) in enumerate(((1, "PICKUP"), (30, "APPROACH"), (49, "PLACE + RELEASE"), (65, "WITHDRAW"))):
        set_action("load_crate", frame)
        for obj in crates:
            obj.hide_render = False
            if frame == 1:
                proof_offset = Vector()
            elif frame == 30:
                proof_offset = approach_center - crate_center
            else:
                # The crate remains in the actual slot after the release.
                proof_offset = release_center - crate_center
            obj.location = crate_base_locations[obj.name] + proof_offset
        camera.location = (4.5, -1.40, 3.20)
        look_at(camera, (0.0, 0.30, 0.90))
        label = add_review_label(camera, phase, (0.0, -0.45, 1.72), 0.060)
        name = f".tmp-load-fit-{index}.png"
        render_view(camera, name, tuple(camera.location), (0.0, 0.30, 0.90), False, 2.8)
        load_paths.append(REVIEW_DIR / name)
        bpy.data.objects.remove(label, do_unlink=True)
    compose_strip(load_paths, REVIEW_DIR / "load-crate.png")
    scene.render.resolution_x, scene.render.resolution_y = previous_resolution
    for obj in trike:
        obj.hide_render = True
    for obj in crates:
        obj.hide_render = True
    for objects in fruits.values():
        for obj in objects:
            obj.hide_render = True

    set_action("idle", 30)
    meshes = [bpy.data.objects[name] for name in ("farmer_body_continuous", "farmer_layered_workwear", "farmer_workwear_details", "farmer_hat_gloves_shoes", "farmer_face_detail")]
    originals = {obj.name: list(obj.data.materials) for obj in meshes}
    id_materials, weight_material, checker_material = create_review_materials(meshes)
    swap_materials(meshes, id_materials, originals)
    render_view(camera, "material-id.png", (2.6, -3.6, 2.2), (0, 0, 0.95), False)
    swap_materials(meshes, weight_material, originals)
    render_view(camera, "weight-heatmap.png", (-2.6, -3.6, 2.2), (0, 0, 0.95), False)
    swap_materials(meshes, None, originals)
    old_resolution = (scene.render.resolution_x, scene.render.resolution_y)
    scene.render.resolution_x = 360
    scene.render.resolution_y = 360
    joint_panels = [
        ("SHOULDER / ELBOW", "carry_crate", 20, (0.95, -1.28, 1.34), (0.38, -0.06, 1.20)),
        ("WRIST / FINGERS", "carry_crate", 20, (0.76, -0.94, 1.02), (0.23, -0.33, 0.87)),
        ("HIP / SPINE", "lift_crate", 22, (0.86, -1.28, 0.92), (0.06, -0.02, 0.83)),
        ("KNEE / ANKLE", "lift_crate", 22, (0.82, -1.08, 0.42), (0.08, -0.02, 0.34)),
        ("SEATED HIP / SEAT", "drive", 30, (1.55, -2.35, 1.12), (0.02, -0.25, 0.76)),
        ("REACH SHOULDER", "pick_high", 38, (0.88, -1.26, 1.48), (-0.22, -0.10, 1.39)),
    ]
    joint_paths: list[Path] = []
    for index, (panel_label, action, frame, location, target) in enumerate(joint_panels):
        set_action(action, frame)
        for obj in trike:
            obj.hide_render = action != "drive"
        camera.location = location
        look_at(camera, target)
        label = add_review_label(camera, panel_label, (target[0], target[1] - 0.18, target[2] + 0.22), 0.032)
        name = f".tmp-joint-panel-{index}.png"
        render_view(camera, name, location, target, False)
        joint_paths.append(REVIEW_DIR / name)
        bpy.data.objects.remove(label, do_unlink=True)
    compose_grid(joint_paths, REVIEW_DIR / "joint-deformation-sheet.png", 3)
    for obj in trike:
        obj.hide_render = True
    scene.render.resolution_x, scene.render.resolution_y = old_resolution
    set_action("idle", 30)
    swap_materials(meshes, checker_material, originals)
    render_view(camera, "uv-texel-proof.png", (0, -4, 2.1), (0, 0, 0.9), False)
    swap_materials(meshes, None, originals)
    lights[0].data.color = (1.0, 0.58, 0.30)
    lights[1].data.color = (0.34, 0.44, 0.68)
    set_action("idle", 30)
    render_view(camera, "warm-third-person.png", (-3.1, -4.2, 2.4), (0, 0, 0.95), False)

    audit = {
        "assetId": "character.farmer-a",
        "sourceReloadedFromDisk": str(BLEND_PATH.relative_to(REPOSITORY)),
        "fixtures": {
            "tricycle": "resources/blender/vehicle/electric-tricycle-a.blend; review-only",
            "crate": "0.50x0.35x0.28m contemporary ventilated plastic crate; review-only",
            "fruitTargetsM": {"low": 0.85, "mid": 1.20, "high": 1.67},
        },
        "measurementAuthority": "tools/blender/review_farmer_character.py decoded-GLB evaluation",
        "runtimeCapsule": {
            "sourceCollisionCollectionEmpty": True,
            "exportedCollisionGlbEmpty": True,
            "standing": {"radiusM": 0.29, "heightM": 1.62},
            "interaction": {"radiusM": 0.27, "heightM": 1.50},
            "vehicle": {"radiusM": 0.25, "heightM": 1.18},
        },
        "sourceGeometry": source_geometry_audit(),
        "animations": animation_audit(),
    }
    (REVIEW_DIR / "character-review-audit.json").write_text(json.dumps(audit, indent=2, sort_keys=True) + "\n", encoding="utf-8")


if __name__ == "__main__":
    arguments = args_after_separator()
    if "--render-only" in arguments:
        render_reviews()
    else:
        build()
