# Rural Mutation Escape Core Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic 2–4 minute non-combat escape loop with a one-time mutation reveal, fair pursuer perception, capture/failure/checkpoint recovery, a physically opening south gate, and real post-gate completion.

**Architecture:** Add small pure state modules for game flow, checkpoints, perception, navigation, and the south gate, then adapt the existing story, pursuer, UI, audio, and Three.js runtime around those interfaces. Preserve the current data-driven flat village, shared collision layer, camera modes, objective IDs, and dynamic-music ownership; `main.js` remains the composition root and gains one explicit disposal path.

**Tech Stack:** JavaScript ES modules, Three.js `0.180`, Vite `7.3.6`, Node `node:test`, Playwright `1.61.1`, Web Audio API.

**Design source:** `docs/superpowers/specs/2026-07-30-rural-mutation-escape-core-loop-design.md`

## Global Constraints

- Keep all gameplay, collision, navigation, objectives, checkpoints, enemies, and exits on the existing `y = 0` plane.
- Preserve the existing objective IDs: `leave_home`, `visit_courtyard`, `reach_granary`, `escape_south_gate`, and `complete`.
- Preserve third-person default, first-person switching, mouse/pointer-lock camera control, pole collision, dynamic BGM, mute persistence, and missing-audio degradation.
- Keep one pursuer. Do not add combat, weapons, health, inventory, loot, additional enemy archetypes, imported GLB assets, touch controls, or new music files.
- Use three session-only checkpoints: `home_start`, `courtyard_warning`, and `granary_ready`.
- Use these timing values exactly: reveal `1.6 s`, reveal grace `0.8 s`, gate hold `1.8 s`, hold decay `0.4 s`, gate opening `1.2 s`, capture windup `0.65 s`, miss recovery `0.6 s`, target memory `2.5 s`, and search `3 s`.
- Keep player speed at `3.6 m/s` walking and `6.2 m/s` sprinting. Use pursuer speeds `1.2`, `2.0`, `4.4`, and `4.8 m/s` for patrol, investigate, chase, and final chase.
- A building or closed gate blocks vision; a thin pole, crop, or small decoration does not.
- Gate completion requires `state === "open"`, crossing from village side to `z <= -38`, and `abs(x) <= 2.2`.
- Reduced-motion mode must replace camera motion and shake with static text/audio/pose feedback.
- Every task follows RED → GREEN → focused regression → commit. Do not mix the untracked listening draft under `docs/superpowers/validation/` into any commit.
- Run commands from `rural-mutation-escape/` unless a step explicitly says otherwise.

## File Responsibility Map

| File | Responsibility after this plan |
| --- | --- |
| `src/game-flow.js` | Pure lifecycle state machine: playing, reveal, capturing, failed, restoring, completed |
| `src/checkpoints.js` | Validate, clone, store, and retrieve the three stable session snapshots |
| `src/perception.js` | Pure 2D sight, occlusion, hearing radius, and last-known-target memory |
| `src/navigation.js` | Validate the authored graph, shortest-path lookup, and objective-route progress |
| `src/south-gate.js` | Hold interaction, opening progression, door proxy colliders, and exit-line crossing |
| `src/pursuer.js` | Single enemy state machine, movement, path following, windup, capture, and stable restore |
| `src/story.js` | Existing objective order plus idempotent reveal request and explicit chapter completion |
| `src/characters.js` | One semantic mutation actor with mutually exclusive resident/mutant visuals |
| `src/world/props.js` | Visible radio, flashlight pickup, and player flashlight |
| `src/level-data.js` | Stable graph IDs, route waypoints, vision flags, gate proxies, and exit metadata |
| `src/guidance.js` | Existing distance/projection plus route-target selection |
| `src/ui.js` / `index.html` / `src/style.css` | Failure, retry, hold progress, completion, and reduced-motion presentation |
| `src/main.js` | Composition, trusted input, per-phase updates, checkpoint restore order, and disposal |
| `src/music-director.js` / `src/audio-feedback.js` | Semantic core-loop events using existing assets and buses |
| `tests/core-loop.mjs` | Focused pure/core-loop tests added by Tasks 1–7 |
| `tests/unit.mjs` | Existing module regressions and UI/audio integration tests |
| `tests/smoke.mjs` | Trusted-input route, capture/retry, gate/completion, viewport, lifecycle, and performance acceptance |

---

### Task 1: Add the explicit game-flow state machine and focused test entry

**Files:**
- Create: `src/game-flow.js`
- Create: `tests/core-loop.mjs`
- Modify: `package.json:7-16`

**Interfaces:**
- Consumes: string events from the future runtime.
- Produces:
  - `GAME_PHASES: readonly string[]`
  - `createGameFlow({ initialPhase?, onChange?, onInvalid? })`
  - `flow.phase: string`
  - `flow.getSnapshot(): { phase: string, revision: number }`
  - `flow.dispatch(eventType: string): boolean`

- [ ] **Step 1: Add the focused test script and failing lifecycle tests**

Change `package.json`:

```json
"test:unit": "node --test tests/unit.mjs tests/core-loop.mjs"
```

Create `tests/core-loop.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameFlow } from '../src/game-flow.js';

test('game flow accepts only the authored lifecycle transitions', () => {
  const changes = [];
  const invalid = [];
  const flow = createGameFlow({
    onChange: (snapshot) => changes.push(snapshot),
    onInvalid: (record) => invalid.push(record),
  });

  assert.deepEqual(flow.getSnapshot(), { phase: 'playing', revision: 0 });
  assert.equal(flow.dispatch('mutation-reveal-started'), true);
  assert.equal(flow.phase, 'reveal');
  assert.equal(flow.dispatch('mutation-reveal-finished'), true);
  assert.equal(flow.dispatch('capture-started'), true);
  assert.equal(flow.dispatch('capture-finished'), true);
  assert.equal(flow.phase, 'failed');
  assert.equal(flow.dispatch('restore-started'), true);
  assert.equal(flow.dispatch('restore-finished'), true);
  assert.equal(flow.phase, 'playing');
  assert.equal(flow.dispatch('chapter-completed'), true);
  assert.equal(flow.phase, 'completed');
  assert.equal(flow.dispatch('capture-started'), false);
  assert.equal(flow.dispatch('capture-started'), false);
  assert.deepEqual(invalid, [{
    phase: 'completed',
    eventType: 'capture-started',
  }]);
  assert.equal(changes.at(-1).revision, 7);
});

test('game flow supports reveal skip and replay from completed', () => {
  const flow = createGameFlow();
  flow.dispatch('mutation-reveal-started');
  assert.equal(flow.dispatch('mutation-reveal-skipped'), true);
  flow.dispatch('chapter-completed');
  assert.equal(flow.dispatch('restore-started'), true);
  assert.equal(flow.dispatch('restore-finished'), true);
  assert.equal(flow.phase, 'playing');
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
node --test --test-name-pattern "game flow" tests/core-loop.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/game-flow.js`.

- [ ] **Step 3: Implement the minimal deterministic state machine**

Create `src/game-flow.js`:

```js
export const GAME_PHASES = Object.freeze([
  'playing',
  'reveal',
  'capturing',
  'failed',
  'restoring',
  'completed',
]);
const GAME_PHASE_SET = new Set(GAME_PHASES);

const TRANSITIONS = Object.freeze({
  playing: Object.freeze({
    'mutation-reveal-started': 'reveal',
    'capture-started': 'capturing',
    'chapter-completed': 'completed',
  }),
  reveal: Object.freeze({
    'mutation-reveal-finished': 'playing',
    'mutation-reveal-skipped': 'playing',
  }),
  capturing: Object.freeze({
    'capture-finished': 'failed',
  }),
  failed: Object.freeze({
    'restore-started': 'restoring',
  }),
  restoring: Object.freeze({
    'restore-finished': 'playing',
  }),
  completed: Object.freeze({
    'restore-started': 'restoring',
  }),
});

export function createGameFlow({
  initialPhase = 'playing',
  onChange = () => {},
  onInvalid = () => {},
} = {}) {
  if (!GAME_PHASE_SET.has(initialPhase)) {
    throw new Error(`Unknown game phase: ${initialPhase}`);
  }
  let phase = initialPhase;
  let revision = 0;
  const reportedInvalidTransitions = new Set();

  function getSnapshot() {
    return { phase, revision };
  }

  return {
    get phase() {
      return phase;
    },
    getSnapshot,
    dispatch(eventType) {
      const next = TRANSITIONS[phase]?.[eventType];
      if (!next) {
        const key = `${phase}:${eventType}`;
        if (!reportedInvalidTransitions.has(key)) {
          reportedInvalidTransitions.add(key);
          onInvalid({ phase, eventType });
        }
        return false;
      }
      phase = next;
      revision += 1;
      onChange(getSnapshot());
      return true;
    },
  };
}
```

- [ ] **Step 4: Verify focused and existing unit tests**

Run:

```powershell
node --test --test-name-pattern "game flow" tests/core-loop.mjs
npm.cmd run test:unit
```

Expected: both commands PASS; existing unit count remains intact and two new tests pass.

- [ ] **Step 5: Commit**

```powershell
git add package.json src/game-flow.js tests/core-loop.mjs
git commit -m "feat: add explicit escape game flow"
```

---

### Task 2: Add validated session checkpoints

**Files:**
- Create: `src/checkpoints.js`
- Modify: `tests/core-loop.mjs`

**Interfaces:**
- Consumes: stable runtime values only; no Three.js objects, DOM nodes, timers, or audio nodes.
- Produces:
  - `CHECKPOINT_IDS`
  - `createCheckpointSnapshot(input)`
  - `createCheckpointStore(homeSnapshot)`
  - `store.save(snapshot): boolean`
  - `store.restore(id?): clonedSnapshot`
  - `store.reset(): clonedHomeSnapshot`
  - `store.currentId: string`

- [ ] **Step 1: Append failing validation, clone, and fallback tests**

Add imports and tests to `tests/core-loop.mjs`:

```js
import {
  createCheckpointSnapshot,
  createCheckpointStore,
} from '../src/checkpoints.js';

function homeCheckpointInput() {
  return {
    id: 'home_start',
    objectiveId: 'leave_home',
    storyFlags: {
      radio: false,
      neighbour: false,
      flashlight: false,
    },
    player: { x: -8, z: 33, yaw: 0 },
    pursuer: {
      activated: false,
      x: -1,
      z: 3,
      yaw: 0,
      stableState: 'inactive',
    },
    gateState: 'locked',
    flashlightCollected: false,
    mutationRevealed: false,
  };
}

test('checkpoint store returns isolated stable snapshots', () => {
  const home = createCheckpointSnapshot(homeCheckpointInput());
  const store = createCheckpointStore(home);
  const granary = createCheckpointSnapshot({
    ...homeCheckpointInput(),
    id: 'granary_ready',
    objectiveId: 'escape_south_gate',
    storyFlags: { radio: true, neighbour: true, flashlight: true },
    player: { x: 10.5, z: -4.5, yaw: Math.PI },
    pursuer: {
      activated: true,
      x: 2.5,
      z: 6,
      yaw: 0,
      stableState: 'search',
    },
    gateState: 'ready',
    flashlightCollected: true,
    mutationRevealed: true,
  });

  store.save(granary);
  const first = store.restore();
  first.player.x = 999;
  assert.equal(store.restore().player.x, 10.5);
  assert.equal(store.currentId, 'granary_ready');
  assert.equal(store.restore('missing').id, 'home_start');
  assert.equal(store.save({
    ...homeCheckpointInput(),
    id: 'unknown',
  }), false);
  assert.equal(store.currentId, 'home_start');
  store.save(granary);
  assert.equal(store.reset().id, 'home_start');
  assert.equal(store.currentId, 'home_start');
  assert.equal(store.restore('granary_ready').id, 'home_start');
});

test('checkpoint validation rejects transient or non-finite state', () => {
  assert.throws(
    () => createCheckpointSnapshot({
      ...homeCheckpointInput(),
      player: { x: Number.NaN, z: 33, yaw: 0 },
    }),
    /checkpoint player/i,
  );
  assert.throws(
    () => createCheckpointSnapshot({
      ...homeCheckpointInput(),
      pursuer: {
        activated: true,
        x: 0,
        z: 0,
        yaw: 0,
        stableState: 'windup',
      },
    }),
    /stable pursuer state/i,
  );
});
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
node --test --test-name-pattern "checkpoint" tests/core-loop.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/checkpoints.js`.

- [ ] **Step 3: Implement exact stable-state validation and copy ownership**

Create `src/checkpoints.js` with these constants and validation rules:

```js
export const CHECKPOINT_IDS = Object.freeze([
  'home_start',
  'courtyard_warning',
  'granary_ready',
]);

const OBJECTIVES = new Set([
  'leave_home',
  'visit_courtyard',
  'reach_granary',
  'escape_south_gate',
]);
const STABLE_PURSUER_STATES = new Set(['inactive', 'patrol', 'search']);
const STABLE_GATE_STATES = new Set(['locked', 'ready']);

function finiteRecord(record, fields, label) {
  if (!record || fields.some((field) => !Number.isFinite(record[field]))) {
    throw new Error(`Invalid checkpoint ${label}`);
  }
}

export function createCheckpointSnapshot(input) {
  if (!CHECKPOINT_IDS.includes(input?.id)) {
    throw new Error(`Invalid checkpoint id: ${input?.id}`);
  }
  if (!OBJECTIVES.has(input.objectiveId)) {
    throw new Error(`Invalid checkpoint objective: ${input.objectiveId}`);
  }
  finiteRecord(input.player, ['x', 'z', 'yaw'], 'player');
  finiteRecord(input.pursuer, ['x', 'z', 'yaw'], 'pursuer');
  if (!STABLE_PURSUER_STATES.has(input.pursuer.stableState)) {
    throw new Error(`Invalid stable pursuer state: ${input.pursuer.stableState}`);
  }
  if (!STABLE_GATE_STATES.has(input.gateState)) {
    throw new Error(`Invalid stable gate state: ${input.gateState}`);
  }
  for (const key of ['radio', 'neighbour', 'flashlight']) {
    if (typeof input.storyFlags?.[key] !== 'boolean') {
      throw new Error(`Invalid checkpoint story flag: ${key}`);
    }
  }
  return structuredClone(input);
}

export function createCheckpointStore(homeSnapshot) {
  const home = createCheckpointSnapshot(homeSnapshot);
  const snapshots = new Map([[home.id, home]]);
  let currentId = home.id;
  return {
    get currentId() {
      return currentId;
    },
    save(snapshot) {
      let validated;
      try {
        validated = createCheckpointSnapshot(snapshot);
      } catch {
        snapshots.clear();
        snapshots.set(home.id, home);
        currentId = home.id;
        return false;
      }
      snapshots.set(validated.id, validated);
      currentId = validated.id;
      return true;
    },
    restore(id = currentId) {
      return structuredClone(snapshots.get(id) ?? home);
    },
    reset() {
      snapshots.clear();
      snapshots.set(home.id, home);
      currentId = home.id;
      return structuredClone(home);
    },
  };
}
```

- [ ] **Step 4: Verify focused and unit suites**

Run:

```powershell
node --test --test-name-pattern "checkpoint" tests/core-loop.mjs
npm.cmd run test:unit
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/checkpoints.js tests/core-loop.mjs
git commit -m "feat: add deterministic escape checkpoints"
```

---

### Task 3: Add pure sight, occlusion, hearing, and memory calculations

**Files:**
- Create: `src/perception.js`
- Modify: `tests/core-loop.mjs`

**Interfaces:**
- Consumes: `{ x, z }` points and existing box/circle collider records with `blocksVision`.
- Produces:
  - `segmentIntersectsCollider(start, end, collider): boolean`
  - `canSeeTarget({ observer, target, facingYaw, maxDistance, fovRadians, occluders }): boolean`
  - `canHearTarget({ observer, target, radius }): boolean`
  - `createTargetMemory({ memorySeconds }).update(dt, visiblePosition): { active, position }`

- [ ] **Step 1: Append failing perception tests**

```js
import * as THREE from 'three';
import {
  canHearTarget,
  canSeeTarget,
  createTargetMemory,
} from '../src/perception.js';

test('perception respects yaw, distance, and authored vision blockers', () => {
  const observer = { x: 0, z: 0 };
  const target = { x: 0, z: 8 };
  const house = {
    shape: 'box',
    x: 0,
    z: 4,
    halfX: 2,
    halfZ: 1,
    blocksVision: true,
  };
  const pole = {
    shape: 'circle',
    x: 0,
    z: 4,
    radius: 0.16,
    blocksVision: false,
  };
  const base = {
    observer,
    target,
    facingYaw: 0,
    maxDistance: 12,
    fovRadians: THREE.MathUtils.degToRad(100),
  };

  assert.equal(canSeeTarget({ ...base, occluders: [pole] }), true);
  assert.equal(canSeeTarget({ ...base, occluders: [house] }), false);
  assert.equal(canSeeTarget({ ...base, facingYaw: Math.PI, occluders: [] }), false);
  assert.equal(canSeeTarget({ ...base, maxDistance: 7, occluders: [] }), false);
});

test('hearing and target memory expire at authored boundaries', () => {
  assert.equal(canHearTarget({
    observer: { x: 0, z: 0 },
    target: { x: 7, z: 0 },
    radius: 7,
  }), true);
  const memory = createTargetMemory({ memorySeconds: 2.5 });
  assert.deepEqual(memory.update(0, { x: 2, z: 3 }), {
    active: true,
    position: { x: 2, z: 3 },
  });
  assert.equal(memory.update(2.49, null).active, true);
  assert.deepEqual(memory.update(0.01, null), {
    active: false,
    position: null,
  });
});
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
node --test --test-name-pattern "perception|hearing" tests/core-loop.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/perception.js`.

- [ ] **Step 3: Implement the geometry using yaw convention `atan2(dx, dz)`**

Implement `src/perception.js` with:

```js
const EPSILON = 1e-9;

function squaredDistance(a, b) {
  return (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
}

function segmentCircleIntersection(start, end, collider) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  const t = lengthSquared <= EPSILON
    ? 0
    : Math.max(0, Math.min(1, (
        (collider.x - start.x) * dx + (collider.z - start.z) * dz
      ) / lengthSquared));
  const x = start.x + dx * t;
  const z = start.z + dz * t;
  return (x - collider.x) ** 2 + (z - collider.z) ** 2
    <= collider.radius ** 2;
}

function segmentBoxIntersection(start, end, collider) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  let low = 0;
  let high = 1;
  for (const [origin, delta, min, max] of [
    [start.x, dx, collider.x - collider.halfX, collider.x + collider.halfX],
    [start.z, dz, collider.z - collider.halfZ, collider.z + collider.halfZ],
  ]) {
    if (Math.abs(delta) <= EPSILON) {
      if (origin < min || origin > max) return false;
      continue;
    }
    const first = (min - origin) / delta;
    const second = (max - origin) / delta;
    low = Math.max(low, Math.min(first, second));
    high = Math.min(high, Math.max(first, second));
    if (low > high) return false;
  }
  return true;
}

export function segmentIntersectsCollider(start, end, collider) {
  if (collider.shape === 'circle') {
    return segmentCircleIntersection(start, end, collider);
  }
  if (collider.shape === 'box') {
    return segmentBoxIntersection(start, end, collider);
  }
  throw new Error(`Unknown collider shape: ${collider.shape}`);
}

export function canSeeTarget({
  observer,
  target,
  facingYaw,
  maxDistance,
  fovRadians,
  occluders,
}) {
  if (squaredDistance(observer, target) > maxDistance ** 2) return false;
  const targetYaw = Math.atan2(target.x - observer.x, target.z - observer.z);
  const offset = Math.atan2(
    Math.sin(targetYaw - facingYaw),
    Math.cos(targetYaw - facingYaw),
  );
  if (Math.abs(offset) > fovRadians / 2) return false;
  return !occluders
    .filter(({ blocksVision }) => blocksVision)
    .some((collider) => segmentIntersectsCollider(observer, target, collider));
}

export function canHearTarget({ observer, target, radius }) {
  return squaredDistance(observer, target) <= radius ** 2;
}

export function createTargetMemory({ memorySeconds }) {
  let remaining = 0;
  let position = null;
  return {
    update(dt, visiblePosition) {
      if (visiblePosition) {
        remaining = memorySeconds;
        position = { x: visiblePosition.x, z: visiblePosition.z };
      } else {
        remaining = Math.max(0, remaining - dt);
        if (remaining === 0) position = null;
      }
      return {
        active: remaining > 0,
        position: position ? { ...position } : null,
      };
    },
    reset() {
      remaining = 0;
      position = null;
    },
  };
}
```

- [ ] **Step 4: Verify focused and unit suites**

```powershell
node --test --test-name-pattern "perception|hearing" tests/core-loop.mjs
npm.cmd run test:unit
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/perception.js tests/core-loop.mjs
git commit -m "feat: add fair pursuer perception"
```

---

### Task 4: Author safe navigation, route guidance, vision flags, and key actor blockers

**Files:**
- Create: `src/navigation.js`
- Modify: `src/level-data.js:3-217`
- Modify: `src/level.js:23-99`
- Modify: `src/guidance.js:1-61`
- Modify: `src/interactions.js:1-18`
- Modify: `tests/core-loop.mjs`
- Modify: `tests/unit.mjs:2852-3230`

**Interfaces:**
- Consumes: existing colliders and stable objective IDs.
- Produces:
  - `VILLAGE_LAYOUT.navGraph`
  - `VILLAGE_LAYOUT.routeWaypoints`
  - `VILLAGE_LAYOUT.objectiveRoutes`
  - `VILLAGE_LAYOUT.exitLine`
  - `createVillage()` returns `navGraph`, `routeWaypoints`, `objectiveRoutes`, `exitLine`, and collider-record `visionOccluders`
  - `validateNavGraph(graph, colliders, radius)`
  - `findShortestPath(graph, startId, endId)`
  - `createRouteGuide({ routes, waypoints, arrivalRadius })`
  - `guide.update(objectiveId, playerPosition, finalTarget)`
  - `guide.reset(objectiveId, playerPosition, finalTarget)`
  - `nearestInteraction(position, candidates, radius, options?)`

- [ ] **Step 1: Add failing graph, route, and interaction tests**

Keep Task 3's `import * as THREE from 'three';`, then append these imports and tests:

```js
import {
  collectActorColliders,
  VILLAGE_LAYOUT,
} from '../src/level-data.js';
import {
  createRouteGuide,
  findShortestPath,
  validateNavGraph,
} from '../src/navigation.js';

test('authored route graph is clear and connects every objective', () => {
  const colliders = collectActorColliders(VILLAGE_LAYOUT);
  assert.deepEqual(
    validateNavGraph(VILLAGE_LAYOUT.navGraph, colliders, 0.46),
    [],
  );
  assert.deepEqual(
    findShortestPath(VILLAGE_LAYOUT.navGraph, 'home_lane', 'south_gate'),
    [
      'home_lane',
      'north_road',
      'courtyard_entry',
      'main_road_north',
      'sighting_approach',
      'sighting',
      'barn_turn',
      'south_road_north',
      'south_road_mid',
      'gate_approach',
      'south_gate',
    ],
  );
});

test('route guide advances waypoints and recomputes after restore', () => {
  const guide = createRouteGuide({
    routes: VILLAGE_LAYOUT.objectiveRoutes,
    waypoints: VILLAGE_LAYOUT.routeWaypoints,
    arrivalRadius: 1.5,
  });
  const finalTarget = new THREE.Vector3(10.4, 0, 24.4);
  const first = guide.reset(
    'visit_courtyard',
    new THREE.Vector3(-9.2, 0, 33),
    finalTarget,
  );
  assert.equal(first.id, 'home_lane');
  const second = guide.update(
    'visit_courtyard',
    new THREE.Vector3(-5.5, 0, 33),
    finalTarget,
  );
  assert.equal(second.id, 'north_road');
});

test('route guide degrades safely when route data is missing', () => {
  const guide = createRouteGuide({
    routes: { visit_courtyard: ['missing_waypoint'] },
    waypoints: {},
    arrivalRadius: 1.5,
  });
  assert.equal(guide.reset(
    'visit_courtyard',
    new THREE.Vector3(),
    null,
  ), null);
  assert.equal(guide.update(
    'unknown_objective',
    new THREE.Vector3(),
    null,
  ), null);
});
```

Extend interaction tests in `tests/unit.mjs` to prove a candidate behind a vision-blocking box is rejected while the same candidate is accepted when unobstructed.

- [ ] **Step 2: Verify RED**

```powershell
node --test --test-name-pattern "route graph|route guide" tests/core-loop.mjs
node --test --test-name-pattern "nearest interaction" tests/unit.mjs
```

Expected: route tests fail because `src/navigation.js` and graph fields do not exist; the new interaction case fails because occlusion is ignored.

- [ ] **Step 3: Add the exact authored graph and route data**

Replace the legacy anonymous `navNodes` data with stable graph data while keeping `createVillage().navNodes` as a derived compatibility array. Return cloned graph/route/exit metadata plus `visionOccluders = actorColliders.filter(({ blocksVision }) => blocksVision)` so the runtime never confuses camera meshes with gameplay sight blockers:

```js
navGraph: {
  nodes: {
    radio_approach: [-9.2, 0, 33],
    home_lane: [-5.5, 0, 33],
    north_road: [0, 0, 28],
    courtyard_entry: [6.5, 0, 25.5],
    neighbour_approach: [9.4, 0, 24.8],
    main_road_north: [4.5, 0, 15],
    sighting_approach: [2.5, 0, 6],
    sighting: [-1, 0, 3],
    barn_turn: [6.5, 0, -2.5],
    flashlight_approach: [10.5, 0, -4.5],
    south_road_north: [5, 0, -12],
    south_road_mid: [2.5, 0, -22],
    gate_approach: [0.5, 0, -29.5],
    south_gate: [0, 0, -34.5],
  },
  edges: [
    ['radio_approach', 'home_lane'],
    ['home_lane', 'north_road'],
    ['north_road', 'courtyard_entry'],
    ['courtyard_entry', 'neighbour_approach'],
    ['courtyard_entry', 'main_road_north'],
    ['main_road_north', 'sighting_approach'],
    ['sighting_approach', 'sighting'],
    ['sighting', 'barn_turn'],
    ['barn_turn', 'flashlight_approach'],
    ['barn_turn', 'south_road_north'],
    ['south_road_north', 'south_road_mid'],
    ['south_road_mid', 'gate_approach'],
    ['gate_approach', 'south_gate'],
  ],
},
routeWaypoints: {
  radio_approach: [-9.2, 0, 33],
  home_lane: [-5.5, 0, 33],
  north_road: [0, 0, 28],
  courtyard_entry: [6.5, 0, 25.5],
  neighbour_approach: [9.4, 0, 24.8],
  main_road_north: [4.5, 0, 15],
  sighting_approach: [2.5, 0, 6],
  sighting: [-1, 0, 3],
  barn_turn: [6.5, 0, -2.5],
  flashlight_approach: [10.5, 0, -4.5],
  south_road_north: [5, 0, -12],
  south_road_mid: [2.5, 0, -22],
  gate_approach: [0.5, 0, -29.5],
  south_gate: [0, 0, -34.5],
},
objectiveRoutes: {
  leave_home: ['radio_approach'],
  visit_courtyard: [
    'home_lane',
    'north_road',
    'courtyard_entry',
    'neighbour_approach',
  ],
  reach_granary: [
    'courtyard_entry',
    'main_road_north',
    'sighting_approach',
    'sighting',
    'barn_turn',
    'flashlight_approach',
  ],
  escape_south_gate: [
    'barn_turn',
    'south_road_north',
    'south_road_mid',
    'gate_approach',
    'south_gate',
  ],
},
exitLine: {
  z: -38,
  minX: -2.2,
  maxX: 2.2,
},
```

Add `blocksVision: true` to building, solid-wall, opaque home-fence, blockade, and future gate colliders. Add `blocksVision: false` to road-lantern poles, both residents, the well, and the storage pile. Add circle/box actor colliders with stable IDs for `neighbour`, `barn_resident`, `home_fence`, `village_well`, and `storage_pile`; leave crops explicitly without actor collision. Add stable interaction records for `radio`, `neighbour`, `flashlight`, and `south_gate`; the gate record remains present while locked so Task 9 can render the locked prompt.

- [ ] **Step 4: Implement graph validation, BFS, and route progress**

In `src/navigation.js`, implement:

```js
export function findShortestPath(graph, startId, endId) {
  const queue = [[startId]];
  const visited = new Set([startId]);
  while (queue.length > 0) {
    const path = queue.shift();
    const current = path.at(-1);
    if (current === endId) return path;
    for (const [a, b] of graph.edges) {
      const next = a === current ? b : b === current ? a : null;
      if (next && !visited.has(next)) {
        visited.add(next);
        queue.push([...path, next]);
      }
    }
  }
  return [];
}
```

`validateNavGraph` must reject unknown edge IDs, non-finite/off-plane nodes, node overlap, and edge samples that violate actor clearance. Sample each edge at intervals no larger than `0.1 m`.

`createRouteGuide` must:

1. Select the route array by objective ID.
2. On reset, choose the earliest waypoint whose distance from the player exceeds `1.5 m`.
3. On update, advance while the current waypoint is within `1.5 m`.
4. Return `{ id, position }` for a waypoint or `{ id: "objective", position: finalTarget }`.
5. Skip missing waypoint IDs without throwing.
6. Return `null` if neither a valid route waypoint nor final target exists.

- [ ] **Step 5: Extend guidance and interaction without breaking old callers**

Keep `computeGuidanceSnapshot` unchanged. Add the route-selected position before calling it.

Extend `nearestInteraction` with optional:

```js
{
  facingYaw,
  maxAngle = Math.PI * 0.75,
  occluders = [],
}
```

When `facingYaw` is finite, reject candidates outside `maxAngle`. Reject candidates whose segment intersects a `blocksVision` collider. Old callers without options keep distance-only behavior until Task 9 migrates `main.js`.

- [ ] **Step 6: Verify graph, interaction, layout, and full units**

```powershell
node --test --test-name-pattern "route graph|route guide" tests/core-loop.mjs
node --test --test-name-pattern "nearest interaction|village layout|canonical route" tests/unit.mjs
npm.cmd run test:unit
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/navigation.js src/level-data.js src/level.js src/guidance.js src/interactions.js tests/core-loop.mjs tests/unit.mjs
git commit -m "feat: author navigable village routes"
```

---

### Task 5: Build the south-gate state machine, pivots, proxy colliders, and exit crossing

**Files:**
- Create: `src/south-gate.js`
- Modify: `src/level-data.js`
- Modify: `src/level.js`
- Modify: `src/world/buildings.js:51-145`
- Modify: `tests/core-loop.mjs`
- Modify: `tests/unit.mjs:3751-3781`

**Interfaces:**
- Consumes: door pivot callback, two mutable proxy colliders, trusted hold state, range/facing/stability eligibility, and prior/current player positions.
- Produces:
  - `createSouthGate({ colliders, applyOpenProgress, onEvent })`
  - `gate.state`
  - `gate.getSnapshot(): { state, holdProgress, openProgress }`
  - `gate.setAvailable(boolean)`
  - `gate.update(dt, { holding, inRange, facing, stable })`
  - `gate.beginClosing(): boolean`
  - `gate.restore("locked" | "ready" | "open"): boolean`
  - `gate.crossedExit(previous, current, exitLine): boolean`
  - `gate.dispose(): void`

- [ ] **Step 1: Add failing hold, decay, collider, event, and crossing tests**

```js
import { createSouthGate } from '../src/south-gate.js';

test('south gate holds, cancels, opens, and updates proxy clearance', () => {
  const colliders = [
    {
      id: 'south_gate_left_door',
      shape: 'box',
      x: -1.175,
      z: -36,
      halfX: 1.175,
      halfZ: 0.22,
      blocksActors: true,
      blocksCamera: false,
      blocksVision: true,
    },
    {
      id: 'south_gate_right_door',
      shape: 'box',
      x: 1.175,
      z: -36,
      halfX: 1.175,
      halfZ: 0.22,
      blocksActors: true,
      blocksCamera: false,
      blocksVision: true,
    },
  ];
  const events = [];
  const visualProgress = [];
  const gate = createSouthGate({
    colliders,
    applyOpenProgress: (value) => visualProgress.push(value),
    onEvent: (event) => events.push(event),
  });
  const eligible = {
    holding: true,
    inRange: true,
    facing: true,
    stable: true,
  };

  gate.setAvailable(true);
  gate.update(0.9, eligible);
  assert.equal(gate.state, 'operating');
  assert.equal(gate.getSnapshot().holdProgress, 0.5);
  gate.update(0.4, { ...eligible, holding: false });
  assert.equal(gate.state, 'ready');
  assert.equal(gate.getSnapshot().holdProgress, 0);

  gate.update(1.8, eligible);
  assert.equal(gate.state, 'opening');
  gate.update(1.2, { ...eligible, holding: false });
  assert.equal(gate.state, 'open');
  assert.ok(colliders[0].x < -2);
  assert.ok(colliders[1].x > 2);
  assert.ok(colliders.every(({ halfX }) => halfX <= 0.05));
  assert.deepEqual(events.map(({ type }) => [
    type,
  ]), [
    ['gate-operation-started'],
    ['gate-operation-started'],
    ['gate-opened'],
  ]);
  assert.equal(visualProgress.at(-1), 1);

  assert.equal(gate.beginClosing(), true);
  gate.update(1, { ...eligible, holding: false });
  assert.equal(gate.state, 'closed_after_escape');
  assert.equal(visualProgress.at(-1), 0);
  assert.ok(colliders.every(({ halfX }) => halfX >= 1.17));
  gate.dispose();
  gate.dispose();
});

test('south gate cancels when eligibility is lost', () => {
  for (const blockedBy of [
    { holding: false },
    { inRange: false },
    { facing: false },
    { stable: false },
  ]) {
    const gate = createSouthGate({
      colliders: [],
      applyOpenProgress() {},
    });
    gate.setAvailable(true);
    const eligible = {
      holding: true,
      inRange: true,
      facing: true,
      stable: true,
    };
    gate.update(0.9, eligible);
    gate.update(0.4, { ...eligible, ...blockedBy });
    assert.equal(gate.state, 'ready');
    assert.equal(gate.getSnapshot().holdProgress, 0);
  }
});

test('south gate completion requires an authored one-way crossing', () => {
  const gate = createSouthGate({
    colliders: [],
    applyOpenProgress() {},
  });
  gate.restore('open');
  const exitLine = { z: -38, minX: -2.2, maxX: 2.2 };
  assert.equal(gate.crossedExit(
    { x: 0, z: -37.5 },
    { x: 0, z: -38.1 },
    exitLine,
  ), true);
  assert.equal(gate.crossedExit(
    { x: 3, z: -37.5 },
    { x: 3, z: -38.1 },
    exitLine,
  ), false);
  gate.restore('ready');
  assert.equal(gate.crossedExit(
    { x: 0, z: -37.5 },
    { x: 0, z: -38.1 },
    exitLine,
  ), false);
  assert.equal(gate.restore('corrupt'), false);
  assert.equal(gate.state, 'locked');
});
```

- [ ] **Step 2: Verify RED**

```powershell
node --test --test-name-pattern "south gate" tests/core-loop.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/south-gate.js`.

- [ ] **Step 3: Add two closed-door proxies to level data**

Add these two colliders:

```js
{
  id: 'south_gate_left_door',
  shape: 'box',
  x: -1.175,
  z: -36,
  halfX: 1.175,
  halfZ: 0.22,
  blocksActors: true,
  blocksCamera: false,
  blocksVision: true,
  dynamic: true,
},
{
  id: 'south_gate_right_door',
  shape: 'box',
  x: 1.175,
  z: -36,
  halfX: 1.175,
  halfZ: 0.22,
  blocksActors: true,
  blocksCamera: false,
  blocksVision: true,
  dynamic: true,
},
```

Return references to these runtime collider objects from `createVillage()` as `southGateColliders`.

- [ ] **Step 4: Refactor the gate mesh to hinge pivots**

In `buildVillageGate`, replace center-rotated open door meshes with:

```js
const doorPivots = [];
for (const [side, direction] of [['left', -1], ['right', 1]]) {
  const pivot = new THREE.Group();
  pivot.name = `gate_${side}_door_pivot`;
  pivot.position.set(direction * 2.35, 0, 0.18);
  const door = namedMesh(
    `gate_${side}_door`,
    new THREE.BoxGeometry(2.35, 1.92, 0.12),
    materials.metal,
  );
  door.position.set(-direction * 1.175, 1.12, 0);
  pivot.add(door);
  root.add(pivot);
  doorPivots.push(pivot);
}
```

Return `{ root, occluders, doorPivots }`. In `level.js`, preserve the south-gate pivots and return them as `southGateDoorPivots`.

- [ ] **Step 5: Implement the gate controller**

Use these progression rules:

```js
const HOLD_SECONDS = 1.8;
const HOLD_DECAY_SECONDS = 0.4;
const OPEN_SECONDS = 1.2;
const CLOSE_SECONDS = 1;
const CLOSED_HALF_WIDTH = 1.175;

function applyProxyProgress(colliders, progress) {
  const halfX = Math.max(0.05, CLOSED_HALF_WIDTH * (1 - progress));
  colliders.forEach((collider, index) => {
    const direction = index === 0 ? -1 : 1;
    collider.x = direction * (
      CLOSED_HALF_WIDTH + CLOSED_HALF_WIDTH * progress
    );
    collider.halfX = halfX;
    collider.blocksVision = progress < 0.37;
  });
}
```

The first eligible frame changing `ready → operating` emits `gate-operation-started`. Eligibility is `holding && inRange && facing && stable`; losing any member decays hold progress to zero in exactly `0.4 s`, then returns to `ready`. A cancelled attempt may emit the same event when a later fresh attempt starts. Reaching hold progress `1` changes to `opening`; reaching open progress `1` changes to `open` and emits `gate-opened`. `beginClosing()` is valid only from `open`; it enters `closing`, animates `openProgress` from `1` to `0` in exactly `1 s`, restores both proxy blockers, and ends at `closed_after_escape`. Clamp both progress values to `[0, 1]`.

`applyOpenProgress(progress)` rotates the left/right pivots to `-1.2 * progress` and `1.2 * progress` radians.

`restore("locked" | "ready" | "open")` atomically applies the matching visual, progress, and proxy state. Any other value applies the complete `locked` state and returns `false`. `dispose()` is idempotent, cancels transient operation/open/close progress, replaces callbacks with no-ops, and makes later updates inert; mesh and material ownership remains with `createVillage()`.

- [ ] **Step 6: Update gate factory and collision tests**

Change the existing “open village gate” test to require:

- both named pivots;
- both door rotations equal `0` at construction;
- both dynamic proxies block at construction;
- after `restore("open")`, the center gap clears a `0.46 m` radius actor.

- [ ] **Step 7: Verify focused and unit suites**

```powershell
node --test --test-name-pattern "south gate" tests/core-loop.mjs
node --test --test-name-pattern "south gate factory|village layout" tests/unit.mjs
npm.cmd run test:unit
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add src/south-gate.js src/level-data.js src/level.js src/world/buildings.js tests/core-loop.mjs tests/unit.mjs
git commit -m "feat: build an operable south gate"
```

---

### Task 6: Refactor the pursuer into fair activation, chase, search, windup, and capture states

**Files:**
- Modify: `src/player.js:5-44`
- Modify: `src/pursuer.js:1-139`
- Modify: `src/danger.js:1-45`
- Modify: `tests/core-loop.mjs`
- Modify: `tests/unit.mjs:1996-2008`
- Modify: `tests/unit.mjs:3334-3498`

**Interfaces:**
- Consumes:
  - `navGraph`
  - `visionOccluders`
  - player snapshot `{ position, moving, sprinting }`
  - optional rig ownership `{ rig, ownsRig }` added in Task 7
- Produces:
  - `pursuer.activate()`
  - `pursuer.setFinalChase(boolean)`
  - `pursuer.startFinalChase(targetPosition)`
  - `pursuer.update(dt, playerSnapshot): string`
  - `pursuer.getSnapshot(): { state, activated, x, z, yaw, targetMemory }`
  - `pursuer.restore({ activated, x, z, yaw, stableState })`
  - `pursuer.dispose(): void`
  - events `pursuer-detected-player`, `pursuer-lost-player`, `capture-started`, `capture-completed`
  - `player.update(...)` returns `{ distance, speed, moving, sprinting }`

- [ ] **Step 1: Add failing activation, sight, sound, speed, search, and capture tests**

Use an unobstructed graph fixture with two nodes and a blocking-house fixture. Assert:

1. `inactive` does not move or detect.
2. `activate()` enters `investigate`.
3. A target behind a `blocksVision` house is not seen.
4. Sprinting within `7 m` causes investigation of the sound position.
5. An exposed target enters `chase`.
6. Chase displacement over one second is approximately `4.4 m`, above player walk and below sprint.
7. Lost sight retains the target for `2.5 s`, searches for `3 s`, then returns to patrol.
8. Staying within capture distance through `0.65 s` emits capture.
9. Moving beyond `2.65 m` during windup returns to chase after `0.6 s` recovery.
10. Existing box, pole, and player-separation collision regressions remain green.
11. `startFinalChase(position)` activates immediately, records the gate noise position, enters `chase`, and uses `4.8 m/s` without teleporting.

Representative test:

```js
import { createPursuer } from '../src/pursuer.js';

test('pursuer windup captures a stationary player but misses an escape', () => {
  const events = [];
  const pursuer = createPursuer(new THREE.Scene(), {
    navGraph: {
      nodes: { a: [0, 0, 0], b: [0, 0, 6] },
      edges: [['a', 'b']],
    },
    spawn: new THREE.Vector3(0, 0, 0),
    bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    actorColliders: [],
    visionOccluders: [],
    onEvent: (event) => events.push(event),
  });
  const player = {
    position: new THREE.Vector3(0, 0, 2.2),
    moving: false,
    sprinting: false,
  };
  pursuer.activate();
  pursuer.update(0.01, player);
  assert.equal(pursuer.state, 'windup');
  pursuer.update(0.65, player);
  assert.equal(pursuer.state, 'capture');
  assert.ok(events.some(({ type }) => type === 'capture-completed'));

  pursuer.restore({
    activated: true,
    x: 0,
    z: 0,
    yaw: 0,
    stableState: 'patrol',
  });
  pursuer.update(0.01, player);
  player.position.z = 3;
  pursuer.update(0.65, player);
  assert.notEqual(pursuer.state, 'capture');

  const beforeFinalChase = pursuer.object.position.clone();
  pursuer.startFinalChase(new THREE.Vector3(0, 0, 8));
  assert.equal(pursuer.state, 'chase');
  assert.deepEqual(pursuer.object.position.toArray(), beforeFinalChase.toArray());
  assert.deepEqual(pursuer.getSnapshot().targetMemory, { x: 0, z: 8 });
  pursuer.dispose();
  pursuer.dispose();
});
```

- [ ] **Step 2: Verify RED against the current `patrol/chase/threaten/lost` implementation**

```powershell
node --test --test-name-pattern "pursuer .*capture|pursuer .*perception|pursuer .*search" tests/core-loop.mjs
```

Expected: FAIL because activation, perception, windup, capture, and restore APIs do not exist.

- [ ] **Step 3: Make player movement report actual resolved motion**

In `player.update`, record the position before `moveDirect`, then return:

```js
const actualDistance = Math.hypot(
  object.position.x - beforeX,
  object.position.z - beforeZ,
);
const actualSpeed = actualDistance / Math.max(dt, 0.0001);
rig.setMotion(actualSpeed, elapsed);
return {
  distance: actualDistance,
  speed: actualSpeed,
  moving: actualDistance > 0.0001,
  sprinting: actualDistance > 0.0001 && Boolean(input.sprint),
};
```

This replaces animation based on requested input distance and prevents walking animation while blocked.

- [ ] **Step 4: Replace distance-only transitions with authored states**

Use:

```js
const CONFIG = Object.freeze({
  patrolSpeed: 1.2,
  investigateSpeed: 2,
  chaseSpeed: 4.4,
  finalChaseSpeed: 4.8,
  patrolSight: 12,
  finalSight: 16,
  fovRadians: THREE.MathUtils.degToRad(100),
  walkNoiseRadius: 3,
  sprintNoiseRadius: 7,
  memorySeconds: 2.5,
  searchSeconds: 3,
  windupSeconds: 0.65,
  windupDistance: 2.25,
  captureDistance: 2.35,
  escapeDistance: 2.65,
  recoverySeconds: 0.6,
});
```

Transition order per update:

1. `inactive`: no movement.
2. `investigate/patrol/search`: evaluate sight, then audible movement.
3. New sight from a non-chase state emits `pursuer-detected-player`.
4. `chase`: update memory from sight; direct chase only when visible, otherwise route toward last known node.
5. No memory enters `search` for exactly `3 s`, emits `pursuer-lost-player` once, then patrols.
6. Distance `<= 2.25` while chasing enters `windup`, stops movement, faces the player, and emits `capture-started`.
7. At `0.65 s`, distance `<= 2.35` enters `capture` and emits `capture-completed`; distance `> 2.65` enters `recover` for `0.6 s`, then returns to chase.
8. `setFinalChase(true)` changes chase speed and sight range only; it does not teleport or force capture.
9. `startFinalChase(targetPosition)` calls the final-chase configuration, writes target memory from the gate-noise position, activates if needed, and enters `chase` without changing the pursuer transform.

Recalculate a graph path no more often than every `0.25 s`. If no path exists, search at the nearest legal node; never move into a collider.

`restore()` first clears perception memory, windup/recovery/search timers, and pending path state; it then applies only `inactive`, `patrol`, or `search`. `dispose()` is idempotent, removes the pursuer root, clears callbacks and timers, and disposes the rig only when the pursuer owns it.

- [ ] **Step 5: Update danger mapping**

Map `windup` and `capture` to near-threat intensity. Map `investigate`, `search`, `recover`, and `patrol` without active target to recover/safe. Preserve the music director’s fixed four-second recovery behavior.

- [ ] **Step 6: Update existing pursuer tests to the new contract**

Replace expectations of `threaten` with `windup` or `capture`, and replace the old permanent `2.2 m` stand-off assertion with:

- no player crossing before windup;
- readable distance at windup entry;
- deterministic capture or escape result.

- [ ] **Step 7: Verify focused and full units**

```powershell
node --test --test-name-pattern "pursuer|danger controller|player movement" tests/core-loop.mjs tests/unit.mjs
npm.cmd run test:unit
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add src/player.js src/pursuer.js src/danger.js tests/core-loop.mjs tests/unit.mjs
git commit -m "feat: add fair capture pursuit"
```

---

### Task 7: Make reveal, radio, flashlight, and story completion change the world

**Files:**
- Modify: `src/characters.js:1-164`
- Modify: `src/world/props.js:1-213`
- Modify: `src/level.js`
- Modify: `src/story.js:1-59`
- Modify: `src/objectives.js`
- Modify: `tests/core-loop.mjs`
- Modify: `tests/unit.mjs:2921-2998`

**Interfaces:**
- Consumes: stable anchors, story interaction IDs, and game-flow events.
- Produces:
  - `createMutationActor(scene, position)`
  - `actor.beginReveal()`
  - `actor.updateReveal(dt): { complete, progress }`
  - `actor.skipReveal()`
  - `actor.resetReveal()`
  - `actor.setMotion(speed, elapsed)`
  - `actor.dispose(): void`
  - `resident.faceToward(targetPosition)`
  - `resident.setPose("hide" | "attend" | "point")`
  - `createStoryProps(scene, anchors, materials, playerObject)`
  - `storyProps.setFlashlightCollected(boolean)`
  - `storyProps.dispose(): void`
  - `story.enterZone(zoneId): boolean`
  - `story.finishReveal(): boolean`
  - `story.markGateOpened(): boolean`
  - `story.completeChapter(): boolean`
  - `story.restore({ objective, flags, mutationRevealed, gateOpened }): boolean`
  - story flags `mutationRevealed` and `gateOpened`

- [ ] **Step 1: Add failing mutually exclusive actor and story-event tests**

```js
import {
  createMutationActor,
} from '../src/characters.js';
import { createStoryDirector } from '../src/story.js';

test('mutation actor never shows resident and mutant variants together', () => {
  const scene = new THREE.Scene();
  const actor = createMutationActor(scene, new THREE.Vector3(-1, 0, 3));
  assert.equal(actor.residentRoot.visible, true);
  assert.equal(actor.mutantRoot.visible, false);
  actor.beginReveal();
  actor.updateReveal(1.6);
  assert.equal(actor.residentRoot.visible, false);
  assert.equal(actor.mutantRoot.visible, true);
  actor.resetReveal();
  assert.equal(actor.residentRoot.visible, true);
  assert.equal(actor.mutantRoot.visible, false);
  actor.dispose();
  assert.equal(scene.children.includes(actor.root), false);
});

test('story requests one reveal and completes only through explicit gate flow', () => {
  const events = [];
  const ui = {
    setObjective() {},
    showSubtitle() {},
  };
  const story = createStoryDirector({
    ui,
    onEvent: (event) => events.push(event),
  });
  story.interact('radio');
  story.interact('neighbour');
  assert.equal(story.enterZone('sighting'), true);
  assert.equal(story.enterZone('sighting'), false);
  assert.equal(
    events.filter(({ type }) => type === 'mutation-reveal-requested').length,
    1,
  );
  assert.equal(story.finishReveal(), true);
  story.interact('flashlight');
  assert.equal(story.story.objective, 'escape_south_gate');
  assert.equal(story.completeChapter(), false);
  assert.equal(story.markGateOpened(), true);
  assert.equal(story.completeChapter(), true);
  assert.equal(story.story.objective, 'complete');

  assert.equal(story.restore({
    objective: 'reach_granary',
    flags: { radio: true, neighbour: true, flashlight: false },
    mutationRevealed: false,
    gateOpened: false,
  }), true);
  assert.equal(story.story.objective, 'reach_granary');
  assert.equal(story.story.flags.mutationRevealed, false);
  assert.equal(story.enterZone('sighting'), true);
  assert.equal(story.enterZone('sighting'), false);
  assert.equal(story.restore({
    objective: 'invalid',
    flags: {},
    mutationRevealed: false,
    gateOpened: false,
  }), false);
  assert.equal(story.story.objective, 'leave_home');
});
```

- [ ] **Step 2: Verify RED**

```powershell
node --test --test-name-pattern "mutation actor|story requests" tests/core-loop.mjs
```

Expected: FAIL because the actor and explicit story APIs do not exist.

- [ ] **Step 3: Build one semantic actor with two exclusive procedural variants**

`createMutationActor` creates one wrapper at the authored position. It creates resident and mutant rigs at local origin under that wrapper. `beginReveal()` starts at progress `0`; `updateReveal(dt)` reaches mutant visibility at progress `0.45`, ends at `1.6 s`, and never leaves both variants visible. `skipReveal()` applies progress `1`. `resetReveal()` applies progress `0`. `dispose()` removes that one wrapper and disposes each owned geometry/material exactly once.

Change `createPursuer` to accept optional `{ rig, ownsRig = true }`. The rig matches:

```js
{
  root,
  setMotion(speed, elapsed),
  setPose(name),
  dispose(),
}
```

The default remains a mutation actor so tests and runtime share the same path. Task 9 injects the semantic mutation actor with `ownsRig: true`; `pursuer.dispose()` is therefore its sole disposal owner.

Refactor `createHumanoid` so pose rotation lives below a stable facing pivot. `faceToward(targetPosition)` sets only the facing pivot yaw with `Math.atan2(dx, dz)`. Add `attend` (head and torso toward the player) and `point` (right shoulder raised toward the granary) poses. Task 9 keeps the neighbour in `attend` while the player is within `3 m`, switches it to `point` after the successful neighbour interaction, and never creates a second resident instance.

- [ ] **Step 4: Create visible story props and player flashlight**

In `createStoryProps`:

- Create a named `radio_prop` at the radio anchor using a body box, dial cylinder, speaker grille, and antenna.
- Reuse or create the named `barn_flashlight_mesh` as the pickup.
- Attach one `THREE.SpotLight` and target to `playerObject`, initially hidden.
- `setFlashlightCollected(true)` hides the pickup and shows the light/target.
- `setFlashlightCollected(false)` restores the pickup and hides the light.
- Return `dispose()` that removes and disposes only geometries/materials owned by the story props.
- On the first radio interaction, keep the existing objective event and show the exact subtitle `广播里断断续续地喊着：“老周，别去南边……”`; Task 9 uses that event to stop the continuous radio static after the broadcast cue.

- [ ] **Step 5: Move reveal and completion to explicit story events**

Extend story flags:

```js
{
  radio: false,
  neighbour: false,
  flashlight: false,
  mutationRevealed: false,
  gateOpened: false,
}
```

`enterZone("sighting")` succeeds only when objective is `reach_granary` and `mutationRevealed` is false. It sets an internal reveal-requested guard and emits `mutation-reveal-requested` without marking reveal complete.

`finishReveal()` sets `mutationRevealed = true` and emits `mutation-revealed`.

`markGateOpened()` sets `gateOpened = true` only during `escape_south_gate` and is idempotent.

`completeChapter()` succeeds only when objective is `escape_south_gate`, the flashlight flag is true, and `gateOpened` is true. Task 9 is the sole caller and invokes it only after `southGate.crossedExit(...)` returns true. Remove the old exit-radius completion from `story.update`.

`restore({ objective, flags, mutationRevealed, gateOpened })` validates the objective/flag combination before mutation, applies the complete state atomically, clears the reveal-requested guard when `mutationRevealed` is false, renders once, and emits no gameplay events. An invalid or incomplete object restores the full initial `leave_home` state and returns `false`.

- [ ] **Step 6: Verify story, character, and prop regressions**

```powershell
node --test --test-name-pattern "mutation actor|story requests" tests/core-loop.mjs
node --test --test-name-pattern "story transitions|character|flashlight|radio" tests/unit.mjs
npm.cmd run test:unit
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/characters.js src/world/props.js src/level.js src/story.js src/objectives.js tests/core-loop.mjs tests/unit.mjs
git commit -m "feat: stage the village mutation reveal"
```

---

### Task 8: Add accessible gate, failure, retry, and completion UI

**Files:**
- Modify: `index.html:13-48`
- Modify: `src/ui.js:1-225`
- Modify: `src/style.css:1-324`
- Modify: `tests/unit.mjs:1700-1905`

**Interfaces:**
- Consumes: game-flow and gate snapshots.
- Produces:
  - `ui.renderGameFlow(snapshot, { checkpointLabel? })`
  - `ui.renderGate(snapshot)`
  - `ui.onRetry(handler)`
  - `ui.onReplay(handler)`

- [ ] **Step 1: Add failing UI-state tests using the existing tracked-element harness**

Add the new element names to the existing `createTrackedGameUi()` fixture. Give tracked buttons `focusCalls: 0` and `focus() { this.focusCalls += 1; }`, then assert:

```js
test('game UI renders gate progress, failure, and completion accessibly', () => {
  const { elements, ui } = createTrackedGameUi();
  ui.renderGate({
    state: 'operating',
    holdProgress: 0.5,
    openProgress: 0,
  });
  assert.equal(elements.gateProgress.hidden, false);
  assert.equal(
    elements.gateProgressBar.getAttribute('aria-valuenow'),
    '50',
  );

  ui.renderGameFlow(
    { phase: 'failed', revision: 3 },
    { checkpointLabel: '粮仓' },
  );
  assert.equal(elements.failureOverlay.hidden, false);
  assert.match(elements.failureCheckpoint.textContent, /粮仓/);
  assert.equal(elements.missionHud.hidden, true);
  assert.equal(elements.retryButton.focusCalls, 1);

  ui.renderGameFlow({ phase: 'completed', revision: 4 });
  assert.equal(elements.failureOverlay.hidden, true);
  assert.equal(elements.completionOverlay.hidden, false);
  assert.equal(elements.dangerState.hidden, true);
  assert.equal(elements.replayButton.focusCalls, 1);
  ui.renderGameFlow({ phase: 'completed', revision: 4 });
  assert.equal(elements.replayButton.focusCalls, 1);
});
```

- [ ] **Step 2: Verify RED**

```powershell
node --test --test-name-pattern "game UI renders gate" tests/unit.mjs
```

Expected: FAIL because the elements and render methods do not exist.

- [ ] **Step 3: Add semantic markup**

Add:

```html
<span class="compass-arrow" aria-hidden="true">▲</span>
<section id="gate-progress" class="gate-progress" hidden aria-live="polite">
  <p>按住 E 开启铁门</p>
  <div
    id="gate-progress-bar"
    class="gate-progress-bar"
    role="progressbar"
    aria-label="铁门开启进度"
    aria-valuemin="0"
    aria-valuemax="100"
    aria-valuenow="0"
  ><span></span></div>
</section>
<section id="failure-overlay" class="result-overlay" hidden aria-live="assertive">
  <p class="eyebrow">ESCAPE FAILED</p>
  <h2>你被抓住了</h2>
  <p id="failure-checkpoint"></p>
  <button id="retry-button" type="button">重新尝试</button>
</section>
<section id="completion-overlay" class="result-overlay" hidden aria-live="polite">
  <p class="eyebrow">CHAPTER 01 COMPLETE</p>
  <h2>你逃出了雾村</h2>
  <p>铁门在身后合拢，雾里仍有人呼喊你的名字。</p>
  <button id="replay-button" type="button">重新游玩</button>
</section>
```

Replace the old rotationally symmetric `◇` compass symbol with the `▲` above; preserve `--bearing` rotation so the tip, not merely the container, expresses the authored route direction.

- [ ] **Step 4: Implement UI rendering and event ownership**

`renderGate` shows progress only for `operating` and `opening`; set `aria-valuenow` to rounded hold percent while operating and rounded open percent while opening.

`renderGameFlow`:

- hides normal mission, compass, marker, danger, tutorial, interaction, and gate progress in `failed` or `completed`;
- shows only failure overlay in `failed`;
- shows only completion overlay in `completed`;
- restores normal HUD in `playing`;
- leaves cinematic HUD visible in `reveal` and `capturing`.
- focuses `retry-button` once on a new `failed` revision and `replay-button` once on a new `completed` revision; repeated frame renders with the same revision must not steal focus again.

`onRetry` and `onReplay` add click listeners and return disposer functions.

- [ ] **Step 5: Add robust hidden and reduced-motion styles**

Add:

```css
[hidden] { display: none !important; }

.result-overlay {
  align-items: center;
  background: linear-gradient(rgba(7, 10, 9, .5), rgba(7, 10, 9, .9));
  display: flex;
  flex-direction: column;
  inset: 0;
  justify-content: center;
  padding: 2rem;
  position: absolute;
  text-align: center;
  z-index: 8;
}

.result-overlay button {
  min-height: 44px;
  min-width: 9rem;
}
```

Use a bottom-centered gate progress layout that does not overlap subtitles or interaction prompts at 1280×720 or 390×844. Under reduced motion, remove progress easing, overlay fades, camera-shake class animation, and objective-ring pulse.

- [ ] **Step 6: Verify UI and existing accessibility tests**

```powershell
node --test --test-name-pattern "game UI renders gate|sound state|identical mission" tests/unit.mjs
npm.cmd run test:unit
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add index.html src/ui.js src/style.css tests/unit.mjs
git commit -m "feat: add escape failure and gate UI"
```

---

### Task 9: Integrate flow, checkpoints, reveal, gate, AI, audio events, and disposal

**Files:**
- Modify: `src/main.js:1-438`
- Modify: `src/camera.js:1-116`
- Modify: `src/level.js:23-99`
- Modify: `src/audio-lifecycle.js:1-30`
- Modify: `src/audio-feedback.js:521-562`
- Modify: `src/music-director.js:726-760`
- Modify: `tests/unit.mjs:65-182`
- Modify: `tests/unit.mjs:900-1285`
- Modify: `tests/unit.mjs:2398-2438`
- Modify: `tests/core-loop.mjs`

**Interfaces:**
- Consumes all interfaces from Tasks 1–8.
- Produces one runtime with:
  - trusted key/pointer audio unlock;
  - held `E` state;
  - stable checkpoint save/restore;
  - per-phase simulation gating;
  - one RAF owner and one idempotent disposer;
  - one idempotent continuous-radio-static owner after audio unlock;
  - dev-only `window.__RURAL_ESCAPE__` read-only snapshots plus named capture fixtures used only by browser acceptance.

- [ ] **Step 1: Add failing audio-event and lifecycle tests**

Add unit tests proving:

1. `mutation-revealed` plays the existing reveal stinger once.
2. `checkpoint-restored` with `courtyard_warning` allows the reveal stinger to play once again.
3. `gate-operation-started` requests final-chase music intensity without restarting loops.
4. `player-captured` stops transient heartbeat voices and leaves synchronized loops alive for retry.
5. persisted `pagehide` suspends rather than disposes; `pageshow` resumes; non-persisted `pagehide` disposes once.
6. `setRadioStaticActive(true)` is idempotent, starts at most one bounded noise owner after unlock, and `objective-completed/leave_home`, mute, suspend, restore, and dispose stop it without affecting music loop generation.
7. `cameraController.lookToward(target, 1)` uses the existing `atan2(dx, dz)` yaw convention, while a reduced-motion branch leaves yaw unchanged.
8. `village.dispose()` removes only village-owned scene roots and is safe to call twice.

Representative lifecycle dispatch:

```js
const persistedHide = new Event('pagehide');
Object.defineProperty(persistedHide, 'persisted', { value: true });
harness.windowRef.dispatchEvent(persistedHide);
assert.equal(harness.calls.suspend, 1);
assert.equal(harness.calls.dispose, 0);

const show = new Event('pageshow');
Object.defineProperty(show, 'persisted', { value: true });
harness.windowRef.dispatchEvent(show);
await Promise.resolve();
assert.equal(harness.calls.resume, 1);
```

- [ ] **Step 2: Verify RED**

```powershell
node --test --test-name-pattern "checkpoint-restored|gate-operation-started|persisted pagehide" tests/unit.mjs
```

Expected: FAIL because semantic event reset/final-chase behavior and bfcache lifecycle do not exist.

- [ ] **Step 3: Integrate stable runtime ownership in `main.js`**

Instantiate in this order:

1. renderer, scene, level, player, camera;
2. UI and audio;
3. `gameFlow`;
4. `checkpointStore` with `home_start`;
5. one mutation actor, injected as the pursuer rig so ordinary and mutant visuals share one semantic actor and collider identity;
6. south gate;
7. story director and story props;
8. route guide;
9. input/listener/disposer collections.

Construct `gameFlow` with:

```js
onInvalid: ({ phase, eventType }) => {
  if (import.meta.env.DEV) {
    console.warn(`[game-flow] Ignored ${eventType} during ${phase}`);
  }
},
```

Task 1's per-pair deduplication guarantees one diagnostic for a repeated illegal transition and no production logging.

Use named input handlers. Add `input.interact = false`. `keydown KeyE` sets it true and performs one-shot ordinary interactions only when not at the gate; `keyup KeyE` clears it. During `reveal`, trusted `KeyE`, `Space`, or `Escape` calls the same idempotent `skipReveal()` path and does not trigger an ordinary interaction. Ignore movement input unless flow phase is `playing`.

Create `const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')` and own its change listener. Add `cameraController.lookToward(targetPosition, blend)`; it wraps the yaw delta to `[-Math.PI, Math.PI]` and applies `yaw += delta * clamp(blend, 0, 1)`. During reveal, call it only when reduced motion is false. Capture feedback adds the existing shell shake class only when reduced motion is false; text, audio, and pose feedback always run.

Ordinary interactions call `nearestInteraction` with player facing and vision occluders. While within `3 m`, the neighbour calls `faceToward(player.position)`; after the neighbour interaction, apply the `point` pose exactly once. The always-present `south_gate` interaction record uses a locked prompt of `雾太重，看不清门闩` until the flashlight is collected. A ready-gate candidate is eligible only within `2.2 m` and within `75°` of the gate latch.

While the gate state is `operating`, do not pass movement input to `player.update`; release of `E` still reaches the gate controller. Each gate update receives:

```js
{
  holding: input.interact,
  inRange: gateDistance <= 2.2,
  facing: Math.abs(gateFacingOffset) <= THREE.MathUtils.degToRad(75),
  stable: gameFlow.phase === 'playing' && !capturePending,
}
```

Start desired radio static immediately, but create its Web Audio noise source only after a trusted unlock. Stop it after the first radio interaction; a replay restored to `home_start` requests it again without creating a second owner.

- [ ] **Step 4: Implement story and checkpoint event routing**

Use one handler with exact branches:

```js
function handleStoryEvent(event) {
  audio.handleStoryEvent(event);
  if (event.type === 'objective-completed') {
    ui.showCompletion(getObjectiveDefinition(event.objectiveId));
  }
  if (
    event.type === 'objective-completed'
    && event.objectiveId === 'leave_home'
  ) {
    audio.setRadioStaticActive(false);
  }
  if (
    event.type === 'objective-started'
    && event.objectiveId === 'reach_granary'
  ) {
    saveCheckpoint('courtyard_warning');
  }
  if (event.type === 'mutation-reveal-requested') {
    gameFlow.dispatch('mutation-reveal-started');
    mutationActor.beginReveal();
  }
  if (
    event.type === 'objective-started'
    && event.objectiveId === 'escape_south_gate'
  ) {
    storyProps.setFlashlightCollected(true);
    southGate.setAvailable(true);
    saveCheckpoint('granary_ready');
  }
  if (event.type === 'chapter-completed') {
    if (gameFlow.dispatch('chapter-completed')) {
      southGate.beginClosing();
    }
  }
}
```

Route pursuer events through a separate handler so capture does not masquerade as story progress:

```js
function handlePursuerEvent(event) {
  audio.handleStoryEvent(event);
  if (
    event.type === 'capture-completed'
    && gameFlow.phase === 'playing'
    && gameFlow.dispatch('capture-started')
  ) {
    captureElapsed = 0;
    southGate.restore(
      storyDirector.story.flags.flashlight ? 'ready' : 'locked',
    );
    audio.handleStoryEvent({ type: 'player-captured' });
  }
}

function handleGateEvent(event) {
  audio.handleStoryEvent(event);
  if (event.type === 'gate-operation-started') {
    pursuer.startFinalChase(player.position);
  }
  if (event.type === 'gate-opened') {
    storyDirector.markGateOpened();
  }
}
```

Use authored safe transforms rather than saving the player's interaction-edge position:

```js
const CHECKPOINT_PRESETS = Object.freeze({
  home_start: {
    objectiveId: 'leave_home',
    storyFlags: { radio: false, neighbour: false, flashlight: false },
    player: { x: -8, z: 33, yaw: 0 },
    pursuer: {
      activated: false,
      x: -1,
      z: 3,
      yaw: 0,
      stableState: 'inactive',
    },
    gateState: 'locked',
    flashlightCollected: false,
    mutationRevealed: false,
  },
  courtyard_warning: {
    objectiveId: 'reach_granary',
    storyFlags: { radio: true, neighbour: true, flashlight: false },
    player: { x: 6.5, z: 25.5, yaw: Math.PI },
    pursuer: {
      activated: false,
      x: -1,
      z: 3,
      yaw: 0,
      stableState: 'inactive',
    },
    gateState: 'locked',
    flashlightCollected: false,
    mutationRevealed: false,
  },
  granary_ready: {
    objectiveId: 'escape_south_gate',
    storyFlags: { radio: true, neighbour: true, flashlight: true },
    player: { x: 10.5, z: -4.5, yaw: Math.PI },
    pursuer: {
      activated: true,
      x: 2.5,
      z: 6,
      yaw: 0,
      stableState: 'search',
    },
    gateState: 'ready',
    flashlightCollected: true,
    mutationRevealed: true,
  },
});

function saveCheckpoint(id) {
  return checkpoints.save(createCheckpointSnapshot({
    id,
    ...structuredClone(CHECKPOINT_PRESETS[id]),
  }));
}
```

Initialize the store with the `home_start` preset. These fixed safe transforms are part of the acceptance contract: `courtyard_warning` is outside the neighbour collision and `granary_ready` puts the pursuer at the main-road search point, never beside the player.

- [ ] **Step 5: Implement atomic retry**

Retry order:

```js
let sessionStartedAt = performance.now();
const currentElapsed = () => (
  performance.now() - sessionStartedAt
) / 1000;

function stopTransientPresentation() {
  for (const key of [
    'forward',
    'back',
    'left',
    'right',
    'sprint',
    'interact',
  ]) {
    input[key] = false;
  }
  revealElapsed = 0;
  revealGraceElapsed = 0;
  captureElapsed = 0;
  capturePending = false;
  shell.classList.remove('camera-shake');
}

function retryFromCheckpoint() {
  if (!['failed', 'completed'].includes(gameFlow.phase)) return false;
  const replaying = gameFlow.phase === 'completed';
  if (!gameFlow.dispatch('restore-started')) return false;
  if (replaying) {
    checkpoints.reset();
    sessionStartedAt = performance.now();
  }
  const snapshot = checkpoints.restore();
  stopTransientPresentation();
  southGate.restore(snapshot.gateState);
  if (snapshot.mutationRevealed) mutationActor.skipReveal();
  else mutationActor.resetReveal();
  storyProps.setFlashlightCollected(snapshot.flashlightCollected);
  player.position.set(snapshot.player.x, 0, snapshot.player.z);
  player.object.rotation.y = snapshot.player.yaw;
  pursuer.restore(snapshot.pursuer);
  storyDirector.restore({
    objective: snapshot.objectiveId,
    flags: snapshot.storyFlags,
    mutationRevealed: snapshot.mutationRevealed,
    gateOpened: snapshot.gateState === 'open',
  });
  routeGuide.reset(
    snapshot.objectiveId,
    player.position,
    resolveObjectiveTarget(snapshot.objectiveId, village.anchors),
  );
  audio.setRadioStaticActive(!snapshot.storyFlags.radio);
  audio.handleStoryEvent({
    type: 'checkpoint-restored',
    checkpointId: snapshot.id,
  });
  cameraController.snap();
  refreshFeedback(0, currentElapsed());
  gameFlow.dispatch('restore-finished');
  return true;
}
```

After story restore, set the neighbour to `point` only when `snapshot.storyFlags.neighbour` is true; otherwise reset its authored pose. Bind `R`, `Enter`, retry button, and replay button to this function. Keyboard retry ignores repeated keydown and is active only in `failed` or `completed`.

- [ ] **Step 6: Gate each frame by lifecycle phase**

Per frame:

- At frame start, clamp `dt` to `0.05 s`, retain the previous player `{ x, z }`, and take one game-flow snapshot. Never run two phase branches in one frame after a transition.
- In `playing`, update ordinary movement only when the gate is not `operating`; then update interactions, neighbour facing, story-zone entry, pursuer, gate, camera, route guidance, danger, atmosphere, and renderer in that order.
- In `reveal`, freeze player and pursuer movement, update the mutation actor, and blend the camera toward the sighting actor only when reduced motion is false. Natural completion or an allowed skip calls `story.finishReveal()` once, dispatches `mutation-reveal-finished` or `mutation-reveal-skipped`, and sets `revealGraceRemaining = 0.8`.
- In subsequent `playing` frames, decrement `revealGraceRemaining` without updating the inactive pursuer. When it reaches zero, call `pursuer.activate()` once; the player remains controllable during the grace window.
- `handlePursuerEvent` owns the transition to `capturing`. In `capturing`, freeze player, pursuer, interaction, gate, story, guidance, and danger updates; update only the capture presentation for `0.8 s`, then dispatch `capture-finished`, render the failure UI, and emit no additional `player-captured` event.
- While the gate is `operating`, `opening`, or `closing`, continue `southGate.update` with the trusted eligibility snapshot; only `operating` freezes player movement.
- On each `gate-operation-started`, route the semantic audio event and call `pursuer.startFinalChase(player.position)`; this is a noise-driven state change, not a teleport.
- On `gate-opened`, call `story.markGateOpened()` and route the event.
- After the open-gate update, call `southGate.crossedExit(previousPlayer, player.position, village.exitLine)`. If true, call only `story.completeChapter()`; its `chapter-completed` event drives audio, game flow, and `beginClosing()` exactly once.
- In `failed`, render the retained scene without updating player, pursuer, story, gate, guidance, danger, or atmosphere.
- In `completed`, update only the one-second gate closing presentation and renderer. Player, pursuer, story, route, danger, interactions, camera, and atmosphere remain frozen before, during, and after the close.

- [ ] **Step 7: Map semantic audio events without new assets**

In `music-director.js`:

- reveal role triggers on `mutation-revealed`;
- escape role triggers only on `chapter-completed`; update the unit fixture and remove the old `objective-started/escape_south_gate` alias in this task;
- `checkpoint-restored/courtyard_warning` deletes only `reveal` from `playedStoryStingers`;
- `checkpoint-restored/granary_ready` does not replay reveal;
- `gate-operation-started` selects the maximum chase target without restarting loop sources;
- `player-captured` clears transient stingers/heartbeat but preserves loop generation.

In `audio-feedback.js`:

- give `pursuer-detected-player`, `pursuer-lost-player`, `gate-opened`, `player-captured`, and `checkpoint-restored` distinct short oscillator patterns using the existing eight-voice cap;
- make `mutation-revealed`, `gate-operation-started`, and `chapter-completed` delegate to the music director exactly once;
- implement `setRadioStaticActive(boolean)` as desired state plus one owned looping noise source/gain created only after unlock; cap its gain below the exploration bed, stop/disconnect it on false, mute, suspend, and dispose, and recreate only once on unmute/resume when desired;
- handle `objective-completed/leave_home` by stopping static and playing one short radio-break cue; `checkpoint-restored/home_start` rearms static, while the two later checkpoints keep it off;
- keep story, retry, failure, and completion behavior fully functional when the audio context or assets are unavailable.

- [ ] **Step 8: Make page and runtime disposal complete**

Store:

- RAF ID;
- pointer-input disposer;
- audio-lifecycle disposer;
- UI button disposers;
- all window/document listener removals;
- reduced-motion media-query listener removal;
- atmosphere, world marker, story props, south gate, pursuer/injected mutation rig, village, audio, and renderer cleanup.

`disposeRuntime()` is idempotent, cancels RAF before disposing owners, and removes `window.__RURAL_ESCAPE__`.

Make `createVillage()` record the scene's pre-existing children at entry and derive its owned top-level roots at return. Its new idempotent `dispose()` removes only those roots, traverses them, and disposes each unique geometry and material once. Because the injected mutation rig is created later, it is not captured by village ownership; `pursuer.dispose()` owns that rig. `southGate.dispose()` owns only controller state and callbacks, never the door meshes.

Change audio lifecycle:

- persisted `pagehide` → `suspend`;
- persisted `pageshow` → `resume`;
- non-persisted `pagehide` or HMR dispose → the injected `onTerminal()` callback, which is `disposeRuntime`;
- the returned `unbind()` removes `visibilitychange`, `pagehide`, and `pageshow`, runs `unsubscribe()` once, and does not itself dispose audio, so runtime ownership has no recursive/double-dispose path.

`disposeRuntime()` calls owners in this order: cancel RAF, remove input/UI/media listeners, dispose pointer input, dispose audio lifecycle/subscription, dispose south gate, story props, pursuer/mutation rig, marker, atmosphere, village, renderer render lists, renderer, and audio. A second call returns without touching any owner.

Expose `window.__RURAL_ESCAPE__` only when `import.meta.env.DEV` is true. Return frozen snapshot objects for flow, checkpoint, player, pursuer, gate, route, audio, renderer counts, owner counts, and scene-child counts. Keep mutations behind named `applyCaptureFixture(checkpointId)` and `clearFixture()` methods used only by Task 10; do not expose raw Three.js objects or general coordinate setters.

- [ ] **Step 9: Verify focused, full unit, audio, and build**

```powershell
node --test --test-name-pattern "checkpoint-restored|gate-operation-started|radio static|persisted pagehide|lookToward|village dispose|game flow|checkpoint|south gate|pursuer" tests/unit.mjs tests/core-loop.mjs
npm.cmd run test:unit
npm.cmd run test:audio
npm.cmd run build
```

Expected: PASS. The existing Vite chunk-size warning is informational; no new runtime errors are accepted.

- [ ] **Step 10: Commit**

```powershell
git add src/main.js src/camera.js src/level.js src/audio-lifecycle.js src/audio-feedback.js src/music-director.js tests/unit.mjs tests/core-loop.mjs
git commit -m "feat: integrate the rural escape loop"
```

---

### Task 10: Prove the complete loop with trusted input, real traversal, retries, viewports, and performance

**Files:**
- Modify: `tests/smoke.mjs`
- Modify: `package.json` only if a focused smoke script is added
- Create: `artifacts/core-loop/reveal.png`
- Create: `artifacts/core-loop/failure.png`
- Create: `artifacts/core-loop/gate-opening.png`
- Create: `artifacts/core-loop/complete.png`
- Create: `docs/superpowers/validation/2026-07-30-rural-mutation-escape-core-loop.md`

**Interfaces:**
- Consumes: the production runtime only through trusted browser input and dev-only read-only evidence snapshots.
- Produces: deterministic browser acceptance, retained screenshots, measured renderer baseline, and validation record.

- [ ] **Step 1: Replace teleport-based canonical route acceptance with trusted movement helpers**

Add:

```js
async function moveUntil(page, key, predicate, argument, timeout = 6000) {
  await page.keyboard.down(key);
  try {
    await page.waitForFunction(predicate, argument, { timeout });
  } finally {
    await page.keyboard.up(key);
  }
}

async function holdInteraction(page, milliseconds) {
  await page.keyboard.down('KeyE');
  await page.waitForTimeout(milliseconds);
  await page.keyboard.up('KeyE');
}
```

Use real `KeyW/KeyA/KeyD/Shift/KeyE/Space` input from initial spawn. Use coordinate thresholds only as read-only completion conditions; do not call `setPlayerForTest()` for the canonical route.

Authored route:

1. Move west to the radio and press `E`.
2. Move east along the north side of the home, then south/east to the neighbour and press `E`.
3. Move west/south through the sighting waypoint, wait for reveal or skip with `Space`.
4. Sprint southeast to the flashlight and press `E`.
5. Move west to the main road, sprint south to the gate approach.
6. Hold `E` at least `1.85 s`.
7. Wait for `open`, then move south through `z <= -38`.

- [ ] **Step 2: Add deterministic capture and checkpoint recovery acceptance**

Prove:

- standing inside windup/capture range reaches `failed`;
- failure overlay names `courtyard_warning` before flashlight;
- real `R` restores objective, player, enemy, reveal eligibility, gate, and HUD;
- after flashlight, a second capture restores `granary_ready`;
- retry does not restart synchronized music loops;
- ten retries do not increase RAF owners, event-listener evidence, audio loop generation, scene child count, or active transient voices.

Use only the named dev hook `applyCaptureFixture(checkpointId)` to prepare this focused failure fixture; the capture itself and retry must use trusted browser input. Call `clearFixture()` before the canonical route.

- [ ] **Step 3: Add gate and completion negative cases**

Prove:

- approaching the gate before flashlight shows “雾太重，看不清门闩” and remains `locked`;
- holding `E` while outside the `75°` facing cone or farther than `2.2 m` cannot start progress;
- entering the old circular completion area cannot complete;
- walking around the outside of the gate’s horizontal range cannot complete;
- releasing `E` at 50% returns progress to zero in `0.4 s`;
- the first fresh operation emits final chase once;
- crossing the authored door opening completes exactly once;
- after completion, player and pursuer positions remain unchanged for one measured second while the closing presentation finishes.

- [ ] **Step 4: Add perception and navigation browser cases**

Prove:

- a building between player and pursuer prevents visual detection;
- sprint noise within `7 m` causes investigation;
- the pursuer follows graph nodes instead of pushing indefinitely into a building;
- walking in open road loses distance to the pursuer;
- sprinting and breaking line of sight reaches search/recovery;
- route arrow targets the next safe waypoint rather than the final anchor through a wall.

- [ ] **Step 5: Keep existing control, audio, viewport, and failure-degradation acceptance**

Retain and update:

- trusted keydown, canvas, and sound-button audio unlock;
- radio static begins once after trusted unlock, stops after the radio interaction, and rearms only on `home_start` replay;
- third/first-person switching and pointer camera;
- pole collision for player and pursuer;
- reduced motion;
- 1280×720 and 390×844 layout;
- exact sound-button ARIA;
- OGG one-fetch set and MP3 fallback;
- missing-audio story completion;
- freeze/reactivate loop identity.

390×844 verifies display only and must not claim touch playability.

- [ ] **Step 6: Add real renderer budgets**

Record a representative reveal and final-chase sample:

```js
{
  calls,
  triangles,
  geometries,
  textures,
  sceneChildren,
  pixelRatio
}
```

Set the accepted limit to no more than 110% of the pre-Task-1 baseline captured at the same viewport and state. The validation document records both baseline and final values; a higher result fails until the new owner is identified and corrected.

Before Task 10 is committed, `HEAD~9` is the plan commit and contains the unchanged runtime baseline. Create a temporary detached worktree at `HEAD~9`, junction its game `node_modules` to the current game `node_modules`, launch that build on a different localhost port, and have the smoke harness read the same frozen renderer snapshot from both builds. Remove that exact temporary worktree with `git worktree remove --force` after both samples are written; do not delete paths with a recursive shell command.

- [ ] **Step 7: Run full automated verification**

Use the committed FFmpeg tools:

```powershell
$env:RURAL_SCORE_FFMPEG='D:\26project\26audio_and_video_project\ffmpeg-n6.1.3-win64-gpl-shared-6.1\bin\ffmpeg.exe'
$env:RURAL_SCORE_FFPROBE='D:\26project\26audio_and_video_project\ffmpeg-n6.1.3-win64-gpl-shared-6.1\bin\ffprobe.exe'
npm.cmd run audio:verify
npm.cmd test
npm.cmd run build
```

Expected:

- audio verification PASS;
- all unit/core-loop/audio tests PASS;
- browser smoke PASS;
- production build PASS;
- no `__audio-fixture__` or dev evidence API in `dist`;
- only the existing documented chunk-size warning may remain.

- [ ] **Step 8: Perform real desktop playthrough and retain four screenshots**

At 1280×720:

1. Play from spawn through completion without debug teleport.
2. Confirm elapsed first-success time is between 2 and 4 minutes.
3. Intentionally fail once before and once after flashlight.
4. Confirm reveal, failure, gate-opening, and completion presentation.
5. Save the four listed PNGs from the real browser state.
6. Record browser version, viewport, controls used, observations, and renderer measurements in the validation document.

Do not mark headphone, speaker, iPhone Safari, or Android Chrome listening gates complete unless those devices are actually heard; the existing dynamic-BGM listening draft remains separate.

- [ ] **Step 9: Commit browser acceptance and validation**

```powershell
git add tests/smoke.mjs package.json artifacts/core-loop docs/superpowers/validation/2026-07-30-rural-mutation-escape-core-loop.md
git commit -m "test: prove the complete rural escape loop"
```

- [ ] **Step 10: Final branch review**

Run:

```powershell
git status --short
git log --oneline --decorate -12
git diff --check HEAD~10..HEAD
```

Expected:

- only the pre-existing uncommitted listening draft may remain;
- ten scoped implementation commits are present;
- no whitespace errors;
- every acceptance claim is backed by automated output or recorded real browser evidence.
