# Rural Mutation Escape Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-playable third-person rural mutation escape prologue with camera switching, story triggers, one pursuer, and an exit sequence.

**Architecture:** A standalone Vite + Three.js project owns authored level data, runtime state, and rendering separately. `main.js` composes a flat world, player controller, camera controller, trigger director, and pursuer AI through small event-style callbacks; all narrative progression uses stable zone IDs.

**Tech Stack:** Vite, JavaScript modules, Three.js, Playwright browser smoke test.

## Global Constraints

- Create only original procedural geometry and original text/audio cues; do not reuse copyrighted game assets.
- Keep gameplay, navigation, collision, encounters, objectives, and exits on a single plane.
- Default to third-person; `C` switches camera mode without changing player state.
- Every local light has a visible in-world source.
- `npm run build` and browser smoke test must pass before claiming a milestone.

---

### Task 1: Standalone project and title sequence

**Files:**
- Create: `package.json`, `index.html`, `src/main.js`, `src/style.css`
- Create: `tests/smoke.mjs`

**Interfaces:**
- Produces `window.__RURAL_ESCAPE__` with `{ state, restart(), setCameraMode(mode) }` for browser validation.

- [ ] Write a smoke test that opens the app and expects the title `雾村：逃离` plus `window.__RURAL_ESCAPE__`.
- [ ] Run the test before implementation and observe the missing-app failure.
- [ ] Create the Vite entry page, game canvas, objective HUD, subtitles, and the public debug handle.
- [ ] Run `npm run build` and the smoke test; both must pass.

### Task 2: Whitebox village, player, and camera modes

**Files:**
- Create: `src/level.js`, `src/player.js`, `src/camera.js`
- Modify: `src/main.js`, `src/style.css`
- Modify: `tests/smoke.mjs`

**Interfaces:**
- `createVillage(scene)` returns `{ anchors, zones, colliders, navNodes }`.
- `createPlayer(scene, spawn)` returns `{ object, update(dt,input), position }`.
- `createCameraController(camera, player)` returns `{ update(dt), toggle(), mode }`.

- [ ] Add a browser test that holds `W` and asserts the player position changes without leaving level bounds.
- [ ] Create the five named areas as flat whitebox geometry with visible landmarks and colliders.
- [ ] Add third-person follow camera, first-person observation camera, `C` toggle, pitch clamps, and obstruction pull-in.
- [ ] Run build and browser test; capture the start area in both camera modes.

### Task 3: Story triggers, residents, and interactions

**Files:**
- Create: `src/story.js`, `src/characters.js`
- Modify: `src/level.js`, `src/main.js`, `src/style.css`
- Modify: `tests/smoke.mjs`

**Interfaces:**
- `createStoryDirector({ player, zones, anchors, ui })` exposes `update()` and `interact()`.
- `createResident(scene, anchor, id)` returns a visible NPC object.

- [ ] Write a test that calls the radio interaction and expects objective state `visit_courtyard`.
- [ ] Add radio, neighbour, flashlight, and gate interactions using zone IDs and subtitle text.
- [ ] Add distinct stylized resident poses and three environmental narrative cues.
- [ ] Verify the story cannot advance to the gate before the required events have occurred.

### Task 4: Mutated villager and failure/retry loop

**Files:**
- Create: `src/pursuer.js`
- Modify: `src/characters.js`, `src/story.js`, `src/main.js`, `tests/smoke.mjs`

**Interfaces:**
- `createPursuer(scene, { navNodes, spawn })` returns `{ object, update(dt, player, safeZones), reset() }`.
- It reports one state from `patrol`, `alert`, `chase`, `lost`.

- [ ] Write a test that moves the debug player within detection range and expects pursuer state `chase`.
- [ ] Implement flat-node patrol, line-of-sight/distance detection, chase movement, and safe-zone loss of target.
- [ ] Add player-contact failure overlay and `R` restart from the courtyard checkpoint.
- [ ] Verify pursuer never leaves the nav-node graph or crosses solid structures.

### Task 5: Escape finale, visual pass, and verification

**Files:**
- Modify: `src/level.js`, `src/story.js`, `src/main.js`, `src/style.css`, `tests/smoke.mjs`
- Create: `tools/capture.mjs`

**Interfaces:**
- `story.state` completes only when gate prerequisites are fulfilled and player enters `south_gate_exit`.

- [ ] Write a test that satisfies required story flags, enters the exit zone, and expects state `complete`.
- [ ] Add gate-opening trigger, pursuit escalation, exit scene, and restartable completion card.
- [ ] Add motivated dusk lighting, flashlight cone, fog, original material variation, and camera shake as temporary modifiers.
- [ ] Capture start, first-sighting, and exit screenshots; run build and full browser test suite.
