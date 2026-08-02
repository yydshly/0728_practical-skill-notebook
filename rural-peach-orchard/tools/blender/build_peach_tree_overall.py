"""Build the repository-authored overall-scene peach-tree GLB family."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import random
import sys
from typing import Iterable, Sequence

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector


VARIANT_NAMES = (
    "peach_tree_variant_a",
    "peach_tree_variant_b",
    "peach_tree_variant_c",
)


def reset_scene() -> None:
    """Remove factory-file content and generated datablocks for deterministic runs."""
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
    ):
        for datablock in list(datablocks):
            datablocks.remove(datablock)


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
    mesh.update()

    if material is not None:
        mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def _ring_frame(points: Sequence[Vector], index: int) -> Matrix:
    if index == 0:
        tangent = points[1] - points[0]
    elif index == len(points) - 1:
        tangent = points[-1] - points[-2]
    else:
        tangent = points[index + 1] - points[index - 1]
    tangent.normalize()
    return Vector((0.0, 0.0, 1.0)).rotation_difference(tangent).to_matrix()


def create_tapered_branch(
    name: str,
    points: Sequence[Sequence[float] | Vector],
    radii: Sequence[float],
    radial_segments: int = 8,
) -> bpy.types.Object:
    """Create a connected, capped ring mesh following the supplied branch path."""
    if len(points) < 2 or len(points) != len(radii):
        raise ValueError("points and radii must have the same length of at least two")
    if radial_segments < 3 or any(radius <= 0 for radius in radii):
        raise ValueError("branches require positive radii and at least three segments")

    path = [Vector(point) for point in points]
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, ...]] = []
    for point_index, (point, radius) in enumerate(zip(path, radii)):
        frame = _ring_frame(path, point_index)
        for segment in range(radial_segments):
            angle = math.tau * segment / radial_segments
            offset = frame @ Vector((
                math.cos(angle) * radius,
                math.sin(angle) * radius,
                0.0,
            ))
            vertices.append(tuple(point + offset))

    for ring in range(len(path) - 1):
        current = ring * radial_segments
        following = (ring + 1) * radial_segments
        for segment in range(radial_segments):
            next_segment = (segment + 1) % radial_segments
            faces.append((
                current + segment,
                current + next_segment,
                following + next_segment,
                following + segment,
            ))

    bottom_center = len(vertices)
    vertices.append(tuple(path[0]))
    top_center = len(vertices)
    vertices.append(tuple(path[-1]))
    final_ring = (len(path) - 1) * radial_segments
    for segment in range(radial_segments):
        next_segment = (segment + 1) % radial_segments
        faces.append((bottom_center, segment, next_segment))
        faces.append((
            top_center,
            final_ring + next_segment,
            final_ring + segment,
        ))

    return _mesh_object(name, vertices, faces)


def _lens_geometry() -> tuple[list[Vector], list[tuple[int, ...]]]:
    perimeter = [
        (-0.50, 0.00),
        (-0.34, 0.22),
        (-0.08, 0.31),
        (0.28, 0.20),
        (0.50, 0.00),
        (0.28, -0.20),
        (-0.08, -0.31),
        (-0.34, -0.22),
    ]
    vertices = [Vector((x, y, 0.025)) for x, y in perimeter]
    vertices.extend(Vector((x, y, -0.025)) for x, y in perimeter)
    vertices.extend((Vector((0.0, 0.0, 0.04)), Vector((0.0, 0.0, -0.04))))
    top_center = 16
    bottom_center = 17
    faces: list[tuple[int, ...]] = []
    for index in range(8):
        following = (index + 1) % 8
        faces.append((top_center, index, following))
        faces.append((bottom_center, 8 + following, 8 + index))
        faces.append((index, 8 + index, 8 + following, following))
    return vertices, faces


def create_leaf_cluster(
    name: str,
    center: Sequence[float] | Vector,
    rotation: Sequence[float] | Euler,
    scale: float | Sequence[float],
    material: bpy.types.Material,
) -> bpy.types.Object:
    """Create three applied lens leaves below a returned cluster parent."""
    center_vector = Vector(center)
    base_rotation = rotation if isinstance(rotation, Euler) else Euler(rotation, "XYZ")
    if isinstance(scale, (float, int)):
        base_scale = Vector((float(scale), float(scale), float(scale)))
    else:
        base_scale = Vector(scale)

    source_vertices, source_faces = _lens_geometry()
    leaf_specs = (
        (Vector((-0.05, 0.00, 0.00)), Euler((0.18, -0.12, -0.48))),
        (Vector((0.06, 0.03, 0.04)), Euler((-0.24, 0.18, 0.42))),
        (Vector((0.00, -0.04, 0.08)), Euler((0.35, 0.10, 1.34))),
    )
    base_matrix = (
        Matrix.Translation(center_vector)
        @ base_rotation.to_matrix().to_4x4()
        @ Matrix.Diagonal((*base_scale, 1.0))
    )
    parent = bpy.data.objects.new(name, None)
    parent.empty_display_type = "PLAIN_AXES"
    parent.empty_display_size = 0.12
    bpy.context.scene.collection.objects.link(parent)
    for leaf_index, (offset, leaf_rotation) in enumerate(leaf_specs, start=1):
        transform = (
            base_matrix
            @ Matrix.Translation(offset)
            @ leaf_rotation.to_matrix().to_4x4()
        )
        leaf = _mesh_object(
            f"{name}_leaf_{leaf_index:02d}",
            [tuple(transform @ vertex) for vertex in source_vertices],
            source_faces,
            material,
        )
        leaf.parent = parent
    return parent


def create_peach(
    name: str,
    center: Sequence[float] | Vector,
    scale: float | Sequence[float],
    material: bpy.types.Material,
) -> bpy.types.Object:
    """Create a low-segment peach with a recessed stem pocket and suture."""
    center_vector = Vector(center)
    if isinstance(scale, (float, int)):
        peach_scale = Vector((float(scale), float(scale), float(scale)))
    else:
        peach_scale = Vector(scale)

    radial_segments = 10
    rings = (
        (-0.18, 0.045),
        (-0.12, 0.145),
        (0.01, 0.185),
        (0.125, 0.160),
        (0.17, 0.065),
    )
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, ...]] = []
    for z, radius in rings:
        for segment in range(radial_segments):
            angle = math.tau * segment / radial_segments
            suture = 1.0 - 0.07 * (abs(math.cos(angle)) ** 12)
            lobes = 1.0 + 0.035 * math.cos(2.0 * angle)
            local = Vector((
                math.cos(angle) * radius * suture * lobes,
                math.sin(angle) * radius * lobes,
                z,
            ))
            vertices.append(tuple(center_vector + Vector((
                local.x * peach_scale.x,
                local.y * peach_scale.y,
                local.z * peach_scale.z,
            ))))

    for ring in range(len(rings) - 1):
        current = ring * radial_segments
        following_ring = (ring + 1) * radial_segments
        for segment in range(radial_segments):
            following = (segment + 1) % radial_segments
            faces.append((
                current + segment,
                current + following,
                following_ring + following,
                following_ring + segment,
            ))

    bottom_center = len(vertices)
    vertices.append(tuple(center_vector + Vector((0.0, 0.0, -0.18 * peach_scale.z))))
    pocket_center = len(vertices)
    vertices.append(tuple(center_vector + Vector((0.0, 0.0, 0.135 * peach_scale.z))))
    final_ring = (len(rings) - 1) * radial_segments
    for segment in range(radial_segments):
        following = (segment + 1) % radial_segments
        faces.append((bottom_center, segment, following))
        faces.append((
            pocket_center,
            final_ring + following,
            final_ring + segment,
        ))

    return _mesh_object(name, vertices, faces, material)


def _parent_keep_world(child: bpy.types.Object, parent: bpy.types.Object) -> None:
    world_matrix = child.matrix_world.copy()
    child.parent = parent
    child.matrix_world = world_matrix


def _join_category(
    objects: Sequence[bpy.types.Object],
    name: str,
    material: bpy.types.Material,
    root: bpy.types.Object,
) -> bpy.types.Object:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    joined = objects[0]
    joined.name = name
    joined.data.name = f"{name}_mesh"
    joined.data.materials.clear()
    joined.data.materials.append(material)
    joined.parent = root
    joined.matrix_parent_inverse = root.matrix_world.inverted()
    return joined


def build_variant(
    name: str,
    seed: int,
    scaffold_angles: Sequence[float],
    crown_scale: Sequence[float],
) -> bpy.types.Object:
    """Build one tree from trunk, scaffold, leaf, and fruit authored meshes."""
    if len(scaffold_angles) != 4:
        raise ValueError("each tree requires exactly four primary scaffold angles")
    rng = random.Random(seed)
    crown = Vector(crown_scale)

    root = bpy.data.objects.new(name, None)
    root.empty_display_type = "PLAIN_AXES"
    root.empty_display_size = 0.3
    bpy.context.scene.collection.objects.link(root)

    bark_material = bpy.data.materials["M_Tree_Bark"]
    leaf_material = bpy.data.materials["M_Tree_Leaf"]
    peach_material = bpy.data.materials["M_Tree_Peach"]

    bark_parts: list[bpy.types.Object] = []
    leaf_parts: list[bpy.types.Object] = []
    leaf_cluster_roots: list[bpy.types.Object] = []
    fruit_parts: list[bpy.types.Object] = []

    trunk_points = (
        (0.0, 0.0, 0.0),
        (0.02 * rng.uniform(-1, 1), 0.02 * rng.uniform(-1, 1), 0.48),
        (0.05 * rng.uniform(-1, 1), 0.04 * rng.uniform(-1, 1), 1.10),
        (0.04 * rng.uniform(-1, 1), 0.04 * rng.uniform(-1, 1), 1.62),
    )
    trunk = create_tapered_branch(
        f"{name}_trunk_part",
        trunk_points,
        (0.30, 0.245, 0.20, 0.14),
        radial_segments=10,
    )
    trunk.data.materials.append(bark_material)
    bark_parts.append(trunk)

    scaffold_paths: list[list[Vector]] = []
    secondary_tips: list[tuple[Vector, float]] = []
    for scaffold_index, angle in enumerate(scaffold_angles):
        direction = Vector((math.cos(angle), math.sin(angle), 0.0))
        tangent = Vector((-math.sin(angle), math.cos(angle), 0.0))
        start_z = 1.17 + scaffold_index * 0.10 + rng.uniform(-0.04, 0.04)
        horizontal = (1.56 + rng.uniform(-0.08, 0.10)) * crown.x
        path = [
            Vector((0.0, 0.0, start_z)),
            direction * (0.42 * crown.x) + Vector((0.0, 0.0, start_z + 0.35)),
            direction * (1.02 * crown.x) + tangent * rng.uniform(-0.08, 0.08)
            + Vector((0.0, 0.0, 2.22 + rng.uniform(-0.08, 0.10))),
            direction * horizontal + tangent * rng.uniform(-0.10, 0.10)
            + Vector((0.0, 0.0, 2.72 + rng.uniform(-0.10, 0.10))),
        ]
        scaffold_paths.append(path)
        branch = create_tapered_branch(
            f"{name}_primary_{scaffold_index + 1:02d}_part",
            path,
            (0.15, 0.115, 0.075, 0.038),
            radial_segments=8,
        )
        branch.data.materials.append(bark_material)
        bark_parts.append(branch)

        for side in (-1.0, 1.0):
            branch_start = path[2] * 0.75 + path[3] * 0.25
            side_angle = angle + side * (0.44 + rng.uniform(-0.08, 0.08))
            side_direction = Vector((math.cos(side_angle), math.sin(side_angle), 0.0))
            tip = (
                branch_start
                + side_direction * ((0.63 + rng.uniform(-0.06, 0.08)) * crown.y)
                + Vector((0.0, 0.0, 0.66 + rng.uniform(-0.05, 0.10)))
            )
            middle = branch_start.lerp(tip, 0.52) + Vector((0.0, 0.0, 0.10))
            secondary = create_tapered_branch(
                f"{name}_secondary_{scaffold_index + 1:02d}_{'l' if side < 0 else 'r'}_part",
                (branch_start, middle, tip),
                (0.070, 0.045, 0.020),
                radial_segments=6,
            )
            secondary.data.materials.append(bark_material)
            bark_parts.append(secondary)
            secondary_tips.append((tip, side_angle))

    for cluster_index, (tip, angle) in enumerate(secondary_tips):
        cluster = create_leaf_cluster(
            f"{name}_leaf_cluster_{cluster_index + 1:02d}_part",
            tip + Vector((0.0, 0.0, 0.02 + rng.uniform(-0.03, 0.06))),
            (
                rng.uniform(-0.20, 0.24),
                rng.uniform(-0.25, 0.25),
                angle + rng.uniform(-0.18, 0.18),
            ),
            (
                (0.72 + rng.uniform(-0.04, 0.08)) * crown.x,
                (0.62 + rng.uniform(-0.04, 0.08)) * crown.y,
                0.68,
            ),
            leaf_material,
        )
        leaf_cluster_roots.append(cluster)
        leaf_parts.extend(
            child for child in cluster.children if child.type == "MESH"
        )

    fruit_scaffolds = (0, 1, 2, 3)
    for fruit_index, scaffold_index in enumerate(fruit_scaffolds):
        path = scaffold_paths[scaffold_index]
        center = path[2].lerp(path[3], 0.62)
        center += Vector((0.0, 0.0, -0.16 + rng.uniform(-0.02, 0.03)))
        fruit_parts.append(create_peach(
            f"{name}_fruit_{fruit_index + 1:02d}_part",
            center,
            (1.0 + rng.uniform(-0.05, 0.06),) * 3,
            peach_material,
        ))

    for part in (*bark_parts, *fruit_parts, *leaf_cluster_roots):
        _parent_keep_world(part, root)

    _join_category(bark_parts, f"{name}_branch", bark_material, root)
    _join_category(leaf_parts, f"{name}_leaf", leaf_material, root)
    _join_category(fruit_parts, f"{name}_fruit", peach_material, root)
    for cluster in leaf_cluster_roots:
        bpy.data.objects.remove(cluster, do_unlink=True)
    return root


def _create_material(
    name: str,
    base_color: Sequence[float],
    roughness: float,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.diffuse_color = base_color
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = base_color
    principled.inputs["Roughness"].default_value = roughness
    return material


def build_scene() -> None:
    reset_scene()
    _create_material("M_Tree_Bark", (0.20, 0.095, 0.045, 1.0), 0.86)
    _create_material("M_Tree_Leaf", (0.17, 0.36, 0.095, 1.0), 0.78)
    _create_material("M_Tree_Peach", (0.96, 0.25, 0.095, 1.0), 0.62)

    build_variant(
        VARIANT_NAMES[0],
        1103,
        (0.08, 1.62, 3.20, 4.77),
        (1.00, 1.00, 1.00),
    )
    build_variant(
        VARIANT_NAMES[1],
        2207,
        (0.32, 1.83, 3.44, 4.96),
        (1.04, 0.97, 1.02),
    )
    build_variant(
        VARIANT_NAMES[2],
        3301,
        (-0.18, 1.38, 2.98, 4.54),
        (0.97, 1.04, 0.99),
    )
    bpy.context.view_layer.update()


def measure_variants() -> list[dict[str, object]]:
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    metrics: list[dict[str, object]] = []
    for name in VARIANT_NAMES:
        root = bpy.data.objects.get(name)
        if root is None:
            raise RuntimeError(f"missing variant root: {name}")
        mesh_objects = [
            child for child in root.children_recursive if child.type == "MESH"
        ]
        bounds: list[Vector] = []
        triangles = 0
        materials: set[str] = set()
        for obj in mesh_objects:
            evaluated = obj.evaluated_get(depsgraph)
            evaluated_mesh = evaluated.to_mesh()
            evaluated_mesh.calc_loop_triangles()
            triangles += len(evaluated_mesh.loop_triangles)
            bounds.extend(evaluated.matrix_world @ Vector(corner) for corner in evaluated.bound_box)
            materials.update(
                slot.material.name
                for slot in obj.material_slots
                if slot.material is not None
            )
            evaluated.to_mesh_clear()
        if not bounds:
            raise RuntimeError(f"variant has no authored meshes: {name}")
        minimum = Vector((
            min(point.x for point in bounds),
            min(point.y for point in bounds),
            min(point.z for point in bounds),
        ))
        maximum = Vector((
            max(point.x for point in bounds),
            max(point.y for point in bounds),
            max(point.z for point in bounds),
        ))
        metrics.append({
            "name": name,
            "heightM": round(maximum.z - minimum.z, 4),
            "crownDiameterM": round(max(maximum.x - minimum.x, maximum.y - minimum.y), 4),
            "triangles": triangles,
            "materialCount": len(materials),
        })
    return metrics


def save_and_export(
    blend_path: str | Path,
    glb_path: str | Path,
    metrics_path: str | Path,
) -> None:
    blend = Path(blend_path).resolve()
    glb = Path(glb_path).resolve()
    metrics_file = Path(metrics_path).resolve()
    for path in (blend, glb, metrics_file):
        path.parent.mkdir(parents=True, exist_ok=True)

    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    bpy.ops.object.select_all(action="DESELECT")
    for name in VARIANT_NAMES:
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
    metrics_file.write_text(
        json.dumps(measure_variants(), indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--blend", required=True)
    parser.add_argument("--glb", required=True)
    parser.add_argument("--metrics", required=True)
    return parser.parse_args(argv)


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    args = _parse_args(argv)
    build_scene()
    save_and_export(args.blend, args.glb, args.metrics)


if __name__ == "__main__":
    main()
