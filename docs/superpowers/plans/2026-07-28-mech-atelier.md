# Mech Atelier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an independently runnable commercial 3D mech configurator with valid modular assemblies, exact statistics and prices, shareable configurations, exploded inspection, poster export, and honest WebGL fallback.

**Architecture:** Pure configuration functions own compatibility, normalization, statistics, pricing, persistence, and URL serialization. A disposable procedural Three.js assembly observes the validated configuration; the product UI exposes guided choices, hotspots, finish controls, summaries, and export without owning business calculations.

**Tech Stack:** Vite 8, TypeScript, Three.js, shared showcase packages, Vitest 4, Playwright 1.62, Canvas export, URLSearchParams, localStorage.

## 中文执行摘要

Mech Atelier（机甲定制工坊）是一款商业 3D 配置产品。用户可以选择三种机甲底盘，替换头部、装甲、左右武器和背部模块，并调整颜色、材质和灯光环境。重量、战力、防护、机动性和概念价格由纯逻辑函数计算；非法组合会明确说明原因并恢复到最接近的合法配置。产品支持分享链接、分解视图、部件热点和海报导出，但不会伪装成真实商城，也不包含付款、库存或账号功能。

产品界面、配置说明、兼容性提示、错误和验证报告使用中文；部件 ID、URL 参数、代码接口、文件路径和命令保留英文。

项目所有者优先阅读：[中文实施指南](./2026-07-28-mengto-showcase-中文实施指南.md)。

## Global Constraints

- Work only under `mengto-skills-showcase/apps/mech-atelier` and approved shared packages.
- Read `build-hybrid-game-assets` before changing shared asset representation.
- Label all first-release mech geometry as project-authored procedural geometry.
- Provide three chassis and configurable head, armor, left weapon, right weapon, and rear module.
- Keep compatibility, weight, statistics, and price calculations pure and exact.
- Never imply checkout, inventory, payment, account, or order functionality.
- Keep configuration links deterministic and backward-compatible within version 1.
- Provide a readable static fallback when WebGL or assembly creation fails.
- Support desktop, touch, keyboard, reduced motion, and responsive layouts.
- Use Chinese for visible product copy and validation explanations while preserving English code and configuration identifiers.

---

## File Map

```text
apps/mech-atelier/
├── index.html
├── package.json
├── vite.config.ts
├── playwright.config.ts
├── src/
│   ├── main.ts
│   ├── styles.css
│   ├── content/catalog.ts
│   ├── configuration/types.ts
│   ├── configuration/validate-config.ts
│   ├── configuration/calculate-summary.ts
│   ├── configuration/serialize-config.ts
│   ├── persistence/saved-config.ts
│   ├── scene/create-configurator-scene.ts
│   ├── scene/create-exploded-view.ts
│   ├── ui/render-option-groups.ts
│   ├── ui/render-summary.ts
│   ├── ui/render-hotspots.ts
│   ├── ui/render-fallback.ts
│   └── export/create-product-poster.ts
├── tests/
│   ├── validate-config.test.ts
│   ├── calculate-summary.test.ts
│   ├── serialize-config.test.ts
│   └── saved-config.test.ts
├── tests/browser/
│   ├── configure.spec.ts
│   ├── share.spec.ts
│   ├── exploded-view.spec.ts
│   ├── poster.spec.ts
│   ├── fallback.spec.ts
│   ├── mobile.spec.ts
│   └── helpers/read-png-dimensions.ts
└── docs/VALIDATION.md
packages/game-assets/
├── src/mechs/
│   ├── types.ts
│   ├── catalog.ts
│   └── create-mech-assembly.ts
└── tests/
    └── mech-assembly.test.ts
```

### Task 1: Define the catalog, compatibility rules, statistics, and pricing

**Files:**
- Create: `apps/mech-atelier/src/configuration/types.ts`
- Create: `apps/mech-atelier/src/content/catalog.ts`
- Create: `apps/mech-atelier/src/configuration/validate-config.ts`
- Create: `apps/mech-atelier/src/configuration/calculate-summary.ts`
- Create: `apps/mech-atelier/tests/validate-config.test.ts`
- Create: `apps/mech-atelier/tests/calculate-summary.test.ts`

**Interfaces:**
- Produces: `MechConfiguration`, `Catalog`, `validateConfiguration(config, catalog)`, `normalizeConfiguration(config, catalog)`, and `calculateSummary(config, catalog)`.
- Consumes: no renderer or browser state.

- [ ] **Step 1: Write failing compatibility and calculation tests**

```ts
import { expect, it } from "vitest";
import { catalog, defaultConfiguration } from "../src/content/catalog";
import { validateConfiguration } from "../src/configuration/validate-config";

it("rejects a right-only rail lance in the left slot", () => {
  const result = validateConfiguration({
    ...defaultConfiguration,
    leftWeaponId: "rail-lance",
  }, catalog);
  expect(result).toEqual({
    ok: false,
    issues: [{ field: "leftWeaponId", code: "slot-incompatible", value: "rail-lance" }],
  });
});

it("rejects a Scout configuration above its weight limit", () => {
  const result = validateConfiguration({
    ...defaultConfiguration,
    chassisId: "strider-scout",
    armorId: "reactive-bastion",
    rightWeaponId: "rail-lance",
    rearModuleId: "siege-reactor",
  }, catalog);
  expect(result.ok).toBe(false);
  expect(result.issues).toContainEqual(expect.objectContaining({ code: "weight-limit" }));
});
```

```ts
it("calculates exact price, weight, power, guard, and mobility", () => {
  expect(calculateSummary(defaultConfiguration, catalog)).toEqual({
    priceCredits: 184000,
    weight: 28,
    power: 62,
    guard: 41,
    mobility: 78,
  });
});
```

- [ ] **Step 2: Run focused tests and verify the modules are absent**

```powershell
npm test --workspace @showcase/mech-atelier -- validate-config calculate-summary
```

Expected: FAIL.

- [ ] **Step 3: Define the versioned configuration**

```ts
export interface MechConfiguration {
  version: 1;
  chassisId: "strider-scout" | "bastion-hauler" | "oracle-frame";
  headId: "surveyor-head" | "bulwark-head" | "halo-head";
  armorId: "ceramic-shell" | "reactive-bastion" | "void-weave";
  leftWeaponId: "arc-blade" | "aegis-shield" | "drone-rack";
  rightWeaponId: "arc-blade" | "rail-lance" | "drone-rack";
  rearModuleId: "jump-pack" | "siege-reactor" | "field-relay";
  finish: {
    primary: string;
    secondary: string;
    metalness: 0 | 0.5 | 1;
    roughness: 0.2 | 0.6 | 1;
    environment: "foundry" | "hangar" | "dusk";
  };
}
```

- [ ] **Step 4: Add the exact catalog values and pure rules**

Chassis:

| ID | 中文名称 | Base price | Base weight | Power | Guard | Mobility | Weight limit |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `strider-scout` | 游骑侦察型 | 100000 | 12 | 20 | 12 | 50 | 32 |
| `bastion-hauler` | 堡垒运输型 | 132000 | 20 | 24 | 28 | 24 | 52 |
| `oracle-frame` | 神谕框架 | 148000 | 15 | 32 | 16 | 38 | 40 |

Part values:

| ID | Price | Weight | Power | Guard | Mobility | Slots |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `surveyor-head` | 12000 | 2 | 6 | 2 | 8 | head |
| `bulwark-head` | 17000 | 4 | 4 | 10 | -2 | head |
| `halo-head` | 22000 | 3 | 10 | 4 | 4 | head |
| `ceramic-shell` | 18000 | 4 | 2 | 12 | 0 | armor |
| `reactive-bastion` | 32000 | 10 | 4 | 24 | -8 | armor |
| `void-weave` | 28000 | 5 | 8 | 8 | 6 | armor |
| `arc-blade` | 16000 | 3 | 14 | 2 | 4 | left, right |
| `aegis-shield` | 24000 | 7 | 2 | 18 | -4 | left |
| `drone-rack` | 14000 | 2 | 10 | 2 | 6 | left, right |
| `rail-lance` | 36000 | 9 | 28 | 0 | -8 | right |
| `jump-pack` | 24000 | 5 | 10 | 11 | 10 | rear |
| `siege-reactor` | 34000 | 12 | 18 | 8 | -8 | rear |
| `field-relay` | 26000 | 4 | 8 | 6 | 6 | rear |

`reactive-bastion` is incompatible with `strider-scout`; `siege-reactor` is incompatible with `oracle-frame`. Every other compatibility rule is expressed by allowed slot and chassis weight limit. `validateConfiguration` returns all issues in stable field order. `normalizeConfiguration` replaces invalid values with the first legal catalog option and returns both normalized configuration and issue list.

The approved default is:

```ts
{
  version: 1,
  chassisId: "strider-scout",
  headId: "surveyor-head",
  armorId: "ceramic-shell",
  leftWeaponId: "arc-blade",
  rightWeaponId: "drone-rack",
  rearModuleId: "jump-pack",
  finish: {
    primary: "#7a2f24",
    secondary: "#d8b36a",
    metalness: 0.5,
    roughness: 0.6,
    environment: "foundry"
  }
}
```

The default arithmetic is exact: chassis `100000/12/20/12/50` plus Surveyor `12000/2/6/2/8`, Ceramic `18000/4/2/12/0`, Arc Blade `16000/3/14/2/4`, Drone Rack `14000/2/10/2/6`, and Jump Pack `24000/5/10/11/10` produces `184000` credits, `28` weight, `62` power, `41` guard, and `78` mobility.

- [ ] **Step 5: Run and commit the business rules**

```powershell
npm test --workspace @showcase/mech-atelier -- validate-config calculate-summary
git add mengto-skills-showcase/apps/mech-atelier/src/configuration mengto-skills-showcase/apps/mech-atelier/src/content mengto-skills-showcase/apps/mech-atelier/tests
git commit -m "feat: define Mech Atelier configuration rules"
```

### Task 2: Build the shared procedural mech assembly

**Files:**
- Create: `packages/game-assets/src/mechs/types.ts`
- Create: `packages/game-assets/src/mechs/catalog.ts`
- Create: `packages/game-assets/src/mechs/create-mech-assembly.ts`
- Create: `packages/game-assets/tests/mech-assembly.test.ts`
- Modify: `packages/game-assets/src/index.ts`

**Interfaces:**
- Consumes: validated app configuration through the structurally compatible shared `MechVisualConfiguration`.
- Produces: `createMechAssembly(config: MechVisualConfiguration): MechAssembly`.
- Produces: named part roots, hotspots, attachment sockets, `applyFinish`, `updateConfiguration`, and `dispose`.

- [ ] **Step 1: Write the failing assembly test**

```ts
import { expect, it } from "vitest";
import { createMechAssembly } from "../src/mechs/create-mech-assembly";

const visualConfiguration = {
  chassisId: "strider-scout",
  headId: "surveyor-head",
  armorId: "ceramic-shell",
  leftWeaponId: "arc-blade",
  rightWeaponId: "drone-rack",
  rearModuleId: "jump-pack",
  finish: {
    primary: "#7a2f24",
    secondary: "#d8b36a",
    metalness: 0.5,
    roughness: 0.6,
  },
} as const;

it("creates one named root for every configurable slot", () => {
  const assembly = createMechAssembly(visualConfiguration);
  expect([...assembly.parts.keys()]).toEqual([
    "chassis", "head", "armor", "leftWeapon", "rightWeapon", "rearModule",
  ]);
  expect([...assembly.hotspots.keys()]).toEqual(expect.arrayContaining([
    "head", "leftWeapon", "rightWeapon", "rearModule",
  ]));
  expect(assembly.root.userData.provenance).toMatchObject({
    type: "procedural",
    description: "Project-authored Three.js geometry",
  });
  assembly.dispose();
  expect(assembly.isDisposed()).toBe(true);
});
```

- [ ] **Step 2: Run the test and confirm assembly is absent**

```powershell
npm test --workspace @showcase/game-assets -- mech-assembly
```

Expected: FAIL.

- [ ] **Step 3: Implement modular geometry factories**

Define `MechVisualConfiguration` in `packages/game-assets/src/mechs/types.ts` with the six visual part IDs and finish fields shown in the test. It deliberately excludes version, price, environment, persistence, and URL concerns.

Create one focused private factory per slot:

- three chassis silhouettes;
- three heads;
- three armor shells;
- three legal left weapons;
- three legal right weapons;
- three rear modules.

Use named sockets on the chassis skeleton and attach modules only through those sockets. Register every geometry and material with a disposable scope. `updateConfiguration(next)` replaces only changed slot roots and preserves camera, lighting, and unchanged materials.

- [ ] **Step 4: Implement finish updates without geometry replacement**

`applyFinish` updates cloned product materials for primary, secondary, metalness, and roughness. It must not mutate catalog defaults or materials used by another assembly. Environment changes are emitted as a scene-level request rather than handled by the asset package.

- [ ] **Step 5: Verify and commit shared mech assets**

```powershell
npm test --workspace @showcase/game-assets -- mech-assembly
npm test --workspace @showcase/three-runtime
git add mengto-skills-showcase/packages/game-assets mengto-skills-showcase/packages/three-runtime
git commit -m "feat: add modular procedural mech assets"
```

### Task 3: Build the configurator scene and guided option interface

**Files:**
- Create: `apps/mech-atelier/index.html`
- Create: `apps/mech-atelier/package.json`
- Create: `apps/mech-atelier/vite.config.ts`
- Create: `apps/mech-atelier/playwright.config.ts`
- Create: `apps/mech-atelier/src/main.ts`
- Create: `apps/mech-atelier/src/styles.css`
- Create: `apps/mech-atelier/src/scene/create-configurator-scene.ts`
- Create: `apps/mech-atelier/src/ui/render-option-groups.ts`
- Create: `apps/mech-atelier/src/ui/render-summary.ts`
- Create: `apps/mech-atelier/tests/browser/configure.spec.ts`

**Interfaces:**
- Consumes: catalog, pure configuration functions, shared mech assembly, and Three.js lifecycle.
- Produces: one live product canvas, guided options, and exact summary updates.

- [ ] **Step 1: Write the failing configuration journey**

```ts
test("configures a legal mech and updates summary without duplicating the canvas", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /机甲定制工坊/ })).toBeVisible();
  await expect(page.locator("[data-product-canvas]")).toHaveCount(1);
  await page.getByRole("radio", { name: /堡垒运输型/ }).check();
  await page.getByRole("radio", { name: /神盾/ }).check();
  await expect(page.locator("[data-summary-weight]")).toContainText("kg");
  await expect(page.locator("[data-summary-price]")).toContainText("信用点");
  await expect(page.locator("[data-product-canvas]")).toHaveCount(1);
});
```

- [ ] **Step 2: Run Playwright and confirm the product is unavailable**

```powershell
npm run test:browser --workspace @showcase/mech-atelier -- configure
```

Expected: FAIL.

- [ ] **Step 3: Implement the product scene**

Add the direct renderer dependency:

```powershell
npm install three --workspace @showcase/mech-atelier
```

The app manifest defines:

```json
{
  "name": "@showcase/mech-atelier",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1 --port 4175",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "test:browser": "playwright test"
  }
}
```

`playwright.config.ts` starts this exact dev command, uses `http://127.0.0.1:4175`, and fails on browser console errors collected by each test fixture.

The scene must:

- use one canvas and one renderer;
- fit all three chassis from measured bounds;
- provide drag rotation, wheel/pinch zoom, and Reset View;
- support `foundry`, `hangar`, and `dusk` lighting presets without remote textures;
- update changed modules without rebuilding the full scene;
- dispose replaced parts and old materials;
- expose deterministic `?review=<configuration-id>` states.

- [ ] **Step 4: Implement guided, accessible option groups**

Use `<fieldset>` and radio controls for chassis, head, armor, weapons, rear module, material properties, and environment. Disable incompatible parts with a visible reason. If changing chassis invalidates a part, show the normalization message and select the nearest legal option before updating the scene.

Summary displays price, weight/current limit, power, guard, and mobility. It must include `概念配置，不提供结算或库存功能` next to the price.

- [ ] **Step 5: Verify and commit the configurator shell**

```powershell
npm test --workspace @showcase/mech-atelier
npm run test:browser --workspace @showcase/mech-atelier -- configure
npm run build --workspace @showcase/mech-atelier
git add mengto-skills-showcase/apps/mech-atelier
git commit -m "feat: build Mech Atelier configurator"
```

### Task 4: Add versioned sharing and local persistence

**Files:**
- Create: `apps/mech-atelier/src/configuration/serialize-config.ts`
- Create: `apps/mech-atelier/src/persistence/saved-config.ts`
- Create: `apps/mech-atelier/tests/serialize-config.test.ts`
- Create: `apps/mech-atelier/tests/saved-config.test.ts`
- Create: `apps/mech-atelier/tests/browser/share.spec.ts`
- Modify: `apps/mech-atelier/src/main.ts`

**Interfaces:**
- Produces: `serializeConfiguration(config): string`, `parseConfiguration(search): ParseResult`, `saveConfiguration`, and `loadConfiguration`.
- Uses local key `mech-atelier:v1`.

- [ ] **Step 1: Write failing round-trip and invalid-link tests**

```ts
it("round-trips the canonical configuration", () => {
  const query = serializeConfiguration(defaultConfiguration);
  expect(parseConfiguration(query)).toEqual({
    ok: true,
    config: defaultConfiguration,
    issues: [],
  });
});

it("normalizes an invalid shared part and reports the issue", () => {
  const result = parseConfiguration("?v=1&c=strider-scout&lw=rail-lance");
  expect(result.ok).toBe(true);
  expect(result.issues).toContainEqual(expect.objectContaining({
    field: "leftWeaponId",
    code: "slot-incompatible",
  }));
});
```

- [ ] **Step 2: Run tests and confirm serialization is absent**

```powershell
npm test --workspace @showcase/mech-atelier -- serialize-config saved-config
```

Expected: FAIL.

- [ ] **Step 3: Implement canonical query serialization**

Use stable keys in this exact order:

```text
v,c,h,a,lw,rw,r,p,s,m,rf,e
```

Colors serialize as six-character hex without `#`. Omit values equal to approved defaults except `v` and `c`. Parse unknown or illegal values through `normalizeConfiguration` and return visible issues. Never execute or interpolate query content as HTML.

- [ ] **Step 4: Implement local save and share controls**

Save the last valid configuration after a 250 ms debounce. The `复制配置链接` button uses the current canonical query. When clipboard access fails, show a selectable text field with the full link. The `恢复默认配置` button restores the approved default after confirmation.

- [ ] **Step 5: Verify and commit sharing**

```powershell
npm test --workspace @showcase/mech-atelier -- serialize-config saved-config validate-config
npm run test:browser --workspace @showcase/mech-atelier -- share
git add mengto-skills-showcase/apps/mech-atelier/src/configuration/serialize-config.ts mengto-skills-showcase/apps/mech-atelier/src/persistence mengto-skills-showcase/apps/mech-atelier/src/main.ts mengto-skills-showcase/apps/mech-atelier/tests
git commit -m "feat: add Mech Atelier sharing"
```

### Task 5: Add exploded view, hotspots, and product-poster export

**Files:**
- Create: `apps/mech-atelier/src/scene/create-exploded-view.ts`
- Create: `apps/mech-atelier/src/ui/render-hotspots.ts`
- Create: `apps/mech-atelier/src/export/create-product-poster.ts`
- Create: `apps/mech-atelier/tests/browser/exploded-view.spec.ts`
- Create: `apps/mech-atelier/tests/browser/poster.spec.ts`
- Create: `apps/mech-atelier/tests/browser/helpers/read-png-dimensions.ts`
- Modify: `apps/mech-atelier/src/scene/create-configurator-scene.ts`

**Interfaces:**
- Produces: `createExplodedView(assembly)`, `renderHotspots`, and `createProductPoster(input): Promise<Blob>`.
- Produces: `readPngDimensions(path)` for exact export verification.
- Consumes: validated configuration, summary, rendered product image, and named assembly parts.

- [ ] **Step 1: Write failing exploded-view and poster tests**

Install the PNG parser used by the export test:

```powershell
npm install -D pngjs @types/pngjs --workspace @showcase/mech-atelier
```

```ts
test("exploded view exposes every configurable part and returns to assembly", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "分解视图" }).click();
  for (const name of ["头部", "装甲", "左侧武器", "右侧武器", "背部模块"]) {
    await expect(page.getByRole("button", { name })).toBeVisible();
  }
  await page.getByRole("button", { name: "重新组装" }).click();
  await expect(page.locator("[data-exploded-state]")).toHaveAttribute("data-exploded-state", "assembled");
});
```

```ts
import { readPngDimensions } from "./helpers/read-png-dimensions";

test("exports a 1600x1200 PNG poster", async ({ page }) => {
  await page.goto("/");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出产品海报" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/mech-atelier-.*\.png$/);
  const path = await download.path();
  if (!path) throw new Error("Poster download has no local path");
  const dimensions = await readPngDimensions(path);
  expect(dimensions).toEqual({ width: 1600, height: 1200 });
});
```

```ts
// tests/browser/helpers/read-png-dimensions.ts
import { readFile } from "node:fs/promises";
import { PNG } from "pngjs";

export async function readPngDimensions(path: string) {
  const png = PNG.sync.read(await readFile(path));
  return { width: png.width, height: png.height };
}
```

- [ ] **Step 2: Run tests and confirm features are absent**

```powershell
npm run test:browser --workspace @showcase/mech-atelier -- exploded-view poster
```

Expected: FAIL.

- [ ] **Step 3: Implement bounded exploded motion and hotspots**

Each part moves along a fixed local vector derived from its socket, never farther than 1.8 world units. Reduced motion switches immediately between assembled and exploded positions. Hotspot buttons exist in the DOM, track projected positions, identify the part, and focus the matching option group.

- [ ] **Step 4: Implement poster export**

Export a 1600×1200 PNG containing:

- transparent-background product render over a locally drawn gradient;
- chassis and configuration name;
- selected module names;
- price, weight, power, guard, and mobility;
- `概念配置，不提供结算或库存功能`;
- a short canonical configuration URL.

Use only local or procedural assets so canvas export cannot be tainted by cross-origin media. If image capture fails, display an actionable error and leave the configurator usable.

- [ ] **Step 5: Verify and commit presentation features**

```powershell
npm run test:browser --workspace @showcase/mech-atelier -- exploded-view poster
git add mengto-skills-showcase/apps/mech-atelier/src/scene/create-exploded-view.ts mengto-skills-showcase/apps/mech-atelier/src/ui/render-hotspots.ts mengto-skills-showcase/apps/mech-atelier/src/export mengto-skills-showcase/apps/mech-atelier/tests
git commit -m "feat: add Mech Atelier presentation tools"
```

### Task 6: Add fallback, mobile, accessibility, performance, and release evidence

**Files:**
- Create: `apps/mech-atelier/src/ui/render-fallback.ts`
- Create: `apps/mech-atelier/tests/browser/fallback.spec.ts`
- Create: `apps/mech-atelier/tests/browser/mobile.spec.ts`
- Create: `apps/mech-atelier/docs/VALIDATION.md`
- Modify: `apps/mech-atelier/src/main.ts`
- Modify: `apps/mech-atelier/src/styles.css`
- Modify: `mengto-skills-showcase/README.md`

**Interfaces:**
- Consumes: completed configurator, configuration summary, and canonical URL.
- Produces: readable non-WebGL configuration flow and validation evidence.

- [ ] **Step 1: Write failing fallback and mobile journeys**

```ts
test("WebGL failure preserves configuration and sharing", async ({ page }) => {
  await page.goto("/?forceWebglFailure=1");
  await expect(page.getByText("3D 预览不可用")).toBeVisible();
  await page.getByRole("radio", { name: /堡垒运输型/ }).check();
  await expect(page.locator("[data-summary-price]")).toContainText("信用点");
  await expect(page.getByRole("button", { name: "复制配置链接" })).toBeEnabled();
});

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
test("mobile keeps the product, summary, and options reachable", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-product-stage]")).toBeVisible();
  await page.getByRole("button", { name: "开始配置" }).click();
  await expect(page.getByRole("group", { name: "底盘" })).toBeVisible();
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
});
```

- [ ] **Step 2: Run journeys and confirm failure behavior is absent**

```powershell
npm run test:browser --workspace @showcase/mech-atelier -- fallback mobile
```

Expected: FAIL.

- [ ] **Step 3: Implement static fallback and responsive product flow**

The fallback uses a locally generated hero preview for each chassis and retains all configuration, summary, persistence, and link functions. Disable only live 3D, exploded view, hotspots, and poster product capture; explain each disabled feature.

At 390×844:

- the product stage occupies at most 46% of viewport height;
- a sticky Configure button opens a bottom sheet;
- option targets are at least 44×44 CSS pixels;
- summary remains reachable without horizontal scrolling;
- touch rotation does not scroll the page;
- safe-area insets are respected.

- [ ] **Step 4: Verify accessibility and resource cleanup**

Browser tests must:

- tab through all option groups, summary, share, reset, exploded view, and export;
- verify every disabled option exposes its reason;
- emulate reduced motion and confirm instantaneous exploded transitions;
- switch 50 part options and confirm one canvas remains;
- assert no console errors;
- verify invalid shared URLs announce normalization through an `aria-live` region.

- [ ] **Step 5: Run full verification**

```powershell
npm test --workspace @showcase/mech-atelier
npm run test:browser --workspace @showcase/mech-atelier
npm run build --workspace @showcase/mech-atelier
git diff --check
```

Expected: all commands PASS.

- [ ] **Step 6: Record evidence and commit**

`docs/VALIDATION.md` records:

- exact tested commit;
- valid, invalid, shared, persisted, reset, exploded, and export journeys;
- desktop and 390×844 touch evidence;
- reduced-motion and keyboard results;
- WebGL fallback result;
- representative frame-time, draw calls, geometry, texture memory, and repeated-part-switch cleanup;
- bundle size;
- confirmation that no commerce, account, payment, inventory, or order action exists.

Update the suite README to mark Mech Atelier runnable and link its validation record.

```powershell
git add mengto-skills-showcase/apps/mech-atelier/docs/VALIDATION.md mengto-skills-showcase/apps/mech-atelier/tests/browser mengto-skills-showcase/README.md
git commit -m "docs: validate Mech Atelier"
```

## Mech Atelier Completion Gate

- Three chassis and all approved module slots configure through pure validated rules.
- Price, weight, power, guard, and mobility are exact and unit-tested.
- The live scene uses one canvas and disposes replaced parts.
- Invalid links normalize visibly to legal configurations.
- Local persistence and canonical sharing round-trip.
- Exploded view, hotspots, and 1600×1200 poster export work.
- WebGL fallback retains configuration, summary, and sharing.
- Desktop, mobile, keyboard, touch, and reduced-motion journeys pass.
- The interface clearly states that it is a concept configurator without checkout or inventory.
