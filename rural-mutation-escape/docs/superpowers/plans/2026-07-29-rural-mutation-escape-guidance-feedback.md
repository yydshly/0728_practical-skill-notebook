# Rural Mutation Escape Guidance and Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a complete guidance and feedback loop to the playable rural escape prologue so the player always understands the current objective, target direction, interaction opportunity, and danger state.

**Architecture:** Keep story state authoritative, describe every objective through one data module, and derive read-only guidance and danger snapshots from runtime state. Render those snapshots through separate DOM UI, Three.js world-marker, and Web Audio modules so feedback never changes collision, navigation, story order, or pursuer behavior.

**Tech Stack:** Three.js 0.180, JavaScript ES modules, Vite 7.3, HTML/CSS, Web Audio API, Node.js `node:test`, Playwright 1.61.

## Global Constraints

- Preserve the four-stage order: `leave_home` → `visit_courtyard` → `reach_granary` → `escape_south_gate` → `complete`.
- Keep gameplay, collision, targets, and navigation on the existing `y = 0` plane.
- Do not add combat, weapons, health, inventory, saves, networking, a minimap, ground navigation lines, vertical traversal, external audio, or external model assets.
- Use `radio`, `neighbour`, `flashlight`, and `south_gate` as the four stable target anchor IDs.
- Hide the Three.js world marker outside 12 metres and never include it in collision or story completion.
- Keep the existing actual interaction radius at 2.2 metres; use 5 metres as the pre-approach prompt radius.
- Show integer distance above 3 metres and “就在附近” at or below 3 metres.
- Keep objective guidance visible during pursuit; danger is a separate overlay state.
- Respect `prefers-reduced-motion: reduce` by removing strong pulses and positional HUD animation.
- Verify 1280×720 and 1440×900 layouts.
- Audio must unlock after a user gesture, remain optional, and fail silently without blocking visual feedback or gameplay.
- Keep `RESEARCH.md` and `artifacts/prologue-start.png` outside the change set unless the user explicitly asks otherwise.

---

## File Structure

### New files

- `src/objectives.js` — canonical objective definitions and anchor resolution.
- `src/guidance.js` — pure target distance, relative bearing, proximity, and screen-edge calculations.
- `src/world-marker.js` — Three.js-only objective marker creation and rendering.
- `src/tutorial.js` — one-session progressive control-hint state.
- `src/danger.js` — pure danger-state controller with recovery timing.
- `src/audio-feedback.js` — optional Web Audio lifecycle, cues, heartbeat, and mute control.

### Modified files

- `src/story.js` — story transitions emit one-shot events while preserving the current state sequence.
- `src/ui.js` — renders mission, compass, prompt, tutorial, completion, danger, and mute states.
- `src/main.js` — composes the new modules and updates them in the game loop.
- `index.html` — adds semantic HUD containers and mute control.
- `src/style.css` — adds the balanced HUD layout, animations, responsive rules, and reduced-motion rules.
- `tests/unit.mjs` — tests objective data, guidance math, marker behavior, tutorial state, story events, danger transitions, and audio fallback.
- `tests/smoke.mjs` — verifies the full four-stage guidance flow, proximity prompts, pursuit feedback, mute behavior, viewports, and evidence hooks.

---

### Task 1: Canonical Objective Data and One-Shot Story Events

**Files:**
- Create: `rural-mutation-escape/src/objectives.js`
- Modify: `rural-mutation-escape/src/story.js:1-62`
- Modify: `rural-mutation-escape/tests/unit.mjs:1-21`
- Test: `rural-mutation-escape/tests/unit.mjs`

**Interfaces:**
- Produces: `OBJECTIVE_DEFINITIONS: Readonly<Record<string, ObjectiveDefinition>>`
- Produces: `getObjectiveDefinition(objectiveId: string): ObjectiveDefinition`
- Produces: `resolveObjectiveTarget(objectiveId: string, anchors: Record<string, THREE.Vector3>): THREE.Vector3 | null`
- Produces: `validateObjectiveDefinitions(definitions, anchorIds): string[]`
- Produces: `createStoryDirector({ ui, onEvent }): { story, interact, update, render }`
- Story events: `{ type: 'objective-completed' | 'objective-started' | 'chapter-completed', objectiveId: string, nextObjectiveId?: string }`

- [ ] **Step 1: Add failing objective-definition tests**

Add imports and tests to `tests/unit.mjs`:

```js
import {
  OBJECTIVE_DEFINITIONS,
  getObjectiveDefinition,
  resolveObjectiveTarget,
  validateObjectiveDefinitions,
} from '../src/objectives.js';
import { createStoryDirector } from '../src/story.js';

test('objective definitions map the four story stages to stable village anchors', () => {
  assert.deepEqual(
    ['leave_home', 'visit_courtyard', 'reach_granary', 'escape_south_gate']
      .map((id) => {
        const objective = getObjectiveDefinition(id);
        return [objective.step, objective.total, objective.anchorId, objective.interactionKind];
      }),
    [
      [1, 4, 'radio', 'radio'],
      [2, 4, 'neighbour', 'neighbour'],
      [3, 4, 'flashlight', 'flashlight'],
      [4, 4, 'south_gate', null],
    ],
  );
  assert.deepEqual(
    validateObjectiveDefinitions(OBJECTIVE_DEFINITIONS, new Set([
      'radio', 'neighbour', 'flashlight', 'south_gate',
    ])),
    [],
  );
});

test('objective target resolution fails closed when an anchor is missing', () => {
  const radio = new THREE.Vector3(-11.2, 0, 32.8);
  assert.equal(resolveObjectiveTarget('leave_home', { radio }), radio);
  assert.equal(resolveObjectiveTarget('visit_courtyard', { radio }), null);
  assert.equal(resolveObjectiveTarget('complete', { radio }), null);
});

test('story transitions emit each completion and start event exactly once', () => {
  const events = [];
  const ui = {
    setObjective() {},
    showSubtitle() {},
  };
  const director = createStoryDirector({ ui, onEvent: (event) => events.push(event) });

  director.interact('radio');
  director.interact('radio');

  assert.deepEqual(events, [
    { type: 'objective-completed', objectiveId: 'leave_home', nextObjectiveId: 'visit_courtyard' },
    { type: 'objective-started', objectiveId: 'visit_courtyard' },
  ]);
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
node --test --test-name-pattern="objective definitions|objective target|story transitions" tests/unit.mjs
```

Expected: FAIL because `src/objectives.js` does not exist and `createStoryDirector` does not yet accept `onEvent`.

- [ ] **Step 3: Create canonical objective definitions**

Create `src/objectives.js`:

```js
export const OBJECTIVE_DEFINITIONS = Object.freeze({
  leave_home: Object.freeze({
    id: 'leave_home',
    step: 1,
    total: 4,
    anchorId: 'radio',
    title: '调查收音机',
    clue: '杂音来自主角家亮着灯的窗边。',
    objective: '离开主角家，调查村里的异常。',
    subtitle: '收音机在杂音里重复着一个陌生的名字。',
    interactionKind: 'radio',
    actionLabel: '调查收音机',
  }),
  visit_courtyard: Object.freeze({
    id: 'visit_courtyard',
    step: 2,
    total: 4,
    anchorId: 'neighbour',
    title: '找到邻居',
    clue: '低语来自主路东侧的院落。',
    objective: '前往院落，寻找躲起来的邻居。',
    subtitle: '断断续续的低语从隔壁院墙后传来。',
    interactionKind: 'neighbour',
    actionLabel: '询问邻居',
  }),
  reach_granary: Object.freeze({
    id: 'reach_granary',
    step: 3,
    total: 4,
    anchorId: 'flashlight',
    title: '获取手电',
    clue: '手电落在南侧粮仓的冷光旁。',
    objective: '去晒谷场拿到手电，寻找村口出口。',
    subtitle: '邻居压低声音：别回头，去南边的铁门。',
    interactionKind: 'flashlight',
    actionLabel: '拾取手电筒',
  }),
  escape_south_gate: Object.freeze({
    id: 'escape_south_gate',
    step: 4,
    total: 4,
    anchorId: 'south_gate',
    title: '逃往南门',
    clue: '主路尽头的铁门是唯一出口。',
    objective: '沿主路逃往南侧村口。',
    subtitle: '主路尽头的铁门，是离开雾村的唯一方向。',
    interactionKind: null,
    actionLabel: null,
  }),
  complete: Object.freeze({
    id: 'complete',
    step: 4,
    total: 4,
    anchorId: null,
    title: '逃出雾村',
    clue: '第一章完成',
    objective: '第一章完成：你穿过了南侧村口。',
    subtitle: '铁门在身后合拢，雾里仍有人在呼喊你的名字。',
    interactionKind: null,
    actionLabel: null,
  }),
});

export function getObjectiveDefinition(objectiveId) {
  const definition = OBJECTIVE_DEFINITIONS[objectiveId];
  if (!definition) throw new Error(`Unknown objective: ${objectiveId}`);
  return definition;
}

export function resolveObjectiveTarget(objectiveId, anchors) {
  const definition = getObjectiveDefinition(objectiveId);
  return definition.anchorId ? anchors[definition.anchorId] ?? null : null;
}

export function validateObjectiveDefinitions(definitions, anchorIds) {
  const errors = [];
  for (const definition of Object.values(definitions)) {
    if (definition.anchorId && !anchorIds.has(definition.anchorId)) {
      errors.push(`objective:${definition.id}:missing-anchor:${definition.anchorId}`);
    }
    if (definition.step < 1 || definition.step > definition.total) {
      errors.push(`objective:${definition.id}:invalid-step`);
    }
  }
  return errors;
}
```

- [ ] **Step 4: Refactor story transitions to use definitions and emit events**

In `src/story.js`, import `getObjectiveDefinition`, replace the local copy objects, add `onEvent = () => {}`, and centralize transitions:

```js
import { getObjectiveDefinition } from './objectives.js';

export function createStoryDirector({ ui, onEvent = () => {} }) {
  const story = {
    objective: 'leave_home',
    flags: { radio: false, neighbour: false, flashlight: false },
  };

  function render() {
    const definition = getObjectiveDefinition(story.objective);
    ui.setObjective(definition.objective);
    ui.showSubtitle(definition.subtitle);
    return definition;
  }

  function transition(nextObjectiveId) {
    const objectiveId = story.objective;
    if (objectiveId === nextObjectiveId) return false;
    onEvent({ type: 'objective-completed', objectiveId, nextObjectiveId });
    story.objective = nextObjectiveId;
    onEvent({
      type: nextObjectiveId === 'complete' ? 'chapter-completed' : 'objective-started',
      objectiveId: nextObjectiveId,
    });
    render();
    return true;
  }

  function interact(kind) {
    if (kind === 'radio' && !story.flags.radio) {
      story.flags.radio = true;
      return transition('visit_courtyard');
    }
    if (kind === 'neighbour' && story.flags.radio && !story.flags.neighbour) {
      story.flags.neighbour = true;
      return transition('reach_granary');
    }
    if (kind === 'flashlight' && story.flags.neighbour && !story.flags.flashlight) {
      story.flags.flashlight = true;
      const changed = transition('escape_south_gate');
      if (changed) {
        ui.showSubtitle('手电亮起的一刻，主路尽头传来了一声不像人类的喘息。');
      }
      return changed;
    }
    return false;
  }

  function update(player, exitZone) {
    if (!story.flags.flashlight || story.objective === 'complete') return false;
    if (player.position.distanceTo(exitZone.center) > exitZone.radius) return false;
    return transition('complete');
  }

  render();
  return { story, interact, update, render };
}
```

- [ ] **Step 5: Run unit tests and verify GREEN**

Run:

```powershell
npm run test:unit
```

Expected: all current and new unit tests pass.

- [ ] **Step 6: Commit Task 1**

```powershell
git add -- rural-mutation-escape/src/objectives.js rural-mutation-escape/src/story.js rural-mutation-escape/tests/unit.mjs
git commit -m "feat: define guided story objectives"
```

---

### Task 2: Guidance Math and World-Space Objective Marker

**Files:**
- Create: `rural-mutation-escape/src/guidance.js`
- Create: `rural-mutation-escape/src/world-marker.js`
- Modify: `rural-mutation-escape/tests/unit.mjs`
- Test: `rural-mutation-escape/tests/unit.mjs`

**Interfaces:**
- Consumes: objective target `THREE.Vector3` from `resolveObjectiveTarget`
- Produces: `computeGuidanceSnapshot({ playerPosition, targetPosition, cameraYaw, preApproachRadius?, interactionRadius?, worldMarkerRadius? })`
- Produces: `formatObjectiveDistance(distance: number): string`
- Produces: `projectScreenMarker(targetPosition, camera, viewport, margin?): ScreenMarker | null`
- Produces: `createWorldObjectiveMarker(scene): { object, update(snapshot, elapsed), dispose() }`

- [ ] **Step 1: Add failing pure-guidance and marker tests**

Add imports and tests:

```js
import {
  computeGuidanceSnapshot,
  formatObjectiveDistance,
  projectScreenMarker,
} from '../src/guidance.js';
import { createWorldObjectiveMarker } from '../src/world-marker.js';

test('guidance reports distance, relative direction, and staged proximity', () => {
  const far = computeGuidanceSnapshot({
    playerPosition: new THREE.Vector3(0, 0, 0),
    targetPosition: new THREE.Vector3(10, 0, 0),
    cameraYaw: 0,
  });
  assert.equal(far.distance, 10);
  assert.ok(Math.abs(far.relativeAngle - Math.PI / 2) < 0.0001);
  assert.equal(far.showWorldMarker, true);
  assert.equal(far.proximity, 'far');

  const approach = computeGuidanceSnapshot({
    playerPosition: new THREE.Vector3(7, 0, 0),
    targetPosition: new THREE.Vector3(10, 0, 0),
    cameraYaw: 0,
  });
  assert.equal(approach.proximity, 'approach');
  assert.equal(formatObjectiveDistance(approach.distance), '就在附近');

  const interact = computeGuidanceSnapshot({
    playerPosition: new THREE.Vector3(8, 0, 0),
    targetPosition: new THREE.Vector3(10, 0, 0),
    cameraYaw: 0,
  });
  assert.equal(interact.proximity, 'interact');
});

test('screen marker clamps an off-camera target to a safe viewport edge', () => {
  const camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.1, 120);
  camera.position.set(0, 2, 0);
  camera.lookAt(0, 1, -1);
  camera.updateMatrixWorld(true);
  const marker = projectScreenMarker(
    new THREE.Vector3(20, 0, -1),
    camera,
    { width: 1280, height: 720 },
    48,
  );
  assert.ok(marker);
  assert.equal(marker.edge, true);
  assert.ok(marker.x >= 48 && marker.x <= 1232);
  assert.ok(marker.y >= 48 && marker.y <= 672);
});

test('world objective marker stays decorative and follows guidance visibility', () => {
  const scene = new THREE.Scene();
  const marker = createWorldObjectiveMarker(scene);
  marker.update({
    targetPosition: new THREE.Vector3(3, 0, 4),
    showWorldMarker: true,
    proximity: 'approach',
  }, 0.5);
  assert.equal(marker.object.parent, scene);
  assert.equal(marker.object.visible, true);
  assert.deepEqual(marker.object.position.toArray(), [3, 0.03, 4]);
  assert.equal(marker.object.userData.decorativeOnly, true);
  marker.update({ targetPosition: null, showWorldMarker: false, proximity: 'none' }, 1);
  assert.equal(marker.object.visible, false);
  marker.dispose();
  assert.equal(marker.object.parent, null);
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
node --test --test-name-pattern="guidance reports|screen marker|world objective marker" tests/unit.mjs
```

Expected: FAIL because `guidance.js` and `world-marker.js` do not exist.

- [ ] **Step 3: Implement guidance calculations**

Create `src/guidance.js`:

```js
import * as THREE from 'three';

const projected = new THREE.Vector3();

export function formatObjectiveDistance(distance) {
  return distance <= 3 ? '就在附近' : `${Math.round(distance)}m`;
}

export function computeGuidanceSnapshot({
  playerPosition,
  targetPosition,
  cameraYaw,
  preApproachRadius = 5,
  interactionRadius = 2.2,
  worldMarkerRadius = 12,
}) {
  if (!targetPosition) {
    return {
      targetPosition: null,
      distance: Infinity,
      distanceLabel: '',
      relativeAngle: 0,
      proximity: 'none',
      showWorldMarker: false,
    };
  }
  const dx = targetPosition.x - playerPosition.x;
  const dz = targetPosition.z - playerPosition.z;
  const distance = Math.hypot(dx, dz);
  const targetYaw = Math.atan2(dx, dz);
  const relativeAngle = Math.atan2(
    Math.sin(targetYaw - cameraYaw),
    Math.cos(targetYaw - cameraYaw),
  );
  const proximity = distance <= interactionRadius
    ? 'interact'
    : distance <= preApproachRadius ? 'approach' : 'far';
  return {
    targetPosition,
    distance,
    distanceLabel: formatObjectiveDistance(distance),
    relativeAngle,
    proximity,
    showWorldMarker: distance <= worldMarkerRadius,
  };
}

export function projectScreenMarker(targetPosition, camera, viewport, margin = 48) {
  if (!targetPosition || viewport.width <= 0 || viewport.height <= 0) return null;
  projected.copy(targetPosition);
  projected.y += 1.5;
  projected.project(camera);
  if (![projected.x, projected.y, projected.z].every(Number.isFinite)) return null;

  const behind = projected.z > 1;
  const rawX = ((behind ? -projected.x : projected.x) * 0.5 + 0.5) * viewport.width;
  const rawY = (-(behind ? -projected.y : projected.y) * 0.5 + 0.5) * viewport.height;
  const x = Math.min(viewport.width - margin, Math.max(margin, rawX));
  const y = Math.min(viewport.height - margin, Math.max(margin, rawY));
  const edge = behind || x !== rawX || y !== rawY;
  return { x, y, edge, behind };
}
```

- [ ] **Step 4: Implement the decorative world marker**

Create `src/world-marker.js`:

```js
import * as THREE from 'three';

export function createWorldObjectiveMarker(scene) {
  const object = new THREE.Group();
  object.name = 'objective_marker';
  object.userData.decorativeOnly = true;
  object.visible = false;

  const material = new THREE.MeshBasicMaterial({
    color: 0xe3b56f,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.48, 0.66, 32), material);
  ring.name = 'objective_marker_ring';
  ring.rotation.x = -Math.PI / 2;
  object.add(ring);
  scene.add(object);

  function update(snapshot, elapsed) {
    object.visible = Boolean(snapshot.showWorldMarker && snapshot.targetPosition);
    if (!object.visible) return;
    object.position.set(snapshot.targetPosition.x, 0.03, snapshot.targetPosition.z);
    const pulse = snapshot.proximity === 'interact'
      ? 1
      : 1 + Math.sin(elapsed * 3.2) * 0.08;
    object.scale.setScalar(pulse);
    material.opacity = snapshot.proximity === 'interact' ? 0.26 : 0.42;
  }

  function dispose() {
    object.removeFromParent();
    ring.geometry.dispose();
    material.dispose();
  }

  return { object, update, dispose };
}
```

- [ ] **Step 5: Run unit tests and verify GREEN**

Run:

```powershell
npm run test:unit
```

Expected: all unit tests pass and marker geometries are disposed by the test.

- [ ] **Step 6: Commit Task 2**

```powershell
git add -- rural-mutation-escape/src/guidance.js rural-mutation-escape/src/world-marker.js rural-mutation-escape/tests/unit.mjs
git commit -m "feat: add objective guidance calculations"
```

---

### Task 3: Mission HUD, Progressive Tutorials, and Accessible Controls

**Files:**
- Create: `rural-mutation-escape/src/tutorial.js`
- Modify: `rural-mutation-escape/index.html:10-24`
- Modify: `rural-mutation-escape/src/ui.js:1-49`
- Modify: `rural-mutation-escape/src/style.css:1-211`
- Modify: `rural-mutation-escape/tests/unit.mjs`
- Modify: `rural-mutation-escape/tests/smoke.mjs:78-149`
- Test: `rural-mutation-escape/tests/unit.mjs`
- Test: `rural-mutation-escape/tests/smoke.mjs`

**Interfaces:**
- Consumes: `ObjectiveDefinition`, guidance snapshot, screen marker, danger snapshot.
- Produces: `createTutorialTracker({ onChange? }): { current, complete(action), reset() }`
- Produces UI methods: `renderMission(definition)`, `renderGuidance(definition, snapshot, screenMarker)`, `renderDanger(snapshot)`, `showCompletion(definition)`, `showTutorial(tutorial: { id, text } | null)`, `setMuted(muted)`, `onMute(handler)`, and `transitionActive`.

- [ ] **Step 1: Add a failing tutorial-state unit test**

```js
import { createTutorialTracker } from '../src/tutorial.js';

test('tutorial tracker reveals each control once in authored order', () => {
  const changes = [];
  const tutorial = createTutorialTracker({ onChange: (value) => changes.push(value) });
  assert.equal(tutorial.current.id, 'move');
  assert.equal(tutorial.complete('move'), true);
  assert.equal(tutorial.current.id, 'sprint');
  assert.equal(tutorial.complete('move'), false);
  tutorial.complete('sprint');
  tutorial.complete('look');
  tutorial.complete('camera');
  tutorial.complete('interact');
  assert.equal(tutorial.current, null);
  assert.equal(changes.at(-1), null);
});
```

- [ ] **Step 2: Add failing HUD structure assertions to the smoke test**

Immediately after `gameHandle` is confirmed in `tests/smoke.mjs`, assert:

```js
const guidanceHud = await page.evaluate(() => ({
  missionStep: document.querySelector('#mission-step')?.textContent,
  missionTitle: document.querySelector('#mission-title')?.textContent,
  missionClue: document.querySelector('#mission-clue')?.textContent,
  compassHidden: document.querySelector('#objective-compass')?.hidden,
  markerHidden: document.querySelector('#screen-marker')?.hidden,
  tutorialText: document.querySelector('#tutorial-hint')?.textContent,
  mutePressed: document.querySelector('#mute-toggle')?.getAttribute('aria-pressed'),
}));
if (guidanceHud.missionStep !== '任务 1/4') throw new Error('Expected mission step 1/4');
if (guidanceHud.missionTitle !== '调查收音机') throw new Error('Expected radio mission title');
if (!guidanceHud.missionClue) throw new Error('Expected mission clue');
if (guidanceHud.compassHidden !== false) throw new Error('Expected objective compass');
if (guidanceHud.tutorialText !== 'WASD 移动') throw new Error('Expected first tutorial hint');
if (guidanceHud.mutePressed !== 'false') throw new Error('Expected sound enabled state');
```

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```powershell
node --test --test-name-pattern="tutorial tracker" tests/unit.mjs
node tests/smoke.mjs
```

Expected: unit test FAIL because `tutorial.js` is missing; smoke test FAIL because the new HUD elements are missing.

- [ ] **Step 4: Implement the tutorial tracker**

Create `src/tutorial.js`:

```js
const TUTORIALS = Object.freeze([
  { id: 'move', text: 'WASD 移动' },
  { id: 'sprint', text: 'Shift 奔跑' },
  { id: 'look', text: '鼠标环顾' },
  { id: 'camera', text: 'C 切换视角' },
  { id: 'interact', text: 'E 互动' },
]);

export function createTutorialTracker({ onChange = () => {} } = {}) {
  const completed = new Set();
  let current = TUTORIALS[0];

  function publish() {
    current = TUTORIALS.find(({ id }) => !completed.has(id)) ?? null;
    onChange(current);
  }

  const tracker = {
    get current() { return current; },
    complete(action) {
      if (!TUTORIALS.some(({ id }) => id === action) || completed.has(action)) return false;
      completed.add(action);
      publish();
      return true;
    },
    reset() {
      completed.clear();
      publish();
    },
  };
  onChange(current);
  return tracker;
}
```

- [ ] **Step 5: Add semantic HUD markup**

Replace the current mission/interaction/footer section in `index.html` with:

```html
<section class="mission-hud" aria-live="polite">
  <p id="mission-step" class="mission-label">任务 1/4</p>
  <p id="mission-title" class="mission-title">调查收音机</p>
  <p id="mission-clue" class="mission-clue">杂音来自主角家亮着灯的窗边。</p>
  <p id="objective" class="sr-only">离开主角家，调查村里的异常。</p>
</section>
<section id="objective-compass" class="objective-compass" aria-live="polite">
  <span class="compass-diamond" aria-hidden="true">◆</span>
  <span id="compass-label">调查收音机</span>
  <span id="compass-distance">3m</span>
</section>
<div id="screen-marker" class="screen-marker" hidden aria-hidden="true">◆</div>
<p id="danger-state" class="danger-state" hidden aria-live="assertive"></p>
<div class="danger-vignette" aria-hidden="true"></div>
<p id="completion-toast" class="completion-toast" hidden aria-live="polite"></p>
<p id="subtitle" class="subtitle">收音机在杂音里重复着一个陌生的名字。</p>
<p id="approach-prompt" class="approach-prompt" hidden></p>
<p id="interaction" class="interaction" hidden><kbd>E</kbd><span></span></p>
<p id="tutorial-hint" class="tutorial-hint">WASD 移动</p>
<button id="mute-toggle" class="mute-toggle" type="button" aria-pressed="false" aria-label="关闭音效">🔊</button>
```

- [ ] **Step 6: Expand the UI controller with deterministic render methods**

In `src/ui.js`, replace the function signature and timer declarations with:

```js
export function createGameUi({
  shell,
  title,
  missionHud,
  missionStep,
  missionTitle,
  missionClue,
  objective,
  subtitle,
  approachPrompt,
  interaction,
  tutorialHint,
  compass,
  compassLabel,
  compassDistance,
  marker,
  dangerState,
  completionToast,
  muteToggle,
}) {
  let subtitleTimer;
  let completionTimer;
  let completionActive = false;
```

Keep the existing intro behavior, then implement:

```js
function renderMission(definition) {
  if (completionActive) return;
  missionStep.textContent = `任务 ${definition.step}/${definition.total}`;
  missionTitle.textContent = definition.title;
  missionClue.textContent = definition.clue;
  setObjective(definition.objective);
  missionHud.dataset.state = 'active';
}

function renderGuidance(definition, snapshot, screenMarker) {
  const visible = Boolean(snapshot.targetPosition);
  compass.hidden = completionActive || !visible;
  marker.hidden = completionActive || !visible || !screenMarker;
  approachPrompt.hidden = completionActive || snapshot.proximity !== 'approach';
  interaction.hidden = completionActive
    || snapshot.proximity !== 'interact'
    || !definition.actionLabel;
  if (!visible) return;
  compassLabel.textContent = definition.title;
  compassDistance.textContent = snapshot.distanceLabel;
  compass.style.setProperty('--bearing', `${snapshot.relativeAngle}rad`);
  if (screenMarker) {
    marker.style.transform = `translate3d(${screenMarker.x}px, ${screenMarker.y}px, 0)`;
    marker.dataset.edge = String(screenMarker.edge);
  }
  approachPrompt.textContent = `靠近：${definition.title}`;
  interaction.querySelector('span').textContent = definition.actionLabel ?? '';
}

function renderDanger(snapshot) {
  shell.dataset.danger = snapshot.mode;
  dangerState.hidden = snapshot.mode === 'safe';
  dangerState.textContent = snapshot.label;
  shell.style.setProperty('--danger-intensity', snapshot.intensity.toFixed(3));
}

function showCompletion(definition) {
  completionActive = true;
  missionStep.textContent = `任务 ${definition.step}/${definition.total}`;
  missionTitle.textContent = definition.title;
  missionClue.textContent = definition.clue;
  completionToast.textContent = `✓ ${definition.title}`;
  completionToast.hidden = false;
  missionHud.dataset.state = 'complete';
  clearTimeout(completionTimer);
  completionTimer = setTimeout(() => {
    completionActive = false;
    completionToast.hidden = true;
    missionHud.dataset.state = 'active';
  }, 800);
}

function showTutorial(tutorial) {
  tutorialHint.hidden = !tutorial;
  tutorialHint.textContent = tutorial?.text ?? '';
}

function setMuted(muted) {
  muteToggle.setAttribute('aria-pressed', String(muted));
  muteToggle.setAttribute('aria-label', muted ? '开启音效' : '关闭音效');
  muteToggle.textContent = muted ? '🔇' : '🔊';
}

function onMute(handler) {
  muteToggle.addEventListener('click', handler);
}
```

Return the complete public UI interface:

```js
return {
  completeIntro() {
    clearTimeout(introTimer);
    completeIntro();
  },
  setObjective,
  showSubtitle,
  showInteraction,
  renderMission,
  renderGuidance,
  renderDanger,
  showCompletion,
  showTutorial,
  setMuted,
  onMute,
  get transitionActive() { return completionActive; },
};
```

- [ ] **Step 7: Add balanced HUD CSS and reduced-motion behavior**

Add styles that satisfy the approved layout:

```css
.mission-title {
  font: 700 clamp(1rem, 1.6vw, 1.18rem)/1.4 Georgia, "Noto Serif SC", serif;
  margin: 0;
}

.mission-clue {
  color: rgba(245, 240, 220, .72);
  font-size: .78rem;
  line-height: 1.5;
  margin: .28rem 0 0;
}

.objective-compass {
  align-items: center;
  display: flex;
  gap: .48rem;
  left: 50%;
  position: absolute;
  top: 1.35rem;
  transform: translateX(-50%);
  z-index: 4;
}

.compass-diamond {
  display: inline-block;
  transform: rotate(var(--bearing, 0rad));
}

.screen-marker {
  left: 0;
  position: absolute;
  top: 0;
  transform-origin: center;
  z-index: 4;
}

.approach-prompt,
.tutorial-hint,
.danger-state,
.completion-toast,
.mute-toggle {
  position: absolute;
  z-index: 4;
}

.approach-prompt,
.tutorial-hint,
.danger-state,
.completion-toast {
  left: 50%;
  transform: translateX(-50%);
}

.approach-prompt { bottom: 7.5rem; }
.tutorial-hint { bottom: 1.35rem; }
.danger-state { color: #e7a08b; top: 4.25rem; }
.completion-toast { color: #f3c591; top: 6.5rem; }
.mute-toggle {
  background: rgba(13, 17, 15, .52);
  border: 1px solid rgba(245, 240, 220, .22);
  bottom: 1rem;
  color: inherit;
  cursor: pointer;
  pointer-events: auto;
  right: 1rem;
}

.danger-vignette {
  background: radial-gradient(circle, transparent 46%, rgba(100, 15, 9, calc(var(--danger-intensity, 0) * .72)) 118%);
  inset: 0;
  pointer-events: none;
  position: absolute;
  z-index: 2;
}

.sr-only {
  height: 1px;
  margin: -1px;
  overflow: hidden;
  position: absolute;
  width: 1px;
}

@media (prefers-reduced-motion: reduce) {
  .screen-marker,
  .danger-vignette,
  .completion-toast {
    animation: none;
    transition: none;
  }
}
```

Add these exact mobile rules inside the existing `@media (max-width: 700px)` block:

```css
.objective-compass {
  max-width: calc(100vw - 2rem);
  top: 7.2rem;
  white-space: nowrap;
}

.mission-hud {
  max-width: calc(100vw - 2rem);
}

.mute-toggle {
  bottom: 1rem;
  right: .75rem;
}
```

- [ ] **Step 8: Run unit and smoke tests**

Run:

```powershell
npm test
```

Expected: tutorial test and new HUD structure assertions pass; all existing route and interaction tests remain green.

- [ ] **Step 9: Commit Task 3**

```powershell
git add -- rural-mutation-escape/index.html rural-mutation-escape/src/style.css rural-mutation-escape/src/ui.js rural-mutation-escape/src/tutorial.js rural-mutation-escape/tests/unit.mjs rural-mutation-escape/tests/smoke.mjs
git commit -m "feat: add progressive mission HUD"
```

---

### Task 4: Danger State and Optional Web Audio Feedback

**Files:**
- Create: `rural-mutation-escape/src/danger.js`
- Create: `rural-mutation-escape/src/audio-feedback.js`
- Modify: `rural-mutation-escape/tests/unit.mjs`
- Test: `rural-mutation-escape/tests/unit.mjs`

**Interfaces:**
- Produces: `createDangerController({ recoverySeconds? }): { update(dt, pursuerState, distance), reset() }`
- Danger snapshot: `{ mode: 'safe' | 'chase' | 'threaten' | 'recover', label: string, intensity: number, heartbeatBpm: number }`
- Produces: `createAudioFeedback({ AudioContextCtor? }): { unlock(), setMuted(), toggleMuted(), handleStoryEvent(), updateDanger(), suspend(), resume(), dispose(), muted, unlocked }`

- [ ] **Step 1: Add failing danger-transition tests**

```js
import { createDangerController } from '../src/danger.js';
import { createAudioFeedback } from '../src/audio-feedback.js';

test('danger controller distinguishes chase, close threat, recovery, and safety', () => {
  const danger = createDangerController({ recoverySeconds: 1.2 });
  assert.equal(danger.update(0.016, 'patrol', 20).mode, 'safe');
  const chase = danger.update(0.016, 'chase', 8);
  assert.deepEqual([chase.mode, chase.label], ['chase', '已被发现']);
  const threat = danger.update(0.016, 'threaten', 2.4);
  assert.equal(threat.mode, 'threaten');
  assert.ok(threat.heartbeatBpm > chase.heartbeatBpm);
  assert.equal(danger.update(0.4, 'patrol', 18).mode, 'recover');
  assert.equal(danger.update(0.81, 'patrol', 18).mode, 'safe');
});
```

- [ ] **Step 2: Add failing audio-fallback tests**

```js
test('audio feedback remains safe without an AudioContext implementation', async () => {
  const audio = createAudioFeedback({ AudioContextCtor: null });
  assert.equal(await audio.unlock(), false);
  assert.equal(audio.unlocked, false);
  assert.doesNotThrow(() => audio.handleStoryEvent({
    type: 'objective-completed',
    objectiveId: 'leave_home',
  }));
  assert.doesNotThrow(() => audio.updateDanger({
    mode: 'threaten',
    heartbeatBpm: 110,
    intensity: 1,
  }));
  audio.setMuted(true);
  assert.equal(audio.muted, true);
  audio.dispose();
});
```

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```powershell
node --test --test-name-pattern="danger controller|audio feedback" tests/unit.mjs
```

Expected: FAIL because `danger.js` and `audio-feedback.js` are missing.

- [ ] **Step 4: Implement the danger controller**

Create `src/danger.js`:

```js
export function createDangerController({ recoverySeconds = 1.2 } = {}) {
  let recoveryRemaining = 0;
  let wasDangerous = false;

  function update(dt, pursuerState, distance) {
    if (pursuerState === 'threaten') {
      wasDangerous = true;
      recoveryRemaining = recoverySeconds;
      const closeness = Math.max(0, Math.min(1, (4 - distance) / 2));
      return {
        mode: 'threaten',
        label: '近身威胁',
        intensity: 0.72 + closeness * 0.28,
        heartbeatBpm: 108 + closeness * 24,
      };
    }
    if (pursuerState === 'chase') {
      wasDangerous = true;
      recoveryRemaining = recoverySeconds;
      const closeness = Math.max(0, Math.min(1, (11 - distance) / 8));
      return {
        mode: 'chase',
        label: '已被发现',
        intensity: 0.3 + closeness * 0.38,
        heartbeatBpm: 72 + closeness * 28,
      };
    }
    if (wasDangerous && recoveryRemaining > 0) {
      recoveryRemaining = Math.max(0, recoveryRemaining - dt);
      const intensity = recoveryRemaining / recoverySeconds;
      if (recoveryRemaining === 0) wasDangerous = false;
      return {
        mode: recoveryRemaining > 0 ? 'recover' : 'safe',
        label: recoveryRemaining > 0 ? '正在脱离危险' : '',
        intensity: intensity * 0.25,
        heartbeatBpm: 0,
      };
    }
    return { mode: 'safe', label: '', intensity: 0, heartbeatBpm: 0 };
  }

  return {
    update,
    reset() {
      recoveryRemaining = 0;
      wasDangerous = false;
    },
  };
}
```

- [ ] **Step 5: Implement optional audio with bounded node lifetimes**

Create `src/audio-feedback.js` with the following lifecycle:

```js
export function createAudioFeedback({
  AudioContextCtor = globalThis.AudioContext ?? globalThis.webkitAudioContext ?? null,
} = {}) {
  let context = null;
  let master = null;
  let muted = false;
  let unlocked = false;
  let heartbeatTimer = 0;
  let lastDangerMode = 'safe';

  function ensureContext() {
    if (!AudioContextCtor) return false;
    context ??= new AudioContextCtor();
    if (!master) {
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.28;
      master.connect(context.destination);
    }
    return true;
  }

  async function unlock() {
    try {
      if (!ensureContext()) return false;
      if (context.state === 'suspended') await context.resume();
      unlocked = context.state === 'running';
      return unlocked;
    } catch {
      unlocked = false;
      return false;
    }
  }

  function tone(frequency, duration, gain = 0.08, offset = 0) {
    if (!unlocked || muted || !context || !master) return;
    const start = context.currentTime + offset;
    const oscillator = context.createOscillator();
    const voice = context.createGain();
    oscillator.frequency.value = frequency;
    voice.gain.setValueAtTime(gain, start);
    voice.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(voice);
    voice.connect(master);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  function handleStoryEvent(event) {
    if (event.type === 'objective-completed') {
      tone(440, 0.16, 0.06);
      tone(660, 0.2, 0.05, 0.12);
    } else if (event.type === 'chapter-completed') {
      tone(392, 0.2, 0.06);
      tone(523.25, 0.24, 0.05, 0.15);
      tone(659.25, 0.3, 0.04, 0.3);
    }
  }

  function updateDanger(snapshot, elapsed) {
    const enteringDanger = ['chase', 'threaten'].includes(snapshot.mode)
      && ['safe', 'recover'].includes(lastDangerMode);
    if (enteringDanger) tone(110, 0.35, 0.07);
    lastDangerMode = snapshot.mode;
    if (snapshot.mode === 'safe' || snapshot.mode === 'recover') {
      heartbeatTimer = 0;
      return;
    }
    const interval = 60 / Math.max(1, snapshot.heartbeatBpm);
    if (elapsed < heartbeatTimer) return;
    tone(62, 0.12, 0.075);
    tone(52, 0.11, 0.055, 0.14);
    heartbeatTimer = elapsed + interval;
  }

  function setMuted(value) {
    muted = Boolean(value);
    if (master && context) {
      master.gain.setTargetAtTime(muted ? 0 : 0.28, context.currentTime, 0.03);
    }
  }

  return {
    unlock,
    setMuted,
    toggleMuted() {
      setMuted(!muted);
      return muted;
    },
    handleStoryEvent,
    updateDanger,
    async suspend() {
      if (context?.state === 'running') await context.suspend().catch(() => {});
    },
    async resume() {
      if (!muted && context?.state === 'suspended') await context.resume().catch(() => {});
    },
    dispose() {
      master?.disconnect();
      const closing = context?.close?.();
      closing?.catch?.(() => {});
      context = null;
      master = null;
      unlocked = false;
    },
    get muted() { return muted; },
    get unlocked() { return unlocked; },
  };
}
```

- [ ] **Step 6: Run unit tests and verify GREEN**

Run:

```powershell
npm run test:unit
```

Expected: all unit tests pass; the no-audio fallback does not throw or allocate nodes.

- [ ] **Step 7: Commit Task 4**

```powershell
git add -- rural-mutation-escape/src/danger.js rural-mutation-escape/src/audio-feedback.js rural-mutation-escape/tests/unit.mjs
git commit -m "feat: add pursuit danger feedback"
```

---

### Task 5: Compose Guidance, Feedback, Tutorials, and Audio in the Runtime

**Files:**
- Modify: `rural-mutation-escape/src/main.js:1-220`
- Modify: `rural-mutation-escape/tests/smoke.mjs:340-665`
- Test: `rural-mutation-escape/tests/smoke.mjs`

**Interfaces:**
- Consumes: all interfaces produced by Tasks 1–4.
- Produces runtime test hooks: `guidance`, `danger`, `audio`, `completeTutorialForTest(action)`, `refreshFeedbackForTest(dt)`.
- Preserves existing `window.__RURAL_ESCAPE__` hooks used by route, camera, story, and pursuer tests.

- [ ] **Step 1: Add failing runtime guidance and danger assertions**

Add a deterministic check after intro completion in `tests/smoke.mjs`:

```js
const initialGuidance = await page.evaluate(() => {
  const game = window.__RURAL_ESCAPE__;
  game.setPlayerForTest(-8, 33);
  game.refreshFeedbackForTest(1 / 60);
  return {
    objectiveId: game.guidance.objectiveId,
    distance: game.guidance.distance,
    proximity: game.guidance.proximity,
    worldMarkerVisible: document.querySelector('#screen-marker').hidden === false,
    missionStep: document.querySelector('#mission-step').textContent,
  };
});
if (initialGuidance.objectiveId !== 'leave_home') throw new Error('Expected guided radio objective');
if (initialGuidance.missionStep !== '任务 1/4') throw new Error('Expected stage 1/4');
if (!Number.isFinite(initialGuidance.distance)) throw new Error('Expected objective distance');

await page.evaluate(() => {
  const game = window.__RURAL_ESCAPE__;
  game.pursuer.reset();
  game.pursuer.object.position.set(0, 0, 0);
  game.setPlayerForTest(0, 5);
  game.updatePursuerForTest(1 / 60);
  game.refreshFeedbackForTest(1 / 60);
});
const dangerHud = await page.evaluate(() => ({
  mode: document.querySelector('.game-shell').dataset.danger,
  label: document.querySelector('#danger-state').textContent,
}));
if (!['chase', 'threaten'].includes(dangerHud.mode)) throw new Error('Expected visible danger mode');
if (!dangerHud.label) throw new Error('Expected danger label');
```

- [ ] **Step 2: Add failing staged-prompt assertions**

Replace the old single-radius prompt assertions with:

```js
await page.evaluate(() => window.__RURAL_ESCAPE__.setPlayerForTest(-7, 32.8));
const approachPrompt = await page.evaluate(() => ({
  approachVisible: !document.querySelector('#approach-prompt').hidden,
  interactionVisible: !document.querySelector('#interaction').hidden,
}));
if (!approachPrompt.approachVisible || approachPrompt.interactionVisible) {
  throw new Error('Expected approach-only radio prompt between 2.2m and 5m');
}

await page.evaluate(() => window.__RURAL_ESCAPE__.setPlayerForTest(-9, 32.8));
const interactPrompt = await page.evaluate(() => ({
  approachVisible: !document.querySelector('#approach-prompt').hidden,
  interactionVisible: !document.querySelector('#interaction').hidden,
}));
if (interactPrompt.approachVisible || !interactPrompt.interactionVisible) {
  throw new Error('Expected E interaction prompt within 2.2m');
}
```

- [ ] **Step 3: Run smoke test and verify RED**

Run:

```powershell
node tests/smoke.mjs
```

Expected: FAIL because runtime hooks and composed HUD updates do not exist.

- [ ] **Step 4: Import the new runtime modules**

Add imports to `src/main.js`:

```js
import {
  OBJECTIVE_DEFINITIONS,
  getObjectiveDefinition,
  resolveObjectiveTarget,
  validateObjectiveDefinitions,
} from './objectives.js';
import {
  computeGuidanceSnapshot,
  projectScreenMarker,
} from './guidance.js';
import { createWorldObjectiveMarker } from './world-marker.js';
import { createTutorialTracker } from './tutorial.js';
import { createDangerController } from './danger.js';
import { createAudioFeedback } from './audio-feedback.js';
```

- [ ] **Step 5: Compose UI, audio, story events, and feedback controllers**

Replace the current UI/story/pursuer initialization block after resident creation with:

```js
const ui = createGameUi({
  shell,
  title,
  missionHud: document.querySelector('.mission-hud'),
  missionStep: document.querySelector('#mission-step'),
  missionTitle: document.querySelector('#mission-title'),
  missionClue: document.querySelector('#mission-clue'),
  objective,
  subtitle,
  approachPrompt: document.querySelector('#approach-prompt'),
  interaction,
  tutorialHint: document.querySelector('#tutorial-hint'),
  compass: document.querySelector('#objective-compass'),
  compassLabel: document.querySelector('#compass-label'),
  compassDistance: document.querySelector('#compass-distance'),
  marker: document.querySelector('#screen-marker'),
  dangerState: document.querySelector('#danger-state'),
  completionToast: document.querySelector('#completion-toast'),
  muteToggle: document.querySelector('#mute-toggle'),
});
const audio = createAudioFeedback();
const worldMarker = createWorldObjectiveMarker(scene);
const dangerController = createDangerController();
const pursuer = createPursuer(scene, {
  navNodes: village.navNodes,
  spawn: village.anchors.sighting.clone(),
});
const tutorial = createTutorialTracker({
  onChange: (value) => ui.showTutorial(value),
});
const objectiveErrors = validateObjectiveDefinitions(
  OBJECTIVE_DEFINITIONS,
  new Set(Object.keys(village.anchors)),
);
if (objectiveErrors.length) console.error(objectiveErrors.join('\n'));
const storyDirector = createStoryDirector({
  ui,
  onEvent(event) {
    if (event.type === 'objective-completed') {
      ui.showCompletion(getObjectiveDefinition(event.objectiveId));
    }
    audio.handleStoryEvent(event);
  },
});
let guidanceSnapshot = {
  objectiveId: storyDirector.story.objective,
  targetPosition: null,
  distance: Infinity,
  distanceLabel: '',
  relativeAngle: 0,
  proximity: 'none',
  showWorldMarker: false,
};
let dangerSnapshot = dangerController.update(0, pursuer.state, Infinity);
```

After the existing startup calls, perform the first feedback render only after sizing and snapping the camera:

```js
applyEvidenceFixture();
resize();
cameraController.snap();
refreshFeedback(0, 0);
requestAnimationFrame(frame);
```

This replaces the existing four-line startup block and ensures normal and evidence URLs share the same initialized camera state.

- [ ] **Step 6: Add one feedback-refresh function and call it from the frame**

In `src/main.js`:

```js
function refreshFeedback(dt, elapsed) {
  const objectiveId = storyDirector.story.objective;
  const definition = getObjectiveDefinition(objectiveId);
  const targetPosition = resolveObjectiveTarget(objectiveId, village.anchors);
  guidanceSnapshot = {
    objectiveId,
    ...computeGuidanceSnapshot({
      playerPosition: player.position,
      targetPosition,
      cameraYaw: cameraController.yaw,
    }),
  };
  const screenMarker = projectScreenMarker(
    targetPosition,
    camera,
    { width: canvas.clientWidth, height: canvas.clientHeight },
  );
  dangerSnapshot = dangerController.update(
    dt,
    pursuer.state,
    pursuer.object.position.distanceTo(player.position),
  );
  ui.renderMission(definition);
  ui.renderGuidance(definition, guidanceSnapshot, screenMarker);
  ui.renderDanger(dangerSnapshot);
  worldMarker.update({
    ...guidanceSnapshot,
    showWorldMarker: guidanceSnapshot.showWorldMarker && !ui.transitionActive,
  }, elapsed);
  audio.updateDanger(dangerSnapshot, elapsed);
}
```

Call it after story and camera updates but before `renderer.render`:

```js
const elapsed = (now - startTime) / 1000;
storyDirector.update(player, village.zones.south_gate_exit);
cameraController.update(dt);
refreshFeedback(dt, elapsed);
atmosphere.update(elapsed);
renderer.render(scene, camera);
```

- [ ] **Step 7: Keep interaction selection state-only**

Replace `updateInteraction()` with:

```js
function updateInteraction() {
  const allowed = new Set(allowedKinds[storyDirector.story.objective] ?? []);
  nearbyInteraction = nearestInteraction(
    player.position,
    village.interactionAnchors.filter(
      (candidate) => allowed.has(candidate.kind) && !storyDirector.story.flags[candidate.kind],
    ),
    2.2,
  );
}
```

`renderGuidance()` becomes the only code that controls `#approach-prompt` and `#interaction`.

- [ ] **Step 8: Wire input, tutorials, mute, and document visibility**

Replace the existing key, click, and mouse listener block with:

```js
function unlockAudio() {
  audio.unlock();
}

addEventListener('keydown', (event) => {
  unlockAudio();
  setKey(event, true);
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) tutorial.complete('move');
  if ((event.code === 'ShiftLeft' || event.code === 'ShiftRight') && !event.repeat) {
    tutorial.complete('sprint');
  }
  if (event.code === 'KeyC' && !event.repeat) {
    tutorial.complete('camera');
    setCameraMode(cameraController.mode === 'third-person' ? 'first-person' : 'third-person');
  }
  if (event.code === 'KeyE' && !event.repeat && nearbyInteraction) {
    tutorial.complete('interact');
    storyDirector.interact(nearbyInteraction.kind);
    updateInteraction();
  }
});
addEventListener('keyup', (event) => setKey(event, false));
canvas.addEventListener('click', () => {
  unlockAudio();
  canvas.requestPointerLock?.();
});
addEventListener('mousemove', (event) => {
  if (document.pointerLockElement === canvas && (event.movementX || event.movementY)) {
    tutorial.complete('look');
    cameraController.rotate(event.movementX, event.movementY);
  }
});
addEventListener('resize', resize);
ui.onMute(() => {
  ui.setMuted(audio.toggleMuted());
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) audio.suspend();
  else audio.resume();
});
```

- [ ] **Step 9: Expose deterministic runtime hooks**

Extend `window.__RURAL_ESCAPE__`:

```js
get guidance() { return { ...guidanceSnapshot }; },
get danger() { return { ...dangerSnapshot }; },
audio,
completeTutorialForTest(action) {
  tutorial.complete(action);
},
refreshFeedbackForTest(dt = 1 / 60) {
  cameraController.update(dt);
  refreshFeedback(dt, (performance.now() - startTime) / 1000);
},
```

Update `setPlayerForTest` and `setStoryStateForTest` to call `refreshFeedbackForTest()` after changing state.

- [ ] **Step 10: Run full tests and build**

Run:

```powershell
npm test
npm run build
```

Expected: all unit and smoke tests pass; Vite build succeeds. The existing chunk-size advisory may remain but no new build error is allowed.

- [ ] **Step 11: Commit Task 5**

```powershell
git add -- rural-mutation-escape/src/main.js rural-mutation-escape/tests/smoke.mjs
git commit -m "feat: integrate guided escape feedback"
```

---

### Task 6: Browser Evidence, Responsive Verification, and Final Regression

**Files:**
- Modify: `rural-mutation-escape/tests/smoke.mjs`
- Create or replace: `rural-mutation-escape/artifacts/guidance-feedback/birth-guidance.png`
- Create or replace: `rural-mutation-escape/artifacts/guidance-feedback/interaction-guidance.png`
- Create or replace: `rural-mutation-escape/artifacts/guidance-feedback/pursuit-danger.png`

**Interfaces:**
- Consumes: the complete runtime from Task 5.
- Produces: deterministic evidence URLs and three final browser screenshots.
- Produces: passing unit, smoke, build, viewport, accessibility, and console-health evidence.

- [ ] **Step 1: Extend evidence cases with guidance and danger expectations**

For `birth`, `sighting`, `contact`, and `south-gate`, add these expected guidance fields:

```js
{
  id: 'birth',
  objective: 'leave_home',
  missionStep: '任务 1/4',
  missionTitle: '调查收音机',
  compassVisible: true,
  dangerMode: 'safe',
},
{
  id: 'sighting',
  objective: 'escape_south_gate',
  missionStep: '任务 4/4',
  missionTitle: '逃往南门',
  compassVisible: true,
  dangerMode: 'safe',
},
{
  id: 'contact',
  objective: 'escape_south_gate',
  missionStep: '任务 4/4',
  missionTitle: '逃往南门',
  compassVisible: true,
  dangerMode: 'threaten',
},
{
  id: 'south-gate',
  objective: 'complete',
  missionStep: '任务 4/4',
  missionTitle: '逃出雾村',
  compassVisible: false,
  dangerMode: 'safe',
},
```

- [ ] **Step 2: Add viewport collision checks**

At both 1280×720 and 1440×900, collect:

```js
const hudRects = await page.evaluate(() => Object.fromEntries(
  ['.mission-hud', '#objective-compass', '#interaction', '#tutorial-hint', '#mute-toggle']
    .map((selector) => {
      const element = document.querySelector(selector);
      return [selector, element.hidden ? null : element.getBoundingClientRect().toJSON()];
    }),
));
```

Assert every visible rectangle stays inside the viewport. Assert the mission card does not overlap the compass and the interaction prompt does not overlap the tutorial hint.

- [ ] **Step 3: Verify mute and reduced-motion states**

In smoke:

```js
await page.click('#mute-toggle');
const mutedState = await page.evaluate(() => ({
  pressed: document.querySelector('#mute-toggle').getAttribute('aria-pressed'),
  muted: window.__RURAL_ESCAPE__.audio.muted,
}));
if (mutedState.pressed !== 'true' || mutedState.muted !== true) {
  throw new Error('Expected mute control to update UI and audio state');
}
```

Create a second Playwright page with `{ reducedMotion: 'reduce' }`, open `?evidence=contact`, and assert:

```js
const reducedMotion = await reducedPage.evaluate(() => ({
  markerAnimation: getComputedStyle(document.querySelector('#screen-marker')).animationName,
  toastTransition: getComputedStyle(document.querySelector('#completion-toast')).transitionDuration,
}));
if (reducedMotion.markerAnimation !== 'none') {
  throw new Error('Expected reduced-motion marker animation to be disabled');
}
```

- [ ] **Step 4: Run automated verification**

Run:

```powershell
npm test
npm run build
git diff --check
```

Expected:

- all unit tests pass;
- smoke reports full guidance, traversal, story, pursuit, mute, and viewport success;
- Vite production build succeeds;
- `git diff --check` reports no whitespace errors.

- [ ] **Step 5: Verify the live game in the repository-approved in-app browser**

Use the canonical development URL `http://127.0.0.1:5175/` at 1280×720:

1. Confirm the initial task card shows `任务 1/4` and `调查收音机`.
2. Rotate away from the radio and verify the edge marker points back toward it.
3. Approach from 5 metres to 2.2 metres and verify prompt staging.
4. Complete the radio interaction and verify one completion toast plus transition to `任务 2/4`.
5. Open `?evidence=contact` and verify `近身威胁`, a visible but non-obscuring red edge, and a stable 2.4-metre pursuer distance.
6. Toggle mute and confirm the button and runtime state agree.
7. Inspect page error logs and require zero errors.

- [ ] **Step 6: Capture only the final evidence set**

Save three browser screenshots:

- `artifacts/guidance-feedback/birth-guidance.png`
- `artifacts/guidance-feedback/interaction-guidance.png`
- `artifacts/guidance-feedback/pursuit-danger.png`

Do not retain intermediate captures. Confirm each screenshot shows the state named by its filename.

- [ ] **Step 7: Commit Task 6**

```powershell
git add -- rural-mutation-escape/tests/smoke.mjs rural-mutation-escape/artifacts/guidance-feedback/birth-guidance.png rural-mutation-escape/artifacts/guidance-feedback/interaction-guidance.png rural-mutation-escape/artifacts/guidance-feedback/pursuit-danger.png
git commit -m "test: verify guided escape experience"
```

- [ ] **Step 8: Final completion audit**

Run:

```powershell
git status --short
git log -7 --oneline
```

Expected: only the pre-existing untracked `RESEARCH.md` and `rural-mutation-escape/artifacts/prologue-start.png` remain outside commits; the six implementation-task commits are present in order.
