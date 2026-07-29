# 统一产品能力展厅与中文新手引导 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增一个中文优先、无需 WebGL 即可理解的三产品能力展厅，为 Monster Forge、Ashfall Arena、Mech Atelier 接入一致的新手引导，并交付一条命令启动、同域组合构建、当前标签往返与可审计验证证据。

**Architecture:** `@showcase/showcase-guide` 只负责产品无关的导览状态、无障碍 `<dialog>`、安全存储、返回地址拼接和共享样式；`@showcase/hub` 负责两层中文内容、三产品 URL 和编辑式展厅。Monster 与 Mech 作为低风险宿主直接接入，Ashfall 通过独立 `guideGateOpen` 门禁冻结输入、模拟、音频与表现时钟；根脚本负责四服务监督、组合构建和跨应用浏览器往返。

**Tech Stack:** Node.js `^20.19.0 || >=22.12.0`（交付环境以 Node.js `22.12+` 为准）、npm workspaces、TypeScript `^5.9.0`、Vite `^8.1.5`、Vitest `^4.1.10`、Playwright `^1.62.0`、原生 HTML `<dialog>`、CSS、现有 Three.js `^0.185.1` 产品。

## Global Constraints

- 本计划的需求基线是 `docs/superpowers/specs/2026-07-29-showcase-hub-onboarding-design.md`；用户已于 2026-07-29 确认优化版书面规格。
- 实施固定分成六个阶段；每个阶段都遵循失败测试 → 最小实现 → 全绿 → 候选提交 → 独立复审，前一阶段通过后才进入下一阶段。
- 能力展厅始终只包含 Monster Forge、Ashfall Arena、Mech Atelier 三款产品；雾屿灯塔与 Typographic Flags 继续独立存在，不称为展厅产品，也不新增第四款产品。
- 中文是默认叙事语言；英文 Skill 名称只出现在展开详情或技术文档中。Skill 是 Codex 开发与验收时使用的专业工作说明，不是浏览器运行时插件或产品依赖。
- 首页固定文案必须逐字使用规格第 4.1 节内容；三张卡默认层只含产品名、一句话作用、适合业务、体验时间及“先看说明”“进入体验”两个操作。
- 展厅不导入 Three.js、不创建 canvas、不依赖 WebGL，不加载远程字体、远程图片或第三方脚本；图片失败时文字和两个操作仍完整可用。
- 三张真实 PNG 预览固定为 `monster-forge-review.png`、`ashfall-arena-combat.png`、`mech-atelier-configurator.png`，比例为 16:10，合计小于 `600 KiB`。
- 展厅生产预算固定为 JavaScript gzip 不超过 `75 KiB`、CSS gzip 不超过 `20 KiB`，不得出现 Three.js 分包。
- 开发端口固定为 `4172`、`4173`、`4174`、`4175`；统一启动使用单一 `20 秒`总截止时间，任一端口被占用、标识错误、超时或子进程异常都返回非零并清理完整进程树。
- 四个入口的 `<meta name="showcase-app">` 值固定为 `showcase-hub`、`monster-forge`、`ashfall-arena`、`mech-atelier`。
- 地址优先级固定为显式 Vite 构建变量 → DEV 固定回环地址或 PROD 同域路径；生产产物不得含 `127.0.0.1`、`localhost` 或 `[::1]`。
- 组合产物固定输出到 `dist/showcase/`，四应用使用 `VITE_APP_BASE=./`；展厅链接为 `./monster-forge/`、`./ashfall-arena/`、`./mech-atelier/`，产品返回基址为 `../` 并附加自身锚点。
- 所有跨产品导航都使用普通同标签页链接，不使用 `target="_blank"`；返回锚点固定为 `#product-monster-forge`、`#product-ashfall-arena`、`#product-mech-atelier`。
- 引导键固定为 `mengto-showcase:guide:<product-id>:v<guide-version>:auto-hidden`，首轮三产品 `guideVersion` 都是 `1`；只有勾选“不再自动显示”后关闭或返回展厅才写入 `true`。
- 引导必须覆盖首访、当前会话关闭、持久隐藏、版本升级、产品隔离、storage getter/read/write 失败、手动重开、Escape、焦点恢复、销毁和 reduced-motion。
- Ashfall 的 `guideGateOpen` 不写入 `GameState`、存档或 `state.paused`；门禁在第一次 RAF 和第一次输入采样前建立，打开期间不推进 fixed-step、输入、音频、VFX、HUD 或相机时钟。
- 现有三产品核心体验、存档与 URL 状态保持各自所有权；不增加后端、认证、分析埋点、公开部署、商业交易、明暗主题或新的 WebGL 展厅。
- 自动化证据不能冒充“30 秒理解”、Ashfall `8–12 分钟`真人门槛、真实设备性能或公开部署可用性；缺少外部证据时使用有具体复验条件的 `defer`。
- 桌面、390px、320px、键盘、200% 浏览器缩放、44×44 CSS px、safe-area、图片失败、WebGL 失败与 reduced-motion 都要有对应证据；自动化重排代理不得冒充真实浏览器缩放。
- README 必须继续保留 Skill 来源、安装目录、16 项已安装 Skill 清单及影响，并明确这些 Skill 不会被网页加载。
- 所有新行为先写能够因真实生产行为缺失而失败的测试；不得用源码文本搜索、mock 调用次数或复制实现逻辑的测试代替用户可观察行为。
- 每个阶段只提交本阶段范围；不得修改 `skills-source/MengTo-Skills`，不得并行改写 Ashfall 主循环与统一启动脚本。

## Public Contracts Locked by This Plan

```ts
export const PRODUCT_IDS = [
  "monster-forge",
  "ashfall-arena",
  "mech-atelier",
] as const;

export type ProductId = (typeof PRODUCT_IDS)[number];
export type ProductGuideCloseReason = "start" | "dismiss" | "escape";
export type ProductGuideAutoOpenResult = "opened" | "blocked" | "settled";

export interface ProductGuideConfig {
  readonly productId: ProductId;
  readonly guideVersion: number;
  readonly title: string;
  readonly purpose: string;
  readonly steps: readonly string[];
  readonly capability: string;
  readonly business: string;
  readonly duration: string;
  readonly desktopControls: readonly string[];
  readonly touchControls: readonly string[];
  readonly hubHref: string;
  readonly canOpen?: () => boolean;
  readonly onOpen?: () => void;
  readonly onClose?: (reason: ProductGuideCloseReason) => void;
}

export interface ProductGuideController {
  open(): boolean;
  retryAutoOpen(): ProductGuideAutoOpenResult;
  close(reason?: "dismiss" | "escape"): void;
  destroy(): void;
  isOpen(): boolean;
}

export function createProductGuide(
  host: HTMLElement,
  config: ProductGuideConfig,
): ProductGuideController;

export function resolveProductHubHref(
  base: string,
  productId: ProductId,
  currentHref: string,
): string;
```

`createProductGuide()` 在返回控制器前同步尝试一次自动打开。自动打开被 `canOpen` 拒绝时返回 `blocked` 且保持待处理；宿主之后调用 `retryAutoOpen()`。自动偏好已隐藏、已在本会话处理或控制器已销毁时返回 `settled`。手动 `open()` 忽略持久隐藏偏好，但仍尊重 `canOpen`；成功的手动打开也会结算本会话的待自动打开状态。

## File and Responsibility Map

| 单元 | 文件 | 单一职责 |
| --- | --- | --- |
| 共享类型与偏好 | `packages/showcase-guide/src/types.ts`, `storage.ts` | 固定公开类型、版本键和 storage 异常边界 |
| 共享返回地址 | `packages/showcase-guide/src/product-hub-url.ts` | 把宿主解析后的基址与固定产品锚点组合 |
| 共享导览 DOM | `packages/showcase-guide/src/create-product-guide.ts`, `styles.css` | 首访状态、原生 dialog、焦点/inert/滚动锁定和销毁 |
| 展厅内容与 URL | `apps/showcase-hub/src/content/products.ts`, `src/urls.ts` | 两层中文内容与 DEV/PROD/显式覆盖地址 |
| 展厅界面 | `apps/showcase-hub/src/ui/render-showcase.ts`, `product-dialog.ts`, `focus-product-anchor.ts` | 五段信息架构、说明层与合法 hash 焦点 |
| Monster 接入 | `apps/monster-forge/src/showcase/*`, `src/main.ts` | 产品内容、导览生命周期、返回与小成功点 |
| Mech 接入 | `apps/mech-atelier/src/showcase/*`, `src/main.ts` | 产品内容、移动配置面板协调、返回与小成功点 |
| Ashfall 接入 | `apps/ashfall-arena/src/showcase/*`, `src/main.ts`, `src/feedback/create-audio.ts` | 独立首帧门禁、时钟冻结、音频解锁和状态组合 |
| 四服务监督 | `scripts/showcase-apps.mjs`, `showcase-processes.mjs`, `dev-showcase.mjs` | 端口预检、并发启动、标识就绪和进程树清理 |
| 组合构建 | `scripts/build-showcase.mjs`, `verify-showcase-links.mjs` | 安全清理固定目录、四应用构建/复制和回环扫描 |
| 跨应用预览 | `playwright.showcase-preview.config.ts`, `tests/showcase-preview/*` | 单一源站下的展厅—产品—对应卡往返 |
| 验证与文档 | 四份 `apps/*/docs/VALIDATION.md`, `docs/SHOWCASE-VALIDATION.md`, `README.md` | 分层记录机器证据、真人边界、安装目录和 Skill 影响 |

---

## Phase 1 — 内容、URL 契约与共享引导

### Task 1: 建立共享包、版本偏好与返回地址契约

**Files:**
- Create: `packages/showcase-guide/package.json`
- Create: `packages/showcase-guide/tsconfig.json`
- Create: `packages/showcase-guide/src/types.ts`
- Create: `packages/showcase-guide/src/storage.ts`
- Create: `packages/showcase-guide/src/product-hub-url.ts`
- Create: `packages/showcase-guide/src/styles.css`
- Create: `packages/showcase-guide/src/index.ts`
- Create: `packages/showcase-guide/tests/guide-preferences.test.ts`
- Create: `packages/showcase-guide/tests/product-hub-url.test.ts`
- Modify: `packages/ui-system/package.json`
- Modify: `packages/ui-system/tests/tokens.test.ts`
- Modify: `tests/workspace-contract.test.mjs`
- Modify: `AGENTS.md`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: 根 npm workspace glob、`packages/ui-system/src/tokens.css`。
- Produces: 上方锁定的 `ProductId`、`ProductGuideConfig`、`ProductGuideController`、`ProductGuideAutoOpenResult`、`resolveProductHubHref()`；内部 `createGuidePreferenceAccess(acquireStorage)` 不从包根导出。

- [ ] **Step 1: 先写 workspace 与 CSS 子路径的失败契约**

```js
it("keeps the shared guide independently addressable", async () => {
  const guide = await readJson("../packages/showcase-guide/package.json");
  expect(guide.name).toBe("@showcase/showcase-guide");
  expect(guide.exports).toEqual({
    ".": "./src/index.ts",
    "./styles.css": "./src/styles.css",
  });
});
```

```ts
it("publishes the token sheet at @showcase/ui-system/tokens.css", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  expect(manifest.exports["./tokens.css"]).toBe("./src/tokens.css");
});
```

- [ ] **Step 2: 运行契约测试并确认缺少共享包而失败**

Run: `npm test -- --run tests/workspace-contract.test.mjs packages/ui-system/tests/tokens.test.ts`

Expected: FAIL；错误明确指出 `packages/showcase-guide/package.json` 不存在且 `@showcase/ui-system/tokens.css` 未导出。

- [ ] **Step 3: 创建共享包壳、公开类型和精确 export map**

```json
{
  "name": "@showcase/showcase-guide",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./styles.css": "./src/styles.css"
  },
  "scripts": {
    "test": "vitest run",
    "test:browser": "playwright test"
  }
}
```

`tsconfig.json`：

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "tests", "playwright.config.ts"]
}
```

```ts
export const PRODUCT_IDS = [
  "monster-forge",
  "ashfall-arena",
  "mech-atelier",
] as const;

export type ProductId = (typeof PRODUCT_IDS)[number];
export type ProductGuideCloseReason = "start" | "dismiss" | "escape";
export type ProductGuideAutoOpenResult = "opened" | "blocked" | "settled";

export interface ProductGuideConfig {
  readonly productId: ProductId;
  readonly guideVersion: number;
  readonly title: string;
  readonly purpose: string;
  readonly steps: readonly string[];
  readonly capability: string;
  readonly business: string;
  readonly duration: string;
  readonly desktopControls: readonly string[];
  readonly touchControls: readonly string[];
  readonly hubHref: string;
  readonly canOpen?: () => boolean;
  readonly onOpen?: () => void;
  readonly onClose?: (reason: ProductGuideCloseReason) => void;
}

export interface ProductGuideController {
  open(): boolean;
  retryAutoOpen(): ProductGuideAutoOpenResult;
  close(reason?: "dismiss" | "escape"): void;
  destroy(): void;
  isOpen(): boolean;
}
```

Change `packages/ui-system/package.json` to:

```json
"exports": {
  ".": "./src/index.ts",
  "./tokens.css": "./src/tokens.css"
}
```

在本任务先创建可发布的语义变量文件，Task 2 再加入 dialog 布局：

```css
:root {
  --showcase-guide-accent: #f59e5b;
  --showcase-guide-surface: #15191f;
  --showcase-guide-text: #f6f2e9;
  --showcase-guide-muted: #c5c0b7;
}
```

- [ ] **Step 4: 写版本键、隔离和三类 storage 故障的失败测试**

```ts
function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

function failingPreferenceAccess(failure: "getter" | "read" | "write") {
  const storage = {
    getItem() {
      if (failure === "read") throw new DOMException("read blocked");
      return null;
    },
    setItem() {
      if (failure === "write") throw new DOMException("write blocked");
    },
  };
  return createGuidePreferenceAccess(() => {
    if (failure === "getter") throw new DOMException("getter blocked");
    return storage;
  });
}

it("builds the exact versioned product-scoped auto-hidden key", () => {
  expect(guidePreferenceKey("ashfall-arena", 1)).toBe(
    "mengto-showcase:guide:ashfall-arena:v1:auto-hidden",
  );
  expect(() => guidePreferenceKey("ashfall-arena", 0)).toThrow(RangeError);
  expect(() => guidePreferenceKey("ashfall-arena", 1.5)).toThrow(RangeError);
});

it("isolates products and guide versions", () => {
  const storage = memoryStorage();
  createGuidePreferenceAccess(() => storage).writeAutoHidden(
    guidePreferenceKey("monster-forge", 1),
  );
  expect(storage.getItem(guidePreferenceKey("monster-forge", 1))).toBe("true");
  expect(storage.getItem(guidePreferenceKey("monster-forge", 2))).toBeNull();
  expect(storage.getItem(guidePreferenceKey("mech-atelier", 1))).toBeNull();
});

it.each(["getter", "read", "write"] as const)(
  "keeps the guide usable when storage %s throws",
  (failure) => {
    const access = failingPreferenceAccess(failure);
    expect(access.readAutoHidden("any-key")).toBe(false);
    expect(() => access.writeAutoHidden("any-key")).not.toThrow();
  },
);
```

- [ ] **Step 5: 运行偏好测试并确认模块缺失**

Run: `npm test --workspace @showcase/showcase-guide -- tests/guide-preferences.test.ts`

Expected: FAIL；Vitest 无法解析 `../src/storage`。

- [ ] **Step 6: 实现正整数校验与 getter/read/write 各自独立的安全边界**

```ts
import type { ProductId } from "./types";

export interface GuidePreferenceAccess {
  readAutoHidden(key: string): boolean;
  writeAutoHidden(key: string): void;
}

export function guidePreferenceKey(
  productId: ProductId,
  guideVersion: number,
): string {
  if (!Number.isInteger(guideVersion) || guideVersion < 1) {
    throw new RangeError("guideVersion must be a positive integer");
  }
  return `mengto-showcase:guide:${productId}:v${guideVersion}:auto-hidden`;
}

export function createGuidePreferenceAccess(
  acquireStorage: () => Pick<Storage, "getItem" | "setItem"> =
    () => window.localStorage,
): GuidePreferenceAccess {
  const storage = (): Pick<Storage, "getItem" | "setItem"> | null => {
    try {
      return acquireStorage();
    } catch {
      return null;
    }
  };
  return {
    readAutoHidden(key) {
      try {
        return storage()?.getItem(key) === "true";
      } catch {
        return false;
      }
    },
    writeAutoHidden(key) {
      try {
        storage()?.setItem(key, "true");
      } catch {
        // 持久化失败只影响下次刷新；当前控制器继续工作。
      }
    },
  };
}
```

- [ ] **Step 7: 写返回地址优先保留基址、替换旧 hash 的失败测试**

```ts
it.each([
  ["http://127.0.0.1:4172/", "monster-forge",
    "http://127.0.0.1:4173/", "http://127.0.0.1:4172/#product-monster-forge"],
  ["../", "ashfall-arena",
    "https://example.test/demos/ashfall-arena/", "https://example.test/demos/#product-ashfall-arena"],
  ["/gallery/?source=direct#old", "mech-atelier",
    "https://example.test/products/mech/", "https://example.test/gallery/?source=direct#product-mech-atelier"],
] as const)(
  "resolves %s for %s",
  (base, productId, currentHref, expected) => {
    expect(resolveProductHubHref(base, productId, currentHref)).toBe(expected);
  },
);
```

- [ ] **Step 8: 运行 URL 测试并确认函数缺失**

Run: `npm test --workspace @showcase/showcase-guide -- tests/product-hub-url.test.ts`

Expected: FAIL；`resolveProductHubHref` 尚未导出。

- [ ] **Step 9: 用 URL API 实现固定产品锚点**

```ts
import type { ProductId } from "./types";

export function resolveProductHubHref(
  base: string,
  productId: ProductId,
  currentHref: string,
): string {
  const url = new URL(base, currentHref);
  url.hash = `product-${productId}`;
  return url.href;
}
```

本任务的 `src/index.ts` 只导出公开类型、`PRODUCT_IDS` 和 `resolveProductHubHref`；不要导出 storage 注入点。Task 2 在实现文件存在后再加入 `createProductGuide` 导出。

- [ ] **Step 10: 更新路由文档、lockfile 并跑共享契约**

在 `AGENTS.md` 的共享包路由中加入 `packages/showcase-guide`，说明它只承载产品无关导览；加入 `apps/showcase-hub` 路由并明确它不是第四款产品、不得新增 Skill。运行：

Run: `npm install --package-lock-only`

Run: `npm test -- --run tests/workspace-contract.test.mjs packages/ui-system/tests/tokens.test.ts packages/showcase-guide/tests`

Expected: PASS；lockfile 将 `packages/showcase-guide` 记录为 workspace，原有 16 项 Skill 清单不变。

- [ ] **Step 11: 提交 Task 1**

```powershell
git add packages/showcase-guide packages/ui-system/package.json packages/ui-system/tests/tokens.test.ts tests/workspace-contract.test.mjs AGENTS.md package-lock.json
git commit -m "feat: establish showcase guide contracts"
```

### Task 2: 实现可阻塞重试的无障碍产品导览

**Files:**
- Create: `packages/showcase-guide/src/create-product-guide.ts`
- Modify: `packages/showcase-guide/src/styles.css`
- Create: `packages/showcase-guide/playwright.config.ts`
- Create: `packages/showcase-guide/tests/fixture/index.html`
- Create: `packages/showcase-guide/tests/fixture/main.ts`
- Create: `packages/showcase-guide/tests/browser/product-guide.spec.ts`
- Modify: `packages/showcase-guide/src/index.ts`
- Modify: `vitest.config.ts`

**Interfaces:**
- Consumes: Task 1 的 `ProductGuideConfig`、`ProductGuideController`、`ProductGuideAutoOpenResult`、`guidePreferenceKey()`、`createGuidePreferenceAccess()`。
- Produces: 同步首访尝试、待处理阻塞重试、手动重开、持久隐藏、同标签返回、焦点/inert/滚动锁定和无恢复分支销毁。

- [ ] **Step 1: 写真实 Chromium 首访与会话状态失败测试**

```ts
test("first visit opens synchronously, session close stays closed, reload opens again", async ({ page }) => {
  await page.goto("/tests/fixture/");
  const dialog = page.getByRole("dialog", { name: "测试产品导览" });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((node) =>
    node.style.getPropertyValue("--showcase-guide-accent")
  )).toBe("#123456");
  await page.getByRole("button", { name: "开始体验" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator("[data-close-log]")).toHaveText("start");
  await page.reload();
  await expect(dialog).toBeVisible();
});

test("persistent opt-out suppresses auto-open but never manual reopen", async ({ page }) => {
  await page.goto("/tests/fixture/");
  await page.getByRole("checkbox", { name: "不再自动显示" }).check();
  await page.getByRole("button", { name: "关闭说明" }).click();
  await page.reload();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.getByRole("button", { name: "这是什么？" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
```

- [ ] **Step 2: 写阻塞重试、产品/版本隔离与 storage 故障失败测试**

```ts
test("blocked automatic open remains pending until retry succeeds", async ({ page }) => {
  await page.goto("/tests/fixture/?blocked=1");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.locator("[data-auto-result]")).toHaveText("blocked");
  await page.getByRole("button", { name: "解除宿主阻塞" }).click();
  await expect(page.locator("[data-auto-result]")).toHaveText("opened");
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("persistent preferences remain isolated by product and guide version", async ({ page }) => {
  await page.goto("/tests/fixture/?product=monster-forge&version=1");
  await page.getByRole("checkbox", { name: "不再自动显示" }).check();
  await page.getByRole("button", { name: "关闭说明" }).click();
  await page.reload();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.goto("/tests/fixture/?product=monster-forge&version=2");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.goto("/tests/fixture/?product=mech-atelier&version=1");
  await expect(page.getByRole("dialog")).toBeVisible();
});

for (const failure of ["getter", "read", "write"] as const) {
  test(`storage ${failure} failure still permits open, close and reopen`, async ({ page }) => {
    await page.goto(`/tests/fixture/?storageFailure=${failure}`);
    await expect(page.getByRole("dialog")).toBeVisible();
    if (failure === "write") {
      await page.getByRole("checkbox", { name: "不再自动显示" }).check();
    }
    await page.getByRole("button", { name: "关闭说明" }).click();
    await page.getByRole("button", { name: "这是什么？" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
}
```

- [ ] **Step 3: 写键盘、背景、滚动与销毁失败测试**

```ts
test("traps focus, stops Escape propagation and restores the opener", async ({ page }) => {
  await page.goto("/tests/fixture/?hidden=1");
  const opener = page.getByRole("button", { name: "这是什么？" });
  await opener.focus();
  await opener.click();
  await expect(page.locator("main")).toHaveAttribute("inert", "");
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("link", { name: "返回能力展厅" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
  await expect(page.locator("[data-host-escape-count]")).toHaveText("0");
  await expect(page.locator("html")).not.toHaveAttribute("data-guide-scroll-lock");
});

test("hub link persists opt-out without entering the close recovery branch", async ({ page }) => {
  await page.goto("/tests/fixture/");
  await page.getByRole("checkbox", { name: "不再自动显示" }).check();
  await page.getByRole("link", { name: "返回能力展厅" }).click();
  await expect(page).toHaveURL(/returned=1#product-monster-forge$/);
  await expect(page.locator("[data-close-log]")).toHaveText("");
  expect(await page.evaluate(() =>
    localStorage.getItem(
      "mengto-showcase:guide:monster-forge:v1:auto-hidden",
    )
  )).toBe("true");
});

test("destroy removes DOM and listeners without invoking onClose", async ({ page }) => {
  await page.goto("/tests/fixture/");
  await page.getByRole("button", { name: "销毁导览" }).evaluate(
    (button: HTMLButtonElement) => button.click(),
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "这是什么？" })).toHaveCount(0);
  await expect(page.locator("[data-close-log]")).toHaveText("");
  await expect(page.locator("main")).not.toHaveAttribute("inert");
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-host-escape-count]")).toHaveText("1");
});

test("mobile controls remain 44px and reduced motion removes guide transitions", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/tests/fixture/");
  for (const control of await page.getByRole("dialog").locator("button, a, label").all()) {
    const box = await control.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThanOrEqual(44);
  }
  const panel = page.locator(".showcase-guide-panel");
  expect((await panel.boundingBox())?.height).toBeLessThanOrEqual(844);
  expect(await panel.evaluate((node) =>
    getComputedStyle(node).transitionDuration
  )).toMatch(/^(0s|0\.01ms)$/);
});

test("shared guide styles do not rewrite an unrelated host dialog", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/tests/fixture/?hidden=1");
  const hostDialog = page.locator("[data-host-dialog]");
  await hostDialog.evaluate((node: HTMLDialogElement) => node.showModal());
  const style = await hostDialog.evaluate((node) => {
    const computed = getComputedStyle(node);
    return {
      inlineSize: computed.inlineSize,
      marginTop: computed.marginTop,
      transitionDuration: computed.transitionDuration,
    };
  });
  expect(style).toEqual({
    inlineSize: "240px",
    marginTop: "12px",
    transitionDuration: "2s",
  });
});
```

`tests/fixture/index.html` 的 body 固定为：

```html
<main style="--showcase-guide-accent:#123456">
  <h1>共享导览浏览器夹具</h1>
  <button type="button" data-unblock>解除宿主阻塞</button>
  <button type="button" data-destroy>销毁导览</button>
  <output data-auto-result></output>
  <output data-close-log></output>
  <output data-host-escape-count>0</output>
</main>
<dialog data-host-dialog style="inline-size:240px;margin:12px;transition-duration:2s">
  宿主自己的对话框
</dialog>
<script type="module" src="/tests/fixture/main.ts"></script>
```

`tests/fixture/main.ts` 创建真实控制器，并只为对应查询参数安装故障：

```ts
const query = new URLSearchParams(location.search);
const productId = (query.get("product") ?? "monster-forge") as ProductId;
const guideVersion = Number(query.get("version") ?? "1");
const key =
  `mengto-showcase:guide:${productId}:v${guideVersion}:auto-hidden`;
if (query.get("hidden") === "1") localStorage.setItem(key, "true");
const storageFailure = query.get("storageFailure");
if (storageFailure === "getter") {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get() { throw new DOMException("storage getter blocked", "SecurityError"); },
  });
} else if (storageFailure === "read") {
  Storage.prototype.getItem = () => {
    throw new DOMException("storage read blocked", "SecurityError");
  };
} else if (storageFailure === "write") {
  Storage.prototype.setItem = () => {
    throw new DOMException("storage write blocked", "QuotaExceededError");
  };
}

let blocked = query.get("blocked") === "1";
const closeReasons: string[] = [];
const controller = createProductGuide(document.querySelector("main")!, {
  productId,
  guideVersion,
  title: "测试产品导览",
  purpose: "验证真实浏览器导览行为。",
  steps: ["选择内容", "完成操作", "查看结果"],
  capability: "验证导览能力",
  business: "验证业务说明",
  duration: "预计 1 分钟",
  desktopControls: ["Tab 和 Escape"],
  touchControls: ["轻触按钮"],
  hubHref:
    `/tests/fixture/?returned=1#product-${productId}`,
  canOpen: () => !blocked,
  onClose: (reason) => {
    closeReasons.push(reason);
    sessionStorage.setItem("guide-close-reasons", closeReasons.join(","));
    document.querySelector("[data-close-log]")!.textContent =
      closeReasons.join(",");
  },
});
document.querySelector("[data-unblock]")!.addEventListener("click", () => {
  blocked = false;
  document.querySelector("[data-auto-result]")!.textContent =
    controller.retryAutoOpen();
});
document.querySelector("[data-destroy]")!.addEventListener("click", () =>
  controller.destroy());
window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  const node = document.querySelector("[data-host-escape-count]")!;
  node.textContent = String(Number(node.textContent) + 1);
});
document.querySelector("[data-auto-result]")!.textContent =
  controller.isOpen() ? "opened" : blocked ? "blocked" : "settled";
document.querySelector("[data-close-log]")!.textContent =
  sessionStorage.getItem("guide-close-reasons") ?? "";
```

- [ ] **Step 4: 运行浏览器测试并确认导览实现缺失**

Run: `npm run test:browser --workspace @showcase/showcase-guide`

Expected: FAIL；fixture 无法导入 `createProductGuide` 或找不到导览按钮和 dialog。

- [ ] **Step 5: 用明确状态机实现自动打开、手动打开与关闭**

最终 `createProductGuide()` 文件按“创建 Step 6 的 DOM → 创建下列背景锁与状态机 → 注册 Step 7 的命名监听器 → 调用一次 `controller.retryAutoOpen()` → 返回 controller”的顺序组织。背景锁保存每次打开前的真实宿主状态和滚动位置：

```ts
let backgroundLocked = false;
let hostInertBeforeOpen = false;
let scrollXBeforeOpen = 0;
let scrollYBeforeOpen = 0;
const guideThemeProperties = [
  "--showcase-guide-accent",
  "--showcase-guide-surface",
  "--showcase-guide-text",
  "--showcase-guide-muted",
] as const;

const syncGuideTheme = (): void => {
  const hostStyle = getComputedStyle(host);
  for (const property of guideThemeProperties) {
    const value = hostStyle.getPropertyValue(property).trim();
    if (value) dialog.style.setProperty(property, value);
  }
};

const lockBackground = (): void => {
  if (backgroundLocked) return;
  backgroundLocked = true;
  hostInertBeforeOpen = host.inert;
  scrollXBeforeOpen = window.scrollX;
  scrollYBeforeOpen = window.scrollY;
  host.inert = true;
  document.documentElement.dataset.guideScrollLock = "true";
};

const unlockBackground = (): void => {
  if (!backgroundLocked) return;
  backgroundLocked = false;
  host.inert = hostInertBeforeOpen;
  delete document.documentElement.dataset.guideScrollLock;
  window.scrollTo(scrollXBeforeOpen, scrollYBeforeOpen);
};

let destroyed = false;
let opened = false;
let autoPending = !preferences.readAutoHidden(preferenceKey);
let returnFocusTo: HTMLElement | null = null;

const commitOpen = (): boolean => {
  autoPending = false;
  syncGuideTheme();
  const active = document.activeElement;
  returnFocusTo = active instanceof HTMLElement && active !== document.body
    ? active
    : trigger;
  lockBackground();
  dialog.showModal();
  opened = true;
  config.onOpen?.();
  startButton.focus({ preventScroll: true });
  return true;
};

const finishClose = (reason: ProductGuideCloseReason): void => {
  if (destroyed || !opened) return;
  if (hideAutomatically.checked) {
    preferences.writeAutoHidden(preferenceKey);
  }
  opened = false;
  dialog.close();
  unlockBackground();
  config.onClose?.(reason);
  returnFocusTo?.focus({ preventScroll: true });
  returnFocusTo = null;
};

const controller: ProductGuideController = {
  open() {
    if (destroyed || opened || config.canOpen?.() === false) return false;
    return commitOpen();
  },
  retryAutoOpen() {
    if (destroyed || !autoPending) return "settled";
    if (config.canOpen?.() === false) return "blocked";
    return commitOpen() ? "opened" : "blocked";
  },
  close(reason = "dismiss") {
    finishClose(reason);
  },
  destroy() {
    if (destroyed) return;
    destroyed = true;
    opened = false;
    if (dialog.open) dialog.close();
    unlockBackground();
    removeListeners();
    returnFocusTo = null;
    trigger.remove();
    dialog.remove();
  },
  isOpen: () => opened,
};
```

`open()` 成功后必须把 `autoPending` 结算为 `false`；`canOpen` 返回 `false` 时不得改变它。`destroy()` 不调用 `onClose`。

- [ ] **Step 6: 创建语义 DOM 与同标签返回分支**

用 `document.createElement` 和 `textContent` 创建下列结构，避免把 `hubHref` 或产品文案插入 `innerHTML`：

```html
<button type="button" class="showcase-guide-trigger">这是什么？</button>
<dialog class="showcase-guide-dialog" aria-modal="true" aria-labelledby="product-guide-title"
        aria-describedby="product-guide-purpose">
  <section class="showcase-guide-panel">
    <p class="showcase-guide-eyebrow">中文体验说明</p>
    <h2 id="product-guide-title"></h2>
    <p id="product-guide-purpose"></p>
    <ol data-guide-steps></ol>
    <section aria-labelledby="product-guide-capability"></section>
    <section aria-labelledby="product-guide-business"></section>
    <p data-guide-duration></p>
    <div class="showcase-guide-controls" data-desktop-controls></div>
    <div class="showcase-guide-controls" data-touch-controls></div>
    <label><input type="checkbox">不再自动显示</label>
    <div class="showcase-guide-actions">
      <button type="button" data-guide-start>开始体验</button>
      <button type="button" data-guide-dismiss>关闭说明</button>
      <a data-guide-hub>返回能力展厅</a>
    </div>
  </section>
</dialog>
```

`data-guide-hub` 使用 `anchor.href = config.hubHref`，不设置 `target`。其 click 监听只在复选框已勾选时安全写入偏好，不调用 `preventDefault()`、`close()` 或 `onClose`。

把持久入口 `trigger` 追加到 `host`，把 `dialog` 追加到 `document.body`。按钮、链接和 `cancel` 事件全部使用 Step 7 的命名处理器，禁止匿名监听器，以便 `destroy()` 能逐项移除。

- [ ] **Step 7: 实现焦点循环、Escape 隔离、inert 和滚动锁**

```ts
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const currentFocusableElements = (root: ParentNode): HTMLElement[] =>
  [...root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)]
    .filter((element) =>
      !element.hidden
      && element.getAttribute("aria-hidden") !== "true"
      && element.getClientRects().length > 0);

const onDocumentKeyDown = (event: KeyboardEvent) => {
  if (!opened) return;
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopImmediatePropagation();
    controller.close("escape");
    return;
  }
  if (event.key !== "Tab") return;
  const focusable = currentFocusableElements(dialog);
  const first = focusable[0] ?? startButton;
  const last = focusable.at(-1) ?? startButton;
  if (!dialog.contains(document.activeElement)) {
    event.preventDefault();
    first.focus();
    return;
  }
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
};

const onTriggerClick = () => {
  controller.open();
};
const onStartClick = () => {
  finishClose("start");
};
const onDismissClick = () => {
  finishClose("dismiss");
};
const onCancel = (event: Event) => {
  event.preventDefault();
  finishClose("escape");
};
const onHubClick = () => {
  if (hideAutomatically.checked) {
    preferences.writeAutoHidden(preferenceKey);
  }
};

trigger.addEventListener("click", onTriggerClick);
startButton.addEventListener("click", onStartClick);
dismissButton.addEventListener("click", onDismissClick);
dialog.addEventListener("cancel", onCancel);
hubLink.addEventListener("click", onHubClick);
document.addEventListener("keydown", onDocumentKeyDown, true);

const removeListeners = (): void => {
  trigger.removeEventListener("click", onTriggerClick);
  startButton.removeEventListener("click", onStartClick);
  dismissButton.removeEventListener("click", onDismissClick);
  dialog.removeEventListener("cancel", onCancel);
  hubLink.removeEventListener("click", onHubClick);
  document.removeEventListener("keydown", onDocumentKeyDown, true);
};

controller.retryAutoOpen();
return controller;
```

监听器只在构造时注册一次；重复打开只改变状态，不重复注册。共享样式读取 `data-guide-scroll-lock="true"`；关闭和销毁都通过 Step 5 的 `unlockBackground()` 恢复每次打开前的宿主 inert 值、滚动位置和根标记。

- [ ] **Step 8: 实现共享视觉变量、移动底部面板和 reduced-motion**

```css
:root {
  --showcase-guide-accent: #f59e5b;
  --showcase-guide-surface: #15191f;
  --showcase-guide-text: #f6f2e9;
  --showcase-guide-muted: #c5c0b7;
}

[data-guide-scroll-lock="true"] {
  overflow: hidden;
}

.showcase-guide-trigger {
  position: fixed;
  inset-block-start: max(12px, env(safe-area-inset-top));
  inset-inline-end: max(12px, env(safe-area-inset-right));
  z-index: 1000;
  padding: 10px 14px;
  border: 1px solid color-mix(in srgb, var(--showcase-guide-accent) 70%, white);
  border-radius: 999px;
  background: var(--showcase-guide-surface);
  color: var(--showcase-guide-text);
  font: inherit;
  font-weight: 700;
}

.showcase-guide-dialog {
  inline-size: min(720px, calc(100vw - 32px));
  max-inline-size: none;
  max-block-size: calc(100dvh - 32px);
  padding: 0;
  border: 0;
  border-radius: 22px;
  overflow: visible;
  background: transparent;
  color: var(--showcase-guide-text);
}

.showcase-guide-dialog::backdrop {
  background: rgb(5 7 10 / 78%);
  backdrop-filter: blur(4px);
}

.showcase-guide-panel {
  max-block-size: min(760px, calc(100dvh - 32px));
  overflow: auto;
  box-sizing: border-box;
  border: 1px solid color-mix(in srgb, var(--showcase-guide-accent) 45%, transparent);
  border-radius: inherit;
  background: var(--showcase-guide-surface);
  color: var(--showcase-guide-text);
  box-shadow: 0 24px 80px rgb(0 0 0 / 45%);
  padding:
    max(24px, env(safe-area-inset-top))
    max(24px, env(safe-area-inset-right))
    max(24px, env(safe-area-inset-bottom))
    max(24px, env(safe-area-inset-left));
}

.showcase-guide-panel :is(p, li) {
  color: var(--showcase-guide-muted);
}

.showcase-guide-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.showcase-guide-actions :is(button, a),
.showcase-guide-trigger,
.showcase-guide-panel label {
  min-inline-size: 44px;
  min-block-size: 44px;
}
.showcase-guide-actions :is(button, a) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 10px 14px;
  border: 1px solid var(--showcase-guide-accent);
  border-radius: 10px;
  background: transparent;
  color: var(--showcase-guide-text);
  font: inherit;
  text-decoration: none;
}
.showcase-guide-panel label {
  display: flex;
  align-items: center;
}

.showcase-guide-dialog :focus-visible,
.showcase-guide-trigger:focus-visible {
  outline: 3px solid var(--showcase-guide-accent);
  outline-offset: 3px;
}

@media (max-width: 520px) {
  .showcase-guide-dialog {
    inline-size: 100%;
    max-inline-size: none;
    margin: auto 0 0;
  }
  .showcase-guide-panel {
    max-block-size: 100dvh;
    border-radius: 20px 20px 0 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .showcase-guide-dialog,
  .showcase-guide-dialog::backdrop,
  .showcase-guide-panel {
    animation: none;
    transition-duration: 0.01ms;
  }
}
```

- [ ] **Step 9: 跑共享包单元、浏览器和类型消费契约**

`playwright.config.ts` 使用单 worker，`baseURL` 为 `http://127.0.0.1:4196`，webServer 命令固定为：

```text
vite --host 127.0.0.1 --port 4196 --strictPort
```

fixture URL 是 `/tests/fixture/`，默认 storageState 为空。

根 `vitest.config.ts` 的 exclude 增加 `"packages/*/tests/browser/**"`，确保 `npm test` 不把 Playwright spec 当 Vitest 单元测试执行。

Run: `npm test --workspace @showcase/showcase-guide`

Run: `npm run test:browser --workspace @showcase/showcase-guide`

Run: `npm run build --workspace @showcase/monster-forge`

Expected: PASS；真实 Chromium 覆盖首访、阻塞重试、三类 storage 故障、焦点循环、Escape 隔离、返回不触发恢复分支与销毁。

- [ ] **Step 10: 提交 Task 2**

```powershell
git add packages/showcase-guide vitest.config.ts
git commit -m "feat: add accessible product onboarding guide"
```

### Task 3: 建立展厅两层内容、URL 与执行验证账本

**Files:**
- Create: `apps/showcase-hub/package.json`
- Create: `apps/showcase-hub/tsconfig.json`
- Create: `apps/showcase-hub/vite.config.ts`
- Create: `apps/showcase-hub/vitest.config.ts`
- Create: `apps/showcase-hub/index.html`
- Create: `apps/showcase-hub/src/vite-env.d.ts`
- Create: `apps/showcase-hub/src/content/products.ts`
- Create: `apps/showcase-hub/src/urls.ts`
- Create: `apps/showcase-hub/src/main.ts`
- Create: `apps/showcase-hub/src/styles.css`
- Create: `apps/showcase-hub/tests/content-and-urls.test.ts`
- Create: `docs/SHOWCASE-VALIDATION.md`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tests/workspace-contract.test.mjs`

**Interfaces:**
- Consumes: Task 1 的 `ProductId` 与 `PRODUCT_IDS`；规格固定中文内容。
- Produces: `SHOWCASE_PRODUCTS: readonly ProductContent[]`、`resolveShowcaseProductUrls(env): Record<ProductId, string>`、可独立构建的 `@showcase/hub` 壳和覆盖矩阵执行账本。

- [ ] **Step 1: 写两层内容模型和地址优先级失败测试**

```ts
it("publishes exactly three terse cards with complete dialog details", () => {
  expect(SHOWCASE_PRODUCTS.map(({ id }) => id)).toEqual(PRODUCT_IDS);
  for (const product of SHOWCASE_PRODUCTS) {
    expect(product.card.summary.length).toBeGreaterThan(0);
    expect(product.card.business.length).toBeGreaterThan(0);
    expect(product.card.duration).toMatch(/分钟/);
    expect(product.card.previewFilename).toMatch(/\.png$/);
    expect(product.card.previewAlt.length).toBeGreaterThan(0);
    expect(product.details.steps).toHaveLength(3);
    expect(product.details.scenarios.length).toBeGreaterThanOrEqual(2);
    expect(product.details.capabilityGroups.length).toBeGreaterThanOrEqual(2);
  }
});

it("uses fixed loopback only in development and same-origin paths in production", () => {
  expect(resolveShowcaseProductUrls({ DEV: true })).toEqual({
    "monster-forge": "http://127.0.0.1:4173/",
    "ashfall-arena": "http://127.0.0.1:4174/",
    "mech-atelier": "http://127.0.0.1:4175/",
  });
  expect(resolveShowcaseProductUrls({ DEV: false })).toEqual({
    "monster-forge": "/monster-forge/",
    "ashfall-arena": "/ashfall-arena/",
    "mech-atelier": "/mech-atelier/",
  });
});

it("prefers explicit Vite overrides without rewriting relative paths", () => {
  expect(resolveShowcaseProductUrls({
    DEV: false,
    VITE_MONSTER_FORGE_URL: "./monster-forge/",
    VITE_ASHFALL_ARENA_URL: "./ashfall-arena/",
    VITE_MECH_ATELIER_URL: "./mech-atelier/",
  })).toEqual({
    "monster-forge": "./monster-forge/",
    "ashfall-arena": "./ashfall-arena/",
    "mech-atelier": "./mech-atelier/",
  });
});
```

- [ ] **Step 2: 运行内容测试并确认 hub 模块缺失**

Run: `npm test --workspace @showcase/hub -- tests/content-and-urls.test.ts`

Expected: FAIL；workspace 或 `src/content/products.ts` 尚不存在。

- [ ] **Step 3: 创建完整的中文内容类型和三个固定对象**

```ts
export interface ProductContent {
  readonly id: ProductId;
  readonly name: string;
  readonly label: string;
  readonly accent: "warm-orange" | "ember-red" | "precision-cyan";
  readonly card: {
    readonly summary: string;
    readonly business: string;
    readonly duration: string;
    readonly previewFilename: string;
    readonly previewAlt: string;
  };
  readonly details: {
    readonly purpose: string;
    readonly steps: readonly [string, string, string];
    readonly scenarios: readonly string[];
    readonly capabilityGroups: readonly {
      readonly label: string;
      readonly skills: readonly string[];
    }[];
    readonly duration: string;
    readonly boundary?: string;
  };
}
```

三个对象必须逐字包含：

```ts
{
  id: "monster-forge",
  name: "Monster Forge",
  label: "怪物锻造所",
  accent: "warm-orange",
  card: {
    summary: "在同一工作台检查怪物模型、动作和技术叠加。",
    business: "游戏资产库、角色编辑器、数字资产验收",
    duration: "预计 2–3 分钟",
    previewFilename: "monster-forge-review.png",
    previewAlt: "怪物锻造所的怪物目录与实时模型检查器",
  },
  details: {
    purpose: "检查和管理 3D 怪物资产。",
    steps: [
      "选择一个怪物。",
      "切换动作、骨骼或碰撞体。",
      "查看模型来源与技术参数。",
    ],
    scenarios: ["游戏资产库", "角色编辑器", "数字资产验收"],
    capabilityGroups: [
      { label: "资产与模型", skills: ["build-game-monster-system", "build-hybrid-game-assets"] },
      { label: "审阅与交付", skills: ["build-vesperfall-review-assets", "test-playable-web-games"] },
    ],
    duration: "预计 2–3 分钟",
  },
}
```

```ts
{
  id: "ashfall-arena",
  name: "Ashfall Arena",
  label: "灰烬竞技场",
  accent: "ember-red",
  card: {
    summary: "直接体验战斗、敌人 AI、成长和反馈组成的动作游戏切片。",
    business: "游戏原型、互动营销、战斗系统验证",
    duration: "3–5 分钟了解核心操作",
    previewFilename: "ashfall-arena-combat.png",
    previewAlt: "灰烬竞技场中的等距动作战斗与中文状态界面",
  },
  details: {
    purpose: "展示完整动作游戏系统。",
    steps: [
      "学会移动、攻击、闪避和格挡。",
      "完成普通敌人与精英战。",
      "选择升级并挑战 Boss。",
    ],
    scenarios: ["游戏原型", "互动营销", "战斗系统验证"],
    capabilityGroups: [
      { label: "战斗与敌人", skills: ["design-action-combat", "build-threejs-enemy-systems", "tune-enemy-ai"] },
      { label: "反馈与移动", skills: ["create-game-vfx", "build-game-audio-feedback", "build-mobile-threejs-games"] },
    ],
    duration: "3–5 分钟了解核心操作",
    boundary: "完整首次挑战继续保留 8–12 分钟真人验证门槛；自动化不代替这个结论。",
  },
}
```

```ts
{
  id: "mech-atelier",
  name: "Mech Atelier",
  label: "机甲定制工坊",
  accent: "precision-cyan",
  card: {
    summary: "更换机甲部件并立即看到 3D 外观与参数变化。",
    business: "汽车选配、工业设备、家具和定制商品",
    duration: "预计 3–5 分钟",
    previewFilename: "mech-atelier-configurator.png",
    previewAlt: "机甲定制工坊中的三维机甲与部件配置面板",
  },
  details: {
    purpose: "配置和展示复杂 3D 商品。",
    steps: [
      "更换机体、装甲和武器。",
      "查看负载、火力、防御和兼容性变化。",
      "使用拆解视图、分享配置或导出海报。",
    ],
    scenarios: ["汽车选配", "工业设备", "家具", "定制商品销售"],
    capabilityGroups: [
      { label: "资产与配置", skills: ["build-hybrid-game-assets", "optimize-threejs-games"] },
      { label: "验证与交付", skills: ["test-playable-web-games", "ship-web-games"] },
    ],
    duration: "预计 3–5 分钟",
    boundary: "页面价格为概念性积分，不代表真实定价、库存、订单、支付或履约。",
  },
}
```

- [ ] **Step 4: 实现显式覆盖 → DEV/PROD 默认值解析**

```ts
export interface ShowcaseUrlEnv {
  readonly DEV: boolean;
  readonly VITE_MONSTER_FORGE_URL?: string;
  readonly VITE_ASHFALL_ARENA_URL?: string;
  readonly VITE_MECH_ATELIER_URL?: string;
}

export function resolveShowcaseProductUrls(
  env: ShowcaseUrlEnv,
): Record<ProductId, string> {
  const defaults = env.DEV
    ? {
        "monster-forge": "http://127.0.0.1:4173/",
        "ashfall-arena": "http://127.0.0.1:4174/",
        "mech-atelier": "http://127.0.0.1:4175/",
      }
    : {
        "monster-forge": "/monster-forge/",
        "ashfall-arena": "/ashfall-arena/",
        "mech-atelier": "/mech-atelier/",
      };
  return {
    "monster-forge": env.VITE_MONSTER_FORGE_URL ?? defaults["monster-forge"],
    "ashfall-arena": env.VITE_ASHFALL_ARENA_URL ?? defaults["ashfall-arena"],
    "mech-atelier": env.VITE_MECH_ATELIER_URL ?? defaults["mech-atelier"],
  };
}
```

- [ ] **Step 5: 建立可构建壳与固定页面标识**

`index.html` 必须含：

```html
<html lang="zh-CN">
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="showcase-app" content="showcase-hub">
    <title>MengTo Skills 产品能力展</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

Hub manifest 的运行时 workspace 依赖固定为：

```json
"dependencies": {
  "@showcase/showcase-guide": "*",
  "@showcase/ui-system": "*"
}
```

`src/main.ts` 导入 `@showcase/ui-system/tokens.css`。`src/urls.ts` 同时导出下列预览解析器；资源使用 `import.meta.env.BASE_URL` 组合，不在内容对象中存放前导 `/`：

```ts
export function resolvePreviewHref(baseUrl: string, filename: string): string {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${base}previews/${filename}`;
}
```

`main.ts` 在本阶段渲染固定首屏标题和基于 `SHOWCASE_PRODUCTS` 名称的原生文本列表，使 build 可用；本阶段不创建 `<img>` 或请求尚未复制的预览。Task 4 在不改变内容对象的前提下替换为完整五段展厅。

- [ ] **Step 6: 创建执行验证账本而不冒填结果**

把规格第 10 节的 18 行基线复制到 `docs/SHOWCASE-VALIDATION.md`，保留列：

```markdown
| 用户阶段 | 要求或产物 | 表面 / 状态 | 所需证据 | 阶段 | 状态 | 证据或复验条件 |
| --- | --- | --- | --- | --- | --- | --- |
```

初始状态逐行写 `continue`，并在文首写明：这是实施执行账本；每个阶段只更新自己已实际执行的行；最终不得残留 `continue`；`defer` 必须同时写出已尝试的替代路径、未验证风险和复验触发条件。

- [ ] **Step 7: 添加 hub workspace 脚本并更新 lockfile**

根 `package.json` 先加入：

```json
"dev:hub": "npm run dev --workspace @showcase/hub"
```

本阶段不接管根 `dev`。Hub manifest 固定为：

```json
{
  "name": "@showcase/hub",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1 --port 4172 --strictPort",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "@showcase/showcase-guide": "*",
    "@showcase/ui-system": "*"
  }
}
```

`tsconfig.json` 继承 `../../tsconfig.base.json` 并 include `src`、`tests`、三个 Vite/Vitest/Playwright config。`vite.config.ts` 在本阶段固定：

```ts
import { defineConfig } from "vite";

export default defineConfig({
  server: { host: "127.0.0.1", port: 4172, strictPort: true },
  preview: { host: "127.0.0.1", port: 4272, strictPort: true },
});
```

运行：

Run: `npm install --package-lock-only`

Run: `npm test --workspace @showcase/hub`

Run: `npm run build --workspace @showcase/hub`

Expected: PASS；生产构建不出现 Three.js 依赖。

- [ ] **Step 8: 提交 Task 3**

```powershell
git add apps/showcase-hub docs/SHOWCASE-VALIDATION.md package.json package-lock.json tests/workspace-contract.test.mjs
git commit -m "feat: establish showcase hub content contracts"
```

### Phase 1 Review Gate

- [ ] 运行 `npm test --workspace @showcase/showcase-guide`、`npm run test:browser --workspace @showcase/showcase-guide`、`npm test --workspace @showcase/hub`、`npm run build --workspace @showcase/hub`、`npm test -- --run tests/workspace-contract.test.mjs` 和 `git diff --check`。
- [ ] 使用 `superpowers:requesting-code-review` 派发独立复审，逐项核对公开签名、阻塞重试、storage 三类失败、当前会话语义和两层内容；高优先级问题清零后记录 Phase 1 候选 SHA。
- [ ] 在 `docs/SHOWCASE-VALIDATION.md` 中仅把已由上述命令证明的内容/状态行改为 `pass` 并附命令与候选 SHA；其余保持 `continue`。

---

## Phase 2 — 统一展厅

### Task 4: 实现五段编辑式首页、说明 dialog 与合法锚点焦点

**Files:**
- Create: `apps/showcase-hub/src/ui/render-showcase.ts`
- Create: `apps/showcase-hub/src/ui/product-dialog.ts`
- Create: `apps/showcase-hub/src/focus-product-anchor.ts`
- Create: `apps/showcase-hub/playwright.config.ts`
- Create: `apps/showcase-hub/tests/browser/fixtures.ts`
- Create: `apps/showcase-hub/tests/browser/content.spec.ts`
- Create: `apps/showcase-hub/tests/browser/dialog-navigation.spec.ts`
- Create: `apps/showcase-hub/public/previews/monster-forge-review.png`
- Create: `apps/showcase-hub/public/previews/ashfall-arena-combat.png`
- Create: `apps/showcase-hub/public/previews/mech-atelier-configurator.png`
- Modify: `apps/showcase-hub/src/main.ts`
- Modify: `apps/showcase-hub/src/styles.css`
- Modify: `apps/showcase-hub/package.json`

**Interfaces:**
- Consumes: Task 3 的 `SHOWCASE_PRODUCTS` 和 `resolveShowcaseProductUrls()`。
- Produces: `renderShowcase(root, products, urls, assetBaseUrl): ShowcaseView`、`createProductDialog(main, products, urls): ProductDialogController`、`focusProductAnchor(root, hash): boolean`。

- [ ] **Step 1: 写首屏、三卡短层、业务指南和 Skill 流程失败测试**

```ts
test("the first screen explains the three-product relationship", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("MengTo Skills 产品能力展", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", {
    level: 1,
    name: "这是三款独立、可实际操作的 3D 产品体验",
  })).toBeVisible();
  await expect(page.getByText(
    "它们不是同一款游戏的三个关卡，而是资产工具、动作游戏和商品配置器。Skill 是指导 Codex 开发与验收的专业工作说明，最终交付仍是普通网页产品。",
  )).toBeVisible();
});

test("keeps three default cards scan-friendly and explains the four-step workflow", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-product-card]")).toHaveCount(3);
  await expect(page.locator("[data-product-card] ol")).toHaveCount(0);
  await expect(page.locator("[data-product-card] [data-skill-list]")).toHaveCount(0);
  await expect(page.locator("#how-it-works")).toContainText(
    "选择业务目标 → Codex 读取相关专业工作说明 → 开发与测试 → 交付普通网页产品",
  );
  await expect(page.locator("#how-it-works")).toContainText(
    "这些专业工作说明在 Codex 中称为 Skill",
  );
  await expect(page.locator("#how-it-works")).toContainText(
    "Skill 不会被浏览器加载，也不是运行时插件",
  );
  await expect(page.locator("canvas, svg")).toHaveCount(0);
});
```

- [ ] **Step 2: 写说明层、同标签链接与 hash 焦点失败测试**

```ts
test("opens complete details and restores the invoking button on Escape", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "先看 Monster Forge 说明" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Monster Forge 产品说明" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("选择一个怪物");
  await expect(dialog).toContainText("build-game-monster-system");
  await expect(page.locator("main")).toHaveAttribute("inert", "");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("focuses only a legal returned product hash without a second scroll", async ({ page }) => {
  await page.goto("/#product-mech-atelier");
  const heading = page.getByRole("heading", { name: /Mech Atelier/ });
  await expect(heading).toBeFocused();
  await expect(heading).toHaveAttribute("tabindex", "-1");
  const y = await page.evaluate(() => scrollY);
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => scrollY)).toBe(y);
  await page.goto("/#how-it-works");
  await expect(page.locator("body")).toBeFocused();
});

test("keeps every product journey in the current tab", async ({ page }) => {
  await page.goto("/");
  for (const link of await page.locator("[data-enter-product]").all()) {
    await expect(link).not.toHaveAttribute("target");
  }
});
```

- [ ] **Step 3: 运行浏览器测试并确认完整结构缺失**

Run: `npm run test:browser --workspace @showcase/hub -- tests/browser/content.spec.ts tests/browser/dialog-navigation.spec.ts`

Expected: FAIL；页面没有五段结构、说明 dialog、inert 或合法 hash 焦点。

- [ ] **Step 4: 渲染固定五段信息架构**

`renderShowcase()` 不读取 Vite 环境，只消费调用者传入的产品、地址与资产基址，并返回后续绑定需要的稳定节点：

```ts
export interface ShowcaseView {
  readonly main: HTMLElement;
  readonly explainButtons: readonly HTMLButtonElement[];
}

interface ShowcaseShell {
  readonly main: HTMLElement;
  readonly productGrid: HTMLElement;
}
```

静态五段和折叠 Skill 清单由一个确定性 helper 创建：

```ts
function createShowcaseShell(
  products: readonly ProductContent[],
): ShowcaseShell {
  const main = document.createElement("main");
  main.innerHTML = `
    <section class="hero" aria-labelledby="showcase-title">
      <p>MengTo Skills 产品能力展</p>
      <h1 id="showcase-title">这是三款独立、可实际操作的 3D 产品体验</h1>
      <p>它们不是同一款游戏的三个关卡，而是资产工具、动作游戏和商品配置器。Skill 是指导 Codex 开发与验收的专业工作说明，最终交付仍是普通网页产品。</p>
      <a href="#products">查看三款产品</a>
      <a href="#how-it-works">这些产品是怎样做出来的</a>
    </section>
    <section id="products" aria-labelledby="products-title">
      <h2 id="products-title">三款互补产品</h2>
      <p>同一套专业 Skill，如何产出三种完全不同的可运行产品。</p>
      <div class="product-grid" data-product-grid></div>
    </section>
    <section id="business-guide" aria-labelledby="business-guide-title">
      <h2 id="business-guide-title">按业务目标选择</h2>
      <ul>
        <li>管理和验收 3D 资产 → Monster Forge</li>
        <li>制作可玩的互动内容 → Ashfall Arena</li>
        <li>展示和配置复杂商品 → Mech Atelier</li>
      </ul>
    </section>
    <section id="how-it-works" aria-labelledby="how-title">
      <h2 id="how-title">这些产品是怎样做出来的</h2>
      <p>选择业务目标 → Codex 读取相关专业工作说明 → 开发与测试 → 交付普通网页产品</p>
      <p>这些专业工作说明在 Codex 中称为 Skill。Skill 不会被浏览器加载，也不是运行时插件。</p>
      <details>
        <summary>查看英文 Skill 清单</summary>
        <ul data-skill-index></ul>
      </details>
    </section>
    <section id="validation" aria-labelledby="validation-title">
      <h2 id="validation-title">验证与边界</h2>
      <p>已通过自动化验证文案、操作和本地生产路径；真人首次理解、真实设备表现与公开部署仍按证据单独判断。</p>
      <details>
        <summary>查看技术验证边界</summary>
        <p>测试数量、GPU、设备和真人门槛分别记录；自动测试不作为真人可用性证明。</p>
      </details>
    </section>`;
  const productGrid = main.querySelector<HTMLElement>("[data-product-grid]");
  const skillIndex = main.querySelector<HTMLUListElement>("[data-skill-index]");
  if (!productGrid || !skillIndex) {
    throw new Error("Showcase shell is missing a required content region");
  }
  const skillNames = [...new Set(products.flatMap((product) =>
    product.details.capabilityGroups.flatMap((group) => group.skills)))];
  skillIndex.replaceChildren(...skillNames.map((skill) => {
    const item = document.createElement("li");
    item.textContent = skill;
    return item;
  }));
  return { main, productGrid };
}
```

业务指南逐字使用：

```text
管理和验收 3D 资产 → Monster Forge
制作可玩的互动内容 → Ashfall Arena
展示和配置复杂商品 → Mech Atelier
```

验证默认层写“已通过自动化验证文案、操作和本地生产路径；真人首次理解、真实设备表现与公开部署仍按证据单独判断”，技术数字放入 `<details>`。

- [ ] **Step 5: 每张卡只渲染短层并用 DOM 属性设置地址**

```ts
export function renderShowcase(
  root: HTMLElement,
  products: readonly ProductContent[],
  urls: Readonly<Record<ProductId, string>>,
  assetBaseUrl: string,
): ShowcaseView {
  const { main, productGrid } = createShowcaseShell(products);
  const explainButtons: HTMLButtonElement[] = [];
  for (const product of products) {
    const article = document.createElement("article");
    article.id = `product-${product.id}`;
    article.dataset.productCard = product.id;
    article.dataset.accent = product.accent;
    const heading = document.createElement("h3");
    heading.tabIndex = -1;
    heading.textContent = `${product.name}｜${product.label}`;
    const image = document.createElement("img");
    image.src = resolvePreviewHref(assetBaseUrl, product.card.previewFilename);
    image.alt = product.card.previewAlt;
    image.width = 1440;
    image.height = 900;
    const summary = document.createElement("p");
    summary.textContent = product.card.summary;
    const business = document.createElement("p");
    business.innerHTML = "<strong>适合业务</strong> ";
    business.append(document.createTextNode(product.card.business));
    const duration = document.createElement("p");
    duration.innerHTML = "<strong>体验时间</strong> ";
    duration.append(document.createTextNode(product.card.duration));
    const enter = document.createElement("a");
    enter.dataset.enterProduct = product.id;
    enter.href = urls[product.id];
    enter.textContent = "进入体验";
    const explain = document.createElement("button");
    explain.type = "button";
    explain.dataset.explainProduct = product.id;
    explain.setAttribute("aria-label", `先看 ${product.name} 说明`);
    explain.textContent = "先看说明";
    explainButtons.push(explain);
    article.append(image, heading, summary, business, duration, explain, enter);
    productGrid.append(article);
  }
  root.replaceChildren(main);
  return { main, explainButtons };
}
```

默认卡片不得渲染 `details.steps`、`details.capabilityGroups` 或多条 `details.scenarios`。

- [ ] **Step 6: 实现展厅专用说明 dialog**

```ts
export interface ProductDialogController {
  open(productId: ProductId, opener: HTMLElement): void;
  close(): void;
  destroy(): void;
}
```

`createProductDialog()` 的完整签名固定为：

```ts
export function createProductDialog(
  main: HTMLElement,
  products: readonly ProductContent[],
  urls: Readonly<Record<ProductId, string>>,
): ProductDialogController
```

函数先创建只含固定模板的 dialog；产品文案和地址仍在打开时用 `textContent`/`href` 写入：

```ts
const dialog = document.createElement("dialog");
dialog.className = "product-dialog";
dialog.setAttribute("aria-modal", "true");
dialog.setAttribute("aria-labelledby", "product-dialog-title");
dialog.setAttribute("aria-describedby", "product-dialog-purpose");
dialog.innerHTML = `
  <section class="product-dialog-panel">
    <p>完整产品说明</p>
    <h2 id="product-dialog-title" data-dialog-title></h2>
    <p id="product-dialog-purpose" data-dialog-purpose></p>
    <h3>三步体验任务</h3>
    <ol data-dialog-steps></ol>
    <h3>典型业务场景</h3>
    <ul data-dialog-scenarios></ul>
    <div data-dialog-capabilities></div>
    <p data-dialog-duration></p>
    <p data-dialog-boundary></p>
    <div class="product-dialog-actions">
      <button type="button" data-dialog-close>关闭</button>
      <a data-dialog-enter>进入体验</a>
    </div>
  </section>`;
document.body.append(dialog);

const required = <ElementType extends Element>(
  selector: string,
): ElementType => {
  const element = dialog.querySelector<ElementType>(selector);
  if (!element) throw new Error(`Product dialog is missing ${selector}`);
  return element;
};
const title = required<HTMLElement>("[data-dialog-title]");
const purpose = required<HTMLElement>("[data-dialog-purpose]");
const steps = required<HTMLOListElement>("[data-dialog-steps]");
const scenarios = required<HTMLUListElement>("[data-dialog-scenarios]");
const capabilities = required<HTMLElement>("[data-dialog-capabilities]");
const duration = required<HTMLElement>("[data-dialog-duration]");
const boundary = required<HTMLElement>("[data-dialog-boundary]");
const closeButton = required<HTMLButtonElement>("[data-dialog-close]");
const enter = required<HTMLAnchorElement>("[data-dialog-enter]");
```

核心打开/关闭实现：

```ts
let activeOpener: HTMLElement | null = null;
let mainInertBeforeOpen = main.inert;

const open = (productId: ProductId, opener: HTMLElement) => {
  if (dialog.open) return;
  const product = products.find(({ id }) => id === productId);
  if (!product) throw new RangeError(`Unknown product: ${productId}`);
  title.textContent = `${product.name} 产品说明`;
  purpose.textContent = product.details.purpose;
  steps.replaceChildren(...product.details.steps.map((text) => {
    const item = document.createElement("li");
    item.textContent = text;
    return item;
  }));
  scenarios.replaceChildren(...product.details.scenarios.map((text) => {
    const item = document.createElement("li");
    item.textContent = text;
    return item;
  }));
  capabilities.replaceChildren(...product.details.capabilityGroups.map((group) => {
    const section = document.createElement("section");
    const heading = document.createElement("h3");
    heading.textContent = group.label;
    const list = document.createElement("p");
    list.dataset.skillList = "";
    list.textContent = group.skills.join(" · ");
    section.append(heading, list);
    return section;
  }));
  duration.textContent = product.details.duration;
  boundary.textContent = product.details.boundary ?? "";
  boundary.hidden = product.details.boundary === undefined;
  enter.href = urls[product.id];
  enter.removeAttribute("target");
  activeOpener = opener;
  mainInertBeforeOpen = main.inert;
  main.inert = true;
  document.documentElement.dataset.productDialogScrollLock = "true";
  dialog.showModal();
  closeButton.focus({ preventScroll: true });
};

const close = () => {
  if (!dialog.open) return;
  dialog.close();
  main.inert = mainInertBeforeOpen;
  delete document.documentElement.dataset.productDialogScrollLock;
  activeOpener?.focus({ preventScroll: true });
  activeOpener = null;
};
```

dialog 使用 `aria-labelledby`、`aria-describedby`、`aria-modal="true"`，并用以下明确的键盘与销毁边界：

```ts
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const getFocusable = () =>
  [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)]
    .filter((element) =>
      !element.hidden
      && element.getAttribute("aria-hidden") !== "true");

const onCancel = (event: Event) => {
  event.preventDefault();
  close();
};

const onDialogKeyDown = (event: KeyboardEvent) => {
  if (!dialog.open) return;
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopImmediatePropagation();
    close();
    return;
  }
  if (event.key !== "Tab") return;
  const focusable = getFocusable();
  const first = focusable[0] ?? closeButton;
  const last = focusable.at(-1) ?? closeButton;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
};

dialog.addEventListener("cancel", onCancel);
document.addEventListener("keydown", onDialogKeyDown, true);
const onCloseButtonClick = () => close();
closeButton.addEventListener("click", onCloseButtonClick);

const destroy = () => {
  dialog.removeEventListener("cancel", onCancel);
  document.removeEventListener("keydown", onDialogKeyDown, true);
  closeButton.removeEventListener("click", onCloseButtonClick);
  if (dialog.open) dialog.close();
  main.inert = mainInertBeforeOpen;
  delete document.documentElement.dataset.productDialogScrollLock;
  activeOpener = null;
  dialog.remove();
};

return { open, close, destroy };
```

`destroy()` 不触发导航或焦点恢复。该 dialog 不复用 `createProductGuide()`，因此没有首访或 localStorage 语义。

- [ ] **Step 7: 实现三种合法 hash 的单次焦点**

```ts
const PRODUCT_HASHES = new Set(PRODUCT_IDS.map((id) => `#product-${id}`));

export function focusProductAnchor(root: ParentNode, hash: string): boolean {
  if (!PRODUCT_HASHES.has(hash)) return false;
  const heading = root.querySelector<HTMLElement>(`${hash} h3`);
  if (!heading) return false;
  requestAnimationFrame(() => heading.focus({ preventScroll: true }));
  return true;
}
```

只在初始化时调用一次；普通 `/`、`#products`、`#how-it-works` 和未知 hash 不改变焦点。

`src/main.ts` 用唯一的数据流绑定卡片、dialog 和初始 hash：

```ts
const urls = resolveShowcaseProductUrls(import.meta.env);
const view = renderShowcase(
  document.querySelector<HTMLElement>("#app")!,
  SHOWCASE_PRODUCTS,
  urls,
  import.meta.env.BASE_URL,
);
const productDialog = createProductDialog(
  view.main,
  SHOWCASE_PRODUCTS,
  urls,
);
for (const button of view.explainButtons) {
  button.addEventListener("click", () => {
    const productId = button.dataset.explainProduct as ProductId;
    productDialog.open(productId, button);
  });
}
focusProductAnchor(view.main, window.location.hash);
window.addEventListener("pagehide", () => productDialog.destroy(), {
  once: true,
});
```

- [ ] **Step 8: 加入真实浏览器守卫并跑桌面主旅程**

`tests/browser/fixtures.ts` 在每个测试后断言：`pageerror` 为 0、console error 为 0、失败响应不含 404。运行：

Hub manifest 加 `"test:browser": "playwright test"`。`playwright.config.ts` 使用单 worker、1440×900、`baseURL: "http://127.0.0.1:4172"`，webServer 命令是 `npm run dev`，`reuseExistingServer: false`。

既有审计文件虽以 `.png` 结尾，但文件头是 JPEG/JFIF；禁止只复制或改扩展名。启动浏览器测试前，用 Windows 当前实施环境自带的 `System.Drawing` 把三张真实验收图重采样为 800×500 的真实 PNG，并立即检查签名和总预算：

```powershell
Add-Type -AssemblyName System.Drawing
$previewRoot = 'apps\showcase-hub\public\previews'
New-Item -ItemType Directory -Force $previewRoot | Out-Null
$previewSources = [ordered]@{
  'monster-forge-review.png' = 'D:\codex_project_work\0728_some_github\.superpowers\mengto-skills-showcase-audit\screenshots\02-monster-forge-inspect.png'
  'ashfall-arena-combat.png' = 'D:\codex_project_work\0728_some_github\.superpowers\mengto-skills-showcase-audit\screenshots\03-ashfall-start.png'
  'mech-atelier-configurator.png' = 'D:\codex_project_work\0728_some_github\.superpowers\mengto-skills-showcase-audit\screenshots\05-mech-summary.png'
}
$pngSignature = [byte[]](137, 80, 78, 71, 13, 10, 26, 10)
$totalPreviewBytes = 0
foreach ($entry in $previewSources.GetEnumerator()) {
  $sourceImage = [System.Drawing.Image]::FromFile($entry.Value)
  try {
    $bitmap = New-Object System.Drawing.Bitmap 800, 500
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.InterpolationMode =
          [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.DrawImage($sourceImage, 0, 0, 800, 500)
      } finally {
        $graphics.Dispose()
      }
      $destination = Join-Path $previewRoot $entry.Key
      $bitmap.Save($destination, [System.Drawing.Imaging.ImageFormat]::Png)
      $bytes = [System.IO.File]::ReadAllBytes($destination)
      if (($bytes[0..7] -join ',') -ne ($pngSignature -join ',')) {
        throw "$destination is not a real PNG"
      }
      $totalPreviewBytes += $bytes.Length
    } finally {
      $bitmap.Dispose()
    }
  } finally {
    $sourceImage.Dispose()
  }
}
if ($totalPreviewBytes -ge 600KB) {
  throw "Preview total $totalPreviewBytes exceeds the 600 KiB budget"
}
```

当前三个源文件按上述固定 800×500 转换的探测总量是 `538,589 bytes`；执行时仍以实际输出和 Task 5 测试为准。Hub 验证记录必须写明源路径、源文件真实 JPEG 格式、800×500 PNG 转换和候选 SHA。

Run: `npm run test:browser --workspace @showcase/hub -- tests/browser/content.spec.ts tests/browser/dialog-navigation.spec.ts`

Expected: PASS；页面无 canvas、无 WebGL、无远程运行时请求，说明层和当前标签地址均可达。

- [ ] **Step 9: 提交 Task 4**

```powershell
git add apps/showcase-hub
git commit -m "feat: build the Chinese product showroom"
```

### Task 5: 加入真实预览、响应式回退和生产预算门禁

**Files:**
- Create: `apps/showcase-hub/tests/helpers/read-png-header.ts`
- Create: `apps/showcase-hub/tests/previews.test.ts`
- Create: `apps/showcase-hub/tests/verify-build.test.mjs`
- Create: `apps/showcase-hub/tests/browser/responsive.spec.ts`
- Create: `apps/showcase-hub/scripts/verify-build.mjs`
- Create: `apps/showcase-hub/playwright.production.config.ts`
- Create: `apps/showcase-hub/docs/VALIDATION.md`
- Modify: `apps/showcase-hub/src/ui/render-showcase.ts`
- Modify: `apps/showcase-hub/src/styles.css`
- Modify: `apps/showcase-hub/package.json`

**Interfaces:**
- Consumes: Task 4 的卡片 DOM 与说明 dialog。
- Produces: 固定预览资产、`inspectAssetInventory(assets): string[]`、`inspectHubBuild(distDir): Promise<string[]>`、390/320/reflow/reduced-motion/图片失败证据和 Hub 分层验证记录。

- [ ] **Step 1: 写 PNG 名称、尺寸、比例、替代文本与总预算失败测试**

```ts
const expected = [
  ["monster-forge-review.png", "怪物锻造所的怪物目录与实时模型检查器"],
  ["ashfall-arena-combat.png", "灰烬竞技场中的等距动作战斗与中文状态界面"],
  ["mech-atelier-configurator.png", "机甲定制工坊中的三维机甲与部件配置面板"],
] as const;

it("ships three 16:10 PNG previews under the 600 KiB combined budget", async () => {
  let total = 0;
  for (const [filename] of expected) {
    const path = new URL(`../public/previews/${filename}`, import.meta.url);
    const bytes = await readFile(path);
    const { width, height } = readPngHeader(bytes);
    expect({ width, height }).toEqual({ width: 800, height: 500 });
    total += bytes.byteLength;
  }
  expect(total).toBeLessThan(600 * 1024);
});

it("keeps fixed filenames and exact Chinese alt text", () => {
  expect(SHOWCASE_PRODUCTS.map((product) => [
    product.card.previewFilename,
    product.card.previewAlt,
  ])).toEqual(expected);
});
```

- [ ] **Step 2: 运行预览测试并确认 PNG 解析契约缺失**

Run: `npm test --workspace @showcase/hub -- tests/previews.test.ts`

Expected: FAIL；`tests/helpers/read-png-header.ts` 尚不存在，测试无法解析 PNG 元数据。

- [ ] **Step 3: 实现 PNG 头解析并核验三张既有真实验收截图**

```ts
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function readPngHeader(bytes: Buffer, filename = "PNG asset") {
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(`${filename} has an invalid PNG signature`);
  }
  if (bytes.toString("ascii", 12, 16) !== "IHDR") {
    throw new Error(`${filename} is missing the leading IHDR chunk`);
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width < 1 || height < 1) {
    throw new Error(`${filename} has invalid dimensions ${width}x${height}`);
  }
  return { width, height };
}
```

先读取来源和转换目标的字节数与 SHA-256；三个来源和三个目标都必须存在：

```powershell
$previewSources = @(
  'D:\codex_project_work\0728_some_github\.superpowers\mengto-skills-showcase-audit\screenshots\02-monster-forge-inspect.png'
  'D:\codex_project_work\0728_some_github\.superpowers\mengto-skills-showcase-audit\screenshots\03-ashfall-start.png'
  'D:\codex_project_work\0728_some_github\.superpowers\mengto-skills-showcase-audit\screenshots\05-mech-summary.png'
)
$previewTargets = @(
  'apps\showcase-hub\public\previews\monster-forge-review.png'
  'apps\showcase-hub\public\previews\ashfall-arena-combat.png'
  'apps\showcase-hub\public\previews\mech-atelier-configurator.png'
)
Get-Item -LiteralPath $previewSources
Get-Item -LiteralPath $previewTargets
Get-FileHash -LiteralPath $previewSources -Algorithm SHA256
Get-FileHash -LiteralPath $previewTargets -Algorithm SHA256
```

预期源尺寸分别为 `1425×891`、`1425×891`、`1440×900`，源总字节约 `209 KiB`，且真实格式是 JPEG/JFIF；转换目标均为 `800×500` 的真实 PNG，总字节小于 `600 KiB`。来源与目标因格式和尺寸转换，SHA-256 必然不同；只锁定三份来源哈希，并记录三份实际目标哈希。运行预览测试，Expected: PASS。

在 `apps/showcase-hub/docs/VALIDATION.md` 记录来源路径、源 JPEG/JFIF 魔数、来源/目标 SHA-256、原尺寸、800×500 PNG 转换、候选 `43ef034d06f341f525740fbfd243a6d9aabc0b20` 与证据提交 `2c03f5a889e35a9abb14c45a2077cb40d8ae59ad`，并明确这些图片来自既有本地验收截图，不是新生成概念图。

- [ ] **Step 4: 写 390px、320px、44px、回退与 reduced-motion 失败测试**

```ts
test("390px and 320px keep all actions operable without horizontal scroll", async ({ page }) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    expect(await page.evaluate(() =>
      document.documentElement.scrollWidth <= document.documentElement.clientWidth
    )).toBe(true);
    for (const target of await page.locator("a, button, input").all()) {
      if (!await target.isVisible()) continue;
      const box = await target.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box?.width).toBeGreaterThanOrEqual(44);
    }
  }
});

test("a 720px reflow proxy remains operable without claiming browser zoom", async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "先看 Ashfall Arena 说明" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth
  )).toBe(true);
});

test("failed preview requests preserve copy and both card actions", async ({ page }) => {
  await page.route("**/previews/*.png", (route) =>
    route.fulfill({ status: 404, body: "" }));
  await page.goto("/");
  await expect(page.locator("[data-preview-fallback]:visible")).toHaveCount(3);
  await expect(page.locator("[data-product-card] button")).toHaveCount(3);
  await expect(page.locator("[data-enter-product]")).toHaveCount(3);
});

test("reduced motion removes nonessential transitions", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const duration = await page.locator("[data-product-card]").first()
    .evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(["0s", "0.01ms"]).toContain(duration);
});
```

- [ ] **Step 5: 运行响应式测试并确认 CSS/图片回退缺失**

Run: `npm run test:browser --workspace @showcase/hub -- tests/browser/responsive.spec.ts`

Expected: FAIL；320px 溢出、目标尺寸、图片失败提示或 reduced-motion 至少一项尚未满足。

- [ ] **Step 6: 实现图片错误状态和响应式 CSS**

每张图片旁渲染一个默认 `hidden` 的真实文本节点：

```html
<div class="product-preview">
  <img width="1440" height="900">
  <p data-preview-fallback hidden>预览暂时不可用，仍可查看说明或进入体验。</p>
</div>
```

```ts
image.addEventListener("error", () => {
  image.hidden = true;
  fallback.hidden = false;
  article.dataset.previewState = "failed";
}, { once: true });
```

CSS 必须包含：

```css
* { box-sizing: border-box; }
html { color-scheme: dark; overflow-wrap: anywhere; }
body { min-inline-size: 0; margin: 0; }
.product-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.product-preview { aspect-ratio: 16 / 10; }
.product-preview img { inline-size: 100%; block-size: 100%; object-fit: cover; }
:is(a, button, summary) { min-block-size: 44px; }
dialog { max-block-size: calc(100dvh - 32px); }

@media (max-width: 960px) {
  .product-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 640px) {
  .product-grid { grid-template-columns: minmax(0, 1fr); }
  dialog {
    inline-size: 100%;
    max-inline-size: none;
    margin: auto 0 0;
  }
  .product-dialog-panel {
    max-block-size: 100dvh;
    padding-block-end: max(24px, env(safe-area-inset-bottom));
  }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 7: 写构建预算和远程运行时失败测试**

```js
import { Buffer } from "node:buffer";
import { inspectAssetInventory } from "../scripts/verify-build.mjs";
import { expect, it } from "vitest";

function seededBytes(length) {
  const bytes = Buffer.allocUnsafe(length);
  let state = 0x9e3779b9;
  for (let index = 0; index < length; index += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    bytes[index] = state & 0xff;
  }
  return bytes;
}

it("accepts a local-only build inside the JS and CSS gzip budgets", () => {
  expect(inspectAssetInventory([
    { path: "assets/index.js", bytes: Buffer.alloc(20_000) },
    { path: "assets/index.css", bytes: Buffer.alloc(10_000) },
    { path: "index.html", bytes: Buffer.from('<script src="./assets/index.js"></script>') },
  ])).toEqual([]);
});

it.each([
  ["assets/three-runtime.js", "Three.js"],
  ["index.html", "https://cdn.example.test/app.js"],
  ["assets/index.js", "127.0.0.1:4173"],
])("rejects forbidden production content in %s", (path, content) => {
  expect(inspectAssetInventory([{ path, bytes: Buffer.from(content) }]))
    .not.toEqual([]);
});

it("rejects gzip and preview totals beyond the fixed budgets", () => {
  expect(inspectAssetInventory([
    { path: "assets/oversize.js", bytes: seededBytes(90 * 1024) },
  ])).toContainEqual(expect.stringContaining("JavaScript gzip"));
  expect(inspectAssetInventory([
    { path: "previews/one.png", bytes: seededBytes(310 * 1024) },
    { path: "previews/two.png", bytes: seededBytes(310 * 1024) },
  ])).toContainEqual(expect.stringContaining("preview bytes"));
});
```

Run: `npm test --workspace @showcase/hub -- tests/verify-build.test.mjs`

Expected: FAIL；`scripts/verify-build.mjs` 尚未导出 `inspectAssetInventory`，不是 seeded fixture 自身失败。

- [ ] **Step 8: 实现生产审计并接入 build**

`scripts/verify-build.mjs` 使用 Node ESM，测试直接导入纯 inventory 函数，CLI 再递归读取 dist：

```js
import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

const limits = {
  javascriptGzip: 75 * 1024,
  cssGzip: 20 * 1024,
  previewBytes: 600 * 1024,
};
const forbiddenText = [
  /https?:\/\//i,
  /\bthree(?:\.module)?\b/i,
  /127\.0\.0\.1|localhost|\[::1\]/i,
];

export function inspectAssetInventory(assets) {
  const issues = [];
  let javascriptGzip = 0;
  let cssGzip = 0;
  let previewBytes = 0;
  for (const asset of assets) {
    const normalizedPath = asset.path.replaceAll("\\", "/");
    const extension = extname(normalizedPath).toLowerCase();
    if (extension === ".js") javascriptGzip += gzipSync(asset.bytes).byteLength;
    if (extension === ".css") cssGzip += gzipSync(asset.bytes).byteLength;
    if (/^previews\/[^/]+\.png$/i.test(normalizedPath)) {
      previewBytes += asset.bytes.byteLength;
    }
    if ([".html", ".js", ".css"].includes(extension)) {
      const text = asset.bytes.toString("utf8");
      for (const pattern of forbiddenText) {
        if (pattern.test(normalizedPath) || pattern.test(text)) {
          issues.push(`${normalizedPath} contains forbidden runtime text ${pattern}`);
        }
      }
    }
  }
  if (javascriptGzip > limits.javascriptGzip) {
    issues.push(`JavaScript gzip ${javascriptGzip} exceeds ${limits.javascriptGzip}`);
  }
  if (cssGzip > limits.cssGzip) {
    issues.push(`CSS gzip ${cssGzip} exceeds ${limits.cssGzip}`);
  }
  if (previewBytes >= limits.previewBytes) {
    issues.push(`preview bytes ${previewBytes} must stay below ${limits.previewBytes}`);
  }
  return issues;
}

async function collectAssets(rootDirectory, directory = rootDirectory) {
  const assets = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      assets.push(...await collectAssets(rootDirectory, absolutePath));
    } else if (entry.isFile()) {
      assets.push({
        path: relative(rootDirectory, absolutePath).replaceAll("\\", "/"),
        bytes: await readFile(absolutePath),
      });
    }
  }
  return assets;
}

export async function inspectHubBuild(distDir) {
  return inspectAssetInventory(await collectAssets(resolve(distDir)));
}

const invokedDirectly = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (invokedDirectly) {
  const distDir = process.argv[2]
    ?? fileURLToPath(new URL("../dist/", import.meta.url));
  const issues = await inspectHubBuild(distDir);
  if (issues.length > 0) {
    throw new Error(`Hub build verification failed:\n- ${issues.join("\n- ")}`);
  }
}
```

外部 URL 检查只扫描运行时 HTML/CSS/JS，不误判文档文字。Hub package scripts 固定为：

```json
"build": "tsc --noEmit && vite build && node scripts/verify-build.mjs",
"test:preview": "playwright test --config playwright.production.config.ts"
```

`playwright.production.config.ts` 使用单 worker、1440×900、`baseURL: "http://127.0.0.1:4272"`，webServer 命令为：

```text
npm run build && vite preview --host 127.0.0.1 --port 4272 --strictPort
```

- [ ] **Step 9: 运行单元、开发浏览器与生产预览**

Run: `npm test --workspace @showcase/hub`

Run: `npm run test:browser --workspace @showcase/hub`

Run: `npm run test:preview --workspace @showcase/hub`

Expected: PASS；三图预算、无远程依赖、无 Three、响应式、图片失败和生产入口全部通过。

- [ ] **Step 10: 提交 Task 5**

```powershell
git add apps/showcase-hub
git commit -m "feat: harden showroom responsive delivery"
```

### Phase 2 Review Gate

- [ ] 在 1440×900、390×844、320×844 和 720×900 重排代理中逐页检查首页、三卡、说明层、图片失败与 reduced-motion；临时截图只写入忽略的 `artifacts/showcase-hub/`。
- [ ] 运行 Hub 单元、开发浏览器、生产预览、包体门禁与 `git diff --check`；使用 `superpowers:requesting-code-review` 做独立内容/无障碍/视觉复审。
- [ ] 更新 Hub 和套件验证记录中 Phase 2 已证明的行；真实 200% 浏览器缩放和实体 safe-area 仍保持 `continue`，不以自动重排代理结案。

---

## Phase 3 — Monster 与 Mech 接入

### Task 6: 接入 Monster Forge 导览、返回地址和资产审阅小成功点

**Files:**
- Create: `apps/monster-forge/src/vite-env.d.ts`
- Create: `apps/monster-forge/src/showcase/resolve-hub-href.ts`
- Create: `apps/monster-forge/src/showcase/guide-content.ts`
- Create: `apps/monster-forge/tests/showcase-hub-url.test.ts`
- Create: `apps/monster-forge/tests/browser/guide.spec.ts`
- Create: `apps/monster-forge/tests/guide-storage-state.ts`
- Modify: `apps/monster-forge/package.json`
- Modify: `apps/monster-forge/index.html`
- Modify: `apps/monster-forge/src/main.ts`
- Modify: `apps/monster-forge/src/styles.css`
- Modify: `apps/monster-forge/playwright.config.ts`
- Modify: `apps/monster-forge/playwright.production.config.ts`
- Modify: `apps/monster-forge/docs/VALIDATION.md`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: `createProductGuide()`, `resolveProductHubHref()`, `@showcase/showcase-guide/styles.css`。
- Produces: `resolveMonsterForgeHubHref(env, currentHref)`、版本 1 中文导览、capture 模式隔离和“Glass Crawler + 骨架”小成功点。

- [ ] **Step 1: 写 DEV/PROD/显式覆盖的返回地址失败测试**

```ts
it.each([
  [{ DEV: true }, "http://127.0.0.1:4172/#product-monster-forge"],
  [{ DEV: false }, "https://example.test/#product-monster-forge"],
  [{ DEV: false, VITE_SHOWCASE_HUB_URL: "../" },
    "https://example.test/demos/#product-monster-forge"],
])("resolves the Monster Forge hub return", (env, expected) => {
  expect(resolveMonsterForgeHubHref(
    env,
    "https://example.test/demos/monster-forge/",
  )).toBe(expected);
});
```

- [ ] **Step 2: 运行 URL 测试并确认宿主解析器缺失**

Run: `npm test --workspace @showcase/monster-forge -- showcase-hub-url`

Expected: FAIL；`src/showcase/resolve-hub-href.ts` 不存在。

- [ ] **Step 3: 实现宿主回退并定义精确中文内容**

```ts
export function resolveMonsterForgeHubHref(
  env: { DEV: boolean; VITE_SHOWCASE_HUB_URL?: string },
  currentHref: string,
): string {
  const base = env.VITE_SHOWCASE_HUB_URL
    ?? (env.DEV ? "http://127.0.0.1:4172/" : "/");
  return resolveProductHubHref(base, "monster-forge", currentHref);
}
```

```ts
export const MONSTER_FORGE_GUIDE = {
  productId: "monster-forge",
  guideVersion: 1,
  title: "怪物锻造所｜三步体验",
  purpose: "在同一个工作台检查怪物模型、动作和技术叠加。",
  steps: [
    "在左侧目录选择另一个怪物。",
    "切换动作，并打开骨架、碰撞体或挂点。",
    "查看来源、尺寸和模型技术信息。",
  ],
  capability: "把模型来源、动作、骨架、碰撞体和挂点放在同一个可审阅表面。",
  business: "适合游戏资产库、角色编辑器和数字资产验收，减少沟通与返工。",
  duration: "预计 2–3 分钟",
  desktopControls: ["点击目录卡切换怪物", "点击动作按钮切换动作", "勾选技术叠加"],
  touchControls: ["轻触目录卡切换怪物", "轻触动作和技术叠加", "在模型上拖动旋转、双指缩放"],
} as const;
```

- [ ] **Step 4: 写首访、重开、Escape、返回和小成功点失败测试**

```ts
test.use({ storageState: { cookies: [], origins: [] } });

test("first visit explains the asset-review task and can be reopened", async ({ page }) => {
  await page.goto("/");
  const dialog = page.getByRole("dialog", { name: /怪物锻造所/ });
  await expect(dialog).toContainText("在左侧目录选择另一个怪物");
  await page.getByRole("button", { name: "开始体验" }).click();
  await page.getByRole("button", { name: "这是什么？" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "这是什么？" })).toBeFocused();
});

test("returns in the same tab with the Monster anchor", async ({ page }) => {
  await page.goto("/");
  const link = page.getByRole("link", { name: "返回能力展厅" });
  await expect(link).not.toHaveAttribute("target");
  await expect(link).toHaveAttribute("href", /#product-monster-forge$/);
});

test("a blocked localStorage getter does not remove the Monster guide", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() { throw new DOMException("blocked", "SecurityError"); },
    });
  });
  await page.goto("/");
  await expect(page.getByRole("dialog", { name: /怪物锻造所/ })).toBeVisible();
  await page.getByRole("button", { name: "关闭说明" }).click();
  await page.getByRole("button", { name: "这是什么？" }).click();
  await expect(page.getByRole("dialog", { name: /怪物锻造所/ })).toBeVisible();
});

test("WebGL fallback retains the guide and hub return", async ({ page }) => {
  await page.goto("/?reviewControls=1&forceWebglFailure=1");
  await expect(page.getByRole("dialog", { name: /怪物锻造所/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "返回能力展厅" }))
    .toHaveAttribute("href", /#product-monster-forge$/);
  await page.getByRole("button", { name: "开始体验" }).click();
  await expect(page.locator(".scene-fallback")).toBeVisible();
  await expect(page.getByRole("button", { name: "这是什么？" })).toBeVisible();
});

test("catalog capture mode stays free of onboarding chrome", async ({ page }) => {
  await page.goto("/?capture=1");
  await expect(page.getByRole("dialog", { name: /怪物锻造所/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "这是什么？" })).toHaveCount(0);
});

test("completes the observable asset-review success", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开始体验" }).click();
  await page.getByRole("button", { name: /Glass Crawler/ }).click();
  await page.getByRole("checkbox", { name: /骨架/ }).check();
  await expect(page.getByRole("button", { name: /Glass Crawler/ }))
    .toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: /Glass Crawler/ })).toBeVisible();
  await expect(page.locator("[data-overlay-status]")).toContainText("骨架");
  await expect(page.locator("canvas")).toHaveCount(1);
});
```

- [ ] **Step 5: 运行 guide 浏览器测试并确认按钮/dialog 缺失**

Run: `npm run test:browser --workspace @showcase/monster-forge -- guide`

Expected: FAIL；找不到首访 dialog 或持久“这是什么？”按钮。

- [ ] **Step 6: 在 capture 分支外创建并销毁导览**

在 package dependencies 加入：

```json
"@showcase/showcase-guide": "*"
```

在 `src/main.ts` 顶部导入包与样式；把现有 `#app` 作为 background host 传入，使 dialog 打开时整个产品界面 inert。URL 只通过配置对象和 DOM `href` 属性传入，不拼入 HTML 字符串：

```ts
import {
  createProductGuide,
  type ProductGuideController,
} from "@showcase/showcase-guide";
import "@showcase/showcase-guide/styles.css";

let guide: ProductGuideController | null = null;
if (!captureMode) {
  guide = createProductGuide(app, {
    ...MONSTER_FORGE_GUIDE,
    hubHref: resolveMonsterForgeHubHref(import.meta.env, window.location.href),
  });
}

window.addEventListener("pagehide", () => {
  guide?.destroy();
  unsubscribe();
  scene?.dispose();
}, { once: true });
```

`?capture=1` 不创建入口或 dialog，保证内部目录资产捕获干净；正常 review、WebGL 回退和普通路径都保留导览。

- [ ] **Step 7: 为旧浏览器矩阵预置隐藏偏好**

```ts
export function hiddenMonsterGuideState(origin: string) {
  return {
    cookies: [],
    origins: [{
      origin,
      localStorage: [{
        name: "mengto-showcase:guide:monster-forge:v1:auto-hidden",
        value: "true",
      }],
    }],
  };
}
```

开发和生产 Playwright config 使用各自 `baseURL` 的 origin；`guide.spec.ts` 文件级覆盖为空状态。这样既有资产、性能和回退测试保持原先的立即交互语义。

- [ ] **Step 8: 加入页面标识、宿主强调色并跑完整回归**

`index.html` 加：

```html
<meta name="showcase-app" content="monster-forge">
```

`src/styles.css` 只覆盖语义变量：

```css
#app {
  --showcase-guide-accent: #f59e5b;
  --showcase-guide-surface: #191713;
}
```

Run: `npm install --package-lock-only`

Run: `npm test --workspace @showcase/monster-forge`

Run: `npm run test:browser --workspace @showcase/monster-forge`

Run: `npm run test:preview --workspace @showcase/monster-forge`

Expected: PASS；正常、review、capture、WebGL 回退均无新增 canvas、监听器或控制台错误。

- [ ] **Step 9: 更新 Monster 验证记录并提交**

记录首访、重开、Escape、存储失败、返回地址、小成功点、WebGL 回退、候选 SHA 和本轮实际命令；历史候选结果仍明确标为历史，不冒充重跑。

```powershell
git add apps/monster-forge package-lock.json
git commit -m "feat: onboard Monster Forge visitors"
```

### Task 7: 接入 Mech Atelier 导览、移动面板协调和配置小成功点

**Files:**
- Create: `apps/mech-atelier/src/vite-env.d.ts`
- Create: `apps/mech-atelier/src/showcase/resolve-hub-href.ts`
- Create: `apps/mech-atelier/src/showcase/guide-content.ts`
- Create: `apps/mech-atelier/tests/showcase-hub-url.test.ts`
- Create: `apps/mech-atelier/tests/browser/guide.spec.ts`
- Create: `apps/mech-atelier/tests/guide-storage-state.ts`
- Modify: `apps/mech-atelier/package.json`
- Modify: `apps/mech-atelier/index.html`
- Modify: `apps/mech-atelier/src/main.ts`
- Modify: `apps/mech-atelier/src/styles.css`
- Modify: `apps/mech-atelier/playwright.config.ts`
- Modify: `apps/mech-atelier/playwright.production.config.ts`
- Modify: `apps/mech-atelier/tests/browser/share.spec.ts`
- Modify: `apps/mech-atelier/docs/VALIDATION.md`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: Task 2 的共享导览和 Task 6 已验证的宿主 URL 模式。
- Produces: `resolveMechAtelierHubHref()`、移动配置面板无焦点抢夺关闭选项和“更换 Halo 头部 + 摘要/URL 联动”小成功点。

- [ ] **Step 1: 写 Mech URL 和移动面板焦点行为失败测试**

```ts
it("appends the fixed Mech anchor to dev, prod and relative hub bases", () => {
  expect(resolveMechAtelierHubHref({ DEV: true }, "http://127.0.0.1:4175/"))
    .toBe("http://127.0.0.1:4172/#product-mech-atelier");
  expect(resolveMechAtelierHubHref({ DEV: false }, "https://example.test/mech/"))
    .toBe("https://example.test/#product-mech-atelier");
  expect(resolveMechAtelierHubHref(
    { DEV: false, VITE_SHOWCASE_HUB_URL: "../" },
    "https://example.test/demos/mech-atelier/",
  )).toBe("https://example.test/demos/#product-mech-atelier");
});
```

```ts
test("opening the guide closes the mobile configuration sheet without focus theft", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "开始体验" }).click();
  await page.getByRole("button", { name: "开始配置" }).click();
  await page.getByRole("button", { name: "这是什么？" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-configuration-sheet", "closed");
  await expect(page.getByRole("dialog", { name: /机甲定制工坊/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "关闭配置" })).not.toBeFocused();
});
```

- [ ] **Step 2: 运行失败测试**

Run: `npm test --workspace @showcase/mech-atelier -- showcase-hub-url`

Run: `npm run test:browser --workspace @showcase/mech-atelier -- guide`

Expected: FAIL；解析器、导览和不恢复焦点的配置面板关闭参数尚不存在。

- [ ] **Step 3: 定义 Mech 内容和返回解析**

```ts
export const MECH_ATELIER_GUIDE = {
  productId: "mech-atelier",
  guideVersion: 1,
  title: "机甲定制工坊｜三步体验",
  purpose: "更换机甲部件，并立即观察 3D 外观、价格和性能参数变化。",
  steps: [
    "更换机体、头部、装甲或武器。",
    "查看负载、火力、防御和兼容性变化。",
    "尝试拆解视图、分享配置或导出海报。",
  ],
  capability: "把三维商品、选项兼容性、参数摘要和可分享状态连成一条配置流程。",
  business: "可迁移到汽车、工业设备、家具和定制商品展示与销售。",
  duration: "预计 3–5 分钟",
  desktopControls: ["点击选项更换部件", "拖动模型旋转、滚轮缩放", "使用摘要和分享操作"],
  touchControls: ["打开底部配置面板", "轻触选项更换部件", "在模型上拖动旋转"],
} as const;
```

`resolveMechAtelierHubHref()` 的完整实现：

```ts
export function resolveMechAtelierHubHref(
  env: { DEV: boolean; VITE_SHOWCASE_HUB_URL?: string },
  currentHref: string,
): string {
  const base = env.VITE_SHOWCASE_HUB_URL
    ?? (env.DEV ? "http://127.0.0.1:4172/" : "/");
  return resolveProductHubHref(base, "mech-atelier", currentHref);
}
```

- [ ] **Step 4: 扩展配置面板 API 并创建导览**

```ts
function setConfigurationPanel(
  open: boolean,
  options: { restoreFocus?: boolean } = {},
): void {
  const { restoreFocus = true } = options;
  document.documentElement.dataset.configurationSheet =
    open ? "open" : "closed";
  if (open) {
    window.setTimeout(() => {
      configurationPanel.querySelector<HTMLElement>("input:checked")
        ?.focus({ preventScroll: true });
    }, 0);
  } else if (restoreFocus) {
    openConfigButton.focus({ preventScroll: true });
  }
}
```

在 package dependencies 加入 `"@showcase/showcase-guide": "*"` 并运行 `npm install --package-lock-only`。

在所有 DOM 引用就绪、进入 WebGL `try` 之前创建导览，使 fallback 也有入口：

```ts
const guide = createProductGuide(app, {
  ...MECH_ATELIER_GUIDE,
  hubHref: resolveMechAtelierHubHref(import.meta.env, window.location.href),
  onOpen() {
    if (document.documentElement.dataset.configurationSheet === "open") {
      setConfigurationPanel(false, { restoreFocus: false });
    }
  },
});
```

把现有 wordmark 的 `href="/"` 改为 `href="./"`，让它保持产品主页语义；只有导览中的链接返回能力展厅。

- [ ] **Step 5: 写首访、存储失败、返回和配置小成功点失败测试**

```ts
test.use({ storageState: { cookies: [], origins: [] } });

test("reopens after Escape and returns to the Mech card in the same tab", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "这是什么？" }).click();
  const link = page.getByRole("link", { name: "返回能力展厅" });
  await expect(link).not.toHaveAttribute("target");
  await expect(link).toHaveAttribute("href", /#product-mech-atelier$/);
});

test("a blocked localStorage getter keeps Mech onboarding usable", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() { throw new DOMException("blocked", "SecurityError"); },
    });
  });
  await page.goto("/");
  await expect(page.getByRole("dialog", { name: /机甲定制工坊/ })).toBeVisible();
  await page.getByRole("button", { name: "关闭说明" }).click();
  await page.getByRole("button", { name: "这是什么？" }).click();
  await expect(page.getByRole("dialog", { name: /机甲定制工坊/ })).toBeVisible();
});

test("WebGL fallback retains Mech onboarding and return", async ({ page }) => {
  await page.goto("/?reviewControls=1&forceWebglFailure=1");
  await expect(page.getByRole("dialog", { name: /机甲定制工坊/ })).toBeVisible();
  await page.getByRole("button", { name: "开始体验" }).click();
  await expect(page.getByText("3D 预览不可用")).toBeVisible();
  await expect(page.getByRole("button", { name: "这是什么？" })).toBeVisible();
  await expect(page.getByRole("link", { name: "返回能力展厅" }))
    .toHaveAttribute("href", /#product-mech-atelier$/);
});

test("changes one part and exposes linked summary and canonical URL", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开始体验" }).click();
  await page.getByRole("radio", { name: /光环头部/ }).check();
  await expect(page.locator("[data-summary-price]")).toContainText("194,000");
  await expect(page.locator("[data-summary-weight]")).toContainText("29 / 32 kg");
  await expect(page.locator("[data-summary-power]")).toContainText("66");
  await expect(page.locator("[data-summary-guard]")).toContainText("43");
  await expect(page.locator("[data-summary-mobility]")).toContainText("74");
  await expect(page).toHaveURL(/v=1.*c=strider-scout.*h=halo-head/);
  await expect(page.locator("canvas")).toHaveCount(1);
});
```

- [ ] **Step 6: 保护既有 storage 故障和 review 测试**

开发/生产 Playwright config 默认预置：

```text
mengto-showcase:guide:mech-atelier:v1:auto-hidden=true
```

`tests/guide-storage-state.ts`：

```ts
export function hiddenMechGuideState(origin: string) {
  return {
    cookies: [],
    origins: [{
      origin,
      localStorage: [{
        name: "mengto-showcase:guide:mech-atelier:v1:auto-hidden",
        value: "true",
      }],
    }],
  };
}
```

`guide.spec.ts` 覆盖为空状态。现有 `share.spec.ts` 的 localStorage getter 失败用例在触发存储异常前，通过真实“开始体验”或“关闭说明”按钮结算首访导览；不得通过生产查询参数禁用新行为。

- [ ] **Step 7: 设置标识、z-index、销毁顺序并跑完整回归**

加入：

```html
<meta name="showcase-app" content="mech-atelier">
```

共享导览前景层高于现有移动按钮 `z-index: 30` 和配置面板 `z-index: 40`：

```css
#app {
  --showcase-guide-accent: #55c7d9;
}
.showcase-guide-trigger { z-index: 50; }
dialog.showcase-guide-dialog { z-index: 60; }
```

现有 `pagehide` 先执行 persistence flush，再 `guide.destroy()`，之后销毁 Three.js 与其余监听器；导览销毁不调用配置面板焦点恢复。

Run: `npm test --workspace @showcase/mech-atelier`

Run: `npm run test:browser --workspace @showcase/mech-atelier`

Run: `npm run test:preview --workspace @showcase/mech-atelier`

Expected: PASS；默认、移动配置、分享、存储异常、WebGL fallback、海报、性能和导览均通过。

- [ ] **Step 8: 更新 Mech 验证记录并提交**

```powershell
git add apps/mech-atelier package-lock.json
git commit -m "feat: onboard Mech Atelier visitors"
```

### Phase 3 Review Gate

- [ ] 分别运行 Monster 与 Mech 的单元、开发浏览器、生产预览和根 `git diff --check`；检查每个应用仍只有一个 canvas，普通体验、review、capture/fallback 与分享状态不受导览污染。
- [ ] 使用 `superpowers:requesting-code-review` 独立复审 package 生命周期、storage 默认状态、移动 z-index、pagehide 顺序和同标签地址。
- [ ] 把两款产品首访、重开、返回和小成功点的执行账本行改为带候选 SHA 的 `pass`；未执行的跨应用真实往返仍为 `continue`。

---

## Phase 4 — Ashfall 独立门禁接入

### Task 8: 建立 Ashfall 首帧门禁、音频解锁边界和冻结帧

**Files:**
- Create: `apps/ashfall-arena/src/vite-env.d.ts`
- Create: `apps/ashfall-arena/src/showcase/resolve-hub-href.ts`
- Create: `apps/ashfall-arena/src/showcase/guide-content.ts`
- Create: `apps/ashfall-arena/tests/showcase-hub-url.test.ts`
- Create: `apps/ashfall-arena/tests/browser/onboarding-guide.spec.ts`
- Create: `apps/ashfall-arena/tests/guide-storage-state.ts`
- Modify: `apps/ashfall-arena/package.json`
- Modify: `apps/ashfall-arena/index.html`
- Modify: `apps/ashfall-arena/src/feedback/create-audio.ts`
- Modify: `apps/ashfall-arena/tests/audio-feedback.test.ts`
- Modify: `apps/ashfall-arena/src/main.ts`
- Modify: `apps/ashfall-arena/src/styles.css`
- Modify: `apps/ashfall-arena/playwright.config.ts`
- Modify: `apps/ashfall-arena/playwright.performance.config.ts`
- Modify: `apps/ashfall-arena/playwright.production.config.ts`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: 共享 `retryAutoOpen()` 和三个关闭原因。
- Produces: `resolveAshfallHubHref()`、音频选项 `canUnlock?: (event: Event) => boolean`、运行时局部 `guideGateOpen`、诊断字段 `guideGateOpen`、`guideOpen`、`inputSampleCount`、`presentationSeconds`、`audio`。

- [ ] **Step 1: 写门禁手势不得创建/恢复 AudioContext 的失败测试**

```ts
it("rejects trusted guide gestures until gameplay owns the next gesture", () => {
  let guideGateOpen = true;
  const gestures = new ListenerTarget();
  const visibility = new VisibilityTarget();
  const context = new RecoveringAudioContext([true]);
  let factoryCalls = 0;
  const audio = createAudioFeedback({
    storage: null,
    gestureTarget: gestures as unknown as Window,
    visibilityDocument: visibility as unknown as Document,
    contextFactory: () => {
      factoryCalls += 1;
      return context as unknown as AudioContext;
    },
    canUnlock: () => !guideGateOpen,
  });
  gestures.fire("pointerdown");
  gestures.fire("keydown");
  expect(factoryCalls).toBe(0);
  guideGateOpen = false;
  gestures.fire("pointerdown");
  expect(factoryCalls).toBe(1);
  audio.dispose();
});
```

- [ ] **Step 2: 运行音频测试并确认 guide 手势仍会解锁**

Run: `npm test --workspace @showcase/ashfall-arena -- audio-feedback`

Expected: FAIL；`createAudioFeedback` 不接受 `canUnlock`，或门禁点击仍调用 context factory/resume。

- [ ] **Step 3: 在捕获阶段前拒绝解锁手势**

```ts
export function createAudioFeedback(options: {
  storage: AudioSettingsStorage | null;
  gestureTarget?: Window;
  visibilityDocument?: Document;
  canUnlock?: (event: Event) => boolean;
  contextFactory?: () => AudioContext;
}): AudioFeedback {
  const unlockFromGesture = (event: Event) => {
    if (options.canUnlock?.(event) === false) return;
    requestResume();
  };
}
```

检查必须位于现有 capture listener 内、`requestResume()` 之前。因为 capture 在目标按钮处理器之前运行，“开始体验”、关闭和 Escape 对应手势都保持被拒绝；门禁关闭后的下一次真实游戏手势才解锁。

- [ ] **Step 4: 写首次打开必须早于第一 RAF/输入且冻结全部时钟的失败测试**

```ts
test.use({ storageState: { cookies: [], origins: [] } });

test("first visit gates before the first RAF and input sample", async ({ page }) => {
  await page.goto("/?reviewControls=1&guideReview=1");
  const before = await page.evaluate(() => window.__ashfallDiagnostics!.snapshot());
  expect(before.guideGateOpen).toBe(true);
  expect(before.guideOpen).toBe(true);
  expect(before.inputSampleCount).toBe(0);
  expect(before.tick).toBe(0);
});

test("gated frames render a frozen background without advancing simulation or presentation", async ({ page }) => {
  await page.goto("/?reviewControls=1&guideReview=1");
  const before = await page.evaluate(() => window.__ashfallDiagnostics!.snapshot());
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => window.__ashfallDiagnostics!.snapshot());
  expect(after.tick).toBe(before.tick);
  expect(after.player).toEqual(before.player);
  expect(after.inputSampleCount).toBe(before.inputSampleCount);
  expect(after.presentationSeconds).toEqual(before.presentationSeconds);
  expect(after.audio).toEqual(before.audio);
  expect(after.performance.renderer.submittedFrames)
    .toBeGreaterThan(before.performance.renderer.submittedFrames);
});
```

- [ ] **Step 5: 运行首帧测试并确认游戏在导览下推进**

Run (working directory `apps/ashfall-arena`): `$env:ASHFALL_PLAYWRIGHT_PORT='4194'; npx playwright test --config playwright.config.ts onboarding-guide.spec.ts`

Expected: FAIL；首访 dialog 缺失，或 tick/input/presentation 诊断继续增加。

- [ ] **Step 6: 定义 Ashfall 内容、地址和 review 隔离**

`tests/showcase-hub-url.test.ts` 先断言 DEV、PROD 和相对组合地址：

```ts
expect(resolveAshfallHubHref(
  { DEV: true },
  "http://127.0.0.1:4174/",
)).toBe("http://127.0.0.1:4172/#product-ashfall-arena");
expect(resolveAshfallHubHref(
  { DEV: false },
  "https://example.test/ashfall/",
)).toBe("https://example.test/#product-ashfall-arena");
expect(resolveAshfallHubHref(
  { DEV: false, VITE_SHOWCASE_HUB_URL: "../" },
  "https://example.test/demos/ashfall-arena/",
)).toBe("https://example.test/demos/#product-ashfall-arena");
```

实现：

```ts
export function resolveAshfallHubHref(
  env: { DEV: boolean; VITE_SHOWCASE_HUB_URL?: string },
  currentHref: string,
): string {
  const base = env.VITE_SHOWCASE_HUB_URL
    ?? (env.DEV ? "http://127.0.0.1:4172/" : "/");
  return resolveProductHubHref(base, "ashfall-arena", currentHref);
}
```

```ts
export const ASHFALL_GUIDE = {
  productId: "ashfall-arena",
  guideVersion: 1,
  title: "灰烬竞技场｜先学会四个动作",
  purpose: "直接体验战斗、敌人 AI、成长和反馈组成的动作游戏切片。",
  steps: [
    "先练习移动、攻击、闪避和格挡。",
    "击败普通敌人与钟甲精英。",
    "选择一次升级，再决定是否继续挑战 Boss。",
  ],
  capability: "把战斗手感、敌人 AI、关卡、成长、视觉与声音反馈组合成可玩的完整切片。",
  business: "适合游戏原型、互动营销和战斗系统验证。",
  duration: "3–5 分钟了解核心操作；完整首次挑战仍需 8–12 分钟真人验证",
  desktopControls: ["WASD 移动", "鼠标左键或 J 攻击", "Space 闪避", "鼠标右键或 K 格挡"],
  touchControls: ["左侧摇杆移动", "右侧按钮攻击", "使用闪避、格挡和治疗按钮"],
} as const;
```

普通产品 URL 始终创建导览并按真实首访语义运行。为保持既有确定性审阅矩阵不变，`?reviewControls=1` 时整个导览集成默认不创建；只有同时带 `guideReview=1` 才创建入口和首访 dialog。该分支只存在于 review 表面，不影响普通访客。

- [ ] **Step 7: 在 HUD 就绪后、第一次渲染与 RAF 前同步建立门禁**

`src/main.ts` 导入：

```ts
import {
  createProductGuide,
  type ProductGuideController,
} from "@showcase/showcase-guide";
import "@showcase/showcase-guide/styles.css";
```

先在 `createInputAdapter` 之前声明门禁、计数器和可空控制器，使 audio 的捕获监听器能读取门禁：

```ts
let guideGateOpen = false;
let inputSampleCount = 0;
let guide: ProductGuideController | null = null;
const presentationSeconds = {
  entitySync: 0,
  vfx: 0,
  hud: 0,
  camera: 0,
};
const guideEnabled =
  !reviewControls || query.get("guideReview") === "1";
```

创建 audio 时传：

```ts
const audio = createAudioFeedback({
  storage: saveStorage,
  gestureTarget: window,
  visibilityDocument: document,
  canUnlock: () => !guideGateOpen,
});
```

在 `createHudController` 已创建后，且在当前 `playerTarget.set(...)` 初始渲染与首个 `requestAnimationFrame(frame)` 之前同步创建：

```ts
if (guideEnabled) {
  guide = createProductGuide(app, {
    ...ASHFALL_GUIDE,
    hubHref: resolveAshfallHubHref(import.meta.env, window.location.href),
    canOpen: () =>
      state.status === "playing" &&
      !state.paused &&
      !hud?.hasOpenDialog(),
    onOpen() {
      guideGateOpen = true;
      input.clear();
      accumulator.reset();
      previousTimestamp = null;
      audio.setPaused(true);
    },
    onClose() {
      guideGateOpen = false;
      input.clear();
      accumulator.reset();
      previousTimestamp = null;
      audio.setPaused(state.paused || state.status === "upgrade");
    },
  });
}
```

导览同步打开后允许现有的单次 `synchronizer.sync(state)` 和 `arena.render(camera)` 完成零时间初始化，形成可读冻结背景；这两个初始化调用不采样输入、不传 frameDelta、不更新 presentation 计数。之后所有 RAF 都先走 Step 8 的门禁分支。

不要调用 `onResume()`、不要合成 `PAUSE_INTENT`、不要改 `state.paused`、不要写 save。

- [ ] **Step 8: 在帧入口重试待处理自动打开并走冻结渲染分支**

```ts
const routeDialogInput = (intent: GameIntent): boolean => {
  const axis =
    Math.abs(intent.moveY) >= Math.abs(intent.moveX)
      ? intent.moveY
      : intent.moveX;
  const nextLatch = axis > 0.55 ? -1 : axis < -0.55 ? 1 : 0;
  if (nextLatch !== 0 && menuAxisLatch === 0) {
    hud?.moveDialogFocus(nextLatch);
  }
  menuAxisLatch = nextLatch;
  if (intent.attackPressed) {
    hud?.activateFocusedAction();
    input.clear();
    return false;
  }
  return state.paused && intent.pausePressed;
};

const step = (fixedDelta: number) => {
  if (guideGateOpen) return;
  inputSampleCount += 1;
  const intent = input.sample();
  if (hud?.hasOpenDialog()) {
    if (!routeDialogInput(intent)) return;
  } else {
    menuAxisLatch = 0;
  }
  const result = stepGame(state, intent, fixedDelta, arenaContent);
  state = applyReviewEnemyHealthCap(result.state);
  routeGameplayEvents(result.events);
  persistFromEvents(result.events);
  audio.setPaused(state.paused || state.status === "upgrade");
};

const frame = (timestamp: number) => {
  if (disposed) return;
  guide?.retryAutoOpen();
  if (guideGateOpen) {
    previousTimestamp = null;
    arena.render(camera);
    renderSubmissionCount += 1;
    frameCount += 1;
    frameRequest = requestAnimationFrame(frame);
    return;
  }
};
```

冻结分支插在任何 `frameDelta` 或 sampler 计算之前；live 分支继续按 frameDelta → quality → accumulator → entity sync → VFX → HUD → camera → render 的固定顺序，并在四个实际更新调用之后增加计数：

```ts
synchronizer.sync(state, frameDelta);
presentationSeconds.entitySync += frameDelta;
vfx.update(frameDelta, presentationPaused);
presentationSeconds.vfx += frameDelta;
hud?.updatePresentation(frameDelta, presentationPaused);
presentationSeconds.hud += frameDelta;
cameraController.update(playerTarget, frameDelta);
presentationSeconds.camera += frameDelta;
```

冻结分支不得调用 `performanceSampler.recordFrame`、`qualityController.recordFrame`、`accumulator.advance`、`synchronizer.sync`、`vfx.sync/update`、`hud.updatePresentation/render`、`cameraController.update` 或 `consumePresentationEvents`。Snapshot 暴露计数器副本以及：

```ts
audio: {
  paused: audio.getDiagnostics().paused,
  contextState: audio.getDiagnostics().contextState,
  contextCreateCount: audio.getDiagnostics().contextCreateCount,
  playedCueCount: audio.getDiagnostics().playedCueCount,
},
```

- [ ] **Step 9: 关闭引导后证明真实移动与攻击**

```ts
test("Start releases only the guide gate and real input moves and attacks", async ({ page }) => {
  await page.goto("/?fixture=fresh&reviewControls=1&guideReview=1");
  const before = await page.evaluate(() =>
    window.__ashfallDiagnostics!.snapshot());
  await page.getByRole("button", { name: "开始体验" }).click();
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(180);
  await page.keyboard.up("KeyW");
  await page.keyboard.press("KeyJ");
  await expect.poll(() => page.evaluate(() =>
    window.__ashfallDiagnostics!.snapshot().player.z
  )).not.toBe(before.player.z);
  await expect.poll(() => page.evaluate(() =>
    window.__ashfallDiagnostics!.snapshot().recentEvents.filter(
      ({ event }) =>
        event.type === "action-started" &&
        event.actorId === "player" &&
        event.actionId !== "dodge",
    ).length
  )).toBeGreaterThan(0);
  const after = await page.evaluate(() =>
    window.__ashfallDiagnostics!.snapshot());
  expect(after.guideGateOpen).toBe(false);
  expect(after.paused).toBe(before.paused);
});
```

断言移动坐标不同于初始值且攻击事件数大于 0；不要求完成 Boss。

- [ ] **Step 10: 加入标识、默认测试偏好并运行 Task 8 回归**

加入：

```html
<meta name="showcase-app" content="ashfall-arena">
```

`src/styles.css` 只覆盖宿主语义变量并把入口放在 HUD 前景层之上：

```css
#app {
  --showcase-guide-accent: #ef6557;
  --showcase-guide-surface: #1d1515;
}
.showcase-guide-trigger { z-index: 70; }
```

普通、性能和生产 config 为各自 origin 预置 `mengto-showcase:guide:ashfall-arena:v1:auto-hidden=true`；`onboarding-guide.spec.ts` 覆盖为空状态并显式使用 `guideReview=1`。

`tests/guide-storage-state.ts`：

```ts
export function hiddenAshfallGuideState(origin: string) {
  return {
    cookies: [],
    origins: [{
      origin,
      localStorage: [{
        name: "mengto-showcase:guide:ashfall-arena:v1:auto-hidden",
        value: "true",
      }],
    }],
  };
}
```

在 package dependencies 加入 `"@showcase/showcase-guide": "*"`，然后运行 `npm install --package-lock-only`。

Run: `npm test --workspace @showcase/ashfall-arena -- audio-feedback showcase-hub-url`

Run (working directory `apps/ashfall-arena`): `$env:ASHFALL_PLAYWRIGHT_PORT='4194'; npx playwright test --config playwright.config.ts onboarding-guide.spec.ts`

Expected: PASS；首帧 tick/input 为 0，冻结帧只增加 renderer 提交，开始后真实输入可观察。

- [ ] **Step 11: 提交 Task 8**

```powershell
git add apps/ashfall-arena package-lock.json
git commit -m "feat: gate Ashfall onboarding before gameplay"
```

### Task 9: 覆盖 Ashfall 对话框状态矩阵、回退、重复生命周期和销毁

**Files:**
- Modify: `apps/ashfall-arena/tests/browser/onboarding-guide.spec.ts`
- Modify: `apps/ashfall-arena/src/main.ts`
- Modify: `apps/ashfall-arena/docs/VALIDATION.md`

**Interfaces:**
- Consumes: Task 8 的 `guideGateOpen`、`retryAutoOpen()`、review diagnostics。
- Produces: player pause/upgrade/defeat/complete 阻塞重试、review backdoor 防护、WebGL fallback 导览和无恢复帧销毁证据。

- [ ] **Step 1: 写已有游戏 dialog 不得叠加且解除后自动重试的失败测试**

```ts
import { expect, test, type Page } from "@playwright/test";

async function requestGuideWhileBlocked(page: Page): Promise<void> {
  await page.getByRole("button", { name: "这是什么？" }).evaluate(
    (button: HTMLButtonElement) => button.click(),
  );
}

test("player pause prevents a second dialog and manual guide opens after resume", async ({ page }) => {
  await page.goto("/?fixture=fresh&reviewControls=1&guideReview=1");
  await page.getByRole("button", { name: "开始体验" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "游戏已暂停" })).toBeVisible();
  await requestGuideWhileBlocked(page);
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await expect(page.getByRole("dialog", { name: /灰烬竞技场｜/ })).toBeHidden();
  await page.getByRole("button", { name: "继续战斗" }).click();
  await expect(page.getByRole("dialog", { name: "游戏已暂停" })).toBeHidden();
  await page.getByRole("button", { name: "这是什么？" }).click();
  await expect(page.getByRole("dialog", { name: /灰烬竞技场｜/ })).toBeVisible();
});

test("upgrade prevents a second dialog until an actual upgrade is chosen", async ({ page }) => {
  await page.goto("/?fixture=wave-one&reviewControls=1&guideReview=1");
  await page.getByRole("button", { name: "开始体验" }).click();
  const enemyIds = await page.evaluate(() =>
    window.__ashfallDiagnostics!.snapshot().enemies
      .filter(({ health }) => health > 0)
      .map(({ id }) => id));
  for (const id of enemyIds) {
    await page.evaluate((enemyId) =>
      window.__ashfallDiagnostics!.drivePlayerStrike(enemyId), id);
  }
  await expect.poll(() => page.evaluate(() =>
    window.__ashfallDiagnostics!.snapshot().status)).toBe("upgrade");
  await requestGuideWhileBlocked(page);
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await page.locator('[data-upgrade-id="vitality"]').click();
  await expect(page.getByRole("dialog", { name: "选择一次升级" })).toBeHidden();
  await page.getByRole("button", { name: "这是什么？" }).click();
  await expect(page.getByRole("dialog", { name: /灰烬竞技场｜/ })).toBeVisible();
});

test("defeat prevents a second dialog until checkpoint retry", async ({ page }) => {
  await page.goto("/?fixture=elite&reviewControls=1&guideReview=1");
  await page.getByRole("button", { name: "开始体验" }).click();
  await page.evaluate(() =>
    window.__ashfallDiagnostics!.drivePlayerDefeat("elite-bell"));
  await expect.poll(() => page.evaluate(() =>
    window.__ashfallDiagnostics!.snapshot().status)).toBe("defeated");
  await requestGuideWhileBlocked(page);
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await page.getByRole("button", { name: "从检查点重试" }).click();
  await expect(page.getByRole("dialog", { name: "本轮挑战失败" })).toBeHidden();
  await page.getByRole("button", { name: "这是什么？" }).click();
  await expect(page.getByRole("dialog", { name: /灰烬竞技场｜/ })).toBeVisible();
});

test("complete keeps automatic open pending and retries after a new run", async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/?fixture=complete&reviewControls=1&guideReview=1");
  await expect(page.getByRole("dialog", { name: "挑战完成记录" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: /灰烬竞技场｜/ })).toBeHidden();
  await page.getByRole("button", { name: "新开一局" }).click();
  await expect(page.getByRole("dialog", { name: /灰烬竞技场｜/ })).toBeVisible();
  await expect(page.locator("dialog[open]")).toHaveCount(1);
});
```

前三条覆盖手动 `open()` 的 `canOpen` 组合；`complete` 从页面初始化就处于阻塞状态，专门证明构造期自动打开保持 pending，并由下一帧 `retryAutoOpen()` 成功打开。

- [ ] **Step 2: 写重复开关、review backdoor 与状态不变量失败测试**

```ts
test("repeated guide cycles preserve state, save and listener counts", async ({ page }) => {
  await page.goto("/?fixture=fresh&reviewControls=1&guideReview=1");
  await page.evaluate(() =>
    window.__ashfallDiagnostics!.setManualReviewClock(true));
  const before = await page.evaluate(() => ({
    state: window.__ashfallDiagnostics!.getSerializableState(),
    save: localStorage.getItem("ashfall-arena:v1"),
    listeners:
      window.__ashfallDiagnostics!.snapshot().performance.lifecycle
        .listenerRegistrations,
  }));
  for (let cycle = 0; cycle < 5; cycle += 1) {
    await page.getByRole("button", { name: "关闭说明" }).click();
    await page.getByRole("button", { name: "这是什么？" }).click();
  }
  const after = await page.evaluate(() => ({
    state: window.__ashfallDiagnostics!.getSerializableState(),
    save: localStorage.getItem("ashfall-arena:v1"),
    listeners:
      window.__ashfallDiagnostics!.snapshot().performance.lifecycle
        .listenerRegistrations,
    guideDialogs: document.querySelectorAll(".showcase-guide-dialog").length,
    guideTriggers: document.querySelectorAll(".showcase-guide-trigger").length,
  }));
  expect(after.state).toEqual(before.state);
  expect(after.save).toBe(before.save);
  expect(after.listeners).toBe(before.listeners);
  expect(after.guideDialogs).toBe(1);
  expect(after.guideTriggers).toBe(1);
});

test("manual review input cannot bypass an open guide", async ({ page }) => {
  await page.goto("/?fixture=fresh&reviewControls=1&guideReview=1");
  await page.evaluate(() => window.__ashfallDiagnostics!.setManualReviewClock(true));
  await expect(page.evaluate(() =>
    window.__ashfallDiagnostics!.advanceInput({ attackPressed: true }, 1)
  )).rejects.toThrow("guide gate is open");
});

test("a blocked localStorage getter keeps Ashfall onboarding usable", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() { throw new DOMException("blocked", "SecurityError"); },
    });
  });
  await page.goto("/?fixture=fresh&reviewControls=1&guideReview=1");
  await expect(page.getByRole("dialog", { name: /灰烬竞技场｜/ })).toBeVisible();
  await page.getByRole("button", { name: "关闭说明" }).click();
  await page.getByRole("button", { name: "这是什么？" }).click();
  await expect(page.getByRole("dialog", { name: /灰烬竞技场｜/ })).toBeVisible();
});
```

- [ ] **Step 3: 写返回、WebGL fallback 与 pagehide 无恢复帧失败测试**

```ts
test("hub return remains a normal same-tab link while the guide gate remains engaged", async ({ page }) => {
  await page.goto("/?reviewControls=1&guideReview=1");
  const link = page.getByRole("link", { name: "返回能力展厅" });
  await expect(link).not.toHaveAttribute("target");
  await expect(link).toHaveAttribute("href", /#product-ashfall-arena$/);
  expect(await page.evaluate(() =>
    window.__ashfallDiagnostics!.snapshot().guideGateOpen)).toBe(true);
});

test("WebGL fallback keeps the guide and return action usable", async ({ page }) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = function () {
      return null;
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto("/?reviewControls=1&guideReview=1");
  await expect(page.getByText(/3D 不可用/)).toBeVisible();
  await expect(page.getByRole("dialog", { name: /灰烬竞技场/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "返回能力展厅" })).toBeEnabled();
});

test("pagehide destroys the gate without invoking the close recovery branch", async ({ page }) => {
  await page.goto("/?reviewControls=1&guideReview=1");
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent("pagehide")));
  await page.waitForTimeout(100);
  const disposal = await page.evaluate(() => window.__ashfallReleaseDisposalSnapshot);
  expect(disposal?.lifecycle.disposed).toBe(true);
  expect(disposal?.lifecycle.guideGateOpen).toBe(false);
  expect(disposal?.lifecycle.recoveryFrames).toBe(0);
});
```

- [ ] **Step 4: 运行状态矩阵并观察真实失败**

Run (working directory `apps/ashfall-arena`): `$env:ASHFALL_PLAYWRIGHT_PORT='4194'; npx playwright test --config playwright.config.ts onboarding-guide.spec.ts`

Expected: FAIL；阻塞状态不会重试、review input 可绕过、fallback 控件被禁用或销毁产生恢复路径中的至少一项暴露。

- [ ] **Step 5: 在 review API 与诊断中锁定门禁不变量**

`advanceInput()` 第一项检查：

```ts
if (guideGateOpen) {
  throw new Error("guide gate is open");
}
```

在当前 `AshfallSnapshot` 接口中增加以下属性：

```ts
guideGateOpen: boolean;
guideOpen: boolean;
inputSampleCount: number;
presentationSeconds: {
  entitySync: number;
  vfx: number;
  hud: number;
  camera: number;
};
audio: {
  paused: boolean;
  contextState: AudioContextState | "not-created" | "unavailable";
  contextCreateCount: number;
  playedCueCount: number;
};
```

snapshot 返回对象增加真实运行时值：

```ts
guideGateOpen,
guideOpen: guide?.isOpen() ?? false,
inputSampleCount,
presentationSeconds: { ...presentationSeconds },
audio: {
  paused: audio.getDiagnostics().paused,
  contextState: audio.getDiagnostics().contextState,
  contextCreateCount: audio.getDiagnostics().contextCreateCount,
  playedCueCount: audio.getDiagnostics().playedCueCount,
},
```

`AshfallPerformanceSnapshot.lifecycle` 增加：

```ts
guideGateOpen: boolean;
recoveryFrames: number;
```

正常 live 和 information fallback snapshot 都写真实 `guideGateOpen`（fallback 为 `false`）与当前 `recoveryFrames`。`frame()` 在 `disposed` 分支只把已保存 disposal snapshot 的 `recoveryFrames` 加一后返回，不执行任何更新：

```ts
if (disposed) {
  const disposal = window.__ashfallReleaseDisposalSnapshot;
  if (disposal) disposal.lifecycle.recoveryFrames += 1;
  return;
}
```

不要把任何导览、计数或诊断字段加入 `GameState`、`writeSave()` 或 `stepGame()`。

- [ ] **Step 6: 在 fallback 禁用旧控件后创建导览**

`showArenaFallback()` 的批量 `button, input` 禁用先完成；之后在 `arena.renderer === null` 分支创建 fallback 专用 guide，因此新建的导览按钮、复选框和链接不会被批量禁用。fallback guide 不创建模拟门禁。`informationSnapshot()` 为新增字段返回：

```ts
guideGateOpen: false,
guideOpen: fallbackGuide?.isOpen() ?? false,
inputSampleCount: 0,
presentationSeconds: { entitySync: 0, vfx: 0, hud: 0, camera: 0 },
audio: {
  paused: true,
  contextState: "not-created",
  contextCreateCount: 0,
  playedCueCount: 0,
},
```

fallback `pagehide` 固定执行 `fallbackGuide?.destroy()`、`fallbackResizeObserver.disconnect()`、`arena.dispose()`、写 disposal snapshot、删除 review API 和设置 `data-runtime-disposed="true"`。

- [ ] **Step 7: 固定 live pagehide 顺序**

```ts
const dispose = () => {
  if (disposed) return;
  disposed = true;
  cancelAnimationFrame(frameRequest);
  input.dispose();
  audio.dispose();
  guide?.destroy();
  guideGateOpen = false;
  resizeObserver.disconnect();
  document.removeEventListener("visibilitychange", onVisibility);
  reducedMotion.removeEventListener("change", onReducedMotion);
  reviewApi.dispose();
  hud?.dispose();
  vfx.dispose();
  synchronizer.dispose();
  cameraController.dispose();
  player.dispose();
  arena.dispose();
  if (reviewControls) {
    window.__ashfallReleaseDisposalSnapshot = getPerformanceSnapshot(true);
  }
  delete window.__ashfallDiagnostics;
  document.documentElement.dataset.runtimeDisposed = "true";
};
```

销毁不调用普通 `close()`，不恢复 audio，不重置成可运行状态，不调度 RAF。

- [ ] **Step 8: 跑 Ashfall 全量产品门禁**

Run: `npm test --workspace @showcase/ashfall-arena`

Run: `npm run test:browser --workspace @showcase/ashfall-arena`

Run: `npm run test:preview --workspace @showcase/ashfall-arena`

Expected: PASS；功能矩阵、性能矩阵、生产 smoke、首访门禁、四种既有状态、重复生命周期、fallback 与销毁全部通过。

- [ ] **Step 9: 更新 Ashfall 验证记录并提交**

记录门禁打开/关闭时的 tick、input、audio/VFX/HUD/camera、存档、pause、listener、dispose 证据；继续明确自动化不关闭 `8–12 分钟`真人门槛。

```powershell
git add apps/ashfall-arena
git commit -m "test: close Ashfall onboarding state boundaries"
```

### Phase 4 Review Gate

- [ ] 单独审查 `apps/ashfall-arena/src/main.ts` 差异，确认没有 `GameState`、存档 schema、`state.paused` 或 `stepGame()` 语义变化；在 guide 打开时 renderer 可提交冻结背景，其余所有时钟不推进。
- [ ] 使用 `superpowers:requesting-code-review` 进行独立高风险复审，重点检查 capture audio listener、首 RAF、阻塞重试、review backdoor、fallback 和 pagehide。
- [ ] 只有 Ashfall 单元、功能浏览器、性能浏览器、生产 smoke 和独立复审全部通过后，才把执行账本对应行改为 `pass` 并进入启动脚本阶段。

---

## Phase 5 — 统一启动与组合生产预览

### Task 10: 实现四服务端口预检、标识就绪和进程树监督

**Files:**
- Create: `scripts/showcase-apps.mjs`
- Create: `scripts/showcase-processes.mjs`
- Create: `scripts/dev-showcase.mjs`
- Create: `tests/fixtures/showcase-service.mjs`
- Create: `tests/helpers/showcase-process-fixture.mjs`
- Create: `tests/dev-showcase.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: 四个固定端口、meta 标识和现有 `dev:forge`、`dev:arena`、`dev:atelier`、Task 3 的 `dev:hub`。
- Produces: `SHOWCASE_APPS`、`preflightPorts(services)`、`startShowcaseProcesses(options): Promise<ShowcaseSupervisor>`（含 `done: Promise<void>`）、`terminateProcessTree(pid)`、`runDevShowcase(options): Promise<0 | 1>`；根 `npm run dev`。

- [ ] **Step 1: 写描述符、占用端口和错误页面标识失败测试**

```js
import { EventEmitter } from "node:events";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, it } from "vitest";
import { runDevShowcase } from "../scripts/dev-showcase.mjs";
import { SHOWCASE_APPS } from "../scripts/showcase-apps.mjs";
import {
  startShowcaseProcesses,
} from "../scripts/showcase-processes.mjs";
import {
  expectPidFileTreeStopped,
  expectPidStopped,
  fixtureService,
  fixtureTreeService,
  occupyTemporaryPort,
  reserveTemporaryPort,
  temporaryFixtureServices,
} from "./helpers/showcase-process-fixture.mjs";

it("declares four fixed products and their exact readiness markers", () => {
  expect(SHOWCASE_APPS.map(({ id, port, marker }) => [id, port, marker]))
    .toEqual([
      ["showcase-hub", 4172, '<meta name="showcase-app" content="showcase-hub">'],
      ["monster-forge", 4173, '<meta name="showcase-app" content="monster-forge">'],
      ["ashfall-arena", 4174, '<meta name="showcase-app" content="ashfall-arena">'],
      ["mech-atelier", 4175, '<meta name="showcase-app" content="mech-atelier">'],
    ]);
});

it("rejects an occupied port with the product name and exact port", async () => {
  const occupied = await occupyTemporaryPort();
  const service = fixtureService({ id: "occupied-product", port: occupied.port });
  await expect(startShowcaseProcesses({ services: [service], deadlineMs: 2_000 }))
    .rejects.toThrow(`occupied-product port ${occupied.port} is already in use`);
  await occupied.close();
});

it("does not accept a 200 response with the wrong app marker", async () => {
  const [service] = await temporaryFixtureServices([{
    id: "marker-product",
    marker: "expected-app",
    servedMarker: "another-app",
  }]);
  await expect(startShowcaseProcesses({ services: [service], deadlineMs: 500 }))
    .rejects.toThrow(/readiness deadline.*expected-app/);
});
```

- [ ] **Step 2: 写成功、超时、崩溃和中断清理失败测试**

```js
it("waits for every real child service before announcing readiness", async () => {
  const services = await temporaryFixtureServices([
    { id: "one", delayMs: 20 },
    { id: "two", delayMs: 80 },
    { id: "three", delayMs: 40 },
    { id: "four", delayMs: 60 },
  ]);
  const output = [];
  const supervisor = await startShowcaseProcesses({
    services,
    deadlineMs: 2_000,
    writeLine: (line) => output.push(line),
  });
  expect(supervisor.readyServices.map(({ id }) => id))
    .toEqual(["one", "two", "three", "four"]);
  expect(output.filter((line) => line.includes("全部可访问"))).toHaveLength(1);
  await supervisor.stop("test-complete");
  await expect(supervisor.done).resolves.toBeUndefined();
  await Promise.all(supervisor.childPids.map(expectPidStopped));
});

it("cleans the complete child tree after timeout, crash and user interrupt", async () => {
  for (const mode of ["timeout", "crash", "interrupt"]) {
    const service = await fixtureTreeService(mode);
    const run = startShowcaseProcesses({
      services: [service],
      deadlineMs: mode === "timeout" ? 300 : 2_000,
    });
    if (mode === "interrupt") {
      const supervisor = await run;
      await supervisor.stop("SIGINT");
      await Promise.all(supervisor.childPids.map(expectPidStopped));
    } else {
      await expect(run).rejects.toThrow();
      await expectPidFileTreeStopped(service.pidFile);
    }
  }
});

it("turns a spawn error into one rejection and cleans already spawned siblings", async () => {
  const healthy = await fixtureTreeService("timeout");
  const missingPort = await reserveTemporaryPort();
  const missing = {
    ...fixtureService({ id: "missing-command", port: missingPort }),
    command: join(tmpdir(), "showcase-command-that-does-not-exist"),
    args: [],
  };
  await expect(startShowcaseProcesses({
    services: [healthy, missing],
    deadlineMs: 2_000,
  })).rejects.toThrow("missing-command failed to start");
  await expectPidFileTreeStopped(healthy.pidFile);
});

it("keeps observing a ready child and rejects done after a later crash", async () => {
  const service = await fixtureTreeService("post-ready-crash");
  const supervisor = await startShowcaseProcesses({
    services: [service],
    deadlineMs: 2_000,
  });
  await expect(supervisor.done).rejects.toThrow(
    "tree-post-ready-crash exited unexpectedly",
  );
  await expectPidFileTreeStopped(service.pidFile);
});

it("CLI orchestration returns 0 for user signal and 1 for runtime crash", async () => {
  for (const signal of ["SIGINT", "SIGBREAK", "SIGTERM"]) {
    const signalTarget = new EventEmitter();
    const interruptService = await fixtureTreeService(
      `interrupt-${signal.toLowerCase()}`,
    );
    const output = [];
    const interruptedRun = runDevShowcase({
      services: [interruptService],
      deadlineMs: 2_000,
      signalTarget,
      platform: "win32",
      writeLine: (line) => output.push(line),
    });
    await expect.poll(() =>
      output.some((line) => line.includes("全部可访问"))
    ).toBe(true);
    signalTarget.emit(signal);
    await expect(interruptedRun).resolves.toBe(0);
    await expectPidFileTreeStopped(interruptService.pidFile);
    expect(signalTarget.listenerCount(signal)).toBe(0);
  }

  const crashService = await fixtureTreeService("post-ready-crash");
  await expect(runDevShowcase({
    services: [crashService],
    deadlineMs: 2_000,
    signalTarget: new EventEmitter(),
    writeLine: () => {},
  })).resolves.toBe(1);
  await expectPidFileTreeStopped(crashService.pidFile);
});
```

`tests/helpers/showcase-process-fixture.mjs` 用真实临时端口和 Node child 描述符实现测试帮助器：

```js
const fixturePath = fileURLToPath(
  new URL("../fixtures/showcase-service.mjs", import.meta.url),
);

export async function occupyTemporaryPort(requestedPort = 0) {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(requestedPort, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("missing port");
  return {
    port: address.port,
    close: () => new Promise((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve())),
  };
}

export async function reserveTemporaryPort() {
  const occupied = await occupyTemporaryPort();
  const { port } = occupied;
  await occupied.close();
  return port;
}

export function fixtureService({
  id = "fixture-app",
  port,
  marker = id,
  servedMarker = marker,
  delayMs = 0,
  crashAfterMs,
  pidFile,
  spawnGrandchild = false,
}) {
  const expectedMeta = `<meta name="showcase-app" content="${marker}">`;
  const args = [
    fixturePath,
    "--port", String(port),
    "--marker", servedMarker,
    "--delay-ms", String(delayMs),
  ];
  if (crashAfterMs !== undefined) {
    args.push("--crash-after-ms", String(crashAfterMs));
  }
  if (pidFile) args.push("--pid-file", pidFile);
  if (spawnGrandchild) args.push("--spawn-grandchild");
  return {
    id,
    name: id,
    port,
    url: `http://127.0.0.1:${port}/`,
    marker: expectedMeta,
    command: process.execPath,
    args,
  };
}

export async function expectPidStopped(pid) {
  await expect.poll(() => {
    try {
      process.kill(pid, 0);
      return false;
    } catch (error) {
      if (error.code === "ESRCH") return true;
      throw error;
    }
  }).toBe(true);
}

export async function temporaryFixtureServices(configs) {
  return Promise.all(configs.map(async (config, index) =>
    fixtureService({
      id: config.id ?? `fixture-${index + 1}`,
      port: await reserveTemporaryPort(),
      ...config,
    })));
}

export async function fixtureTreeService(mode) {
  const directory = await mkdtemp(join(tmpdir(), "showcase-process-tree-"));
  const pidFile = join(directory, "pids.txt");
  const port = await reserveTemporaryPort();
  return Object.assign(
    fixtureService({
      id: `tree-${mode}`,
      port,
      delayMs: mode === "timeout" ? 5_000 : mode === "crash" ? 500 : 0,
      crashAfterMs:
        mode === "crash" ? 80
        : mode === "post-ready-crash" ? 500
        : undefined,
      pidFile,
      spawnGrandchild: true,
    }),
    { pidFile },
  );
}

export async function expectPidFileTreeStopped(pidFile) {
  let text;
  try {
    text = await readFile(pidFile, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  const pids = text.trim().split(/\s+/).map(Number);
  await Promise.all(pids.map(expectPidStopped));
}
```

这些帮助器不替换 supervisor 的 spawn、HTTP 或清理实现。

- [ ] **Step 3: 运行 supervisor 测试并确认模块缺失**

Run: `npm test -- --run tests/dev-showcase.test.mjs`

Expected: FAIL；无法导入 `scripts/showcase-apps.mjs` 或 `showcase-processes.mjs`。

- [ ] **Step 4: 定义固定服务描述符**

```js
export function resolveServiceLaunch(
  service,
  npmExecPath = process.env.npm_execpath,
) {
  if (service.command && Array.isArray(service.args)) {
    return { command: service.command, args: service.args };
  }
  if (!service.npmScript || !npmExecPath) {
    throw new Error(
      `${service.name} requires npm_execpath; launch with npm run dev`,
    );
  }
  return {
    command: process.execPath,
    args: [npmExecPath, "run", service.npmScript],
  };
}

export const SHOWCASE_APPS = Object.freeze([
  {
    id: "showcase-hub",
    name: "产品能力展厅",
    port: 4172,
    url: "http://127.0.0.1:4172/",
    marker: '<meta name="showcase-app" content="showcase-hub">',
    npmScript: "dev:hub",
  },
  {
    id: "monster-forge",
    name: "Monster Forge",
    port: 4173,
    url: "http://127.0.0.1:4173/",
    marker: '<meta name="showcase-app" content="monster-forge">',
    npmScript: "dev:forge",
  },
  {
    id: "ashfall-arena",
    name: "Ashfall Arena",
    port: 4174,
    url: "http://127.0.0.1:4174/",
    marker: '<meta name="showcase-app" content="ashfall-arena">',
    npmScript: "dev:arena",
  },
  {
    id: "mech-atelier",
    name: "Mech Atelier",
    port: 4175,
    url: "http://127.0.0.1:4175/",
    marker: '<meta name="showcase-app" content="mech-atelier">',
    npmScript: "dev:atelier",
  },
]);
```

- [ ] **Step 5: 用真实 bind 检查和真实 HTTP marker 定义就绪**

```js
export async function assertPortAvailable(service) {
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", () =>
      reject(new Error(`${service.name} port ${service.port} is already in use`)));
    server.listen(service.port, "127.0.0.1", () =>
      server.close((error) => error ? reject(error) : resolve()));
  });
}

export async function preflightPorts(services) {
  for (const service of services) {
    await assertPortAvailable(service);
  }
}

async function isReady(service, signal) {
  try {
    const response = await fetch(service.url, { signal, redirect: "manual" });
    if (response.status < 200 || response.status > 399) return false;
    return (await response.text()).includes(service.marker);
  } catch {
    return false;
  }
}
```

`startShowcaseProcesses()` 的第一条异步操作是 `await preflightPorts(services)`；只有全部通过后才能执行一个 `spawn()`，且不自动改端口。

- [ ] **Step 6: 并发 spawn、使用单一截止时间并监听异常退出**

```js
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

export async function startShowcaseProcesses({
  services = SHOWCASE_APPS,
  deadlineMs = 20_000,
  workspaceRoot = defaultWorkspaceRoot,
  writeLine = (line) => console.log(line),
  signal,
}) {
  await preflightPorts(services);
  const deadlineAt = performance.now() + deadlineMs;
  const probeAbort = new AbortController();
  const deadlineTimer = setTimeout(() => probeAbort.abort(), deadlineMs);
  const children = services.map((service) => {
    const launch = resolveServiceLaunch(service);
    const child = spawn(launch.command, launch.args, {
      cwd: workspaceRoot,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      detached: process.platform !== "win32",
    });
    child.stdout?.on("data", (chunk) =>
      writeLine(`[${service.id}] ${String(chunk).trimEnd()}`));
    child.stderr?.on("data", (chunk) =>
      writeLine(`[${service.id}:stderr] ${String(chunk).trimEnd()}`));
    const closed = new Promise((resolve) => child.once("close", resolve));
    return { service, child, closed };
  });
  let stopping = false;
  let stopPromise;
  let resolveDone;
  let rejectDone;
  const done = new Promise((resolve, reject) => {
    resolveDone = resolve;
    rejectDone = reject;
  });
  const cleanup = async (reason) => {
    clearTimeout(deadlineTimer);
    probeAbort.abort();
    signal?.removeEventListener("abort", onExternalAbort);
    await Promise.all(children.map(({ child }) =>
      child.pid === undefined
        ? Promise.resolve()
        : terminateProcessTree(child.pid)));
    await Promise.all(children.map(({ closed }) => closed));
    writeLine(`展厅服务已停止：${reason}`);
  };
  const stop = (reason) => {
    if (stopPromise) return stopPromise;
    stopping = true;
    stopPromise = cleanup(reason).then(
      () => resolveDone(),
      (error) => {
        rejectDone(error);
        throw error;
      },
    );
    return stopPromise;
  };
  const fail = (error) => {
    if (stopPromise) return stopPromise;
    stopping = true;
    stopPromise = cleanup("runtime-failed").then(
      () => rejectDone(error),
      (cleanupError) => rejectDone(new AggregateError(
        [error, cleanupError],
        "Showcase failed and cleanup also failed",
      )),
    );
    return stopPromise;
  };
  const onExternalAbort = () => {
    void stop(`signal:${String(signal?.reason ?? "abort")}`);
  };
  signal?.addEventListener("abort", onExternalAbort, { once: true });
  if (signal?.aborted) onExternalAbort();
  for (const { child, service } of children) {
    child.once("error", (error) => {
      if (!stopping) {
        void fail(new Error(`${service.name} failed to start`, {
          cause: error,
        }));
      }
    });
    child.once("exit", (code, exitSignal) => {
      if (!stopping) {
        void fail(new Error(
          `${service.name} exited unexpectedly `
          + `(code=${code ?? "null"}, signal=${exitSignal ?? "null"})`,
        ));
      }
    });
  }
  const pending = new Set(children);
  const readyIds = new Set();

  const waitUntilReady = async () => {
    while (
      pending.size > 0
      && performance.now() < deadlineAt
      && !probeAbort.signal.aborted
    ) {
      for (const entry of pending) {
        if (await isReady(entry.service, probeAbort.signal)) {
          readyIds.add(entry.service.id);
          pending.delete(entry);
        }
      }
      if (pending.size > 0 && !probeAbort.signal.aborted) {
        await delay(50);
      }
    }
    if (pending.size > 0) {
      throw new Error(
        `readiness deadline exceeded: ${[...pending].map(({ service }) =>
          `${service.name} (${service.url}; expected ${service.marker})`
        ).join(", ")}`,
      );
    }
  };

  try {
    await Promise.race([waitUntilReady(), done]);
  } catch (error) {
    if (!stopping) await fail(error);
    await stopPromise;
    throw error;
  }
  if (stopping || signal?.aborted) {
    await stopPromise;
    const error = new Error("Showcase startup interrupted");
    error.code = "SHOWCASE_INTERRUPTED";
    throw error;
  }
  clearTimeout(deadlineTimer);
  const readyServices = services.filter((service) => readyIds.has(service.id));
  writeLine("全部可访问");
  for (const service of readyServices) {
    writeLine(`${service.name}: ${service.url}`);
  }
  return {
    readyServices,
    childPids: children.flatMap(({ child }) =>
      child.pid === undefined ? [] : [child.pid]),
    stop,
    done,
  };
}
```

`defaultWorkspaceRoot` 使用 `fileURLToPath(new URL("../", import.meta.url))`；`SHOWCASE_APPS` 与 `resolveServiceLaunch` 从 `showcase-apps.mjs` 导入。真实服务通过当前 npm 进程提供的 `npm_execpath` 交给 `process.execPath`，fixture 仍使用自身的 `command/args`，因此不执行 `.cmd` 文件或 shell 拼接。`ShowcaseSupervisor` 返回 `readyServices`、`childPids`、幂等 `stop(reason): Promise<void>` 和持续到显式停止或异常退出的 `done: Promise<void>`。每个 child 的 `error`/`exit` 在预期 stop 之前触发时，`done` 在完整树清理后 reject；只有 pending 为空后由一个位置输出一次“全部可访问”，然后按 `readyServices` 的描述符顺序输出名称与 URL。

- [ ] **Step 7: 实现跨平台完整进程树清理**

```js
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFilePromise = promisify(execFile);

async function listWindowsDescendants(rootPid) {
  const command = [
    "$ErrorActionPreference='Stop';",
    "Get-CimInstance Win32_Process",
    "| Select-Object ProcessId,ParentProcessId",
    "| ConvertTo-Json -Compress",
  ].join(" ");
  const { stdout } = await execFilePromise(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", command],
    { windowsHide: true },
  );
  const parsed = JSON.parse(stdout || "[]");
  const rows = (Array.isArray(parsed) ? parsed : [parsed]).map((row) => ({
    pid: Number(row.ProcessId),
    parentPid: Number(row.ParentProcessId),
  }));
  const descendants = [];
  const frontier = [rootPid];
  while (frontier.length > 0) {
    const parentPid = frontier.shift();
    for (const row of rows) {
      if (row.parentPid !== parentPid || descendants.includes(row.pid)) continue;
      descendants.push(row.pid);
      frontier.push(row.pid);
    }
  }
  return descendants.reverse();
}

async function taskkillIfRunning(pid) {
  await execFilePromise("taskkill", ["/PID", String(pid), "/T", "/F"], {
    windowsHide: true,
  }).catch((error) => {
    try {
      process.kill(pid, 0);
    } catch (probeError) {
      if (probeError.code === "ESRCH") return;
    }
    throw error;
  });
}

export async function terminateProcessTree(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return;
  if (process.platform === "win32") {
    const descendants = await listWindowsDescendants(pid);
    for (const descendantPid of descendants) {
      await taskkillIfRunning(descendantPid);
    }
    await taskkillIfRunning(pid);
    return;
  }
  try {
    process.kill(-pid, "SIGTERM");
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
    return;
  }
  await delay(750);
  try {
    process.kill(-pid, 0);
    process.kill(-pid, "SIGKILL");
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}
```

`stop(reason)` 必须幂等：先取消 readiness fetch，再并行清理每个根 PID，等待 child close，移除父进程 signal listener。CLI 监听 `SIGINT`、Windows `SIGBREAK`、`SIGTERM`；用户中断清理后以 `0` 退出，启动失败/超时/异常 child 以非零退出。

- [ ] **Step 8: 创建会启动真实孙进程的确定性 fixture**

`tests/fixtures/showcase-service.mjs` 接收 `--port`、`--marker`、`--delay-ms`、`--crash-after-ms`、`--pid-file`、`--spawn-grandchild`。延时后启动真实 HTTP server 并返回：

```html
<!doctype html><meta name="showcase-app" content="传入的 marker">
```

fixture 将自身和孙进程 PID 写入指定临时 pid 文件，SIGTERM/SIGINT 时关闭 server；测试使用操作系统分配的临时端口，不占 `4172–4175`。

核心实现固定为：

```js
function parseCliArgs(args) {
  const values = new Map();
  let spawnGrandchild = false;
  for (let index = 0; index < args.length; index += 1) {
    const name = args[index];
    if (name === "--spawn-grandchild") {
      spawnGrandchild = true;
      continue;
    }
    if (![
      "--port",
      "--marker",
      "--delay-ms",
      "--crash-after-ms",
      "--pid-file",
    ].includes(name)) {
      throw new Error(`unknown fixture argument: ${name}`);
    }
    const value = args[index + 1];
    if (value === undefined) throw new Error(`missing value for ${name}`);
    values.set(name, value);
    index += 1;
  }
  const integer = (name, fallback) => {
    const raw = values.get(name);
    if (raw === undefined) return fallback;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`${name} must be a non-negative integer`);
    }
    return value;
  };
  const port = integer("--port");
  const marker = values.get("--marker");
  if (!port || port > 65_535) throw new Error("--port is required");
  if (!marker) throw new Error("--marker is required");
  return {
    port,
    marker,
    delayMs: integer("--delay-ms", 0),
    crashAfterMs: integer("--crash-after-ms", undefined),
    pidFile: values.get("--pid-file"),
    spawnGrandchild,
  };
}

const options = parseCliArgs(process.argv.slice(2));
const pids = [process.pid];
if (options.spawnGrandchild) {
  const grandchild = spawn(process.execPath, [
    "-e",
    "setInterval(() => {}, 1000)",
  ], { stdio: "ignore", windowsHide: true });
  if (!grandchild.pid) throw new Error("grandchild did not start");
  pids.push(grandchild.pid);
}
if (options.pidFile) {
  await writeFile(options.pidFile, `${pids.join("\n")}\n`, "utf8");
}
if (options.crashAfterMs !== undefined) {
  setTimeout(() => process.exit(23), options.crashAfterMs);
}
const server = createServer((_request, response) => {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(
    `<!doctype html><meta name="showcase-app" content="${options.marker}">`,
  );
});
setTimeout(() => {
  server.listen(options.port, "127.0.0.1");
}, options.delayMs);
const shutdown = () => {
  if (!server.listening) {
    process.exit(0);
    return;
  }
  server.close(() => process.exit(0));
};
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, shutdown);
}
```

- [ ] **Step 9: 接管根 dev 并运行集成测试**

`scripts/dev-showcase.mjs` 完整实现持续观察 `supervisor.done`，并把用户信号与运行时失败映射为不同退出码：

```js
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { SHOWCASE_APPS } from "./showcase-apps.mjs";
import { startShowcaseProcesses } from "./showcase-processes.mjs";

export async function runDevShowcase({
  services = SHOWCASE_APPS,
  deadlineMs = 20_000,
  writeLine = (line) => console.log(line),
  writeError = (line) => console.error(line),
  signalTarget = process,
  platform = process.platform,
} = {}) {
  const controller = new AbortController();
  const signals = platform === "win32"
    ? ["SIGINT", "SIGBREAK", "SIGTERM"]
    : ["SIGINT", "SIGTERM"];
  const handlers = new Map(signals.map((signal) => [
    signal,
    () => controller.abort(signal),
  ]));
  for (const [signal, handler] of handlers) {
    signalTarget.once(signal, handler);
  }

  let supervisor;
  try {
    supervisor = await startShowcaseProcesses({
      services,
      deadlineMs,
      writeLine,
      signal: controller.signal,
    });
    await supervisor.done;
    return 0;
  } catch (error) {
    if (
      controller.signal.aborted
      || error?.code === "SHOWCASE_INTERRUPTED"
    ) {
      await supervisor?.stop(`signal:${String(controller.signal.reason)}`);
      return 0;
    }
    writeError(error instanceof Error ? error.stack ?? error.message : String(error));
    await supervisor?.stop("cli-failure");
    return 1;
  } finally {
    for (const [signal, handler] of handlers) {
      signalTarget.removeListener(signal, handler);
    }
  }
}

const invokedDirectly = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (invokedDirectly) {
  process.exitCode = await runDevShowcase();
}
```

根 scripts 改为：

```json
"dev": "node scripts/dev-showcase.mjs",
"dev:hub": "npm run dev --workspace @showcase/hub"
```

保留 `dev:forge`、`dev:arena`、`dev:atelier`。

Run: `npm test -- --run tests/dev-showcase.test.mjs`

Expected: PASS；成功只输出一次；占用、错标、超时、spawn error、就绪前/后崩溃都清理真实子孙进程并返回非零；SIGINT/Windows SIGBREAK/SIGTERM 路径返回 0 且移除监听器。

- [ ] **Step 10: 在固定端口做一次人工 smoke 并中断**

Run: `npm run dev`

Expected: 只在四个 marker 都匹配后打印四个可点击地址。打开四个地址确认标题正确，然后按 Ctrl+C；再运行：

```powershell
node --input-type=module -e "const {SHOWCASE_APPS}=await import('./scripts/showcase-apps.mjs'); const {preflightPorts}=await import('./scripts/showcase-processes.mjs'); await preflightPorts(SHOWCASE_APPS)"
```

Expected: 退出码为 0，证明四个固定端口均可重新绑定。

- [ ] **Step 11: 提交 Task 10**

```powershell
git add scripts/showcase-apps.mjs scripts/showcase-processes.mjs scripts/dev-showcase.mjs tests/fixtures/showcase-service.mjs tests/helpers/showcase-process-fixture.mjs tests/dev-showcase.test.mjs package.json
git commit -m "feat: supervise all showroom services"
```

### Task 11: 构建可放入任意子路径的同域组合产物

**Files:**
- Create: `scripts/build-showcase.mjs`
- Create: `scripts/verify-showcase-links.mjs`
- Create: `tests/showcase-build.test.mjs`
- Create: `vite.showcase-preview.config.ts`
- Modify: `package.json`
- Modify: `apps/showcase-hub/vite.config.ts`
- Modify: `apps/monster-forge/vite.config.ts`
- Modify: `apps/ashfall-arena/vite.config.ts`
- Modify: `apps/mech-atelier/vite.config.ts`

**Interfaces:**
- Consumes: 四个 workspace build、宿主 URL 环境变量和固定 meta。
- Produces: `assertSafeShowcaseTarget(root, target)`、`showcaseBuildJobs()`、`buildShowcase(options?)`、`scanShowcaseText(root)`、`dist/showcase/`。

- [ ] **Step 1: 写安全目标、构建环境与回环扫描失败测试**

```js
it("allows deletion only for the exact root dist/showcase directory", () => {
  const root = resolve("fixture-root");
  expect(assertSafeShowcaseTarget(root, join(root, "dist", "showcase")))
    .toBe(join(root, "dist", "showcase"));
  for (const unsafe of [root, join(root, "dist"), dirname(root), "/"]) {
    expect(() => assertSafeShowcaseTarget(root, unsafe)).toThrow(
      /refusing to clean showcase target/,
    );
  }
});

it("builds exact relative URL environments for all four apps", () => {
  expect(showcaseBuildJobs()).toEqual([
    expect.objectContaining({
      workspace: "@showcase/hub",
      env: expect.objectContaining({
        VITE_APP_BASE: "./",
        VITE_MONSTER_FORGE_URL: "./monster-forge/",
        VITE_ASHFALL_ARENA_URL: "./ashfall-arena/",
        VITE_MECH_ATELIER_URL: "./mech-atelier/",
      }),
    }),
    expect.objectContaining({
      workspace: "@showcase/monster-forge",
      env: { VITE_APP_BASE: "./", VITE_SHOWCASE_HUB_URL: "../" },
    }),
    expect.objectContaining({
      workspace: "@showcase/ashfall-arena",
      env: { VITE_APP_BASE: "./", VITE_SHOWCASE_HUB_URL: "../" },
    }),
    expect.objectContaining({
      workspace: "@showcase/mech-atelier",
      env: { VITE_APP_BASE: "./", VITE_SHOWCASE_HUB_URL: "../" },
    }),
  ]);
});

it.each(["127.0.0.1", "localhost", "[::1]"])(
  "rejects loopback token %s from final text assets",
  async (token) => {
    const fixture = await createTextAssetFixture(`const value="${token}"`);
    await expect(scanShowcaseText(fixture)).rejects.toThrow(token);
  },
);
```

测试文件中的真实临时产物帮助器：

```js
async function createTextAssetFixture(content) {
  const root = await mkdtemp(join(tmpdir(), "showcase-build-scan-"));
  const assets = join(root, "assets");
  await mkdir(assets, { recursive: true });
  await writeFile(join(assets, "index.js"), content, "utf8");
  return root;
}
```

- [ ] **Step 2: 运行 build 契约并确认脚本缺失**

Run: `npm test -- --run tests/showcase-build.test.mjs`

Expected: FAIL；无法导入 `build-showcase.mjs` 或 `verify-showcase-links.mjs`。

- [ ] **Step 3: 让四个 Vite config 读取统一 base**

Hub 配置完整改为：

```ts
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    base: env.VITE_APP_BASE || "/",
    server: { host: "127.0.0.1", port: 4172, strictPort: true },
    preview: { host: "127.0.0.1", port: 4272, strictPort: true },
  };
});
```

Monster 配置完整改为：

```ts
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    base: env.VITE_APP_BASE || "/",
    server: { host: "127.0.0.1", port: 4173, strictPort: true },
  };
});
```

Ashfall 配置完整改为：

```ts
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    base: env.VITE_APP_BASE || "/",
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: "three-runtime",
                test: /node_modules[\\/]three[\\/]/,
                priority: 20,
                maxSize: 450 * 1_024,
              },
              {
                name: "game-assets",
                test: /packages[\\/]game-assets[\\/]/,
                priority: 10,
              },
            ],
          },
        },
      },
    },
    server: { host: "127.0.0.1", port: 4174, strictPort: true },
    preview: { host: "127.0.0.1", port: 4174, strictPort: true },
  };
});
```

Mech 配置完整改为：

```ts
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    base: env.VITE_APP_BASE || "/",
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: "three-core",
                test: /node_modules[\\/]three[\\/]/,
                priority: 20,
                maxSize: 430 * 1_024,
              },
              {
                name: "mech-assets",
                test: /packages[\\/]game-assets[\\/]/,
                priority: 10,
              },
            ],
          },
        },
      },
    },
    server: { host: "127.0.0.1", port: 4175, strictPort: true },
    preview: { host: "127.0.0.1", port: 4175, strictPort: true },
  };
});
```

普通 `npm run build` 未设置变量时仍用 `/`；组合构建才用 `./`。

- [ ] **Step 4: 实现精确构建作业和安全清理**

```js
export function assertSafeShowcaseTarget(root, target) {
  const expected = resolve(root, "dist", "showcase");
  const resolved = resolve(target);
  if (resolved !== expected) {
    throw new Error(`refusing to clean showcase target: ${resolved}`);
  }
  return resolved;
}

export function showcaseBuildJobs() {
  return [
    {
      id: "showcase-hub",
      marker: '<meta name="showcase-app" content="showcase-hub">',
      workspace: "@showcase/hub",
      source: "apps/showcase-hub/dist",
      destination: ".",
      env: {
        VITE_APP_BASE: "./",
        VITE_MONSTER_FORGE_URL: "./monster-forge/",
        VITE_ASHFALL_ARENA_URL: "./ashfall-arena/",
        VITE_MECH_ATELIER_URL: "./mech-atelier/",
      },
    },
    ...["monster-forge", "ashfall-arena", "mech-atelier"].map((id) => ({
      id,
      marker: `<meta name="showcase-app" content="${id}">`,
      workspace: `@showcase/${id}`,
      source: `apps/${id}/dist`,
      destination: id,
      env: { VITE_APP_BASE: "./", VITE_SHOWCASE_HUB_URL: "../" },
    })),
  ];
}
```

`buildShowcase()` 用参数数组执行四个作业，复制后核对 marker 并调用最终扫描；测试可注入 `runBuild`，CLI 使用真实 `execFile`：

```js
import { execFile } from "node:child_process";
import { cp, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { scanShowcaseText } from "./verify-showcase-links.mjs";

const execFileAsync = promisify(execFile);
const defaultWorkspaceRoot = fileURLToPath(new URL("../", import.meta.url));

async function runWorkspaceBuild(job, root) {
  const npmExecPath = process.env.npm_execpath;
  if (!npmExecPath) {
    throw new Error("buildShowcase must be launched with npm run build:showcase");
  }
  await execFileAsync(
    process.execPath,
    [npmExecPath, "run", "build", "--workspace", job.workspace],
    {
      cwd: root,
      env: { ...process.env, ...job.env },
      windowsHide: true,
    },
  );
}

export async function buildShowcase({
  root = defaultWorkspaceRoot,
  target = join(root, "dist", "showcase"),
  runBuild = runWorkspaceBuild,
} = {}) {
  const safeTarget = assertSafeShowcaseTarget(root, target);
  await rm(safeTarget, { recursive: true, force: true });
  const jobs = showcaseBuildJobs();
  for (const job of jobs) {
    await runBuild(job, root);
    const source = resolve(root, job.source);
    const destination = job.destination === "."
      ? safeTarget
      : join(safeTarget, job.destination);
    await cp(source, destination, {
      recursive: true,
      force: true,
      errorOnExist: false,
    });
  }
  for (const job of jobs) {
    const indexPath = job.destination === "."
      ? join(safeTarget, "index.html")
      : join(safeTarget, job.destination, "index.html");
    const html = await readFile(indexPath, "utf8");
    if (!html.includes(job.marker)) {
      throw new Error(`${job.id} index is missing ${job.marker}`);
    }
  }
  await scanShowcaseText(safeTarget);
  return safeTarget;
}

const invokedDirectly = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (invokedDirectly) {
  await buildShowcase();
}
```

所有 child 使用 `execFile` 参数数组和 `windowsHide: true`，不拼接 shell 字符串。

- [ ] **Step 5: 实现最终文本资产与链接扫描**

```js
const textExtensions = new Set([".html", ".js", ".css", ".json", ".map"]);
const forbiddenLoopback = /127\.0\.0\.1|localhost|\[::1\]/i;
const productDirectories = new Set([
  "monster-forge",
  "ashfall-arena",
  "mech-atelier",
]);
const requiredByDirectory = new Map([
  [".", ["./monster-forge/", "./ashfall-arena/", "./mech-atelier/"]],
  ["monster-forge", ["../", "product-monster-forge"]],
  ["ashfall-arena", ["../", "product-ashfall-arena"]],
  ["mech-atelier", ["../", "product-mech-atelier"]],
]);

export async function scanShowcaseText(root) {
  const failures = [];
  const textByDirectory = new Map(
    [...requiredByDirectory.keys()].map((directory) => [directory, ""]),
  );
  for (const path of await walkFiles(root)) {
    if (!textExtensions.has(extname(path))) continue;
    const text = await readFile(path, "utf8");
    const loopbackMatch = text.match(forbiddenLoopback);
    if (loopbackMatch) {
      failures.push(`${path}: forbidden loopback ${loopbackMatch[0]}`);
    }
    if (extname(path) === ".html" && /target\s*=\s*["']_blank/i.test(text)) {
      failures.push(`${path}: target=_blank`);
    }
    const relativePath = relative(root, path).replaceAll("\\", "/");
    const firstSegment = relativePath.split("/")[0];
    const directory = productDirectories.has(firstSegment) ? firstSegment : ".";
    textByDirectory.set(
      directory,
      `${textByDirectory.get(directory)}\n${text}`,
    );
  }
  for (const [directory, tokens] of requiredByDirectory) {
    const combinedText = textByDirectory.get(directory) ?? "";
    for (const token of tokens) {
      if (!combinedText.includes(token)) {
        failures.push(`${directory} is missing ${token}`);
      }
    }
  }
  if (failures.length) {
    throw new Error(`invalid showcase production links:\n${failures.join("\n")}`);
  }
}

export async function walkFiles(root, directory = root) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`symbolic links are forbidden in showcase output: ${path}`);
    }
    if (entry.isDirectory()) {
      files.push(...await walkFiles(root, path));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }
  return files;
}
```

`verify-showcase-links.mjs` 从 `node:fs/promises` 导入 `readFile`、`readdir`，从 `node:path` 导入 `extname`、`join`、`relative`。每个目录缺少任一 token 都失败；所有 `.html` 继续拒绝 `_blank`。这项静态门禁证明组合变量进入产物，Task 12 再用真实浏览器证明运行时同源和焦点往返。

- [ ] **Step 6: 添加根构建脚本和组合 preview config**

```json
"build:showcase": "node scripts/build-showcase.mjs",
"preview:showcase": "vite preview --config vite.showcase-preview.config.ts"
```

```ts
import { defineConfig } from "vite";

export default defineConfig({
  build: { outDir: "dist/showcase" },
  preview: {
    host: "127.0.0.1",
    port: 4292,
    strictPort: true,
  },
});
```

- [ ] **Step 7: 先跑单元契约，再构建真实组合产物**

Run: `npm test -- --run tests/showcase-build.test.mjs`

Expected: PASS。

Run: `npm run build:showcase`

Expected: PASS；`dist/showcase/index.html` 和三个产品子目录存在，四个 marker 正确，最终文本资产无 loopback 或 `_blank`。

- [ ] **Step 8: 验证普通生产默认值未被组合变量污染**

Run: `npm run build`

Expected: PASS；普通 Hub 生产链接仍是 `/monster-forge/`、`/ashfall-arena/`、`/mech-atelier/`，三产品返回仍是 `/#product-*`；组合脚本之外没有永久设置 Vite env。

- [ ] **Step 9: 提交 Task 11**

```powershell
git add scripts/build-showcase.mjs scripts/verify-showcase-links.mjs tests/showcase-build.test.mjs vite.showcase-preview.config.ts package.json apps/showcase-hub/vite.config.ts apps/monster-forge/vite.config.ts apps/ashfall-arena/vite.config.ts apps/mech-atelier/vite.config.ts
git commit -m "feat: assemble same-origin showroom build"
```

### Task 12: 验证组合预览的三条当前标签往返旅程

**Files:**
- Create: `playwright.showcase-preview.config.ts`
- Create: `tests/showcase-preview/showcase-roundtrip.spec.ts`
- Modify: `package.json`
- Modify: `docs/SHOWCASE-VALIDATION.md`

**Interfaces:**
- Consumes: `dist/showcase/`、4292 preview、三产品自动导览和 Hub 合法 hash 焦点。
- Produces: 根 `test:showcase-preview`，以及每条旅程在同一个 Page、单一当前标签内完成的三产品展厅 → 产品 → 对应卡往返证据。

- [ ] **Step 1: 写三产品同页往返和无回环失败测试**

```ts
import { expect, test } from "@playwright/test";

for (const product of [
  ["Monster Forge", "monster-forge", "product-monster-forge"],
  ["Ashfall Arena", "ashfall-arena", "product-ashfall-arena"],
  ["Mech Atelier", "mech-atelier", "product-mech-atelier"],
] as const) {
  test(`${product[0]} round-trips to its exact showroom card`, async ({ page, context }) => {
    await page.goto("/");
    const enter = page.locator(`[data-enter-product="${product[1]}"]`);
    await expect(enter).not.toHaveAttribute("target");
    await enter.click();
    expect(context.pages()).toHaveLength(1);
    await expect(page).toHaveURL(new RegExp(`/${product[1]}/`));
    await expect(page.locator('meta[name="showcase-app"]'))
      .toHaveAttribute("content", product[1]);
    const returnLink = page.getByRole("link", { name: "返回能力展厅" });
    await expect(returnLink).not.toHaveAttribute("target");
    await returnLink.click();
    expect(context.pages()).toHaveLength(1);
    await expect(page).toHaveURL(new RegExp(`#${product[2]}$`));
    await expect(page.locator(`#${product[2]} h3`)).toBeFocused();
  });
}

test("the composite origin exposes no loopback links or requests", async ({ page }) => {
  const requested = [];
  page.on("request", (request) => requested.push(request.url()));
  await page.goto("/");
  const hrefs = await page.locator("a[href]").evaluateAll((links) =>
    links.map((link) => link.getAttribute("href") ?? ""));
  expect([...hrefs, ...requested].join("\n"))
    .not.toMatch(/127\.0\.0\.1:(4172|4173|4174|4175)|localhost|\[::1\]/);
});
```

- [ ] **Step 2: 运行 preview test 并确认 config/script 缺失**

Run: `npm run test:showcase-preview`

Expected: FAIL；根脚本或 Playwright config 尚不存在。

- [ ] **Step 3: 配置单一源站和干净 storage**

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/showcase-preview",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4292",
    viewport: { width: 1440, height: 900 },
    storageState: { cookies: [], origins: [] },
  },
  webServer: {
    command: "npm run build:showcase && npm run preview:showcase",
    url: "http://127.0.0.1:4292",
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
```

根 scripts 加：

```json
"test:showcase-preview": "playwright test --config playwright.showcase-preview.config.ts"
```

- [ ] **Step 4: 为 Ashfall 组合旅程显式启用普通首访**

组合测试不带 `reviewControls`，使用正常产品入口；首访导览自动打开。点击导览中的“返回能力展厅”时保持 gate 为真直到 pagehide，验证导航分支不先恢复模拟。Monster 与 Mech 同样直接从自动打开的导览返回。

- [ ] **Step 5: 运行完整往返与组合扫描**

Run: `npm run test:showcase-preview`

Expected: PASS；每条旅程始终复用自己的同一个 Page 和单一当前标签，三条旅程都使用 4292 origin、正确产品子路径、正确返回锚点和焦点，没有弹窗或 loopback。

- [ ] **Step 6: 更新套件验证记录并提交**

把“跨产品导航”“四应用生产构建”行更新为带命令、候选 SHA 和测试名称的 `pass`；公开部署仍明确不在范围。

```powershell
git add playwright.showcase-preview.config.ts tests/showcase-preview/showcase-roundtrip.spec.ts package.json docs/SHOWCASE-VALIDATION.md
git commit -m "test: verify showroom product round trips"
```

### Phase 5 Review Gate

- [ ] 从干净终端运行 `npm run dev`，确认四服务一次性就绪输出；Ctrl+C 后核对四端口均释放。
- [ ] 运行 supervisor 集成测试、组合构建、最终扫描、组合 Playwright 与普通根 build；检查 `dist/showcase` 只由安全固定目标清理。
- [ ] 使用 `superpowers:requesting-code-review` 独立复审 Windows/POSIX 进程树、单一截止时间、marker 误判、Vite base、组合相对路径和同标签往返；通过后记录 Phase 5 候选 SHA。

---

## Phase 6 — 文档与全量终验

### Task 13: 更新中文快速开始、工作区契约和四层验证记录

**Files:**
- Modify: `README.md`
- Modify: `docs/skill-installation.md`
- Modify: `docs/superpowers/specs/2026-07-29-showcase-hub-onboarding-design.md`
- Modify: `docs/SHOWCASE-VALIDATION.md`
- Modify: `apps/showcase-hub/docs/VALIDATION.md`
- Modify: `apps/monster-forge/docs/VALIDATION.md`
- Modify: `apps/ashfall-arena/docs/VALIDATION.md`
- Modify: `apps/mech-atelier/docs/VALIDATION.md`
- Modify: `tests/workspace-contract.test.mjs`
- Modify: `scripts/validate-workspace.mjs`

**Interfaces:**
- Consumes: 六阶段实际命令、候选 SHA、四应用地址、16 项批准 Skill 和所有自动化证据。
- Produces: 非技术中文入口、稳定的文档契约、无冒充结论的验证层级。

- [ ] **Step 1: 先写 README 范围、启动和 Skill 语义失败契约**

```js
const markdownSection = (source, heading) => {
  const start = source.indexOf(`## ${heading}`);
  if (start < 0) return "";
  const next = source.indexOf("\n## ", start + heading.length + 3);
  return source.slice(start, next < 0 ? source.length : next);
};

it("opens with a nontechnical three-product showroom quick start", async () => {
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  const quickStart = markdownSection(
    readme,
    "先看效果：一条命令打开三产品能力展厅",
  );
  expect(quickStart).toContain("npm install");
  expect(quickStart).toContain("npm run dev");
  expect(quickStart).toContain("http://127.0.0.1:4172/");
  expect(quickStart).toContain("三款独立产品");
  expect(quickStart).toContain("不是同一款游戏的三个关卡");
});

it("preserves installation location, all 16 skills and runtime impact", async () => {
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  const selectedSkills = await readJson("../config/selected-skills.json");
  expect(readme).toContain("C:\\Users\\yun68\\.codex\\skills");
  for (const { name } of selectedSkills.skills) expect(readme).toContain(name);
  expect(readme).toContain("Skill 是 Codex 开发与验收时读取的工作说明");
  expect(readme).toContain("网页运行时不会加载这些 Skill");
});

it("documents four browser test entry points without a global count assertion", async () => {
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  for (const workspace of [
    "hub", "monster-forge", "ashfall-arena", "mech-atelier",
  ]) {
    expect(readme).toContain(
      `npm run test:browser --workspace @showcase/${workspace}`,
    );
  }
});
```

- [ ] **Step 2: 运行文档契约并确认旧 README 不满足新入口**

Run: `npm test -- --run tests/workspace-contract.test.mjs`

Expected: FAIL；缺少 Hub 快速开始、四应用浏览器入口，旧测试仍硬编码三个命令或旧的“规划中”描述。

- [ ] **Step 3: 把 README 首段改成中文非技术快速开始**

首段顺序固定为：

````markdown
## 先看效果：一条命令打开三产品能力展厅

这个目录展示三款独立产品，它们的能力彼此互补：Monster Forge 用于检查 3D 资产，Ashfall Arena 用于体验可玩的动作游戏系统，Mech Atelier 用于配置复杂 3D 商品。它们不是同一款游戏的三个关卡。

```powershell
npm install
npm run dev
```

终端显示“全部可访问”后，打开 `http://127.0.0.1:4172/`。先在展厅看三款产品的作用，再进入任一产品；产品内的“这是什么？”可重新打开中文说明，“返回能力展厅”会回到对应产品卡。
````

随后逐字说明：Skill 是 Codex 开发与验收时读取的工作说明，网页运行时不会加载这些 Skill；最终交付是普通 Vite/Three.js 网页产品。

- [ ] **Step 4: 保留安装目录、来源和 16 项影响表**

README 与 `docs/skill-installation.md` 必须继续包含：

- 上游来源 `https://github.com/MengTo/Skills` 和锁定来源目录 `skills-source/MengTo-Skills`；
- 全局安装目录 `C:\Users\yun68\.codex\skills`；
- `config/selected-skills.json` 的 16 个名称、产品映射和阶段/影响；
- 安装影响仅是 Codex 可读取对应 `SKILL.md`，不把 Skill 复制进生产 bundle；
- 本项目代码位于当前套件目录，不写进 Codex 根目录的 Skill 文件；
- 雾屿灯塔与 Typographic Flags 是独立演示，不属于能力展厅三产品。

- [ ] **Step 5: 用结构化断言替换旧硬编码数量与过期文案**

`tests/workspace-contract.test.mjs` 改为验证：

```js
const apps = await Promise.all(
  ["showcase-hub", "monster-forge", "ashfall-arena", "mech-atelier"]
    .map((folder) => readJson(`../apps/${folder}/package.json`)),
);
const packages = await Promise.all(
  [
    "content-schema",
    "game-assets",
    "input-system",
    "showcase-guide",
    "three-runtime",
    "ui-system",
  ].map((folder) => readJson(`../packages/${folder}/package.json`)),
);
expect(apps.map(({ name }) => name).sort()).toEqual([
  "@showcase/ashfall-arena",
  "@showcase/hub",
  "@showcase/mech-atelier",
  "@showcase/monster-forge",
]);
expect(packages.map(({ name }) => name).sort()).toEqual([
  "@showcase/content-schema",
  "@showcase/game-assets",
  "@showcase/input-system",
  "@showcase/showcase-guide",
  "@showcase/three-runtime",
  "@showcase/ui-system",
]);
```

删除 README 中 `npm run test:browser` 恰好出现 3 次的脆弱断言，改成 Task 13 Step 1 的四个工作区逐项断言。`scripts/validate-workspace.mjs` 同步承认四应用/六共享包、Hub/guide 路由和新快速开始，但仍从 `selected-skills.json` 动态核对 16 项表格。

- [ ] **Step 6: 修正规格状态但保持规格与结果分离**

只把规格顶部状态改为：

```text
状态：优化版书面规格已确认；需求基线冻结，实施结果以分层验证记录为准
```

不把测试次数、候选 SHA 或执行结果写回设计规格。

- [ ] **Step 7: 统一四产品与套件验证记录**

每份记录都使用实际执行时取得的完整候选 SHA，并按以下归属写证据：

- Hub：固定文案、两层内容、桌面/移动/dialog、真实预览来源、包体、无远程依赖、图片失败；
- Monster：首访/重开/返回、storage、capture、fallback、Glass Crawler + 骨架；
- Ashfall：首帧、输入/模拟/音频/表现冻结、四状态阻塞、重复开关、fallback、dispose、移动/攻击；
- Mech：首访/重开/返回、storage、移动面板、Halo 摘要与 URL、fallback；
- 套件：四服务、进程树、组合构建、无 loopback、同源往返、根测试/构建/validate。

历史结果必须标注历史候选；本轮未运行的命令不得写成通过。

- [ ] **Step 8: 把外部产品结论写成具体 defer**

若执行时仍没有外部证据，执行账本固定使用下列三类结论：

```markdown
- `defer`｜30 秒首次理解：已用自动化确认固定文案与路线，但自动化不能证明理解；未验证风险是非技术访客仍可能混淆三产品与 Skill。复验触发：一名未读 README 的首次非技术访客完成计时复述并记录原话。
- `defer`｜Ashfall 8–12 分钟首次挑战：已验证完整状态机和加速审阅路线，但未取得真实首次玩家时长。复验触发：有效首次玩家样本完成全流程并记录开始、结束和阻塞点。
- `defer`｜真实设备与公开部署：已验证本地响应式与同源组合预览，但未验证实体刘海、安全区、GPU 和公网缓存。复验触发：确定目标设备矩阵或公开托管地址后执行真机/线上 smoke。
```

- [ ] **Step 9: 跑文档和只读 Skill 契约**

Run: `npm test -- --run tests/workspace-contract.test.mjs`

Run: `npm run validate`

Run: `node scripts/check-selected-skills.mjs`

Expected: PASS；16/16 Skill 可读，README、安装文档、AGENTS 路由和实际脚本一致。

- [ ] **Step 10: 提交 Task 13**

```powershell
git add README.md docs/skill-installation.md docs/superpowers/specs/2026-07-29-showcase-hub-onboarding-design.md docs/SHOWCASE-VALIDATION.md apps/showcase-hub/docs/VALIDATION.md apps/monster-forge/docs/VALIDATION.md apps/ashfall-arena/docs/VALIDATION.md apps/mech-atelier/docs/VALIDATION.md tests/workspace-contract.test.mjs scripts/validate-workspace.mjs
git commit -m "docs: explain the three-product showroom"
```

### Task 14: 完成浏览器精修、最多三张视觉证据与终端审计

**Files:**
- Create: `tests/showcase-evidence.test.mjs`
- Create: `apps/showcase-hub/docs/evidence/showcase-desktop.png`
- Create: `apps/showcase-hub/docs/evidence/showcase-dialog.png`
- Create: `apps/showcase-hub/docs/evidence/showcase-mobile.png`
- Modify: `apps/showcase-hub/src/styles.css` only when a failing browser assertion identifies a visual contract breach
- Modify: `apps/showcase-hub/src/ui/render-showcase.ts` only when a failing assertion identifies a card or section DOM breach
- Modify: `apps/showcase-hub/src/ui/product-dialog.ts` only when a failing assertion identifies a dialog DOM breach
- Modify: `apps/showcase-hub/tests/browser/content.spec.ts` only when its desktop content contract fails
- Modify: `apps/showcase-hub/tests/browser/dialog-navigation.spec.ts` only when its dialog or keyboard contract fails
- Modify: `apps/showcase-hub/tests/browser/responsive.spec.ts` only when its mobile, reflow or reduced-motion contract fails
- Modify: `apps/showcase-hub/docs/VALIDATION.md`
- Modify: `docs/SHOWCASE-VALIDATION.md`

**Interfaces:**
- Consumes: Tasks 1–13 的全部候选、`interactive-frontend-refinement` 浏览器校准流程和覆盖矩阵。
- Produces: 最终桌面/说明/手机三张证据、真实浏览器缩放结论或具体 defer、零 `continue` 执行账本和全量工程门禁。

- [ ] **Step 1: 写最终视觉证据数量、名称与尺寸的失败测试**

```js
import { readdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const evidenceDirectory = new URL(
  "../apps/showcase-hub/docs/evidence/",
  import.meta.url,
);
const expectedEvidence = [
  ["showcase-desktop.png", 1440, 900],
  ["showcase-dialog.png", 1440, 900],
  ["showcase-mobile.png", 390, 844],
];
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function readPngSize(bytes, filename) {
  expect(bytes.subarray(0, 8), `${filename} signature`).toEqual(pngSignature);
  expect(bytes.toString("ascii", 12, 16), `${filename} IHDR`).toBe("IHDR");
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

describe("showcase final evidence", () => {
  it("keeps exactly the three approved screenshots at their review viewports", async () => {
    const filenames = (await readdir(evidenceDirectory))
      .filter((filename) => filename.endsWith(".png"))
      .sort();
    expect(filenames).toEqual(expectedEvidence.map(([name]) => name).sort());

    for (const [filename, width, height] of expectedEvidence) {
      const bytes = await readFile(new URL(filename, evidenceDirectory));
      expect(readPngSize(bytes, filename)).toEqual({ width, height });
    }
  });
});
```

- [ ] **Step 2: 运行证据测试并确认最终截图尚不存在**

Run: `npm test -- --run tests/showcase-evidence.test.mjs`

Expected: FAIL；`apps/showcase-hub/docs/evidence/` 或三张固定 PNG 尚不存在，而不是测试语法或导入失败。

- [ ] **Step 3: 使用前端精修技能启动实际页面并做初始捕获**

先读取并使用 `interactive-frontend-refinement`，运行 `npm run dev`，等终端只输出一次四应用就绪。通过受控浏览器依次打开：

```text
http://127.0.0.1:4172/
http://127.0.0.1:4173/
http://127.0.0.1:4174/
http://127.0.0.1:4175/
```

初始截图写入忽略目录 `artifacts/showcase-hub/refinement/`，不覆盖最终证据。

- [ ] **Step 4: 按固定视觉契约核对 Hub 桌面与说明态**

1440×900 首页必须同时满足：

- 首屏无需滚动即可看到眉题、完整 H1、三产品关系说明和两个开始参观入口；
- 正文对比清楚，产品强调色不作为唯一识别；
- 三张真实预览均保持 16:10、不被拉伸、不用 emoji/CSS 图形/手工 SVG 代替；
- 三卡默认层没有任务列表或 Skill 墙；
- “先看说明”与“进入体验”视觉层级不同但都清晰；
- 说明 dialog 名称、完整任务、业务、能力、时间和两个操作在视口内可滚动，不裁切。

发现任一违约时，先在对应 Playwright spec 写能复现该可观察问题的失败断言，运行确认红灯，再只修改 `src/styles.css` 或拥有该 DOM 的模块，重跑到绿灯；不得仅凭截图改动而没有回归测试。

每组校准修复完成后单独提交：

```powershell
git add apps/showcase-hub/src/styles.css apps/showcase-hub/src/ui/render-showcase.ts apps/showcase-hub/src/ui/product-dialog.ts apps/showcase-hub/tests/browser/content.spec.ts apps/showcase-hub/tests/browser/dialog-navigation.spec.ts apps/showcase-hub/tests/browser/responsive.spec.ts
git commit -m "fix: refine showroom browser presentation"
```

- [ ] **Step 5: 按固定跨表面矩阵核对三产品**

逐个产品检查：

| 表面 | 必查状态 |
| --- | --- |
| Monster | 首访、重开、Glass Crawler + 骨架、WebGL fallback、返回 |
| Ashfall | 首访冻结、真实移动/攻击、玩家暂停、升级、失败、完成、fallback、返回 |
| Mech | 首访、移动配置面板、Halo 摘要/URL、storage 失败、fallback、返回 |

导览层不得改变现有空间舞台或移动面板结构；所有“返回能力展厅”都在当前标签返回精确卡片标题。

- [ ] **Step 6: 执行手机、safe-area、键盘、reduced-motion 和真实 200% 缩放审计**

自动化证据：

```powershell
npm run test:browser --workspace @showcase/hub -- responsive.spec.ts dialog-navigation.spec.ts
npm run test:browser --workspace @showcase/monster-forge -- guide.spec.ts
npm run test:browser --workspace @showcase/ashfall-arena
npm run test:browser --workspace @showcase/mech-atelier -- guide.spec.ts
```

真实浏览器审计：

1. 在 390×844 与 320×844 检查无横向滚动、44×44 目标、dialog 的 `100dvh` 和 safe-area padding；
2. 只用 Tab、Shift+Tab、Enter、Space、Escape 完成 Hub 说明开关和一个产品导览；
3. 开启系统/浏览器 reduced-motion，确认没有位移动画；
4. 使用浏览器自身缩放控制把页面设为 200%，记录缩放值、窗口尺寸、主旅程和截图；CSS `zoom`、设备缩放或 720px 代理不能记录为真实 200%。

如果当前受控浏览器无法更改或读取真实缩放，执行账本把这一项写为 `defer`，并记录已尝试的浏览器快捷键/控制入口、720px 自动重排已通过、未验证风险是浏览器级缩放裁切、复验触发是可控制真实 zoom 的 Chrome 会话。

- [ ] **Step 7: 捕获且只保留三张最终视觉证据**

完成所有视觉修复后，用固定状态捕获：

```text
apps/showcase-hub/docs/evidence/showcase-desktop.png
  1440×900，首页首屏和开始参观入口

apps/showcase-hub/docs/evidence/showcase-dialog.png
  1440×900，Monster Forge“先看说明”完整 dialog

apps/showcase-hub/docs/evidence/showcase-mobile.png
  390×844，单列产品卡和底部说明层
```

删除或保持忽略所有中间调试截图；仓库内最终视觉证据总数不超过 3。记录每张图的路由、视口、候选 SHA、状态和捕获日期。

- [ ] **Step 8: 重跑聚焦证据测试并确认转绿**

Run: `npm test -- --run tests/showcase-evidence.test.mjs`

Expected: PASS；仅存在三张固定文件，桌面与说明图为 1440×900，手机图为 390×844。

- [ ] **Step 9: 运行完整工程门禁**

按顺序执行：

```powershell
npm run validate
npm test
npm run build
npm run build:showcase
npm run test:browser --workspace @showcase/hub
npm run test:browser --workspace @showcase/monster-forge
npm run test:browser --workspace @showcase/ashfall-arena
npm run test:browser --workspace @showcase/mech-atelier
npm run test:showcase-preview
git diff --check
git status --short
```

Expected: 所有命令退出码为 0；只存在本阶段三张证据和实际验证记录差异；四应用产物无意外回环地址。

- [ ] **Step 10: 关闭执行账本中的所有 continue**

每一行只能变为：

- `pass`：附本轮候选 SHA、命令/测试名或最终截图；
- `defer`：附已尝试替代路径、未验证风险和可执行复验触发条件。

同时把账本文首的实施期说明改为“最终状态只允许 `pass` 或 `defer`”，移除实施期状态单词本身，确保下面的零匹配检查不会被说明文字误报。

运行：

```powershell
rg -n '\bcontinue\b' docs/SHOWCASE-VALIDATION.md
```

Expected: 无匹配。设计规格中的实施前基线不属于执行账本，不改写。

- [ ] **Step 11: 提交最终证据并独立复审**

```powershell
git add tests/showcase-evidence.test.mjs apps/showcase-hub/docs/evidence apps/showcase-hub/docs/VALIDATION.md docs/SHOWCASE-VALIDATION.md
git commit -m "docs: record showroom browser evidence"
```

使用 `superpowers:requesting-code-review` 对最终候选做独立规格覆盖审查；使用 `superpowers:verification-before-completion` 重新读取最后一轮命令退出码、`git status` 和候选 SHA。若复审要求代码修复，返回对应拥有者任务，先补失败测试，再产生独立修复提交并重跑受影响门禁和全量终验。

### Phase 6 Review Gate

- [ ] 验证 README 的中文快速开始、安装目录、16 项 Skill 与实际 `npm run dev` 一致。
- [ ] 验证最终只提交三张视觉证据，跨应用状态由浏览器测试承担。
- [ ] 验证 `docs/SHOWCASE-VALIDATION.md` 零 `continue`，所有 `defer` 都有替代尝试、风险和复验触发。
- [ ] 验证最终候选 clean、全部工程门禁新鲜通过，再向用户交付本地查看地址、证据文件和仍需真人/真机补充的边界。

## Final Traceability

| 规格要求 | 实施任务 |
| --- | --- |
| 两层中文内容、固定首屏、三产品范围 | Tasks 3–5 |
| 原生说明 dialog、焦点、inert、滚动、Escape | Tasks 2、4 |
| 首访/会话/持久/版本/storage 失败 | Tasks 1–2、6–9 |
| Monster 小成功点 | Task 6 |
| Mech 小成功点与移动面板 | Task 7 |
| Ashfall 首帧、输入、音频、表现和状态矩阵 | Tasks 8–9 |
| DEV/PROD/显式 URL、相对组合路径 | Tasks 1、3、6–8、11 |
| 当前标签返回对应卡和焦点 | Tasks 4、6–8、12 |
| 四服务固定端口、20 秒、marker、树清理 | Task 10 |
| 组合构建、无 loopback、单源站往返 | Tasks 11–12 |
| 三张真实预览、600 KiB、75/20 KiB | Task 5 |
| 1440/390/320、44px、safe-area、200%、reduced-motion | Tasks 5、14 |
| README 安装目录、16 Skills、运行时影响 | Task 13 |
| 四份产品记录、套件记录、最多三张证据 | Tasks 5–9、12–14 |
| 真人理解、8–12 分钟、真机/部署不冒充 | Tasks 13–14 |

## Execution Choice

计划实施时只能选择一种协调方式：

1. **Subagent-Driven（推荐）**：使用 `superpowers:subagent-driven-development`，每个 Task 派发新的实现者，并在任务间执行规格复审与代码质量复审。
2. **Inline Execution**：使用 `superpowers:executing-plans`，在同一任务中按批次执行并在每个 Phase Review Gate 停下复核。
