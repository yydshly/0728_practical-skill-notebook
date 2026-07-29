# Shared Pole Collision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make road-lantern posts and future utility poles solid to both the player and pursuer through one data-driven actor-collision layer.

**Architecture:** Extend the flat X/Z collision module from box-only overlap checks to an explicit `box | circle` collider union. `createVillage()` normalizes building, prop, and light definitions into one `actorColliders` collection consumed by both actors; the pursuer keeps direct steering but resolves every planned move through the shared collision layer.

**Tech Stack:** JavaScript ES modules, Three.js 0.180, Node test runner, Playwright smoke tests, Vite 7.

**Working directories:** Run every `node`, `npm.cmd`, and `rg` command from
the `rural-mutation-escape` game directory. Run every `git add` and
`git commit` command from the enclosing `claude-of-duty-research` repository
root, which is why staged paths include the `rural-mutation-escape/` prefix.

## Global Constraints

- Keep all actor collision on the existing flat X/Z gameplay plane.
- Player collision radius remains exactly `0.42`.
- Pursuer collision radius is exactly `0.46`.
- Each road-lantern post uses a circle collider with radius `0.16`.
- Collider `shape` is explicitly `box` or `circle`; unknown shapes throw instead of silently degrading.
- Visible post geometry and its actor collider derive from the same authored light or pole definition.
- Posts block actors; wires, crossbars, and insulators do not.
- Thin posts do not enter `cameraOccluders`.
- Starting overlap recovery only permits movement that reduces penetration depth.
- This plan adds collision and local sliding only; it does not add navmesh pathfinding, line-of-sight sensing, combat, or failure states.
- Do not add runtime dependencies.
- Preserve existing story order, controls, camera modes, objectives, and evidence URLs.

---

## File Structure

- Modify `src/collision.js`: own collider-shape math, penetration measurement, overlap recovery, and axis-separated actor movement.
- Modify `src/level-data.js`: author explicit collider shapes, road-lantern collider metadata, safe pursuer patrol nodes, and collider validation.
- Modify `src/level.js`: normalize all actor-blocking definitions into `actorColliders`.
- Modify `src/world/props.js`: keep visible lamp and future utility-pole identity tied to the authored definition without creating extra collision parts.
- Modify `src/player.js`: rename the injected obstacle collection to `actorColliders` without changing player behavior.
- Modify `src/pursuer.js`: resolve pursuer movement through the shared actor-collision layer.
- Modify `src/main.js`: wire `village.actorColliders` and bounds into both actors and expose collision data for deterministic browser checks.
- Modify `tests/unit.mjs`: cover circle collision, recovery, level derivation, validation, patrol clearance, and pursuer blocking.
- Modify `tests/smoke.mjs`: prove player blocking/sliding, pursuer non-penetration, full-route completion, console health, and renderer health in a real browser.

---

### Task 1: Add explicit box and circle collision math

**Files:**
- Modify: `src/collision.js`
- Modify: `src/level-data.js`
- Modify: `src/level.js`
- Test: `tests/unit.mjs`

**Interfaces:**
- Consumes: collider objects with `shape: 'box' | 'circle'`, world-space `x/z`, and shape dimensions.
- Produces: `circleColliderPenetration(x, z, actorRadius, collider): number` and the existing `resolveCircleMove(position, delta, radius, bounds, colliders): {x, z}`.

- [ ] **Step 1: Write failing unit tests for circle blocking, diagonal sliding, recovery, and unknown shapes**

Update the collision import near the top of `tests/unit.mjs`:

```js
import {
  circleColliderPenetration,
  resolveCircleMove,
} from '../src/collision.js';
```

Add these tests next to the existing circle-movement test:

```js
test('circle actor stops at a circle post and slides on the free axis', () => {
  const bounds = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
  const post = {
    id: 'test_post',
    shape: 'circle',
    x: 0,
    z: 0,
    radius: 0.16,
    blocksActors: true,
    blocksCamera: false,
  };

  const blocked = resolveCircleMove(
    { x: 0, z: 1 },
    { x: 0, z: -0.5 },
    0.42,
    bounds,
    [post],
  );
  assert.deepEqual(blocked, { x: 0, z: 1 });

  const sliding = resolveCircleMove(
    { x: 0, z: 1 },
    { x: 0.2, z: -0.5 },
    0.42,
    bounds,
    [post],
  );
  assert.equal(sliding.x, 0.2);
  assert.equal(sliding.z, 1);
});

test('actor starting in a post can move only when penetration decreases', () => {
  const bounds = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
  const post = {
    id: 'test_post',
    shape: 'circle',
    x: 0,
    z: 0,
    radius: 0.16,
    blocksActors: true,
    blocksCamera: false,
  };

  const escaping = resolveCircleMove(
    { x: 0, z: 0.5 },
    { x: 0, z: 0.04 },
    0.42,
    bounds,
    [post],
  );
  assert.equal(escaping.z, 0.54);

  const worsening = resolveCircleMove(
    { x: 0, z: 0.5 },
    { x: 0, z: -0.1 },
    0.42,
    bounds,
    [post],
  );
  assert.equal(worsening.z, 0.5);
});

test('collision math rejects an unknown collider shape', () => {
  assert.throws(
    () => circleColliderPenetration(0, 0, 0.42, {
      id: 'bad',
      shape: 'capsule',
      x: 0,
      z: 0,
    }),
    /Unknown collider shape: capsule/,
  );
});
```

Update existing box fixtures in collision tests to include:

```js
shape: 'box',
blocksActors: true,
blocksCamera: true,
```

Also update every inline collider passed to `createPlayer()` or
`resolveCircleMove()` in `tests/unit.mjs`; no test fixture may depend on an
implicit collider shape or an implicit `blocksActors` value.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```powershell
node --test --test-name-pattern="circle actor|starting in a post|unknown collider shape|circle movement stops" tests/unit.mjs
```

Expected: FAIL because `circleColliderPenetration` is not exported and circle colliders are unsupported.

- [ ] **Step 3: Implement penetration-based collider dispatch**

Replace `src/collision.js` with:

```js
const EPSILON = 1e-9;

function boxPenetration(x, z, actorRadius, collider) {
  const dx = Math.abs(x - collider.x) - collider.halfX;
  const dz = Math.abs(z - collider.z) - collider.halfZ;
  if (dx <= 0 && dz <= 0) {
    return actorRadius + Math.min(-dx, -dz);
  }
  const outsideDistance = Math.hypot(Math.max(dx, 0), Math.max(dz, 0));
  return actorRadius - outsideDistance;
}

function circlePenetration(x, z, actorRadius, collider) {
  return actorRadius + collider.radius - Math.hypot(
    x - collider.x,
    z - collider.z,
  );
}

export function circleColliderPenetration(x, z, actorRadius, collider) {
  if (collider.shape === 'box') {
    return boxPenetration(x, z, actorRadius, collider);
  }
  if (collider.shape === 'circle') {
    return circlePenetration(x, z, actorRadius, collider);
  }
  throw new Error(`Unknown collider shape: ${collider.shape}`);
}

function canOccupy(startX, startZ, endX, endZ, radius, colliders) {
  return colliders
    .filter(({ blocksActors }) => blocksActors)
    .every((collider) => {
      const before = circleColliderPenetration(
        startX,
        startZ,
        radius,
        collider,
      );
      const after = circleColliderPenetration(
        endX,
        endZ,
        radius,
        collider,
      );
      return after <= 0 || (before > 0 && after < before - EPSILON);
    });
}

export function resolveCircleMove(position, delta, radius, bounds, colliders) {
  const result = {
    x: Math.max(bounds.minX, Math.min(position.x + delta.x, bounds.maxX)),
    z: position.z,
  };
  if (!canOccupy(
    position.x,
    position.z,
    result.x,
    result.z,
    radius,
    colliders,
  )) {
    result.x = position.x;
  }

  const nextZ = Math.max(
    bounds.minZ,
    Math.min(position.z + delta.z, bounds.maxZ),
  );
  if (canOccupy(result.x, position.z, result.x, nextZ, radius, colliders)) {
    result.z = nextZ;
  }
  return result;
}
```

- [ ] **Step 4: Migrate the existing authored box colliders**

Add an explicit contract to every entry in `VILLAGE_LAYOUT.colliders`:

```js
{
  id: 'home_body',
  shape: 'box',
  x: -12,
  z: 28,
  halfX: 5.2,
  halfZ: 4.2,
  blocksActors: true,
  blocksCamera: true,
}
```

Use the same explicit `shape`, `blocksActors`, and `blocksCamera` fields on
every other top-level box. For proxy boundary walls that have no camera
occluder mesh, set `blocksCamera: false`.

Migrate the `gate_blockade` nested collider at the same time:

```js
collider: {
  id: 'gate_blockade',
  shape: 'box',
  halfX: 3.1,
  halfZ: 0.9,
  blocksActors: true,
  blocksCamera: false,
},
```

Make `runtimePropColliders()` preserve the complete collider contract:

```js
return [{
  ...cluster.collider,
  x: cluster.x + (cluster.collider.offsetX ?? 0),
  z: cluster.z + (cluster.collider.offsetZ ?? 0),
}];
```

Search for any remaining implicit fixtures:

```powershell
rg -n "halfX|resolveCircleMove|createPlayer" tests/unit.mjs src/level-data.js
```

Expected: every actor-blocking collider visible in the search has an explicit
`shape` and `blocksActors` value, either directly or through the canonical
level definition.

- [ ] **Step 5: Run the focused and full unit suites**

Run:

```powershell
node --test --test-name-pattern="circle actor|starting in a post|unknown collider shape|circle movement stops" tests/unit.mjs
node --test tests/unit.mjs
npm.cmd run build
```

Expected: focused tests PASS, the full unit suite PASS, and the production
build succeeds. Do not commit a state in which old box fixtures are silently
ignored.

- [ ] **Step 6: Commit the collision primitive and box-contract migration**

From the `claude-of-duty-research` repository root:

```powershell
git add rural-mutation-escape/src/collision.js rural-mutation-escape/src/level-data.js rural-mutation-escape/src/level.js rural-mutation-escape/tests/unit.mjs
git commit -m "feat: support circle actor colliders"
```

---

### Task 2: Derive, validate, and expose authored pole colliders

**Files:**
- Modify: `src/level-data.js`
- Modify: `src/level.js`
- Modify: `src/player.js`
- Modify: `src/main.js`
- Modify: `src/world/props.js`
- Test: `tests/unit.mjs`

**Interfaces:**
- Consumes: top-level, prop, and light definitions that optionally own a nested `collider`.
- Produces: `collectActorColliders(layout)` and
  `createVillage(scene).actorColliders`, both using the same normalized,
  world-space records.

- [ ] **Step 1: Write failing tests for visible posts, normalized colliders, and validation**

Import `collectActorColliders` and `addUtilityPole` in `tests/unit.mjs`, then
add:

```js
test('road lantern visuals and actor colliders derive from one light definition', () => {
  const scene = new THREE.Scene();
  const village = createVillage(scene);
  const roadLights = VILLAGE_LAYOUT.lights.filter(
    ({ kind }) => kind === 'road_lantern',
  );

  assert.equal(roadLights.length, 2);
  for (const definition of roadLights) {
    const source = scene.getObjectByName(definition.sourceId);
    const root = scene.getObjectByName(definition.id);
    const collider = village.actorColliders.find(
      ({ id }) => id === definition.collider.id,
    );

    assert.ok(source, `missing visible source ${definition.sourceId}`);
    assert.ok(root, `missing visible root ${definition.id}`);
    const sourceWorldPosition = source.getWorldPosition(new THREE.Vector3());
    assert.ok(collider, `missing ${definition.collider.id}`);
    assert.deepEqual(
      [sourceWorldPosition.x, sourceWorldPosition.z],
      [definition.x, definition.z],
    );
    assert.equal(collider.shape, 'circle');
    assert.equal(collider.x, definition.x);
    assert.equal(collider.z, definition.z);
    assert.equal(collider.radius, 0.16);
    assert.equal(collider.blocksActors, true);
    assert.equal(collider.blocksCamera, false);
    assert.equal(
      village.cameraOccluders.some((occluder) => (
        occluder === root || Boolean(root.getObjectById(occluder.id))
      )),
      false,
    );
  }
});

test('utility pole factory accepts the shared authored definition without instantiating a level pole', () => {
  const scene = new THREE.Scene();
  const definition = {
    id: 'future_utility_pole',
    kind: 'utility_pole',
    x: 2,
    z: -3,
    collider: {
      id: 'future_utility_pole_body',
      shape: 'circle',
      radius: 0.16,
      blocksActors: true,
      blocksCamera: false,
    },
  };
  const root = addUtilityPole(scene, definition, createMaterials());

  assert.equal(root.name, definition.id);
  assert.deepEqual([root.position.x, root.position.z], [definition.x, definition.z]);
  assert.equal(root.userData.actorColliderId, definition.collider.id);
  assert.equal(
    root.children.some(({ userData }) => Boolean(userData.actorColliderId)),
    false,
    'crossbar and insulators must not create actor colliders',
  );
  assert.equal(
    VILLAGE_LAYOUT.lights.some(({ id }) => id === definition.id),
    false,
  );
});

test('village validation rejects duplicate, malformed, and unknown colliders', () => {
  const malformed = structuredClone(VILLAGE_LAYOUT);
  const firstLamp = malformed.lights.find(({ id }) => id === 'road_lantern_a');
  const secondLamp = malformed.lights.find(({ id }) => id === 'road_lantern_b');
  firstLamp.collider.radius = 0;
  firstLamp.collider.blocksActors = false;
  firstLamp.collider.blocksCamera = true;
  secondLamp.collider.id = firstLamp.collider.id;
  malformed.colliders[0].shape = 'capsule';
  malformed.colliders[1].blocksActors = 'yes';

  const errors = validateVillageLayout(malformed);
  assert.ok(errors.includes('collider:home_body:unknown-shape:capsule'));
  assert.ok(errors.includes('collider:courtyard_body:invalid-blocksActors'));
  assert.ok(errors.includes('collider:road_lantern_a_body:invalid-radius'));
  assert.ok(errors.includes('collider:road_lantern_a_body:duplicate-id'));
  assert.ok(errors.includes('light:road_lantern_a:collider-must-block-actors'));
  assert.ok(errors.includes('light:road_lantern_a:collider-must-not-block-camera'));
});

test('village validation reports missing lamp collision and blocked patrol nodes', () => {
  const malformed = structuredClone(VILLAGE_LAYOUT);
  const lamp = malformed.lights.find(({ id }) => id === 'road_lantern_a');
  delete lamp.collider;
  malformed.navNodes[0] = [-12, 0, 28];

  const errors = validateVillageLayout(malformed);
  assert.ok(errors.includes('light:road_lantern_a:missing-actor-collider'));
  assert.ok(errors.includes('nav-node:0:overlaps:home_body'));
});
```

Update the existing route-clearance test to call
`circleColliderPenetration()` for both box and circle shapes rather than
duplicating box-only closest-point math, and only iterate colliders whose
`blocksActors` value is `true`. Rename all existing
`village.colliders` assertions to `village.actorColliders`.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```powershell
node --test --test-name-pattern="road lantern visuals|utility pole factory|village validation" tests/unit.mjs
```

Expected: FAIL because lamp collider metadata, shared normalization,
utility-pole identity, validation, and `actorColliders` do not exist yet.

- [ ] **Step 3: Author road-lantern metadata and clear patrol nodes**

Add this nested collider to `road_lantern_a`:

```js
collider: {
  id: 'road_lantern_a_body',
  shape: 'circle',
  radius: 0.16,
  blocksActors: true,
  blocksCamera: false,
},
```

Add the same contract to `road_lantern_b`, using the stable ID
`road_lantern_b_body`.

Replace the two building-overlapping patrol positions while retaining the
same north-to-south route:

```js
navNodes: [
  [5.5, 0, 17],
  [-1, 0, 3],
  [6.5, 0, -10],
  [0, 0, -28],
],
```

In `src/world/props.js`, replace only the factory signature and the lines
through `root.position.set(...)` using this anchored diff:

```diff
-export function addUtilityPole(scene, { x, z }, materials) {
+export function addUtilityPole(scene, definition, materials) {
+  const { x, z } = definition;
  const root = new THREE.Group();
+  root.name = definition.id;
+  root.userData.actorColliderId = definition.collider?.id ?? null;
  root.position.set(x, 0, z);
```

Leave the existing lines from `const pole = new THREE.Mesh(...)` through
`return root;` unchanged. This changes the input contract and identity only;
it does not instantiate a new level pole or infer collision from child meshes.

Name the standalone road-lantern root with `lightDefinition.id`. Do not add
wire, crossbar, insulator, or lantern-head collision geometry.

- [ ] **Step 4: Centralize normalization and extend validation**

In `src/level-data.js`, export one pure normalizer:

```js
export function collectActorColliders(layout) {
  return [
    ...layout.colliders.map((collider) => ({ ...collider })),
    ...layout.propClusters.flatMap((cluster) => (
      cluster.collider ? [{
        ...cluster.collider,
        x: cluster.x + (cluster.collider.offsetX ?? 0),
        z: cluster.z + (cluster.collider.offsetZ ?? 0),
      }] : []
    )),
    ...layout.lights.flatMap((light) => (
      light.collider ? [{
        ...light.collider,
        x: light.x + (light.collider.offsetX ?? 0),
        z: light.z + (light.collider.offsetZ ?? 0),
      }] : []
    )),
  ];
}
```

Import `circleColliderPenetration` into `level-data.js`. Extend
`validateVillageLayout()` so it:

1. Requires every collider to have a non-empty, unique ID.
2. Accepts only `box` and `circle`.
3. Requires finite X/Z and finite positive shape dimensions.
4. Requires boolean `blocksActors` and `blocksCamera`.
5. Emits `light:<id>:missing-actor-collider` for any `road_lantern` without a
   nested collider; for a present road-lantern collider, requires
   `shape: 'circle'`, `blocksActors: true`, and `blocksCamera: false`.
6. Validates every nav-node X/Z value and, for otherwise valid
   `blocksActors` colliders, emits
   `nav-node:<index>:overlaps:<collider-id>` whenever
   `circleColliderPenetration(x, z, 0.46, collider) > 0`.

Guard the penetration call behind shape, position, and dimension validity so
the validator reports all malformed records instead of throwing on the first
one.

- [ ] **Step 5: Use the normalizer once and fail clearly at level startup**

In `src/level.js`, import `collectActorColliders` and
`validateVillageLayout`. At the beginning of `createVillage()`:

```js
const layoutErrors = validateVillageLayout(VILLAGE_LAYOUT);
if (layoutErrors.length > 0) {
  throw new Error(`Invalid village layout:\n${layoutErrors.join('\n')}`);
}
```

Delete the now-duplicated runtime prop helper. Replace the existing
`const colliders = [...]` declaration with:

```js
const actorColliders = collectActorColliders(VILLAGE_LAYOUT);
```

In the existing return object, replace only the `colliders,` property with
`actorColliders,`; retain `anchors`, `bounds`, `zones`, `navNodes`,
`cameraOccluders`, and `interactionAnchors` unchanged.

Do not derive collision from Three.js meshes and do not add thin posts to
`cameraOccluders`.

- [ ] **Step 6: Rename player injection and main wiring**

In `src/player.js`, replace:

```js
export function createPlayer(scene, spawn, colliders = []) {
```

with:

```js
export function createPlayer(scene, spawn, actorColliders = []) {
```

Then, in the existing
`resolveCircleMove(...)` call, replace its final `colliders` argument with
`actorColliders`; retain the rest of `createPlayer()` unchanged.

In `src/main.js`:

```js
const player = createPlayer(
  scene,
  village.anchors.player_home,
  village.actorColliders,
);
```

Update all unit references to `village.actorColliders`. Assert that
`collectActorColliders(VILLAGE_LAYOUT)` deep-equals the runtime collection so
validation and gameplay cannot drift onto separate normalization paths.

- [ ] **Step 7: Run focused and full unit tests**

Run:

```powershell
node --test --test-name-pattern="road lantern visuals|utility pole factory|village validation|canonical route anchors" tests/unit.mjs
node --test tests/unit.mjs
npm.cmd run build
```

Expected: focused tests PASS, the full unit suite PASS, and the production
build succeeds.

- [ ] **Step 8: Commit the authored actor-collider pipeline**

From the `claude-of-duty-research` repository root:

```powershell
git add rural-mutation-escape/src/level-data.js rural-mutation-escape/src/level.js rural-mutation-escape/src/player.js rural-mutation-escape/src/main.js rural-mutation-escape/src/world/props.js rural-mutation-escape/tests/unit.mjs
git commit -m "feat: derive lamp colliders from level data"
```

---

### Task 3: Apply shared collision to every pursuer displacement

**Files:**
- Modify: `src/pursuer.js`
- Modify: `src/main.js`
- Test: `tests/unit.mjs`

**Interfaces:**
- Consumes: `bounds`, `actorColliders`, `navNodes`, and `spawn` from `createVillage()`.
- Produces: `createPursuer(scene, { navNodes, spawn, bounds, actorColliders })`, with collision-resolved movement and radius `0.46`.

- [ ] **Step 1: Write failing tests for chase and threat-separation collision**

Add:

```js
test('pursuer cannot penetrate shared circle or box actor colliders', () => {
  const cases = [
    {
      id: 'test_post',
      shape: 'circle',
      x: 0,
      z: 0,
      radius: 0.16,
      blocksActors: true,
      blocksCamera: false,
    },
    {
      id: 'test_wall',
      shape: 'box',
      x: 0,
      z: 0,
      halfX: 1,
      halfZ: 0.2,
      blocksActors: true,
      blocksCamera: true,
    },
  ];

  for (const collider of cases) {
    const pursuer = createPursuer(new THREE.Scene(), {
      navNodes: [new THREE.Vector3(0, 0, -4)],
      spawn: new THREE.Vector3(0, 0, 2),
      bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 },
      actorColliders: [collider],
    });
    const player = { position: new THREE.Vector3(0, 0, -4) };
    let maximumPenetration = -Infinity;

    for (let index = 0; index < 120; index += 1) {
      pursuer.update(1 / 60, player);
      maximumPenetration = Math.max(
        maximumPenetration,
        circleColliderPenetration(
          pursuer.object.position.x,
          pursuer.object.position.z,
          0.46,
          collider,
        ),
      );
    }

    assert.ok(
      maximumPenetration <= 1e-9,
      `pursuer penetrated ${collider.id} by ${maximumPenetration}`,
    );
  }
});

test('pursuer threat separation cannot tunnel through a thin post', () => {
  const post = {
    id: 'retreat_post',
    shape: 'circle',
    x: 0,
    z: -1.1,
    radius: 0.16,
    blocksActors: true,
    blocksCamera: false,
  };
  const pursuer = createPursuer(new THREE.Scene(), {
    navNodes: [new THREE.Vector3(0, 0, 3)],
    spawn: new THREE.Vector3(0, 0, 0),
    bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 },
    actorColliders: [post],
  });
  const player = { position: new THREE.Vector3(0, 0, 0) };
  pursuer.object.rotation.y = 0;

  pursuer.update(1 / 60, player);

  assert.equal(pursuer.state, 'threaten');
  assert.ok(
    pursuer.object.position.z > post.z,
    'pursuer must remain on its starting side of the post',
  );
  assert.ok(
    circleColliderPenetration(
      pursuer.object.position.x,
      pursuer.object.position.z,
      0.46,
      post,
    ) <= 1e-9,
  );
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```powershell
node --test --test-name-pattern="pursuer cannot penetrate|threat separation" tests/unit.mjs
```

Expected: FAIL because `createPursuer()` ignores bounds and colliders in both
its normal advance and threat-separation branches.

- [ ] **Step 3: Route every pursuer displacement through one local helper**

At the top of `src/pursuer.js`:

```js
import { resolveCircleMove } from './collision.js';
```

Change the factory signature and define the radius:

```js
export function createPursuer(
  scene,
  {
    navNodes,
    spawn,
    bounds,
    actorColliders = [],
  },
) {
  const actorRadius = 0.46;
```

Add one helper beside the state variables. It substeps long displacements so
the endpoint-only primitive cannot tunnel through a thin post:

```js
const maximumCollisionStep = 0.2;

function moveResolved(deltaX, deltaZ) {
  const requestedDistance = Math.hypot(deltaX, deltaZ);
  const stepCount = Math.max(
    1,
    Math.ceil(requestedDistance / maximumCollisionStep),
  );
  const stepX = deltaX / stepCount;
  const stepZ = deltaZ / stepCount;
  let actualAdvance = 0;

  for (let index = 0; index < stepCount; index += 1) {
    const next = resolveCircleMove(
      object.position,
      { x: stepX, z: stepZ },
      actorRadius,
      bounds,
      actorColliders,
    );
    const stepAdvance = Math.hypot(
      next.x - object.position.x,
      next.z - object.position.z,
    );
    object.position.x = next.x;
    object.position.z = next.z;
    actualAdvance += stepAdvance;
    if (stepAdvance <= 1e-9) break;
  }

  return actualAdvance;
}
```

Replace the direct threat-separation write:

```js
if (distance < minimumSeparation) {
  const retreat = minimumSeparation - distance;
  moveResolved(-direction.x * retreat, -direction.z * retreat);
}
```

Replace the normal patrol/chase advance:

```js
const deltaX = direction.x * advance;
const deltaZ = direction.z * advance;
const actualAdvance = moveResolved(deltaX, deltaZ);
object.rotation.y = Math.atan2(direction.x, direction.z);
rig.setMotion(
  actualAdvance / Math.max(dt, Number.EPSILON),
  elapsed,
);
const resolvedDistance = object.position.distanceTo(player.position);
if (
  state === 'chase'
  && resolvedDistance <= contactDistance + Number.EPSILON
) {
  state = 'threaten';
}
```

Do not write `object.position.x/z` anywhere else in `update()`. `reset()` may
still copy the canonical spawn because it is an explicit state reset, not a
planned movement step.

- [ ] **Step 4: Wire shared level data into the pursuer**

In `src/main.js`:

```js
const pursuer = createPursuer(scene, {
  navNodes: village.navNodes,
  spawn: village.anchors.sighting.clone(),
  bounds: village.bounds,
  actorColliders: village.actorColliders,
});
```

Update every unit-test `createPursuer()` fixture to pass explicit bounds and `actorColliders: []` when the test does not need obstacles.

- [ ] **Step 5: Run focused and full unit tests**

Run:

```powershell
node --test --test-name-pattern="pursuer cannot penetrate|threat separation|pursuer movement|pursuer holds readable spacing|pursuer reset" tests/unit.mjs
npm.cmd test
npm.cmd run build
```

Expected: focused tests PASS, the complete unit-and-browser suite PASS, and
the production build succeeds.

- [ ] **Step 6: Commit shared pursuer collisions**

From the `claude-of-duty-research` repository root:

```powershell
git add rural-mutation-escape/src/pursuer.js rural-mutation-escape/src/main.js rural-mutation-escape/tests/unit.mjs
git commit -m "feat: apply shared colliders to pursuer"
```

---

### Task 4: Prove pole collision in the browser and protect the full route

**Files:**
- Modify: `src/main.js`
- Modify: `tests/smoke.mjs`

**Interfaces:**
- Consumes: `window.__RURAL_ESCAPE__`, player test movement, pursuer updates, and the two authored road-lantern positions.
- Produces: deterministic browser assertions for player blocking/sliding, pursuer non-penetration, route completion, console health, and renderer health.

- [ ] **Step 1: Add player pole-blocking and sliding smoke assertions**

After the existing movement/collision checks in `tests/smoke.mjs`, add a
deterministic matrix covering both posts, all four cardinal approaches, and a
diagonal slide paired with each approach:

```js
const poleMovements = await page.evaluate(() => {
  const game = window.__RURAL_ESCAPE__;
  const posts = game.actorColliders.filter(
    ({ id }) => /^road_lantern_[ab]_body$/.test(id),
  );
  const approaches = [
    {
      id: 'north',
      start: [0, 1],
      direct: [0, -0.5],
      diagonal: [0.2, -0.5],
      expectedSlide: [0.2, 1],
    },
    {
      id: 'south',
      start: [0, -1],
      direct: [0, 0.5],
      diagonal: [0.2, 0.5],
      expectedSlide: [0.2, -1],
    },
    {
      id: 'east',
      start: [1, 0],
      direct: [-0.5, 0],
      diagonal: [-0.5, 0.2],
      expectedSlide: [1, 0.2],
    },
    {
      id: 'west',
      start: [-1, 0],
      direct: [0.5, 0],
      diagonal: [0.5, 0.2],
      expectedSlide: [-1, 0.2],
    },
  ];
  const results = [];

  for (const post of posts) {
    for (const approach of approaches) {
      const start = [
        post.x + approach.start[0],
        post.z + approach.start[1],
      ];
      game.setPlayerForTest(...start);
      game.moveForTest(...approach.direct);
      const blocked = [game.player.position.x, game.player.position.z];

      game.setPlayerForTest(...start);
      game.moveForTest(...approach.diagonal);
      const sliding = [game.player.position.x, game.player.position.z];

      results.push({
        postId: post.id,
        approachId: approach.id,
        start,
        blocked,
        sliding,
        expectedSlide: [
          post.x + approach.expectedSlide[0],
          post.z + approach.expectedSlide[1],
        ],
      });
    }
  }
  game.setPlayerForTest(-8, 33);
  return { postCount: posts.length, results };
});
if (poleMovements.postCount !== 2) {
  throw new Error(`Expected two road-lantern colliders: ${JSON.stringify(poleMovements)}`);
}
for (const result of poleMovements.results) {
  if (
    Math.abs(result.blocked[0] - result.start[0]) > 0.001
    || Math.abs(result.blocked[1] - result.start[1]) > 0.001
  ) {
    throw new Error(`Expected ${result.postId}/${result.approachId} to block: ${JSON.stringify(result)}`);
  }
  if (
    Math.abs(result.sliding[0] - result.expectedSlide[0]) > 0.001
    || Math.abs(result.sliding[1] - result.expectedSlide[1]) > 0.001
  ) {
    throw new Error(`Expected ${result.postId}/${result.approachId} to slide: ${JSON.stringify(result)}`);
  }
}
```

- [ ] **Step 2: Add pursuer non-penetration smoke assertion**

Add:

```js
const polePursuits = await page.evaluate(() => {
  const game = window.__RURAL_ESCAPE__;
  const posts = game.actorColliders.filter(
    ({ id }) => /^road_lantern_[ab]_body$/.test(id),
  );
  const results = [];

  for (const post of posts) {
    game.pursuer.reset();
    game.pursuer.object.position.set(post.x, 0, post.z + 2);
    game.setPlayerForTest(post.x, post.z - 4);
    let minimumDistance = Infinity;
    let minimumPlayerDistance = Infinity;
    for (let index = 0; index < 180; index += 1) {
      game.updatePursuerForTest(1 / 60);
      minimumDistance = Math.min(
        minimumDistance,
        Math.hypot(
          game.pursuer.object.position.x - post.x,
          game.pursuer.object.position.z - post.z,
        ),
      );
      minimumPlayerDistance = Math.min(
        minimumPlayerDistance,
        game.pursuer.object.position.distanceTo(game.player.position),
      );
    }
    results.push({
      postId: post.id,
      minimumDistance,
      minimumPlayerDistance,
      position: game.pursuer.object.position.toArray(),
    });
  }
  game.pursuer.reset();
  game.setPlayerForTest(-8, 33);
  return results;
});
for (const result of polePursuits) {
  if (result.minimumDistance < 0.62 - 0.001) {
    throw new Error(`Expected pursuer to avoid ${result.postId}: ${JSON.stringify(result)}`);
  }
  if (result.minimumPlayerDistance < 2.2 - 0.001) {
    throw new Error(`Expected pursuer to retain player separation: ${JSON.stringify(result)}`);
  }
}
```

- [ ] **Step 3: Run the smoke test and verify the new evidence fails**

Run:

```powershell
node tests/smoke.mjs
```

Expected: FAIL when the new checks read `game.actorColliders`, because the
browser handle does not expose a copied collider collection yet.

- [ ] **Step 4: Expose shared colliders through the deterministic game handle**

Add to `window.__RURAL_ESCAPE__` in `src/main.js`:

```js
get actorColliders() {
  return village.actorColliders.map((collider) => ({ ...collider }));
},
```

This returns copied scalar records, so browser tests cannot mutate live
collision state through the returned array.

- [ ] **Step 5: Run the complete deterministic test suite**

Run:

```powershell
npm.cmd test
```

Expected:

```text
All unit tests pass.
Smoke test passed: guidance, traversal, story, pursuit, mute, viewports, reduced motion, console health, camera, and pole collision.
```

If sandboxed Chromium reports `spawn EPERM`, rerun the same command with the repository-approved elevated browser-test permission; do not replace the smoke run with build-only evidence.

- [ ] **Step 6: Run the production build**

Run:

```powershell
npm.cmd run build
```

Expected: Vite build succeeds. The existing Three.js chunk-size warning may remain; no new warning or build error is acceptable.

- [ ] **Step 7: Verify in the repository-approved in-app browser**

At `1280 × 720`, then repeat the obstruction/readability spot check at
`390 × 844`:

1. Open the normal start state and move to each road-lantern post from front, back, left, right, and diagonally.
2. Confirm direct movement stops before penetration and diagonal movement slides around the post.
3. Open `?evidence=contact`, move the pursuit near a road-lantern post using deterministic hooks, and confirm the pursuer does not cross the post or the player.
4. Traverse radio → neighbour → flashlight → south gate and confirm no soft lock.
5. Inspect console errors and record `renderCalls` and `renderTriangles`.

Save accepted evidence screenshots under:

```text
artifacts/pole-collision/
```

Use:

```text
01-player-blocked-by-lamp.png
02-player-sliding-around-lamp.png
03-pursuer-avoids-lamp.png
```

- [ ] **Step 8: Commit browser proof and smoke protection**

From the `claude-of-duty-research` repository root:

```powershell
git add rural-mutation-escape/src/main.js rural-mutation-escape/tests/smoke.mjs rural-mutation-escape/artifacts/pole-collision
git commit -m "test: prove shared pole collision"
```
