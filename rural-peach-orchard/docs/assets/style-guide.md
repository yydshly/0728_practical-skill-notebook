# Rural Peach Orchard Asset Style Guide

## Art-direction lock

The world is a contemporary working peach orchard in the hills of North China
during harvest season. It should feel maintained, productive, and inhabited:
concrete work yards, red-tile or practical sheet roofs, brick infill, electric
cargo tricycles, reusable ventilated plastic produce crates, irrigation traces,
and ordinary
modern work clothing. Historical architecture can inform massing, but it must
not turn the scene into a heritage village.

Do not introduce North American farm shorthand such as red timber barns, grain
silos, ranch fencing, wind pumps, mailboxes, hay-bale fields, pickup trucks, or
Western workwear. Do not use photogrammetry noise, toy-like exaggeration,
perfectly pristine showroom surfaces, brand marks, or legible plate numbers.

## Shape language and scale

- Use metric scale, physically credible dimensions, and human-clearance checks.
- Stylization comes from simplified planes, controlled taper, and selective
  bevels—not inflated wheels, oversized heads, miniature doors, or rubbery
  buildings.
- Preserve load-bearing logic: wheel/axle/frame relationships, believable
  branch attachment, lintels and roof support, and joints that could carry the
  depicted load.
- Round silhouette-critical hard edges with 1–3 bevel segments. At intended
  game distance, bevels should catch a highlight without reading as cushions.
- Favor readable medium-scale features: tile courses, cargo-bed ribs, clothing
  folds at joints, bark ridges, lintels, drains, thresholds, crate ventilation
  grids, integral handholds, and stacking rims.
  Sub-centimeter noise belongs in textures only when it survives texel density.
- Author front as Blender `-Y`, up as `Z`; export conversion is `Y` up and
  `-Z` forward. Use the origin rules in each brief and apply transforms.

## Controlled palette

Values are linear-workflow sRGB authoring anchors, not flat-color mandates.
Keep albedo variation close to these anchors and use dirt/wear to shift value,
not to add unrelated saturated colors.

| Role | Hex anchor | Typical use |
| --- | --- | --- |
| Warm grey concrete | `#8A8378` | yards, render, thresholds |
| Weathered red tile | `#7B3F32` | clay roof tile and ridge pieces |
| Muted brick | `#8C5945` | exposed wall and low yard wall |
| Faded agricultural green | `#4F6853` | vehicle paint, doors, utility metal |
| Peach pink | `#E58C83` | ripe-fruit focal accent only |
| Leaf green | `#587344` | harvest-season foliage |
| Dark rubber | `#252726` | tires, grips, footwear soles |

Off-white plaster (`#C4B9A5`), galvanized metal (`#7A7E7B`), dark workwear
blue (`#344652`), soil (`#6A513B`), and natural skin/hair ranges may support the
locked palette. No single supporting accent should compete with peach pink.

## PBR material response

- Use metallic/roughness PBR. Dielectric base materials use metallic `0`;
  exposed steel may use metallic `1`.
- Keep roughness variation restrained and causal. Painted metal is typically
  `0.42–0.62`, concrete `0.68–0.88`, brick/tile `0.62–0.82`, bark
  `0.72–0.9`, cloth `0.7–0.9`, peach skin `0.5–0.68`, leaf faces
  `0.48–0.68`, and rubber `0.58–0.78`.
- Roughness changes must follow touch, water, dust, abrasion, or material
  boundaries. Avoid random grunge overlays and high-frequency height noise.
- Normal detail must remain subordinate to the modeled silhouette. Never use a
  normal map to fake safety-critical structure, branch forks, masonry openings,
  tire volume, or garment layers.
- Bake ambient occlusion only where it reinforces stable creases; do not paint
  directional lighting into base color.
- Use alpha cutout only for foliage. Avoid alpha blend and layered transparent
  cards where alpha-to-coverage would produce unstable sorting.

## Wear language

Everything is used but cared for. Concentrate wear at contacts and drainage
paths: dust on lower vehicle panels and tires, soft edge polish on grips and
cargo rails, shallow scratches inside the bed, knee/cuff fading on clothing,
subtle sun bleaching on roof tile and doors, damp darkening at concrete bases,
and compacted soil around tree trunks. Do not add broad rust blankets, broken
windows, collapsed roofs, torn clothing, dead crowns, oil slicks, or identical
edge wear on every edge.

## Reusable harvest-crate lock

Every harvest crate is a contemporary injection-molded PP or HDPE returnable
fruit crate, nominally 0.50 × 0.35 × 0.28 m. Use a rectangular ventilated grid,
rounded reinforcing ribs, four corner posts, an integral handhold on each short
side, a continuous top stacking rim, and matching bottom feet. Colors are faded
agricultural green or blue with restrained contact scuffs.

Prohibit wood grain, planks, slats, nails, wire staples, historic labels, and
1940s joinery or period cues. The historical Colorado reference informs only
plausible peach fill, load density, and stacked-cargo behavior; it does not
license its wooden crate form, material, construction, or visual period.

## Texture and atlas budgets

Texel density is measured on uniquely unwrapped surfaces at the highest
delivered LOD before padding. A 10% deviation is acceptable; face/hand and
interaction zones may use up to 1.5× their class target if the total texture
count does not increase.

| Class | Target | Intended assets |
| --- | ---: | --- |
| Hero / interaction | 512 px/m | farmer, vehicle controls, fruit and crate contact zones |
| Near environment | 256 px/m | farmhouse facade, yard, tree trunk and low canopy |
| Background | 128 px/m | roof backs, distant walls, LOD2 canopy and hidden undersides |

One “texture” means one exported image file. Pack grayscale channels as ORM
(occlusion, roughness, metallic) where needed. The tree's one 2K atlas is a
single RGBA base-color/opacity image with scalar roughness and no extra image
maps. The farmhouse's two 2K atlas sets are two exported RGBA image files
(building shell and yard/details); other PBR values are scalar or vertex data.
Vehicle and character may each use at most six 2K image files.

Use at least 16 px island padding at 2K before mip generation. Keep UV islands
inside `[0,1]`; no UDIMs. Reuse mirrored UVs only where it cannot create
asymmetric wear or text. No reference-board image may be used as a texture.

## Geometry, topology, and shading

- Use clean quad-led source topology with triangulation reviewed before export.
  Poles and triangles are acceptable on rigid, flat, or hidden regions.
- Place deformation loops only where rig motion needs them. Keep elbows,
  shoulders, hips, knees, fingers, and garment hems free of long thin triangles.
- Use weighted normals or intentional hard edges on rigid assets. Match UV seams
  to hard edges where normal-map baking requires it.
- Model silhouette, contact, and parallax-producing features; texture or merge
  repeated detail that is below the intended viewing threshold.
- LODs must retain origin, material-slot order, semantic orientation, and
  socket positions. Remove hidden faces and tiny bevel loops before deleting
  identity-defining silhouette.

## Scene and delivery conventions

Every source is authored in Blender using the repository's `SCENE` hierarchy:
`VISUAL` with `LOD0`, `LOD1`, and `LOD2`; plus `COLLISION`, `SOCKETS`, and
`RIG`. A collection may be empty only where the asset brief permits no payload
for that category, but all named collections remain present. Required empties
live in `SOCKETS`; required bones live under the exported armature in `RIG`.
Collider meshes use `box_`, `sphere_`, `capsule_`, or `convex_` prefixes and
must not be shared with visual collections.

Deliver the `.blend`, `visual.glb`, `collision.glb`, `export-metrics.json`,
texture sources, final texture files, and a contact sheet containing the views
listed by the brief. The Blender validator and exporter must report no errors.

## Shared review lighting

Use a neutral 6500 K key, soft sky fill, and a matte 18% grey ground for review.
Contact sheets use the same 50 mm-equivalent perspective camera plus true
orthographic views where requested. Include a 1 m cube and 1.70 m human scale
marker in evidence renders, never in exported assets. Review both neutral light
and warm late-afternoon orchard light; approval is based on the neutral pass.
