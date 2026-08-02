"""Real-Blender regressions for the authored overall-scene peach trees."""

from pathlib import Path
import sys
import tempfile
import unittest

import bpy
from mathutils import Matrix, Vector


PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT / "tools" / "blender"))

import build_peach_tree_overall  # noqa: E402
import build_orchard_world_overall  # noqa: E402


class PeachOrchardSceneRegressions(unittest.TestCase):
    def test_leaf_cluster_returns_parent_with_three_applied_leaf_meshes(self):
        build_peach_tree_overall.reset_scene()
        material = bpy.data.materials.new("M_Tree_Leaf")
        cluster = build_peach_tree_overall.create_leaf_cluster(
            "test_leaf_cluster",
            (1.0, 2.0, 3.0),
            (0.2, -0.1, 0.4),
            (0.8, 0.7, 0.6),
            material,
        )

        self.assertEqual(cluster.type, "EMPTY")
        leaves = [child for child in cluster.children if child.type == "MESH"]
        self.assertEqual(len(leaves), 3)
        for leaf in leaves:
            self.assertEqual(leaf.matrix_world, Matrix.Identity(4))
            self.assertEqual(leaf.data.materials[0], material)

    def test_tree_family_has_three_authored_variants(self):
        build_peach_tree_overall.build_scene()
        roots = [
            bpy.data.objects.get(f"peach_tree_variant_{suffix}")
            for suffix in "abc"
        ]
        self.assertTrue(all(root is not None for root in roots))
        for root in roots:
            meshes = [
                child
                for child in root.children_recursive
                if child.type == "MESH"
            ]
            self.assertLessEqual(len(meshes), 3)
            self.assertTrue(any("branch" in mesh.name for mesh in meshes))
            self.assertTrue(any("leaf" in mesh.name for mesh in meshes))
            self.assertTrue(any("fruit" in mesh.name for mesh in meshes))

    def test_tree_family_has_workable_dimensions_and_budget(self):
        build_peach_tree_overall.build_scene()
        metrics = build_peach_tree_overall.measure_variants()
        for metric in metrics:
            self.assertGreaterEqual(metric["heightM"], 3.2)
            self.assertLessEqual(metric["heightM"], 4.0)
            self.assertGreaterEqual(metric["crownDiameterM"], 3.5)
            self.assertLessEqual(metric["crownDiameterM"], 4.5)
            self.assertLessEqual(metric["triangles"], 3_500)
        self.assertLessEqual(len(bpy.data.materials), 4)


class OrchardWorldShellRegressions(unittest.TestCase):
    @staticmethod
    def _mesh_world_vertices(root_name):
        root = bpy.data.objects[root_name]
        return [
            obj.matrix_world @ vertex.co
            for obj in root.children_recursive
            if obj.type == "MESH"
            for vertex in obj.data.vertices
        ]

    @classmethod
    def _marker_box_vertex_count(cls, root_names, marker_name):
        marker = bpy.data.objects[marker_name].matrix_world.translation
        return sum(
            1
            for root_name in root_names
            for point in cls._mesh_world_vertices(root_name)
            if abs(point.x - marker.x) <= 0.52
            and abs(point.y - marker.y) <= 0.46
            and 0.2 <= point.z <= 0.9
        )

    def test_world_shell_contains_authored_landmark_groups(self):
        build_orchard_world_overall.build_scene()
        for name in (
            "farmhouse_yard",
            "village_road",
            "orchard_gate",
            "orchard_parking",
            "background_dressing",
            "crate_instances",
            "orchard_parking_anchor",
            "harvest_basket_anchor",
            "packing_crate_anchor",
            "farmhouse_delivery_anchor",
            "harvest_basket_empty",
            "harvest_basket_full",
            "packing_crate_empty",
            "packing_crate_full",
            "delivery_complete",
        ):
            root = bpy.data.objects.get(name)
            self.assertIsNotNone(root, name)
            if not name.endswith("_anchor"):
                self.assertGreater(len(root.children_recursive), 0, name)

    def test_world_shell_contains_continuous_orchard_soil_surface(self):
        build_orchard_world_overall.build_scene()
        surface = bpy.data.objects.get("orchard_soil_surface")

        self.assertIsNotNone(surface)
        self.assertEqual(surface.type, "MESH")
        self.assertEqual(surface.parent, bpy.data.objects["orchard_parking"])
        self.assertEqual(
            {slot.material.name for slot in surface.material_slots if slot.material},
            {"M_Soil"},
        )

        points = [surface.matrix_world @ vertex.co for vertex in surface.data.vertices]
        runtime_x = [point.x for point in points]
        runtime_y = [point.z for point in points]
        runtime_z = [-point.y for point in points]
        self.assertLessEqual(min(runtime_x), -18.0)
        self.assertGreaterEqual(max(runtime_x), 18.0)
        self.assertLessEqual(min(runtime_z), 7.0)
        self.assertGreaterEqual(max(runtime_z), 31.0)
        self.assertGreaterEqual(max(runtime_y), -0.02)
        self.assertLessEqual(max(runtime_y), 0.001)

    def test_world_shell_pins_task_one_anchors_and_crate_instance_contract(self):
        build_orchard_world_overall.build_scene()
        expected_anchors = {
            # Blender is Z-up. The exporter maps (x, y, z) to glTF
            # (x, z, -y), so these literals become Task 1's Y-up points.
            "orchard_parking_anchor": (0.0, -10.5, 0.0),
            "harvest_basket_anchor": (2.6, -12.5, 0.0),
            "packing_crate_anchor": (1.4, -12.5, 0.0),
            "farmhouse_delivery_anchor": (0.0, 18.0, 0.0),
        }
        for name, expected in expected_anchors.items():
            anchor = bpy.data.objects[name]
            actual = tuple(round(value, 4) for value in anchor.matrix_world.translation)
            self.assertEqual(actual, expected, name)

        crate_root = bpy.data.objects["crate_instances"]
        crate_source = bpy.data.objects.get("crate_source")
        self.assertIsNotNone(crate_source)
        self.assertEqual(crate_source.parent, bpy.data.objects["crate_marker_01"])
        self.assertEqual(tuple(crate_source.location), (0.0, 0.0, 0.0))
        for index in range(1, 9):
            marker = bpy.data.objects.get(f"crate_marker_{index:02d}")
            self.assertIsNotNone(marker)
            self.assertEqual(marker.parent, crate_root)
            self.assertAlmostEqual(marker.matrix_world.translation.z, 0.0, places=4)

    def test_world_shell_has_no_camera_light_or_debug_mesh(self):
        build_orchard_world_overall.build_scene()
        self.assertFalse(any(obj.type in {"CAMERA", "LIGHT"} for obj in bpy.data.objects))
        self.assertFalse(any(obj.name.lower().startswith("debug") for obj in bpy.data.objects))
        self.assertEqual(
            {material.name for material in bpy.data.materials},
            {
                "M_Wall", "M_Roof", "M_Metal", "M_Concrete",
                "M_Soil", "M_PropGreen", "M_BackgroundField",
                "M_BackgroundHill",
            },
        )
        metrics = build_orchard_world_overall.measure_scene()
        self.assertLessEqual(metrics["triangles"], 120_000)
        self.assertLessEqual(metrics["materialCount"], 12)
        self.assertLessEqual(metrics["primitiveCount"], 60)

    def test_product_scene_uses_only_crate_source_at_instance_markers(self):
        build_orchard_world_overall.build_scene()
        crate_root = bpy.data.objects["crate_instances"]
        self.assertEqual(
            [obj.name for obj in crate_root.children_recursive if obj.type == "MESH"],
            ["crate_source"],
        )
        self.assertFalse(any(obj.name.startswith("review_only_crate_") for obj in bpy.data.objects))
        non_instance_roots = tuple(name for name in build_orchard_world_overall.ROOT_NAMES if name != "crate_instances")
        for index in range(2, 9):
            self.assertEqual(
                self._marker_box_vertex_count(non_instance_roots, f"crate_marker_{index:02d}"),
                0,
                f"marker {index:02d} has residual static crate geometry",
            )

    def test_exported_world_has_no_residual_static_marker_crates(self):
        build_orchard_world_overall.build_scene()
        with tempfile.TemporaryDirectory() as temporary_directory:
            temporary = Path(temporary_directory)
            glb = temporary / "visual.glb"
            build_orchard_world_overall.save_and_export(
                temporary / "world.blend",
                glb,
                temporary / "metrics.json",
            )
            build_orchard_world_overall.reset_scene()
            bpy.ops.import_scene.gltf(filepath=str(glb))

        crate_sources = [obj for obj in bpy.data.objects if obj.name == "crate_source" and obj.type == "MESH"]
        self.assertEqual(len(crate_sources), 1)
        self.assertEqual(crate_sources[0].parent.name, "crate_marker_01")
        non_instance_roots = tuple(name for name in build_orchard_world_overall.ROOT_NAMES if name != "crate_instances")
        for index in range(2, 9):
            self.assertEqual(
                self._marker_box_vertex_count(non_instance_roots, f"crate_marker_{index:02d}"),
                0,
                f"exported marker {index:02d} has residual static crate geometry",
            )

    def test_delivery_anchor_has_authored_ground_mark(self):
        build_orchard_world_overall.build_scene()
        anchor = bpy.data.objects["farmhouse_delivery_anchor"]
        ground_mark = bpy.data.objects.get("farmhouse_delivery_ground_mark")
        self.assertIsNotNone(ground_mark)
        self.assertEqual(ground_mark.type, "MESH")
        points = [ground_mark.matrix_world @ vertex.co for vertex in ground_mark.data.vertices]
        minimum = Vector((min(point.x for point in points), min(point.y for point in points), min(point.z for point in points)))
        maximum = Vector((max(point.x for point in points), max(point.y for point in points), max(point.z for point in points)))
        center = (minimum + maximum) * 0.5
        self.assertAlmostEqual(center.x, anchor.matrix_world.translation.x, places=4)
        self.assertAlmostEqual(center.y, anchor.matrix_world.translation.y, places=4)
        self.assertGreaterEqual(minimum.z, 0.0)
        self.assertLessEqual(maximum.z, 0.12)
        self.assertEqual(
            {slot.material.name for slot in ground_mark.material_slots if slot.material},
            {"M_Concrete", "M_Wall"},
        )

    def test_world_shell_authors_background_and_surface_variation(self):
        build_orchard_world_overall.build_scene()
        for name in (
            "farmhouse_surface_repairs", "yard_surface_repairs", "road_surface_repairs",
        ):
            detail = bpy.data.objects.get(name)
            self.assertIsNotNone(detail, name)
            self.assertEqual(detail.type, "MESH", name)
            self.assertGreater(len(detail.data.polygons), 0, name)

        background_vertices = self._mesh_world_vertices("background_dressing")
        tree_heights = []
        for suffix in "abc":
            marker = bpy.data.objects.get(f"background_tree_variant_{suffix}")
            self.assertIsNotNone(marker, suffix)
            center = marker.matrix_world.translation
            nearby = [
                point for point in background_vertices
                if abs(point.x - center.x) <= 1.8 and abs(point.y - center.y) <= 1.3
            ]
            self.assertTrue(nearby, suffix)
            tree_heights.append(round(max(point.z for point in nearby), 2))
        self.assertEqual(len(set(tree_heights)), 3)

        house_profiles = []
        for suffix in "abc":
            marker = bpy.data.objects.get(f"background_house_variant_{suffix}")
            self.assertIsNotNone(marker, suffix)
            center = marker.matrix_world.translation
            nearby = [
                point for point in background_vertices
                if abs(point.x - center.x) <= 4.0 and abs(point.y - center.y) <= 2.2
            ]
            self.assertTrue(nearby, suffix)
            house_profiles.append((
                round(max(point.x for point in nearby) - min(point.x for point in nearby), 2),
                round(max(point.z for point in nearby), 2),
            ))
        self.assertEqual(len(set(house_profiles)), 3)


if __name__ == "__main__":
    unittest.main(argv=[__file__])
