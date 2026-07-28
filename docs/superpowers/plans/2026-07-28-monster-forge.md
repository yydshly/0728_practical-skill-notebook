# Monster Forge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an independently runnable 3D monster-asset review product with truthful procedural provenance, transparent catalog previews, live animation inspection, technical overlays, and honest fallback behavior.

**Architecture:** Monster definitions extend the shared asset manifest and resolve through a local procedural factory registry. A disposable Three.js inspector owns the live model, camera, overlays, and action state; the surrounding application owns selection, accessible controls, metadata, and static PNG fallbacks.

**Tech Stack:** Vite 8, TypeScript, Three.js, shared showcase packages, Vitest 4, Playwright 1.62.

## Global Constraints

- Work only under `mengto-skills-showcase/apps/monster-forge` and approved shared packages.
- Read `build-hybrid-game-assets`, `build-game-monster-system`, and `build-vesperfall-review-assets` before implementation.
- Use four project-authored procedural monsters and label them `procedural`; never claim imported GLB, FBX, textures, or animation clips exist.
- Catalog cards use 512×512 transparent PNG previews and no canvas.
- The selected inspector uses exactly one live Three.js canvas.
- Every monster exposes Idle, Walk, Attack, Hit, and Death review actions.
- Missing assets or WebGL show a readable static fallback.
- Support keyboard, pointer, touch, and reduced-motion behavior.
- Keep the application independently buildable and deployable.

---

## File Map

```text
apps/monster-forge/
├── index.html
├── package.json
├── vite.config.ts
├── playwright.config.ts
├── public/
│   └── asset-catalog/monsters/
│       ├── ash-warden.png
│       ├── glass-crawler.png
│       ├── bell-knight.png
│       └── mire-hound.png
├── scripts/
│   └── capture-catalog-previews.mjs
├── src/
│   ├── main.ts
│   ├── styles.css
│   ├── state/inspector-store.ts
│   ├── scene/create-inspector-scene.ts
│   ├── scene/create-overlays.ts
│   ├── ui/render-catalog.ts
│   ├── ui/render-inspector.ts
│   └── ui/render-fallback.ts
├── tests/
│   ├── inspector-store.test.ts
│   ├── fallback.test.ts
│   └── helpers/read-png-metadata.ts
└── tests/browser/
    ├── catalog.spec.ts
    ├── inspector.spec.ts
    ├── fallback.spec.ts
    └── mobile.spec.ts
packages/game-assets/
├── src/monsters/
│   ├── types.ts
│   ├── definitions.ts
│   └── create-procedural-monster.ts
└── tests/
    ├── monster-content.test.ts
    └── procedural-monster.test.ts
```

### Task 1: Define truthful monster content and inspector state

**Files:**
- Create: `packages/game-assets/src/monsters/types.ts`
- Create: `packages/game-assets/src/monsters/definitions.ts`
- Create: `apps/monster-forge/src/state/inspector-store.ts`
- Create: `packages/game-assets/tests/monster-content.test.ts`
- Create: `apps/monster-forge/tests/inspector-store.test.ts`
- Modify: `packages/content-schema/src/index.ts`
- Modify: `packages/game-assets/src/index.ts`

**Interfaces:**
- Consumes: `AssetManifest` from `@showcase/content-schema`.
- Produces: `MonsterDefinition`, `MonsterActionName`, `InspectorState`, and `createInspectorStore()`.

- [ ] **Step 1: Write failing content and state tests**

```ts
import { describe, expect, it } from "vitest";
import { monsters } from "../src/monsters/definitions";

describe("monster catalog", () => {
  it("contains four truthful procedural review assets", () => {
    expect(monsters.map((monster) => monster.id)).toEqual([
      "ash-warden",
      "glass-crawler",
      "bell-knight",
      "mire-hound",
    ]);
    for (const monster of monsters) {
      expect(monster.source.type).toBe("procedural");
      expect(monster.source.description).toContain("Project-authored Three.js geometry");
      expect(monster.previewPath).toBe(`/asset-catalog/monsters/${monster.id}.png`);
      expect(monster.actions).toEqual(["Idle", "Walk", "Attack", "Hit", "Death"]);
    }
  });
});
```

```ts
import { expect, it } from "vitest";
import { createInspectorStore } from "../src/state/inspector-store";

it("resets an unavailable action when selection changes", () => {
  const store = createInspectorStore("ash-warden");
  store.setAction("Attack");
  store.select("glass-crawler");
  expect(store.getState()).toMatchObject({
    selectedId: "glass-crawler",
    action: "Idle",
    overlays: { skeleton: false, colliders: false, sockets: false },
  });
});
```

- [ ] **Step 2: Run focused tests and verify missing modules**

```powershell
npm test --workspace @showcase/game-assets -- monster-content
npm test --workspace @showcase/monster-forge -- inspector-store
```

Expected: FAIL because the app source modules do not exist.

- [ ] **Step 3: Add the monster interfaces**

```ts
export type MonsterActionName = "Idle" | "Walk" | "Attack" | "Hit" | "Death";

export interface MonsterDefinition extends AssetManifest {
  kind: "monster";
  factoryId: "biped" | "crawler" | "armored" | "quadruped";
  actions: readonly MonsterActionName[];
  collider: { radius: number; height: number };
  palette: { primary: number; secondary: number; emissive: number };
  review: { contactPoints: readonly string[]; notes: string };
}

export interface InspectorState {
  selectedId: string;
  action: MonsterActionName;
  paused: boolean;
  overlays: { skeleton: boolean; colliders: boolean; sockets: boolean };
}
```

Define the store with `getState()`, `select(id)`, `setAction(action)`, `setPaused(paused)`, `toggleOverlay(name)`, and `subscribe(listener)`. Return immutable state snapshots.

- [ ] **Step 4: Add the four monster definitions**

Use these identities and factory mappings:

| ID | Display name | Factory | Readable silhouette |
| --- | --- | --- | --- |
| `ash-warden` | Ash Warden | `biped` | tall staff-bearing caster |
| `glass-crawler` | Glass Crawler | `crawler` | low six-legged crystal creature |
| `bell-knight` | Bell Knight | `armored` | broad armored humanoid with bell helm |
| `mire-hound` | Mire Hound | `quadruped` | long-backed four-legged hunter |

Every definition includes non-zero measured bounds, a collider, at least one named socket, the five actions, and a source description beginning `Project-authored Three.js geometry`.

- [ ] **Step 5: Run tests and commit the content contract**

```powershell
npm test --workspace @showcase/monster-forge -- monster-content inspector-store
git add mengto-skills-showcase/packages/game-assets/src/monsters mengto-skills-showcase/packages/game-assets/src/index.ts mengto-skills-showcase/packages/game-assets/tests/monster-content.test.ts mengto-skills-showcase/apps/monster-forge/src/state mengto-skills-showcase/apps/monster-forge/tests/inspector-store.test.ts
git commit -m "feat: define Monster Forge catalog"
```

Expected: focused tests PASS.

### Task 2: Build disposable procedural monsters and deterministic actions

**Files:**
- Create: `packages/game-assets/src/monsters/create-procedural-monster.ts`
- Create: `packages/game-assets/tests/procedural-monster.test.ts`
- Modify: `packages/game-assets/src/index.ts`
- Modify: `packages/three-runtime/src/index.ts`

**Interfaces:**
- Consumes: `MonsterDefinition`.
- Produces: `createProceduralMonster(definition): MonsterInstance`.
- Produces: `MonsterInstance` with `root`, `sockets`, `collider`, `playAction`, `setPaused`, `update`, and `dispose`.

- [ ] **Step 1: Write the failing procedural-instance test**

```ts
import { expect, it } from "vitest";
import { monsters } from "../src/monsters/definitions";
import { createProceduralMonster } from "../src/monsters/create-procedural-monster";

it("creates named sockets and deterministic review actions", () => {
  const instance = createProceduralMonster(monsters[0]);
  expect(instance.root.userData.provenance).toMatchObject({
    type: "procedural",
    factoryId: "biped",
  });
  expect([...instance.sockets.keys()]).toContain("right-hand");
  instance.playAction("Attack");
  instance.update(0.25);
  expect(instance.getActionState()).toMatchObject({ name: "Attack", elapsed: 0.25 });
  instance.dispose();
  expect(instance.isDisposed()).toBe(true);
});
```

- [ ] **Step 2: Run the test and verify the factory is absent**

```powershell
npm test --workspace @showcase/game-assets -- procedural-monster
```

Expected: FAIL because `create-procedural-monster.ts` does not exist.

- [ ] **Step 3: Implement four geometry recipes behind one public factory**

Create focused private builders `buildBiped`, `buildCrawler`, `buildArmored`, and `buildQuadruped`. Each builder:

- creates a `THREE.Group` root;
- uses named joint groups such as `hips`, `spine`, `head`, and limbs;
- creates `Object3D` sockets declared by the definition;
- uses no external model or texture URL;
- writes truthful source and action metadata to `root.userData`;
- registers every geometry and material with a `DisposableScope`.

The public instance uses a fixed action-duration table:

```ts
const ACTION_DURATION = {
  Idle: 2,
  Walk: 1,
  Attack: 0.8,
  Hit: 0.45,
  Death: 1.4,
} satisfies Record<MonsterActionName, number>;
```

`update(deltaSeconds)` clamps delta to `0.05`, advances elapsed time, and evaluates joint transforms from normalized action progress. `Death` holds its final pose; other actions loop only when their semantic action is Idle or Walk.

- [ ] **Step 4: Run deterministic tests and verify disposal**

```powershell
npm test --workspace @showcase/game-assets -- procedural-monster
npm test --workspace @showcase/three-runtime
```

Expected: action timing, socket names, provenance, and single disposal PASS.

- [ ] **Step 5: Commit the procedural monster system**

```powershell
git add mengto-skills-showcase/packages/game-assets/src/monsters mengto-skills-showcase/packages/game-assets/src/index.ts mengto-skills-showcase/packages/game-assets/tests/procedural-monster.test.ts mengto-skills-showcase/packages/three-runtime
git commit -m "feat: add procedural monster review models"
```

### Task 3: Build the live inspector and catalog shell

**Files:**
- Create: `apps/monster-forge/index.html`
- Create: `apps/monster-forge/vite.config.ts`
- Create: `apps/monster-forge/playwright.config.ts`
- Create: `apps/monster-forge/package.json`
- Create: `apps/monster-forge/src/main.ts`
- Create: `apps/monster-forge/src/styles.css`
- Create: `apps/monster-forge/src/scene/create-inspector-scene.ts`
- Create: `apps/monster-forge/src/ui/render-catalog.ts`
- Create: `apps/monster-forge/src/ui/render-inspector.ts`
- Create: `apps/monster-forge/tests/browser/catalog.spec.ts`
- Create: `apps/monster-forge/tests/browser/inspector.spec.ts`

**Interfaces:**
- Consumes: monster definitions, inspector store, procedural factory, and shared Three.js lifecycle.
- Produces: `createInspectorScene(canvas, options): InspectorScene`.
- Produces: one catalog with PNG cards and one selected live canvas.

- [ ] **Step 1: Write failing browser journeys**

```ts
import { expect, test } from "@playwright/test";

test("catalog cards use images and the inspector owns one canvas", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Monster Forge" })).toBeVisible();
  await expect(page.locator("[data-monster-card]")).toHaveCount(4);
  await expect(page.locator("[data-monster-card] canvas")).toHaveCount(0);
  await expect(page.locator("[data-inspector] canvas")).toHaveCount(1);
});

test("selection replaces the live model without adding canvases", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Glass Crawler/ }).click();
  await expect(page.getByRole("heading", { name: "Glass Crawler" })).toBeVisible();
  await expect(page.locator("[data-inspector] canvas")).toHaveCount(1);
});
```

- [ ] **Step 2: Run Playwright and confirm the app is unavailable**

```powershell
npm run test:browser --workspace @showcase/monster-forge -- catalog inspector
```

Expected: FAIL because the Vite application is not implemented.

- [ ] **Step 3: Implement the application shell and catalog**

Add the direct renderer dependency:

```powershell
npm install three --workspace @showcase/monster-forge
```

The app manifest defines:

```json
{
  "name": "@showcase/monster-forge",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1 --port 4173",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "test:browser": "playwright test"
  }
}
```

`playwright.config.ts` starts this exact dev command, uses `http://127.0.0.1:4173`, and fails on browser console errors collected by each test fixture.

The page uses:

- a top title and concise product description;
- a four-card catalog using `<img>` elements only;
- a selected inspector with one canvas;
- action controls and technical overlay controls;
- a metadata panel;
- an `aria-live="polite"` status region.

Each card is a real `<button>` with selected state, image alt text, display name, procedural format label, and animation count.

- [ ] **Step 4: Implement the live scene**

`createInspectorScene` must:

- create one renderer for the provided canvas;
- use a measured-bounds camera fit;
- ground from `bounds.groundOffset`;
- provide drag rotation and wheel/pinch zoom;
- use a neutral three-light setup and visible ground grid;
- replace the model by disposing the previous instance;
- stop its animation frame and dispose renderer resources on `dispose()`.

- [ ] **Step 5: Run browser journeys and commit the shell**

```powershell
npm run test:browser --workspace @showcase/monster-forge -- catalog inspector
npm run build --workspace @showcase/monster-forge
git add mengto-skills-showcase/apps/monster-forge
git commit -m "feat: build Monster Forge inspector"
```

Expected: both browser journeys PASS and production build succeeds.

### Task 4: Add action controls, technical overlays, and provenance

**Files:**
- Create: `apps/monster-forge/src/scene/create-overlays.ts`
- Modify: `apps/monster-forge/src/scene/create-inspector-scene.ts`
- Modify: `apps/monster-forge/src/ui/render-inspector.ts`
- Create: `apps/monster-forge/tests/browser/inspector-actions.spec.ts`
- Modify: `packages/game-assets/tests/procedural-monster.test.ts`

**Interfaces:**
- Produces: `createReviewOverlays(instance): ReviewOverlays`.
- Consumes: current `MonsterInstance`, action state, sockets, and collider.

- [ ] **Step 1: Write failing overlay and action journeys**

```ts
test("reviewer can play, pause, restart, and inspect overlays", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Attack" }).click();
  await expect(page.locator("[data-action-status]")).toContainText("Attack");
  await page.getByRole("button", { name: "Pause animation" }).click();
  await expect(page.locator("[data-action-status]")).toContainText("Paused");
  await page.getByLabel("Show sockets").check();
  await expect(page.locator("[data-overlay-status]")).toContainText("Sockets visible");
  await page.getByRole("button", { name: "Restart animation" }).click();
});
```

- [ ] **Step 2: Run the journey and confirm missing controls**

```powershell
npm run test:browser --workspace @showcase/monster-forge -- inspector-actions
```

Expected: FAIL because review controls and overlay status do not exist.

- [ ] **Step 3: Implement disposable review overlays**

`createReviewOverlays(instance)` creates:

- a `THREE.SkeletonHelper`-equivalent line hierarchy for named procedural joints;
- a translucent cylinder representing the declared collider;
- labeled sprite or CSS2D markers for sockets;
- independent `setVisible("skeleton" | "colliders" | "sockets", value)`;
- `dispose()` that removes nodes and releases overlay materials and textures.

- [ ] **Step 4: Connect controls and truthful metadata**

The inspector must expose:

- one button per action;
- pause/play and restart;
- skeleton, collider, and socket checkboxes;
- source type `Runtime procedural`;
- exact factory ID;
- action count;
- socket names;
- dimensions and grounding offset;
- the statement `No imported GLB/FBX is used for this asset`.

- [ ] **Step 5: Verify and commit review behavior**

```powershell
npm test --workspace @showcase/monster-forge
npm run test:browser --workspace @showcase/monster-forge -- inspector-actions
git add mengto-skills-showcase/apps/monster-forge
git commit -m "feat: add Monster Forge review controls"
```

### Task 5: Generate transparent catalog previews and add honest fallbacks

**Files:**
- Create: `apps/monster-forge/scripts/capture-catalog-previews.mjs`
- Create: `apps/monster-forge/public/asset-catalog/monsters/*.png`
- Create: `apps/monster-forge/src/ui/render-fallback.ts`
- Create: `apps/monster-forge/tests/fallback.test.ts`
- Create: `apps/monster-forge/tests/helpers/read-png-metadata.ts`
- Create: `apps/monster-forge/tests/browser/fallback.spec.ts`
- Create: `apps/monster-forge/tests/browser/mobile.spec.ts`

**Interfaces:**
- Consumes: deterministic `?review=<id>&capture=1` review route.
- Produces: four 512×512 RGBA PNG files.
- Produces: `renderFallback(container, definition, reason)`.
- Produces: `readPngMetadata(path)` for exact RGBA and transparent-corner verification.

- [ ] **Step 1: Write failing PNG and fallback tests**

Install the PNG parser used by the verification helper:

```powershell
npm install -D pngjs @types/pngjs --workspace @showcase/monster-forge
```

```ts
import { readPngMetadata } from "./helpers/read-png-metadata";

it.each(monsters)("has a 512x512 transparent catalog preview for $id", async ({ previewPath }) => {
  const metadata = await readPngMetadata(`public${previewPath}`);
  expect(metadata).toMatchObject({ width: 512, height: 512, colorType: "RGBA" });
  expect(metadata.hasTransparentCorner).toBe(true);
});
```

```ts
// tests/helpers/read-png-metadata.ts
import { readFile } from "node:fs/promises";
import { PNG } from "pngjs";

export async function readPngMetadata(path: string) {
  const png = PNG.sync.read(await readFile(path));
  const alphaAt = (x: number, y: number) => png.data[(png.width * y + x) * 4 + 3];
  return {
    width: png.width,
    height: png.height,
    colorType: png.colorType === 6 ? "RGBA" : `color-type-${png.colorType}`,
    hasTransparentCorner: [
      alphaAt(0, 0),
      alphaAt(png.width - 1, 0),
      alphaAt(0, png.height - 1),
      alphaAt(png.width - 1, png.height - 1),
    ].some((alpha) => alpha === 0),
  };
}
```

```ts
test("WebGL failure retains the selected asset information", async ({ page }) => {
  await page.goto("/?forceWebglFailure=1");
  await expect(page.getByRole("img", { name: /Ash Warden/ })).toBeVisible();
  await expect(page.getByText("3D preview unavailable")).toBeVisible();
  await expect(page.getByText("Runtime procedural")).toBeVisible();
});
```

- [ ] **Step 2: Run tests and confirm previews and fallback are missing**

```powershell
npm test --workspace @showcase/monster-forge -- fallback
npm run test:browser --workspace @showcase/monster-forge -- fallback
```

Expected: FAIL for missing PNGs and fallback state.

- [ ] **Step 3: Add deterministic capture mode and preview script**

Capture mode:

- fixes the camera, action, animation time, and lighting;
- hides UI and uses transparent renderer background;
- signals readiness through `document.documentElement.dataset.captureReady = "true"`;
- supports one monster ID at a time.

The Playwright-based script loops through all four IDs, uses `omitBackground: true`, captures the 512×512 canvas bounds, and writes each approved PNG path. Run it only after visual inspection of all four outputs.

- [ ] **Step 4: Implement fallback and mobile layouts**

Fallback displays:

- the same transparent PNG;
- asset name, source type, dimensions, and available actions;
- the specific reason: WebGL unavailable, renderer initialization failed, or model creation failed;
- a retry button that creates no duplicate canvas.

At 390×844, catalog and inspector remain usable, controls have at least 44×44 CSS-pixel targets, the inspector fits above metadata, and drag gestures do not scroll the page while interacting with the canvas.

- [ ] **Step 5: Generate, inspect, and verify previews**

```powershell
npm run dev --workspace @showcase/monster-forge
node apps/monster-forge/scripts/capture-catalog-previews.mjs
npm test --workspace @showcase/monster-forge
npm run test:browser --workspace @showcase/monster-forge -- fallback mobile
```

Expected: four approved transparent previews and all fallback/mobile tests PASS.

- [ ] **Step 6: Commit catalog media and fallback behavior**

```powershell
git add mengto-skills-showcase/apps/monster-forge/public mengto-skills-showcase/apps/monster-forge/scripts mengto-skills-showcase/apps/monster-forge/src/ui/render-fallback.ts mengto-skills-showcase/apps/monster-forge/tests
git commit -m "feat: add Monster Forge catalog previews"
```

### Task 6: Complete performance, accessibility, and release evidence

**Files:**
- Create: `apps/monster-forge/docs/VALIDATION.md`
- Modify: `apps/monster-forge/tests/browser/inspector.spec.ts`
- Modify: `apps/monster-forge/tests/browser/mobile.spec.ts`
- Modify: `mengto-skills-showcase/README.md`

**Interfaces:**
- Consumes: completed Monster Forge app.
- Produces: browser, accessibility, bundle, console, and resource-cleanup evidence.

- [ ] **Step 1: Add browser assertions for reduced motion and disposal**

The tests must:

- switch through all four monsters 20 times;
- assert one canvas remains;
- assert renderer animation continues without console errors;
- emulate reduced motion and confirm non-essential camera easing is disabled;
- tab through every card and control in logical order;
- verify selected state and status announcements.

- [ ] **Step 2: Run the full product verification**

```powershell
npm test --workspace @showcase/monster-forge
npm run test:browser --workspace @showcase/monster-forge
npm run build --workspace @showcase/monster-forge
git diff --check
```

Expected: all commands PASS with no browser console errors.

- [ ] **Step 3: Record evidence and update the suite README**

`apps/monster-forge/docs/VALIDATION.md` records:

- exact commit SHA tested;
- four PNG paths, dimensions, and alpha status;
- procedural factory names and source classification;
- review route and five actions;
- desktop and 390×844 mobile journeys;
- reduced-motion result;
- production bundle sizes;
- known limitations limited to the approved non-goals.

The suite README marks Monster Forge runnable and links its validation document.

- [ ] **Step 4: Commit the validated product**

```powershell
git add mengto-skills-showcase/apps/monster-forge/docs/VALIDATION.md mengto-skills-showcase/apps/monster-forge/tests/browser mengto-skills-showcase/README.md
git commit -m "docs: validate Monster Forge"
```

## Monster Forge Completion Gate

- Four PNG catalog cards render without card canvases.
- The selected inspector has exactly one live canvas.
- Every monster exposes five deterministic actions.
- Skeleton, collider, and socket overlays are independently controllable.
- Provenance states that the models are project-authored procedural geometry.
- WebGL and model failure states retain readable content.
- Desktop, mobile, keyboard, touch, and reduced-motion journeys pass.
- Repeated model switching does not add canvases or leak tracked resources.
- The production build and validation record are complete.
