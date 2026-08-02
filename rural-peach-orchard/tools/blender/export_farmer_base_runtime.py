"""Export the approved MPFB farmer base as the feasibility runtime GLB.

This script is deliberately export-only. It verifies the approved source hash,
opens the source blend, selects the audited body/eyes/GameEngine armature, and
never saves the source file.
"""

from __future__ import annotations

import hashlib
import json
import struct
import sys
from pathlib import Path
from typing import Any

import bpy


APPROVED_BLEND_SHA256 = (
    "ea7fae26bdbd0b17565fdf2bc46b989c9338b06058231a9b27976bc0e070358d"
)
BODY_NAME = "farmer_a_base_body"
EYES_NAME = "farmer_a_base_eyes"
RIG_NAME = "GameEngine"
REQUIRED_RUNTIME_NODES = {"root", "pelvis", "head"}
EXPECTED_BONE_COUNT = 53
HEIGHT_METERS = 1.68
HEIGHT_TOLERANCE_METERS = 0.005


def _arguments() -> tuple[Path, Path]:
    if "--" not in sys.argv:
        raise SystemExit(
            "Usage: blender --background --python export_farmer_base_runtime.py "
            "-- <source.blend> <output-directory>"
        )
    arguments = sys.argv[sys.argv.index("--") + 1 :]
    if len(arguments) != 2:
        raise SystemExit("Expected source blend and output directory")
    return Path(arguments[0]).resolve(), Path(arguments[1]).resolve()


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _read_glb_json(path: Path) -> dict[str, Any]:
    data = path.read_bytes()
    magic, version, declared_length = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF" or version != 2 or declared_length != len(data):
        raise RuntimeError("RUNTIME_GLB_HEADER_INVALID")

    offset = 12
    while offset < len(data):
        chunk_length, chunk_type = struct.unpack_from("<II", data, offset)
        offset += 8
        payload = data[offset : offset + chunk_length]
        offset += chunk_length
        if chunk_type == 0x4E4F534A:
            return json.loads(payload.rstrip(b" \x00").decode("utf8"))
    raise RuntimeError("RUNTIME_GLB_JSON_MISSING")


def _primitive_triangle_count(
    primitive: dict[str, Any],
    accessors: list[dict[str, Any]],
) -> int:
    accessor_index = primitive.get("indices")
    if accessor_index is None:
        accessor_index = primitive.get("attributes", {}).get("POSITION")
    if accessor_index is None:
        return 0
    element_count = int(accessors[accessor_index].get("count", 0))
    mode = int(primitive.get("mode", 4))
    if mode == 4:
        return element_count // 3
    if mode in (5, 6):
        return max(0, element_count - 2)
    return 0


def _measure_glb(path: Path) -> dict[str, Any]:
    gltf = _read_glb_json(path)
    accessors = gltf.get("accessors", [])
    materials = gltf.get("materials", [])
    skins = gltf.get("skins", [])
    primitives = [
        primitive
        for mesh in gltf.get("meshes", [])
        for primitive in mesh.get("primitives", [])
    ]
    triangle_count = sum(
        _primitive_triangle_count(primitive, accessors)
        for primitive in primitives
    )
    node_names = sorted(
        node["name"]
        for node in gltf.get("nodes", [])
        if isinstance(node.get("name"), str)
    )
    return {
        "nodeCount": len(gltf.get("nodes", [])),
        "nodeNames": node_names,
        "triangleCount": triangle_count,
        "materialCount": len(materials),
        "baseColorTextureBindingCount": sum(
            1
            for material in materials
            if "baseColorTexture" in material.get("pbrMetallicRoughness", {})
        ),
        "textureCount": len(gltf.get("textures", [])),
        "animationCount": len(gltf.get("animations", [])),
        "skinCount": len(skins),
        "skinJointCount": len(skins[0].get("joints", [])) if skins else 0,
        "skinnedPrimitiveCount": sum(
            1
            for primitive in primitives
            if "JOINTS_0" in primitive.get("attributes", {})
            and "WEIGHTS_0" in primitive.get("attributes", {})
        ),
        "primitiveCount": len(primitives),
    }


def _evaluated_visible_height(body: bpy.types.Object) -> float:
    dependency_graph = bpy.context.evaluated_depsgraph_get()
    evaluated_body = body.evaluated_get(dependency_graph)
    mesh = evaluated_body.to_mesh()
    try:
        world_z = [(evaluated_body.matrix_world @ vertex.co).z for vertex in mesh.vertices]
        if not world_z:
            raise RuntimeError("SOURCE_BODY_HAS_NO_VERTICES")
        return max(world_z) - min(world_z)
    finally:
        evaluated_body.to_mesh_clear()


def _measure_reimported_runtime(path: Path) -> dict[str, Any]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    body = bpy.data.objects.get(BODY_NAME)
    rig = next(
        (candidate for candidate in bpy.data.objects if candidate.type == "ARMATURE"),
        None,
    )
    if body is None or body.type != "MESH":
        raise RuntimeError("RUNTIME_REIMPORT_BODY_MISSING")
    if rig is None:
        raise RuntimeError("RUNTIME_REIMPORT_SKIN_MISSING")
    return {
        "runtimeEvaluatedVisibleHeightMeters": _evaluated_visible_height(body),
        "runtimeBoneCount": len(rig.data.bones),
        "runtimeObjectScales": {
            "body": list(body.scale),
            "rig": list(rig.scale),
        },
    }


def main() -> None:
    source_path, output_directory = _arguments()
    source_sha256 = _sha256(source_path)
    if source_sha256 != APPROVED_BLEND_SHA256:
        raise RuntimeError("SOURCE_BLEND_SHA256_NOT_APPROVED")

    bpy.ops.wm.open_mainfile(filepath=str(source_path))
    body = bpy.data.objects.get(BODY_NAME)
    eyes = bpy.data.objects.get(EYES_NAME)
    rig = bpy.data.objects.get(RIG_NAME)
    if body is None or body.type != "MESH":
        raise RuntimeError("SOURCE_BODY_MISSING")
    if eyes is None or eyes.type != "MESH":
        raise RuntimeError("SOURCE_EYES_MISSING")
    if rig is None or rig.type != "ARMATURE":
        raise RuntimeError("SOURCE_GAMEENGINE_RIG_MISSING")

    object_scales = {
        "body": list(body.scale),
        "eyes": list(eyes.scale),
        "rig": list(rig.scale),
    }
    if any(
        any(abs(component - 1.0) > 1e-9 for component in scale)
        for scale in object_scales.values()
    ):
        raise RuntimeError("SOURCE_OBJECT_SCALE_NOT_UNIT")

    bone_count = len(rig.data.bones)
    if bone_count != EXPECTED_BONE_COUNT:
        raise RuntimeError("SOURCE_BONE_COUNT_MISMATCH")

    evaluated_height = _evaluated_visible_height(body)
    if abs(evaluated_height - HEIGHT_METERS) > HEIGHT_TOLERANCE_METERS:
        raise RuntimeError("SOURCE_EVALUATED_HEIGHT_OUT_OF_RANGE")

    for selected in list(bpy.context.selected_objects):
        selected.select_set(False)
    for selected in (body, eyes, rig):
        selected.hide_set(False)
        selected.hide_viewport = False
        selected.hide_render = False
        selected.select_set(True)
    bpy.context.view_layer.objects.active = rig

    # The runtime contract requires a lowercase semantic root node. Renaming the
    # selected armature object only in this unsaved export session adds that
    # node without renaming a bone or changing source geometry.
    rig.name = "root"

    output_directory.mkdir(parents=True, exist_ok=True)
    output_glb = output_directory / "visual.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(output_glb),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_animations=False,
        export_skins=True,
        export_all_influences=True,
        export_morph=False,
        export_apply=True,
    )

    if _sha256(source_path) != source_sha256:
        raise RuntimeError("SOURCE_BLEND_CHANGED_DURING_EXPORT")
    glb_metrics = _measure_glb(output_glb)
    if not REQUIRED_RUNTIME_NODES.issubset(glb_metrics["nodeNames"]):
        raise RuntimeError("RUNTIME_REQUIRED_NODE_MISSING")
    if glb_metrics["animationCount"] != 0:
        raise RuntimeError("RUNTIME_ANIMATION_PRESENT")
    if glb_metrics["skinCount"] != 1:
        raise RuntimeError("RUNTIME_SKIN_COUNT_MISMATCH")
    if glb_metrics["skinJointCount"] != EXPECTED_BONE_COUNT:
        raise RuntimeError("RUNTIME_SKIN_JOINT_COUNT_MISMATCH")
    if glb_metrics["skinnedPrimitiveCount"] != glb_metrics["primitiveCount"]:
        raise RuntimeError("RUNTIME_SKIN_ATTRIBUTES_MISSING")
    if (
        glb_metrics["baseColorTextureBindingCount"]
        != glb_metrics["materialCount"]
    ):
        raise RuntimeError("RUNTIME_BASE_COLOR_TEXTURE_BINDING_MISSING")

    runtime_metrics = _measure_reimported_runtime(output_glb)
    runtime_height = runtime_metrics["runtimeEvaluatedVisibleHeightMeters"]
    if abs(runtime_height - HEIGHT_METERS) > HEIGHT_TOLERANCE_METERS:
        raise RuntimeError("RUNTIME_EVALUATED_HEIGHT_OUT_OF_RANGE")
    if runtime_metrics["runtimeBoneCount"] != EXPECTED_BONE_COUNT:
        raise RuntimeError("RUNTIME_REIMPORT_BONE_COUNT_MISMATCH")

    metrics = {
        "assetId": "character.farmer-a-base",
        "sourceBlendSha256": APPROVED_BLEND_SHA256,
        "runtimeGlbSha256": _sha256(output_glb),
        "blenderVersion": bpy.app.version_string,
        "sourceEvaluatedVisibleHeightMeters": evaluated_height,
        "sourceObjectScales": object_scales,
        "boneCount": bone_count,
        **glb_metrics,
        **runtime_metrics,
    }
    (output_directory / "export-metrics.json").write_text(
        json.dumps(metrics, indent=2, sort_keys=True) + "\n",
        encoding="utf8",
    )
    print(json.dumps(metrics, sort_keys=True))


if __name__ == "__main__":
    main()
