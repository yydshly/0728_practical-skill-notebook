# Name Only In Body Fixture

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
    { "level": 0, "maxDistance": 35, "maxTriangles": 40000 },
    { "level": 1, "maxDistance": 75, "maxTriangles": 18000 },
    { "level": 2, "maxDistance": 150, "maxTriangles": 4000 }
  ],
  "textureBudget": { "maxDimension": 2048, "maxTextureCount": 2 },
  "materialBudget": { "maxMaterials": 6 },
  "requiredCollections": ["VISUAL", "COLLISION", "SOCKETS", "RIG"],
  "requiredNodes": ["yard_socket"],
  "requiredAnimations": [],
  "requiredAnimationEvents": {},
  "creationRoute": "original"
}
```
<!-- asset-contract:end -->

The missing required name appears only here: `entry_socket`.
