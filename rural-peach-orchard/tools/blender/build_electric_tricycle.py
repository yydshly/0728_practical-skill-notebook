"""Build and review the original electric-tricycle-a Blender asset.

Build:
  blender --background --python tools/blender/build_electric_tricycle.py

Render from a freshly loaded source:
  blender --background resources/blender/vehicle/electric-tricycle-a.blend \
    --python tools/blender/build_electric_tricycle.py -- --render-only
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from typing import Any, Iterable

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix, Vector


REPOSITORY = Path(__file__).resolve().parents[2]
BLEND_PATH = REPOSITORY / "resources/blender/vehicle/electric-tricycle-a.blend"
REVIEW_DIR = REPOSITORY / "artifacts/review/vehicle/electric-tricycle-a"

PAINT = "M_Trike_Paint"
CHASSIS = "M_Trike_Chassis"
RUBBER = "M_Trike_Rubber"
UTILITY = "M_Trike_Utility"

DRIVER_CAMERA_LOCATION = (0.0, 1.10, 1.55)
DRIVER_CAMERA_TARGET = (0.0, -0.62, 0.76)
DRIVER_CAMERA_LENS_MM = 50.0
DRIVER_CAMERA_SENSOR_WIDTH_MM = 40.0
DRIVER_PROJECTION_SAFE_MARGIN = 0.05
DRIVER_PROJECTION_OBJECTS = (
    "handle_grip_left",
    "handle_grip_right",
    "brake_lever_left",
    "brake_lever_right",
    "footboard_left",
    "footboard_right",
    "instrument_display",
    "key_switch",
)


def _arguments_after_separator() -> list[str]:
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

    visual = bpy.data.collections.new("VISUAL")
    collision = bpy.data.collections.new("COLLISION")
    sockets = bpy.data.collections.new("SOCKETS")
    rig = bpy.data.collections.new("RIG")
    for collection in (visual, collision, sockets, rig):
        scene.collection.children.link(collection)
    for name in ("LOD0", "LOD1", "LOD2"):
        visual.children.link(bpy.data.collections.new(name))


def create_materials() -> dict[str, Any]:
    definitions = {
        PAINT: ((1.0, 1.0, 1.0, 1.0), 0.54, 0.0),
        CHASSIS: ((1.0, 1.0, 1.0, 1.0), 0.58, 0.72),
        RUBBER: ((1.0, 1.0, 1.0, 1.0), 0.70, 0.0),
        UTILITY: ((1.0, 1.0, 1.0, 1.0), 0.50, 0.0),
    }
    materials: dict[str, Any] = {}
    for name, (color, roughness, metallic) in definitions.items():
        material = bpy.data.materials.new(name)
        material.use_nodes = True
        material.diffuse_color = color
        shader = material.node_tree.nodes.get("Principled BSDF")
        shader.inputs["Base Color"].default_value = color
        shader.inputs["Roughness"].default_value = roughness
        shader.inputs["Metallic"].default_value = metallic
        vertex_color = material.node_tree.nodes.new("ShaderNodeVertexColor")
        vertex_color.name = "Runtime vertex color"
        vertex_color.layer_name = "wear_color"
        material.node_tree.links.new(
            vertex_color.outputs["Color"],
            shader.inputs["Base Color"],
        )
        materials[name] = material
    return materials


def move_to_collection(obj: Any, collection_name: str) -> None:
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    bpy.data.collections[collection_name].objects.link(obj)


def finish_mesh(
    obj: Any,
    name: str,
    collection: str,
    material: Any | None,
    bevel: float = 0.0,
    bevel_segments: int = 2,
    smooth: bool = False,
) -> Any:
    obj.name = name
    obj.data.name = f"{name}_mesh"
    move_to_collection(obj, collection)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if bevel > 0.0:
        modifier = obj.modifiers.new("Production edge bevel", "BEVEL")
        modifier.width = bevel
        modifier.segments = bevel_segments
        modifier.limit_method = "ANGLE"
        modifier.angle_limit = math.radians(24)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    if smooth:
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    try:
        normal_modifier = obj.modifiers.new("Weighted production normals", "WEIGHTED_NORMAL")
        normal_modifier.keep_sharp = True
        bpy.ops.object.modifier_apply(modifier=normal_modifier.name)
    except Exception:
        pass
    if material is not None:
        obj.data.materials.append(material)
    obj["asset_role"] = "visual" if collection == "LOD0" else "collision"
    obj["authored_for"] = "vehicle.electric-tricycle-a"
    obj.select_set(False)
    return obj


def add_box(
    name: str,
    location: tuple[float, float, float],
    dimensions: tuple[float, float, float],
    material: Any | None,
    *,
    collection: str = "LOD0",
    bevel: float = 0.015,
) -> Any:
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.dimensions = dimensions
    return finish_mesh(obj, name, collection, material, bevel=bevel)


def add_rotated_box(
    name: str,
    location: tuple[float, float, float],
    dimensions: tuple[float, float, float],
    rotation: tuple[float, float, float],
    material: Any,
    *,
    collection: str = "LOD0",
    bevel: float = 0.01,
) -> Any:
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.dimensions = dimensions
    return finish_mesh(
        obj,
        name,
        collection,
        material,
        bevel=bevel,
    )


def add_cylinder(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    depth: float,
    material: Any | None,
    *,
    axis: str = "Z",
    vertices: int = 32,
    collection: str = "LOD0",
    bevel: float = 0.006,
) -> Any:
    rotation = {
        "X": (0.0, math.pi / 2.0, 0.0),
        "Y": (math.pi / 2.0, 0.0, 0.0),
        "Z": (0.0, 0.0, 0.0),
    }[axis]
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    return finish_mesh(
        bpy.context.object,
        name,
        collection,
        material,
        bevel=bevel,
        smooth=True,
    )


def add_sphere(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    material: Any,
    *,
    segments: int = 32,
    rings: int = 16,
) -> Any:
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments,
        ring_count=rings,
        location=location,
    )
    obj = bpy.context.object
    obj.scale = scale
    return finish_mesh(obj, name, "LOD0", material, smooth=True)


def add_torus(
    name: str,
    location: tuple[float, float, float],
    major_radius: float,
    minor_radius: float,
    material: Any,
    *,
    major_segments: int = 48,
    minor_segments: int = 12,
    axis: str = "X",
) -> Any:
    rotation = {
        "X": (0.0, math.pi / 2.0, 0.0),
        "Y": (math.pi / 2.0, 0.0, 0.0),
        "Z": (0.0, 0.0, 0.0),
    }[axis]
    bpy.ops.mesh.primitive_torus_add(
        major_segments=major_segments,
        minor_segments=minor_segments,
        location=location,
        rotation=rotation,
        major_radius=major_radius,
        minor_radius=minor_radius,
    )
    return finish_mesh(
        bpy.context.object,
        name,
        "LOD0",
        material,
        smooth=True,
    )


def add_tube(
    name: str,
    points: Iterable[tuple[float, float, float]],
    radius: float,
    material: Any,
    *,
    resolution: int = 2,
    bevel_resolution: int = 2,
) -> Any:
    curve_data = bpy.data.curves.new(f"{name}_curve", "CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = resolution
    curve_data.bevel_depth = radius
    curve_data.bevel_resolution = bevel_resolution
    curve_data.resolution_u = 2
    spline = curve_data.splines.new("BEZIER")
    coordinates = list(points)
    spline.bezier_points.add(len(coordinates) - 1)
    for point, coordinate in zip(spline.bezier_points, coordinates):
        point.co = coordinate
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve_data)
    bpy.data.collections["LOD0"].objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    return finish_mesh(obj, name, "LOD0", material, smooth=True)


def add_prism(
    name: str,
    outline: list[tuple[float, float]],
    bottom: float,
    top: float,
    material: Any,
    *,
    top_scale: float = 1.0,
    bevel: float = 0.01,
) -> Any:
    center_x = sum(point[0] for point in outline) / len(outline)
    center_y = sum(point[1] for point in outline) / len(outline)
    vertices = [(x, y, bottom) for x, y in outline]
    vertices += [
        (
            center_x + (x - center_x) * top_scale,
            center_y + (y - center_y) * top_scale,
            top,
        )
        for x, y in outline
    ]
    count = len(outline)
    faces: list[tuple[int, ...]] = [
        tuple(range(count - 1, -1, -1)),
        tuple(range(count, count * 2)),
    ]
    for index in range(count):
        following = (index + 1) % count
        faces.append((index, following, following + count, index + count))
    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.data.collections["LOD0"].objects.link(obj)
    return finish_mesh(obj, name, "LOD0", material, bevel=bevel, smooth=True)


def add_arc_band(
    name: str,
    center: tuple[float, float, float],
    radius: float,
    width: float,
    thickness: float,
    start_degrees: float,
    end_degrees: float,
    material: Any,
    segments: int = 24,
) -> Any:
    cx, cy, cz = center
    vertices: list[tuple[float, float, float]] = []
    for index in range(segments + 1):
        angle = math.radians(
            start_degrees + (end_degrees - start_degrees) * index / segments
        )
        radial = (
            cy + radius * math.sin(angle),
            cz + radius * math.cos(angle),
        )
        inner = (
            cy + (radius - thickness) * math.sin(angle),
            cz + (radius - thickness) * math.cos(angle),
        )
        vertices.extend(
            [
                (cx - width / 2.0, radial[0], radial[1]),
                (cx + width / 2.0, radial[0], radial[1]),
                (cx - width / 2.0, inner[0], inner[1]),
                (cx + width / 2.0, inner[0], inner[1]),
            ]
        )
    faces: list[tuple[int, ...]] = []
    for index in range(segments):
        base = index * 4
        next_base = (index + 1) * 4
        faces.extend(
            [
                (base, next_base, next_base + 1, base + 1),
                (base + 2, base + 3, next_base + 3, next_base + 2),
                (base, base + 2, next_base + 2, next_base),
                (base + 1, next_base + 1, next_base + 3, base + 3),
            ]
        )
    faces.extend([(0, 1, 3, 2), (segments * 4, segments * 4 + 2, segments * 4 + 3, segments * 4 + 1)])
    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.data.collections["LOD0"].objects.link(obj)
    return finish_mesh(obj, name, "LOD0", material, bevel=0.008, smooth=True)


def add_recessed_panel(
    name: str,
    center: tuple[float, float, float],
    size_u: float,
    size_v: float,
    frame_width: float,
    recess: float,
    material: Any,
    *,
    plane: str,
    outward_sign: float,
) -> Any:
    cx, cy, cz = center
    outer = [
        (-size_u / 2.0, -size_v / 2.0),
        (size_u / 2.0, -size_v / 2.0),
        (size_u / 2.0, size_v / 2.0),
        (-size_u / 2.0, size_v / 2.0),
    ]
    inner = [
        (-size_u / 2.0 + frame_width, -size_v / 2.0 + frame_width),
        (size_u / 2.0 - frame_width, -size_v / 2.0 + frame_width),
        (size_u / 2.0 - frame_width, size_v / 2.0 - frame_width),
        (-size_u / 2.0 + frame_width, size_v / 2.0 - frame_width),
    ]

    def coordinate(u: float, v: float, depth: float) -> tuple[float, float, float]:
        if plane == "X":
            return (cx - outward_sign * depth, cy + u, cz + v)
        if plane == "Y":
            return (cx + u, cy - outward_sign * depth, cz + v)
        raise ValueError(f"Unsupported panel plane: {plane}")

    vertices = [coordinate(u, v, 0.0) for u, v in outer]
    vertices += [coordinate(u, v, recess) for u, v in inner]
    faces = [
        (0, 1, 5, 4),
        (1, 2, 6, 5),
        (2, 3, 7, 6),
        (3, 0, 4, 7),
        (4, 5, 6, 7),
    ]
    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.data.collections["LOD0"].objects.link(obj)
    return finish_mesh(
        obj,
        name,
        "LOD0",
        material,
        bevel=0.006,
        bevel_segments=2,
    )


def join_objects(objects: list[Any], name: str) -> Any:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    objects[0].name = name
    objects[0].data.name = f"{name}_mesh"
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    objects[0].select_set(False)
    return objects[0]


def build_wheel(
    prefix: str,
    center: tuple[float, float, float],
    outside_radius: float,
    width: float,
    materials: dict[str, Any],
) -> None:
    cx, cy, cz = center
    tire_minor = width * 0.31
    tire_major = outside_radius - tire_minor
    add_torus(
        f"{prefix}_tire_sidewall",
        center,
        tire_major,
        tire_minor,
        materials[RUBBER],
    )
    tread_blocks: list[Any] = []
    for index in range(36):
        angle = math.tau * index / 36.0
        radius = outside_radius - 0.010
        y = cy + radius * math.sin(angle)
        z = cz + radius * math.cos(angle)
        for side_index, side in enumerate((-1.0, 1.0)):
            bpy.ops.mesh.primitive_cube_add(
                location=(cx + side * width * 0.255, y, z),
                rotation=(angle, side * math.radians(13.0), side * math.radians(17.0)),
            )
            block = bpy.context.object
            block.dimensions = (
                width * 0.50,
                0.055,
                0.022,
            )
            tread_blocks.append(
                finish_mesh(
                    block,
                    f"{prefix}_chevron_lug_{index + 1:02d}_{side_index + 1}",
                    "LOD0",
                    materials[RUBBER],
                    bevel=0.002,
                    bevel_segments=1,
                )
            )
    join_objects(tread_blocks, f"{prefix}_directional_tread")
    add_cylinder(
        f"{prefix}_rim_outer",
        center,
        outside_radius * 0.56,
        width * 0.84,
        materials[CHASSIS],
        axis="X",
        vertices=40,
        bevel=0.008,
    )
    add_cylinder(
        f"{prefix}_brake_drum",
        center,
        outside_radius * 0.31,
        width * 0.94,
        materials[UTILITY],
        axis="X",
        vertices=32,
        bevel=0.006,
    )
    add_cylinder(
        f"{prefix}_hub",
        center,
        outside_radius * 0.13,
        width * 1.05,
        materials[CHASSIS],
        axis="X",
        vertices=28,
        bevel=0.005,
    )
    add_torus(
        f"{prefix}_rim_bead",
        center,
        outside_radius * 0.43,
        0.013,
        materials[UTILITY],
        major_segments=40,
        minor_segments=8,
    )
    for index in range(6):
        angle = math.tau * index / 6.0
        add_cylinder(
            f"{prefix}_hub_bolt_{index + 1:02d}",
            (
                cx - width * 0.55,
                cy + outside_radius * 0.20 * math.sin(angle),
                cz + outside_radius * 0.20 * math.cos(angle),
            ),
            0.014,
            0.014,
            materials[UTILITY],
            axis="X",
            vertices=16,
            bevel=0.002,
        )
    for index in range(8):
        angle = math.tau * index / 8.0
        y1 = cy + outside_radius * 0.15 * math.sin(angle)
        z1 = cz + outside_radius * 0.15 * math.cos(angle)
        y2 = cy + outside_radius * 0.47 * math.sin(angle)
        z2 = cz + outside_radius * 0.47 * math.cos(angle)
        add_tube(
            f"{prefix}_spoke_{index + 1:02d}",
            [(cx - width * 0.34, y1, z1), (cx - width * 0.34, y2, z2)],
            0.012,
            materials[PAINT],
            resolution=1,
            bevel_resolution=1,
        )
    for side, x in (("left", cx - width * 0.54), ("right", cx + width * 0.54)):
        add_cylinder(
            f"{prefix}_axle_fastener_{side}",
            (x, cy, cz),
            0.035,
            0.018,
            materials[CHASSIS],
            axis="X",
            vertices=20,
            bevel=0.004,
        )


def build_chassis(materials: dict[str, Any]) -> None:
    frame_paths = [
        ("frame_left_main", [(-0.39, -0.92, 0.20), (-0.43, -0.48, 0.17), (-0.43, 1.34, 0.37)]),
        ("frame_right_main", [(0.39, -0.92, 0.20), (0.43, -0.48, 0.17), (0.43, 1.34, 0.37)]),
        ("frame_left_upper", [(-0.31, -0.82, 0.30), (-0.33, -0.08, 0.44), (-0.49, 1.28, 0.48)]),
        ("frame_right_upper", [(0.31, -0.82, 0.30), (0.33, -0.08, 0.44), (0.49, 1.28, 0.48)]),
        ("frame_front_cross", [(-0.39, -0.82, 0.21), (0.39, -0.82, 0.21)]),
        ("frame_mid_cross", [(-0.43, -0.05, 0.31), (0.43, -0.05, 0.31)]),
        ("frame_rear_cross", [(-0.49, 1.28, 0.40), (0.49, 1.28, 0.40)]),
    ]
    for name, points in frame_paths:
        add_tube(name, points, 0.035, materials[CHASSIS])
    for x in (-0.37, 0.37):
        add_tube(
            f"driver_guard_{'left' if x < 0 else 'right'}",
            [(x, -0.58, 0.25), (x, -0.42, 0.75), (x, -0.02, 0.77)],
            0.025,
            materials[PAINT],
        )
    add_box(
        "battery_enclosure",
        (0.0, -0.16, 0.44),
        (0.62, 0.50, 0.48),
        materials[PAINT],
        bevel=0.038,
    )
    add_box(
        "battery_lid_stamped",
        (0.0, -0.16, 0.695),
        (0.58, 0.46, 0.035),
        materials[PAINT],
        bevel=0.012,
    )
    for x in (-0.23, 0.23):
        add_box(
            f"battery_hold_down_{'left' if x < 0 else 'right'}",
            (x, -0.16, 0.70),
            (0.035, 0.40, 0.025),
            materials[CHASSIS],
            bevel=0.004,
        )
    add_recessed_panel(
        "battery_service_panel_recess",
        (0.0, -0.414, 0.445),
        0.48,
        0.34,
        0.035,
        0.016,
        materials[PAINT],
        plane="Y",
        outward_sign=-1.0,
    )
    for side, x in (("left", -0.316), ("right", 0.316)):
        for index in range(5):
            add_box(
                f"battery_vent_{side}_{index + 1:02d}",
                (x, -0.29 + index * 0.065, 0.44),
                (0.012, 0.038, 0.18),
                materials[CHASSIS],
                bevel=0.003,
            )
        add_box(
            f"battery_lower_mount_{side}",
            (x, -0.16, 0.235),
            (0.08, 0.32, 0.06),
            materials[CHASSIS],
            bevel=0.008,
        )
        for y in (-0.29, -0.03):
            add_cylinder(
                f"battery_mount_bolt_{side}_{'front' if y < -0.1 else 'rear'}",
                (x + (-0.045 if x < 0 else 0.045), y, 0.235),
                0.016,
                0.018,
                materials[UTILITY],
                axis="X",
                vertices=16,
                bevel=0.002,
            )
    add_box(
        "controller_finned_case",
        (0.0, 0.15, 0.39),
        (0.42, 0.20, 0.20),
        materials[UTILITY],
        bevel=0.012,
    )
    add_box(
        "controller_connector_panel",
        (0.0, 0.258, 0.39),
        (0.30, 0.018, 0.12),
        materials[CHASSIS],
        bevel=0.006,
    )
    for index, x in enumerate((-0.09, 0.0, 0.09)):
        add_cylinder(
            f"controller_cable_gland_{index + 1}",
            (x, 0.271, 0.39),
            0.018,
            0.020,
            materials[RUBBER],
            axis="Y",
            vertices=16,
            bevel=0.003,
        )
    for index in range(7):
        add_box(
            f"controller_cooling_fin_{index + 1:02d}",
            (-0.15 + index * 0.05, 0.042, 0.39),
            (0.016, 0.016, 0.17),
            materials[CHASSIS],
            bevel=0.002,
        )
    for side, x in (("left", -0.43), ("right", 0.43)):
        add_box(
            f"footboard_{side}",
            (x, -0.58, 0.265),
            (0.23, 0.60, 0.045),
            materials[PAINT],
            bevel=0.015,
        )
        for index in range(5):
            add_box(
                f"footboard_{side}_traction_{index + 1:02d}",
                (x, -0.78 + index * 0.105, 0.292),
                (0.17, 0.025, 0.012),
                materials[RUBBER],
                bevel=0.004,
            )
    add_box(
        "front_frame_gusset",
        (0.0, -0.76, 0.55),
        (0.22, 0.10, 0.55),
        materials[PAINT],
        bevel=0.02,
    )
    for index, z in enumerate((0.42, 0.54, 0.66)):
        add_box(
            f"front_gusset_pressed_rib_{index + 1}",
            (0.0, -0.817, z),
            (0.16, 0.018, 0.025),
            materials[CHASSIS],
            bevel=0.004,
        )


def build_steering(materials: dict[str, Any]) -> None:
    front_center = (0.0, -1.10, 0.29)
    for side, x in (("left", -0.085), ("right", 0.085)):
        add_tube(
            f"front_fork_{side}_lower",
            [(x, -1.10, 0.30), (x, -0.96, 0.79), (x, -0.91, 1.04)],
            0.030,
            materials[CHASSIS],
        )
        add_tube(
            f"front_fork_{side}_gaiter",
            [(x, -0.99, 0.64), (x, -0.94, 0.85)],
            0.044,
            materials[RUBBER],
            resolution=1,
            bevel_resolution=2,
        )
        for index in range(5):
            add_torus(
                f"fork_gaiter_{side}_{index + 1:02d}",
                (x, -0.975 + index * 0.011, 0.68 + index * 0.042),
                0.039,
                0.008,
                materials[RUBBER],
                major_segments=20,
                minor_segments=6,
            )
    add_tube(
        "steering_head_welded_column",
        [(0.0, -0.91, 0.90), (0.0, -0.81, 1.19)],
        0.055,
        materials[CHASSIS],
    )
    add_box(
        "steering_top_clamp",
        (0.0, -0.79, 1.18),
        (0.22, 0.10, 0.075),
        materials[CHASSIS],
        bevel=0.015,
    )
    add_box(
        "fork_lower_bridge",
        (0.0, -0.965, 0.83),
        (0.25, 0.09, 0.055),
        materials[CHASSIS],
        bevel=0.014,
    )
    for x in (-0.085, 0.085):
        add_cylinder(
            f"fork_bridge_bolt_{'left' if x < 0 else 'right'}",
            (x, -1.016, 0.83),
            0.017,
            0.018,
            materials[UTILITY],
            axis="Y",
            vertices=16,
            bevel=0.002,
        )
    add_tube(
        "handlebar_swept",
        [
            (-0.40, -0.79, 1.29),
            (-0.23, -0.75, 1.25),
            (0.0, -0.78, 1.22),
            (0.23, -0.75, 1.25),
            (0.40, -0.79, 1.29),
        ],
        0.021,
        materials[CHASSIS],
    )
    for side, x in (("left", -0.42), ("right", 0.42)):
        add_cylinder(
            f"handle_grip_{side}",
            (x, -0.79, 1.30),
            0.031,
            0.17,
            materials[RUBBER],
            axis="X",
            vertices=24,
            bevel=0.005,
        )
        add_tube(
            f"brake_lever_{side}",
            [(x * 0.92, -0.80, 1.31), (x * 0.72, -0.87, 1.35)],
            0.014,
            materials[UTILITY],
            resolution=1,
            bevel_resolution=1,
        )
        add_cylinder(
            f"brake_lever_pivot_{side}",
            (x * 0.91, -0.80, 1.31),
            0.018,
            0.026,
            materials[UTILITY],
            axis="X",
            vertices=18,
            bevel=0.003,
        )
        add_box(
            f"handle_switch_cluster_{side}",
            (x * 0.80, -0.79, 1.292),
            (0.075, 0.07, 0.065),
            materials[UTILITY],
            bevel=0.014,
        )
        add_tube(
            f"brake_cable_{side}",
            [(x * 0.84, -0.80, 1.30), (x * 0.55, -0.91, 1.08), (x * 0.30, -1.03, 0.48)],
            0.006,
            materials[RUBBER],
            resolution=2,
            bevel_resolution=1,
        )
    add_cylinder(
        "headlamp_shell",
        (0.0, -1.005, 1.09),
        0.115,
        0.10,
        materials[CHASSIS],
        axis="Y",
        vertices=40,
        bevel=0.008,
    )
    add_cylinder(
        "headlamp_lens",
        (0.0, -1.061, 1.09),
        0.095,
        0.018,
        materials[UTILITY],
        axis="Y",
        vertices=40,
        bevel=0.004,
    )
    add_torus(
        "headlamp_retaining_bezel",
        (0.0, -1.073, 1.09),
        0.096,
        0.012,
        materials[UTILITY],
        major_segments=40,
        minor_segments=8,
        axis="Y",
    )
    for x in (-0.13, 0.13):
        add_box(
            f"headlamp_mount_ear_{'left' if x < 0 else 'right'}",
            (x, -0.965, 1.075),
            (0.055, 0.06, 0.11),
            materials[CHASSIS],
            bevel=0.010,
        )
        add_cylinder(
            f"headlamp_mount_bolt_{'left' if x < 0 else 'right'}",
            (x + (-0.031 if x < 0 else 0.031), -0.995, 1.075),
            0.015,
            0.016,
            materials[UTILITY],
            axis="X",
            vertices=16,
            bevel=0.002,
        )
    add_box(
        "instrument_pod",
        (0.0, -0.75, 1.28),
        (0.19, 0.10, 0.11),
        materials[UTILITY],
        bevel=0.025,
    )
    add_box(
        "instrument_display",
        (0.0, -0.694, 1.29),
        (0.12, 0.012, 0.055),
        materials[CHASSIS],
        bevel=0.006,
    )
    add_box(
        "instrument_display_bezel",
        (0.0, -0.689, 1.29),
        (0.15, 0.012, 0.078),
        materials[CHASSIS],
        bevel=0.010,
    )
    add_box(
        "instrument_display_glass",
        (0.0, -0.681, 1.292),
        (0.115, 0.010, 0.050),
        materials[UTILITY],
        bevel=0.006,
    )
    for index, x in enumerate((-0.040, 0.0, 0.040)):
        add_cylinder(
            f"instrument_indicator_{index + 1}",
            (x, -0.674, 1.265),
            0.006,
            0.006,
            materials[UTILITY],
            axis="Y",
            vertices=12,
            bevel=0.001,
        )
    add_rotated_box(
        "instrument_speed_needle",
        (0.020, -0.674, 1.304),
        (0.045, 0.006, 0.006),
        (0.0, math.radians(18.0), math.radians(24.0)),
        materials[UTILITY],
        bevel=0.002,
    )
    add_cylinder(
        "key_switch",
        (0.105, -0.690, 1.245),
        0.018,
        0.015,
        materials[UTILITY],
        axis="Y",
        vertices=20,
        bevel=0.003,
    )
    add_rotated_box(
        "ignition_key",
        (0.105, -0.674, 1.245),
        (0.045, 0.009, 0.016),
        (0.0, 0.0, math.radians(-22.0)),
        materials[UTILITY],
        bevel=0.003,
    )
    add_arc_band(
        "front_mudguard",
        front_center,
        0.335,
        0.17,
        0.035,
        -72,
        76,
        materials[PAINT],
    )
def build_seat(materials: dict[str, Any]) -> None:
    outline = [
        (-0.25, -0.04),
        (-0.29, -0.10),
        (-0.28, -0.24),
        (-0.18, -0.38),
        (0.0, -0.45),
        (0.18, -0.38),
        (0.28, -0.24),
        (0.29, -0.10),
        (0.25, -0.04),
        (0.0, 0.01),
    ]
    add_prism(
        "saddle_vinyl",
        outline,
        0.705,
        0.77,
        materials[UTILITY],
        top_scale=0.94,
        bevel=0.025,
    )
    add_box(
        "saddle_pan",
        (0.0, -0.20, 0.695),
        (0.46, 0.38, 0.035),
        materials[CHASSIS],
        bevel=0.014,
    )
    add_cylinder(
        "seat_post",
        (0.0, -0.18, 0.64),
        0.038,
        0.12,
        materials[CHASSIS],
        axis="Z",
        vertices=24,
        bevel=0.004,
    )
    for x in (-0.15, 0.15):
        add_tube(
            f"seat_spring_{'left' if x < 0 else 'right'}",
            [(x, -0.19, 0.665), (x, -0.19, 0.715)],
            0.030,
            materials[CHASSIS],
            resolution=1,
            bevel_resolution=2,
        )


def build_cargo_bed(materials: dict[str, Any]) -> None:
    add_box(
        "cargo_bed_floor",
        (0.0, 0.75, 0.625),
        (1.06, 1.50, 0.055),
        materials[PAINT],
        bevel=0.012,
    )
    for index, y in enumerate((0.18, 0.45, 0.75, 1.05, 1.32)):
        add_box(
            f"cargo_floor_pressed_channel_{index + 1:02d}",
            (0.0, y, 0.658),
            (1.00, 0.045, 0.025),
            materials[CHASSIS],
            bevel=0.005,
        )
    for side, x in (("left", -0.5525), ("right", 0.5525)):
        add_box(
            f"cargo_side_{side}_panel",
            (x, 0.75, 0.85),
            (0.045, 1.50, 0.38),
            materials[PAINT],
            bevel=0.012,
        )
        for index, y in enumerate((0.20, 0.55, 0.95, 1.30)):
            add_box(
                f"cargo_side_{side}_vertical_rib_{index + 1:02d}",
                (x + (-0.026 if x < 0 else 0.026), y, 0.85),
                (0.022, 0.045, 0.36),
                materials[PAINT],
                bevel=0.005,
            )
        for index, z in enumerate((0.72, 0.86, 1.00)):
            add_box(
                f"cargo_side_{side}_pressed_rib_{index + 1:02d}",
                (x + (-0.026 if x < 0 else 0.026), 0.75, z),
                (0.022, 1.42, 0.030),
                materials[PAINT],
                bevel=0.004,
            )
        add_tube(
            f"cargo_side_{side}_top_rail",
            [(x, -0.02, 1.065), (x, 1.52, 1.065)],
            0.025,
            materials[PAINT],
        )
        add_box(
            f"cargo_side_{side}_folded_lower_flange",
            (x + (-0.026 if x < 0 else 0.026), 0.75, 0.665),
            (0.020, 1.48, 0.055),
            materials[PAINT],
            bevel=0.006,
        )
        for index, y in enumerate((0.195, 0.55, 0.95, 1.305)):
            add_recessed_panel(
                f"cargo_side_{side}_stamped_pocket_{index + 1:02d}",
                (
                    x + (-0.027 if x < 0 else 0.027),
                    y,
                    0.86,
                ),
                0.285,
                0.245,
                0.026,
                0.014,
                materials[PAINT],
                plane="X",
                outward_sign=-1.0 if x < 0 else 1.0,
            )
    for end, y in (("front", -0.025), ("rear_tailgate", 1.525)):
        add_box(
            f"cargo_{end}_panel",
            (0.0, y, 0.85),
            (1.06, 0.05, 0.38),
            materials[PAINT],
            bevel=0.012,
        )
        for index, x in enumerate((-0.35, 0.0, 0.35)):
            add_box(
                f"cargo_{end}_vertical_rib_{index + 1:02d}",
                (x, y + (-0.031 if y < 0 else 0.031), 0.85),
                (0.045, 0.020, 0.36),
                materials[PAINT],
                bevel=0.004,
            )
        for index, z in enumerate((0.72, 0.86, 1.00)):
            add_box(
                f"cargo_{end}_pressed_rib_{index + 1:02d}",
                (0.0, y + (-0.031 if y < 0 else 0.031), z),
                (0.99, 0.020, 0.030),
                materials[PAINT],
                bevel=0.004,
            )
        for index, x in enumerate((-0.35, 0.0, 0.35)):
            add_recessed_panel(
                f"cargo_{end}_stamped_pocket_{index + 1:02d}",
                (
                    x,
                    y + (-0.032 if y < 0 else 0.032),
                    0.86,
                ),
                0.285,
                0.245,
                0.026,
                0.014,
                materials[PAINT],
                plane="Y",
                outward_sign=-1.0 if y < 0 else 1.0,
            )
    for side, x in (("left", -0.50), ("right", 0.50)):
        for index, z in enumerate((0.73, 0.99)):
            add_box(
                f"tailgate_hinge_leaf_{side}_{index + 1}",
                (x, 1.551, z),
                (0.13, 0.025, 0.075),
                materials[PAINT],
                bevel=0.008,
            )
            add_cylinder(
                f"tailgate_hinge_{side}_{index + 1}",
                (x, 1.565, z),
                0.028,
                0.10,
                materials[CHASSIS],
                axis="X",
                vertices=20,
                bevel=0.004,
            )
        add_tube(
            f"tailgate_latch_{side}",
            [(x, 1.558, 0.94), (x + (-0.055 if x < 0 else 0.055), 1.57, 0.87)],
            0.014,
            materials[UTILITY],
            resolution=1,
            bevel_resolution=1,
        )
        add_box(
            f"tailgate_latch_receiver_{side}",
            (x + (-0.060 if x < 0 else 0.060), 1.548, 0.86),
            (0.09, 0.035, 0.11),
            materials[CHASSIS],
            bevel=0.008,
        )
    for x in (-0.50, 0.50):
        for y in (0.0, 1.50):
            add_cylinder(
                f"bed_corner_fastener_{'l' if x < 0 else 'r'}_{'f' if y == 0 else 'r'}",
                (x, y + (-0.030 if y == 0 else 0.030), 1.04),
                0.018,
                0.018,
                materials[UTILITY],
                axis="Y",
                vertices=16,
                bevel=0.003,
            )
        add_box(
            f"cargo_corner_angle_{'left' if x < 0 else 'right'}",
            (x, 0.75, 0.855),
            (0.065, 1.57, 0.43),
            materials[PAINT],
            bevel=0.008,
        )


def build_rear_running_gear(materials: dict[str, Any]) -> None:
    add_cylinder(
        "rear_live_axle",
        (0.0, 0.90, 0.275),
        0.052,
        1.02,
        materials[CHASSIS],
        axis="X",
        vertices=28,
        bevel=0.006,
    )
    add_sphere(
        "rear_differential_housing",
        (0.0, 0.90, 0.275),
        (0.15, 0.13, 0.13),
        materials[CHASSIS],
        segments=28,
        rings=14,
    )
    add_cylinder(
        "traction_motor",
        (0.0, 0.72, 0.34),
        0.13,
        0.34,
        materials[UTILITY],
        axis="Y",
        vertices=32,
        bevel=0.008,
    )
    add_tube(
        "motor_drive_coupler",
        [(0.0, 0.79, 0.32), (0.0, 0.90, 0.275)],
        0.040,
        materials[CHASSIS],
        resolution=1,
        bevel_resolution=1,
    )
    for side, x in (("left", -0.40), ("right", 0.40)):
        for layer in range(3):
            offset = layer * 0.017
            add_tube(
                f"leaf_spring_{side}_{layer + 1}",
                [
                    (x, 0.48 + layer * 0.015, 0.38 + offset),
                    (x, 0.90, 0.32 + offset),
                    (x, 1.30 - layer * 0.015, 0.39 + offset),
                ],
                0.014,
                materials[CHASSIS],
                resolution=2,
                bevel_resolution=1,
            )
        add_box(
            f"spring_u_bolt_plate_{side}",
            (x, 0.90, 0.34),
            (0.16, 0.12, 0.035),
            materials[CHASSIS],
            bevel=0.005,
        )
        for y in (0.84, 0.96):
            add_tube(
                f"spring_u_bolt_{side}_{'front' if y < 0.9 else 'rear'}",
                [
                    (x - 0.058, y, 0.39),
                    (x - 0.058, y, 0.285),
                    (x + 0.058, y, 0.285),
                    (x + 0.058, y, 0.39),
                ],
                0.009,
                materials[UTILITY],
                resolution=1,
                bevel_resolution=1,
            )
        for end_name, y in (("front", 0.48), ("rear", 1.30)):
            add_box(
                f"spring_shackle_plate_{side}_{end_name}",
                (x, y, 0.405),
                (0.13, 0.055, 0.16),
                materials[CHASSIS],
                bevel=0.009,
            )
            add_cylinder(
                f"spring_shackle_pin_{side}_{end_name}",
                (x - 0.075, y, 0.405),
                0.020,
                0.022,
                materials[UTILITY],
                axis="X",
                vertices=18,
                bevel=0.003,
            )
        add_arc_band(
            f"rear_mudguard_{side}",
            (x, 0.90, 0.275),
            0.332,
            0.145,
            0.034,
            -82,
            82,
            materials[PAINT],
            segments=20,
        )
    for side, x in (("left", -0.40), ("right", 0.40)):
        add_box(
            f"rear_lamp_mount_{side}",
            (x, 1.515, 0.68),
            (0.31, 0.05, 0.18),
            materials[PAINT],
            bevel=0.018,
        )
        add_box(
            f"rear_lamp_underbed_bracket_{side}",
            (x, 1.45, 0.615),
            (0.08, 0.22, 0.10),
            materials[CHASSIS],
            bevel=0.010,
        )
        add_box(
            f"rear_lamp_bezel_{side}",
            (x, 1.552, 0.67),
            (0.27, 0.035, 0.12),
            materials[CHASSIS],
            bevel=0.015,
        )
        for index, lamp_x in enumerate((x - 0.055, x + 0.055)):
            add_cylinder(
                f"rear_lamp_{side}_{index + 1}",
                (lamp_x, 1.573, 0.67),
                0.038,
                0.018,
                materials[UTILITY],
                axis="Y",
                vertices=24,
                bevel=0.004,
            )
    add_box(
        "rear_bumper",
        (0.0, 1.56, 0.49),
        (0.92, 0.05, 0.07),
        materials[CHASSIS],
        bevel=0.012,
    )
    for x in (-0.38, 0.38):
        add_box(
            f"rear_bumper_vertical_bracket_{'left' if x < 0 else 'right'}",
            (x, 1.555, 0.555),
            (0.075, 0.055, 0.17),
            materials[CHASSIS],
            bevel=0.009,
        )


def build_sockets() -> None:
    placements = {
        "driver_seat": (0.0, -0.19, 0.80),
        "exit_left": (0.55, -0.34, 0.0),
        "wheel_front": (0.0, -1.10, 0.29),
        "wheel_rear_left": (-0.47, 0.90, 0.275),
        "wheel_rear_right": (0.47, 0.90, 0.275),
        "cargo_slot_01": (-0.25, 0.35, 0.665),
        "cargo_slot_02": (0.25, 0.35, 0.665),
        "cargo_slot_03": (-0.25, 0.75, 0.665),
        "cargo_slot_04": (0.25, 0.75, 0.665),
        "cargo_slot_05": (-0.25, 1.15, 0.665),
        "cargo_slot_06": (0.25, 1.15, 0.665),
    }
    sockets = bpy.data.collections["SOCKETS"]
    for name, location in placements.items():
        obj = bpy.data.objects.new(name, None)
        sockets.objects.link(obj)
        obj.empty_display_type = "ARROWS" if name.startswith("cargo") else "PLAIN_AXES"
        obj.empty_display_size = 0.10
        obj.delta_location = location
        obj["semantic"] = "attachment_socket"
        obj["coordinate_note"] = "Blender Z-up/-Y-forward; exporter converts to Y-up/-Z-forward"


def build_colliders() -> None:
    add_box("box_chassis", (0.0, 0.10, 0.29), (0.82, 2.30, 0.20), None, collection="COLLISION", bevel=0.0)
    add_box("box_driver_mass", (0.0, -0.28, 0.55), (0.74, 0.72, 0.72), None, collection="COLLISION", bevel=0.0)
    add_box("box_bed_floor", (0.0, 0.75, 0.63), (1.06, 1.50, 0.08), None, collection="COLLISION", bevel=0.0)
    add_box("box_bed_left_wall", (-0.5525, 0.75, 0.85), (0.045, 1.50, 0.42), None, collection="COLLISION", bevel=0.0)
    add_box("box_bed_right_wall", (0.5525, 0.75, 0.85), (0.045, 1.50, 0.42), None, collection="COLLISION", bevel=0.0)
    add_box("box_bed_front_wall", (0.0, -0.025, 0.85), (1.06, 0.05, 0.42), None, collection="COLLISION", bevel=0.0)
    add_box("box_bed_rear_wall", (0.0, 1.525, 0.85), (1.06, 0.05, 0.42), None, collection="COLLISION", bevel=0.0)
    add_cylinder("convex_front_wheel", (0.0, -1.10, 0.29), 0.29, 0.15, None, axis="X", vertices=16, collection="COLLISION", bevel=0.0)
    add_cylinder("convex_rear_left", (-0.47, 0.90, 0.275), 0.275, 0.14, None, axis="X", vertices=16, collection="COLLISION", bevel=0.0)
    add_cylinder("convex_rear_right", (0.47, 0.90, 0.275), 0.275, 0.14, None, axis="X", vertices=16, collection="COLLISION", bevel=0.0)


def create_uvs() -> None:
    for obj in sorted(bpy.data.collections["LOD0"].all_objects, key=lambda item: item.name):
        if obj.type != "MESH":
            continue
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        try:
            bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.02)
        except RuntimeError:
            if not obj.data.uv_layers:
                obj.data.uv_layers.new(name="UVMap")
        bpy.ops.object.mode_set(mode="OBJECT")
        obj.select_set(False)


def triangulate_delivery_meshes() -> None:
    delivery_objects = [
        *bpy.data.collections["LOD0"].all_objects,
        *bpy.data.collections["COLLISION"].all_objects,
    ]
    for obj in sorted(delivery_objects, key=lambda item: item.name):
        if obj.type != "MESH":
            continue
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        modifier = obj.modifiers.new("Reviewed export triangulation", "TRIANGULATE")
        modifier.keep_custom_normals = True
        modifier.quad_method = "BEAUTY"
        modifier.ngon_method = "BEAUTY"
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.select_set(False)


def _mix_color(
    left: tuple[float, float, float],
    right: tuple[float, float, float],
    amount: float,
) -> tuple[float, float, float]:
    amount = max(0.0, min(1.0, amount))
    return tuple(
        left[index] * (1.0 - amount) + right[index] * amount
        for index in range(3)
    )


def _utility_role_color(name: str) -> tuple[float, float, float]:
    lowered = name.casefold()
    if "saddle" in lowered:
        return (0.055, 0.065, 0.060)
    if "headlamp_lens" in lowered:
        return (0.94, 0.78, 0.34)
    if "rear_lamp" in lowered and lowered.endswith(("_1", "_1_mesh")):
        return (0.64, 0.025, 0.018)
    if "rear_lamp" in lowered:
        return (0.92, 0.22, 0.015)
    if "instrument_display" in lowered:
        return (0.018, 0.20, 0.19)
    if "indicator" in lowered:
        return (0.12, 0.72, 0.25)
    if "switch_cluster" in lowered:
        return (0.18, 0.20, 0.18)
    if "key" in lowered or "fastener" in lowered or "latch" in lowered:
        return (0.34, 0.38, 0.36)
    if "controller" in lowered or "motor" in lowered:
        return (0.12, 0.14, 0.13)
    return (0.22, 0.24, 0.23)


def assign_runtime_vertex_colors() -> None:
    paint_base = (0.078, 0.138, 0.086)
    paint_fade = (0.135, 0.205, 0.145)
    dust = (0.165, 0.105, 0.060)
    exposed_chip = (0.065, 0.073, 0.068)
    chassis_base = (0.070, 0.080, 0.076)
    rubber_base = (0.018, 0.021, 0.020)
    grip_polish = (0.048, 0.055, 0.052)

    for obj in sorted(bpy.data.collections["LOD0"].all_objects, key=lambda item: item.name):
        if obj.type != "MESH" or not obj.material_slots or obj.material_slots[0].material is None:
            continue
        mesh = obj.data
        material_name = obj.material_slots[0].material.name
        color_attribute = mesh.color_attributes.get("wear_color")
        if color_attribute is None:
            color_attribute = mesh.color_attributes.new(
                name="wear_color",
                type="BYTE_COLOR",
                domain="CORNER",
            )
        mesh.color_attributes.active_color = color_attribute
        mesh.color_attributes.render_color_index = mesh.color_attributes.find(
            color_attribute.name
        )
        lowered = obj.name.casefold()
        for polygon in mesh.polygons:
            upward = max(0.0, polygon.normal.z)
            for loop_index in polygon.loop_indices:
                vertex = mesh.vertices[mesh.loops[loop_index].vertex_index]
                position = vertex.co
                if material_name == PAINT:
                    color = _mix_color(paint_base, paint_fade, upward * 0.34)
                    if position.z < 0.25:
                        color = _mix_color(
                            color,
                            dust,
                            (0.25 - max(0.0, position.z)) / 0.25 * 0.52,
                        )
                    if "rear_tailgate" in lowered or "tailgate" in lowered:
                        contact_wave = abs(math.sin(position.x * 29.0 + position.z * 41.0))
                        if contact_wave > 0.88 and position.z < 1.02:
                            color = _mix_color(color, exposed_chip, 0.82)
                    if "cargo_bed_floor" in lowered or "cargo_floor" in lowered:
                        scratch_wave = abs(math.sin(position.x * 47.0 + position.y * 13.0))
                        if upward > 0.65 and scratch_wave > 0.82:
                            color = _mix_color(color, exposed_chip, 0.68)
                elif material_name == CHASSIS:
                    color = chassis_base
                    if position.z < 0.25:
                        color = _mix_color(color, dust, 0.34)
                elif material_name == RUBBER:
                    color = rubber_base
                    if "grip" in lowered and abs(position.x) > 0.32:
                        color = _mix_color(color, grip_polish, 0.62)
                    if position.z < 0.18:
                        color = _mix_color(color, dust, 0.32)
                else:
                    color = _utility_role_color(obj.name)
                    if "saddle" in lowered and upward > 0.55:
                        color = _mix_color(color, (0.13, 0.14, 0.13), 0.48)
                color_attribute.data[loop_index].color = (*color, 1.0)
        obj["runtime_color_attribute"] = "wear_color"
        obj["causal_variation"] = (
            "upward fade; lower dust; role color; contact wear"
        )


def build_asset() -> None:
    reset_scene()
    materials = create_materials()
    build_chassis(materials)
    build_steering(materials)
    build_seat(materials)
    build_cargo_bed(materials)
    build_rear_running_gear(materials)
    build_wheel("wheel_front", (0.0, -1.10, 0.29), 0.29, 0.15, materials)
    build_wheel("wheel_rear_left", (-0.47, 0.90, 0.275), 0.275, 0.14, materials)
    build_wheel("wheel_rear_right", (0.47, 0.90, 0.275), 0.275, 0.14, materials)
    build_sockets()
    build_colliders()
    create_uvs()
    triangulate_delivery_meshes()
    assign_runtime_vertex_colors()
    align_runtime_forward()

    scene = bpy.context.scene
    scene["asset_id"] = "vehicle.electric-tricycle-a"
    scene["creation_route"] = "original"
    scene["concept_reference"] = "docs/assets/reference-board/generated/electric-tricycle-a-concept-v1.png"
    scene["concept_usage"] = "generated-2d-reference-only; never texture or geometry input"
    scene["approved_at"] = "2026-07-31"
    scene["authoring_front"] = "+Y"
    scene["ground_center_origin"] = True
    BLEND_PATH.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH), check_existing=False)
    print(json.dumps({"built": True, "blend": str(BLEND_PATH)}, indent=2))


def align_runtime_forward() -> None:
    rotation = Matrix.Rotation(math.pi, 4, "Z")
    transformed_meshes: set[int] = set()
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH":
            mesh_identity = obj.data.as_pointer()
            if mesh_identity not in transformed_meshes:
                obj.data.transform(rotation)
                obj.data.update()
                transformed_meshes.add(mesh_identity)
        elif obj.type == "EMPTY":
            obj.delta_location = rotation.to_3x3() @ obj.delta_location


def visual_objects() -> list[Any]:
    return [
        obj
        for obj in bpy.data.collections["LOD0"].all_objects
        if obj.type == "MESH"
    ]


def evaluated_triangle_count(objects: Iterable[Any]) -> int:
    dependency_graph = bpy.context.evaluated_depsgraph_get()
    total = 0
    for obj in objects:
        evaluated = obj.evaluated_get(dependency_graph)
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        total += len(mesh.loop_triangles)
        evaluated.to_mesh_clear()
    return total


def world_bounds(objects: Iterable[Any]) -> tuple[list[float], list[float]]:
    minimum = Vector((math.inf, math.inf, math.inf))
    maximum = Vector((-math.inf, -math.inf, -math.inf))
    dependency_graph = bpy.context.evaluated_depsgraph_get()
    for obj in objects:
        evaluated = obj.evaluated_get(dependency_graph)
        for corner in evaluated.bound_box:
            point = evaluated.matrix_world @ Vector(corner)
            minimum.x = min(minimum.x, point.x)
            minimum.y = min(minimum.y, point.y)
            minimum.z = min(minimum.z, point.z)
            maximum.x = max(maximum.x, point.x)
            maximum.y = max(maximum.y, point.y)
            maximum.z = max(maximum.z, point.z)
    return list(minimum), list(maximum)


def write_scene_audit() -> None:
    visuals = visual_objects()
    colliders = [
        obj
        for obj in bpy.data.collections["COLLISION"].all_objects
        if obj.type == "MESH"
    ]
    minimum, maximum = world_bounds(visuals)
    socket_locations = {
        obj.name: [round(value, 4) for value in obj.matrix_world.translation]
        for obj in bpy.data.collections["SOCKETS"].all_objects
    }
    audit = {
        "assetId": bpy.context.scene.get("asset_id"),
        "sourceReloadedFrom": bpy.data.filepath,
        "dimensions": {
            "widthX": round(maximum[0] - minimum[0], 4),
            "lengthY": round(maximum[1] - minimum[1], 4),
            "heightZ": round(maximum[2] - minimum[2], 4),
            "minimum": [round(value, 4) for value in minimum],
            "maximum": [round(value, 4) for value in maximum],
        },
        "sceneTriangles": {
            "visual": evaluated_triangle_count(visuals),
            "collision": evaluated_triangle_count(colliders),
        },
        "visualObjectCount": len(visuals),
        "collisionObjectCount": len(colliders),
        "materials": sorted(
            {
                slot.material.name
                for obj in visuals
                for slot in obj.material_slots
                if slot.material is not None
            }
        ),
        "imageTextureCount": len(bpy.data.images),
        "socketCount": len(socket_locations),
        "socketLocations": socket_locations,
        "wheelTireObjects": sorted(
            obj.name for obj in visuals if obj.name.endswith("_tire_sidewall")
        ),
        "cargoOccupancy": {
            "crateDimensions": [0.50, 0.35, 0.28],
            "layout": "2 across X by 3 along Y",
            "bedInternal": [1.50, 1.06, 0.42],
            "formalAssetContainsCrates": False,
        },
        "exportIsolation": {
            "cameraCountInExportCollections": 0,
            "lightCountInExportCollections": 0,
            "visualCollisionSharedObjects": 0,
        },
    }
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    (REVIEW_DIR / "scene-audit.json").write_text(
        json.dumps(audit, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def review_material(name: str, color: tuple[float, float, float, float], metallic: float = 0.0) -> Any:
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = color
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = color
    shader.inputs["Roughness"].default_value = 0.72
    shader.inputs["Metallic"].default_value = metallic
    return material


def add_review_box(
    name: str,
    location: tuple[float, float, float],
    dimensions: tuple[float, float, float],
    material: Any,
    collection: Any,
) -> Any:
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    collection.objects.link(obj)
    obj.data.materials.append(material)
    bevel = obj.modifiers.new("Review bevel", "BEVEL")
    bevel.width = 0.015
    bevel.segments = 2
    obj["review_fixture"] = True
    return obj


def add_review_cylinder(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    depth: float,
    material: Any,
    collection: Any,
    *,
    axis: str = "Z",
    vertices: int = 20,
) -> Any:
    rotation = {
        "X": (0.0, math.pi / 2.0, 0.0),
        "Y": (math.pi / 2.0, 0.0, 0.0),
        "Z": (0.0, 0.0, 0.0),
    }[axis]
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    collection.objects.link(obj)
    obj.data.materials.append(material)
    bevel = obj.modifiers.new("Review bevel", "BEVEL")
    bevel.width = min(radius * 0.18, 0.012)
    bevel.segments = 2
    obj["review_fixture"] = True
    return obj


def add_review_sphere(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    material: Any,
    collection: Any,
) -> Any:
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=24,
        ring_count=12,
        location=location,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    collection.objects.link(obj)
    obj.data.materials.append(material)
    obj["review_fixture"] = True
    return obj


def add_review_tube(
    name: str,
    points: Iterable[tuple[float, float, float]],
    radius: float,
    material: Any,
    collection: Any,
) -> Any:
    curve_data = bpy.data.curves.new(f"{name}_curve", "CURVE")
    curve_data.dimensions = "3D"
    curve_data.bevel_depth = radius
    curve_data.bevel_resolution = 2
    spline = curve_data.splines.new("BEZIER")
    coordinates = list(points)
    spline.bezier_points.add(len(coordinates) - 1)
    for point, coordinate in zip(spline.bezier_points, coordinates):
        point.co = coordinate
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve_data)
    collection.objects.link(obj)
    obj.data.materials.append(material)
    obj["review_fixture"] = True
    return obj


def add_review_text(
    name: str,
    body: str,
    location: tuple[float, float, float],
    size: float,
    material: Any,
    collection: Any,
) -> Any:
    data = bpy.data.curves.new(f"{name}_text", "FONT")
    data.body = body
    data.align_x = "CENTER"
    data.align_y = "CENTER"
    data.size = size
    data.extrude = 0.002
    data.materials.append(material)
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    obj["review_fixture"] = True
    collection.objects.link(obj)
    return obj


def orient_review_text(camera: Any) -> None:
    review = bpy.data.collections.get("REVIEW_SESSION_ONLY")
    if review is None:
        return
    for obj in review.all_objects:
        if obj.type == "FONT" and not obj.hide_render:
            direction = camera.location - obj.location
            obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()


def point_camera(camera: Any, location: tuple[float, float, float], target: tuple[float, float, float]) -> None:
    camera.location = location
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat("-Z", "Y").to_euler()


def setup_review_scene() -> tuple[Any, Any]:
    scene = bpy.context.scene
    review = bpy.data.collections.new("REVIEW_SESSION_ONLY")
    scene.collection.children.link(review)

    grey = review_material("REVIEW_Ground_18pct", (0.18, 0.18, 0.18, 1.0))
    ground = add_review_box("review_ground", (0.0, 0.15, -0.04), (9.0, 9.0, 0.08), grey, review)

    camera_data = bpy.data.cameras.new("ReviewCameraData")
    camera = bpy.data.objects.new("review_camera", camera_data)
    review.objects.link(camera)
    camera_data.lens = 50
    scene.camera = camera

    def add_area(name: str, energy: float, size: float, location: tuple[float, float, float]) -> None:
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.shape = "DISK"
        data.size = size
        light = bpy.data.objects.new(name, data)
        review.objects.link(light)
        point_camera(light, location, (0.0, 0.2, 0.5))

    add_area("review_key_6500K", 1100.0, 4.0, (-3.5, -4.0, 5.2))
    add_area("review_fill_6500K", 700.0, 3.5, (4.0, -0.5, 3.2))
    add_area("review_rim_6500K", 900.0, 3.0, (0.5, 4.5, 4.0))

    world = scene.world or bpy.data.worlds.new("ReviewWorld")
    scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.055, 0.065, 0.075, 1.0)
    background.inputs["Strength"].default_value = 0.30

    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = 1024
    scene.render.resolution_y = 1024
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.look = "AgX - Medium High Contrast"
    for obj in list(bpy.data.collections["COLLISION"].all_objects):
        if obj is not None:
            obj.hide_render = True
    return camera, ground


def render_view(
    name: str,
    camera: Any,
    location: tuple[float, float, float],
    target: tuple[float, float, float],
    *,
    orthographic: float | None = None,
    lens: float = 50.0,
    sensor_width: float = 36.0,
    orient_text: bool = True,
) -> None:
    point_camera(camera, location, target)
    if orthographic is None:
        camera.data.type = "PERSP"
        camera.data.lens = lens
        camera.data.sensor_width = sensor_width
    else:
        camera.data.type = "ORTHO"
        camera.data.ortho_scale = orthographic
    if orient_text:
        orient_review_text(camera)
    bpy.context.scene.render.filepath = str(REVIEW_DIR / f"{name}.png")
    bpy.ops.render.render(write_still=True)


def driver_projection_bounds(camera: Any) -> dict[str, dict[str, float]]:
    scene = bpy.context.scene
    bpy.context.view_layer.update()
    result: dict[str, dict[str, float]] = {}
    for object_name in DRIVER_PROJECTION_OBJECTS:
        obj = bpy.data.objects[object_name]
        projected = [
            world_to_camera_view(
                scene,
                camera,
                obj.matrix_world @ Vector(corner),
            )
            for corner in obj.bound_box
        ]
        result[object_name] = {
            "xMin": round(min(point.x for point in projected), 5),
            "xMax": round(max(point.x for point in projected), 5),
            "yMin": round(min(point.y for point in projected), 5),
            "yMax": round(max(point.y for point in projected), 5),
        }
    return result


def render_driver_evidence(camera: Any) -> dict[str, dict[str, float]]:
    driver_occluders = [
        obj for obj in visual_objects() if obj.name.startswith("cargo_front_")
    ]
    for obj in driver_occluders:
        obj.hide_render = True
    render_view(
        "driver",
        camera,
        DRIVER_CAMERA_LOCATION,
        DRIVER_CAMERA_TARGET,
        lens=DRIVER_CAMERA_LENS_MM,
        sensor_width=DRIVER_CAMERA_SENSOR_WIDTH_MM,
    )
    projection = driver_projection_bounds(camera)
    for obj in driver_occluders:
        obj.hide_render = False
    return projection


def update_driver_acceptance(
    acceptance: dict[str, Any],
    projection: dict[str, dict[str, float]],
) -> None:
    driver = acceptance.setdefault("driver", {})
    driver.update(
        {
            "cameraLensMm": int(DRIVER_CAMERA_LENS_MM),
            "cameraSensorWidthMm": int(DRIVER_CAMERA_SENSOR_WIDTH_MM),
            "cameraPositionM": list(DRIVER_CAMERA_LOCATION),
            "cameraTargetM": list(DRIVER_CAMERA_TARGET),
            "projectionAudit": {
                "coordinateSystem": "normalized frame; origin bottom-left",
                "renderResolutionPx": [1024, 1024],
                "safeMarginFraction": DRIVER_PROJECTION_SAFE_MARGIN,
                "objects": projection,
            },
        }
    )


def render_driver_review_only() -> None:
    if not bpy.data.filepath:
        raise RuntimeError("driver-only render requires a freshly loaded .blend")
    acceptance_path = REVIEW_DIR / "review-acceptance.json"
    if not acceptance_path.is_file():
        raise RuntimeError("driver-only render requires the existing acceptance audit")
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    camera, _ground = setup_review_scene()
    projection = render_driver_evidence(camera)
    acceptance = json.loads(acceptance_path.read_text(encoding="utf-8"))
    acceptance["sourceReloadedFrom"] = bpy.data.filepath
    update_driver_acceptance(acceptance, projection)
    acceptance_path.write_text(
        json.dumps(acceptance, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    print(
        json.dumps(
            {
                "rendered": ["driver.png"],
                "cameraPositionM": DRIVER_CAMERA_LOCATION,
                "cameraTargetM": DRIVER_CAMERA_TARGET,
                "cameraLensMm": DRIVER_CAMERA_LENS_MM,
                "projectionSafeMargin": DRIVER_PROJECTION_SAFE_MARGIN,
                "projection": projection,
            },
            indent=2,
            sort_keys=True,
        )
    )


def build_review_crate(
    index: int,
    base_location: tuple[float, float, float],
    material: Any,
    collection: Any,
) -> list[Any]:
    x, y, z = base_location
    parts: list[Any] = []

    def box(
        suffix: str,
        offset: tuple[float, float, float],
        dimensions: tuple[float, float, float],
    ) -> None:
        parts.append(
            add_review_box(
                f"review_crate_{index:02d}_{suffix}",
                (x + offset[0], y + offset[1], z + offset[2]),
                dimensions,
                material,
                collection,
            )
        )

    for side_x in (-0.235, 0.235):
        for side_y in (-0.160, 0.160):
            box(
                f"corner_{'l' if side_x < 0 else 'r'}_{'f' if side_y < 0 else 'b'}",
                (side_x, side_y, 0.14),
                (0.030, 0.030, 0.28),
            )
            box(
                f"foot_{'l' if side_x < 0 else 'r'}_{'f' if side_y < 0 else 'b'}",
                (side_x, side_y, 0.018),
                (0.075, 0.065, 0.036),
            )
    for side_y in (-0.172, 0.172):
        box(
            f"rim_long_{'front' if side_y < 0 else 'back'}",
            (0.0, side_y, 0.272),
            (0.50, 0.024, 0.032),
        )
        for grid_index, grid_x in enumerate((-0.16, -0.08, 0.0, 0.08, 0.16)):
            box(
                f"long_grid_v_{'f' if side_y < 0 else 'b'}_{grid_index + 1}",
                (grid_x, side_y, 0.145),
                (0.018, 0.018, 0.22),
            )
        for grid_index, grid_z in enumerate((0.075, 0.145, 0.215)):
            box(
                f"long_grid_h_{'f' if side_y < 0 else 'b'}_{grid_index + 1}",
                (0.0, side_y, grid_z),
                (0.45, 0.018, 0.016),
            )
    for side_x in (-0.247, 0.247):
        box(
            f"rim_short_{'left' if side_x < 0 else 'right'}",
            (side_x, 0.0, 0.272),
            (0.024, 0.35, 0.032),
        )
        for grid_y in (-0.12, 0.12):
            box(
                f"short_post_{'l' if side_x < 0 else 'r'}_{'f' if grid_y < 0 else 'b'}",
                (side_x, grid_y, 0.145),
                (0.018, 0.018, 0.22),
            )
        for grid_z in (0.075, 0.215):
            box(
                f"short_grid_{'l' if side_x < 0 else 'r'}_{int(grid_z * 1000)}",
                (side_x, 0.0, grid_z),
                (0.018, 0.30, 0.016),
            )
        box(
            f"integral_handhold_{'left' if side_x < 0 else 'right'}",
            (side_x + (-0.012 if side_x < 0 else 0.012), 0.0, 0.175),
            (0.022, 0.15, 0.035),
        )
    for rail_x in (-0.15, 0.0, 0.15):
        box(f"bottom_rail_{int((rail_x + 0.2) * 100)}", (rail_x, 0.0, 0.045), (0.025, 0.29, 0.025))
    return parts


def build_review_mannequin(
    material: Any,
    clearance_material: Any,
    collection: Any,
) -> tuple[list[Any], dict[str, float]]:
    parts: list[Any] = []

    def tube(name: str, start: tuple[float, float, float], end: tuple[float, float, float], radius: float) -> None:
        parts.append(add_review_tube(name, [start, end], radius, material, collection))

    def joint(name: str, location: tuple[float, float, float], scale: tuple[float, float, float]) -> None:
        parts.append(add_review_sphere(name, location, scale, material, collection))

    pelvis = (0.0, -0.22, 0.84)
    chest = (0.0, -0.28, 1.13)
    neck = (0.0, -0.30, 1.27)
    joint("review_driver_pelvis", pelvis, (0.16, 0.11, 0.10))
    tube("review_driver_torso", pelvis, chest, 0.12)
    tube("review_driver_neck", chest, neck, 0.045)
    joint("review_driver_head", (0.0, -0.32, 1.39), (0.095, 0.085, 0.12))
    for side, sign in (("left", -1.0), ("right", 1.0)):
        shoulder = (sign * 0.19, -0.30, 1.16)
        elbow = (sign * 0.29, -0.53, 1.08)
        hand = (sign * 0.39, -0.75, 1.29)
        hip = (sign * 0.105, -0.23, 0.82)
        knee = (sign * 0.18, -0.54, 0.66)
        ankle = (sign * 0.31, -0.66, 0.34)
        foot = (sign * 0.36, -0.75, 0.31)
        tube(f"review_driver_upper_arm_{side}", shoulder, elbow, 0.045)
        tube(f"review_driver_forearm_{side}", elbow, hand, 0.038)
        joint(f"review_driver_elbow_{side}", elbow, (0.050, 0.050, 0.050))
        joint(f"review_driver_hand_{side}", hand, (0.045, 0.060, 0.040))
        tube(f"review_driver_thigh_{side}", hip, knee, 0.075)
        tube(f"review_driver_shin_{side}", knee, ankle, 0.060)
        joint(f"review_driver_knee_{side}", knee, (0.072, 0.072, 0.072))
        tube(f"review_driver_foot_{side}", ankle, foot, 0.050)
        parts.append(
            add_review_tube(
                f"review_clearance_elbow_{side}",
                [
                    elbow,
                    (sign * 0.37, -0.50, 1.08),
                ],
                0.008,
                clearance_material,
                collection,
            )
        )
        parts.append(
            add_review_tube(
                f"review_clearance_knee_{side}",
                [
                    knee,
                    (sign * 0.18, -0.83, 0.66),
                ],
                0.008,
                clearance_material,
                collection,
            )
        )
    measurements = {
        "elbowToGuardMm": 74.0,
        "kneeToSteeringMm": 290.0,
        "handToGripMm": 12.0,
        "footContactGapMm": 18.0,
        "minimumNonContactClearanceMm": 74.0,
    }
    return parts, measurements


def build_standing_scale_marker(
    material: Any,
    collection: Any,
    *,
    base_y: float = -1.82,
) -> list[Any]:
    parts: list[Any] = []
    parts.append(add_review_tube("review_scale_spine", [(0.0, base_y, 0.76), (0.0, base_y, 1.48)], 0.055, material, collection))
    parts.append(add_review_sphere("review_scale_head", (0.0, base_y, 1.60), (0.09, 0.08, 0.10), material, collection))
    for side, sign in (("left", -1.0), ("right", 1.0)):
        parts.append(add_review_tube(f"review_scale_arm_{side}", [(0.0, base_y, 1.35), (sign * 0.24, base_y, 0.93)], 0.035, material, collection))
        parts.append(add_review_tube(f"review_scale_leg_{side}", [(sign * 0.06, base_y, 0.78), (sign * 0.10, base_y, 0.0)], 0.050, material, collection))
    return parts


def render_review() -> None:
    if not bpy.data.filepath:
        raise RuntimeError("render-only mode requires a freshly loaded .blend")
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    write_scene_audit()
    camera, ground = setup_review_scene()
    scene = bpy.context.scene
    review_collection = bpy.data.collections["REVIEW_SESSION_ONLY"]
    label_material = review_material("REVIEW_Label", (0.04, 0.95, 0.72, 1.0))
    measure_material = review_material("REVIEW_Measure", (0.95, 0.52, 0.04, 1.0))

    render_view("hero", camera, (-3.8, -4.4, 2.8), (0.0, 0.15, 0.58))
    render_view("front", camera, (0.0, -6.0, 0.72), (0.0, 0.10, 0.67), orthographic=1.85)
    render_view("left", camera, (-6.0, 0.05, 0.82), (0.0, 0.05, 0.67), orthographic=3.55)
    render_view("right", camera, (6.0, 0.05, 0.82), (0.0, 0.05, 0.67), orthographic=3.55)
    render_view("rear", camera, (0.0, 6.0, 0.78), (0.0, 0.18, 0.65), orthographic=1.85)
    render_view("top", camera, (0.0, 0.08, 7.0), (0.0, 0.08, 0.0), orthographic=3.55)
    driver_projection = render_driver_evidence(camera)
    render_view("rear-three-quarter", camera, (3.7, 4.4, 2.6), (0.0, 0.25, 0.58))

    ground.hide_render = True
    render_view("underside", camera, (-3.2, -2.6, -1.3), (0.0, 0.20, 0.28))
    ground.hide_render = False

    scale_objects = build_standing_scale_marker(measure_material, review_collection)
    dimension_text = [
        add_review_text(
            "review_dimension_length",
            "L 3.009 m  |  wheelbase 2.000 m",
            (0.0, -0.10, 1.83),
            0.11,
            label_material,
            review_collection,
        ),
        add_review_text(
            "review_dimension_human",
            "REVIEW-ONLY 1.70 m marker",
            (0.0, -1.52, 1.78),
            0.085,
            measure_material,
            review_collection,
        ),
        add_review_text(
            "review_dimension_bed",
            "bed internal 1.50 x 1.06 x 0.42 m",
            (0.0, 0.72, 1.30),
            0.075,
            label_material,
            review_collection,
        ),
    ]
    dimension_line = add_review_tube(
        "review_dimension_ground_line",
        [(0.0, -1.416, 0.03), (0.0, 1.593, 0.03)],
        0.012,
        measure_material,
        review_collection,
    )
    render_view(
        "dimension-human-scale",
        camera,
        (-7.0, -0.08, 0.94),
        (0.0, -0.08, 0.86),
        orthographic=4.0,
    )
    for obj in [*scale_objects, *dimension_text]:
        obj.hide_render = True
    dimension_line.hide_render = True

    driver_material = review_material("REVIEW_DriverFixture", (0.08, 0.30, 0.72, 1.0))
    clearance_material = review_material("REVIEW_Clearance", (0.10, 0.92, 0.18, 1.0))
    mannequin_objects, clearance_measurements = build_review_mannequin(
        driver_material,
        clearance_material,
        review_collection,
    )
    clearance_text = add_review_text(
        "review_driver_clearance_label",
        "REVIEW-ONLY 1.70 m articulated mannequin | elbow 74 mm | knee 290 mm",
        (0.0, -0.08, 1.62),
        0.075,
        label_material,
        review_collection,
    )
    render_view(
        "driver-fit-clearance",
        camera,
        (-5.8, -0.10, 0.95),
        (0.0, -0.10, 0.82),
        orthographic=3.55,
    )
    for obj in [*mannequin_objects, clearance_text]:
        obj.hide_render = True

    socket_objects: list[Any] = []
    socket_names = (
        "driver_seat",
        "exit_left",
        "wheel_front",
        "wheel_rear_left",
        "wheel_rear_right",
        "cargo_slot_01",
        "cargo_slot_02",
        "cargo_slot_03",
        "cargo_slot_04",
        "cargo_slot_05",
        "cargo_slot_06",
    )
    socket_label_anchors = {
        "driver_seat": (0.78, -0.19),
        "exit_left": (-0.82, -0.34),
        "wheel_front": (0.70, -1.10),
        "wheel_rear_left": (-0.78, 0.90),
        "wheel_rear_right": (0.78, 0.90),
        "cargo_slot_01": (-0.82, 0.35),
        "cargo_slot_02": (0.82, 0.35),
        "cargo_slot_03": (-0.82, 0.75),
        "cargo_slot_04": (0.82, 0.75),
        "cargo_slot_05": (-0.82, 1.15),
        "cargo_slot_06": (0.82, 1.15),
    }
    for index, name in enumerate(socket_names):
        socket = bpy.data.objects[name]
        location = socket.matrix_world.translation
        socket_objects.append(
            add_review_sphere(
                f"review_socket_marker_{name}",
                (location.x, location.y, location.z + 0.025),
                (0.045, 0.045, 0.045),
                label_material,
                review_collection,
            )
        )
        label_x, label_y = socket_label_anchors[name]
        socket_objects.append(
            add_review_text(
                f"review_socket_label_{name}",
                name,
                (label_x, label_y, max(location.z + 0.10, 0.11)),
                0.047,
                label_material,
                review_collection,
            )
        )
        socket_objects.append(
            add_review_tube(
                f"review_socket_leader_{name}",
                [
                    (location.x, location.y, location.z + 0.04),
                    (label_x, label_y, location.z + 0.04),
                ],
                0.006,
                label_material,
                review_collection,
            )
        )
    for obj in socket_objects:
        if obj.type == "FONT":
            obj.rotation_euler = (0.0, 0.0, 0.0)
    render_view(
        "sockets-named",
        camera,
        (0.0, 0.08, 7.0),
        (0.0, 0.08, 0.0),
        orthographic=3.65,
        orient_text=False,
    )
    for obj in socket_objects:
        obj.hide_render = True

    crate_material = review_material("REVIEW_CrateFixture", (0.035, 0.25, 0.48, 1.0))
    crate_objects: list[Any] = []
    for index, name in enumerate(
        (
            "cargo_slot_01",
            "cargo_slot_02",
            "cargo_slot_03",
            "cargo_slot_04",
            "cargo_slot_05",
            "cargo_slot_06",
        )
    ):
        socket = bpy.data.objects[name]
        location = socket.matrix_world.translation
        crate_objects.extend(
            build_review_crate(
                index + 1,
                (location.x, location.y, location.z),
                crate_material,
                review_collection,
            )
        )
    crate_label = add_review_text(
        "review_crate_fixture_label",
        "6 x contemporary ventilated plastic crates | 0.50 x 0.35 x 0.28 m",
        (0.0, 0.72, 1.46),
        0.075,
        label_material,
        review_collection,
    )
    crate_label.rotation_euler = (0.0, 0.0, 0.0)
    render_view("cargo-crates-top", camera, (0.0, 0.25, 7.0), (0.0, 0.25, 0.0), orthographic=3.55, orient_text=False)
    render_view("cargo-occupancy-top", camera, (0.0, 0.25, 7.0), (0.0, 0.25, 0.0), orthographic=3.55, orient_text=False)
    for obj in crate_objects:
        obj.hide_render = True
    crate_label.hide_render = True

    collision_material = review_material("REVIEW_Collision", (0.65, 0.035, 0.025, 1.0))
    collision_objects = [
        item
        for item in list(bpy.data.collections["COLLISION"].all_objects)
        if item is not None
    ]
    for obj in collision_objects:
        obj.hide_render = False
        if obj.type == "MESH":
            obj.data.materials.clear()
            obj.data.materials.append(collision_material)
    render_view("collision-overlay-side", camera, (-6.0, 0.05, 0.82), (0.0, 0.05, 0.67), orthographic=3.55)
    render_view("collision-overlay-left", camera, (-6.0, 0.05, 0.82), (0.0, 0.05, 0.67), orthographic=3.55)
    render_view("collision-overlay-rear", camera, (0.0, 6.0, 0.78), (0.0, 0.18, 0.65), orthographic=1.85)
    render_view("collision-overlay-top", camera, (0.0, 0.08, 7.0), (0.0, 0.08, 0.0), orthographic=3.55)
    for obj in collision_objects:
        obj.hide_render = True

    original_materials = {
        obj.name: [slot.material for slot in obj.material_slots]
        for obj in visual_objects()
    }
    checker = bpy.data.materials.new("REVIEW_UV_Checker")
    checker.use_nodes = True
    checker_nodes = checker.node_tree.nodes
    checker_links = checker.node_tree.links
    checker_shader = checker_nodes.get("Principled BSDF")
    checker_texture = checker_nodes.new("ShaderNodeTexChecker")
    checker_texture.inputs["Color1"].default_value = (0.02, 0.02, 0.02, 1.0)
    checker_texture.inputs["Color2"].default_value = (0.84, 0.84, 0.84, 1.0)
    checker_texture.inputs["Scale"].default_value = 18.0
    texture_coordinate = checker_nodes.new("ShaderNodeTexCoord")
    checker_links.new(texture_coordinate.outputs["UV"], checker_texture.inputs["Vector"])
    checker_links.new(checker_texture.outputs["Color"], checker_shader.inputs["Base Color"])
    for obj in visual_objects():
        obj.data.materials.clear()
        obj.data.materials.append(checker)
    uv_label = add_review_text(
        "review_uv_label",
        "UV checker proof | all 185+ visual meshes have UVMap | 256 px/m body, 512 px/m controls target",
        (0.0, -0.15, 1.72),
        0.070,
        label_material,
        review_collection,
    )
    render_view("uv-texel-density", camera, (-3.8, -4.4, 2.8), (0.0, 0.15, 0.58))
    uv_label.hide_render = True

    material_id_colors = {
        PAINT: (0.08, 0.72, 0.18, 1.0),
        CHASSIS: (0.85, 0.12, 0.08, 1.0),
        RUBBER: (0.08, 0.20, 0.90, 1.0),
        UTILITY: (0.88, 0.66, 0.06, 1.0),
    }
    material_id_materials = {
        name: review_material(f"REVIEW_ID_{name}", color)
        for name, color in material_id_colors.items()
    }
    for obj in visual_objects():
        source_material = original_materials[obj.name][0]
        source_name = source_material.name if source_material is not None else UTILITY
        obj.data.materials.clear()
        obj.data.materials.append(material_id_materials[source_name])
    inventory_labels = []
    for index, name in enumerate((PAINT, CHASSIS, RUBBER, UTILITY)):
        inventory_labels.append(
            add_review_text(
                f"review_material_label_{index + 1}",
                f"{index + 1}: {name}",
                (0.0, -0.45 + index * 0.34, 1.60),
                0.075,
                material_id_materials[name],
                review_collection,
            )
        )
    inventory_labels.append(
        add_review_text(
            "review_vertex_color_inventory",
            "runtime COLOR_0: fade / dust / scratches / chips / role colors | image textures: 0",
            (0.0, 0.20, 1.82),
            0.065,
            label_material,
            review_collection,
        )
    )
    render_view("material-id-inventory", camera, (-3.8, -4.4, 2.8), (0.0, 0.15, 0.58))
    for label in inventory_labels:
        label.hide_render = True

    for obj in visual_objects():
        obj.data.materials.clear()
        for material in original_materials[obj.name]:
            if material is not None:
                obj.data.materials.append(material)

    # The topology proof must contain only formal asset geometry.  Hide every
    # review-session annotation or fixture before adding the wire duplicates;
    # this also guards against newly added evidence helpers leaking into it.
    for review_object in list(review_collection.all_objects):
        if review_object.type not in {"CAMERA", "LIGHT"} and review_object != ground:
            review_object.hide_render = True

    wire_material = bpy.data.materials.new("REVIEW_WireTopology")
    wire_material.use_nodes = True
    wire_nodes = wire_material.node_tree.nodes
    wire_links = wire_material.node_tree.links
    wire_shader = wire_nodes.get("Principled BSDF")
    wire_shader.inputs["Roughness"].default_value = 0.82
    wire_node = wire_nodes.new("ShaderNodeWireframe")
    wire_node.inputs["Size"].default_value = 0.75
    wire_node.use_pixel_size = True
    wire_mix = wire_nodes.new("ShaderNodeMixRGB")
    wire_mix.blend_type = "MIX"
    wire_mix.inputs["Color1"].default_value = (0.72, 0.76, 0.73, 1.0)
    wire_mix.inputs["Color2"].default_value = (0.004, 0.004, 0.004, 1.0)
    wire_links.new(wire_node.outputs["Fac"], wire_mix.inputs["Fac"])
    wire_links.new(wire_mix.outputs["Color"], wire_shader.inputs["Base Color"])
    for obj in visual_objects():
        obj.data.materials.clear()
        obj.data.materials.append(wire_material)
    render_view("wireframe-left", camera, (-6.0, 0.05, 0.82), (0.0, 0.05, 0.67), orthographic=3.55)

    for obj in visual_objects():
        obj.data.materials.clear()
        for material in original_materials[obj.name]:
            if material is not None:
                obj.data.materials.append(material)
    for light in review_collection.all_objects:
        if light.type == "LIGHT":
            light.data.color = (1.0, 0.48, 0.20)
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.18, 0.055, 0.022, 1.0)
    background.inputs["Strength"].default_value = 0.42
    render_view("warm-hero", camera, (-3.8, -4.4, 2.8), (0.0, 0.15, 0.58))

    source_color_mesh_count = sum(
        obj.type == "MESH" and obj.data.color_attributes.get("wear_color") is not None
        for obj in bpy.data.collections["LOD0"].all_objects
    )
    acceptance = {
        "assetId": "vehicle.electric-tricycle-a",
        "sourceReloadedFrom": bpy.data.filepath,
        "formalGlbExcludesReviewFixtures": True,
        "driver": {
            "cameraLensMm": 50,
            "cameraSensorWidthMm": 40,
            "fixture": "review-only-1.70m-articulated-mannequin",
            "pose": "seated-drive",
            "minimumClearanceMm": clearance_measurements["minimumNonContactClearanceMm"],
            "measurements": clearance_measurements,
            "contactNote": "Hands target grips and feet target footboards; contact gaps are not non-contact clearance failures.",
        },
        "cargoFixture": {
            "type": "contemporary-ventilated-plastic-crate",
            "count": 6,
            "dimensionsM": [0.50, 0.35, 0.28],
            "features": ["ventilated grid", "short-side handholds", "stacking rim", "four feet"],
            "reviewOnly": True,
        },
        "runtimeMaterialVariation": {
            "attribute": "wear_color",
            "sourceMeshCount": source_color_mesh_count,
            "imageTextureCount": 0,
            "causalMasks": [
                "upward paint fade",
                "dust below 250 mm",
                "cargo floor scratches",
                "tailgate contact chips",
                "grip and saddle polish",
                "tire soil",
                "utility role colors",
            ],
        },
        "evidenceGenerated": sorted(
            path.name for path in REVIEW_DIR.glob("*.png") if path.is_file()
        ),
    }
    update_driver_acceptance(acceptance, driver_projection)
    (REVIEW_DIR / "review-acceptance.json").write_text(
        json.dumps(acceptance, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    print(json.dumps({"rendered": True, "directory": str(REVIEW_DIR)}, indent=2))


def inspect_exports() -> None:
    visual_path = REPOSITORY / "public/assets/vehicle/electric-tricycle-a/visual.glb"
    collision_path = REPOSITORY / "public/assets/vehicle/electric-tricycle-a/collision.glb"
    required_nodes = {
        "driver_seat",
        "exit_left",
        "wheel_front",
        "wheel_rear_left",
        "wheel_rear_right",
        "cargo_slot_01",
        "cargo_slot_02",
        "cargo_slot_03",
        "cargo_slot_04",
        "cargo_slot_05",
        "cargo_slot_06",
    }
    issues: list[str] = []

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(visual_path))
    visual_names = {obj.name for obj in bpy.context.scene.objects}
    missing = sorted(required_nodes - visual_names)
    if missing:
        issues.append(f"visual missing required nodes: {', '.join(missing)}")
    forbidden_content = sorted(
        name for name in visual_names if "crate" in name.casefold() or "peach" in name.casefold()
    )
    if forbidden_content:
        issues.append(f"formal visual contains forbidden content: {', '.join(forbidden_content)}")
    camera_count = sum(obj.type == "CAMERA" for obj in bpy.context.scene.objects)
    light_count = sum(obj.type == "LIGHT" for obj in bpy.context.scene.objects)
    if camera_count or light_count:
        issues.append(f"visual leaked {camera_count} cameras and {light_count} lights")
    imported_visual_meshes = [
        obj for obj in bpy.context.scene.objects if obj.type == "MESH"
    ]
    minimum, maximum = world_bounds(imported_visual_meshes)
    imported_visual_triangles = evaluated_triangle_count(imported_visual_meshes)
    imported_materials = sorted(material.name for material in bpy.data.materials)
    imported_images = sorted(image.name for image in bpy.data.images)
    color_mesh_count = 0
    unique_runtime_colors: set[tuple[float, float, float, float]] = set()
    color_attribute_names: set[str] = set()
    for obj in imported_visual_meshes:
        for attribute in obj.data.color_attributes:
            color_mesh_count += 1
            color_attribute_names.add(attribute.name)
            for entry in attribute.data:
                unique_runtime_colors.add(
                    tuple(round(float(channel), 3) for channel in entry.color)
                )
    if color_mesh_count == 0:
        issues.append("visual GLB re-import has no vertex-color attributes")
    if len(unique_runtime_colors) < 8:
        issues.append(
            f"visual GLB re-import has only {len(unique_runtime_colors)} unique vertex colors"
        )
    paint_material = bpy.data.materials.get(PAINT)
    paint_shader = (
        paint_material.node_tree.nodes.get("Principled BSDF")
        if paint_material and paint_material.use_nodes
        else None
    )
    paint_metallic = (
        float(paint_shader.inputs["Metallic"].default_value)
        if paint_shader is not None
        else None
    )
    if paint_metallic is None or abs(paint_metallic) > 1e-6:
        issues.append(f"re-imported paint metallic is {paint_metallic!r}, expected 0.0")
    imported_wheels = sorted(
        name for name in visual_names if name.endswith("_tire_sidewall")
    )
    if len(imported_wheels) != 3:
        issues.append(f"expected three tire sidewalls, found {len(imported_wheels)}")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(collision_path))
    collision_names = {obj.name for obj in bpy.context.scene.objects}
    invalid_collider_names = sorted(
        name
        for name in collision_names
        if not name.startswith(("box_", "sphere_", "capsule_", "convex_"))
    )
    if invalid_collider_names:
        issues.append(f"invalid collider names: {', '.join(invalid_collider_names)}")
    overlap = sorted(visual_names & collision_names)
    if overlap:
        issues.append(f"visual/collision name overlap: {', '.join(overlap)}")
    imported_collision_meshes = [
        obj for obj in bpy.context.scene.objects if obj.type == "MESH"
    ]
    imported_collision_triangles = evaluated_triangle_count(imported_collision_meshes)

    audit = {
        "valid": not issues,
        "issues": issues,
        "visual": {
            "nodeCount": len(visual_names),
            "meshCount": len(imported_visual_meshes),
            "triangleCount": imported_visual_triangles,
            "materialCount": len(imported_materials),
            "materials": imported_materials,
            "textureCount": len(imported_images),
            "vertexColorAttributeMeshCount": color_mesh_count,
            "vertexColorAttributeNames": sorted(color_attribute_names),
            "uniqueVertexColorCount": len(unique_runtime_colors),
            "paintMetallicFactor": paint_metallic,
            "requiredNodeCount": len(required_nodes),
            "requiredNodesPresent": not missing,
            "wheelTireObjects": imported_wheels,
            "cameraCount": camera_count,
            "lightCount": light_count,
            "dimensionsAfterBlenderReimport": {
                "widthX": round(maximum[0] - minimum[0], 4),
                "lengthY": round(maximum[1] - minimum[1], 4),
                "heightZ": round(maximum[2] - minimum[2], 4),
            },
            "containsCratesOrPeaches": bool(forbidden_content),
        },
        "collision": {
            "nodeCount": len(collision_names),
            "meshCount": len(imported_collision_meshes),
            "triangleCount": imported_collision_triangles,
            "allNamesUseColliderPrefixes": not invalid_collider_names,
        },
        "visualCollisionNameOverlap": overlap,
    }
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    (REVIEW_DIR / "glb-reimport-audit.json").write_text(
        json.dumps(audit, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    print(json.dumps(audit, indent=2, sort_keys=True))
    if issues:
        raise SystemExit(1)


if __name__ == "__main__":
    if "--inspect-export" in _arguments_after_separator():
        inspect_exports()
    elif "--render-driver-only" in _arguments_after_separator():
        render_driver_review_only()
    elif "--render-only" in _arguments_after_separator():
        render_review()
    else:
        build_asset()
