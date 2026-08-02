# Farmer A Base — Asset License Audit

## Audited scope

This record covers only the MPFB 2.0.17 core body and GameEngine rig plus the
CC0 MakeHuman system skin and high-poly eyes used to generate
`farmer-a-base.blend`. No community clothing, hair, marketplace asset, or MPFB
extension source code is redistributed with the project.

## Downloaded-license evidence

Neither downloaded ZIP contains a root-level `LICENSE` or `COPYING` file. The
archive contents must therefore not be represented as though such a file was
present. The selected mesh and material files instead contain this per-file
notice verbatim:

```text
# This asset was explicitly released as CC0 in september 2020. The license
# text for CC0 can be found in the root of this repository.
#
# The copyright holders at the point of the release to CC0 were:
#
# Copyright (C) 2020 Data Collection AB, https://www.datacollection.se
# Copyright (C) 2020 Joel Palmius
# Copyright (C) 2020 Jonas Hauquier
#
# The primary legal contact for MakeHuman is Data Collection AB.
#
# For more information, see homepage at http://www.makehumancommunity.org
```

The notice appears in the selected MPFB `data/3dobjs/base.obj` and in these
selected files from `makehuman_system_assets_cc0.zip`:

- `skins/middleage_asian_male/middleage_asian_male.mhmat`
- `eyes/high-poly/high-poly.mhclo`
- `eyes/materials/brown.mhmat`

The selected MPFB rig-weight file
`data/rigs/standard/weights.game_engine.json` contains the explicit field:

```json
"license": "CC0"
```

The official MakeHuman license page corroborates that MakeHuman characters and
bundled core assets are available under CC0:
<https://static.makehumancommunity.org/about/license.html>.

## Rights conclusion

The selected asset data is treated as `CC0-1.0`: commercial use, modification,
source/base redistribution, and runtime redistribution are permitted;
attribution is not required. Attribution and this audit record are retained as
provenance, not as an added license condition.

MPFB extension code is separately marked `GPL-3.0-or-later`. It was used as an
authoring tool only and is not copied into this repository or the generated
runtime asset.

## Archive integrity

| Archive | SHA-256 |
| --- | --- |
| `mpfb2-2.0.17-extension-platform.zip` | `4f0a879d64a39bf646fbf5f53601ac678855da329d650617dca5737548239a87` |
| `makehuman_system_assets_cc0.zip` | `b542127a8e25547c7c29c19f2d1d2adb9a664c80396ecd694095dbc8028a0107` |

Acquisition and the generated `.blend` hash are recorded in
`source-record.json`.
