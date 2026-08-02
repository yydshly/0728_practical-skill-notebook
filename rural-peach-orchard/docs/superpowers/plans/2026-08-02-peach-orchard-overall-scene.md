# Peach Orchard Overall Scene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the invisible technical course with a complete, readable 80 by 60 metre rural peach-orchard world while preserving the existing vehicle, character, physics, interaction, and harvest loop.

**Architecture:** Keep business logic and actor control unchanged. Add one authored flat-world definition as the source of stable transforms, generate two repository-owned GLB asset families (the static farmhouse/road world and three peach-tree variants), load them fail-closed, then bind hidden collision and existing semantic sensors to the same level anchors. A spatial HUD presents the existing domain state without duplicating it.

**Tech Stack:** TypeScript 7, Three.js 0.185, Rapier 3D, Zod, Blender 4.5.12 Python API, GLB/glTF, Vitest, Playwright, Vite.

## Global Constraints

- Target one complete map of approximately 80 by 60 metres; do not build an open village.
- Every player, vehicle, interaction, collision, recovery, and navigation anchor stays on gameplay plane `y = 0`.
- Hills, distant fields, roofs, and other visual height are non-walkable background dressing only.
- Visible buildings, trees, roads, crates, walls, gates, and props are authored/imported GLB meshes; runtime debug boxes, cylinders, sensor volumes, and wireframes never substitute for them.
- Simple boxes, capsules, cylinders, and convex hulls are permitted only for hidden collision, sensing, and recovery.
- No paid asset acquisition is authorized. Repository-authored assets and zero-cost licensed bases with recorded provenance are allowed.
- Keep `vehicle.electric-tricycle-a` and `character.farmer-a-base` unchanged; character replacement and refinement are out of scope.
- Preserve the existing `HarvestDomain`, vehicle controller, player controller, control-authority transfer, contextual-action semantics, and follow-camera behavior.
- Preserve exact sensor IDs: `parking`, `tree-inventory`, `basket`, `crate`, `cargo-slot`, and `delivery`.
- Critical visible assets fail closed with the missing asset ID; there is no basic-geometry fallback.
- Default `/feasibility` contains no visible debug primitives or technical telemetry; debug telemetry remains available only with `?debug`.
- Use contemporary North China harvest-season art direction from `docs/assets/style-guide.md`.
- Route-view budget: at most 200 steady-state draw calls and 350,000 visible triangles, with instancing for repeated trees and crates.
- Triangle allocation is explicit: static world at most 120,000; 30 trees at
  most 105,000 total; committed vehicle 54,982; committed character 28,796;
  leaving at least 41,222 route-view triangles of headroom under 350,000.
- Batch the committed vehicle's 288 GLB primitives into at most 20 rigid draw
  batches while preserving wheel parents and interaction anchors; do not alter
  the approved source GLB.
- The existing ten-loop fixture must still finish with zero fallback, recovery, ownership violations, stage violations, and console errors.
- Execute Blender commands with the SHA-verified 4.5.12 short path `D:\codex_project_work\0728_some_github\.b4512-84afd5f\blender.exe` to avoid Windows `MAX_PATH` failures.

## File responsibility map

- `src/feasibility/world/orchardWorldDefinition.ts` — immutable world transforms, routes, tree placements, collision proxies, semantic anchors, and light inventory.
- `src/feasibility/world/validateOrchardWorldDefinition.ts` — flat-plane, identity, clearance, containment, and emitter/light validation.
- `tools/blender/build_peach_tree_overall.py` — builds three authored peach-tree variants and exports the tree-family GLB.
- `tools/blender/build_orchard_world_overall.py` — builds the farmhouse yard, road, orchard boundary, props, and non-walkable background GLB.
- `src/feasibility/assets/runtimeAssetContract.ts` — validates vehicle, character, and environment runtime asset identities.
- `src/feasibility/assets/SliceAssetLoader.ts` — fail-closed loading for all five critical GLBs.
- `src/feasibility/world/createOrchardWorldVisual.ts` — static-world attachment, instanced tree assembly, and disposal.
- `src/feasibility/world/createOrchardLighting.ts` — world sun, sky fill, haze, and renderer shadow policy.
- `src/feasibility/course/createOrchardCourse.ts` — hidden Rapier floor, obstacle, trunk, sensor, and recovery course.
- `src/feasibility/testing/WaypointVehicleNavigator.ts` — deterministic flat-route fixture navigation.
- `src/feasibility/presentation/OrchardHudPresenter.ts` — derives objective, prompt, and cargo presentation from existing runtime state.
- `src/feasibility/createFeasibilityApp.ts` — composition root only; wires the new world layers into existing controllers.

---

### Task 1: Author and validate the flat orchard world definition

**Files:**
- Create: `src/feasibility/world/orchardWorldDefinition.ts`
- Create: `src/feasibility/world/validateOrchardWorldDefinition.ts`
- Create: `tests/unit/feasibility/orchardWorldDefinition.test.ts`

**Interfaces:**
- Consumes: no earlier task output.
- Produces: `ORCHARD_WORLD_DEFINITION: OrchardWorldDefinition` and `validateOrchardWorldDefinition(definition): void` for all later tasks.

- [ ] **Step 1: Write failing definition and validator tests**

```ts
import { describe, expect, it } from 'vitest'
import {
  ORCHARD_WORLD_DEFINITION,
  type OrchardWorldDefinition,
} from '../../../src/feasibility/world/orchardWorldDefinition'
import { validateOrchardWorldDefinition } from '../../../src/feasibility/world/validateOrchardWorldDefinition'

describe('orchard world definition', () => {
  it('pins one flat 80 by 60 metre world and all semantic anchors', () => {
    expect(ORCHARD_WORLD_DEFINITION.bounds).toEqual({ widthM: 80, depthM: 60 })
    expect(ORCHARD_WORLD_DEFINITION.gameplayPlaneY).toBe(0)
    expect(ORCHARD_WORLD_DEFINITION.sensors.map(({ id }) => id)).toEqual([
      'parking', 'tree-inventory', 'basket', 'crate', 'cargo-slot', 'delivery',
    ])
    expect(ORCHARD_WORLD_DEFINITION.treeInstances).toHaveLength(30)
    expect(() => validateOrchardWorldDefinition(ORCHARD_WORLD_DEFINITION))
      .not.toThrow()
  })

  it('rejects gameplay anchors above the plane and duplicate stable ids', () => {
    const invalid = structuredClone(ORCHARD_WORLD_DEFINITION) as OrchardWorldDefinition
    invalid.sensors[0]!.translation.y = 0.1
    invalid.treeInstances[1]!.id = invalid.treeInstances[0]!.id
    expect(() => validateOrchardWorldDefinition(invalid))
      .toThrow(/WORLD_(OUT_OF_PLANE|DUPLICATE_ID)/)
  })

  it('keeps the vehicle corridor clear of farmhouse, walls, and tree trunks', () => {
    const invalid = structuredClone(ORCHARD_WORLD_DEFINITION) as OrchardWorldDefinition
    invalid.obstacles.push({
      id: 'blocked-road',
      kind: 'box',
      translation: { x: 0, y: 0, z: 0 },
      halfExtents: { x: 2.5, y: 1, z: 1 },
    })
    expect(() => validateOrchardWorldDefinition(invalid))
      .toThrow('WORLD_ROUTE_CLEARANCE_BLOCKED')
  })

  it('rejects an interaction target enclosed by obstacle footprints', () => {
    const invalid = structuredClone(ORCHARD_WORLD_DEFINITION) as OrchardWorldDefinition
    const tree = invalid.sensors.find(({ id }) => id === 'tree-inventory')!
    invalid.obstacles.push(
      { id: 'tree-wall-n', kind: 'box', translation: { x: 4.5, y: 0, z: 13.3 }, halfExtents: { x: 1.4, y: 1, z: 0.1 } },
      { id: 'tree-wall-s', kind: 'box', translation: { x: 4.5, y: 0, z: 10.7 }, halfExtents: { x: 1.4, y: 1, z: 0.1 } },
      { id: 'tree-wall-e', kind: 'box', translation: { x: 5.8, y: 0, z: 12 }, halfExtents: { x: 0.1, y: 1, z: 1.4 } },
      { id: 'tree-wall-w', kind: 'box', translation: { x: 3.2, y: 0, z: 12 }, halfExtents: { x: 0.1, y: 1, z: 1.4 } },
    )
    expect(tree.translation).toEqual({ x: 4.5, y: 0, z: 12 })
    expect(() => validateOrchardWorldDefinition(invalid))
      .toThrow('WORLD_TARGET_UNREACHABLE: tree-inventory')
  })
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm run test:unit -- tests/unit/feasibility/orchardWorldDefinition.test.ts
```

Expected: FAIL because `orchardWorldDefinition` does not exist.

- [ ] **Step 3: Implement the immutable world data**

Define these exact public types and constants:

```ts
export type OrchardSensorId =
  | 'parking' | 'tree-inventory' | 'basket'
  | 'crate' | 'cargo-slot' | 'delivery'

export interface WorldPoint { x: number; y: number; z: number }
export interface WorldPose {
  translation: WorldPoint
  yawRadians: number
}
export interface WorldSensor {
  id: OrchardSensorId
  translation: WorldPoint
  halfExtents: WorldPoint
  visualBinding:
    | { kind: 'world-node'; nodeName: string }
    | { kind: 'tree-instance'; instanceId: string }
    | { kind: 'vehicle-anchor'; nodeName: 'cargo_slot_01' }
}
export interface OrchardTreeInstance {
  id: string
  variant: 'a' | 'b' | 'c'
  translation: WorldPoint
  yawRadians: number
  uniformScale: number
}
export type WorldObstacle =
  | { id: string; kind: 'box'; translation: WorldPoint; halfExtents: WorldPoint }
  | { id: string; kind: 'trunk'; translation: WorldPoint; radiusM: number; halfHeightM: number }

export interface OrchardWorldDefinition {
  bounds: { widthM: 80; depthM: 60 }
  gameplayPlaneY: 0
  vehicleCorridorHalfWidthM: 2.5
  spawnPoses: { vehicle: WorldPose; player: WorldPose }
  route: { outbound: readonly WorldPoint[]; returning: readonly WorldPoint[] }
  sensors: WorldSensor[]
  safePoints: Array<{ id: string; pose: WorldPose }>
  treeInstances: OrchardTreeInstance[]
  obstacles: WorldObstacle[]
  landmarks: Array<{ id: string; nodeName: string; translation: WorldPoint }>
  lighting: {
    sun: { id: 'orchard-sun'; direction: WorldPoint; color: 0xffe0b2; intensity: 2.6 }
    sky: { id: 'orchard-sky'; color: 0xbfd8e8; groundColor: 0x6a513b; intensity: 1.25 }
  }
}
```

Use the following layout values verbatim:

```ts
const ROW_X = [-13.5, -9, -4.5, 4.5, 9, 13.5] as const
const TREE_Z = [12, 16.5, 21, 25.5, 30] as const
const OUTBOUND = [
  { x: 0, y: 0, z: -18 },
  { x: 0, y: 0, z: -5 },
  { x: 0, y: 0, z: 7 },
  { x: 0, y: 0, z: 10.5 },
] as const
const RETURNING = [
  { x: 0, y: 0, z: 10.5 },
  { x: 0, y: 0, z: 6 },
  { x: 0, y: 0, z: -5 },
  { x: 0, y: 0, z: -18 },
] as const
```

Place delivery at `(0, 0, -18)`, parking at `(0, 0, 10.5)`, the active tree at `(4.5, 0, 12)`, basket at `(2.6, 0, 12.5)`, crate at `(1.4, 0, 12.5)`, and cargo slot at `(0.7, 0, 10.5)`. Generate 30 deterministic tree IDs `orchard-tree-r01-c01` through `orchard-tree-r06-c05`, cycling variants `a/b/c`, yaw values from a fixed numeric table, and scales between `0.94` and `1.06`.

Bind the six sensors exactly as follows:

| Sensor | Visual binding |
| --- | --- |
| `parking` | world node `orchard_parking_anchor` |
| `tree-inventory` | tree instance `orchard-tree-r04-c01` at `(4.5, 0, 12)` |
| `basket` | world node `harvest_basket_anchor` |
| `crate` | world node `packing_crate_anchor` |
| `cargo-slot` | vehicle anchor `cargo_slot_01` |
| `delivery` | world node `farmhouse_delivery_anchor` |

Give parking and delivery half-extents `(1.5, 0.75, 1.5)`, tree inventory
`(1, 1, 1)`, and basket, crate, and cargo slot `(0.75, 0.75, 0.75)`. Set
vehicle spawn to `(0, 0, -16.5)` facing `+Z`, player spawn to
`(1.2, 0, -16.5)` facing the vehicle, and safe points at vehicle spawn,
parking, and delivery. Author landmark entries for the four world nodes above
at their sensor translations. Place farmhouse/yard-wall/gate/work-prop box
anchors outside the 5m route corridor and generate one trunk obstacle per tree
instance with `radiusM: 0.18` and `halfHeightM: 0.8`.

- [ ] **Step 4: Implement fail-closed validation**

`validateOrchardWorldDefinition()` must:

```ts
const PLANE_EPSILON_M = 0.001
const MIN_TREE_CLEARANCE_M = 2.6

// 1. collect every sensor, safe-point, tree, obstacle, and landmark id;
// 2. throw WORLD_DUPLICATE_ID for duplicates;
// 3. throw WORLD_OUT_OF_PLANE when any spawn, route point, sensor anchor,
//    safe-point pose, tree anchor, obstacle anchor, or landmark differs from y=0;
// 4. keep every gameplay point within ±40m X and ±30m Z;
// 5. require all six semantic sensor IDs exactly once;
// 6. reject any obstacle intersecting a 5m-wide corridor around either route;
// 7. require adjacent row centers to retain at least 2.6m clear width after trunk radius;
// 8. require the sun and sky IDs and finite positive intensities.
// 9. require every world-node binding to name a landmark, every tree binding
//    to name an existing tree instance, and the vehicle binding to be cargo_slot_01.
// 10. rasterize obstacle footprints onto a 0.5m XZ grid inflated by the 0.22m
//     player radius, flood-fill from player spawn, and throw
//     WORLD_TARGET_UNREACHABLE: <sensor-id> when a sensor has no reachable cell.
// 11. require outbound start/end to match vehicle spawn/parking within 2m and
//     returning start/end to match parking/delivery within 2m.
```

- [ ] **Step 5: Run the focused test and full unit suite**

Run:

```powershell
npm run test:unit -- tests/unit/feasibility/orchardWorldDefinition.test.ts
npm run test:unit
```

Expected: focused tests pass; full unit suite remains green.

- [ ] **Step 6: Commit Task 1**

```powershell
git add src/feasibility/world/orchardWorldDefinition.ts src/feasibility/world/validateOrchardWorldDefinition.ts tests/unit/feasibility/orchardWorldDefinition.test.ts
git commit -m "feat: define flat peach orchard world"
```

---

### Task 2: Build the authored peach-tree GLB family

**Files:**
- Create: `tools/blender/build_peach_tree_overall.py`
- Create: `tests/blender/peach_orchard_scene_regressions.py`
- Create: `resources/blender/environment/peach-tree-overall-v1.blend`
- Create: `public/assets/environment/peach-tree-overall-v1/visual.glb`
- Create: `public/assets/environment/peach-tree-overall-v1/export-metrics.json`
- Create: `public/assets/environment/peach-tree-overall-v1/LICENSE.md`
- Modify: `public/assets/asset-manifest.json`

**Interfaces:**
- Consumes: variant names and spacing contract from Task 1.
- Produces: critical asset `environment.peach-tree-overall-v1` with nodes `peach_tree_variant_a`, `peach_tree_variant_b`, and `peach_tree_variant_c`.

- [ ] **Step 1: Write failing real-Blender asset tests**

```python
class PeachOrchardSceneRegressions(unittest.TestCase):
    def test_tree_family_has_three_authored_variants(self):
        build_peach_tree_overall.build_scene()
        roots = [bpy.data.objects.get(f"peach_tree_variant_{suffix}") for suffix in "abc"]
        self.assertTrue(all(root is not None for root in roots))
        for root in roots:
            meshes = [child for child in root.children_recursive if child.type == "MESH"]
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
```

- [ ] **Step 2: Run Blender tests and verify RED**

Run:

```powershell
& 'D:\codex_project_work\0728_some_github\.b4512-84afd5f\blender.exe' --background --factory-startup --python tests/blender/peach_orchard_scene_regressions.py
```

Expected: import failure for `build_peach_tree_overall`.

- [ ] **Step 3: Implement the tree-family builder**

The module public surface and implementation responsibilities are exact:

| Function | Required implementation |
| --- | --- |
| `reset_scene()` | Remove every object, collection, material, mesh, image, camera, and light from the factory-startup file so repeated runs are deterministic. |
| `create_tapered_branch(name, points, radii, radial_segments=8)` | Build one connected ring mesh along the supplied points, bridge adjacent rings, cap both ends, recalculate outward normals, and return the mesh object. |
| `create_leaf_cluster(name, center, rotation, scale, material)` | Create a lens-profile leaf mesh, duplicate it into a small non-coplanar cluster, apply transforms, assign `M_Tree_Leaf`, and return the parent object. |
| `create_peach(name, center, scale, material)` | Create a low-segment peach mesh with a stem pocket and shallow suture, apply transforms, assign `M_Tree_Peach`, and return it. |
| `build_variant(name, seed, scaffold_angles, crown_scale)` | Seed a local `random.Random`, create the root empty, trunk, four primary scaffolds, secondary branches, leaf clusters, and fruit; parent all authored meshes beneath the named root. |
| `build_scene()` | Call `reset_scene()`, create the three shared materials, build variants `a`, `b`, and `c` with seeds `1103`, `2207`, and `3301`, then update the dependency graph. |
| `measure_variants()` | Evaluate world-space bounds and triangulated loop counts per named root and return dictionaries containing `name`, `heightM`, `crownDiameterM`, `triangles`, and `materialCount`. |
| `save_and_export(blend_path, glb_path, metrics_path)` | Create parent directories, save the source `.blend`, export only the three variant roots as GLB with `+Y` up and `-Z` forward, and write sorted UTF-8 JSON metrics. |

Define `VARIANT_NAMES` as exactly `("peach_tree_variant_a", "peach_tree_variant_b", "peach_tree_variant_c")` and parse the three output paths after Blender's `--` separator with `argparse`.

Build each variant from one flared trunk, four tapered primary scaffolds,
secondary branches, custom lens-shaped leaf meshes, and peach meshes with a
stem pocket and shallow suture. Do not create crossed planes around a pole or a
spherical lollipop crown. Use deterministic seeds `1103`, `2207`, and `3301`.
Use material IDs `M_Tree_Bark`, `M_Tree_Leaf`, and `M_Tree_Peach`; fruit color
is the only saturated focal accent. Each root origin is trunk ground center and
all transforms are applied before export. Join trunk and branch parts into one
bark mesh, leaf parts into one leaf mesh, and fruit parts into one fruit mesh per
variant so the three variants require no more than nine instanced draw batches.

- [ ] **Step 4: Export and record repository-owned provenance**

Run:

```powershell
& 'D:\codex_project_work\0728_some_github\.b4512-84afd5f\blender.exe' --background --factory-startup --python tools/blender/build_peach_tree_overall.py -- --blend resources/blender/environment/peach-tree-overall-v1.blend --glb public/assets/environment/peach-tree-overall-v1/visual.glb --metrics public/assets/environment/peach-tree-overall-v1/export-metrics.json
```

`LICENSE.md` must say the asset is repository-authored for this project, has no
third-party mesh or texture dependency, and uses the project repository's
license. Add a manifest entry with `assetId` `environment.peach-tree-overall-v1`,
`kind` `vegetation`, no collider, required variant nodes, one LOD entry capped at
3,500 triangles per variant, three materials maximum, zero image textures, and
`maxInstances: 30`.

- [ ] **Step 5: Run Blender and asset validation**

```powershell
& 'D:\codex_project_work\0728_some_github\.b4512-84afd5f\blender.exe' --background --factory-startup --python tests/blender/peach_orchard_scene_regressions.py
npm run assets:validate
```

Expected: Blender tests pass and asset validation reports zero errors.

- [ ] **Step 6: Commit Task 2**

```powershell
git add tools/blender/build_peach_tree_overall.py tests/blender/peach_orchard_scene_regressions.py resources/blender/environment/peach-tree-overall-v1.blend public/assets/environment/peach-tree-overall-v1 public/assets/asset-manifest.json
git commit -m "assets: add peach orchard tree family"
```

---

### Task 3: Build the farmhouse, road, orchard boundary, and background GLB

**Files:**
- Create: `tools/blender/build_orchard_world_overall.py`
- Modify: `tests/blender/peach_orchard_scene_regressions.py`
- Create: `resources/blender/environment/orchard-world-overall-v1.blend`
- Create: `public/assets/environment/orchard-world-overall-v1/visual.glb`
- Create: `public/assets/environment/orchard-world-overall-v1/export-metrics.json`
- Create: `public/assets/environment/orchard-world-overall-v1/LICENSE.md`
- Modify: `public/assets/asset-manifest.json`

**Interfaces:**
- Consumes: world landmarks and bounds from Task 1.
- Produces: critical asset `environment.orchard-world-overall-v1` with required
  root nodes `farmhouse_yard`, `village_road`, `orchard_gate`,
  `orchard_parking`, `background_dressing`, and `crate_instances`, plus semantic nodes
  `orchard_parking_anchor`, `harvest_basket_anchor`, `packing_crate_anchor`,
  and `farmhouse_delivery_anchor`, plus state groups `harvest_basket_empty`,
  `harvest_basket_full`, `packing_crate_empty`, `packing_crate_full`, and
  `delivery_complete`.

- [ ] **Step 1: Add failing real-Blender world-shell tests**

```python
def test_world_shell_contains_authored_landmark_groups(self):
    build_orchard_world_overall.build_scene()
    for name in (
        "farmhouse_yard", "village_road", "orchard_gate",
        "orchard_parking", "background_dressing", "crate_instances",
        "orchard_parking_anchor",
        "harvest_basket_anchor", "packing_crate_anchor",
        "farmhouse_delivery_anchor",
        "harvest_basket_empty", "harvest_basket_full",
        "packing_crate_empty", "packing_crate_full", "delivery_complete",
    ):
        root = bpy.data.objects.get(name)
        self.assertIsNotNone(root)
        if not name.endswith("_anchor"):
            self.assertGreater(len(root.children_recursive), 0)

def test_world_shell_has_no_camera_light_or_debug_mesh(self):
    build_orchard_world_overall.build_scene()
    self.assertFalse(any(obj.type in {"CAMERA", "LIGHT"} for obj in bpy.data.objects))
    self.assertFalse(any(obj.name.lower().startswith("debug") for obj in bpy.data.objects))
    metrics = build_orchard_world_overall.measure_scene()
    self.assertLessEqual(metrics["triangles"], 120_000)
    self.assertLessEqual(metrics["materialCount"], 12)
    self.assertLessEqual(metrics["primitiveCount"], 60)
```

- [ ] **Step 2: Run Blender tests and verify RED**

Run:

```powershell
& 'D:\codex_project_work\0728_some_github\.b4512-84afd5f\blender.exe' --background --factory-startup --python tests/blender/peach_orchard_scene_regressions.py
```

Expected: import failure for `build_orchard_world_overall`.

- [ ] **Step 3: Implement the static-world builder**

Expose these exact functions and implement them as follows:

| Function | Required implementation |
| --- | --- |
| `reset_scene()` | Clear objects and data blocks exactly as the tree builder does, without importing that builder. |
| `create_beveled_masonry_mesh(name, footprint, height, bevel_m, material)` | Extrude the footprint to `height`, bevel structural edges by `bevel_m`, apply weighted normals, assign the supplied material, and return the mesh object. |
| `create_gable_roof(name, center, width, depth, eave_z, ridge_z, material)` | Build the six-faced gable volume from explicit vertices so the roof has real thickness and eaves rather than two floating planes. |
| `create_recessed_opening(name, center, width, height, depth, material)` | Build frame, sill, reveal, and inset door/window panel as separate named meshes under one empty. |
| `create_road_mesh(name, centerline, width_m, shoulder_m, material)` | Sweep left/right road edges along the centerline, perturb only intermediate edge vertices with a fixed seed, triangulate the strip, then create distinct soil shoulder strips. |
| `create_ventilated_crate(name, center, material)` | Build four slotted walls, floor slats, rim, and handles with real gaps; do not use an opaque box. |
| `create_background_ridge(name, control_points, depth_m, material)` | Generate front/back ridge strips from control points, close the sides and bottom, and keep the mesh outside the playable bounds. |
| `build_scene()` | Reset, create the eight named materials, create the five required root empties, author every landmark listed below beneath the correct root, and update the dependency graph. |
| `measure_scene()` | Return `triangles`, `materialCount`, `meshCount`, `primitiveCount`, and world-space `boundsM` after triangulating evaluated meshes. |
| `save_and_export(blend_path, glb_path, metrics_path)` | Save the source `.blend`, export the five required roots to GLB with applied transforms, and write sorted UTF-8 JSON metrics. |

Parse `--blend`, `--glb`, and `--metrics` after Blender's `--` separator with `argparse`; do not import implementation helpers from Task 2.

At the world origin, author:

- a one-storey masonry farmhouse at approximately `(-12, 0, -23)` with gable
  roof, recessed door/windows, eave, lean-to, conduit, downpipe, and material
  boundaries;
- a yard, low wall, 3m gate, sorting edge, drain, 8 ventilated plastic crates,
  hose, broom, and work table;
- a five-metre road from yard to orchard with irregular edge vertices, concrete
  patches, soil shoulders, and drainage traces;
- a visually explicit orchard entrance, parking apron, low boundary, and
  irrigation details;
- non-walkable distant field strips, roof silhouettes, tree belt, and low hill
  ridges outside the playable route.

Create the four semantic anchor empties at the exact Task 1 coordinates and
parent each to the visible mesh group it describes. The basket and crate
anchors must sit inside their corresponding authored prop bounds; the parking
and delivery anchors must sit on their visibly marked ground areas.

Author cached state groups for an empty/full harvest basket, empty/full packing
crate, and delivered-crate stack. The full variants contain visible peach
meshes; `delivery_complete` contains a visible completed-load arrangement, not
a glowing debug marker. Export all groups and let runtime visibility express
the domain state.

Under `crate_instances`, create one authored `crate_source` mesh and eight
empties named `crate_marker_01` through `crate_marker_08`. The source supplies
geometry and material only; its first marker owns the visible placement. Join
all remaining static meshes by root and material before export so the world
shell does not preserve one draw call per modeling part.

Use the controlled palette and material IDs `M_Wall`, `M_Roof`, `M_Metal`,
`M_Concrete`, `M_Soil`, `M_PropGreen`, `M_BackgroundField`, and
`M_BackgroundHill`. The GLB contains visual content only; hidden Rapier
collision is Task 5.

- [ ] **Step 4: Export, register, and record provenance**

Run the world builder with explicit output paths:

```powershell
& 'D:\codex_project_work\0728_some_github\.b4512-84afd5f\blender.exe' --background --factory-startup --python tools/blender/build_orchard_world_overall.py -- --blend resources/blender/environment/orchard-world-overall-v1.blend --glb public/assets/environment/orchard-world-overall-v1/visual.glb --metrics public/assets/environment/orchard-world-overall-v1/export-metrics.json
```

Add a manifest entry with `assetId` `environment.orchard-world-overall-v1`,
`kind` `environment`, no collider, all 15 required nodes, a 120,000-triangle
ceiling, 12 materials maximum, zero image textures, and `maxInstances: 1`.
`LICENSE.md` must state that this world shell was authored in this repository,
contains no third-party mesh or texture dependency, and follows the repository
license.

- [ ] **Step 5: Run Blender tests, asset validation, and build**

```powershell
& 'D:\codex_project_work\0728_some_github\.b4512-84afd5f\blender.exe' --background --factory-startup --python tests/blender/peach_orchard_scene_regressions.py
npm run assets:validate
npm run build
```

Expected: all commands pass.

- [ ] **Step 6: Commit Task 3**

```powershell
git add tools/blender/build_orchard_world_overall.py tests/blender/peach_orchard_scene_regressions.py resources/blender/environment/orchard-world-overall-v1.blend public/assets/environment/orchard-world-overall-v1 public/assets/asset-manifest.json
git commit -m "assets: add rural orchard world shell"
```

---

### Task 4: Load and assemble the visible world fail-closed

**Files:**
- Modify: `public/feasibility/runtime-assets.json`
- Modify: `src/feasibility/assets/runtimeAssetContract.ts`
- Modify: `src/feasibility/assets/SliceAssetLoader.ts`
- Create: `src/feasibility/world/createOrchardWorldVisual.ts`
- Create: `src/feasibility/world/createOrchardLighting.ts`
- Create: `src/feasibility/vehicle/createBatchedTricycleVisual.ts`
- Modify: `src/feasibility/createFeasibilityApp.ts`
- Modify: `tests/unit/feasibility/runtimeAssetContract.test.ts`
- Modify: `tests/unit/feasibility/runtimeAssembly.test.ts`
- Create: `tests/unit/feasibility/orchardWorldVisual.test.ts`
- Create: `tests/unit/feasibility/batchedTricycleVisual.test.ts`

**Interfaces:**
- Consumes: both Task 2/3 manifest entries and `ORCHARD_WORLD_DEFINITION`.
- Produces: `SliceAssets.environmentWorldVisual`,
  `SliceAssets.peachTreeFamilyVisual`, `createOrchardWorldVisual()`,
  `createBatchedTricycleVisual()`, and `createOrchardLighting()`.

- [ ] **Step 1: Write failing contract and assembly tests**

First update the existing `expectedContract` fixture in
`runtimeAssetContract.test.ts`: change `version` from `1` to `2` and add the
exact `environment` object shown in the first assertion below. Keep
`mutableContract()` cloning that single canonical fixture.

```ts
it('requires exact environment asset ids and tree variants', () => {
  const expectedContractV2 = {
    vehicle: expectedContract.vehicle,
    character: expectedContract.character,
    version: 2,
    environment: {
      worldAssetId: 'environment.orchard-world-overall-v1',
      treeAssetId: 'environment.peach-tree-overall-v1',
      treeVariantNodes: {
        a: 'peach_tree_variant_a',
        b: 'peach_tree_variant_b',
        c: 'peach_tree_variant_c',
      },
    },
  } as const
  expect(parseRuntimeAssetContract(expectedContractV2))
    .toEqual(expectedContractV2)
})

it('loads both environment GLBs as critical assets', async () => {
  const loadCritical = vi.fn(async (_loader, request) => ({
    scene: Object.assign(new Group(), { name: request.assetId }),
    anchors: new Map(),
    clips: [],
  }))
  const loader = createSliceAssetLoader({
    gltfLoader: { loadAsync: vi.fn() },
    loadCritical,
  })
  const assets = await loader.load(contract, assetManifestJson)

  expect(Object.keys(assets).sort()).toEqual([
    'characterVisual',
    'environmentWorldVisual',
    'peachTreeFamilyVisual',
    'vehicleCollision',
    'vehicleVisual',
  ])
  expect(loadCritical.mock.calls.map((call) => call[1].assetId)).toEqual([
    'vehicle.electric-tricycle-a:visual',
    'character.farmer-a-base:visual',
    'vehicle.electric-tricycle-a:collider',
    'environment.orchard-world-overall-v1:visual',
    'environment.peach-tree-overall-v1:visual',
  ])
})

it('assembles exactly 30 trees without visible fallback geometry', () => {
  const assembled = createOrchardWorldVisual({
    scene,
    assets: createSyntheticSliceAssets(),
    definition: ORCHARD_WORLD_DEFINITION,
  })
  expect(assembled.treeInstanceCount).toBe(30)
  expect(assembled.crateInstanceCount).toBe(8)
  expect(assembled.boundSensorIds).toEqual([
    'parking', 'tree-inventory', 'basket', 'crate', 'cargo-slot', 'delivery',
  ])
  assembled.applyFruitOwner('vehicle')
  expect(assembled.stateVisibility()).toEqual({
    activeTreeFruit: false,
    basketFull: false,
    crateFull: false,
    cargoLoaded: true,
    deliveryComplete: false,
  })
  expect(assembled.root.name).toBe('orchard-world')
  expect(assembled.root.getObjectByName('debug-course')).toBeUndefined()
})

it('batches the rigid tricycle while preserving anchors and wheel parents', () => {
  const batched = createBatchedTricycleVisual(createSyntheticTricycleAsset())
  expect(batched.drawBatchCount).toBeLessThanOrEqual(20)
  expect(batched.root.getObjectByName('driver_seat')).toBeDefined()
  expect(batched.root.getObjectByName('cargo_slot_01')).toBeDefined()
  expect(batched.root.getObjectByName('wheel_front')).toBeDefined()
})
```

In `orchardWorldVisual.test.ts`, implement `createSyntheticSliceAssets()` with
one named `Group` for the static world, the four required world-anchor groups,
the five state groups, `crate_source`, eight crate markers, three named tree
variant roots, and a vehicle `cargo_slot_01` group. Populate each
synthetic `LoadedCriticalAsset.anchors` map with those same object references.
Put one `Mesh(new BufferGeometry(), new MeshStandardMaterial())` under each tree
variant so the test exercises real mesh traversal and instancing without
loading files. Use fresh geometry and material objects in this test fixture
only; they are not a runtime fallback path.

- [ ] **Step 2: Run focused unit tests and verify RED**

```powershell
npm run test:unit -- tests/unit/feasibility/runtimeAssetContract.test.ts tests/unit/feasibility/runtimeAssembly.test.ts tests/unit/feasibility/orchardWorldVisual.test.ts tests/unit/feasibility/batchedTricycleVisual.test.ts
```

Expected: failures for contract version 2, missing environment assets, and missing visual assembler.

- [ ] **Step 3: Extend the runtime contract and critical loader**

Change the runtime contract to exact version 2:

```ts
const environmentSchema = z.object({
  worldAssetId: z.literal('environment.orchard-world-overall-v1'),
  treeAssetId: z.literal('environment.peach-tree-overall-v1'),
  treeVariantNodes: z.object({
    a: z.literal('peach_tree_variant_a'),
    b: z.literal('peach_tree_variant_b'),
    c: z.literal('peach_tree_variant_c'),
  }).strict(),
}).strict()

const runtimeAssetContractSchema = z.object({
  version: z.literal(2),
  vehicle: vehicleSchema,
  character: characterSchema,
  environment: environmentSchema,
}).strict()
```

Extend `SliceAssets` with two `LoadedCriticalAsset` fields and load them through
the same `loadCriticalGlb` path. A missing manifest entry, failed fetch, parse
failure, or required-node mismatch must reject the entire load promise with the
exact environment asset ID.

- [ ] **Step 4: Implement instanced tree and static-world assembly**

Expose:

```ts
export interface OrchardWorldVisual {
  readonly root: Group
  readonly treeInstanceCount: number
  readonly crateInstanceCount: number
  readonly boundSensorIds: readonly OrchardSensorId[]
  applyFruitOwner(owner: OwnerId): void
  stateVisibility(): Readonly<{
    activeTreeFruit: boolean
    basketFull: boolean
    crateFull: boolean
    cargoLoaded: boolean
    deliveryComplete: boolean
  }>
  dispose(): void
}

export function createOrchardWorldVisual(input: Readonly<{
  scene: Scene
  assets: SliceAssets
  definition: OrchardWorldDefinition
}>): OrchardWorldVisual
```

Clone the static world root once. For each tree variant, traverse its source
meshes and build `InstancedMesh` batches using shared geometry/material. Compose
each instance matrix from the world definition's translation, yaw, scale, and
the source child's local transform. Set stable names such as
`orchard-tree-a-branch_primary` from source mesh names, set
`matrixAutoUpdate = false`,
enable shadows only for near-field trunk/crown batches, and dispose only the
created instance batches/root ownership—not shared source asset data.

Find `crate_source` and `crate_marker_01` through `crate_marker_08` under the
static world root. Build one `InstancedMesh` per source material, set all eight
marker transforms, remove the source render mesh from the cloned world, and
report `crateInstanceCount: 8`. Missing or duplicate markers fail with
`WORLD_CRATE_INSTANCE_LAYOUT_INVALID`.

Resolve every sensor `visualBinding` during assembly. A `world-node` must exist
in `environmentWorldVisual.anchors`, a `tree-instance` must exist in the world
definition and receive a stable instance-index record, and the
`vehicle-anchor` must exist in `vehicleVisual.anchors`. Throw
`WORLD_VISUAL_BINDING_MISSING: <sensor-id>:<target>` before adding the root to
the scene if any binding is absent. Populate `boundSensorIds` only after all six
bindings resolve.

Cache the active tree fruit instance index and all five authored state groups
during assembly; never rediscover them by traversing the scene per frame.
`applyFruitOwner()` is idempotent and maps `tree`, `basket`, `crate`, `vehicle`,
and `delivered` to exactly one visible filled state. For the active tree fruit,
write either its authored matrix or a zero-scale matrix. For `vehicle`, attach
one cloned authored crate visual under the already resolved `cargo_slot_01`
anchor. For `delivered`, hide the cargo clone and show `delivery_complete`.
The `player` owner hides filled basket/crate/cargo/delivery state because the
fruit is being carried by the character. `stateVisibility()` reports cached
booleans for tests and telemetry without exposing mutable scene objects.

- [ ] **Step 5: Batch the existing rigid tricycle without changing its GLB**

`createBatchedTricycleVisual(asset)` first calls `scene.updateMatrixWorld(true)`
and records every required anchor object. Partition rendered meshes into four
ownership groups: rigid chassis, `wheel_front`, `wheel_rear_left`, and
`wheel_rear_right`. Group each ownership partition by material identity, clone
each geometry, apply the mesh-to-owner matrix, and merge it with
`BufferGeometryUtils.mergeGeometries`. Replace original render meshes with the
merged batches while leaving the named wheel parents and all anchor objects in
place. Reject skinned meshes and morph targets because this optimizer is only
for the approved rigid vehicle. Return:

```ts
export interface BatchedTricycleVisual {
  readonly root: Object3D
  readonly drawBatchCount: number
  dispose(): void
}
```

The synthetic test fixture creates multiple same-material chassis parts and
wheel descendants, then verifies transform preservation within `0.001m`, all
required anchors, rotatable wheel parents, and disposal of only cloned merged
geometries. At runtime, fail closed if `drawBatchCount > 20`.

- [ ] **Step 6: Implement motivated global lighting**

`createOrchardLighting(scene, renderer, definition)` adds exactly:

```ts
new HemisphereLight(0xbfd8e8, 0x6a513b, 1.25)
new DirectionalLight(0xffe0b2, 2.6)
new FogExp2(0xc9c1ad, 0.008)
```

Name lights `orchard-sky` and `orchard-sun`, place the sun from the normalized
world definition direction at 40m, enable shadows with a 2048 map and a camera
covering the near route only, use `renderer.shadowMap.enabled = true`, and add no
local light without an emitter.

- [ ] **Step 7: Wire the visible world into the composition root**

After critical asset load and before actor assembly, call
`createBatchedTricycleVisual`, `createOrchardWorldVisual`, and
`createOrchardLighting`. Pass the preserved wheel/anchor hierarchy to the
existing rig reader and visual controller. Remove the existing generic
ambient/directional lights. Stop/dispose both new world handles and the vehicle
batch handle in `FeasibilityApp.stop()`.

After each domain snapshot, call
`worldVisual.applyFruitOwner(snapshot.fruitOwner)` before rendering. This is
presentation derived from the authoritative domain; it must not dispatch
commands or retain a second business-state machine.

- [ ] **Step 8: Run unit, asset, and build verification**

```powershell
npm run test:unit
npm run assets:validate
npm run build
```

Expected: all pass.

- [ ] **Step 9: Commit Task 4**

```powershell
git add public/feasibility/runtime-assets.json src/feasibility/assets src/feasibility/world src/feasibility/createFeasibilityApp.ts tests/unit/feasibility
git commit -m "feat: assemble visible peach orchard world"
```

---

### Task 5: Replace the slope fixture with flat collision and route navigation

**Files:**
- Create: `src/feasibility/course/createOrchardCourse.ts`
- Modify: `src/feasibility/course/courseDefinition.ts`
- Modify: `src/feasibility/createFeasibilityApp.ts`
- Create: `src/feasibility/testing/WaypointVehicleNavigator.ts`
- Modify: `src/feasibility/testing/ScriptedInput.ts`
- Modify: `src/feasibility/recovery/createCourseRecoveryObservation.ts`
- Modify: `tests/unit/feasibility/testCourse.test.ts`
- Modify: `tests/unit/feasibility/scriptedInput.test.ts`
- Modify: `tests/fixtures/feasibility/routeInputs.ts`
- Modify: `tests/e2e/feasibility.spec.ts`

**Interfaces:**
- Consumes: Task 1 world data and Task 4 visual world.
- Produces: `createOrchardCourse(scene, physics, definition, debugEnabled): OrchardCourse` and route-driven deterministic fixture input.

- [ ] **Step 1: Write failing flat-course and navigator tests**

```ts
it('creates one flat floor, hidden obstacles, tree trunks, and six sensors', () => {
  const course = createOrchardCourse(scene, physics, ORCHARD_WORLD_DEFINITION, false)
  expect(course.floorColliders).toHaveLength(1)
  expect(course.trunkColliders).toHaveLength(30)
  expect(course.sensorIds).toEqual([
    'parking', 'tree-inventory', 'basket', 'crate', 'cargo-slot', 'delivery',
  ])
  expect(course.debugRoot).toBeNull()
})

it('navigates outbound and return from supplied waypoints without slope phases', () => {
  const navigator = new WaypointVehicleNavigator({
    arrivalDistanceM: 0.8,
    waypoints: ORCHARD_WORLD_DEFINITION.route.outbound,
  })
  expect(navigator.command(vehicleAt(-18)).command.longitudinal).toBe('forward')
  navigator.reset(ORCHARD_WORLD_DEFINITION.route.returning)
  expect(navigator.currentWaypoint()).toEqual({ x: 0, y: 0, z: 10.5 })
})
```

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
npm run test:unit -- tests/unit/feasibility/testCourse.test.ts tests/unit/feasibility/scriptedInput.test.ts
```

Expected: missing `createOrchardCourse` and `WaypointVehicleNavigator`.

- [ ] **Step 3: Build hidden flat collision from authored data**

`createOrchardCourse()` creates:

- one fixed 80 by 60 metre floor cuboid with its top at `y=0`;
- fixed box colliders for farmhouse, yard walls, gate edges, and work props from
  `definition.obstacles`;
- fixed cylinder colliders for all 30 tree trunks;
- six Rapier sensor cuboids from `definition.sensors`;
- stable spawn poses and safe points from the definition;
- wireframe debug meshes only when `debugEnabled === true`; tag every debug
  object with `userData.debugOnly = true` so telemetry measures actual scene
  visibility rather than configuration intent.

The returned interface is:

```ts
export interface OrchardCourse {
  readonly spawnPoses: OrchardWorldDefinition['spawnPoses']
  readonly parkingSensor: CourseSensor
  readonly harvestSensors: {
    readonly treeInventory: CourseSensor
    readonly basket: CourseSensor
    readonly crate: CourseSensor
    readonly cargoSlot: CourseSensor
  }
  readonly deliverySensor: CourseSensor
  readonly safePoints: OrchardWorldDefinition['safePoints']
  readonly floorColliders: readonly CourseSurface[]
  readonly obstacleColliders: readonly CourseSurface[]
  readonly trunkColliders: readonly CourseSurface[]
  readonly sensorIds: readonly OrchardSensorId[]
  readonly debugRoot: Group | null
}
```

The world definition stores gameplay poses and sensor anchors on `y=0`.
Convert each `WorldPose.yawRadians` to Rapier's Y-axis quaternion with:

```ts
function yawQuaternion(yawRadians: number): CourseQuaternion {
  return {
    x: 0,
    y: Math.sin(yawRadians / 2),
    z: 0,
    w: Math.cos(yawRadians / 2),
  }
}
```

For every Rapier sensor or obstacle, keep the semantic anchor unchanged but set
the collider centre to `anchor.y + halfExtents.y`; this makes each hidden volume
rise from the gameplay plane instead of being half buried. Set a trunk cylinder
centre to `tree.translation.y + trunkHalfHeightM`. All source anchors therefore
continue to satisfy the `y=0` invariant.

- [ ] **Step 4: Replace hard-coded slope/turn fixture phases with waypoints**

Implement these public navigator types; move the currently private
`ScriptedVehicleCommand` shape out of `ScriptedInput.ts` so both modules use one
contract:

```ts
export interface WaypointVehicleState {
  readonly vehiclePosition: WorldPoint
  readonly vehicleRotation: Readonly<{
    x: number
    y: number
    z: number
    w: number
  }>
  readonly vehicleSpeedMps: number
}

export interface ScriptedVehicleCommand {
  readonly command: VehicleCommand
  readonly profile?: VehicleCommandProfile
}

export class WaypointVehicleNavigator {
  constructor(options: {
    waypoints: readonly WorldPoint[]
    arrivalDistanceM: number
  })
  reset(waypoints: readonly WorldPoint[]): void
  currentWaypoint(): WorldPoint
  command(state: WaypointVehicleState): ScriptedVehicleCommand
}
```

Advance a waypoint only within `arrivalDistanceM`. Desired yaw is
`atan2(target.x - position.x, target.z - position.z)`. Clamp steering to `[-1,1]`,
reduce throttle to `0.25` when heading error exceeds `0.7`, brake above `2.2m/s`,
and use forward drive for both outbound and return routes. `ScriptedInput`
receives `outboundWaypoints` and `returnWaypoints` in `ScriptedFixtureTargets`;
remove `RETURN_WAYPOINTS`, `outboundPhase`, slope naming, and reverse-route
behavior.

Construct one navigator for each route. Reset both at loop completion. The
existing `vehicleCommandToInput()` remains the only conversion from semantic
commands to analog vehicle input, and `SERVICE_BRAKE_SCRIPTED_COMMAND` remains
the stopped/interaction command.

- [ ] **Step 5: Wire course, recovery, and fixture state to the shared definition**

Replace `createTestCourse` use in `createFeasibilityApp` with
`createOrchardCourse`. Pass both route arrays into scripted fixture state.
Recovery checks use `gameplayPlaneY - 0.2` as the floor-loss threshold, preserve
roll timeout and explicit reset behavior, and record only safe points from the
new definition.

- [ ] **Step 6: Run unit and deterministic full-loop tests**

```powershell
npm run test:unit
npm run test:e2e -- tests/e2e/feasibility.spec.ts
npm run feasibility:report
```

Expected: ten loops complete in exact stage order, with zero recovery,
ownership violations, stage violations, fallback, and console errors.

- [ ] **Step 7: Commit Task 5**

```powershell
git add src/feasibility/course src/feasibility/testing src/feasibility/recovery/createCourseRecoveryObservation.ts src/feasibility/createFeasibilityApp.ts tests/unit/feasibility tests/fixtures/feasibility tests/e2e/feasibility.spec.ts artifacts/feasibility
git commit -m "feat: bind harvest loop to flat orchard route"
```

---

### Task 6: Replace the technical shell with a spatial game HUD

**Files:**
- Modify: `src/feasibility/createFeasibilityShell.ts`
- Create: `src/feasibility/presentation/OrchardHudPresenter.ts`
- Modify: `src/feasibility/createFeasibilityApp.ts`
- Modify: `src/style.css`
- Create: `tests/unit/feasibility/orchardHudPresenter.test.ts`
- Modify: `tests/unit/feasibility/feasibilityRoute.test.ts`
- Modify: `tests/unit/appShell.test.ts`

**Interfaces:**
- Consumes: existing `JobState`, `OwnerId`, `ContextualAction`, and `?debug` state.
- Produces: readable objective, interaction prompt, cargo progress, controls disclosure, and debug-only telemetry.

- [ ] **Step 1: Write failing HUD behavior tests**

```ts
it('derives concise Chinese objective and prompt from runtime state', () => {
  const hud = new OrchardHudPresenter(shell)
  hud.update({
    jobState: 'parked-at-orchard',
    fruitOwner: 'tree',
    action: 'pick',
    debugEnabled: false,
  })
  expect(shell.objective.textContent).toBe('进入桃园，采摘成熟桃子')
  expect(shell.interactionPrompt.textContent).toBe('E  采摘')
  expect(shell.debugPanel.hidden).toBe(true)
})

it('shows delivery completion and keeps technical telemetry debug-only', () => {
  const hud = new OrchardHudPresenter(shell)
  hud.update({ jobState: 'delivered', fruitOwner: 'delivered', action: null, debugEnabled: true })
  expect(shell.objective.textContent).toBe('本次桃园运输已完成')
  expect(shell.progress.textContent).toContain('已交付')
  expect(shell.debugPanel.hidden).toBe(false)
})
```

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
npm run test:unit -- tests/unit/feasibility/orchardHudPresenter.test.ts tests/unit/feasibility/feasibilityRoute.test.ts tests/unit/appShell.test.ts
```

Expected: shell fields and `OrchardHudPresenter` are missing.

- [ ] **Step 3: Create the spatial-stage shell**

Extend `FeasibilityShell` with exact fields:

```ts
interface FeasibilityShell {
  canvas: HTMLCanvasElement
  hud: HTMLElement
  objective: HTMLHeadingElement
  interactionPrompt: HTMLParagraphElement
  progress: HTMLParagraphElement
  controls: HTMLDetailsElement
  status: HTMLParagraphElement
  debugPanel: HTMLElement
}
```

The root contains the canvas first and one overlay HUD. Use correct UTF-8 copy:
`桃园采收任务`, `WASD 移动 / 驾驶`, `Space 制动`, `E 交互 / 上下车`, and
`R 恢复`. Remove all mojibake strings. The status remains an accessible live
region but is visually compact after successful load.

- [ ] **Step 4: Implement the state-to-copy presenter**

Use an exhaustive `Record<JobState, string>` for objectives and an exhaustive
`Record<ContextualAction, string>` for prompts:

```ts
const ACTION_COPY: Record<ContextualAction, string> = {
  'accept-job': 'E  接受桃园采收任务',
  'enter-vehicle': 'E  上车',
  'park-and-exit': 'E  停车并下车',
  'exit-vehicle': 'E  下车',
  pick: 'E  采摘',
  'place-in-basket': 'E  放入果篮',
  'pack-crate': 'E  装箱',
  'load-crate': 'E  装载到三轮车',
  deliver: 'E  交付',
}
```

Derive progress only from `fruitOwner`: tree=`待采摘`, player=`手持桃子`,
basket=`果篮`, crate=`已装箱`, vehicle=`运输中`, delivered=`已交付`.
Do not store parallel business state in the presenter.

- [ ] **Step 5: Wire contextual action and HUD updates**

Refactor the existing context reader so both the E-key resolver and HUD receive
the same `ContextualActionContext` and resolved action. Call `hud.update()` once
per render after domain snapshot. Keep `DebugPanel.update()` active only when
`debugEnabled`; set `debugPanel.hidden = !debugEnabled`.

- [ ] **Step 6: Implement responsive spatial-stage CSS**

Use `#app { position: relative; min-height: 100dvh; overflow: hidden; }` and a
full-viewport canvas. Place the objective top-left, progress top-right, prompt
bottom-center, and collapsed controls bottom-left. Use warm translucent panels,
high-contrast text, safe-area padding, and pointer-events only on interactive
controls. At widths below 720px, keep the canvas full-height and stack objective
and progress without moving them into page flow.

- [ ] **Step 7: Run unit and build verification**

```powershell
npm run test:unit
npm run build
```

Expected: all tests and build pass.

- [ ] **Step 8: Commit Task 6**

```powershell
git add src/feasibility/createFeasibilityShell.ts src/feasibility/presentation/OrchardHudPresenter.ts src/feasibility/createFeasibilityApp.ts src/style.css tests/unit
git commit -m "feat: present playable peach orchard HUD"
```

---

### Task 7: Prove the complete overall effect in the browser

**Files:**
- Modify: `tests/e2e/feasibility.spec.ts`
- Modify: `src/feasibility/testing/global.d.ts`
- Modify: `src/feasibility/createFeasibilityApp.ts`
- Create: `artifacts/feasibility/overall-scene/spawn.png`
- Create: `artifacts/feasibility/overall-scene/road-traversal.png`
- Create: `artifacts/feasibility/overall-scene/orchard-arrival.png`
- Create: `artifacts/feasibility/overall-scene/picking-and-packing.png`
- Create: `artifacts/feasibility/overall-scene/loaded-return.png`
- Create: `artifacts/feasibility/overall-scene/delivery-complete.png`
- Create: `artifacts/feasibility/overall-scene/debug-separated.png`
- Create: `artifacts/feasibility/overall-scene/mobile-spawn.png`
- Create: `artifacts/feasibility/overall-scene/mobile-orchard.png`
- Create: `artifacts/feasibility/overall-scene/scene-evidence.json`
- Modify: `README.md`

**Interfaces:**
- Consumes: complete scene, route, and HUD from Tasks 1–6.
- Produces: deterministic telemetry and retained browser evidence proving the overall scene is visible and playable.

- [ ] **Step 1: Write failing browser assertions for world visibility and fail-closed loading**

Extend telemetry with a read-only `world` object and add tests:

```ts
expect(snapshot.world).toMatchObject({
  worldAssetId: 'environment.orchard-world-overall-v1',
  treeAssetId: 'environment.peach-tree-overall-v1',
  treeInstanceCount: 30,
  crateInstanceCount: 8,
  visibleDebugPrimitiveCount: 0,
  omittedOptionalAssetIds: [],
})
expect(snapshot.world.vehicleDrawBatchCount).toBeLessThanOrEqual(20)
expect(snapshot.world.stateVisibility.deliveryComplete).toBe(true)
expect(snapshot.world.drawCalls).toBeLessThanOrEqual(200)
expect(snapshot.world.triangles).toBeLessThanOrEqual(350_000)

await page.route('**/assets/environment/orchard-world-overall-v1/visual.glb',
  (route) => route.fulfill({ status: 404 }))
await page.goto('/feasibility')
await expect(page.getByRole('status')).toContainText(
  'environment.orchard-world-overall-v1:visual',
)
await expect(page.locator('canvas')).toHaveCount(1)
```

- [ ] **Step 2: Run the e2e test and verify RED**

```powershell
npm run test:e2e -- tests/e2e/feasibility.spec.ts
```

Expected: world telemetry fields are absent.

- [ ] **Step 3: Expose immutable world telemetry**

Add to `window.__FEASIBILITY__.snapshot()`:

```ts
let visibleDebugPrimitiveCount = 0
scene.traverse((object) => {
  if (object.visible && object.userData.debugOnly === true) {
    visibleDebugPrimitiveCount += 1
  }
})

world: {
  worldAssetId: contract.environment.worldAssetId,
  treeAssetId: contract.environment.treeAssetId,
  treeInstanceCount: worldVisual.treeInstanceCount,
  crateInstanceCount: worldVisual.crateInstanceCount,
  vehicleDrawBatchCount: batchedVehicle.drawBatchCount,
  visibleDebugPrimitiveCount,
  omittedOptionalAssetIds: [],
  stateVisibility: worldVisual.stateVisibility(),
  drawCalls: renderer.info.render.calls,
  triangles: renderer.info.render.triangles,
}
```

Return it only through the existing structured clone so callers cannot mutate
runtime state. This slice declares no separate optional dressing asset—the
background is part of the critical world GLB—so `omittedOptionalAssetIds` must
remain an explicit empty array. The assertion prevents silent omission from
being confused with an intentionally declared optional load result.

- [ ] **Step 4: Run automated acceptance**

```powershell
npm run test:unit
npm run test:e2e -- tests/e2e/feasibility.spec.ts
npm run feasibility:report
npm run assets:validate
npm run build
git diff --check
```

Expected: every command passes; ten loops remain exact and world budgets pass.

- [ ] **Step 5: Perform the real browser playthrough and retain visual evidence**

Start the canonical runtime:

```powershell
npm run dev -- --host 127.0.0.1 --port 4173
```

At `http://127.0.0.1:4173/feasibility`, use the actual keyboard route and verify:

1. farmhouse and job/delivery yard are immediately legible at spawn;
2. the road and orchard gate guide the vehicle without debug geometry;
3. orchard rows preserve steering and camera clearance;
4. parking, picking, basket, crate, cargo, and delivery prompts match the world;
5. camera framing stays clear on foot and in vehicle;
6. no console error, fallback asset, recovery, or detached light occurs;
7. a mobile-sized viewport keeps the scene primary and HUD readable.

Retain desktop images for spawn, road traversal, orchard arrival, picking and
packing, loaded return, delivery completion, and explicit debug mode. Retain
mobile images for spawn and orchard arrival. Use exactly the nine filenames in
the task file list. Write `scene-evidence.json` with canonical URL, both
viewports, timestamp, loaded and omitted asset IDs, tree/crate counts, vehicle
batch count, draw calls, triangles, console errors, full-loop result, final
state visibility, and all nine screenshot SHA-256 values.

- [ ] **Step 6: Update README and commit Task 7**

README must describe `/feasibility` as the playable overall scene, list the
controls, name the two environment assets, retain the fixture/report commands,
and state that the current character is intentionally deferred.

```powershell
git add tests/e2e/feasibility.spec.ts src/feasibility/testing/global.d.ts src/feasibility/createFeasibilityApp.ts artifacts/feasibility/overall-scene README.md
git commit -m "test: prove playable peach orchard scene"
```

---

## Completion boundary

The plan is complete when `/feasibility` opens into a visible contemporary
rural peach orchard, the player can complete the whole harvest loop using the
existing vehicle and character, the default view contains no debug primitives,
the two environment GLBs load fail-closed, the flat route is deterministic,
world budgets pass, and retained browser evidence shows spawn, orchard arrival,
road traversal, picking/packing, loaded return, delivery completion, debug
separation, and mobile framing.

Character replacement, character art refinement, expanded village exploration,
interiors, weather cycles, traffic, NPC population, and open-world streaming
remain deferred.
