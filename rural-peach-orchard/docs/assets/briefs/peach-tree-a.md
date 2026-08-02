# Peach Tree A — Production Brief

Asset ID: `vegetation.peach-tree-a`

Kind: `vegetation`

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
  "assetId": "vegetation.peach-tree-a",
  "kind": "vegetation",
  "units": "meter",
  "upAxis": "Y",
  "forwardAxis": "-Z",
  "origin": "ground-center",
  "lods": [
    {
      "level": 0,
      "maxDistance": 20,
      "maxTriangles": 12000
    },
    {
      "level": 1,
      "maxDistance": 45,
      "maxTriangles": 6000
    },
    {
      "level": 2,
      "maxDistance": 90,
      "maxTriangles": 1500
    }
  ],
  "textureBudget": {
    "maxDimension": 2048,
    "maxTextureCount": 1
  },
  "materialBudget": {
    "maxMaterials": 2
  },
  "requiredCollections": [
    "VISUAL",
    "COLLISION",
    "SOCKETS",
    "RIG"
  ],
  "requiredNodes": [
    "fruit_socket_01",
    "fruit_socket_02",
    "fruit_socket_03",
    "fruit_socket_04",
    "fruit_socket_05",
    "fruit_socket_06",
    "fruit_socket_07",
    "fruit_socket_08",
    "fruit_socket_09",
    "fruit_socket_10",
    "fruit_socket_11",
    "fruit_socket_12",
    "fruit_socket_13",
    "fruit_socket_14",
    "fruit_socket_15",
    "fruit_socket_16",
    "fruit_socket_17",
    "fruit_socket_18",
    "fruit_socket_19",
    "fruit_socket_20",
    "fruit_socket_21",
    "fruit_socket_22",
    "fruit_socket_23",
    "fruit_socket_24"
  ],
  "requiredAnimations": [],
  "requiredAnimationEvents": {},
  "creationRoute": "original"
}
```
<!-- asset-contract:end -->

## Intent and recognition

Create a mature, maintained peach tree in active harvest condition for a
contemporary North China hill orchard. It must read as a low, spreading fruit
tree shaped for access: short trunk, an open vase of three to five scaffold
limbs, fine fruiting wood, irregular leaf clusters, and visible ripe peaches
from every gameplay side. It is not a flowering ornamental, conifer, apple
topiary, vineyard plant, or spherical “lollipop” canopy.

The tree must support picking gameplay and orchard repetition. Individual
instances will rotate and receive controlled tint/fruit variation, so the base
asset should be asymmetric without one unmistakable hero branch. Trunk,
scaffold limbs, branch junctions, leaf cards, and fruit volumes must be authored
forms; crossed planes around a cylinder or primitive spheres on a pole are not
acceptable final art.

## Dimensions and orchard spacing

| Measure | Target | Tolerance |
| --- | ---: | ---: |
| Tree height | 3.6 m | ±0.25 m |
| Crown diameter | 4.1 m | ±0.3 m |
| Clear trunk before first scaffold | 0.62 m | ±0.12 m |
| Trunk diameter at 0.30 m height | 0.26 m | ±0.04 m |
| Lowest pickable fruit center | 0.72 m | ±0.08 m |
| Highest pickable fruit center | 2.65 m | ±0.12 m |
| Typical visible fruit diameter | 0.075 m | ±0.01 m |

Review trees in a 4.5 m row spacing and 5.0 m between-row spacing, leaving at
least 2.6 m of visually open drive corridor after crown overlap. The source
origin sits at trunk ground center. The root flare may extend to 0.38 m radius
but must meet the ground without a pedestal or floating cards.

## Required view and functional sheet

Provide matched-scale neutral renders of:

1. front, left, right, rear, and top orthographic views for LOD0/1/2;
2. trunk/root-flare and scaffold-fork closeups;
3. leaf-front, leaf-back, fruit, twig, and bark atlas swatches;
4. canopy cutaway showing major branch hierarchy and open center;
5. all 24 fruit sockets as numbered markers, color grouped low/mid/high;
6. a 3 × 3 orchard repetition test at the specified row spacing;
7. alpha-overdraw and wireframe views for every LOD;
8. neutral and warm harvest-light turntables.

## Branch, foliage, and fruit construction

- Build one trunk into 3–5 primary scaffolds, each into 2–4 secondary limbs.
  Branch radius must taper continuously and child branches must merge at
  believable collars rather than intersect as pipes.
- Preserve an open central bowl and broken outer silhouette. Avoid uniform
  radial spokes, mirrored forks, equal branch angles, and a solid hedge crown.
- Use leaf clusters of 3–9 lance-shaped leaves with varied pitch and limited
  bend. Mix cluster sizes; do not distribute single cards uniformly.
- Keep 35–55 visible fruit volumes at LOD0, concentrated on secondary/fruiting
  branches, not on the trunk or unsupported card tips. Fruit may be instanced in
  Blender source but must export predictably.
- Fruit uses a shallow suture, depressed stem pocket, warm yellow-pink base and
  sun-side peach-pink blush. Avoid glossy plastic spheres or identical rotation.

## Materials, atlas, and wear

Use no more than two material slots:

1. `M_PeachTree_Wood` — trunk, branches and root flare;
2. `M_PeachTree_Atlas` — alpha-cut leaves plus opaque fruit geometry.

- LOD0 triangle ceiling: **12,000**
- Material slots: **2 maximum**
- Texture files: **1 maximum at 2048 px**

The one RGBA atlas must include bark color regions, leaf front/back with alpha,
and fruit color regions. Both materials sample that same image; normals and
roughness use geometry, scalar values, or vertex data and may not add image
files. Reserve at least 8% gutter and 16 px dilation around cutout islands.
Target 256 px/m on trunk and effective 512 px/m on fruit/leaf faces.

Wood roughness is 0.75–0.9; leaf faces 0.5–0.66; fruit 0.52–0.66. Use warm-grey
brown bark with modest fissures, leaf green with restrained yellowing, and peach
pink only on ripe fruit. Add compacted soil tint at the lowest trunk, selective
lichen-neutral value breakup, pruning scars with healed collars, and a few
scuffed leaves. No dead crown, fantasy glow, excessive moss, black cavities,
snow, blossoms, or procedural speckle.

## Topology and LODs

| LOD | Distance switch | Triangle ceiling | Reduction rule |
| --- | ---: | ---: | --- |
| LOD0 | 20 m | 12,000 | full branch hierarchy, 35–55 fruit, layered leaf clusters |
| LOD1 | 45 m | 6,000 | merge fine twigs/clusters, retain crown gaps and 18–28 fruit |
| LOD2 | 90 m | 1,500 | simplified trunk/scaffolds, broad crossed cluster cards, 6–10 fruit accents |

LOD0/1/2 are all required. Keep the same ground origin, material-slot order,
overall height within 2%, crown outline within 6%, and no visible vertical pop.
Decimate only after manually protecting branch collars, crown tips, canopy
holes, and lower pick zones. Remove hidden leaf layers before collapsing trunk
cross sections. Leaf alpha must remain stable with backface behavior confirmed
after GLB re-import.

## Collision and sockets

No gameplay collision mesh is required in this phase; keep `COLLISION` present
and empty. Navigation and trunk collision are generated downstream from the
reviewed trunk envelope.

Create exactly 24 required empties in `SOCKETS`, named `fruit_socket_01` through
`fruit_socket_24`. Put each at an accessible fruit center with local `-Z`
pointing outward from the canopy and +Y up after export. Distribution:

- `fruit_socket_01`–`fruit_socket_08`: low band, 0.72–1.20 m;
- `fruit_socket_09`–`fruit_socket_18`: middle band, 1.20–2.00 m;
- `fruit_socket_19`–`fruit_socket_24`: high band, 2.00–2.65 m.

Exact contract names are `fruit_socket_01`, `fruit_socket_02`,
`fruit_socket_03`, `fruit_socket_04`, `fruit_socket_05`, `fruit_socket_06`,
`fruit_socket_07`, `fruit_socket_08`, `fruit_socket_09`, `fruit_socket_10`,
`fruit_socket_11`, `fruit_socket_12`, `fruit_socket_13`, `fruit_socket_14`,
`fruit_socket_15`, `fruit_socket_16`, `fruit_socket_17`, `fruit_socket_18`,
`fruit_socket_19`, `fruit_socket_20`, `fruit_socket_21`, `fruit_socket_22`,
`fruit_socket_23`, and `fruit_socket_24`.

Keep sockets at least 0.28 m apart, 0.10 m clear of branch wood, and reachable
from outside the crown without passing through the trunk. A visible fruit must
occupy every socket in the authored full-fruit state. Required animations:
none. Required animation events: none.

## Delivery and acceptance evidence

Deliver Blender source, visual GLB, textures, export metrics, and the required
view sheet. Acceptance requires:

- dimension and branch-hierarchy overlays;
- side-by-side LOD turntable plus numeric 12,000 / 6,000 / 1,500 triangle proof;
- material inventory proving two slots and a single 2K RGBA image file;
- atlas/UV and alpha-overdraw evidence with no obvious dark fringes;
- numbered socket renders from four sides and a reach test using
  `character.farmer-a` low/mid/high pick poses;
- 3 × 3 repetition test showing navigable rows, controlled overlap, and no
  identical billboard pattern;
- GLB re-import confirming LOD names, origin, scale, material order and all 24
  socket names;
- repository Blender validation and export with zero errors.

## Creation-route record

Route is `original`: model branch structure, leaf/fruit geometry, atlas art, UVs
and LODs in Blender using botanical and orchard references only. No purchased
tree, scan, texture photograph, or generated mesh is selected. A later
`licensed-base` or `ai-base` proposal must document license/provenance,
retopology, UV/atlas replacement, material reconstruction, socket rebuilding
and user approval before acquisition or use.
