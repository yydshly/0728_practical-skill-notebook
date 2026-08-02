"""Validate an orchard Blender scene against its asset contract."""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from typing import Any

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
import scene_contract as _scene_contract  # noqa: E402

_COLLIDER_PREFIXES = ("box_", "sphere_", "capsule_", "convex_")
_FORBIDDEN_OBJECT_BASES = ("Cube", "Sphere", "Cylinder", "Armature")
_FORBIDDEN_MATERIAL_BASES = ("Material",)


def collection_object_names(name: str) -> set[str]:
    """Return names of every object recursively contained by a collection."""
    collection = bpy.data.collections.get(name)
    if collection is None:
        return set()
    return {obj.name for obj in collection.all_objects}


def has_applied_transform(obj: Any, epsilon: float = 1e-5) -> bool:
    """Return whether an object's transform is at Blender's applied identity."""
    if any(abs(value) > epsilon for value in obj.location):
        return False
    if any(abs(value - 1.0) > epsilon for value in obj.scale):
        return False

    if obj.rotation_mode == "QUATERNION":
        rotation = obj.rotation_quaternion
        return (
            abs(abs(rotation.w) - 1.0) <= epsilon
            and abs(rotation.x) <= epsilon
            and abs(rotation.y) <= epsilon
            and abs(rotation.z) <= epsilon
        )
    if obj.rotation_mode == "AXIS_ANGLE":
        return abs(math.fmod(obj.rotation_axis_angle[0], math.tau)) <= epsilon
    return all(abs(math.fmod(value, math.tau)) <= epsilon for value in obj.rotation_euler)


def _issue(code: str, subject: str, **details: Any) -> dict[str, Any]:
    issue = {
        "severity": "error",
        "code": code,
        "message": f"{code}: {subject}",
    }
    issue.update(details)
    return issue


def _is_default_name(name: str, bases: tuple[str, ...]) -> bool:
    return any(name == base or name.startswith(f"{base}.") for base in bases)


def _has_image_texture(obj: Any) -> bool:
    for slot in obj.material_slots:
        material = slot.material
        if material is None or not material.use_nodes or material.node_tree is None:
            continue
        if any(node.type == "TEX_IMAGE" and node.image is not None for node in material.node_tree.nodes):
            return True
    return False


def collect_scene_issues(contract: dict) -> list[dict]:
    """Collect deterministic error dictionaries for the current Blender scene."""
    issues: list[dict[str, Any]] = []
    scene = bpy.context.scene

    contract_errors = _scene_contract.validate_contract_shape(contract)
    if contract_errors:
        return [
            _issue("INVALID_CONTRACT", error, field="contract")
            for error in contract_errors
        ]

    if scene.name != "SCENE":
        issues.append(
            _issue(
                "INVALID_SCENE_NAME",
                scene.name,
                expected="SCENE",
                actual=scene.name,
            )
        )

    required_collections = list(
        dict.fromkeys(
            [
                *_scene_contract.CORE_COLLECTIONS,
                *contract["requiredCollections"],
            ]
        )
    )
    collection_parents = _scene_contract.active_scene_collection_parents()
    scene_root_identity = scene.collection.as_pointer()
    for name in required_collections:
        collection = bpy.data.collections.get(name)
        if collection is None:
            issues.append(_issue("MISSING_REQUIRED_COLLECTION", name, collection=name))
            continue
        parent_entries = collection_parents.get(collection.as_pointer(), {})
        if not parent_entries:
            issues.append(
                _issue("UNLINKED_REQUIRED_COLLECTION", name, collection=name)
            )
            continue
        if len(parent_entries) > 1:
            issues.append(
                _issue(
                    "MULTIPLE_COLLECTION_PARENTS",
                    name,
                    collection=name,
                    parents=sorted(parent_entries.values()),
                )
            )
        if (
            name in _scene_contract.CORE_COLLECTIONS
            and scene_root_identity not in parent_entries
        ):
            issues.append(
                _issue("MISPLACED_REQUIRED_COLLECTION", name, collection=name)
            )

    visual = bpy.data.collections.get("VISUAL")
    if visual is not None:
        direct_child_names = {child.name for child in visual.children}
        for lod_name in _scene_contract.LOD_COLLECTIONS:
            if lod_name not in direct_child_names:
                issues.append(
                    _issue(
                        "MISSING_REQUIRED_COLLECTION",
                        f"VISUAL/{lod_name}",
                        collection=lod_name,
                    )
                )
                continue
            lod = bpy.data.collections[lod_name]
            parent_entries = collection_parents.get(lod.as_pointer(), {})
            if len(parent_entries) > 1:
                issues.append(
                    _issue(
                        "MULTIPLE_COLLECTION_PARENTS",
                        lod_name,
                        collection=lod_name,
                        parents=sorted(parent_entries.values()),
                    )
                )

        for child in visual.children:
            if child.name not in _scene_contract.LOD_COLLECTIONS:
                issues.append(
                    _issue(
                        "UNSUPPORTED_VISUAL_COLLECTION",
                        child.name,
                        collection=child.name,
                    )
                )
        for obj in visual.objects:
            issues.append(
                _issue(
                    "UNSUPPORTED_VISUAL_OBJECT_PLACEMENT",
                    obj.name,
                    object=obj.name,
                )
            )

    if scene.unit_settings.system != "METRIC":
        issues.append(_issue("INVALID_UNIT_SYSTEM", scene.unit_settings.system or "NONE"))
    if abs(scene.unit_settings.scale_length - 1.0) > 1e-5:
        issues.append(
            _issue(
                "INVALID_UNIT_SCALE",
                str(scene.unit_settings.scale_length),
                expected=1.0,
                actual=scene.unit_settings.scale_length,
            )
        )
    if scene.unit_settings.length_unit != "METERS":
        issues.append(
            _issue(
                "INVALID_DISPLAY_UNIT",
                scene.unit_settings.length_unit or "ADAPTIVE",
                expected="METERS",
            )
        )

    output_node_names = _scene_contract.output_node_names()
    for required_name in contract["requiredNodes"]:
        if required_name not in output_node_names:
            issues.append(_issue("MISSING_REQUIRED_NODE", required_name, node=required_name))

    visual_objects = _scene_contract.visual_export_objects()
    collision_objects = _scene_contract.collision_export_objects()
    visual_by_identity = {obj.as_pointer(): obj for obj in visual_objects}
    collision_by_identity = {obj.as_pointer(): obj for obj in collision_objects}
    active_collection_ids = set(collection_parents)

    names_by_folded: dict[str, list[str]] = {}
    for obj in scene.objects:
        names_by_folded.setdefault(obj.name.casefold(), []).append(obj.name)
        if not has_applied_transform(obj):
            issues.append(_issue("UNAPPLIED_TRANSFORM", obj.name, object=obj.name))
        if _is_default_name(obj.name, _FORBIDDEN_OBJECT_BASES):
            issues.append(_issue("FORBIDDEN_DEFAULT_NAME", obj.name, object=obj.name))
        if obj.type == "MESH" and _has_image_texture(obj) and not obj.data.uv_layers:
            issues.append(_issue("MISSING_UV_MAP", obj.name, object=obj.name))
        if (
            obj.as_pointer() in visual_by_identity
            or obj.as_pointer() in collision_by_identity
        ) and obj.type == "EMPTY" and (
            obj.instance_type == "COLLECTION"
            or obj.instance_collection is not None
        ):
            issues.append(
                _issue(
                    "UNSUPPORTED_COLLECTION_INSTANCE",
                    obj.name,
                    object=obj.name,
                )
            )
        if obj.as_pointer() in visual_by_identity and obj.type not in _scene_contract.VISUAL_OBJECT_TYPES:
            issues.append(
                _issue(
                    "UNSUPPORTED_EXPORT_OBJECT_TYPE",
                    obj.name,
                    object=obj.name,
                    objectType=obj.type,
                    output="visual.glb",
                )
            )
        if (
            obj.as_pointer() in collision_by_identity
            and obj.type not in _scene_contract.COLLISION_OBJECT_TYPES
        ):
            issues.append(
                _issue(
                    "UNSUPPORTED_EXPORT_OBJECT_TYPE",
                    obj.name,
                    object=obj.name,
                    objectType=obj.type,
                    output="collision.glb",
                )
            )
        linked_export_collections = sorted(
            collection.name
            for collection in obj.users_collection
            if collection.as_pointer() in active_collection_ids
            and collection.name
            in (
                *_scene_contract.VISUAL_EXPORT_COLLECTIONS,
                *_scene_contract.COLLISION_EXPORT_COLLECTIONS,
            )
        )
        if len(linked_export_collections) > 1:
            issues.append(
                _issue(
                    "MULTIPLE_EXPORT_COLLECTION_LINKS",
                    obj.name,
                    object=obj.name,
                    collections=linked_export_collections,
                )
            )

    for names in names_by_folded.values():
        if len(names) > 1:
            display_name = ", ".join(sorted(names))
            issues.append(_issue("DUPLICATE_OBJECT_NAME", display_name, objects=sorted(names)))

    for material in bpy.data.materials:
        if _is_default_name(material.name, _FORBIDDEN_MATERIAL_BASES):
            issues.append(
                _issue("FORBIDDEN_DEFAULT_NAME", material.name, material=material.name)
            )

    if collision_objects:
        for obj in collision_objects:
            if not obj.name.startswith(_COLLIDER_PREFIXES):
                issues.append(
                    _issue(
                        "UNSUPPORTED_COLLIDER_PREFIX",
                        obj.name,
                        object=obj.name,
                        supportedPrefixes=list(_COLLIDER_PREFIXES),
                    )
                )

    visual_collision_overlap = set(visual_by_identity) & set(collision_by_identity)
    for identity in visual_collision_overlap:
        obj = visual_by_identity[identity]
        issues.append(
            _issue(
                "VISUAL_COLLISION_OVERLAP",
                obj.name,
                object=obj.name,
            )
        )

    available_animations = _scene_contract.exportable_action_names()
    for animation_name in contract["requiredAnimations"]:
        if animation_name not in available_animations:
            issues.append(
                _issue(
                    "MISSING_REQUIRED_ANIMATION",
                    animation_name,
                    animation=animation_name,
                )
            )

    if contract.get("kind") == "character":
        lod0 = bpy.data.collections.get("LOD0")
        character_meshes = (
            [obj for obj in lod0.all_objects if obj.type == "MESH"]
            if lod0 is not None
            else []
        )
        if not character_meshes:
            issues.append(
                _issue("CHARACTER_MESH_MISSING", contract["assetId"])
            )
        for obj in character_meshes:
            armature_modifiers = [
                modifier
                for modifier in obj.modifiers
                if modifier.type == "ARMATURE" and modifier.object is not None
            ]
            if not armature_modifiers or not obj.vertex_groups:
                issues.append(
                    _issue("UNSKINNED_CHARACTER_MESH", obj.name, object=obj.name)
                )
                continue
            for vertex in obj.data.vertices:
                weighted = [group for group in vertex.groups if group.weight > 1e-6]
                if len(weighted) > 4:
                    issues.append(
                        _issue(
                            "CHARACTER_WEIGHT_LIMIT_EXCEEDED",
                            obj.name,
                            object=obj.name,
                            vertex=vertex.index,
                            influences=len(weighted),
                        )
                    )
                    break
        if collision_objects:
            issues.append(
                _issue(
                    "CHARACTER_COLLISION_NOT_EMPTY",
                    contract["assetId"],
                    objects=sorted(obj.name for obj in collision_objects),
                )
            )

    exportable_payload = (
        *_scene_contract.exportable_visual_objects(),
        *_scene_contract.exportable_collision_objects(),
    )
    if not exportable_payload and not contract.get("allowEmpty", False):
        issues.append(_issue("EMPTY_EXPORT_PAYLOAD", contract["assetId"]))

    return sorted(
        issues,
        key=lambda issue: (
            issue["code"],
            issue.get("object", ""),
            issue.get("collection", ""),
            issue["message"],
        ),
    )


def _arguments_after_separator() -> list[str]:
    if "--" not in sys.argv:
        return []
    return sys.argv[sys.argv.index("--") + 1 :]


def _main() -> int:
    arguments = _arguments_after_separator()
    if len(arguments) != 1:
        print(
            json.dumps(
                {
                    "valid": False,
                    "issues": [
                        _issue(
                            "INVALID_ARGUMENTS",
                            "expected <contract.json> after --",
                        )
                    ],
                },
                indent=2,
                sort_keys=True,
            )
        )
        return 1

    contract_path = Path(arguments[0]).resolve()
    try:
        contract = _scene_contract.load_contract(contract_path)
    except _scene_contract.ContractError as error:
        print(
            json.dumps(
                {
                    "valid": False,
                    "issues": [_issue("INVALID_CONTRACT", str(error))],
                },
                indent=2,
                sort_keys=True,
            )
        )
        return 1

    issues = collect_scene_issues(contract)
    print(
        json.dumps(
            {
                "assetId": contract.get("assetId"),
                "valid": not issues,
                "issues": issues,
            },
            indent=2,
            sort_keys=True,
        )
    )
    return 1 if issues else 0


def _cli() -> None:
    try:
        exit_code = _main()
    except BaseException as error:
        print(
            json.dumps(
                {
                    "valid": False,
                    "issues": [_issue("INTERNAL_ERROR", str(error))],
                },
                indent=2,
                sort_keys=True,
            )
        )
        exit_code = 1
    raise SystemExit(exit_code)


if __name__ == "__main__":
    _cli()
