# Isle of Quiet Signals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-quality, reversible 2.5D cinematic lighthouse microsite whose local scroll timeline ends in a fully accessible interactive route archive.

**Architecture:** A semantic single-page document hosts one sticky cinematic stage. Small ES modules isolate scene data, timeline math, asset readiness, stage rendering, navigation, and route-archive interaction; JavaScript writes a limited set of CSS custom properties while CSS owns composition and animation. Generated raster layers share one master composition, and Vitest plus Playwright cover deterministic math, component behavior, target viewports, reduced motion, and browser errors.

**Tech Stack:** Vanilla HTML, CSS, and ES modules; Vite as the development/build tool; Vitest with jsdom for unit/component tests; Playwright for browser verification; generated WebP/PNG raster assets with CSS-native grade, grain, and vignette.

## Global Constraints

- Use the project directory `isle-of-quiet-signals`.
- Use Chinese as the primary language; English appears only in the brand mark, chapter numbers, and brief directional labels.
- Do not add GSAP, Lenis, Three.js, a frontend framework, or any runtime animation dependency.
- Keep every visible navigation item and button functional.
- Derive all animated scene state from local scroll progress `p ∈ [0, 1]`; reverse scrolling must reproduce the exact reverse state.
- Target `1440×900`, `1280×720`, `1024×768`, `768×1024`, and `390×844`.
- `prefers-reduced-motion: reduce` must show a static hero followed by normal-flow narrative and archive content with all controls usable.
- Do not bake text into generated images.
- Do not expose empty canvas edges during scale or parallax.
- Do not preload route-card images; only the opening scene layers are critical.
- Keep the page usable when an image fails to load.
- Keep the browser console free of errors and prevent horizontal page overflow.
- Commit after every independently testable task.

---

## File Structure

```text
isle-of-quiet-signals/
  index.html
  package.json
  package-lock.json
  vite.config.js
  src/
    main.js                  # App bootstrap and cross-module lifecycle
    scene-config.js          # Copy, timeline ranges, layers, navigation, routes
    timeline.js              # Pure interpolation helpers
    stage.js                 # Local scroll measurement, RAF state, CSS variables
    assets.js                # Critical decode barrier, lazy loading, fallbacks
    navigation.js            # Timeline-aware page-header navigation
    route-archive.js         # Buttons, drag, touch, keyboard, live status
    styles.css               # Tokens, composition, motion, responsive/reduced modes
  public/
    assets/
      originals/
        lighthouse-master.png
      scene/
        00-sky.webp
        10-distant-island.webp
        20-sea-midground.webp
        30-lighthouse.webp
        40-foreground-left.webp
        41-foreground-right.webp
        50-edge-frame.webp
      routes/
        tidal-garden.webp
        echo-bay.webp
        keeper-house.webp
        north-wind-path.webp
      asset-manifest.json
  scripts/
    validate-assets.mjs      # Dimensions, formats, required roles, file sizes
  tests/
    timeline.test.js
    scene-config.test.js
    assets.test.js
    route-archive.test.js
    navigation.test.js
    browser/
      cinematic.spec.js
      reduced-motion.spec.js
      archive.spec.js
  docs/
    ASSETS.md
    TIMELINE.md
    VALIDATION.md
    superpowers/
      specs/2026-07-28-isle-of-quiet-signals-design.md
      plans/2026-07-28-isle-of-quiet-signals.md
  README.md
```

---

### Task 1: Establish the runnable semantic foundation

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `index.html`
- Create: `src/main.js`
- Create: `src/scene-config.js`
- Create: `src/styles.css`
- Create: `tests/scene-config.test.js`
- Create: `.gitignore`

**Interfaces:**
- Produces: `SCENE`, `NAV_POINTS`, and `ROUTES` named exports from `src/scene-config.js`.
- Produces: `initApp(documentRef = document): Promise<AppController>` from `src/main.js`.
- Consumes: no earlier implementation files.

- [ ] **Step 1: Initialize npm metadata and install development-only tools**

Run:

```powershell
npm init -y
npm install --save-dev vite vitest jsdom @playwright/test
npx playwright install chromium
```

Expected: `package.json` and `package-lock.json` exist; installation exits with code 0.

- [ ] **Step 2: Replace package scripts and add a narrow Vite configuration**

Use these scripts in `package.json`:

```json
{
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:browser": "playwright test",
    "validate:assets": "node scripts/validate-assets.mjs"
  }
}
```

Create `vite.config.js`:

```js
import { defineConfig } from "vite";

export default defineConfig({
  server: { host: "127.0.0.1", port: 4173, strictPort: true },
  preview: { host: "127.0.0.1", port: 4173, strictPort: true },
  test: { environment: "jsdom", setupFiles: [] },
});
```

- [ ] **Step 3: Write the failing scene-data test**

Create `tests/scene-config.test.js`:

```js
import { describe, expect, it } from "vitest";
import { NAV_POINTS, ROUTES, SCENE } from "../src/scene-config.js";

describe("scene configuration", () => {
  it("keeps timeline ranges ordered and inside zero to one", () => {
    const ranges = Object.values(SCENE.ranges);
    for (const range of ranges) {
      expect(range.start).toBeGreaterThanOrEqual(0);
      expect(range.end).toBeLessThanOrEqual(1);
      expect(range.end).toBeGreaterThan(range.start);
    }
    expect(ranges.map(({ start }) => start)).toEqual(
      [...ranges].map(({ start }) => start).sort((a, b) => a - b),
    );
  });

  it("exposes real navigation targets and four route records", () => {
    expect(NAV_POINTS.map(({ id }) => id)).toEqual(["lighthouse", "signal", "routes"]);
    expect(NAV_POINTS.every(({ progress }) => progress >= 0 && progress <= 1)).toBe(true);
    expect(ROUTES).toHaveLength(4);
    expect(new Set(ROUTES.map(({ id }) => id)).size).toBe(4);
  });
});
```

- [ ] **Step 4: Run the scene-data test and verify failure**

Run:

```powershell
npx vitest run tests/scene-config.test.js
```

Expected: FAIL because `src/scene-config.js` does not exist.

- [ ] **Step 5: Implement the scene data**

Create `src/scene-config.js` with:

```js
export const SCENE = Object.freeze({
  scrollLength: 4400,
  ranges: Object.freeze({
    intro: { start: 0.03, end: 0.18 },
    opening: { start: 0.15, end: 0.25 },
    storyA: { start: 0.25, end: 0.44 },
    panorama: { start: 0.44, end: 0.48 },
    storyB: { start: 0.48, end: 0.69 },
    refocus: { start: 0.69, end: 0.76 },
    archive: { start: 0.75, end: 0.96 },
    controls: { start: 0.91, end: 1 },
  }),
});

export const NAV_POINTS = Object.freeze([
  { id: "lighthouse", label: "灯塔", progress: 0 },
  { id: "signal", label: "信号", progress: 0.5 },
  { id: "routes", label: "航线", progress: 1 },
]);

export const ROUTES = Object.freeze([
  { id: "tidal-garden", index: "01", title: "潮汐花园", subtitle: "退潮后，海面留下自己的花园。", image: "/assets/routes/tidal-garden.webp", detail: "浅水石池收集着海藻、贝壳与一整夜的星光。" },
  { id: "echo-bay", index: "02", title: "回声湾", subtitle: "浪声总会晚半拍归来。", image: "/assets/routes/echo-bay.webp", detail: "海蚀洞把每一次潮涌折返成更低沉的回响。" },
  { id: "keeper-house", index: "03", title: "守灯人居所", subtitle: "时间在盐蚀的木窗上留下刻度。", image: "/assets/routes/keeper-house.webp", detail: "工具、日志与旧制服仍按最后一次值守的顺序陈列。" },
  { id: "north-wind-path", index: "04", title: "北侧风径", subtitle: "沿草坡去岛上最高的地方。", image: "/assets/routes/north-wind-path.webp", detail: "风径尽头可以同时看见灯塔、外海与归港的白线。" },
]);
```

- [ ] **Step 6: Build the semantic HTML skeleton**

Create `index.html` with one `main`, one `.cinematic-scroll`, a `.cinematic-stage`, persistent header navigation, layered `.world`, intro article, two narrative articles, and the route archive. Use the exact approved copy from the design spec. Give each scene image explicit `width`, `height`, `decoding`, and appropriate `alt`; use empty `alt` for decorative layers. Create buttons with `type="button"` and no nonfunctional links.

Required selectors:

```text
#cinematic-scroll
#cinematic-stage
#site-nav
[data-layer]
#intro
#story-a
#story-b
#route-archive
#route-track
#route-prev
#route-next
#route-status
```

- [ ] **Step 7: Add base tokens, structural layout, and a no-image fallback composition**

In `src/styles.css`, define exact custom properties for paper, ink, background, fog, amber, spacing, radii, shadows, and type scale. Establish:

```css
.cinematic-scroll { position: relative; min-height: var(--scroll-length, 4400px); }
.cinematic-stage {
  position: sticky;
  top: 0;
  min-height: 100vh;
  min-height: 100svh;
  overflow: clip;
  isolation: isolate;
}
```

Use a solid deep-blue world background so missing images never reveal white. Add z-index bands from the design spec and a visible `:focus-visible` treatment.

- [ ] **Step 8: Add the bootstrap entry**

Create `src/main.js`:

```js
import "./styles.css";
import { NAV_POINTS, ROUTES } from "./scene-config.js";

export async function initApp(documentRef = document) {
  const root = documentRef.documentElement;
  root.style.setProperty("--scroll-length", "4400px");
  return { navPoints: NAV_POINTS, routes: ROUTES };
}

if (typeof document !== "undefined") {
  initApp(document);
}
```

Add `<script type="module" src="/src/main.js"></script>` to `index.html`.

- [ ] **Step 9: Run unit tests and production build**

Run:

```powershell
npm test
npm run build
```

Expected: all tests PASS and Vite creates `dist/` without warnings about missing entry files.

- [ ] **Step 10: Commit the foundation**

Run:

```powershell
git add .gitignore package.json package-lock.json vite.config.js index.html src tests/scene-config.test.js
git commit -m "feat: establish cinematic site foundation"
```

---

### Task 2: Generate, optimize, and validate the layered art system

**Files:**
- Create: `public/assets/originals/lighthouse-master.png`
- Create: `public/assets/scene/00-sky.webp`
- Create: `public/assets/scene/10-distant-island.webp`
- Create: `public/assets/scene/20-sea-midground.webp`
- Create: `public/assets/scene/30-lighthouse.webp`
- Create: `public/assets/scene/40-foreground-left.webp`
- Create: `public/assets/scene/41-foreground-right.webp`
- Create: `public/assets/scene/50-edge-frame.webp`
- Create: `public/assets/routes/*.webp`
- Create: `public/assets/asset-manifest.json`
- Create: `scripts/validate-assets.mjs`
- Create: `tests/assets.test.js`
- Modify: `index.html`
- Modify: `src/styles.css`

**Interfaces:**
- Produces: asset files referenced by `index.html` and `ROUTES`.
- Produces: `validateManifest(manifest)` from `scripts/validate-assets.mjs`.
- Consumes: route IDs and image paths from `ROUTES`.

- [ ] **Step 1: Generate the unified master composition**

Use the image-generation skill with this exact prompt:

```text
Create a cinematic editorial matte-painting master plate for a fictional remote island lighthouse named “Isle of Quiet Signals”. 16:9 landscape, 3840×2160 target composition. Camera is low on the shore, looking through two dark near-field basalt rock masses toward a weathered white lighthouse on a small island, slightly right of center. A calm steel-blue sea fills the lower third, distant island silhouette and horizon align across the frame, low coastal mist, late blue hour, a single restrained warm amber lighthouse beam, subtle analog grain, realistic photographic light, premium travel editorial, quiet and melancholic. The left and right foreground rocks must visibly frame the scene and have generous bleed outside the frame. Keep the lighthouse fully readable at mobile crops. No people, no boats, no signs, no typography, no logos, no UI, no decorative gradients, no fantasy neon.
```

Save the approved full-resolution result as `public/assets/originals/lighthouse-master.png`.

- [ ] **Step 2: Derive seven aligned scene layers from the master**

For each edit, use the master as the only reference, preserve the exact camera, horizon, lighting, and object positions, remove all unrequested objects, and use a perfectly flat chroma-key green background (`#00FF00`) for every non-opaque layer. Remove that color locally with the built-in image-generation skill's chroma-key helper and inspect the result before choosing WebP or PNG:

```text
00-sky: opaque sky and far sea color field only; remove islands, lighthouse, rocks, buildings, and text.
10-distant-island: distant island silhouette and horizon haze only on transparent background; keep full 16:9 canvas and exact horizon.
20-sea-midground: sea surface and middle-distance island base only on transparent background; preserve bottom-center anchor and 15% bleed.
30-lighthouse: lighthouse, keeper house, and their immediate island ground only on transparent background; preserve full canvas and bottom-center anchor.
40-foreground-left: left near-field basalt rock mass only on transparent background; preserve left/bottom anchor and 20% bleed.
41-foreground-right: right near-field basalt rock mass only on transparent background; preserve right/bottom anchor and 20% bleed.
50-edge-frame: sparse nearest grass and dark rock edge accents only on transparent background; no continuous opaque border.
```

Inspect every layer at full resolution for white/black alpha fringes, residual green, mismatched horizon, accidental text, and insufficient bleed. Regenerate only the failed layer. Do not use the API-key-dependent true-native-transparency fallback without new user authorization.

- [ ] **Step 3: Generate four route archive images**

Use one consistent prompt prefix:

```text
Cinematic editorial photograph from the same fictional Isle of Quiet Signals, same late blue-hour weather, steel-blue and grey-green grade, restrained amber practical light, realistic coastal materials, subtle analog grain, 4:3 landscape crop, no people, no text, no logo, no UI.
```

Append one subject per file:

```text
tidal-garden.webp: shallow tidal rock pools with seaweed and reflected sky.
echo-bay.webp: dark basalt sea cave with a narrow calm inlet.
keeper-house.webp: weathered white keeper house, salt-worn timber window, warm interior trace.
north-wind-path.webp: narrow grass path climbing a wind-bent northern slope toward open sea.
```

- [ ] **Step 4: Optimize web assets**

Use the bundled image tooling available in the workspace to produce:

- Opaque scene plates at 2400px wide WebP, quality 82–86.
- Alpha scene layers at 2400px wide lossless WebP or PNG when WebP alpha shows edge artifacts.
- Route images at 1200×900 WebP, quality 80–84.

Keep `lighthouse-master.png` only in `public/assets/originals/`; do not reference it from the webpage.

- [ ] **Step 5: Write the failing manifest test**

Create `tests/assets.test.js`:

```js
import { describe, expect, it } from "vitest";
import manifest from "../public/assets/asset-manifest.json";
import { validateManifest } from "../scripts/validate-assets.mjs";

describe("asset manifest", () => {
  it("contains every required scene role and route image", () => {
    const result = validateManifest(manifest);
    expect(result.errors).toEqual([]);
    expect(manifest.scene.map(({ role }) => role)).toEqual(["00", "10", "20", "30", "40", "41", "50"]);
    expect(manifest.routes).toHaveLength(4);
  });
});
```

- [ ] **Step 6: Run the manifest test and verify failure**

Run:

```powershell
npx vitest run tests/assets.test.js
```

Expected: FAIL because the manifest and validator do not exist.

- [ ] **Step 7: Implement the manifest and validator**

Normalize every scene output to `2400×1350` and every route output to `1200×900`, then create `public/assets/asset-manifest.json` with the complete inventory:

```json
{
  "masterAspect": "16:9",
  "scene": [
    { "role": "00", "file": "/assets/scene/00-sky.webp", "width": 2400, "height": 1350, "alpha": false, "anchor": "center bottom", "depth": "background" },
    { "role": "10", "file": "/assets/scene/10-distant-island.webp", "width": 2400, "height": 1350, "alpha": true, "anchor": "center horizon", "depth": "distant" },
    { "role": "20", "file": "/assets/scene/20-sea-midground.webp", "width": 2400, "height": 1350, "alpha": true, "anchor": "center bottom", "depth": "midground" },
    { "role": "30", "file": "/assets/scene/30-lighthouse.webp", "width": 2400, "height": 1350, "alpha": true, "anchor": "center bottom", "depth": "subject" },
    { "role": "40", "file": "/assets/scene/40-foreground-left.webp", "width": 2400, "height": 1350, "alpha": true, "anchor": "left bottom", "depth": "foreground" },
    { "role": "41", "file": "/assets/scene/41-foreground-right.webp", "width": 2400, "height": 1350, "alpha": true, "anchor": "right bottom", "depth": "foreground" },
    { "role": "50", "file": "/assets/scene/50-edge-frame.webp", "width": 2400, "height": 1350, "alpha": true, "anchor": "center edges", "depth": "nearest" }
  ],
  "routes": [
    { "id": "tidal-garden", "file": "/assets/routes/tidal-garden.webp", "width": 1200, "height": 900 },
    { "id": "echo-bay", "file": "/assets/routes/echo-bay.webp", "width": 1200, "height": 900 },
    { "id": "keeper-house", "file": "/assets/routes/keeper-house.webp", "width": 1200, "height": 900 },
    { "id": "north-wind-path", "file": "/assets/routes/north-wind-path.webp", "width": 1200, "height": 900 }
  ]
}
```

Create `scripts/validate-assets.mjs`:

```js
import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const REQUIRED_ROLES = ["00", "10", "20", "30", "40", "41", "50"];
const REQUIRED_ROUTES = ["tidal-garden", "echo-bay", "keeper-house", "north-wind-path"];

export function validateManifest(manifest) {
  const roles = manifest.scene?.map(({ role }) => role) ?? [];
  const routes = manifest.routes?.map(({ id }) => id) ?? [];
  const errors = [];
  for (const role of REQUIRED_ROLES) if (!roles.includes(role)) errors.push(`Missing scene role ${role}`);
  for (const id of REQUIRED_ROUTES) if (!routes.includes(id)) errors.push(`Missing route ${id}`);
  for (const item of [...(manifest.scene ?? []), ...(manifest.routes ?? [])]) {
    if (!(item.width > 0 && item.height > 0)) errors.push(`Invalid dimensions for ${item.file}`);
  }
  return { errors };
}

async function run() {
  const manifestUrl = new URL("../public/assets/asset-manifest.json", import.meta.url);
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
  const result = validateManifest(manifest);
  for (const item of [...manifest.scene, ...manifest.routes]) {
    const path = fileURLToPath(new URL(`../public${item.file}`, import.meta.url));
    try { await access(path); } catch { result.errors.push(`Missing file ${item.file}`); }
  }
  if (result.errors.length) {
    process.stderr.write(`${result.errors.join("\n")}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) run();
```

- [ ] **Step 8: Connect the images and exact dimensions**

Update each scene `<img>` in `index.html` with its measured `width` and `height`. Use `fetchpriority="high"` only for `00`, `20`, and `30`; use `loading="eager"` for the opening scene and `loading="lazy"` for route images. Add per-layer CSS object positioning and transform origins based on the manifest anchors.

- [ ] **Step 9: Validate assets, tests, and build**

Run:

```powershell
npm run validate:assets
npm test
npm run build
```

Expected: validator exits 0, all tests PASS, and the build resolves every referenced asset.

- [ ] **Step 10: Commit the art system**

Run:

```powershell
git add public scripts index.html src/styles.css tests/assets.test.js
git commit -m "feat: add layered lighthouse art system"
```

---

### Task 3: Build and test the deterministic timeline math

**Files:**
- Create: `src/timeline.js`
- Create: `tests/timeline.test.js`

**Interfaces:**
- Produces:
  - `clamp(value, min = 0, max = 1): number`
  - `lerp(start, end, amount): number`
  - `smoothstep(edge0, edge1, value): number`
  - `rangeProgress(value, start, end): number`
  - `segmentInOut(value, enterStart, enterEnd, exitStart, exitEnd): number`
- Consumes: no DOM or scene assets.

- [ ] **Step 1: Write the failing timeline tests**

Create `tests/timeline.test.js`:

```js
import { describe, expect, it } from "vitest";
import { clamp, lerp, rangeProgress, segmentInOut, smoothstep } from "../src/timeline.js";

describe("timeline math", () => {
  it("clamps and interpolates deterministically", () => {
    expect(clamp(-1)).toBe(0);
    expect(clamp(2)).toBe(1);
    expect(lerp(10, 20, 0.25)).toBe(12.5);
  });

  it("normalizes ranges with eased endpoints", () => {
    expect(rangeProgress(0.1, 0.2, 0.4)).toBe(0);
    expect(rangeProgress(0.3, 0.2, 0.4)).toBeCloseTo(0.5);
    expect(smoothstep(0.2, 0.4, 0.2)).toBe(0);
    expect(smoothstep(0.2, 0.4, 0.4)).toBe(1);
  });

  it("creates a reversible enter-hold-exit envelope", () => {
    expect(segmentInOut(0.1, 0.2, 0.3, 0.6, 0.7)).toBe(0);
    expect(segmentInOut(0.3, 0.2, 0.3, 0.6, 0.7)).toBe(1);
    expect(segmentInOut(0.5, 0.2, 0.3, 0.6, 0.7)).toBe(1);
    expect(segmentInOut(0.7, 0.2, 0.3, 0.6, 0.7)).toBe(0);
  });

  it("rejects zero-width and inverted ranges", () => {
    expect(() => rangeProgress(0.5, 0.5, 0.5)).toThrow(RangeError);
    expect(() => smoothstep(1, 0, 0.5)).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
npx vitest run tests/timeline.test.js
```

Expected: FAIL because `src/timeline.js` does not exist.

- [ ] **Step 3: Implement the pure helpers**

Create `src/timeline.js`:

```js
export const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
export const lerp = (start, end, amount) => start + (end - start) * amount;

function assertRange(start, end) {
  if (!(end > start)) throw new RangeError("Timeline range end must be greater than start");
}

export function rangeProgress(value, start, end) {
  assertRange(start, end);
  return clamp((value - start) / (end - start));
}

export function smoothstep(edge0, edge1, value) {
  const x = rangeProgress(value, edge0, edge1);
  return x * x * (3 - 2 * x);
}

export function segmentInOut(value, enterStart, enterEnd, exitStart, exitEnd) {
  if (exitStart < enterEnd) throw new RangeError("Exit must not begin before enter completes");
  const enter = smoothstep(enterStart, enterEnd, value);
  const exit = 1 - smoothstep(exitStart, exitEnd, value);
  return Math.min(enter, exit);
}
```

- [ ] **Step 4: Run the timeline tests**

Run:

```powershell
npx vitest run tests/timeline.test.js
```

Expected: all four timeline tests PASS.

- [ ] **Step 5: Commit the timeline**

Run:

```powershell
git add src/timeline.js tests/timeline.test.js
git commit -m "feat: add deterministic scene timeline math"
```

---

### Task 4: Implement asset readiness and the scroll-driven stage

**Files:**
- Create: `src/assets.js`
- Create: `src/stage.js`
- Modify: `src/main.js`
- Modify: `src/styles.css`
- Create: `tests/stage.test.js`

**Interfaces:**
- Produces: `waitForCriticalImages(root): Promise<{ failed: HTMLImageElement[] }>` from `src/assets.js`.
- Produces: `createStage({ root, stage, world, reducedMotion, requestFrame, cancelFrame }): StageController`.
- `StageController` methods: `start()`, `destroy()`, `scrollToProgress(progress, behavior)`, `getProgress()`.
- Consumes: `SCENE`, timeline helpers, scene DOM, and critical asset selectors.

- [ ] **Step 1: Write failing stage tests**

Create `tests/stage.test.js`:

```js
import { describe, expect, it, vi } from "vitest";
import { calculateLocalProgress, deriveSceneFrame } from "../src/stage.js";

describe("stage calculations", () => {
  it("calculates clamped local progress", () => {
    expect(calculateLocalProgress({ scrollY: 100, sectionTop: 100, travel: 1000 })).toBe(0);
    expect(calculateLocalProgress({ scrollY: 600, sectionTop: 100, travel: 1000 })).toBe(0.5);
    expect(calculateLocalProgress({ scrollY: 1500, sectionTop: 100, travel: 1000 })).toBe(1);
  });

  it("derives the same frame for the same progress", () => {
    const first = deriveSceneFrame(0.58, { x: 0.25, y: -0.5 });
    const second = deriveSceneFrame(0.58, { x: 0.25, y: -0.5 });
    expect(second).toEqual(first);
    expect(first.storyAOpacity).toBe(0);
    expect(first.storyBOpacity).toBeGreaterThan(0.9);
  });
});
```

- [ ] **Step 2: Run the stage test and verify failure**

Run:

```powershell
npx vitest run tests/stage.test.js
```

Expected: FAIL because `src/stage.js` does not exist.

- [ ] **Step 3: Implement asset readiness**

Create `src/assets.js`:

```js
export async function waitForCriticalImages(root) {
  const images = [...root.querySelectorAll("img[data-critical]")];
  const results = await Promise.all(images.map(async (image) => {
    try {
      if (!image.complete) await new Promise((resolve) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", resolve, { once: true });
      });
      if (typeof image.decode === "function") await image.decode();
      if (!image.naturalWidth) throw new Error("Image has no decoded width");
      return null;
    } catch {
      image.dataset.failed = "true";
      return image;
    }
  }));
  return { failed: results.filter(Boolean) };
}
```

- [ ] **Step 4: Implement pure stage calculations**

In `src/stage.js`, export:

```js
import { clamp, lerp, rangeProgress, segmentInOut, smoothstep } from "./timeline.js";

export function calculateLocalProgress({ scrollY, sectionTop, travel }) {
  if (travel <= 0) return 0;
  return clamp((scrollY - sectionTop) / travel);
}

export function deriveSceneFrame(progress, pointer = { x: 0, y: 0 }) {
  const p = clamp(progress);
  const opening = smoothstep(0.15, 0.25, p);
  const storyAOpacity = segmentInOut(p, 0.22, 0.27, 0.35, 0.44);
  const storyBOpacity = segmentInOut(p, 0.48, 0.55, 0.69, 0.74);
  const archive = smoothstep(0.75, 0.96, p);
  return {
    p,
    worldScale: lerp(1.035, 1.13, smoothstep(0.03, 0.74, p)),
    backgroundX: pointer.x * -4,
    backgroundY: pointer.y * -3,
    midgroundX: pointer.x * 7,
    midgroundY: pointer.y * 5,
    foregroundLeftX: lerp(0, -28, opening),
    foregroundRightX: lerp(0, 28, opening),
    introOpacity: 1 - smoothstep(0.03, 0.18, p),
    storyAOpacity,
    storyBOpacity,
    focusAmount: storyAOpacity * 0.45 + storyBOpacity,
    archive,
    controlsOpacity: smoothstep(0.91, 1, p),
  };
}
```

- [ ] **Step 5: Implement the RAF controller**

Implement `createStage()` so it:

- Measures `sectionTop` and `travel = root.offsetHeight - stage.offsetHeight` only on start and resize.
- Reads `window.scrollY` in RAF, not inside the scroll event handler.
- Smoothly approaches target progress with factor `0.12` and pointer with factor `0.09`.
- Uses the target values directly when reduced motion is active.
- Writes only these CSS variables: `--p`, `--world-scale`, `--bg-x`, `--bg-y`, `--mid-x`, `--mid-y`, `--fg-left-x`, `--fg-right-x`, `--intro-opacity`, `--story-a-opacity`, `--story-b-opacity`, `--focus`, `--archive-progress`, and `--controls-opacity`.
- Stops requesting frames when progress and pointer deltas are each below `0.0005`.
- Uses passive `scroll` and `pointermove` listeners.
- Disables pointer parallax for `(pointer: coarse)`.
- Uses `IntersectionObserver` to pause when the cinematic section is outside the viewport.
- Re-measures on `resize` and after `waitForCriticalImages()` resolves.
- Returns `scrollToProgress()` that maps progress to `sectionTop + travel * progress`.
- Removes all listeners, observers, and RAF callbacks in `destroy()`.

- [ ] **Step 6: Connect stage bootstrap**

Update `src/main.js` to:

1. Read the reduced-motion media query.
2. Wait for critical images.
3. Add `.is-ready` to the root and `.has-asset-failures` when needed.
4. Create and start the stage controller.
5. Return the controller and a `destroy()` method for tests and hot reload.

- [ ] **Step 7: Map scene variables to CSS**

Update `src/styles.css` so:

- Each layer has an explicit `transform-origin`.
- Background, midground, lighthouse, and foreground use distinct motion amplitudes.
- Story panels use opacity plus no more than `18px` vertical translation.
- Scene softening uses at most `blur(3px)` on capable desktop devices.
- `.has-asset-failures` retains the solid no-image composition.
- Mobile crops keep the lighthouse visible and reduce foreground displacement.
- No layer can reveal an unpainted edge at `--world-scale: 1.13`.

- [ ] **Step 8: Run unit tests and build**

Run:

```powershell
npm test
npm run build
```

Expected: all tests PASS; build exits 0.

- [ ] **Step 9: Commit the stage**

Run:

```powershell
git add src tests/stage.test.js
git commit -m "feat: drive layered scene from local scroll progress"
```

---

### Task 5: Build the accessible route archive

**Files:**
- Create: `src/route-archive.js`
- Modify: `src/main.js`
- Modify: `src/styles.css`
- Modify: `index.html`
- Create: `tests/route-archive.test.js`

**Interfaces:**
- Produces: `createRouteArchive({ root, routes }): RouteArchiveController`.
- `RouteArchiveController` methods: `next()`, `previous()`, `goTo(index)`, `getIndex()`, `destroy()`.
- Consumes: `ROUTES`, archive DOM selectors, route image assets.

- [ ] **Step 1: Write failing archive behavior tests**

Create `tests/route-archive.test.js`:

```js
import { beforeEach, describe, expect, it } from "vitest";
import { createRouteArchive } from "../src/route-archive.js";
import { ROUTES } from "../src/scene-config.js";

beforeEach(() => {
  document.body.innerHTML = `
    <section id="route-archive">
      <button id="route-prev"></button>
      <div id="route-track"></div>
      <button id="route-next"></button>
      <p id="route-status"></p>
    </section>`;
});

describe("route archive", () => {
  it("moves by button and wraps deterministically", () => {
    const archive = createRouteArchive({ root: document.querySelector("#route-archive"), routes: ROUTES });
    archive.next();
    expect(archive.getIndex()).toBe(1);
    archive.goTo(3);
    archive.next();
    expect(archive.getIndex()).toBe(0);
  });

  it("supports Arrow keys, Home, and End", () => {
    const root = document.querySelector("#route-archive");
    const archive = createRouteArchive({ root, routes: ROUTES });
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    expect(archive.getIndex()).toBe(3);
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    expect(archive.getIndex()).toBe(0);
  });
});
```

- [ ] **Step 2: Run archive tests and verify failure**

Run:

```powershell
npx vitest run tests/route-archive.test.js
```

Expected: FAIL because `src/route-archive.js` does not exist.

- [ ] **Step 3: Implement route rendering and state**

Implement `createRouteArchive()` to:

- Render exactly four semantic `<article>` items inside the track.
- Render each item’s index, title, subtitle, image, and a disclosure button labelled `了解「路线名」`.
- Keep exactly one item marked `aria-current="true"`.
- Update `--route-index` on the archive root.
- Wrap button/keyboard navigation from last to first and first to last.
- Update `#route-status` only after direct user input with `路线 X，共 4 条：路线名`.
- Expand only the active route’s detail and update `aria-expanded`.

- [ ] **Step 4: Add drag and touch behavior**

Implement Pointer Events with:

- `setPointerCapture()` on pointer down.
- A live drag CSS variable `--route-drag-x`.
- A switch threshold of `min(72px, cardWidth * 0.18)`.
- Previous/next change on release when threshold is crossed.
- Snap back without changing index when it is not crossed.
- `touch-action: pan-y` so vertical page scrolling remains available.
- Listener cleanup in `destroy()`.

- [ ] **Step 5: Style the archive as a stable final-state overlay**

Update CSS so the archive compensates for world scaling by living outside `.world`. Cards use paper-white typography, restrained borders, and one dominant image. Controls remain reachable at `390×844`, track drag never creates document overflow, and focus states remain visible over the scene.

- [ ] **Step 6: Connect the archive in `main.js`**

Create it after the DOM is ready, include its cleanup in the app’s `destroy()`, and do not delay it on route-image loading.

- [ ] **Step 7: Run tests and build**

Run:

```powershell
npm test
npm run build
```

Expected: all tests PASS and build exits 0.

- [ ] **Step 8: Commit the archive**

Run:

```powershell
git add index.html src tests/route-archive.test.js
git commit -m "feat: add accessible draggable route archive"
```

---

### Task 6: Add timeline navigation and reduced-motion document mode

**Files:**
- Create: `src/navigation.js`
- Modify: `src/main.js`
- Modify: `src/styles.css`
- Modify: `index.html`
- Create: `tests/navigation.test.js`

**Interfaces:**
- Produces: `createTimelineNavigation({ nav, points, stage, reducedMotion }): NavigationController`.
- `NavigationController` method: `destroy()`.
- Consumes: `NAV_POINTS` and `stage.scrollToProgress(progress, behavior)`.

- [ ] **Step 1: Write failing navigation tests**

Create `tests/navigation.test.js`:

```js
import { describe, expect, it, vi } from "vitest";
import { createTimelineNavigation } from "../src/navigation.js";

describe("timeline navigation", () => {
  it("maps a real nav target to stage progress", () => {
    document.body.innerHTML = `<nav><button data-progress="0.5">信号</button></nav>`;
    const stage = { scrollToProgress: vi.fn() };
    createTimelineNavigation({
      nav: document.querySelector("nav"),
      points: [{ id: "signal", label: "信号", progress: 0.5 }],
      stage,
      reducedMotion: false,
    });
    document.querySelector("button").click();
    expect(stage.scrollToProgress).toHaveBeenCalledWith(0.5, "smooth");
  });

  it("uses immediate scrolling for reduced motion", () => {
    document.body.innerHTML = `<nav><button data-progress="1">航线</button></nav>`;
    const stage = { scrollToProgress: vi.fn() };
    createTimelineNavigation({
      nav: document.querySelector("nav"),
      points: [{ id: "routes", label: "航线", progress: 1 }],
      stage,
      reducedMotion: true,
    });
    document.querySelector("button").click();
    expect(stage.scrollToProgress).toHaveBeenCalledWith(1, "auto");
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
npx vitest run tests/navigation.test.js
```

Expected: FAIL because `src/navigation.js` does not exist.

- [ ] **Step 3: Implement timeline navigation**

Implement event delegation over `[data-progress]`, validate that clicked progress exists in `points`, call `stage.scrollToProgress()`, and remove the listener in `destroy()`. Use buttons because the destinations are states inside one scroll region, not separate documents.

- [ ] **Step 4: Implement reduced-motion layout**

Under `@media (prefers-reduced-motion: reduce)`:

- Set the cinematic container height to `auto`.
- Make the stage non-sticky and allow visible overflow.
- Keep the world as one static hero of at least `70svh`.
- Place intro, story A, story B, and route archive in normal document flow.
- Remove blur, parallax, inertial transitions, scale changes, and large horizontal transforms.
- Preserve controls, disclosure content, route images, and keyboard focus.

Add an in-page skip link before the header and a real `#route-archive` target.

- [ ] **Step 5: Connect navigation and media-query changes**

Update `main.js` so the current reduced-motion value is passed into both stage and navigation. On media-query change, destroy and recreate only the affected controllers; do not reload the page.

- [ ] **Step 6: Run unit tests and build**

Run:

```powershell
npm test
npm run build
```

Expected: all tests PASS and build exits 0.

- [ ] **Step 7: Commit navigation and reduced motion**

Run:

```powershell
git add index.html src tests/navigation.test.js
git commit -m "feat: add timeline navigation and reduced motion mode"
```

---

### Task 7: Verify and refine the experience in a real browser

**Files:**
- Create: `playwright.config.js`
- Create: `tests/browser/cinematic.spec.js`
- Create: `tests/browser/reduced-motion.spec.js`
- Create: `tests/browser/archive.spec.js`
- Modify: `src/styles.css`
- Modify: `src/stage.js`
- Modify: `src/route-archive.js`
- Create final evidence outside the repository.

**Interfaces:**
- Consumes: the full built experience at `http://127.0.0.1:4173`.
- Produces: browser test coverage and final screenshot evidence at the eight required timeline checkpoints.

- [ ] **Step 1: Configure Playwright**

Create `playwright.config.js`:

```js
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/browser",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
  },
});
```

- [ ] **Step 2: Write the cinematic checkpoint test**

Create `tests/browser/cinematic.spec.js` that:

- Iterates desktop and mobile projects with exact viewports `1440×900`, `1280×720`, `1024×768`, `768×1024`, and `390×844`.
- For each viewport, captures page errors and console errors into arrays.
- Reads section top and travel, then scrolls to `p = 0, 0.18, 0.27, 0.44, 0.58, 0.74, 0.90, 1`.
- At each point asserts `document.documentElement.scrollWidth === document.documentElement.clientWidth`.
- At `0.27` expects story A opacity above `0.9`.
- At `0.58` expects story B opacity above `0.9`.
- At `1` expects archive controls opacity above `0.95` and both buttons visible.
- Repeats the checkpoints in reverse order.
- Expects captured page-error and console-error arrays to equal `[]`.

- [ ] **Step 3: Write reduced-motion and zoom tests**

Create `tests/browser/reduced-motion.spec.js` that:

- Calls `page.emulateMedia({ reducedMotion: "reduce" })`.
- Asserts intro, both narrative articles, route archive, and controls are all reachable in normal document flow.
- Asserts computed blur is `none` or `0px`.
- Tabs through the skip link, three nav buttons, previous/next controls, and four disclosure buttons.
- Sets page zoom to `200%` through CDP or an equivalent viewport/CSS emulation and asserts no horizontal document overflow.

- [ ] **Step 4: Write archive interaction tests**

Create `tests/browser/archive.spec.js` that:

- Jumps to `p = 1`.
- Clicks next and previous and verifies the live route title.
- Sends ArrowRight, End, Home, and Enter.
- Performs a pointer drag over the threshold and verifies one index change.
- Uses a mobile touch-capable context to swipe while ensuring vertical scrolling remains possible.

- [ ] **Step 5: Run browser tests and gather the first evidence set**

Run:

```powershell
npx playwright test
```

Expected: tests may initially expose visual or interaction defects; record each failing viewport/state before editing.

Capture temporary screenshots outside the repository at the eight desktop checkpoints and at mobile `p = 0`, `0.58`, and `1`.

- [ ] **Step 6: Perform the refinement loop**

For every observed defect:

1. Reproduce it at the exact viewport and `p`.
2. Change the smallest coherent CSS, scene configuration, or interaction rule.
3. Re-run only the affected Playwright test.
4. Re-check the adjacent checkpoint and reverse scroll.
5. Delete superseded temporary screenshots.

Do not stop while an executable browser check remains failing.

- [ ] **Step 7: Run the full browser matrix**

Run:

```powershell
npx playwright test
```

Expected: all browser tests PASS with no console errors and no horizontal overflow.

- [ ] **Step 8: Retain the final evidence set**

Outside the repository, retain:

- Desktop `1440×900`: `p = 0`, `0.27`, `0.58`, and `1`.
- Mobile `390×844`: `p = 0` and `1`.
- Reduced motion: one full-page or representative multi-section capture.

Visually inspect all retained images at full size before making completion claims.

- [ ] **Step 9: Commit browser coverage and refinements**

Run:

```powershell
git add playwright.config.js tests/browser src
git commit -m "test: verify cinematic experience across viewports"
```

---

### Task 8: Complete documentation and the terminal audit

**Files:**
- Create: `README.md`
- Create: `docs/ASSETS.md`
- Create: `docs/TIMELINE.md`
- Create: `docs/VALIDATION.md`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: final commands, asset manifest, browser results, and retained evidence.
- Produces: complete handoff documentation.

- [ ] **Step 1: Write the README**

Document exactly:

```powershell
npm install
npm run dev
npm test
npm run test:browser
npm run build
npm run preview
```

Explain the module boundaries, canonical local URL `http://127.0.0.1:4173`, production output `dist/`, and how to change copy through `src/scene-config.js`.

- [ ] **Step 2: Write the asset inventory**

Create `docs/ASSETS.md` from `asset-manifest.json`. For every layer list role, file, actual dimensions, alpha, visible-content notes, anchor, depth, web size, and source master. State whether any formal production asset still needs replacement; if none, write `缺失正式素材：无`.

- [ ] **Step 3: Write the timeline map**

Create `docs/TIMELINE.md` with the exact ranges from `SCENE.ranges`, affected CSS variables, navigation progress points, mobile adjustments, and reduced-motion behavior.

- [ ] **Step 4: Write the validation report**

Create `docs/VALIDATION.md` with:

- Test date and canonical URL.
- Five target viewport results.
- Eight timeline checkpoint results.
- Reverse-scroll result.
- Keyboard, pointer drag, touch, and archive disclosure results.
- Reduced-motion result.
- 200% zoom result.
- Image-failure fallback result.
- Console error result.
- Build output size and the largest individual web asset.
- Paths to the retained external evidence, not copies inside the repository.

- [ ] **Step 5: Run the complete verification suite**

Run:

```powershell
npm run validate:assets
npm test
npm run build
npx playwright test
git status --short
```

Expected: validator exits 0, all unit and browser tests PASS, build exits 0, and `git status --short` lists only the four new documentation files and intended `.gitignore` change.

- [ ] **Step 6: Perform the terminal audit**

Confirm all of the following against actual evidence:

- No unchecked implementation-plan item remains.
- Every required source, asset, and documentation file exists.
- Every visible control performs a real action.
- No browser-verifiable failure is deferred.
- Claims in `docs/VALIDATION.md` match the latest browser run.
- No temporary screenshot or generated debug artifact is tracked.
- `dist/`, `node_modules/`, Playwright reports, traces, and debug captures are ignored.

- [ ] **Step 7: Commit the handoff**

Run:

```powershell
git add README.md docs .gitignore
git commit -m "docs: complete lighthouse experience handoff"
git status --short
git log --oneline -8
```

Expected: working tree is clean and the latest commit is the documentation handoff.
