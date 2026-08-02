"""Shared Blender scene-selection and contract helpers."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterable

import bpy


CORE_COLLECTIONS = ("VISUAL", "COLLISION", "SOCKETS", "RIG")
LOD_COLLECTIONS = ("LOD0", "LOD1", "LOD2")
VISUAL_EXPORT_COLLECTIONS = (*LOD_COLLECTIONS, "SOCKETS", "RIG")
COLLISION_EXPORT_COLLECTIONS = ("COLLISION",)
VISUAL_OBJECT_TYPES = frozenset({"MESH", "EMPTY", "ARMATURE"})
COLLISION_OBJECT_TYPES = frozenset({"MESH"})


class ContractError(ValueError):
    """Raised when an asset contract cannot be parsed or has an invalid shape."""


def _string_list_error(contract: dict[str, Any], field: str) -> str | None:
    value = contract.get(field)
    if not isinstance(value, list):
        return f"{field} must be an array of strings"
    if any(not isinstance(item, str) or not item for item in value):
        return f"{field} must contain only non-empty strings"
    if len(set(value)) != len(value):
        return f"{field} must not contain duplicate values"
    return None


def validate_contract_shape(value: Any) -> list[str]:
    """Return deterministic structural errors for a decoded JSON contract."""
    if not isinstance(value, dict):
        return ["contract must be a JSON object"]

    errors: list[str] = []
    asset_id = value.get("assetId")
    if not isinstance(asset_id, str) or not asset_id:
        errors.append("assetId must be a non-empty string")

    for field in ("requiredCollections", "requiredNodes", "requiredAnimations"):
        error = _string_list_error(value, field)
        if error is not None:
            errors.append(error)

    events = value.get("requiredAnimationEvents")
    if not isinstance(events, dict):
        errors.append("requiredAnimationEvents must be an object of string arrays")
    else:
        for animation_name, event_names in events.items():
            if not isinstance(animation_name, str) or not animation_name:
                errors.append("requiredAnimationEvents keys must be non-empty strings")
                break
            if not isinstance(event_names, list) or any(
                not isinstance(event_name, str) or not event_name
                for event_name in event_names
            ):
                errors.append(
                    f"requiredAnimationEvents.{animation_name} must be an array of non-empty strings"
                )

    if "allowEmpty" in value and not isinstance(value["allowEmpty"], bool):
        errors.append("allowEmpty must be a boolean")
    return sorted(errors)


def load_contract(path: Path) -> dict[str, Any]:
    """Load and strictly validate a JSON asset contract."""
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ContractError(str(error)) from error
    errors = validate_contract_shape(value)
    if errors:
        raise ContractError("; ".join(errors))
    return value


def _objects_in_collections(names: Iterable[str]) -> tuple[Any, ...]:
    objects: dict[int, Any] = {}
    for name in names:
        collection = bpy.data.collections.get(name)
        if collection is None:
            continue
        for obj in collection.all_objects:
            objects[obj.as_pointer()] = obj
    return tuple(sorted(objects.values(), key=lambda obj: obj.name))


def visual_export_objects() -> tuple[Any, ...]:
    """Return the exact recursive Blender object selection for visual.glb."""
    return _objects_in_collections(VISUAL_EXPORT_COLLECTIONS)


def collision_export_objects() -> tuple[Any, ...]:
    """Return the exact recursive Blender object selection for collision.glb."""
    return _objects_in_collections(COLLISION_EXPORT_COLLECTIONS)


def exportable_visual_objects() -> tuple[Any, ...]:
    return tuple(obj for obj in visual_export_objects() if obj.type in VISUAL_OBJECT_TYPES)


def exportable_collision_objects() -> tuple[Any, ...]:
    return tuple(
        obj for obj in collision_export_objects() if obj.type in COLLISION_OBJECT_TYPES
    )


def active_scene_collection_parents() -> dict[int, dict[int, str]]:
    """Map collection identities to parent identities and display labels."""
    scene = bpy.context.scene
    parents: dict[int, dict[int, str]] = {}
    scene_collections = [scene.collection, *scene.collection.children_recursive]
    for parent in scene_collections:
        parent_label = (
            "SCENE (scene root)"
            if parent == scene.collection
            else f"{parent.name} (collection)"
        )
        parent_identity = parent.as_pointer()
        for child in parent.children:
            child_parents = parents.setdefault(child.as_pointer(), {})
            child_parents[parent_identity] = parent_label
    return parents


def output_node_names() -> set[str]:
    """Return object and bone names that can enter either configured GLB."""
    visual_objects = exportable_visual_objects()
    collision_objects = exportable_collision_objects()
    names = {obj.name for obj in (*visual_objects, *collision_objects)}
    for obj in visual_objects:
        if obj.type == "ARMATURE":
            names.update(bone.name for bone in obj.data.bones)
    return names


def _action_has_channels(action: Any) -> bool:
    try:
        return len(action.fcurves) > 0
    except (AttributeError, RuntimeError):
        return False


def exportable_action_names() -> set[str]:
    """Return named actions with channels bound to actual visual targets."""
    names: set[str] = set()
    visual_objects = exportable_visual_objects()
    visual_names = {obj.name for obj in visual_objects}
    for obj in visual_objects:
        animation_data = obj.animation_data
        if (
            animation_data is not None
            and animation_data.action is not None
            and _action_has_channels(animation_data.action)
        ):
            names.add(animation_data.action.name)
        if obj.type == "MESH" and obj.data.shape_keys is not None:
            shape_animation = obj.data.shape_keys.animation_data
            if (
                shape_animation is not None
                and shape_animation.action is not None
                and _action_has_channels(shape_animation.action)
            ):
                names.add(shape_animation.action.name)
    # Blender 4.4+ actions retain a typed slot for their intended object even
    # when another action is currently active. The glTF ACTIONS exporter uses
    # those slots, so scene validation must inspect them as well.
    for action in bpy.data.actions:
        if not _action_has_channels(action):
            continue
        try:
            targets = {
                slot.name_display
                for slot in action.slots
                if slot.target_id_type == "OBJECT"
            }
        except AttributeError:
            targets = set()
        if targets & visual_names:
            names.add(action.name)
    return names
