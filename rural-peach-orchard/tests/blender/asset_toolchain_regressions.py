"""Real-Blender regression coverage for the orchard asset toolchain."""

from __future__ import annotations

import contextlib
import io
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path
from typing import Any

import bpy
import numpy as np


REPOSITORY = Path(__file__).resolve().parents[2]
TOOLS = REPOSITORY / "tools" / "blender"
sys.path.insert(0, str(TOOLS))

import export_asset  # noqa: E402
import scene_contract  # noqa: E402
import validate_scene  # noqa: E402
import review_farmer_character  # noqa: E402


def _reset_scene() -> None:
    fresh_scene = bpy.data.scenes.new("_TEST_RESET")
    bpy.context.window.scene = fresh_scene
    for scene in list(bpy.data.scenes):
        if scene != fresh_scene:
            bpy.data.scenes.remove(scene)
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for collection in list(bpy.data.collections):
        bpy.data.collections.remove(collection)
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)

    fresh_scene.name = "SCENE"
    fresh_scene.unit_settings.system = "METRIC"
    fresh_scene.unit_settings.scale_length = 1.0
    fresh_scene.unit_settings.length_unit = "METERS"

    visual = bpy.data.collections.new("VISUAL")
    collision = bpy.data.collections.new("COLLISION")
    sockets = bpy.data.collections.new("SOCKETS")
    rig = bpy.data.collections.new("RIG")
    for collection in (visual, collision, sockets, rig):
        fresh_scene.collection.children.link(collection)
    for name in ("LOD0", "LOD1", "LOD2"):
        visual.children.link(bpy.data.collections.new(name))


def _contract(*, allow_empty: bool = False) -> dict[str, Any]:
    return {
        "assetId": "test.regression",
        "requiredCollections": ["VISUAL", "COLLISION", "SOCKETS", "RIG"],
        "requiredNodes": [],
        "requiredAnimations": [],
        "requiredAnimationEvents": {},
        "allowEmpty": allow_empty,
    }


def _character_contract() -> dict[str, Any]:
    contract = _contract()
    contract.update(
        {
            "assetId": "character.farmer-a",
            "kind": "character",
            "requiredNodes": ["root"],
            "requiredAnimations": ["idle", "walk"],
            "requiredAnimationEvents": {},
        }
    )
    return contract


def _empty(name: str, collection: str) -> Any:
    obj = bpy.data.objects.new(name, None)
    bpy.data.collections[collection].objects.link(obj)
    return obj


def _mesh(name: str, collection: str) -> Any:
    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata([(0.0, 0.0, 0.0), (1.0, 0.0, 0.0), (0.0, 1.0, 0.0)], [], [(0, 1, 2)])
    obj = bpy.data.objects.new(name, mesh)
    bpy.data.collections[collection].objects.link(obj)
    return obj


def _armature_with_root(name: str, collection: str) -> Any:
    armature_data = bpy.data.armatures.new(f"{name}_data")
    armature = bpy.data.objects.new(name, armature_data)
    bpy.data.collections[collection].objects.link(armature)
    bpy.context.view_layer.objects.active = armature
    armature.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    root = armature_data.edit_bones.new("root")
    root.head = (0.0, 0.0, 0.0)
    root.tail = (0.0, 0.0, 1.0)
    bpy.ops.object.mode_set(mode="OBJECT")
    armature.select_set(False)
    return armature


def _animate_location(obj: Any, name: str = "idle") -> Any:
    obj.location = (0.0, 0.0, 0.0)
    obj.keyframe_insert(data_path="location", frame=1)
    obj.location = (0.0, 0.0, 0.1)
    obj.keyframe_insert(data_path="location", frame=10)
    bpy.context.scene.frame_set(1)
    action = obj.animation_data.action
    action.name = name
    return action


def _codes(contract: dict[str, Any]) -> set[str]:
    return {issue["code"] for issue in validate_scene.collect_scene_issues(contract)}


def _run_main(module: Any, contract_value: Any) -> tuple[int | None, dict[str, Any] | None, Exception | None]:
    temp_root = REPOSITORY / ".tmp"
    temp_root.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(dir=temp_root) as directory:
        contract_path = Path(directory) / "contract.json"
        output_path = Path(directory) / "output"
        contract_path.write_text(json.dumps(contract_value), encoding="utf-8")
        previous_argv = sys.argv
        arguments = ["blender", "--", str(contract_path)]
        if module is export_asset:
            arguments.append(str(output_path))
        sys.argv = arguments
        stream = io.StringIO()
        try:
            with contextlib.redirect_stdout(stream):
                result = module._main()
            error = None
        except Exception as caught:
            result = None
            error = caught
        finally:
            sys.argv = previous_argv
        output = stream.getvalue().strip()
        payload = json.loads(output) if output else None
        return result, payload, error


def _export_mutated_farmer(destination: Path, mutate: Any) -> Path:
    """Import the checked-in farmer GLB, mutate real decoded data, and export it again."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    source = REPOSITORY / "public/assets/character/farmer-a/visual.glb"
    bpy.ops.import_scene.gltf(filepath=str(source))
    mutate()
    export_asset._export_glb(destination, list(bpy.context.scene.objects), include_animations=True)
    return destination


class AssetToolchainRegressions(unittest.TestCase):
    def setUp(self) -> None:
        _reset_scene()

    def test_actual_visual_graph_cannot_overlap_collision_by_object_identity(self) -> None:
        rig_shared = _empty("box_rig_shared", "RIG")
        bpy.data.collections["COLLISION"].objects.link(rig_shared)
        socket_shared = _empty("box_socket_shared", "SOCKETS")
        bpy.data.collections["COLLISION"].objects.link(socket_shared)

        self.assertIn("VISUAL_COLLISION_OVERLAP", _codes(_contract()))

    def test_required_collections_reject_multiple_parents_and_orphans(self) -> None:
        bpy.data.collections["SOCKETS"].children.link(bpy.data.collections["RIG"])
        orphan = bpy.data.collections.new("EXTRA_REQUIRED")
        contract = _contract(allow_empty=True)
        contract["requiredCollections"].append(orphan.name)

        codes = _codes(contract)
        self.assertIn("MULTIPLE_COLLECTION_PARENTS", codes)
        self.assertIn("UNLINKED_REQUIRED_COLLECTION", codes)

    def test_collection_parent_identity_survives_duplicate_display_names(self) -> None:
        alias_parent = bpy.data.collections.new("SCENE")
        bpy.context.scene.collection.children.link(alias_parent)
        alias_parent.children.link(bpy.data.collections["RIG"])

        self.assertIn(
            "MULTIPLE_COLLECTION_PARENTS",
            _codes(_contract(allow_empty=True)),
        )

    def test_collection_instance_in_export_graph_is_rejected(self) -> None:
        backup = bpy.data.collections.new("SOURCE_BACKUP")
        bpy.context.scene.collection.children.link(backup)
        _mesh("backup_geo", backup.name)
        instance = _empty("instance_proxy", "LOD0")
        instance.instance_type = "COLLECTION"
        instance.instance_collection = backup
        contract = _contract()
        contract["requiredNodes"] = [instance.name]

        self.assertIn("UNSUPPORTED_COLLECTION_INSTANCE", _codes(contract))

    def test_raw_collection_instance_leak_is_rejected_by_post_export_verifier(self) -> None:
        backup = bpy.data.collections.new("SOURCE_BACKUP")
        bpy.context.scene.collection.children.link(backup)
        backup_geo = _mesh("backup_geo", backup.name)
        instance = _empty("instance_proxy", "LOD0")
        instance.instance_type = "COLLECTION"
        instance.instance_collection = backup

        temp_root = REPOSITORY / ".tmp"
        temp_root.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=temp_root) as directory:
            visual_path = Path(directory) / "visual.glb"
            visual_objects = list(scene_contract.visual_export_objects())
            export_asset._export_glb(visual_path, visual_objects, include_animations=False)
            visual_document = export_asset._read_glb_json(visual_path)
            self.assertEqual(
                {backup_geo.name, instance.name},
                {
                    node["name"]
                    for node in visual_document.get("nodes", [])
                    if "name" in node
                },
            )
            with self.assertRaises(export_asset._ExportVerificationError) as caught:
                export_asset._verify_exported_objects(
                    visual_document,
                    {"nodes": []},
                    visual_objects,
                    [],
                )
            self.assertEqual("UNEXPECTED_EXPORTED_OBJECT", caught.exception.code)

    def test_required_nodes_must_belong_to_actual_output_graph(self) -> None:
        direct = _mesh("direct_visual", "VISUAL")
        extra = bpy.data.collections.new("EXTRA_VISUAL")
        bpy.data.collections["VISUAL"].children.link(extra)
        extra_node = bpy.data.objects.new("extra_visual", None)
        extra.objects.link(extra_node)
        backup = bpy.data.collections.new("SOURCE_BACKUP")
        bpy.context.scene.collection.children.link(backup)
        backup_node = bpy.data.objects.new("backup_node", None)
        backup.objects.link(backup_node)
        contract = _contract()
        contract["requiredNodes"] = [direct.name, extra_node.name, backup_node.name]

        issues = validate_scene.collect_scene_issues(contract)
        codes = {issue["code"] for issue in issues}
        missing = {issue.get("node") for issue in issues if issue["code"] == "MISSING_REQUIRED_NODE"}
        self.assertIn("UNSUPPORTED_VISUAL_OBJECT_PLACEMENT", codes)
        self.assertIn("UNSUPPORTED_VISUAL_COLLECTION", codes)
        self.assertEqual({direct.name, extra_node.name, backup_node.name}, missing)

    def test_required_bone_must_belong_to_exported_armature(self) -> None:
        backup = bpy.data.collections.new("SOURCE_BACKUP")
        bpy.context.scene.collection.children.link(backup)
        _armature_with_root("backup_rig", backup.name)
        contract = _contract(allow_empty=True)
        contract["requiredNodes"] = ["root"]

        self.assertIn("MISSING_REQUIRED_NODE", _codes(contract))

    def test_required_animation_must_have_channels_on_exported_target(self) -> None:
        _empty("hero", "RIG")
        bpy.data.actions.new("idle")
        contract = _contract()
        contract["requiredAnimations"] = ["idle"]

        self.assertIn("MISSING_REQUIRED_ANIMATION", _codes(contract))

    def test_required_animation_bound_only_to_backup_is_rejected(self) -> None:
        _empty("hero", "RIG")
        backup = bpy.data.collections.new("SOURCE_BACKUP")
        bpy.context.scene.collection.children.link(backup)
        backup_node = bpy.data.objects.new("backup_node", None)
        backup.objects.link(backup_node)
        _animate_location(backup_node)
        contract = _contract()
        contract["requiredAnimations"] = ["idle"]

        self.assertIn("MISSING_REQUIRED_ANIMATION", _codes(contract))

    def test_non_active_actions_targeting_exported_armature_are_available(self) -> None:
        armature = _armature_with_root("hero_rig", "RIG")
        first = _animate_location(armature, "idle")
        second = bpy.data.actions.new("walk")
        armature.animation_data.action = second
        armature.location = (0.0, 0.0, 0.0)
        armature.keyframe_insert(data_path="location", frame=1)
        armature.location = (0.0, 0.0, 0.2)
        armature.keyframe_insert(data_path="location", frame=10)
        armature.animation_data.action = first
        contract = _contract()
        contract["requiredAnimations"] = ["idle", "walk"]

        self.assertNotIn("MISSING_REQUIRED_ANIMATION", _codes(contract))

    def test_strict_contract_errors_are_structured_for_both_clis(self) -> None:
        invalid_contracts = [
            [],
            None,
            {
                "assetId": "invalid.null-field",
                "requiredCollections": ["VISUAL", "COLLISION", "SOCKETS", "RIG"],
                "requiredNodes": None,
                "requiredAnimations": [],
                "requiredAnimationEvents": {},
            },
        ]
        for invalid in invalid_contracts:
            for module in (validate_scene, export_asset):
                with self.subTest(contract=invalid, module=module.__name__):
                    result, payload, error = _run_main(module, invalid)
                    self.assertIsNone(error)
                    self.assertEqual(1, result)
                    self.assertEqual("INVALID_CONTRACT", payload["issues"][0]["code"])

    def test_filtered_and_unsupported_output_object_types_are_rejected(self) -> None:
        camera = bpy.data.objects.new("reference_camera", bpy.data.cameras.new("ReferenceCamera"))
        bpy.data.collections["LOD0"].objects.link(camera)
        light = bpy.data.objects.new(
            "reference_light",
            bpy.data.lights.new("ReferenceLight", "POINT"),
        )
        bpy.data.collections["RIG"].objects.link(light)
        speaker = bpy.data.objects.new("reference_speaker", bpy.data.speakers.new("ReferenceSpeaker"))
        bpy.data.collections["SOCKETS"].objects.link(speaker)

        issues = validate_scene.collect_scene_issues(_contract())
        rejected = {
            issue.get("object")
            for issue in issues
            if issue["code"] == "UNSUPPORTED_EXPORT_OBJECT_TYPE"
        }
        self.assertEqual({camera.name, light.name, speaker.name}, rejected)

    def test_empty_payload_requires_explicit_contract_permission(self) -> None:
        self.assertIn("EMPTY_EXPORT_PAYLOAD", _codes(_contract(allow_empty=False)))
        self.assertNotIn("EMPTY_EXPORT_PAYLOAD", _codes(_contract(allow_empty=True)))

    def test_scene_name_is_machine_validated(self) -> None:
        bpy.context.scene.name = "RENAMED"
        issues = validate_scene.collect_scene_issues(_contract(allow_empty=True))
        scene_name_issues = [issue for issue in issues if issue["code"] == "INVALID_SCENE_NAME"]

        self.assertEqual(1, len(scene_name_issues))
        self.assertEqual("SCENE", scene_name_issues[0]["expected"])
        self.assertEqual("RENAMED", scene_name_issues[0]["actual"])

    def test_character_rejects_empty_template_and_unskinned_display_mesh(self) -> None:
        contract = _character_contract()
        empty_codes = _codes(contract)
        self.assertIn("CHARACTER_MESH_MISSING", empty_codes)
        self.assertIn("MISSING_REQUIRED_ANIMATION", empty_codes)

        _armature_with_root("farmer_rig", "RIG")
        _mesh("farmer_body", "LOD0")
        codes = _codes(contract)
        self.assertIn("UNSKINNED_CHARACTER_MESH", codes)

    def test_character_requires_empty_collision_collection(self) -> None:
        contract = _character_contract()
        _mesh("capsule_farmer", "COLLISION")

        self.assertIn("CHARACTER_COLLISION_NOT_EMPTY", _codes(contract))

    def test_animation_event_extras_are_exact_per_clip(self) -> None:
        document = {
            "animations": [
                {
                    "name": "pick_low",
                    "extras": {
                        "events": [
                            {"name": "fruit_contact", "normalizedTime": 0.58}
                        ]
                    },
                },
                {
                    "name": "load_crate",
                    "extras": {
                        "events": [
                            {"name": "crate_released", "normalizedTime": 0.76}
                        ]
                    },
                },
            ]
        }
        required = {
            "pick_low": [{"name": "fruit_contact", "normalizedTime": 0.58}],
            "load_crate": [{"name": "crate_released", "normalizedTime": 0.76}],
        }

        export_asset._verify_required_animation_events(document, required)
        document["animations"][0]["extras"]["events"].append(
            {"name": "unexpected", "normalizedTime": 0.2}
        )
        with self.assertRaises(export_asset._ExportVerificationError) as caught:
            export_asset._verify_required_animation_events(document, required)
        self.assertEqual("ANIMATION_EVENT_MISMATCH", caught.exception.code)

    def test_action_event_metadata_is_injected_into_animation_extras(self) -> None:
        document = {"animations": [{"name": "pick_mid"}, {"name": "idle"}]}
        event_map = {
            "pick_mid": [{"name": "fruit_contact", "normalizedTime": 0.6}]
        }

        export_asset._inject_animation_events(document, event_map)

        self.assertEqual(
            {"events": [{"name": "fruit_contact", "normalizedTime": 0.6}]},
            document["animations"][0]["extras"],
        )
        self.assertNotIn("extras", document["animations"][1])

    def test_farmer_review_gate_rejects_missing_delivery(self) -> None:
        temp_root = REPOSITORY / ".tmp"
        temp_root.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=temp_root) as directory:
            result = review_farmer_character.review_delivery(Path(directory))

        codes = {issue["code"] for issue in result["issues"]}
        self.assertFalse(result["valid"])
        self.assertIn("SOURCE_MISSING", codes)
        self.assertIn("VISUAL_MISSING", codes)
        self.assertIn("COLLISION_MISSING", codes)

    def test_farmer_motion_gate_rejects_static_paths_and_duplicate_actions(self) -> None:
        samples = {
            "enter_vehicle": {"rootTravel": 0.0, "poseSignature": [0.0, 1.0]},
            "exit_vehicle": {"rootTravel": 0.0, "poseSignature": [0.0, 1.0]},
            "walk": {"footTravel": 0.01, "plantedFrames": 0},
            "pick_low": {"handHeight": 1.1},
            "pick_mid": {"handHeight": 1.1},
            "pick_high": {"handHeight": 1.1},
        }

        codes = {
            issue["code"]
            for issue in review_farmer_character.evaluate_motion_metrics(samples)
        }

        self.assertIn("VEHICLE_PATH_STATIC", codes)
        self.assertIn("ENTER_EXIT_DUPLICATE", codes)
        self.assertIn("WALK_MECHANICS_MISSING", codes)
        self.assertIn("PICK_HEIGHT_BANDS_INVALID", codes)

    def test_farmer_geometry_gate_rejects_disconnected_body_and_degenerate_uvs(self) -> None:
        metrics = {
            "bodyComponents": 14,
            "bodyLargestComponentRatio": 0.28,
            "uvNonDegenerateRatio": 0.61,
            "maxInfluences": 2,
        }

        codes = {
            issue["code"]
            for issue in review_farmer_character.evaluate_geometry_metrics(metrics)
        }

        self.assertIn("BODY_TOPOLOGY_DISCONNECTED", codes)
        self.assertIn("UV_DEGENERATE", codes)

    def test_farmer_geometry_gate_rejects_six_digit_hands_and_disconnected_deformation_surfaces(self) -> None:
        metrics = {
            "bodyComponents": 1,
            "bodyLargestComponentRatio": 1.0,
            "uvNonDegenerateRatio": 1.0,
            "uvOverlapRatio": 0.0,
            "maxInfluences": 2,
            "digitBranches": {"left": 6, "right": 6},
            "surfaceComponents": {"body": 1, "workwear": 8, "gear": 17},
            "nonManifoldEdges": {"body": 0, "workwear": 96, "gear": 120},
        }

        codes = {
            issue["code"]
            for issue in review_farmer_character.evaluate_geometry_metrics(metrics)
        }

        self.assertIn("HAND_DIGIT_COUNT_INVALID", codes)
        self.assertIn("DEFORMATION_SURFACE_DISCONNECTED", codes)
        self.assertIn("DEFORMATION_TOPOLOGY_NON_MANIFOLD", codes)

    def test_farmer_motion_gate_rejects_edge_support_sliding_and_unsafe_lift(self) -> None:
        samples = {
            "enter_vehicle": {"rootTravel": 0.5, "poseSignature": [0.0]},
            "exit_vehicle": {"rootTravel": 0.5, "poseSignature": [1.0]},
            "walk": {
                "footTravel": 0.5,
                "plantedFrames": 5,
                "groundedFrames": 5,
                "airborneFrames": 0,
                "minimumSoleArea": 0.0002,
                "maximumFootSlide": 0.18,
                "phaseSeparation": 0.03,
                "maximumSoleTiltDegrees": 39.0,
            },
            "lift_crate": {
                "groundedFrames": 4,
                "airborneFrames": 0,
                "bilateralSupportFrames": 1,
                "minimumSoleArea": 0.0001,
                "splitStance": 0.02,
                "loadDistance": 0.48,
                "backwardLeanDegrees": 31.0,
            },
            "pick_low": {"handHeight": 0.7},
            "pick_mid": {"handHeight": 1.2},
            "pick_high": {"handHeight": 1.7},
        }

        codes = {
            issue["code"]
            for issue in review_farmer_character.evaluate_motion_metrics(samples)
        }

        self.assertIn("WALK_SOLE_SUPPORT_INVALID", codes)
        self.assertIn("WALK_FOOT_SLIDE", codes)
        self.assertIn("WALK_PHASES_INSUFFICIENT", codes)
        self.assertIn("LIFT_MECHANICS_UNSAFE", codes)

    def test_farmer_interaction_gate_rejects_vehicle_and_cargo_sweep_penetration(self) -> None:
        codes = {
            issue["code"]
            for issue in review_farmer_character.evaluate_interaction_metrics(
                {
                    "enterClearance": -0.08,
                    "exitClearance": -0.04,
                    "frontWheelClearance": -0.03,
                    "cargoApproachClearance": -0.05,
                    "cargoFitMargin": -0.11,
                    "cargoWithdrawClearance": -0.02,
                }
            )
        }

        self.assertIn("VEHICLE_SWEEP_COLLISION", codes)
        self.assertIn("CARGO_PATH_COLLISION", codes)

    def test_farmer_real_glb_gate_rejects_airborne_walk_mutation(self) -> None:
        temp_root = REPOSITORY / ".tmp"
        temp_root.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=temp_root) as directory:
            mutated = Path(directory) / "airborne-walk.glb"

            def lift_both_feet() -> None:
                action = bpy.data.actions["walk"]
                for side in ("l", "r"):
                    curve = action.fcurves.find(
                        f'pose.bones["foot_{side}"].location', index=2
                    )
                    self.assertIsNotNone(curve)
                    for point in curve.keyframe_points:
                        point.co.y += 0.32

            _export_mutated_farmer(mutated, lift_both_feet)
            motion, _, _ = review_farmer_character.measure_decoded_glb(mutated)
            codes = {
                issue["code"]
                for issue in review_farmer_character.evaluate_motion_metrics(motion)
            }

        self.assertIn("WALK_GROUND_CONTACT_LOST", codes)

    def test_farmer_real_glb_gate_rejects_body_shift_through_vehicle_path(self) -> None:
        temp_root = REPOSITORY / ".tmp"
        temp_root.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=temp_root) as directory:
            mutated = Path(directory) / "vehicle-path-penetration.glb"

            def lower_ingress_through_chassis() -> None:
                rig = bpy.data.objects["farmer_rig"]
                rig.location.x += 0.55
                rig.location.z -= 0.62

            _export_mutated_farmer(mutated, lower_ingress_through_chassis)
            motion, _, _ = review_farmer_character.measure_decoded_glb(mutated)
            codes = {
                issue["code"]
                for issue in review_farmer_character.evaluate_interaction_metrics(
                    motion["interaction"]
                )
            }

        self.assertIn("VEHICLE_SWEEP_COLLISION", codes)

    def test_farmer_real_glb_gate_rejects_overlaid_uv_faces(self) -> None:
        temp_root = REPOSITORY / ".tmp"
        temp_root.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=temp_root) as directory:
            mutated = Path(directory) / "overlaid-uvs.glb"

            def overlay_every_face() -> None:
                for obj in bpy.context.scene.objects:
                    if obj.type != "MESH" or not obj.name.startswith("farmer_"):
                        continue
                    uv = obj.data.uv_layers.active.data
                    for polygon in obj.data.polygons:
                        corners = ((0.10, 0.10), (0.90, 0.10), (0.90, 0.90), (0.10, 0.90))
                        for corner, loop_index in enumerate(polygon.loop_indices):
                            uv[loop_index].uv = corners[corner % 4]

            _export_mutated_farmer(mutated, overlay_every_face)
            _, geometry, _ = review_farmer_character.measure_decoded_glb(mutated)
            codes = {
                issue["code"]
                for issue in review_farmer_character.evaluate_geometry_metrics(geometry)
            }

        self.assertIn("UV_OVERLAP_EXCESSIVE", codes)

    def test_farmer_fixture_measurement_follows_real_grip_geometry_mutation(self) -> None:
        tricycle = REPOSITORY / "resources/blender/vehicle/electric-tricycle-a.blend"
        with bpy.data.libraries.load(str(tricycle), link=False) as (source, destination):
            self.assertIn("handle_grip_left", source.objects)
            destination.objects = ["handle_grip_left"]
        grip = destination.objects[0]
        bpy.context.scene.collection.objects.link(grip)

        baseline = review_farmer_character.measure_fixture_objects({"gripLeft": grip})
        for vertex in grip.data.vertices:
            vertex.co.x += 0.25
        shifted = review_farmer_character.measure_fixture_objects({"gripLeft": grip})

        self.assertAlmostEqual(0.25, shifted["gripLeft"].x - baseline["gripLeft"].x, places=4)

    def test_farmer_evidence_gate_requires_changed_pixels_and_hand_closeup(self) -> None:
        rejected = review_farmer_character.evaluate_evidence_metrics(
            {"enterExitChangedPixelRatio": 0.0, "handsAspect": 1.0, "rigLabelPixels": 0, "jointSheetAspect": 4.0}
        )
        rejected_codes = {issue["code"] for issue in rejected}
        self.assertIn("ENTER_EXIT_EVIDENCE_DUPLICATE", rejected_codes)
        self.assertIn("HANDS_EVIDENCE_NOT_CLOSEUP", rejected_codes)

        accepted = review_farmer_character.evaluate_evidence_metrics(
            {"enterExitChangedPixelRatio": 0.026, "handsAspect": 2.0, "rigLabelPixels": 250, "jointSheetAspect": 1.5}
        )
        self.assertEqual([], accepted)

    def test_farmer_real_evidence_mutation_erasing_bone_labels_is_rejected(self) -> None:
        source = REPOSITORY / "artifacts/review/character/farmer-a"
        temp_root = REPOSITORY / ".tmp"
        temp_root.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=temp_root) as directory:
            destination = Path(directory)
            for name in ("enter-vehicle-path.png", "exit-vehicle-path.png", "hands-closeup.png", "rig-bone-overlay.png", "joint-deformation-sheet.png"):
                shutil.copy2(source / name, destination / name)

            baseline = review_farmer_character.evidence_image_metrics(destination)
            self.assertGreater(baseline["rigLabelPixels"], 100)

            label_path = destination / "rig-bone-overlay.png"
            image = bpy.data.images.load(str(label_path), check_existing=False)
            pixels = np.array(image.pixels[:], dtype=np.float32).reshape(image.size[1], image.size[0], 4)
            cyan = (pixels[:, :, 0] < 0.35) & (pixels[:, :, 1] > 0.55) & (pixels[:, :, 2] > 0.55)
            pixels[cyan, :3] = 0.05
            image.pixels.foreach_set(pixels.ravel())
            image.filepath_raw = str(label_path)
            image.file_format = "PNG"
            image.save()
            bpy.data.images.remove(image)

            mutated = review_farmer_character.evidence_image_metrics(destination)
            codes = {
                issue["code"]
                for issue in review_farmer_character.evaluate_evidence_metrics(mutated)
            }

        self.assertIn("RIG_LABEL_PROOF_MISSING", codes)


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(AssetToolchainRegressions)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    raise SystemExit(0 if result.wasSuccessful() else 1)
