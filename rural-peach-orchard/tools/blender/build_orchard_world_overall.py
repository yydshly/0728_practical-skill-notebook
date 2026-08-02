"""Build the repository-authored rural orchard world shell."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import random
import sys
from typing import Sequence

import bmesh
import bpy
from mathutils import Vector


ROOT_NAMES = (
    "farmhouse_yard",
    "village_road",
    "orchard_gate",
    "orchard_parking",
    "background_dressing",
    "crate_instances",
)

MATERIAL_SPECS = {
    "M_Wall": ((0.72, 0.62, 0.47, 1.0), 0.86, 0.0),
    "M_Roof": ((0.58, 0.16, 0.075, 1.0), 0.72, 0.0),
    "M_Metal": ((0.20, 0.24, 0.22, 1.0), 0.42, 0.48),
    "M_Concrete": ((0.43, 0.44, 0.40, 1.0), 0.92, 0.0),
    "M_Soil": ((0.34, 0.20, 0.095, 1.0), 0.98, 0.0),
    "M_PropGreen": ((0.09, 0.42, 0.25, 1.0), 0.58, 0.0),
    "M_BackgroundField": ((0.38, 0.48, 0.19, 1.0), 0.96, 0.0),
    "M_BackgroundHill": ((0.25, 0.34, 0.22, 1.0), 1.0, 0.0),
}


def reset_scene() -> None:
    """Remove factory content and generated datablocks deterministically."""
    if bpy.context.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        bpy.data.collections.remove(collection)
    for datablocks in (
        bpy.data.meshes,
        bpy.data.materials,
        bpy.data.images,
        bpy.data.cameras,
        bpy.data.lights,
        bpy.data.curves,
    ):
        for datablock in list(datablocks):
            datablocks.remove(datablock)


def _runtime_point(point: Sequence[float]) -> tuple[float, float, float]:
    """Map Task 1's Y-up coordinates to Blender's Z-up coordinates."""
    x, y, z = point
    return (float(x), float(-z), float(y))


def _empty(name: str, size: float = 0.5) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = size
    bpy.context.scene.collection.objects.link(obj)
    return obj


def _material(name: str, color: Sequence[float], roughness: float, metallic: float) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = color
    principled.inputs["Roughness"].default_value = roughness
    principled.inputs["Metallic"].default_value = metallic
    return material


def _mesh_object(
    name: str,
    vertices: Sequence[Sequence[float]],
    faces: Sequence[Sequence[int]],
    material: bpy.types.Material | None = None,
) -> bpy.types.Object:
    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.validate(verbose=False)
    mesh.update(calc_edges=True)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()
    if material is not None:
        mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def _box(
    name: str,
    center: Sequence[float],
    size: Sequence[float],
    material: bpy.types.Material,
) -> bpy.types.Object:
    cx, cy, cz = center
    sx, sy, sz = (value / 2.0 for value in size)
    vertices = [
        (cx - sx, cy - sy, cz - sz), (cx + sx, cy - sy, cz - sz),
        (cx + sx, cy + sy, cz - sz), (cx - sx, cy + sy, cz - sz),
        (cx - sx, cy - sy, cz + sz), (cx + sx, cy - sy, cz + sz),
        (cx + sx, cy + sy, cz + sz), (cx - sx, cy + sy, cz + sz),
    ]
    faces = (
        (0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4),
        (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7),
    )
    return _mesh_object(name, vertices, faces, material)


def _cylinder(
    name: str,
    center: Sequence[float],
    radius: float,
    depth: float,
    material: bpy.types.Material,
    segments: int = 10,
) -> bpy.types.Object:
    cx, cy, cz = center
    vertices = []
    for z in (cz - depth / 2.0, cz + depth / 2.0):
        for index in range(segments):
            angle = math.tau * index / segments
            vertices.append((cx + radius * math.cos(angle), cy + radius * math.sin(angle), z))
    faces: list[tuple[int, ...]] = []
    for index in range(segments):
        following = (index + 1) % segments
        faces.append((index, following, segments + following, segments + index))
    faces.append(tuple(reversed(range(segments))))
    faces.append(tuple(range(segments, segments * 2)))
    return _mesh_object(name, vertices, faces, material)


def _tube_between(
    name: str,
    start: Sequence[float],
    end: Sequence[float],
    radius: float,
    material: bpy.types.Material,
    segments: int = 8,
) -> bpy.types.Object:
    start_v = Vector(start)
    end_v = Vector(end)
    direction = end_v - start_v
    length = direction.length
    obj = _cylinder(name, (0.0, 0.0, 0.0), radius, length, material, segments)
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0.0, 0.0, 1.0)).rotation_difference(direction.normalized())
    obj.location = (start_v + end_v) * 0.5
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.select_set(False)
    return obj


def _ellipsoid(
    name: str,
    center: Sequence[float],
    radii: Sequence[float],
    material: bpy.types.Material,
    segments: int = 10,
    rings: int = 5,
) -> bpy.types.Object:
    center_v = Vector(center)
    rx, ry, rz = radii
    vertices: list[tuple[float, float, float]] = []
    for ring in range(1, rings):
        phi = math.pi * ring / rings
        for segment in range(segments):
            theta = math.tau * segment / segments
            vertices.append(tuple(center_v + Vector((
                rx * math.sin(phi) * math.cos(theta),
                ry * math.sin(phi) * math.sin(theta),
                rz * math.cos(phi),
            ))))
    bottom = len(vertices)
    vertices.append(tuple(center_v + Vector((0.0, 0.0, -rz))))
    top = len(vertices)
    vertices.append(tuple(center_v + Vector((0.0, 0.0, rz))))
    faces: list[tuple[int, ...]] = []
    for ring in range(rings - 2):
        current = ring * segments
        following_ring = (ring + 1) * segments
        for segment in range(segments):
            following = (segment + 1) % segments
            faces.append((current + segment, current + following, following_ring + following, following_ring + segment))
    for segment in range(segments):
        following = (segment + 1) % segments
        faces.append((bottom, following, segment))
        final_ring = (rings - 2) * segments
        faces.append((top, final_ring + segment, final_ring + following))
    return _mesh_object(name, vertices, faces, material)


def _parent_keep_world(child: bpy.types.Object, parent: bpy.types.Object) -> None:
    bpy.context.view_layer.update()
    world = child.matrix_world.copy()
    child.parent = parent
    child.matrix_world = world


def _join(objects: Sequence[bpy.types.Object], name: str, root: bpy.types.Object) -> bpy.types.Object:
    if not objects:
        raise ValueError(f"cannot join empty object set for {name}")
    if len(objects) == 1:
        joined = objects[0]
        joined.name = name
        joined.data.name = f"{name}_mesh"
        _parent_keep_world(joined, root)
        return joined
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.hide_set(False)
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    joined = objects[0]
    joined.name = name
    joined.data.name = f"{name}_mesh"
    _parent_keep_world(joined, root)
    return joined


def _join_root_by_material(root: bpy.types.Object) -> None:
    meshes = [obj for obj in root.children_recursive if obj.type == "MESH"]
    groups: dict[str, list[bpy.types.Object]] = {}
    for obj in meshes:
        material = obj.data.materials[0] if obj.data.materials else None
        key = material.name if material else "unassigned"
        groups.setdefault(key, []).append(obj)
    for material_name, objects in groups.items():
        _join(objects, f"{root.name}__{material_name}", root)


def create_beveled_masonry_mesh(
    name: str,
    footprint: Sequence[Sequence[float]],
    height: float,
    bevel_m: float,
    material: bpy.types.Material,
) -> bpy.types.Object:
    """Extrude a footprint, bevel structural edges, and apply area-weighted normals."""
    count = len(footprint)
    if count < 3 or height <= 0 or bevel_m < 0:
        raise ValueError("masonry needs a valid footprint, positive height, and non-negative bevel")
    vertices = [(x, y, 0.0) for x, y in footprint] + [(x, y, height) for x, y in footprint]
    faces: list[tuple[int, ...]] = [tuple(reversed(range(count))), tuple(range(count, count * 2))]
    for index in range(count):
        following = (index + 1) % count
        faces.append((index, following, count + following, count + index))
    obj = _mesh_object(name, vertices, faces, material)
    if bevel_m > 0:
        modifier = obj.modifiers.new("structural_edge_bevel", "BEVEL")
        modifier.width = bevel_m
        modifier.segments = 2
        modifier.limit_method = "ANGLE"
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.select_set(False)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    vertex_normals: list[Vector] = [Vector((0.0, 0.0, 0.0)) for _ in obj.data.vertices]
    for polygon in obj.data.polygons:
        for vertex_index in polygon.vertices:
            vertex_normals[vertex_index] += polygon.normal * polygon.area
    obj.data.normals_split_custom_set_from_vertices([
        normal.normalized() if normal.length_squared else Vector((0.0, 0.0, 1.0))
        for normal in vertex_normals
    ])
    return obj


def create_gable_roof(
    name: str,
    center: Sequence[float],
    width: float,
    depth: float,
    eave_z: float,
    ridge_z: float,
    material: bpy.types.Material,
) -> bpy.types.Object:
    """Create a closed, thick gable volume with explicit eaves and ridge."""
    cx, cy = center[:2]
    half_w = width / 2.0
    half_d = depth / 2.0
    base_z = eave_z - 0.28
    cross = [(-half_w, base_z), (half_w, base_z), (half_w, eave_z), (0.0, ridge_z), (-half_w, eave_z)]
    vertices = [(cx + x, cy - half_d, z) for x, z in cross] + [(cx + x, cy + half_d, z) for x, z in cross]
    faces: list[tuple[int, ...]] = [tuple(reversed(range(5))), tuple(range(5, 10))]
    for index in range(5):
        following = (index + 1) % 5
        faces.append((index, following, 5 + following, 5 + index))
    return _mesh_object(name, vertices, faces, material)


def create_recessed_opening(
    name: str,
    center: Sequence[float],
    width: float,
    height: float,
    depth: float,
    material: bpy.types.Material,
) -> bpy.types.Object:
    """Create a framed opening with separate frame, sill, reveal, and inset panel meshes."""
    cx, cy, cz = center
    root = _empty(name, 0.18)
    frame = max(0.09, min(width, height) * 0.1)
    parts = [
        _box(f"{name}_frame_left", (cx - width / 2 - frame / 2, cy, cz), (frame, depth, height + frame * 2), material),
        _box(f"{name}_frame_right", (cx + width / 2 + frame / 2, cy, cz), (frame, depth, height + frame * 2), material),
        _box(f"{name}_frame_top", (cx, cy, cz + height / 2 + frame / 2), (width, depth, frame), material),
        _box(f"{name}_sill", (cx, cy - depth * 0.05, cz - height / 2 - frame / 2), (width + frame * 2, depth * 1.25, frame), material),
        _box(f"{name}_reveal", (cx, cy + depth * 0.25, cz), (width, depth * 0.42, height), material),
        _box(f"{name}_inset_panel", (cx, cy + depth * 0.55, cz), (width - frame * 0.4, depth * 0.16, height - frame * 0.4), material),
    ]
    for part in parts:
        _parent_keep_world(part, root)
    return root


def create_road_mesh(
    name: str,
    centerline: Sequence[Sequence[float]],
    width_m: float,
    shoulder_m: float,
    material: bpy.types.Material,
) -> bpy.types.Object:
    """Sweep a five-metre road with fixed-seed irregular edges and soil shoulders."""
    if len(centerline) < 2:
        raise ValueError("road centerline needs at least two points")
    rng = random.Random(1847)
    points = [Vector((point[0], point[1])) for point in centerline]
    left: list[Vector] = []
    right: list[Vector] = []
    for index, point in enumerate(points):
        if index == 0:
            tangent = points[1] - point
        elif index == len(points) - 1:
            tangent = point - points[index - 1]
        else:
            tangent = points[index + 1] - points[index - 1]
        tangent.normalize()
        normal = Vector((-tangent.y, tangent.x))
        edge_noise = rng.uniform(-0.16, 0.16) if 0 < index < len(points) - 1 else 0.0
        left.append(point + normal * (width_m / 2.0 + edge_noise))
        right.append(point - normal * (width_m / 2.0 - edge_noise * 0.65))

    def strip_object(strip_name: str, inner: Sequence[Vector], outer: Sequence[Vector], z: float, strip_material: bpy.types.Material) -> bpy.types.Object:
        vertices = [(p.x, p.y, z) for p in inner] + [(p.x, p.y, z) for p in outer]
        count = len(inner)
        faces = [(index, index + 1, count + index + 1, count + index) for index in range(count - 1)]
        return _mesh_object(strip_name, vertices, faces, strip_material)

    road = strip_object(f"{name}_surface", left, right, 0.025, material)
    soil = bpy.data.materials["M_Soil"]
    left_outer = [left[index] + (left[index] - points[index]).normalized() * shoulder_m for index in range(len(points))]
    right_outer = [right[index] + (right[index] - points[index]).normalized() * shoulder_m for index in range(len(points))]
    left_shoulder = strip_object(f"{name}_shoulder_left", left_outer, left, 0.012, soil)
    right_shoulder = strip_object(f"{name}_shoulder_right", right, right_outer, 0.012, soil)
    root = _empty(name, 0.5)
    for part in (road, left_shoulder, right_shoulder):
        _parent_keep_world(part, root)
    return root


def create_ventilated_crate(
    name: str,
    center: Sequence[float],
    material: bpy.types.Material,
) -> bpy.types.Object:
    """Build a single joined crate mesh from spaced slats and open handles."""
    cx, cy, cz = center
    parts: list[bpy.types.Object] = []
    for index in range(5):
        offset = -0.38 + index * 0.19
        parts.append(_box(f"{name}_floor_slat_{index}", (cx + offset, cy, cz + 0.06), (0.12, 0.72, 0.12), material))
    for side in (-1.0, 1.0):
        for index in range(4):
            z = cz + 0.18 + index * 0.17
            parts.append(_box(f"{name}_side_{side}_{index}", (cx + side * 0.48, cy, z), (0.10, 0.76, 0.10), material))
            parts.append(_box(f"{name}_end_{side}_{index}", (cx, cy + side * 0.39, z), (0.86, 0.10, 0.10), material))
    for x in (-0.46, 0.46):
        parts.append(_box(f"{name}_rim_x_{x}", (cx + x, cy, cz + 0.79), (0.10, 0.88, 0.12), material))
    for y in (-0.40, 0.40):
        parts.append(_box(f"{name}_rim_y_{y}", (cx, cy + y, cz + 0.79), (0.82, 0.10, 0.12), material))
        parts.append(_box(f"{name}_handle_left_{y}", (cx - 0.33, cy + y * 1.02, cz + 0.65), (0.18, 0.08, 0.10), material))
        parts.append(_box(f"{name}_handle_right_{y}", (cx + 0.33, cy + y * 1.02, cz + 0.65), (0.18, 0.08, 0.10), material))
    holder = _empty(f"{name}_assembly")
    joined = _join(parts, name, holder)
    joined.parent = None
    bpy.data.objects.remove(holder, do_unlink=True)
    return joined


def create_background_ridge(
    name: str,
    control_points: Sequence[Sequence[float]],
    depth_m: float,
    material: bpy.types.Material,
) -> bpy.types.Object:
    """Create a closed ridge strip; callers keep it outside the playable bounds."""
    if len(control_points) < 2:
        raise ValueError("ridge needs at least two control points")
    vertices: list[tuple[float, float, float]] = []
    for x, y, top_z in control_points:
        vertices.extend(((x, y, 0.0), (x, y, top_z), (x, y - depth_m, 0.0), (x, y - depth_m, top_z * 0.9)))
    faces: list[tuple[int, ...]] = []
    for index in range(len(control_points) - 1):
        a = index * 4
        b = (index + 1) * 4
        faces.extend(((a, b, b + 1, a + 1), (a + 2, a + 3, b + 3, b + 2), (a + 1, b + 1, b + 3, a + 3), (a, a + 2, b + 2, b)))
    faces.extend(((0, 1, 3, 2), (len(vertices) - 4, len(vertices) - 2, len(vertices) - 1, len(vertices) - 3)))
    return _mesh_object(name, vertices, faces, material)


def _make_basket(name: str, center: Sequence[float], material: bpy.types.Material) -> bpy.types.Object:
    cx, cy, cz = center
    parts = []
    for side in (-1, 1):
        for level in range(4):
            parts.append(_box(f"{name}_x_{side}_{level}", (cx + side * 0.42, cy, cz + 0.12 + level * 0.13), (0.08, 0.7, 0.08), material))
            parts.append(_box(f"{name}_y_{side}_{level}", (cx, cy + side * 0.36, cz + 0.12 + level * 0.13), (0.76, 0.08, 0.08), material))
    parts.append(_box(f"{name}_base", (cx, cy, cz + 0.04), (0.76, 0.68, 0.08), material))
    holder = _empty(f"{name}_assembly")
    joined = _join(parts, f"{name}_mesh", holder)
    joined.parent = None
    bpy.data.objects.remove(holder, do_unlink=True)
    return joined


def _add_peaches(root: bpy.types.Object, center: Sequence[float], count: int, prefix: str) -> None:
    rng = random.Random(5501 + count)
    material = bpy.data.materials["M_Roof"]
    cx, cy, cz = center
    for index in range(count):
        angle = math.tau * index / max(count, 1)
        radius = 0.12 + 0.11 * (index % 3)
        peach = _ellipsoid(
            f"{prefix}_peach_{index + 1:02d}",
            (cx + math.cos(angle) * radius, cy + math.sin(angle) * radius, cz + 0.08 * (index // 5)),
            (0.095 + rng.uniform(-0.008, 0.01), 0.09, 0.088),
            material,
            segments=8,
            rings=4,
        )
        _parent_keep_world(peach, root)


def _create_state_groups(roots: dict[str, bpy.types.Object]) -> None:
    parking_root = roots["orchard_parking"]
    yard_root = roots["farmhouse_yard"]
    basket_center = _runtime_point((2.6, 0.0, 12.5))
    crate_center = _runtime_point((1.4, 0.0, 12.5))
    delivery_center = _runtime_point((0.0, 0.0, -18.0))

    basket_empty = _empty("harvest_basket_empty", 0.22)
    _parent_keep_world(basket_empty, parking_root)
    _parent_keep_world(_make_basket("harvest_basket_empty_prop", basket_center, bpy.data.materials["M_Soil"]), basket_empty)
    basket_full = _empty("harvest_basket_full", 0.22)
    _parent_keep_world(basket_full, parking_root)
    _parent_keep_world(_make_basket("harvest_basket_full_prop", basket_center, bpy.data.materials["M_Soil"]), basket_full)
    _add_peaches(basket_full, (basket_center[0], basket_center[1], 0.54), 9, "harvest_basket_full")

    crate_empty = _empty("packing_crate_empty", 0.22)
    _parent_keep_world(crate_empty, parking_root)
    _parent_keep_world(create_ventilated_crate("packing_crate_empty_prop", crate_center, bpy.data.materials["M_PropGreen"]), crate_empty)
    crate_full = _empty("packing_crate_full", 0.22)
    _parent_keep_world(crate_full, parking_root)
    _parent_keep_world(create_ventilated_crate("packing_crate_full_prop", crate_center, bpy.data.materials["M_PropGreen"]), crate_full)
    _add_peaches(crate_full, (crate_center[0], crate_center[1], 0.56), 10, "packing_crate_full")

    delivered = _empty("delivery_complete", 0.3)
    _parent_keep_world(delivered, yard_root)
    for index, offset in enumerate(((-0.55, 0.0), (0.55, 0.0), (0.0, 0.7))):
        crate = create_ventilated_crate(
            f"delivery_complete_crate_{index + 1:02d}",
            (delivery_center[0] + offset[0], delivery_center[1] + offset[1], 0.0),
            bpy.data.materials["M_PropGreen"],
        )
        _parent_keep_world(crate, delivered)
    _add_peaches(delivered, (delivery_center[0], delivery_center[1] + 0.72, 0.58), 8, "delivery_complete")


def _anchor(name: str, runtime_position: Sequence[float], parent: bpy.types.Object) -> bpy.types.Object:
    anchor = _empty(name, 0.28)
    anchor.location = _runtime_point(runtime_position)
    _parent_keep_world(anchor, parent)
    return anchor


def _create_farmhouse_and_yard(root: bpy.types.Object) -> None:
    wall = bpy.data.materials["M_Wall"]
    roof = bpy.data.materials["M_Roof"]
    metal = bpy.data.materials["M_Metal"]
    concrete = bpy.data.materials["M_Concrete"]
    soil = bpy.data.materials["M_Soil"]
    green = bpy.data.materials["M_PropGreen"]

    # Task 1 farmhouse obstacle: runtime center (-13, 0, -18), half extents (4.5, 2.5, 3.5).
    footprint = ((-17.5, 14.5), (-8.5, 14.5), (-8.5, 21.5), (-17.5, 21.5))
    house = create_beveled_masonry_mesh("farmhouse_masonry", footprint, 4.45, 0.10, wall)
    _parent_keep_world(house, root)
    _parent_keep_world(create_gable_roof("farmhouse_gable_roof", (-13.0, 18.0), 9.8, 7.8, 4.55, 6.25, roof), root)
    for opening in (
        create_recessed_opening("farmhouse_front_door", (-10.2, 14.40, 1.25), 1.15, 2.35, 0.25, metal),
        create_recessed_opening("farmhouse_window_west", (-15.2, 14.40, 2.25), 1.35, 1.35, 0.22, metal),
        create_recessed_opening("farmhouse_window_east", (-12.8, 14.40, 2.25), 1.35, 1.35, 0.22, metal),
    ):
        _parent_keep_world(opening, root)
    _parent_keep_world(_box("farmhouse_eave_front", (-13.0, 14.18, 4.42), (9.9, 0.26, 0.20), roof), root)
    _parent_keep_world(_box("farmhouse_eave_rear", (-13.0, 21.82, 4.42), (9.9, 0.26, 0.20), roof), root)
    _parent_keep_world(_box("farmhouse_lean_to_roof", (-7.5, 19.0, 2.75), (2.7, 4.2, 0.22), metal), root)
    _parent_keep_world(_tube_between("farmhouse_conduit", (-9.0, 14.24, 0.45), (-9.0, 14.24, 3.55), 0.035, metal), root)
    _parent_keep_world(_tube_between("farmhouse_downpipe", (-17.22, 14.17, 0.18), (-17.22, 14.17, 4.45), 0.06, metal), root)

    _parent_keep_world(_box("yard_surface", (-8.5, 18.0, -0.06), (17.0, 16.0, 0.12), soil), root)
    _parent_keep_world(create_beveled_masonry_mesh("yard_wall_west", ((-18.2, 7.0), (-17.8, 7.0), (-17.8, 19.0), (-18.2, 19.0)), 2.4, 0.04, wall), root)
    _parent_keep_world(create_beveled_masonry_mesh("yard_wall_north", ((-18.2, 6.8), (-7.8, 6.8), (-7.8, 7.2), (-18.2, 7.2)), 2.4, 0.04, wall), root)
    _parent_keep_world(create_beveled_masonry_mesh("yard_gate_leaf", ((-8.4, 11.5), (-8.0, 11.5), (-8.0, 14.5), (-8.4, 14.5)), 2.4, 0.03, metal), root)
    _parent_keep_world(_box("yard_sorting_edge", (-5.8, 11.1, 0.28), (4.2, 0.38, 0.56), concrete), root)
    _parent_keep_world(_box("yard_drain", (-2.9, 17.4, 0.02), (0.34, 5.5, 0.08), metal), root)
    for bar in range(7):
        _parent_keep_world(_box(f"yard_drain_grate_{bar:02d}", (-2.9, 15.0 + bar * 0.75, 0.09), (0.52, 0.06, 0.05), metal), root)
    _parent_keep_world(_box("yard_work_table_top", (-6.1, 14.8, 1.05), (2.3, 1.05, 0.16), wall), root)
    for x in (-7.0, -5.2):
        for y in (14.45, 15.15):
            _parent_keep_world(_box(f"yard_work_table_leg_{x}_{y}", (x, y, 0.52), (0.12, 0.12, 1.04), metal), root)
    hose_points = [(-6.9, 16.5, 0.08), (-6.1, 16.8, 0.08), (-5.4, 16.3, 0.08), (-6.2, 15.8, 0.08), (-7.0, 16.5, 0.08)]
    for index in range(len(hose_points) - 1):
        _parent_keep_world(_tube_between(f"yard_hose_{index:02d}", hose_points[index], hose_points[index + 1], 0.035, green, 7), root)
    _parent_keep_world(_tube_between("yard_broom_handle", (-4.2, 14.7, 0.1), (-4.0, 14.7, 1.65), 0.035, wall, 8), root)
    _parent_keep_world(_box("yard_broom_head", (-4.2, 14.7, 0.12), (0.65, 0.18, 0.18), roof), root)

    marker_runtime = (
        (-7.2, 0.0, -16.0), (-6.1, 0.0, -16.0), (-5.0, 0.0, -16.0), (-3.9, 0.0, -16.0),
        (-7.2, 0.0, -17.2), (-6.1, 0.0, -17.2), (-5.0, 0.0, -17.2), (-3.9, 0.0, -17.2),
    )
    crate_root = bpy.data.objects["crate_instances"]
    for index, runtime_position in enumerate(marker_runtime, start=1):
        marker = _empty(f"crate_marker_{index:02d}", 0.18)
        marker.location = _runtime_point(runtime_position)
        _parent_keep_world(marker, crate_root)
        if index == 1:
            crate = create_ventilated_crate("crate_source", (0.0, 0.0, 0.0), green)
            crate.parent = marker
            crate.location = (0.0, 0.0, 0.0)


def _create_road(root: bpy.types.Object) -> None:
    concrete = bpy.data.materials["M_Concrete"]
    soil = bpy.data.materials["M_Soil"]
    road = create_road_mesh(
        "village_road_sweep",
        [(0.0, 24.0), (-0.12, 18.0), (0.08, 10.0), (-0.10, 2.0), (0.0, -7.5)],
        5.0,
        1.0,
        concrete,
    )
    _parent_keep_world(road, root)
    for index, (x, y, sx, sy) in enumerate(((-0.75, 14.0, 1.1, 2.4), (0.85, 5.5, 0.9, 1.6), (-0.55, -1.0, 1.3, 2.1))):
        _parent_keep_world(_box(f"road_concrete_patch_{index:02d}", (x, y, 0.055), (sx, sy, 0.06), concrete), root)
    for side in (-1.0, 1.0):
        for index, y in enumerate((20.0, 13.0, 6.0, -1.0)):
            _parent_keep_world(_box(f"road_drain_trace_{side}_{index}", (side * 3.1, y, 0.025), (0.16, 4.2, 0.05), soil), root)


def _create_orchard_gate(root: bpy.types.Object) -> None:
    wall = bpy.data.materials["M_Wall"]
    metal = bpy.data.materials["M_Metal"]
    concrete = bpy.data.materials["M_Concrete"]
    for x in (-3.2, 3.2):
        _parent_keep_world(create_beveled_masonry_mesh(f"orchard_gate_post_{x}", ((x - 0.28, -7.4), (x + 0.28, -7.4), (x + 0.28, -6.8), (x - 0.28, -6.8)), 2.65, 0.04, wall), root)
    _parent_keep_world(_box("orchard_gate_sign", (0.0, -7.1, 2.7), (6.9, 0.24, 0.62), metal), root)
    _parent_keep_world(_box("orchard_gate_threshold", (0.0, -7.1, 0.035), (6.4, 0.6, 0.07), concrete), root)
    for x in (-7.0, 7.0):
        _parent_keep_world(create_beveled_masonry_mesh(f"orchard_boundary_{x}", ((x - 3.4, -7.3), (x + 3.4, -7.3), (x + 3.4, -6.9), (x - 3.4, -6.9)), 1.05, 0.03, wall), root)


def _create_parking_and_work(root: bpy.types.Object) -> None:
    concrete = bpy.data.materials["M_Concrete"]
    metal = bpy.data.materials["M_Metal"]
    green = bpy.data.materials["M_PropGreen"]
    soil = bpy.data.materials["M_Soil"]
    _parent_keep_world(_box("orchard_parking_apron", (0.0, -10.5, -0.045), (7.2, 5.2, 0.09), concrete), root)
    for x in (-2.8, 2.8):
        _parent_keep_world(_box(f"orchard_parking_edge_{x}", (x, -10.5, 0.05), (0.10, 4.2, 0.10), metal), root)
    _parent_keep_world(_box("orchard_work_pad", (2.1, -12.5, -0.02), (3.7, 2.5, 0.08), soil), root)
    _parent_keep_world(_box("orchard_irrigation_pump", (8.0, -8.0, 0.55), (1.6, 1.4, 1.1), green), root)
    _parent_keep_world(_tube_between("orchard_irrigation_riser", (8.0, -8.0, 0.95), (8.0, -8.0, 2.15), 0.08, metal), root)
    _parent_keep_world(_tube_between("orchard_irrigation_header", (8.0, -8.0, 2.12), (10.4, -8.0, 2.12), 0.07, metal), root)
    for x in (-15.0, -10.0, -5.0, 5.0, 10.0, 15.0):
        _parent_keep_world(_tube_between(f"orchard_irrigation_line_{x}", (x, -9.0, 0.045), (x, -28.0, 0.045), 0.025, metal, 6), root)


def _create_background(root: bpy.types.Object) -> None:
    field = bpy.data.materials["M_BackgroundField"]
    hill = bpy.data.materials["M_BackgroundHill"]
    roof = bpy.data.materials["M_Roof"]
    wall = bpy.data.materials["M_Wall"]
    for index, (x, y, width) in enumerate(((-1.0, -32.5, 82.0), (3.5, -35.1, 74.0), (-4.5, -37.7, 68.0))):
        _parent_keep_world(_box(f"background_field_strip_{index:02d}", (x, y, 0.02), (width, 2.15, 0.08), field if index % 2 == 0 else hill), root)

    house_specs = (
        ("a", -34.0, -34.0, 4.8, 2.4, 2.8, 3.85, -0.55),
        ("b", -27.0, -36.0, 3.9, 3.2, 3.15, 4.25, 0.45),
        ("c", 26.0, -34.0, 5.7, 2.1, 2.45, 3.55, -0.9),
        ("d", 34.0, -36.0, 4.4, 2.8, 2.95, 4.05, 0.7),
    )
    for suffix, x, y, width, depth, wall_height, ridge_height, door_offset in house_specs:
        marker = _empty(f"background_house_variant_{suffix}", 0.28)
        marker.location = (x, y, 0.0)
        marker["profile"] = suffix
        marker.parent = root
        parts = (
            _box(f"background_house_{suffix}_wall", (x, y, wall_height / 2.0), (width, depth, wall_height), wall),
            create_gable_roof(f"background_house_{suffix}_roof", (x, y), width + 0.55, depth + 0.55, wall_height + 0.05, ridge_height, roof),
            _box(f"background_house_{suffix}_eave_front", (x, y + depth / 2.0 + 0.16, wall_height), (width + 0.75, 0.18, 0.16), roof),
            _box(f"background_house_{suffix}_eave_rear", (x, y - depth / 2.0 - 0.16, wall_height), (width + 0.75, 0.18, 0.16), roof),
            _box(f"background_house_{suffix}_door", (x + door_offset, y + depth / 2.0 + 0.055, 0.95), (0.72, 0.10, 1.9), roof),
            _box(f"background_house_{suffix}_window", (x - door_offset * 0.7, y + depth / 2.0 + 0.06, 1.75), (0.72 + 0.12 * (suffix in {'b', 'd'}), 0.11, 0.66), roof),
        )
        for part in parts:
            _parent_keep_world(part, marker)

    tree_profiles = {
        "a": {"trunk_depth": 2.2, "crown_z": 3.0, "crown_radii": (1.25, 0.92, 1.45)},
        "b": {"trunk_depth": 2.5, "crown_z": 3.55, "crown_radii": (1.05, 0.82, 1.85)},
        "c": {"trunk_depth": 2.3, "crown_z": 3.1, "crown_radii": (1.5, 0.96, 1.25)},
    }
    for index, x in enumerate(range(-39, 40, 4)):
        suffix = "abc"[index % 3]
        profile = tree_profiles[suffix]
        marker = None
        if index < 3:
            marker = _empty(f"background_tree_variant_{suffix}", 0.24)
            marker.location = (float(x), -39.2, 0.0)
            marker["profile"] = suffix
            marker.parent = root
        trunk = _cylinder(
            f"background_tree_{suffix}_trunk_{index:02d}",
            (float(x), -39.2, profile["trunk_depth"] / 2.0),
            0.13 + 0.025 * (index % 3),
            profile["trunk_depth"],
            hill,
            7,
        )
        crown = _ellipsoid(
            f"background_tree_{suffix}_crown_{index:02d}",
            (float(x), -39.2, profile["crown_z"]),
            profile["crown_radii"],
            field,
            8,
            4,
        )
        _parent_keep_world(trunk, root)
        _parent_keep_world(crown, root)
        if suffix == "c":
            lobe = _ellipsoid(
                f"background_tree_{suffix}_lobe_{index:02d}",
                (float(x) + 0.42, -39.18, 4.02),
                (0.88, 0.72, 1.02),
                field,
                8,
                4,
            )
            _parent_keep_world(lobe, root)
    ridge = create_background_ridge(
        "background_low_hill_ridge",
        ((-45.0, -42.0, 4.2), (-31.0, -42.0, 6.0), (-16.0, -42.0, 4.8), (0.0, -42.0, 7.2), (17.0, -42.0, 5.4), (33.0, -42.0, 6.4), (45.0, -42.0, 4.5)),
        7.0,
        hill,
    )
    _parent_keep_world(ridge, root)


def _create_delivery_ground_mark(root: bpy.types.Object) -> None:
    concrete = bpy.data.materials["M_Concrete"]
    wall = bpy.data.materials["M_Wall"]
    parts = [
        _box("delivery_pad_inset", (0.0, 18.0, 0.055), (3.0, 2.6, 0.04), concrete),
        _box("delivery_pad_outline_n", (0.0, 19.38, 0.078), (3.35, 0.12, 0.046), wall),
        _box("delivery_pad_outline_s", (0.0, 16.62, 0.078), (3.35, 0.12, 0.046), wall),
        _box("delivery_pad_outline_e", (1.615, 18.0, 0.078), (0.12, 2.64, 0.046), wall),
        _box("delivery_pad_outline_w", (-1.615, 18.0, 0.078), (0.12, 2.64, 0.046), wall),
    ]
    _join(parts, "farmhouse_delivery_ground_mark", root)


def _create_surface_repairs(roots: dict[str, bpy.types.Object]) -> None:
    concrete = bpy.data.materials["M_Concrete"]
    wall = bpy.data.materials["M_Wall"]
    metal = bpy.data.materials["M_Metal"]
    farmhouse_parts = [
        _box("farmhouse_patch_low", (-15.65, 14.37, 0.78), (1.05, 0.035, 0.58), concrete),
        _box("farmhouse_patch_high", (-11.65, 14.37, 3.52), (0.82, 0.035, 0.42), concrete),
        _box("farmhouse_patch_corner", (-17.32, 16.25, 1.35), (0.035, 1.25, 0.72), concrete),
    ]
    _join(farmhouse_parts, "farmhouse_surface_repairs", roots["farmhouse_yard"])
    yard_parts = [
        _box("yard_faded_patch_a", (-12.1, 12.2, 0.022), (2.8, 1.25, 0.044), wall),
        _box("yard_faded_patch_b", (-9.2, 9.4, 0.024), (1.7, 0.92, 0.048), wall),
        _box("yard_edge_repair", (-16.9, 10.4, 0.026), (0.26, 4.1, 0.052), wall),
    ]
    _join(yard_parts, "yard_surface_repairs", roots["farmhouse_yard"])
    road_parts = [
        _box("road_repair_seam_a", (-0.45, 11.0, 0.064), (3.5, 0.075, 0.035), metal),
        _box("road_repair_seam_b", (0.55, 3.2, 0.064), (2.8, 0.075, 0.035), metal),
        _box("road_repair_seam_c", (-0.35, -3.0, 0.064), (3.1, 0.075, 0.035), metal),
    ]
    _join(road_parts, "road_surface_repairs", roots["village_road"])


def build_scene() -> None:
    reset_scene()
    for name, (color, roughness, metallic) in MATERIAL_SPECS.items():
        _material(name, color, roughness, metallic)
    roots = {name: _empty(name, 0.65) for name in ROOT_NAMES}
    _create_farmhouse_and_yard(roots["farmhouse_yard"])
    _create_road(roots["village_road"])
    _create_orchard_gate(roots["orchard_gate"])
    _create_parking_and_work(roots["orchard_parking"])
    _create_background(roots["background_dressing"])
    for root_name in ROOT_NAMES[:-1]:
        _join_root_by_material(roots[root_name])

    # Keep this authored surface as a named export node. It sits just below the
    # gameplay plane so the road, parking apron, and work pad remain readable
    # while the complete orchard traversal area has visible ground beneath it.
    orchard_soil_surface = _box(
        "orchard_soil_surface",
        (0.0, -19.0, -0.055),
        (40.0, 24.0, 0.10),
        bpy.data.materials["M_Soil"],
    )
    _parent_keep_world(orchard_soil_surface, roots["orchard_parking"])

    _create_delivery_ground_mark(roots["farmhouse_yard"])
    _create_surface_repairs(roots)
    _create_state_groups(roots)
    _anchor("orchard_parking_anchor", (0.0, 0.0, 10.5), roots["orchard_parking"])
    _anchor("harvest_basket_anchor", (2.6, 0.0, 12.5), roots["orchard_parking"])
    _anchor("packing_crate_anchor", (1.4, 0.0, 12.5), roots["orchard_parking"])
    _anchor("farmhouse_delivery_anchor", (0.0, 0.0, -18.0), roots["farmhouse_yard"])
    bpy.context.view_layer.update()


def measure_scene() -> dict[str, object]:
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    triangles = 0
    primitive_count = 0
    bounds: list[Vector] = []
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    for obj in meshes:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        triangles += len(mesh.loop_triangles)
        used_materials = {polygon.material_index for polygon in mesh.polygons}
        primitive_count += max(1, len(used_materials))
        for corner in evaluated.bound_box:
            point = evaluated.matrix_world @ Vector(corner)
            bounds.append(Vector((point.x, point.z, -point.y)))
        evaluated.to_mesh_clear()
    minimum = [round(min(point[index] for point in bounds), 4) for index in range(3)]
    maximum = [round(max(point[index] for point in bounds), 4) for index in range(3)]
    return {
        "triangles": triangles,
        "materialCount": len(bpy.data.materials),
        "meshCount": len(meshes),
        "primitiveCount": primitive_count,
        "boundsM": {"min": minimum, "max": maximum},
    }


def save_and_export(blend_path: str | Path, glb_path: str | Path, metrics_path: str | Path) -> None:
    blend = Path(blend_path).resolve()
    glb = Path(glb_path).resolve()
    metrics_file = Path(metrics_path).resolve()
    for path in (blend, glb, metrics_file):
        path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    bpy.ops.object.select_all(action="DESELECT")
    for name in ROOT_NAMES:
        root = bpy.data.objects[name]
        root.select_set(True)
        for child in root.children_recursive:
            child.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(glb),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_cameras=False,
        export_lights=False,
        export_animations=False,
        export_texcoords=False,
        export_normals=True,
        export_tangents=False,
        export_attributes=False,
    )
    metrics_file.write_text(json.dumps(measure_scene(), indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _point_camera(camera: bpy.types.Object, target: Sequence[float]) -> None:
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat("-Z", "Y").to_euler()


def render_review(review_path: str | Path) -> None:
    """Render a neutral review image, then remove review-only camera and lights."""
    output = Path(review_path).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    for name in ("harvest_basket_empty", "packing_crate_empty"):
        for obj in (bpy.data.objects[name], *bpy.data.objects[name].children_recursive):
            obj.hide_render = True
    crate_source = bpy.data.objects["crate_source"]
    review_crates = []
    for index in range(2, 9):
        marker = bpy.data.objects[f"crate_marker_{index:02d}"]
        clone = bpy.data.objects.new(f"review_only_crate_{index:02d}", crate_source.data)
        bpy.context.scene.collection.objects.link(clone)
        clone.matrix_world = marker.matrix_world.copy()
        review_crates.append(clone)
    world = bpy.context.scene.world or bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.74, 0.82, 0.89, 1.0)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.7
    camera_data = bpy.data.cameras.new("review_camera_data")
    camera = bpy.data.objects.new("review_camera", camera_data)
    bpy.context.scene.collection.objects.link(camera)
    camera.location = (58.0, 65.0, 54.0)
    camera_data.lens = 50.0
    _point_camera(camera, (-1.0, -7.0, 1.0))
    bpy.context.scene.camera = camera
    sun_data = bpy.data.lights.new("review_sun_data", "SUN")
    sun_data.energy = 2.3
    sun_data.color = (1.0, 0.83, 0.65)
    sun = bpy.data.objects.new("review_sun", sun_data)
    bpy.context.scene.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(28), math.radians(-18), math.radians(138))
    area_data = bpy.data.lights.new("review_fill_data", "AREA")
    area_data.energy = 900.0
    area_data.shape = "DISK"
    area_data.size = 18.0
    area = bpy.data.objects.new("review_fill", area_data)
    bpy.context.scene.collection.objects.link(area)
    area.location = (-12.0, 14.0, 26.0)
    _point_camera(area, (-4.0, 0.0, 0.0))
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = 1440
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(output)
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGBA"
    bpy.ops.render.render(write_still=True)
    for clone in review_crates:
        bpy.data.objects.remove(clone, do_unlink=True)
    for obj in (camera, sun, area):
        bpy.data.objects.remove(obj, do_unlink=True)
    for datablock in (camera_data, sun_data, area_data):
        datablock.user_clear()


def _parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--blend", required=True)
    parser.add_argument("--glb", required=True)
    parser.add_argument("--metrics", required=True)
    parser.add_argument("--review")
    return parser.parse_args(argv)


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    args = _parse_args(argv)
    build_scene()
    save_and_export(args.blend, args.glb, args.metrics)
    if args.review:
        render_review(args.review)


if __name__ == "__main__":
    main()
