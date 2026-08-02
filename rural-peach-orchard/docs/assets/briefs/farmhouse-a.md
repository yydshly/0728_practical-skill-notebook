# Farmhouse A — Production Brief

Asset ID: `environment.farmhouse-a`

Kind: `environment`

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
  "assetId": "environment.farmhouse-a",
  "kind": "environment",
  "units": "meter",
  "upAxis": "Y",
  "forwardAxis": "-Z",
  "origin": "ground-center",
  "lods": [
    {
      "level": 0,
      "maxDistance": 35,
      "maxTriangles": 40000
    },
    {
      "level": 1,
      "maxDistance": 75,
      "maxTriangles": 18000
    },
    {
      "level": 2,
      "maxDistance": 150,
      "maxTriangles": 4000
    }
  ],
  "textureBudget": {
    "maxDimension": 2048,
    "maxTextureCount": 2
  },
  "materialBudget": {
    "maxMaterials": 6
  },
  "requiredCollections": [
    "VISUAL",
    "COLLISION",
    "SOCKETS",
    "RIG"
  ],
  "requiredNodes": [
    "entry_socket",
    "yard_socket"
  ],
  "requiredAnimations": [],
  "requiredAnimationEvents": {},
  "creationRoute": "original",
  "placementLandmarks": {
    "space": "blender-authoring",
    "upAxis": "Z",
    "forwardAxis": "-Y",
    "groundCenter": [
      0,
      0,
      0
    ],
    "mainThresholdCenter": [
      0,
      -2.9,
      0
    ],
    "entrySocket": [
      0,
      -3.05,
      0
    ],
    "yardSocket": [
      0,
      -6.2,
      0
    ]
  }
}
```
<!-- asset-contract:end -->

## Intent and recognition

Create a contemporary, modest North China hill-village farmhouse and working
yard serving the peach orchard. The primary mass is a one-storey masonry house
with a shallow red-clay-tile gable roof, patched warm-grey render and muted
brick, joined by a lower utility lean-to and a concrete yard. Practical
identifiers include a broad modern metal entry door, glazed windows with simple
guards, external conduit, downpipe/drainage, hose tap, low brick yard wall,
stacked empty fruit crates, and a shaded sorting/work edge.

The asset should show old fabric maintained with recent repairs—not a historic
temple, luxury homestay, ruin, or North American barn. Exclude sweeping palace
eaves, ornate brackets, red lantern theme dressing, haylofts, silo, ranch fence,
mailbox, porch rocking chairs, pickup bay, and prominent flags/slogans. All
architectural and prop forms must be authored; a set of beveled boxes with flat
photo facades is not acceptable final art.

## Dimensions and spatial proportions

| Measure | Target | Tolerance |
| --- | ---: | ---: |
| Main house footprint | 10.6 × 5.8 m | ±0.2 m |
| Utility lean-to footprint | 3.6 × 2.8 m | ±0.15 m |
| Eave / ridge height | 3.05 / 4.75 m | ±0.1 m |
| Exterior wall thickness | 0.30 m | ±0.04 m |
| Main entry clear opening | 1.15 × 2.15 m | ±0.04 m |
| Typical window opening | 1.45 × 1.35 m | ±0.06 m |
| Yard hardstand | 9.0 × 7.5 m | ±0.25 m |
| Yard-wall height / thickness | 1.55 / 0.24 m | ±0.08 / 0.03 m |
| Vehicle gate clear width | 2.8 m | ±0.1 m |

The authoritative `ground-center` origin is `(0, 0, 0)`: the ground-plane
center of the 10.6 × 5.8 m main-house footprint. Center the footprint on X/Y,
place the front wall at `Y = -2.90 m`, keep ground at `Z = 0`, and face the
entry toward authoring `-Y`. The main-threshold center is therefore exactly
`(0, -2.90, 0)` relative to the structured `origin` and `placementLandmarks`
fields; it is a derived landmark. Place `entry_socket` 0.15 m outward at
`(0, -3.05, 0)`.

The hardstand falls 1.5% away from the house into a shallow visible drain. A
2.95 × 1.15 m tricycle must enter, turn, align with the sorting edge, and leave
without clipping wall, eave, or props. Maintain a 1.0 m walking route from gate
to entry.

## Required view and functional sheet

Provide matched-scale neutral renders of:

1. front, rear, left, right, and top orthographic views for LOD0/1/2;
2. dimensioned top plan with building, hardstand, gate, drain, walking route,
   tricycle turn envelope, `entry_socket`, and `yard_socket`;
3. roof plan and rainwater path from ridge to eave/downpipe/drain;
4. entry, window, wall-base, roof-edge, brick/render transition and utility
   detail closeups;
5. collision overlay and player/tricycle clearance views;
6. material-ID, atlas, UV-density and wireframe views for each LOD;
7. neutral-light and warm-orchard-light turntables.

## Construction and visual hierarchy

- Build credible 300 mm masonry walls, lintels/sills, eave support, roof build-up,
  ridge caps, flashing, thresholds, door/window recess, and slab-to-soil edge.
- Roof tile courses may be modeled at LOD0 where they affect silhouette; merge
  or bake them for LOD1 and reduce to a clean roof volume at LOD2.
- The wall must show a restrained mix of warm-grey render, exposed muted brick
  repair and a darker damp base. Do not scatter bricks decoratively.
- Use a faded agricultural-green metal entry/utility door and simple galvanized
  window guards. Glazing stays dark and slightly rough, not mirror black.
- Yard props are secondary: 6–10 empty contemporary returnable ventilated
  plastic harvest crates, coiled hose, broom, small sorting table and one
  covered utility bin. Crates require molded grids, integral handholds, corner
  posts, stacking rims, and matching feet. Wooden slats, planks, nails,
  historic labels, and period crate construction are prohibited. Props must
  not block gameplay sockets or push the asset toward clutter/ruin.

## Materials, atlas, and wear

Use no more than six material slots:

1. `M_Farmhouse_Wall` — render and brick;
2. `M_Farmhouse_Roof` — weathered red tile and ridge;
3. `M_Farmhouse_Metal` — doors, guards, conduit and downpipe;
4. `M_Farmhouse_Glass` — windows;
5. `M_Farmhouse_Yard` — concrete, drain and soil transition;
6. `M_Farmhouse_Props` — molded plastic crates, hose, broom and work details.

- LOD0 triangle ceiling: **40,000**
- Material slots: **6 maximum**
- Texture files: **2 maximum at 2048 px**

Use two RGBA atlas images only: `farmhouse_shell_rgba.png` for wall/roof/metal/
glass color regions and `farmhouse_yard_rgba.png` for yard/props. Roughness,
metallic and subtle normal response use scalar, geometry or vertex data without
additional image files. Target 256 px/m for facade/entry/yard work zones and
128 px/m for roof backs, rear wall and distant surfaces. Use modular UV reuse
without repeating an unmistakable stain every tile bay.

Target wall roughness 0.72–0.88, roof 0.64–0.8, faded painted metal 0.46–0.64,
concrete 0.72–0.9, props 0.58–0.78, and glass 0.18–0.32 with restrained
reflection. Add sun fade on south/up faces, tile value variation, hand polish
at handles, wheel dust near the gate, repaired render edges, shallow yard
scrapes, and damp darkening only along drainage/base paths. No blanket moss,
heavy rust, broken panes, collapsed tile, garbage piles, graffiti, or
photogrammetry speckle.

## Topology and LODs

| LOD | Distance switch | Triangle ceiling | Reduction rule |
| --- | ---: | ---: | --- |
| LOD0 | 35 m | 40,000 | full entry/yard details, roof silhouette and key props |
| LOD1 | 75 m | 18,000 | merge roof courses, simplify guards/drain and crate stacks |
| LOD2 | 150 m | 4,000 | retain massing, openings, roof edge, gate and broad color blocks |

LOD0/1/2 are all required. Keep footprint, origin, socket positions, material
order and primary openings identical. Protect ridge/eave silhouette, gate gap,
door/window rhythm, lean-to step and yard-wall profile before minor conduit,
tile joints, handles or prop slats. Remove hidden interior wall/roof faces
unless they define visible entry recess. Use clean planar topology and weighted
normals; never leave coplanar z-fighting repair patches.

## Collision

Deliver separate low-complexity collision with:

- boxes/convex hulls for main walls, floor/hardstand edge, lean-to and yard wall;
- roof collision only where the camera/player can contact it;
- opening-accurate entry and gate gaps;
- a simplified sorting table and crate-stack collider only if they remain
  gameplay obstructions.

Do not collide window bars, conduit, roof tiles, downpipe, hose, broom or drain
grating individually. Use supported collider prefixes and keep collision under
350 triangles. Verify a 0.45 m radius / 1.8 m player capsule and the vehicle
envelope can traverse their intended paths.

## Required sockets

Create two empties in `SOCKETS`, both with +Y up and local `-Z` as facing after
export:

| Socket | Placement / orientation |
| --- | --- |
| `entry_socket` | `(0, -3.05, 0)` from `ground-center`, exactly 0.15 m outside the threshold, facing into the doorway |
| `yard_socket` | `(0, -6.20, 0)` from `ground-center`, at the center of the clear sorting/loading zone, facing the vehicle approach |

Socket placement tolerance is 30 mm. The `yard_socket` requires a clear
3.0 × 2.5 m ground rectangle and 2.4 m head clearance. Required animations:
none. Required animation events: none.

## Delivery and acceptance evidence

Deliver Blender source, visual/collision GLBs, both atlas images, export metrics,
and the required view sheet. Acceptance requires:

- dimensioned plan/elevations and 1.70 m human plus tricycle scale overlays;
- LOD turntable and numeric 40,000 / 18,000 / 4,000 triangle evidence;
- material inventory proving six or fewer slots and exactly two or fewer 2K
  image files;
- socket plan and loading/entry gameplay blocking test;
- collision overlays plus player capsule, gate and tricycle turning test;
- construction cutaway proving wall, opening, eave and roof coherence;
- atlas/UV-density evidence with no unintended repeated hero stain;
- GLB re-import confirming scale, origin, LODs, collision separation and socket
  names;
- repository Blender validation and export with zero errors.

## Creation-route record

Route is `original`: model, UV, atlas, material, LOD and collision work is
performed in Blender from the approved North China reference board. No
photogrammetry, facade photo texture, paid kit, generated building, or
manufacturer asset is selected. Any later `licensed-base` or `ai-base` change
requires source/license and transformation records, full semantic/collision/
socket rebuilding, and user approval of preview, price (if any), topology,
license, and modification plan before acquisition.
