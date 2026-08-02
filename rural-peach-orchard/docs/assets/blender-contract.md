# Blender Asset Contract

Every orchard source scene uses this collection hierarchy:

```text
SCENE
├── VISUAL
│   ├── LOD0
│   ├── LOD1
│   └── LOD2
├── COLLISION
├── SOCKETS
└── RIG
```

`SCENE` is the required Blender scene name, not a collection. The four top-level
collections must be linked directly to the scene. `LOD0`, `LOD1`, and `LOD2`
must be direct children of `VISUAL`. Core and LOD collections must have exactly
one parent. Objects cannot live directly in `VISUAL`, and no additional direct
children of `VISUAL` are permitted.

## Scene rules

- Apply object location, rotation, and scale before export.
- Use metric display units with a unit scale of `1.0` (meters).
- Place the asset origin at ground center. For rigged characters, place the
  origin at the root bone instead.
- Put semantic empties in `SOCKETS`.
- Use only mesh, empty, and armature objects in the visual output graph. Use
  only mesh objects in `COLLISION`; cameras, lights, speakers, and other
  filtered or unsupported object types are errors in either output graph.
- Collection-instance empties are not supported in either output graph,
  because their implicit dependency objects bypass collection validation.
- Name collider objects with one of these prefixes: `box_`, `sphere_`,
  `capsule_`, or `convex_`.
- Default Blender names are errors, including `Cube`, `Sphere`, `Cylinder`,
  `Material`, and `Armature.001`.
- Never export visual and collision collections into the same GLB.
- Put hidden source or backup objects in a `SOURCE_BACKUP` collection and
  exclude that collection from export.
- Give textured mesh objects at least one UV map.
- Keep object names unique across the scene.
- Do not link one export object into multiple export collections.

## Contract JSON

The contract must be a JSON object with a non-empty string `assetId`, arrays
of non-empty strings for `requiredCollections`, `requiredNodes`, and
`requiredAnimations`, and an object of string arrays for
`requiredAnimationEvents`. `allowEmpty` is an optional boolean and defaults to
`false`. Set it to `true` only for a deliberately empty template contract.

Required collections must be linked into the active `SCENE`. Required object
nodes must belong to the actual visual or collision export graph; required
bone nodes must belong to an armature in that graph. A required animation must
contain channels bound to a visual export target.

## Validation

```powershell
blender --background <source.blend> --python tools/blender/validate_scene.py -- <contract.json>
```

Validation writes a JSON report to standard output. It exits with code `0`
when the report contains no errors and code `1` when it contains any error.
Malformed JSON and structurally invalid contracts produce a structured
`INVALID_CONTRACT` error instead of a Python traceback.

Run the real-Blender regression suite with:

```powershell
blender --background resources/blender/templates/orchard-asset-template.blend --python tests/blender/asset_toolchain_regressions.py
```

## Export

```powershell
blender --background <source.blend> --python tools/blender/export_asset.py -- <contract.json> <output-dir>
```

The exporter validates first, then creates `visual.glb`, `collision.glb`, and
`export-metrics.json`. `visual.glb` contains the visual LODs, sockets, rig, and
named actions as separate animations without NLA strip merging.
`collision.glb` contains only collider objects. Both GLBs use glTF tangent
generation and +Y up conversion, with cameras and lights disabled.
After writing, the exporter reads both GLBs back, confirms every selected
object and required animation is present, rejects unexpected non-bone nodes,
and removes all three outputs if post-export verification fails.

`export-metrics.json` contains these integer fields:

```json
{
  "animationCount": 0,
  "materialCount": 0,
  "nodeCount": 0,
  "objectCount": 0,
  "textureCount": 0,
  "triangleCount": 0
}
```

`objectCount` counts selected Blender objects whose names are confirmed in the
written GLB node arrays; `nodeCount` also includes exported bone nodes. For a
fixed `.blend` source, contract, exporter version, and Blender version,
repeated exports must produce byte-identical files.
