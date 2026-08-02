"""Review-gate electric-tricycle-a visual delivery and committed evidence."""

from __future__ import annotations

import json
import struct
from pathlib import Path
from typing import Any


REPOSITORY = Path(__file__).resolve().parents[2]
VISUAL_GLB = REPOSITORY / "public/assets/vehicle/electric-tricycle-a/visual.glb"
REVIEW_DIR = REPOSITORY / "artifacts/review/vehicle/electric-tricycle-a"
ACCEPTANCE_PATH = REVIEW_DIR / "review-acceptance.json"

REQUIRED_EVIDENCE = {
    "hero.png",
    "front.png",
    "left.png",
    "right.png",
    "rear.png",
    "top.png",
    "driver.png",
    "rear-three-quarter.png",
    "underside.png",
    "dimension-human-scale.png",
    "driver-fit-clearance.png",
    "sockets-named.png",
    "cargo-crates-top.png",
    "collision-overlay-side.png",
    "collision-overlay-rear.png",
    "collision-overlay-top.png",
    "wireframe-left.png",
    "uv-texel-density.png",
    "material-id-inventory.png",
    "warm-hero.png",
}


def read_glb_json(path: Path) -> dict[str, Any]:
    data = path.read_bytes()
    if len(data) < 20:
        raise ValueError(f"{path} is not a GLB")
    magic, version, declared_length = struct.unpack_from("<III", data, 0)
    if magic != 0x46546C67 or version != 2 or declared_length != len(data):
        raise ValueError(f"{path} has an invalid GLB header")
    json_length, json_type = struct.unpack_from("<II", data, 12)
    if json_type != 0x4E4F534A:
        raise ValueError(f"{path} has no JSON chunk")
    return json.loads(data[20 : 20 + json_length].decode("utf-8").rstrip(" \t\r\n\0"))


def review() -> dict[str, Any]:
    issues: list[dict[str, str]] = []
    document = read_glb_json(VISUAL_GLB)
    materials = document.get("materials", [])
    color_primitives = 0
    primitive_count = 0
    for mesh in document.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            primitive_count += 1
            if "COLOR_0" in primitive.get("attributes", {}):
                color_primitives += 1
    if color_primitives == 0:
        issues.append(
            {
                "code": "MISSING_RUNTIME_MATERIAL_VARIATION",
                "message": "visual.glb has no COLOR_0 vertex-color attributes",
            }
        )

    paint = next(
        (material for material in materials if material.get("name") == "M_Trike_Paint"),
        None,
    )
    paint_metallic = (
        paint.get("pbrMetallicRoughness", {}).get("metallicFactor", 1.0)
        if paint
        else None
    )
    if paint_metallic != 0.0:
        issues.append(
            {
                "code": "PAINT_NOT_DIELECTRIC",
                "message": f"M_Trike_Paint metallicFactor is {paint_metallic!r}, expected 0.0",
            }
        )

    available_evidence = {
        path.name for path in REVIEW_DIR.glob("*.png") if path.is_file()
    }
    missing_evidence = sorted(REQUIRED_EVIDENCE - available_evidence)
    if missing_evidence:
        issues.append(
            {
                "code": "MISSING_ACCEPTANCE_EVIDENCE",
                "message": ", ".join(missing_evidence),
            }
        )

    acceptance: dict[str, Any] = {}
    if ACCEPTANCE_PATH.is_file():
        acceptance = json.loads(ACCEPTANCE_PATH.read_text(encoding="utf-8"))
    else:
        issues.append(
            {
                "code": "MISSING_REVIEW_ACCEPTANCE_AUDIT",
                "message": str(ACCEPTANCE_PATH.relative_to(REPOSITORY)),
            }
        )
    driver = acceptance.get("driver", {})
    if driver.get("cameraLensMm") != 50:
        issues.append(
            {
                "code": "DRIVER_CAMERA_NOT_50MM",
                "message": f"recorded lens is {driver.get('cameraLensMm')!r}",
            }
        )
    projection_audit = driver.get("projectionAudit", {})
    projection_margin = float(projection_audit.get("safeMarginFraction", 0.0))
    projection_objects = projection_audit.get("objects", {})
    required_driver_controls = {
        "handle_grip_left",
        "handle_grip_right",
        "brake_lever_left",
        "brake_lever_right",
    }
    unsafe_controls: list[str] = []
    actual_projection_margins: list[float] = []
    for control_name in sorted(required_driver_controls):
        bounds = projection_objects.get(control_name)
        if not isinstance(bounds, dict):
            unsafe_controls.append(f"{control_name}:missing")
            continue
        values = (
            float(bounds.get("xMin", -1.0)),
            float(bounds.get("xMax", 2.0)),
            float(bounds.get("yMin", -1.0)),
            float(bounds.get("yMax", 2.0)),
        )
        actual_projection_margins.extend(
            (values[0], 1.0 - values[1], values[2], 1.0 - values[3])
        )
        if (
            values[0] < projection_margin
            or values[1] > 1.0 - projection_margin
            or values[2] < projection_margin
            or values[3] > 1.0 - projection_margin
        ):
            unsafe_controls.append(
                f"{control_name}:{','.join(f'{value:.4f}' for value in values)}"
            )
    if projection_margin < 0.05 or unsafe_controls:
        issues.append(
            {
                "code": "DRIVER_CONTROLS_OUTSIDE_SAFE_FRAME",
                "message": (
                    f"safe margin {projection_margin:.4f}; "
                    f"unsafe controls {', '.join(unsafe_controls) or 'none'}"
                ),
            }
        )
    if driver.get("fixture") != "review-only-1.70m-articulated-mannequin":
        issues.append(
            {
                "code": "MISSING_DRIVER_FIT_FIXTURE",
                "message": f"recorded fixture is {driver.get('fixture')!r}",
            }
        )
    if float(driver.get("minimumClearanceMm", 0)) < 40.0:
        issues.append(
            {
                "code": "DRIVER_CLEARANCE_BELOW_40MM",
                "message": f"recorded minimum is {driver.get('minimumClearanceMm', 0)!r} mm",
            }
        )
    cargo = acceptance.get("cargoFixture", {})
    if cargo.get("type") != "contemporary-ventilated-plastic-crate":
        issues.append(
            {
                "code": "CARGO_FIXTURE_NOT_PROBATIVE",
                "message": f"recorded fixture is {cargo.get('type')!r}",
            }
        )

    return {
        "assetId": "vehicle.electric-tricycle-a",
        "valid": not issues,
        "issues": issues,
        "runtimeMaterialVariation": {
            "primitiveCount": primitive_count,
            "colorAttributePrimitiveCount": color_primitives,
            "paintMetallicFactor": paint_metallic,
        },
        "evidence": {
            "requiredCount": len(REQUIRED_EVIDENCE),
            "availableCount": len(REQUIRED_EVIDENCE & available_evidence),
            "missing": missing_evidence,
        },
        "driverProjection": {
            "auditedControlCount": len(required_driver_controls),
            "safeMarginFraction": projection_margin,
            "minimumActualMarginFraction": (
                round(min(actual_projection_margins), 5)
                if actual_projection_margins
                else None
            ),
        },
    }


if __name__ == "__main__":
    result = review()
    print(json.dumps(result, indent=2, sort_keys=True))
    raise SystemExit(0 if result["valid"] else 1)
