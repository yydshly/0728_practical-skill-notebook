"""Original retopology-first geometry for the farmer-a character.

The visible character is built from explicit manifold surface cages.  No
downloaded body, generator, primitive assembly, boolean union, or voxel remesh
participates in this module.  Cross-sections are deliberately dense around
deformation joints and remain traceable after subdivision.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any

import bpy
import bmesh
from mathutils import Vector
from mathutils.geometry import tessellate_polygon


M_SKIN = "M_Farmer_Skin"
M_HAIR = "M_Farmer_EyesHair"
M_CLOTH = "M_Farmer_Cloth"
M_GEAR = "M_Farmer_Gear"


@dataclass
class SurfaceDraft:
    vertices: list[tuple[float, float, float]] = field(default_factory=list)
    faces: list[tuple[int, ...]] = field(default_factory=list)
    materials: list[int] = field(default_factory=list)

    def face(self, indices: tuple[int, ...], material: int) -> None:
        self.faces.append(indices)
        self.materials.append(material)

    def add_section_surface(
        self,
        sections: list[tuple[tuple[float, float, float], tuple[float, float]]],
        material: int,
        sides: int = 16,
        cap_start: bool = True,
        cap_end: bool = True,
        squash: float = 0.0,
    ) -> None:
        """Add one authored quad cage from ordered anatomical cross-sections."""
        start = len(self.vertices)
        centers = [Vector(center) for center, _ in sections]
        previous_x: Vector | None = None
        for index, (center, radii) in enumerate(sections):
            point = Vector(center)
            tangent = (centers[min(index + 1, len(centers) - 1)] - centers[max(index - 1, 0)]).normalized()
            reference = Vector((0.0, 1.0, 0.0))
            if abs(tangent.dot(reference)) > 0.90:
                reference = Vector((0.0, 0.0, 1.0))
            axis_x = tangent.cross(reference).normalized()
            if previous_x is not None and axis_x.dot(previous_x) < 0:
                axis_x.negate()
            previous_x = axis_x.copy()
            axis_y = tangent.cross(axis_x).normalized()
            for side in range(sides):
                angle = math.tau * side / sides
                rx, ry = radii
                local_y = math.sin(angle) * ry
                local_y *= 1.0 - squash * max(0.0, math.cos(angle))
                vertex = point + axis_x * (math.cos(angle) * rx) + axis_y * local_y
                self.vertices.append(tuple(vertex))
        for section in range(len(sections) - 1):
            for side in range(sides):
                nxt = (side + 1) % sides
                a = start + section * sides + side
                b = start + section * sides + nxt
                c = start + (section + 1) * sides + nxt
                d = start + (section + 1) * sides + side
                self.face((a, b, c, d), material)
        if cap_start:
            center = len(self.vertices)
            self.vertices.append(sections[0][0])
            for side in range(sides):
                self.face((center, start + (side + 1) % sides, start + side), material)
        if cap_end:
            center = len(self.vertices)
            self.vertices.append(sections[-1][0])
            last = start + (len(sections) - 1) * sides
            for side in range(sides):
                self.face((center, last + side, last + (side + 1) % sides), material)

    def add_profile_solid(
        self,
        outline: list[tuple[float, float]],
        depth: tuple[float, float],
        material: int,
        transform: Any,
    ) -> None:
        """Extrude a hand/shoe/garment pattern as one connected solid."""
        start = len(self.vertices)
        front, back = depth
        for value in (front, back):
            for u, v in outline:
                self.vertices.append(tuple(transform(u, value, v)))
        count = len(outline)
        polygon = [Vector((u, v, 0.0)) for u, v in outline]
        triangles = tessellate_polygon([polygon])
        for triangle in triangles:
            # Blender 4.5 returns indices here (earlier releases returned the
            # original vectors), so normalize both representations.
            indices = tuple(
                int(point)
                if isinstance(point, int)
                else min(range(len(polygon)), key=lambda index: (polygon[index] - point).length_squared)
                for point in triangle
            )
            self.face(tuple(start + index for index in reversed(indices)), material)
            self.face(tuple(start + count + index for index in indices), material)
        for index in range(count):
            nxt = (index + 1) % count
            self.face((start + index, start + nxt, start + count + nxt, start + count + index), material)


def _create_object(name: str, draft: SurfaceDraft, materials: list[Any]) -> Any:
    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(draft.vertices, [], draft.faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.data.collections["LOD0"].objects.link(obj)
    for material in materials:
        mesh.materials.append(material)
    for polygon, material_index in zip(mesh.polygons, draft.materials):
        polygon.material_index = material_index
        polygon.use_smooth = True
    obj["construction"] = "original-explicit-manifold-surface-cage"
    obj["reference_pixels_reused"] = False
    return obj


def _apply_modifier(obj: Any, name: str, kind: str, **settings: Any) -> None:
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    modifier = obj.modifiers.new(name, kind)
    for key, value in settings.items():
        setattr(modifier, key, value)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.select_set(False)


def _create_welded_skin_surface(
    name: str,
    nodes: list[tuple[float, float, float]],
    edges: list[tuple[int, int]],
    radii: list[tuple[float, float]],
    material_index: int,
    materials: list[Any],
) -> Any:
    """Build one genuinely branched, closed quad surface from a welded graph."""
    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(nodes, edges, [])
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.data.collections["LOD0"].objects.link(obj)
    for material in materials:
        mesh.materials.append(material)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    skin = obj.modifiers.new("Welded branch skin", "SKIN")
    skin_vertices = mesh.skin_vertices[0].data
    for vertex, (radius_x, radius_y) in zip(skin_vertices, radii):
        vertex.radius = (radius_x, radius_y)
    skin_vertices[0].use_root = True
    bpy.ops.object.modifier_apply(modifier=skin.name)
    # Blender's Skin modifier can leave small one-sided branch-pole openings
    # where five anatomical chains meet. Close those actual boundary loops
    # before subdivision so the delivered surface is watertight/manifold.
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    boundary = [edge for edge in bm.edges if len(edge.link_faces) == 1]
    if boundary:
        bmesh.ops.holes_fill(bm, edges=boundary, sides=0)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    _apply_modifier(
        obj,
        "Deformation loop subdivision",
        "SUBSURF",
        levels=1,
        render_levels=1,
        subdivision_type="CATMULL_CLARK",
    )
    for polygon in obj.data.polygons:
        polygon.material_index = material_index
        polygon.use_smooth = True
    obj["construction"] = "welded-branch-quad-loops"
    obj["non_intersecting_joint_topology"] = True
    return obj


def _head_and_neck(materials: list[Any]) -> Any:
    draft = SurfaceDraft()
    # Explicit 32-sided face cage. The ordered levels provide neck, jaw,
    # cheekbone, brow, temple and crown topology without a sphere/ellipsoid.
    levels = [
        (1.400, 0.064, 0.057), (1.430, 0.066, 0.059), (1.462, 0.075, 0.066),
        (1.482, 0.097, 0.074), (1.498, 0.104, 0.078), (1.512, 0.108, 0.081),
        (1.524, 0.111, 0.084), (1.538, 0.113, 0.087), (1.550, 0.115, 0.090),
        (1.562, 0.117, 0.092), (1.575, 0.118, 0.094), (1.588, 0.117, 0.095),
        (1.600, 0.116, 0.095), (1.612, 0.114, 0.094), (1.624, 0.110, 0.092),
        (1.634, 0.105, 0.089),
        (1.662, 0.086, 0.079), (1.684, 0.060, 0.058), (1.698, 0.025, 0.026),
    ]
    sides = 48
    start = len(draft.vertices)
    for z, rx, ry in levels:
        for side in range(sides):
            angle = math.tau * side / sides
            x = math.cos(angle) * rx
            y = math.sin(angle) * ry
            front = max(0.0, -math.sin(angle))
            # Middle-aged East Asian facial planes: broad cheekbones, restrained
            # brow, low bridge, defined alar tip, mouth plane and square jaw.
            cheek = math.exp(-((abs(x) - 0.055) / 0.030) ** 2) * math.exp(-((z - 1.585) / 0.045) ** 2)
            nose = math.exp(-(x / 0.020) ** 2) * math.exp(-((z - 1.582) / 0.039) ** 2)
            nose_tip = math.exp(-(x / 0.034) ** 2) * math.exp(-((z - 1.550) / 0.018) ** 2)
            alae = sum(
                math.exp(-((x - side * 0.017) / 0.012) ** 2 - ((z - 1.543) / 0.010) ** 2)
                for side in (-1.0, 1.0)
            )
            brow = math.exp(-(x / 0.075) ** 4) * math.exp(-((z - 1.620) / 0.024) ** 2)
            mouth = math.exp(-(x / 0.048) ** 4) * math.exp(-((z - 1.515) / 0.018) ** 2)
            upper_lip = math.exp(-(x / 0.043) ** 4) * math.exp(-((z - 1.521) / 0.006) ** 2)
            lower_lip = math.exp(-(x / 0.040) ** 4) * math.exp(-((z - 1.510) / 0.006) ** 2)
            lip_crease = math.exp(-(x / 0.045) ** 4) * math.exp(-((z - 1.516) / 0.0035) ** 2)
            chin = math.exp(-(x / 0.050) ** 4) * math.exp(-((z - 1.475) / 0.028) ** 2)
            eye_socket = sum(
                math.exp(-((x - eye_x) / 0.025) ** 2 - ((z - 1.603) / 0.015) ** 2)
                for eye_x in (-0.038, 0.038)
            )
            lid_ridge = sum(
                math.exp(-((x - eye_x) / 0.027) ** 2 - ((z - 1.611) / 0.007) ** 2)
                for eye_x in (-0.038, 0.038)
            )
            if front:
                y -= front * (
                    0.012 * cheek + 0.020 * nose + 0.010 * nose_tip + 0.003 * alae
                    + 0.006 * brow + 0.003 * mouth + 0.008 * chin + 0.004 * lid_ridge
                    + 0.0035 * upper_lip + 0.003 * lower_lip
                )
                y += front * (0.006 * eye_socket + 0.003 * lip_crease)
                # Subtle lived-in asymmetry and sun/work planes prevent the
                # procedural cage reading as a perfectly mirrored mannequin.
                y -= front * 0.0022 * math.sin(x * 46.0 + 0.7) * math.exp(-((z - 1.56) / 0.09) ** 2)
                if x > 0.0:
                    y -= front * 0.0015 * math.exp(-((x - 0.048) / 0.028) ** 2 - ((z - 1.575) / 0.055) ** 2)
            if z < 1.535:
                x *= 0.90 + 0.10 * (z - 1.462) / 0.073
            # Integrated ear root/shell silhouette at the lateral head cage.
            side_lobe = math.exp(-(y / 0.030) ** 2) * math.exp(-((z - 1.565) / 0.043) ** 2)
            x += math.copysign(0.010 * side_lobe, x) if abs(x) > 0.075 else 0.0
            draft.vertices.append((x, y, z))
    for level in range(len(levels) - 1):
        for side in range(sides):
            nxt = (side + 1) % sides
            draft.face(
                (start + level * sides + side, start + level * sides + nxt,
                 start + (level + 1) * sides + nxt, start + (level + 1) * sides + side),
                0,
            )
    bottom = len(draft.vertices)
    draft.vertices.append((0.0, 0.0, 1.400))
    top = len(draft.vertices)
    draft.vertices.append((0.0, 0.0, 1.704))
    for side in range(sides):
        draft.face((bottom, start + (side + 1) % sides, start + side), 0)
        last = start + (len(levels) - 1) * sides
        draft.face((top, last + side, last + (side + 1) % sides), 0)
    obj = _create_object("farmer_body_continuous", draft, materials)
    _apply_modifier(obj, "Face cage subdivision", "SUBSURF", levels=1, render_levels=1, subdivision_type="CATMULL_CLARK")
    return obj


def _workwear(materials: list[Any]) -> Any:
    # One welded overshirt graph bridges torso into both shoulder/sleeve chains.
    # Three close graph stations straddle each elbow and wrist after Skin +
    # subdivision, replacing the old capped sleeve intersections.
    shirt_nodes = [
        (0.0, 0.008, 0.91), (0.0, 0.006, 1.03), (0.0, 0.002, 1.17),
        (0.0, 0.000, 1.29), (0.0, 0.000, 1.36),
    ]
    shirt_radii = [(0.16, 0.105), (0.175, 0.112), (0.19, 0.118), (0.205, 0.116), (0.16, 0.095)]
    shirt_edges = [(0, 1), (1, 2), (2, 3), (3, 4)]
    shoulder = 3
    for sign in (-1.0, 1.0):
        chain = [
            (sign * 0.22, 0.0, 1.34), (sign * 0.33, -0.002, 1.275),
            (sign * 0.43, -0.005, 1.205), (sign * 0.47, -0.006, 1.17),
            (sign * 0.50, -0.006, 1.145), (sign * 0.56, -0.004, 1.095),
            (sign * 0.62, -0.002, 1.055), (sign * 0.655, 0.0, 1.038),
        ]
        chain_radii = [(0.082, 0.073), (0.078, 0.070), (0.072, 0.066), (0.070, 0.064),
                       (0.068, 0.062), (0.063, 0.058), (0.056, 0.052), (0.050, 0.046)]
        first = len(shirt_nodes)
        shirt_nodes.extend(chain)
        shirt_radii.extend(chain_radii)
        shirt_edges.append((shoulder, first))
        shirt_edges.extend((first + index, first + index + 1) for index in range(len(chain) - 1))
    shirt = _create_welded_skin_surface(
        "_farmer_welded_shirt", shirt_nodes, shirt_edges, shirt_radii, 2, materials
    )

    # Trousers are a single pelvis/seat graph that branches continuously into
    # both hip, knee and ankle chains; no overlapping seat or capped leg tubes.
    trouser_nodes = [(0.0, 0.006, 1.00), (0.0, 0.006, 0.93), (0.0, 0.005, 0.86)]
    trouser_radii = [(0.145, 0.105), (0.155, 0.112), (0.14, 0.103)]
    trouser_edges = [(0, 1), (1, 2)]
    for sign in (-1.0, 1.0):
        chain = [
            (sign * 0.085, 0.004, 0.89), (sign * 0.090, 0.0, 0.76),
            (sign * 0.090, -0.003, 0.59), (sign * 0.088, -0.004, 0.54),
            (sign * 0.085, -0.003, 0.49), (sign * 0.081, 0.0, 0.38),
            (sign * 0.077, 0.003, 0.23), (sign * 0.074, 0.006, 0.10),
        ]
        chain_radii = [(0.09, 0.081), (0.084, 0.077), (0.076, 0.071), (0.074, 0.069),
                       (0.072, 0.067), (0.070, 0.065), (0.066, 0.061), (0.061, 0.056)]
        first = len(trouser_nodes)
        trouser_nodes.extend(chain)
        trouser_radii.extend(chain_radii)
        trouser_edges.append((1, first))
        trouser_edges.extend((first + index, first + index + 1) for index in range(len(chain) - 1))
    trousers = _create_welded_skin_surface(
        "_farmer_welded_trousers", trouser_nodes, trouser_edges, trouser_radii, 2, materials
    )
    bpy.ops.object.select_all(action="DESELECT")
    shirt.select_set(True)
    trousers.select_set(True)
    bpy.context.view_layer.objects.active = shirt
    bpy.ops.object.join()
    shirt.name = "farmer_layered_workwear"
    shirt["surface_components_expected"] = 2
    shirt["bridged_joints"] = "shoulders,elbows,wrists,hips,knees,ankles"
    return shirt


def _create_skin_hand(sign: float, materials: list[Any]) -> Any:
    """Create one welded palm with exactly four fingers and one thumb."""
    wrist = sign * 0.635
    nodes = [
        (wrist, 0.0, 1.035),
        (wrist + sign * 0.045, 0.0, 1.027),
        (wrist + sign * 0.080, 0.0, 1.020),
    ]
    radii = [(0.041, 0.035), (0.056, 0.043), (0.060, 0.044)]
    edges = [(0, 1), (1, 2)]
    endpoints: list[tuple[float, float, float]] = []
    # Anatomically explicit: index, middle, ring and little. The thumb is
    # authored below as a fifth, opposable branch; there is no fifth loop here.
    finger_offsets = (-0.033, -0.011, 0.012, 0.034)
    finger_lengths = (0.098, 0.112, 0.105, 0.082)
    finger_radii = (0.0132, 0.0140, 0.0132, 0.0112)
    for offset, length, radius in zip(finger_offsets, finger_lengths, finger_radii):
        first = len(nodes)
        base_x = wrist + sign * 0.080
        nodes.extend(
            [
                (base_x + sign * 0.018, offset, 1.018),
                (base_x + sign * (0.030 + length * 0.36), offset * 1.04, 1.014),
                (base_x + sign * (0.030 + length * 0.70), offset * 1.06, 1.007),
                (base_x + sign * (0.030 + length), offset * 1.04, 0.997),
            ]
        )
        radii.extend([(radius * 1.18, radius * 1.05), (radius, radius * 0.92),
                      (radius * 0.84, radius * 0.78), (radius * 0.58, radius * 0.54)])
        edges.append((2, first))
        edges.extend(((first, first + 1), (first + 1, first + 2), (first + 2, first + 3)))
        endpoints.append(nodes[-1])
    thumb_first = len(nodes)
    nodes.extend(
        [
            (wrist + sign * 0.052, -0.025, 1.018),
            (wrist + sign * 0.082, -0.050, 1.006),
            (wrist + sign * 0.110, -0.067, 0.992),
        ]
    )
    radii.extend([(0.018, 0.016), (0.014, 0.013), (0.009, 0.008)])
    edges.extend(((1, thumb_first), (thumb_first, thumb_first + 1), (thumb_first + 1, thumb_first + 2)))
    endpoints.append(nodes[-1])
    side = "l" if sign < 0 else "r"
    obj = _create_welded_skin_surface(f"_farmer_glove_{side}", nodes, edges, radii, 3, materials)
    obj["digit_branch_count"] = 5
    obj["digit_branch_semantics"] = "index,middle,ring,little,thumb"
    # Source-geometry assertions use these five endpoint groups, derived from
    # the evaluated welded surface rather than a self-authored text label.
    for index, endpoint in enumerate(endpoints, start=1):
        nearest = min(obj.data.vertices, key=lambda vertex: (vertex.co - Vector(endpoint)).length_squared)
        group = obj.vertex_groups.new(name=f"digit_{side}_{index}")
        group.add([nearest.index], 1.0, "REPLACE")
    return obj


def _gear(materials: list[Any]) -> Any:
    draft = SurfaceDraft()
    # Shoes use a rounded authored last with heel counter, instep, toe spring
    # and a broad slip-resistant sole instead of a beveled box.
    for sign in (-1.0, 1.0):
        draft.add_section_surface(
            [
                ((sign * 0.075, 0.065, 0.058), (0.057, 0.046)),
                ((sign * 0.075, 0.030, 0.061), (0.063, 0.052)),
                ((sign * 0.075, -0.025, 0.064), (0.069, 0.055)),
                ((sign * 0.075, -0.085, 0.058), (0.073, 0.049)),
                ((sign * 0.075, -0.145, 0.048), (0.076, 0.038)),
                ((sign * 0.075, -0.190, 0.038), (0.074, 0.027)),
                ((sign * 0.075, -0.205, 0.034), (0.060, 0.021)),
            ],
            3,
            sides=18,
        )
    # Soft-brim hat is a stitched surface of revolution with a deliberately
    # irregular crown profile, not stacked cylinder primitives.
    hat_sections = [
        ((0.0, 0.0, 1.665), (0.178, 0.150)),
        ((0.0, 0.0, 1.672), (0.181, 0.153)),
        ((0.0, 0.0, 1.680), (0.145, 0.124)),
        ((0.0, 0.0, 1.688), (0.118, 0.104)),
        ((0.0, 0.0, 1.705), (0.113, 0.100)),
        ((0.0, 0.0, 1.728), (0.105, 0.094)),
        ((0.0, 0.0, 1.746), (0.083, 0.075)),
        ((0.0, 0.0, 1.756), (0.030, 0.028)),
    ]
    draft.add_section_surface(hat_sections, 3, sides=40)
    obj = _create_object("farmer_hat_gloves_shoes", draft, materials)
    # Branching skin cages produce one manifold glove per hand, with connected
    # palms, opposed thumbs, tapered phalanges and enough loops at every finger
    # base to deform cleanly. Join them into the gear mesh after evaluation so
    # the runtime still exports one semantic gear node/material assignment.
    gloves = [_create_skin_hand(sign, materials) for sign in (-1.0, 1.0)]
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    for glove in gloves:
        glove.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.join()
    obj.name = "farmer_hat_gloves_shoes"
    obj["hat_component"] = True
    return obj


def _details(materials: list[Any]) -> tuple[Any, Any]:
    work = SurfaceDraft()
    # Placket, pocket bags/flaps, cuffs and collar use tailored pattern solids.
    rectangles = [
        ((-0.012, -0.132, 1.080), (0.012, -0.120, 1.350)),
        ((-0.135, -0.132, 1.175), (-0.035, -0.120, 1.285)),
        ((0.035, -0.132, 1.175), (0.135, -0.120, 1.285)),
    ]
    for low, high in rectangles:
        x0, y0, z0 = low
        x1, y1, z1 = high
        start = len(work.vertices)
        work.vertices.extend(
            [(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1),
             (x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)]
        )
        for face in ((0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)):
            work.face(tuple(start + value for value in face), 2)
    # Folded collar wings.
    for sign in (-1.0, 1.0):
        start = len(work.vertices)
        work.vertices.extend(
            [
                (0.0, -0.128, 1.365), (sign * 0.105, -0.105, 1.385),
                (sign * 0.075, -0.145, 1.318), (sign * 0.012, -0.145, 1.330),
            ]
        )
        work.face((start, start + 1, start + 2, start + 3), 2)
    # Warm off-white base layer visible inside the open collar.
    start = len(work.vertices)
    work.vertices.extend(
        [(-0.065, -0.116, 1.320), (0.065, -0.116, 1.320), (0.052, -0.114, 1.382), (-0.052, -0.114, 1.382)]
    )
    work.face((start, start + 1, start + 2, start + 3), 3)
    button_outline = [
        (math.cos(math.tau * index / 10) * 0.008, math.sin(math.tau * index / 10) * 0.008)
        for index in range(10)
    ]
    for z in (1.115, 1.180, 1.245, 1.305):
        work.add_profile_solid(
            button_outline,
            (-0.137, -0.132),
            3,
            lambda u, depth, v, z=z: Vector((u, depth, z + v)),
        )
    # Constructed cuffs and load wrinkles. These follow the garment surface
    # and are skinned with it; they are not painted lines or floating labels.
    for sign in (-1.0, 1.0):
        work.add_section_surface(
            [
                ((sign * 0.605, -0.006, 1.069), (0.058, 0.054)),
                ((sign * 0.635, -0.002, 1.049), (0.054, 0.050)),
                ((sign * 0.654, 0.0, 1.039), (0.051, 0.047)),
            ],
            2,
            sides=12,
            squash=0.08,
        )
        # Elbow compression folds and knee dart seams give the workwear a
        # specific orchard-worker history at gameplay viewing distance.
        for x, z, radius in ((sign * 0.468, 1.176, 0.0045), (sign * 0.088, 0.545, 0.0040)):
            work.add_section_surface(
                [((x - sign * 0.035, -0.071, z + 0.018), (radius, radius)),
                 ((x, -0.075, z), (radius, radius)),
                 ((x + sign * 0.035, -0.070, z - 0.018), (radius, radius))],
                2,
                sides=8,
            )
    # Double shoulder-yoke seam and trouser fly construction.
    for z in (1.318, 1.326):
        work.add_section_surface(
            [((-0.17, -0.115, z), (0.0035, 0.0035)), ((0.0, -0.126, z + 0.004), (0.0035, 0.0035)),
             ((0.17, -0.115, z), (0.0035, 0.0035))],
            2,
            sides=8,
        )
    work.add_section_surface(
        [((0.0, -0.112, 0.98), (0.004, 0.004)), ((0.0, -0.116, 0.91), (0.004, 0.004)),
         ((0.018, -0.112, 0.865), (0.004, 0.004))],
        2,
        sides=8,
    )
    work_obj = _create_object("farmer_workwear_details", work, materials)
    _apply_modifier(work_obj, "Tailored edge bevel", "BEVEL", width=0.0025, segments=2, affect="EDGES")

    face = SurfaceDraft()
    # Cropped hair cap with a broken, side-parted hairline.
    hair_levels = [
        (1.612, 0.103, 0.081), (1.638, 0.102, 0.084), (1.665, 0.090, 0.078),
        (1.688, 0.060, 0.055), (1.700, 0.020, 0.020),
    ]
    sides = 48
    for z, rx, ry in hair_levels:
        for side in range(sides):
            angle = math.tau * side / sides
            front = max(0.0, -math.sin(angle))
            hairline = 0.004 * front * (0.55 + 0.45 * math.sin(angle * 5.0 + 0.7))
            face.vertices.append((math.cos(angle) * rx, math.sin(angle) * ry + 0.010, z + hairline))
    for level in range(len(hair_levels) - 1):
        for side in range(sides):
            nxt = (side + 1) % sides
            a = level * sides + side
            b = level * sides + nxt
            c = (level + 1) * sides + nxt
            d = (level + 1) * sides + side
            face.face((a, b, c, d), 1)
    # Eye/lid lenses and irises, ear shells, brows and integrated mouth plane.
    def lens(cx: float, cy: float, cz: float, rx: float, rz: float, material: int, color_depth: float = 0.002) -> None:
        start = len(face.vertices)
        points = 20
        face.vertices.append((cx, cy - color_depth, cz))
        for index in range(points):
            angle = math.tau * index / points
            face.vertices.append((cx + math.cos(angle) * rx, cy, cz + math.sin(angle) * rz))
        for index in range(points):
            face.face((start, start + 1 + index, start + 1 + (index + 1) % points), material)

    for sign in (-1.0, 1.0):
        # A warm sclera, restrained iris and skin-colored lid ribbons read as
        # an eye assembly rather than the former black painted dash.
        lens(sign * 0.037, -0.1025, 1.603, 0.0125, 0.0021, 0, 0.0005)
        lens(sign * 0.037, -0.1040, 1.603, 0.0027, 0.0020, 1, 0.0004)
        for lid_z, crown in ((1.606, 0.0022), (1.600, -0.0014)):
            start = len(face.vertices)
            points = 10
            for index in range(points):
                t = index / (points - 1)
                x = sign * 0.037 + (t - 0.5) * 0.037
                arch = math.sin(math.pi * t)
                face.vertices.extend(
                    [
                        (x, -0.1060, lid_z + crown * arch),
                        (x, -0.1038, lid_z + crown * arch + (0.0018 if crown > 0 else -0.0015)),
                    ]
                )
            for index in range(points - 1):
                a = start + index * 2
                face.face((a, a + 2, a + 3, a + 1), 0)
        # brow is a tapered quadrilateral rather than a bar.
        start = len(face.vertices)
        face.vertices.extend(
            [
                (sign * 0.020, -0.100, 1.625), (sign * 0.058, -0.095, 1.623),
                (sign * 0.055, -0.096, 1.627), (sign * 0.023, -0.101, 1.630),
            ]
        )
        face.face((start, start + 1, start + 2, start + 3), 1)
        # Projected ear shell plus a recessed concha mark; the outer shell sits
        # beyond the skull silhouette and therefore reads in profile.
        ear_outline = [
            (0.000, 0.034), (0.010, 0.028), (0.014, 0.010),
            (0.013, -0.020), (0.005, -0.035), (-0.005, -0.030),
            (-0.009, -0.010), (-0.008, 0.020),
        ]
        face.add_profile_solid(
            ear_outline,
            (0.112 * sign, 0.119 * sign),
            0,
            lambda u, depth, v, sign=sign: Vector((depth, -0.003 - abs(u) * 0.18, 1.565 + v)),
        )
        lens(sign * 0.119, -0.006, 1.565, 0.0022, 0.010, 0, 0.0005)
        # Under-eye crease provides age/readability without pore-scale noise.
        start = len(face.vertices)
        face.vertices.extend(
            [
                (sign * 0.020, -0.100, 1.591), (sign * 0.055, -0.096, 1.590),
                (sign * 0.052, -0.095, 1.588), (sign * 0.024, -0.101, 1.588),
            ]
        )
        face.face((start, start + 1, start + 2, start + 3), 0)
    # Nose bridge, sidewalls, alae and tip are displaced directly from the
    # closed 48-sided head cage above; no detached nose shell is used here.
    # The head cage already carries the vermilion volume.  A very narrow,
    # asymmetric crease supplies the remaining mouth read without separate
    # tubular lip pieces floating in front of the muzzle.
    face.add_profile_solid(
        [
            (-0.024, 0.0002), (-0.016, 0.0010), (-0.006, 0.0005),
            (0.005, 0.0008), (0.015, 0.0001), (0.023, -0.0006),
            (0.014, -0.0010), (0.004, -0.0007), (-0.007, -0.0008),
            (-0.017, -0.0004),
        ],
        (-0.1115, -0.1095),
        1,
        lambda u, depth, v: Vector((u, depth, 1.516 + v)),
    )
    # The irregular hairline and anisotropic texture carry the cropped side
    # part; the former pasted-on strip geometry is intentionally absent.
    face_obj = _create_object("farmer_face_detail", face, materials)
    face_obj["character_read"] = "Chinese orchard worker, age 40-55"
    face_obj["modeled_features"] = "eyelids,sclera,irises,nose bridge tip alae,lips,ear helix concha,cheek jaw brow age creases,cropped hair"
    return work_obj, face_obj


def _unwrap_and_color(objects: list[Any]) -> None:
    for obj in objects:
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        if any(len(polygon.vertices) > 4 for polygon in obj.data.polygons):
            _apply_modifier(
                obj,
                "Export-safe triangulation",
                "TRIANGULATE",
                quad_method="BEAUTY",
                ngon_method="BEAUTY",
            )
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(angle_limit=math.radians(52), island_margin=0.020, area_weight=0.55)
        bpy.ops.uv.pack_islands(rotate=True, margin=0.022)
        bpy.ops.object.mode_set(mode="OBJECT")
        obj.select_set(False)
    for obj in objects:
        attribute = obj.data.color_attributes.get("wear_color") or obj.data.color_attributes.new(
            name="wear_color", type="BYTE_COLOR", domain="CORNER"
        )
        for polygon in obj.data.polygons:
            center = polygon.center
            material = polygon.material_index
            if material == 0:
                base = [0.52, 0.29, 0.19]
                if center.z < 1.45:
                    base = [0.48, 0.25, 0.16]
                if (
                    obj.name == "farmer_face_detail"
                    and 1.596 < center.z < 1.609
                    and 0.018 < abs(center.x) < 0.060
                    and center.y < -0.095
                ):
                    base = [0.58, 0.47, 0.38]
                elif obj.name == "farmer_face_detail" and 1.505 < center.z < 1.527 and center.y < -0.08:
                    base = [0.49, 0.19, 0.16]
            elif material == 1:
                base = [0.025, 0.018, 0.014]
            elif material == 2:
                base = [0.105, 0.205, 0.145] if center.z > 1.0 else [0.035, 0.075, 0.125]
                fade = max(0.0, min(1.0, (center.z - 1.15) / 0.30))
                base = [value + fade * 0.025 for value in base]
            else:
                if center.z < 0.20:
                    base = [0.025, 0.030, 0.028]
                elif center.z > 1.60:
                    base = [0.44, 0.39, 0.27]
                elif obj.name == "farmer_workwear_details" and center.z > 1.315:
                    base = [0.76, 0.72, 0.62]
                elif abs(center.x) > 0.55:
                    base = [0.72, 0.69, 0.58]
                else:
                    base = [0.22, 0.20, 0.15]
            dust = max(0.0, min(0.08, (0.36 - center.z) * 0.12))
            variation = 0.004 * math.sin(center.x * 91.0 + center.y * 67.0 + center.z * 53.0)
            color = tuple(max(0.0, min(1.0, value + dust + variation)) for value in base) + (1.0,)
            for loop_index in polygon.loop_indices:
                attribute.data[loop_index].color = color
        obj["uv_method"] = "multi-object unique-island pack"
        obj["joint_loop_policy"] = "minimum-three-compact-rings-at-major-bends"
        obj.select_set(False)


def build_character_geometry(materials: dict[str, Any]) -> list[Any]:
    material_list = [materials[M_SKIN], materials[M_HAIR], materials[M_CLOTH], materials[M_GEAR]]
    body = _head_and_neck(material_list)
    clothes = _workwear(material_list)
    gear = _gear(material_list)
    details, face = _details(material_list)
    objects = [body, clothes, details, gear, face]
    _unwrap_and_color(objects)
    return objects
