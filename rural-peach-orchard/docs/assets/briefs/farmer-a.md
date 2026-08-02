# Farmer A — Production Brief

Asset ID: `character.farmer-a`

Kind: `character`

Creation route: `original`

Authoring DCC: Blender; metric scene, `Z` up, authoring front `-Y`

Export: meter, `Y` up, `-Z` forward, root-bone origin

## Authoritative contract

This strict JSON block is the machine-audited contract copy. If prose elsewhere
in this brief conflicts with it, this block and the corresponding JSON contract
must be reconciled before production.

<!-- asset-contract:start -->
```json
{
  "assetId": "character.farmer-a",
  "kind": "character",
  "units": "meter",
  "upAxis": "Y",
  "forwardAxis": "-Z",
  "origin": "root-bone",
  "lods": [
    {
      "level": 0,
      "maxDistance": 25,
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
    "root",
    "pelvis",
    "spine_01",
    "spine_02",
    "neck",
    "head",
    "clavicle_l",
    "upper_arm_l",
    "lower_arm_l",
    "hand_l",
    "clavicle_r",
    "upper_arm_r",
    "lower_arm_r",
    "hand_r",
    "thigh_l",
    "calf_l",
    "foot_l",
    "thigh_r",
    "calf_r",
    "foot_r"
  ],
  "requiredAnimations": [
    "idle",
    "walk",
    "enter_vehicle",
    "drive",
    "exit_vehicle",
    "pick_low",
    "pick_mid",
    "pick_high",
    "carry_crate",
    "lift_crate",
    "load_crate"
  ],
  "requiredAnimationEvents": {
    "pick_low": [
      "fruit_contact"
    ],
    "pick_mid": [
      "fruit_contact"
    ],
    "pick_high": [
      "fruit_contact"
    ],
    "carry_crate": [
      "crate_gripped"
    ],
    "lift_crate": [
      "crate_gripped"
    ],
    "load_crate": [
      "crate_released"
    ]
  },
  "creationRoute": "original"
}
```
<!-- asset-contract:end -->

## Intent and recognition

Create a contemporary adult Chinese peach-orchard worker, approximately
40–55 years old, capable and sun-exposed without caricature. The character is a
working protagonist rather than a costume display: soft-brim sun hat, faded
long-sleeve overshirt over a plain base layer, dark blue straight work trousers,
light fruit-handling gloves, and practical dark slip-resistant shoes. Avoid
cowboy hats, denim overalls, plaid ranch styling, luxury outdoor gear, military
uniform cues, slogans, and legible brands.

The face and hands should remain human and specific at conversational distance,
but use controlled planes and medium-scale forms rather than pores or scan
noise. The finished asset must be an authored character with production
topology; a mannequin, MetaHuman default, or assembled primitives are not an
acceptable final delivery.

## Dimensions and proportions

| Measure | Target | Tolerance |
| --- | ---: | ---: |
| Bare character height | 1.68 m | ±0.03 m |
| Hat top height | 1.73 m | ±0.03 m |
| Head proportion | 7.25 heads | ±0.25 head |
| Shoulder width | 0.43 m | ±0.03 m |
| Hand length | 0.185 m | ±0.01 m |
| Shoe length | 0.255 m | ±0.015 m |

Use physically coherent limb lengths, slightly sturdy forearms/hands, relaxed
shoulders, and a neutral center of gravity. Clothing may broaden the silhouette
by 15–30 mm but must not shorten the legs or inflate the hands/head. Fit the
seated `drive` pose to the tricycle brief and fit both hands around a
0.50 × 0.35 × 0.28 m contemporary returnable plastic produce crate with
integral short-side handholds. Wooden or historic crate forms are prohibited.

## Required view and functional sheet

Provide matched-scale neutral renders of:

1. front, left, right, rear, and top orthographic views in A-pose;
2. un-hatted head front/profile/three-quarter closeups and hand closeups;
3. clothing-layer and material-ID views;
4. deformation poses: deep but safe crate setup, 90° elbow, overhead reach,
   full walk stride, seated drive, and tricycle entry/exit;
5. motion silhouettes for low/mid/high picking and carry/lift/load;
6. rig overlay with bone names and a separate skin-weight heatmap;
7. neutral-light and warm-orchard-light turntables.

## Materials, palette, and wear

Use no more than four material slots:

1. `M_Farmer_Skin` — skin, lips and nails;
2. `M_Farmer_EyesHair` — eyes, brows and hair;
3. `M_Farmer_Cloth` — shirt, undershirt and trousers;
4. `M_Farmer_Gear` — hat, gloves, shoes and small closures.

Use up to six 2K files: two BaseColor/Normal/ORM groups are preferred, one for
body/head and one for clothing/gear. Target skin roughness 0.5–0.68, cloth
0.72–0.9, hat 0.68–0.84, glove 0.62–0.78, and shoe rubber 0.58–0.74. Keep
subsurface response subtle and engine-portable.

Use faded agricultural green in the overshirt, dark workwear blue in trousers,
warm off-white for gloves/base layer, and dark rubber shoes. Add sun fading on
hat crown/shoulders, dust at cuffs and shoes, mild knee/seat creasing, and grip
polish. Do not add torn fabric, oil stains, comedy patches, immaculate fashion
folds, or dirt across the face/hands without causal placement.

## Geometry, topology, and UVs

- LOD0 triangle ceiling: **60,000**
- Material slots: **4 maximum**
- Texture files: **6 maximum at 2048 px**
- Required LODs: LOD0 only; keep empty `LOD1` and `LOD2` collections.
- Budget guidance: head/eyes/mouth 14–18k, hands 8–10k total, body deformation
  12–15k, clothing/hat/shoes 18–24k.
- Use continuous deformation topology at neck, shoulders, elbows, wrists, hips,
  knees, ankles and finger bases. Provide at least three useful loops around
  major bending joints and preserve volume in the specified test poses.
- Separate eyeballs and teeth/tongue are permitted; do not spend geometry on
  unseen anatomy. Hair is modeled clumps/cards only if alpha stability is
  proven.
- Keep mirrored UVs away from face, hands, sun fade, and garment wear. Target
  768 px/m effective density for face/hands and 512 px/m for the rest while
  remaining inside the six-file limit.

## Rig contract

Use one exported humanoid armature in `RIG`, scale 1.0, with `root` at ground
projection beneath the pelvis. `root` controls global motion; `pelvis` is its
child. Bone roll must be symmetrical, left/right names use `_l` / `_r`, and
there must be no negative armature scale. Required exported bone nodes are:

`root`, `pelvis`, `spine_01`, `spine_02`, `neck`, `head`, `clavicle_l`,
`upper_arm_l`, `lower_arm_l`, `hand_l`, `clavicle_r`, `upper_arm_r`,
`lower_arm_r`, `hand_r`, `thigh_l`, `calf_l`, `foot_l`, `thigh_r`, `calf_r`,
and `foot_r`.

Add deformation-ready finger chains for thumb/index/middle/ring/little fingers
and toe/ball controls as needed; those names are not contract-critical in this
phase. IK controls may remain in the source rig but must not leak unsupported
control geometry into the GLB. Skin weights are capped at four influences per
vertex. No visible collapse, candy-wrapper twist, or clothing/body separation
is allowed in the functional sheet.

## Animation contract

All clips are 30 fps, authored on the same armature, named exactly as below,
with no namespace or numeric suffix. Locomotion is in-place; interaction clips
remain aligned to the root so gameplay can place the character at vehicle,
fruit, crate, and cargo sockets.

| Clip | Frames | Loop | Functional requirement |
| --- | ---: | --- | --- |
| `idle` | 90 | yes | grounded breathing/weight shift; hands clear of body |
| `walk` | 30 | yes | one full gait cycle, planted feet, 1.25 m/s preview |
| `enter_vehicle` | 75 | no | check handle/seat, step through, settle on `driver_seat` |
| `drive` | 60 | yes | seated posture, hands on grips, feet supported, head scan |
| `exit_vehicle` | 70 | no | reverse-safe dismount ending at `exit_left` |
| `pick_low` | 60 | no | step/hip-knee bend; no straight-leg waist fold |
| `pick_mid` | 50 | no | fruit contact between lower ribs and shoulder |
| `pick_high` | 65 | no | heel-down overhead reach; no shoulder collapse |
| `carry_crate` | 40 | yes | crate close to waist, level shoulders, short stable gait |
| `lift_crate` | 70 | no | stable split stance, slight hip/knee/back bend, smooth lift |
| `load_crate` | 65 | no | place at waist-height cargo slot, release before withdraw |

Pick motions use a gentle twist-and-lift hand action without yanking the branch.
Crate lift follows the registered NIOSH reference direction: good grip, load
close to body, stable feet, shoulders facing hips, no loaded spinal twist, and
no floor-to-overhead lift. The review prop is the contemporary reusable
ventilated plastic crate locked by the style guide; it is not exported inside
the character asset.

Required event markers:

| Marker | Required timing |
| --- | --- |
| `pick_low:fruit_contact` | first frame fingertips close around the fruit |
| `pick_mid:fruit_contact` | first frame fingertips close around the fruit |
| `pick_high:fruit_contact` | first frame fingertips close around the fruit |
| `carry_crate:crate_gripped` | frame 1 of the loop with both hands fixed to grips |
| `lift_crate:crate_gripped` | first frame the crate becomes fully supported |
| `load_crate:crate_released` | first frame both hands no longer constrain the crate |

Markers are Blender timeline markers named exactly as the event portion after
the colon; the exported animation/event report must associate them with the
named clip. Required animations are `idle`, `walk`, `enter_vehicle`, `drive`,
`exit_vehicle`, `pick_low`, `pick_mid`, `pick_high`, `carry_crate`,
`lift_crate`, and `load_crate`.

## Collision and sockets

No standalone gameplay collision mesh is required for the character in this
phase; leave `COLLISION` empty. Runtime capsule setup is downstream. No semantic
socket empties are required; hand and root attachment are supplied by bones.
Keep `SOCKETS` present and empty.

## Delivery and acceptance evidence

Deliver Blender source, `visual.glb`, an empty but valid `collision.glb` only if
the exporter requires it, textures, export metrics, view sheet, and animation
preview. Acceptance requires:

- dimension sheet and A-pose turntable;
- material/texture inventory within four materials and six 2K files;
- wireframe, UV density, bone-name, influence-count and weight heatmaps;
- all eleven clips visible by exact name after GLB re-import;
- event report proving the six required clip/event associations;
- tricycle fit for enter/drive/exit and crate/fruit prop tests for every
  interaction clip;
- no foot slide in loops, no mesh penetration at contact frames, and safe
  crate-lifting posture from front and side;
- `export-metrics.json` at or below 60,000 LOD0 triangles;
- repository Blender validation and export with zero errors.

## Creation-route record

Route is `original`: sculpt/model, retopologize, UV, texture, rig, and animate
in Blender from the approved shape-reference board. No scan, paid base,
MetaHuman download, or AI-generated mesh is selected. Any later base change
requires documented license/source, transformation and semantic reconstruction,
plus user review of preview, price (if any), topology, license, and modification
plan before acquisition.
