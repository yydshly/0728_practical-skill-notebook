"""Deterministically export orchard visual and collision GLBs."""

from __future__ import annotations

import json
import struct
import sys
from pathlib import Path
from typing import Any

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
import scene_contract as _scene_contract  # noqa: E402
from validate_scene import collect_scene_issues  # noqa: E402


class _ExportVerificationError(RuntimeError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def _arguments_after_separator() -> list[str]:
    if "--" not in sys.argv:
        return []
    return sys.argv[sys.argv.index("--") + 1 :]


def _select_only(objects: list[Any]) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    selected = list(objects)
    for obj in selected:
        obj.hide_set(False)
        obj.select_set(True)
    bpy.context.view_layer.objects.active = selected[0] if selected else None


def _export_glb(filepath: Path, objects: list[Any], include_animations: bool) -> None:
    _select_only(objects)
    result = bpy.ops.export_scene.gltf(
        filepath=str(filepath),
        check_existing=False,
        export_format="GLB",
        use_selection=True,
        use_visible=False,
        use_renderable=False,
        export_apply=False,
        export_texcoords=True,
        export_normals=True,
        export_tangents=True,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
        export_animations=include_animations,
        export_animation_mode="ACTIONS",
        export_merge_animation="NONE",
        export_nla_strips=False,
        export_extra_animations=False,
        export_current_frame=False,
        export_frame_range=False,
        # Sampling all armature channels avoids Blender's set-derived sparse
        # channel ordering, which otherwise changes GLB bytes between runs.
        export_force_sampling=True,
        export_skins=True,
        export_armature_object_remove=False,
        export_morph=True,
        export_morph_normal=True,
        export_morph_tangent=True,
        export_extras=True,
        will_save_settings=False,
    )
    if result != {"FINISHED"}:
        raise RuntimeError(f"glTF export failed for {filepath}: {sorted(result)}")


def _read_glb_json(path: Path) -> dict[str, Any]:
    data = path.read_bytes()
    if len(data) < 20:
        raise ValueError(f"{path} is not a valid GLB")
    magic, version, declared_length = struct.unpack_from("<III", data, 0)
    if magic != 0x46546C67 or version != 2 or declared_length != len(data):
        raise ValueError(f"{path} has an invalid GLB header")
    chunk_length, chunk_type = struct.unpack_from("<II", data, 12)
    if chunk_type != 0x4E4F534A:
        raise ValueError(f"{path} does not start with a JSON chunk")
    payload = data[20 : 20 + chunk_length].decode("utf-8").rstrip(" \t\r\n\0")
    return json.loads(payload)


def _write_glb_json(path: Path, document: dict[str, Any]) -> None:
    """Replace only the GLB JSON chunk while preserving binary payload chunks."""
    data = path.read_bytes()
    magic, version, declared_length = struct.unpack_from("<III", data, 0)
    if magic != 0x46546C67 or version != 2 or declared_length != len(data):
        raise ValueError(f"{path} has an invalid GLB header")
    old_json_length, old_json_type = struct.unpack_from("<II", data, 12)
    if old_json_type != 0x4E4F534A:
        raise ValueError(f"{path} does not start with a JSON chunk")
    remaining_chunks = data[20 + old_json_length :]
    json_bytes = json.dumps(
        document,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    json_bytes += b" " * ((-len(json_bytes)) % 4)
    payload = (
        struct.pack("<III", magic, version, 20 + len(json_bytes) + len(remaining_chunks))
        + struct.pack("<II", len(json_bytes), 0x4E4F534A)
        + json_bytes
        + remaining_chunks
    )
    path.write_bytes(payload)


def _action_event_map() -> dict[str, list[dict[str, Any]]]:
    events: dict[str, list[dict[str, Any]]] = {}
    for action in bpy.data.actions:
        raw = action.get("events_json")
        if raw is None:
            continue
        try:
            parsed = json.loads(raw) if isinstance(raw, str) else raw
        except json.JSONDecodeError as error:
            raise _ExportVerificationError(
                "INVALID_ANIMATION_EVENT_METADATA",
                f"{action.name}: {error}",
            ) from error
        if not isinstance(parsed, list):
            raise _ExportVerificationError(
                "INVALID_ANIMATION_EVENT_METADATA",
                f"{action.name}: events_json must decode to an array",
            )
        normalized: list[dict[str, Any]] = []
        for event in parsed:
            if (
                not isinstance(event, dict)
                or not isinstance(event.get("name"), str)
                or not isinstance(event.get("normalizedTime"), (int, float))
                or not 0.0 <= float(event["normalizedTime"]) <= 1.0
            ):
                raise _ExportVerificationError(
                    "INVALID_ANIMATION_EVENT_METADATA",
                    f"{action.name}: invalid event payload",
                )
            normalized.append(
                {
                    "name": event["name"],
                    "normalizedTime": round(float(event["normalizedTime"]), 6),
                }
            )
        events[action.name] = normalized
    return events


def _inject_animation_events(
    document: dict[str, Any],
    event_map: dict[str, list[dict[str, Any]]],
) -> None:
    for animation in document.get("animations", []):
        name = animation.get("name")
        if name not in event_map:
            continue
        extras = animation.setdefault("extras", {})
        extras["events"] = event_map[name]


def _verify_required_animation_events(
    document: dict[str, Any],
    required_events: dict[str, list[dict[str, Any]]],
) -> None:
    animations = {
        animation.get("name"): animation
        for animation in document.get("animations", [])
        if isinstance(animation.get("name"), str)
    }
    for clip_name, expected in sorted(required_events.items()):
        animation = animations.get(clip_name)
        actual = (
            animation.get("extras", {}).get("events", [])
            if animation is not None
            else []
        )
        if actual != expected:
            raise _ExportVerificationError(
                "ANIMATION_EVENT_MISMATCH",
                f"{clip_name}: expected {expected!r}, got {actual!r}",
            )


def _verify_required_event_names(
    document: dict[str, Any],
    required_event_names: dict[str, list[str]],
) -> None:
    animations = {
        animation.get("name"): animation
        for animation in document.get("animations", [])
        if isinstance(animation.get("name"), str)
    }
    for clip_name, expected_names in sorted(required_event_names.items()):
        animation = animations.get(clip_name)
        actual = (
            animation.get("extras", {}).get("events", [])
            if animation is not None
            else []
        )
        actual_names = [event.get("name") for event in actual]
        if actual_names != expected_names:
            raise _ExportVerificationError(
                "ANIMATION_EVENT_MISMATCH",
                f"{clip_name}: expected event names {expected_names!r}, got {actual_names!r}",
            )


def _triangle_count(document: dict[str, Any]) -> int:
    accessors = document.get("accessors", [])
    count = 0
    for mesh in document.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            if primitive.get("mode", 4) != 4:
                continue
            if "indices" in primitive:
                vertex_count = accessors[primitive["indices"]]["count"]
            else:
                position = primitive.get("attributes", {}).get("POSITION")
                vertex_count = accessors[position]["count"] if position is not None else 0
            count += vertex_count // 3
    return count


def _document_node_names(document: dict[str, Any]) -> set[str]:
    return {
        node["name"]
        for node in document.get("nodes", [])
        if isinstance(node.get("name"), str)
    }


def _verify_exported_objects(
    visual_document: dict[str, Any],
    collision_document: dict[str, Any],
    visual_objects: list[Any],
    collision_objects: list[Any],
) -> set[str]:
    actual_object_names: set[str] = set()
    for output_name, document, objects in (
        ("visual.glb", visual_document, visual_objects),
        ("collision.glb", collision_document, collision_objects),
    ):
        expected_names = {obj.name for obj in objects}
        allowed_node_names = set(expected_names)
        for obj in objects:
            if obj.type == "ARMATURE":
                allowed_node_names.update(bone.name for bone in obj.data.bones)
        document_names = _document_node_names(document)
        missing_names = sorted(expected_names - document_names)
        if missing_names:
            raise _ExportVerificationError(
                "MISSING_EXPORTED_OBJECT",
                f"{output_name} omitted: {', '.join(missing_names)}",
            )
        unexpected_names = sorted(document_names - allowed_node_names)
        if unexpected_names:
            raise _ExportVerificationError(
                "UNEXPECTED_EXPORTED_OBJECT",
                f"{output_name} leaked: {', '.join(unexpected_names)}",
            )
        actual_object_names.update(expected_names & document_names)
    return actual_object_names


def _verify_required_animations(
    visual_document: dict[str, Any],
    required_animations: list[str],
) -> None:
    exported_names = {
        animation["name"]
        for animation in visual_document.get("animations", [])
        if isinstance(animation.get("name"), str)
    }
    missing_names = sorted(set(required_animations) - exported_names)
    if missing_names:
        raise _ExportVerificationError(
            "MISSING_EXPORTED_ANIMATION",
            f"visual.glb omitted: {', '.join(missing_names)}",
        )


def _write_metrics(
    path: Path,
    documents: list[dict[str, Any]],
    actual_object_names: set[str],
) -> dict[str, int]:
    metrics = {
        "objectCount": len(actual_object_names),
        "triangleCount": sum(_triangle_count(document) for document in documents),
        "materialCount": sum(len(document.get("materials", [])) for document in documents),
        "textureCount": sum(len(document.get("textures", [])) for document in documents),
        "animationCount": sum(len(document.get("animations", [])) for document in documents),
        "nodeCount": sum(len(document.get("nodes", [])) for document in documents),
    }
    path.write_text(
        json.dumps(metrics, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    return metrics


def _error_report(code: str, message: str) -> dict[str, Any]:
    return {
        "exported": False,
        "issues": [
            {
                "severity": "error",
                "code": code,
                "message": f"{code}: {message}",
            }
        ],
    }


def _remove_partial_outputs(paths: list[Path]) -> None:
    for path in paths:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass


def _main() -> int:
    arguments = _arguments_after_separator()
    if len(arguments) != 2:
        print(
            json.dumps(
                _error_report(
                    "INVALID_ARGUMENTS",
                    "expected <contract.json> <output-dir> after --",
                ),
                indent=2,
                sort_keys=True,
            )
        )
        return 1

    contract_path = Path(arguments[0]).resolve()
    output_dir = Path(arguments[1]).resolve()
    try:
        contract = _scene_contract.load_contract(contract_path)
    except _scene_contract.ContractError as error:
        print(
            json.dumps(
                _error_report("INVALID_CONTRACT", str(error)),
                indent=2,
                sort_keys=True,
            )
        )
        return 1

    issues = collect_scene_issues(contract)
    if issues:
        print(
            json.dumps(
                {
                    "assetId": contract.get("assetId"),
                    "exported": False,
                    "issues": issues,
                },
                indent=2,
                sort_keys=True,
            )
        )
        return 1

    visual_objects = list(_scene_contract.visual_export_objects())
    collision_objects = list(_scene_contract.collision_export_objects())
    visual_path = output_dir / "visual.glb"
    collision_path = output_dir / "collision.glb"
    metrics_path = output_dir / "export-metrics.json"
    output_paths = [visual_path, collision_path, metrics_path]

    try:
        output_dir.mkdir(parents=True, exist_ok=True)
        _remove_partial_outputs(output_paths)
        _export_glb(visual_path, visual_objects, include_animations=True)
        _export_glb(collision_path, collision_objects, include_animations=False)
        visual_document = _read_glb_json(visual_path)
        event_map = _action_event_map()
        _inject_animation_events(visual_document, event_map)
        _write_glb_json(visual_path, visual_document)
        documents = [_read_glb_json(visual_path), _read_glb_json(collision_path)]
        actual_object_names = _verify_exported_objects(
            documents[0],
            documents[1],
            visual_objects,
            collision_objects,
        )
        _verify_required_animations(documents[0], contract["requiredAnimations"])
        _verify_required_event_names(
            documents[0], contract["requiredAnimationEvents"]
        )
        _verify_required_animation_events(
            documents[0],
            {
                name: event_map[name]
                for name in contract["requiredAnimationEvents"]
                if name in event_map
            },
        )
        metrics = _write_metrics(
            metrics_path,
            documents,
            actual_object_names,
        )
    except (
        OSError,
        RuntimeError,
        ValueError,
        json.JSONDecodeError,
    ) as error:
        _remove_partial_outputs(output_paths)
        code = (
            error.code
            if isinstance(error, _ExportVerificationError)
            else "EXPORT_FAILED"
        )
        print(
            json.dumps(
                _error_report(code, str(error)),
                indent=2,
                sort_keys=True,
            )
        )
        return 1

    print(
        json.dumps(
            {
                "assetId": contract.get("assetId"),
                "exported": True,
                "files": [
                    visual_path.name,
                    collision_path.name,
                    "export-metrics.json",
                ],
                "metrics": metrics,
            },
            indent=2,
            sort_keys=True,
        )
    )
    return 0


def _cli() -> None:
    try:
        exit_code = _main()
    except BaseException as error:
        print(
            json.dumps(
                _error_report("INTERNAL_ERROR", str(error)),
                indent=2,
                sort_keys=True,
            )
        )
        exit_code = 1
    raise SystemExit(exit_code)


if __name__ == "__main__":
    _cli()
