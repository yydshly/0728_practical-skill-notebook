# Electric Tricycle A — Production Brief

Asset ID: `vehicle.electric-tricycle-a`

Kind: `vehicle`

Creation route: `original`

Authoring DCC: Blender; metric scene, `Z` up, authoring front `-Y`

Export: meter, `Y` up, `-Z` forward, ground-center origin

## Authoritative contract

This strict JSON block is the machine-audited contract copy. If prose elsewhere
in this brief conflicts with it, this block and the corresponding JSON contract
must be reconciled before production.

<!-- asset-contract:start -->
```json
{
  "assetId": "vehicle.electric-tricycle-a",
  "kind": "vehicle",
  "units": "meter",
  "upAxis": "Y",
  "forwardAxis": "-Z",
  "origin": "ground-center",
  "lods": [
    {
      "level": 0,
      "maxDistance": 30,
      "maxTriangles": 60000
    }
  ],
  "textureBudget": {
    "maxDimension": 2048,
    "maxTextureCount": 6
  },
  "materialBudget": {
    "maxMaterials": 4
  },
  "requiredCollections": [
    "VISUAL",
    "COLLISION",
    "SOCKETS",
    "RIG"
  ],
  "requiredNodes": [
    "driver_seat",
    "exit_left",
    "wheel_front",
    "wheel_rear_left",
    "wheel_rear_right",
    "cargo_slot_01",
    "cargo_slot_02",
    "cargo_slot_03",
    "cargo_slot_04",
    "cargo_slot_05",
    "cargo_slot_06"
  ],
  "requiredAnimations": [],
  "requiredAnimationEvents": {},
  "creationRoute": "original"
}
```
<!-- asset-contract:end -->

## Intent and recognition

Build a generic, contemporary Chinese open-bed electric agricultural tricycle
that has worked several harvest seasons. It is a compact orchard logistics
vehicle, not a motorcycle with a box and not a miniature pickup. Read order at
game distance: single steered front wheel and fork, open handlebar/driver bay,
low battery/frame mass, two driven rear wheels, then a ribbed steel cargo bed
wide enough for a 2 × 3 layout of contemporary returnable plastic crates.

Use the reference board to understand construction and scale, then design
original panels, lamps, ribs, guards, and control housing. Do not reproduce a
manufacturer grille, badge, decal, plate number, or exact panel breakup. The
finished visual asset must be authored geometry; primitive blockout is allowed
only during proportion work and cannot be the delivered representation.

## Dimensions and proportions

| Measure | Target | Tolerance |
| --- | ---: | ---: |
| Overall length | 2.95 m | ±0.08 m |
| Overall width | 1.15 m | ±0.05 m |
| Handlebar/instrument height | 1.35 m | ±0.06 m |
| Wheelbase | 2.00 m | ±0.05 m |
| Rear wheel track, hub center to hub center | 0.94 m | ±0.04 m |
| Ground clearance at frame | 0.15 m | ±0.02 m |
| Cargo bed internal L × W × side height | 1.50 × 1.06 × 0.42 m | ±0.04 m |
| Driver seat height | 0.77 m | ±0.03 m |
| Front / rear tire outside diameter | 0.58 / 0.55 m | ±0.03 m |

The driver bay must fit the `character.farmer-a` seated pose with 40 mm visual
clearance at knees and elbows. Six contemporary returnable plastic project
crates of exactly 0.50 × 0.35 × 0.28 m must fit as two across by three long
without intersecting the side walls. Each review crate uses a ventilated grid,
integral short-side handholds, a stacking rim, and matching bottom feet. Wood
grain, planks, slats, nails, historic labels, and period crate construction are
prohibited. Keep believable fork rake, axle line, leaf-spring/frame attachment,
tire sidewall, brake hub, battery enclosure, and handlebar reach.

## Required view sheet

Provide all views at matched scale and neutral review lighting:

1. true front orthographic, showing fork, tire, handlebar and light symmetry;
2. left and right orthographic, showing full envelope, wheelbase and bed rake;
3. true rear orthographic, showing track, axle, lamps and tailgate;
4. top orthographic, showing driver-to-bed spacing and the 2 × 3 crate grid;
5. driver-position 50 mm perspective, showing grips, brake levers, display,
   key/switch cluster, foot rests and forward sightline;
6. front and rear three-quarter beauty views;
7. underside diagnostic view with chassis, battery, motor/axle and collision
   overlay.

## Materials, palette, and wear

Use no more than four material slots:

1. `M_Trike_Paint` — faded agricultural green, dielectric painted steel;
2. `M_Trike_Chassis` — dark coated/exposed metal for frame, hubs and fasteners;
3. `M_Trike_Rubber` — tires, grips, foot pads and cable sheaths;
4. `M_Trike_Utility` — seat vinyl, lamps, reflectors, display and unbranded
   control details.

Target paint roughness 0.48–0.62, rubber 0.62–0.76, seat 0.48–0.6, and coated
frame 0.5–0.68. Reserve metallic response for exposed steel. Add restrained
sun fade on upward paint, dust on the lower 250 mm, shallow bed-floor scratches,
grip polish, tire soil, and small edge chips at tailgate contacts. No broad rust
blanket, broken lamp, bent frame, oil leak, showroom clearcoat, or random grunge.

## Geometry and topology

- LOD0 triangle ceiling: **60,000**
- Material slots: **4 maximum**
- Texture files: **6 maximum at 2048 px**
- Required LODs: LOD0 only; keep `LOD1` and `LOD2` collections present and
  empty. Do not invent unapproved substitute geometry in those collections.
- Model wheels, front fork, handlebar, swing/steering assembly, seat, cargo
  tailgate, and chassis as intentional components with useful origins.
- Use radial tire topology and round hub silhouettes. Twelve-sided cylinder
  placeholders, flat tire discs, or cuboid frame stand-ins are not acceptable
  final art.
- Put support loops around hard silhouette changes; use weighted normals on
  broad stamped panels. Remove hidden internal faces that do not establish
  frame structure.
- The front wheel/fork steering axis and all three wheel spin axes must be
  mechanically plausible, even though no animation clips are required now.
- UV target is 512 px/m on controls/seat and 256 px/m elsewhere. Use up to six
  files, preferably paint BaseColor/Normal/ORM and utility
  BaseColor/Normal/ORM.

## Collision

Deliver a separate collision payload of approximately 8–14 convex pieces:
main chassis, battery/driver mass, bed floor, four bed walls/rails, front
fork/wheel envelope, and two rear wheel envelopes. Use only `box_`, `sphere_`,
`capsule_`, or `convex_` names. Collision must preserve ground clearance and
the open bed loading volume; it must not contain per-spoke, cable, lever,
fender-edge, or lamp colliders. Target collision geometry is under 500
triangles.

## Required sockets

All 11 names below are required empties in `SOCKETS`. Use +Y as socket up and
local `-Z` as the gameplay-facing direction after export.

| Socket | Placement / orientation |
| --- | --- |
| `driver_seat` | pelvis point of the seated driver, centered above seat; forward with vehicle |
| `exit_left` | ground point 0.55 m left of driver bay; forward with vehicle |
| `wheel_front` | front wheel hub center; local X on spin axis |
| `wheel_rear_left` | left rear hub center; local X on spin axis |
| `wheel_rear_right` | right rear hub center; local X on spin axis |
| `cargo_slot_01` | bed front-left crate center at crate base |
| `cargo_slot_02` | bed front-right crate center at crate base |
| `cargo_slot_03` | bed middle-left crate center at crate base |
| `cargo_slot_04` | bed middle-right crate center at crate base |
| `cargo_slot_05` | bed rear-left crate center at crate base |
| `cargo_slot_06` | bed rear-right crate center at crate base |

Socket translation tolerance is 20 mm from the approved contact-sheet overlay.
All cargo sockets share rotation and must place six crates without overlap.
Required animations: none. Required animation events: none.

## Delivery and acceptance evidence

Deliver the Blender source, exported visual and collision GLBs, textures,
export metrics, and the required view sheet. Acceptance requires:

- dimension overlay with the table above and a 1.70 m farmer marker;
- socket overlay naming all 11 sockets plus a six-crate occupancy test;
- driver fit render using the `drive` pose with no body/vehicle penetration;
- collision overlay from side, rear, and top;
- wireframe/UV sheet proving authored topology and texel density;
- material-ID sheet proving no more than four slots and texture inventory
  proving no more than six 2K files;
- `export-metrics.json` at or below 60,000 LOD0 triangles;
- repository Blender validation and export with zero errors, followed by GLB
  re-import showing scale, orientation, names and separation intact.

## Creation-route record

Route is `original`: model in Blender from the reference board and the
dimensions in this brief. Manufacturer pages are shape reference only. A future
switch to `licensed-base` or `ai-base` requires a revised brief, provenance
record, retopology/UV/material/semantic reconstruction plan, and user approval.
No paid asset may be chosen or purchased without preview, license, price,
topology, and modification-plan review.
