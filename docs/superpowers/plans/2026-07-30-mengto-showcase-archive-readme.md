# MengTo Skills Showcase Archive README Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `mengto-skills-showcase` 整理为根仓库第 07 个可观看、可重复录制、可验证但尚未公开部署的子项目，同时安全保留用户未提交的第 06 项内容。

**Architecture:** 复用现有同源 `dist/showcase/` 构建、Vite preview 和 Playwright Chromium，新增根级录制库、GIF 产物检查和两层 README 契约。项目 README 负责完整技术故事，根 README 负责精炼入口；第 06 项通过“暂时切换为中性版本后只暂存索引，再恢复工作树详情”的方式保护，最终提交只包含 06 中性占位与完整 07。

**Tech Stack:** Node.js ESM、`node:test`、Vitest `4.1.10`、Playwright `1.62.0`、Vite `8.1.5`、FFmpeg、PowerShell、Git index、Markdown、现有 Three.js 产品。

## Global Constraints

- 需求基线是 `docs/superpowers/specs/2026-07-30-mengto-showcase-archive-readme-design.md`，设计提交为 `8760754`。
- 关系链接固定为：
  - MengTo Skills：`https://github.com/MengTo/Skills`
  - 本项目审查和安装的固定上游版本：`https://github.com/MengTo/Skills/tree/93da48f13fb1b91bdbf4718d0f49df1a469edb45`
  - Vesperfall 关联效果参考：`https://vesperfall.mengto.chatgpt.site/`
- Vesperfall 只作为关联效果参考；不得下载、录制、复制或重新托管其截图、GIF、视频、源码、模型、贴图、动画或页面素材，也不得暗示官方关联。
- Skill 是 Codex 在规划、实现、测试和交付阶段读取的工作说明；浏览器运行时不加载 Skill，最终产物仍是普通 Vite/Three.js 网页。
- 套件固定是四个可运行应用、三款展示产品：Showcase Hub 只是中文入口，Monster Forge、Ashfall Arena、Mech Atelier 才是三款产品。
- 综合演示固定写入 `docs/demos/07-mengto-skills-showcase.gif`，顺序为 Hub → Monster → Ashfall → Mech，目标宽度 `720`、`4 FPS`、`60` 帧、`15` 秒、无限循环、文件不超过 `5 MiB`。
- GIF 只捕获本仓库真实组合构建和真实控件交互；不嵌入 Vesperfall 页面，不使用生成式概念图，不依赖手工启动的 4172–4175 服务。
- 本轮不创建 GitHub Pages、Sites 项目、域名、托管资源、版本标签或其他公开部署；README 必须明确“当前未公开部署”。
- Windows 稳定性修复只允许给目标真实 inspector 测试增加局部 `15_000` 毫秒上限；不得修改生产 inspector、生产构建超时、Vitest 全局超时或 retry。
- 根目录没有 `package.json`；不得为本任务创建根 package。套件现有 `build:showcase`、`preview:showcase`、`test:showcase-preview` 已足够。
- 实施必须遵守 `mengto-skills-showcase/AGENTS.md` 的最窄 Skill 路由：Task 3 在任何真实浏览器试玩前完整读取已批准的 `C:\Users\yun68\.codex\skills\test-playable-web-games\SKILL.md`，并在录制产物检查前完整读取已批准的 `C:\Users\yun68\.codex\skills\ship-web-games\SKILL.md`；Task 6 在最终产物检查、交付证据或推送前重新完整读取 `ship-web-games`。只应用与本任务相符的条款，不读取或接入未列入 `config/selected-skills.json` 的 Skill。
- 不修改 `mengto-skills-showcase/skills-source/MengTo-Skills`、`config/selected-skills.json` 或 `config/skill-source-lock.json`。
- 不整理、暂存、提交或发布 `.superpowers/`、`claude-of-duty-research/`、根 `test-results/`；这些都是当前用户工作树范围。
- 根 `README.md` 当前包含用户第 06 项详细文字。实施后工作树必须继续保留这些详情；推送版本只保留 06 中性“独立整理中”位置和完整 07。
- 不把自动化写成人类首次理解、Ashfall 8–12 分钟首次挑战、真实 safe-area、实体 GPU、真实浏览器 200% 缩放或公网部署已经通过；原有这些 `defer` 必须继续开放。
- 每个提交前分别检查工作树、索引和暂存文件名；禁止使用 `git add .`、`git add -A`、`git commit -a`、强制推送或清理用户未跟踪目录。
- 全部门禁通过前不推送；推送前若 `origin/main` 出现本地未包含的新提交，停止并先协调，不做 force push。

## Public Contracts Locked by This Plan

### Recording contract

```js
export const SHOWCASE_GIF = "docs/demos/07-mengto-skills-showcase.gif";
export const MAX_GIF_BYTES = 5 * 1024 * 1024;
export const FRAME_RATE = 4;
export const GIF_WIDTH = 720;
export const PREVIEW_PORT = 5277;

export const CAPTURE_STAGES = Object.freeze([
  Object.freeze({ id: "showcase-hub", frames: 12, path: "/" }),
  Object.freeze({
    id: "monster-forge",
    frames: 16,
    path: "/monster-forge/?review=ash-warden",
  }),
  Object.freeze({
    id: "ashfall-arena",
    frames: 16,
    path: "/ashfall-arena/?fixture=fresh&reviewControls=1&safeTraining=1&capture=1&quality=high",
  }),
  Object.freeze({
    id: "mech-atelier",
    frames: 16,
    path: "/mech-atelier/?review=default",
  }),
]);

export function commandInvocation(
  command,
  platform = process.platform,
);

export function resolveChromium(playwrightModule);

export function resolveFfmpegCommand(
  environment = process.env,
);

export function createGifCommands({
  framePattern,
  palettePath,
  outputPath,
});

export async function waitForServer(
  url,
  preview,
  dependencies = {},
);

export async function assertGifFile(
  filePath,
  { maxBytes = MAX_GIF_BYTES, expectedWidth = GIF_WIDTH } = {},
);

export async function recordMengToShowcaseDemo({
  rootDir,
  port = PREVIEW_PORT,
} = {});
```

`CAPTURE_STAGES` 共 `60` 帧；`60 / 4 = 15` 秒。录制使用独立的 5277 端口，避免与 4172–4175 开发服务及 4292 组合 Playwright 端口冲突。Ashfall 使用既有确定性 fresh fixture、safe training 和真实键盘输入，仍渲染正式产品 UI；Monster 与 Mech 使用正常首访 UI 并通过“开始体验”关闭说明。

### Archive-check contract

```js
export const MENGTO_SKILLS_URL = "https://github.com/MengTo/Skills";
export const PINNED_SKILLS_URL =
  "https://github.com/MengTo/Skills/tree/93da48f13fb1b91bdbf4718d0f49df1a469edb45";
export const VESPERFALL_URL = "https://vesperfall.mengto.chatgpt.site/";

export function resolveReadmeMediaPath(
  repositoryRoot,
  readmePath,
  mediaReference,
);

export function extractGifReference(readme, label);

export function validateSeventhProjectReadmes({
  rootReadme,
  showcaseReadme,
});

export function assertNoVesperfallMedia(filePaths);

export function assertNoForbiddenStagedPaths(filePaths);

export function assertStagedRootReadmeBoundary({
  stagedFiles,
  indexReadme,
});

export async function checkSeventhProject({
  rootDir,
} = {});
```

根 README 使用 `./docs/demos/07-mengto-skills-showcase.gif`，项目 README 使用 `../docs/demos/07-mengto-skills-showcase.gif`。检查器必须解析两条路径并确认它们指向同一个文件，而不是要求 Markdown 字符串相同。

## File and Responsibility Map

| 单元 | 文件 | 单一职责 |
| --- | --- | --- |
| Windows 测试边界 | `mengto-skills-showcase/tests/showcase-build.test.mjs` | 给九次真实 PowerShell inspector 调用的单一集成测试设置有限局部上限 |
| 录制纯契约 | `scripts/lib/mengto-showcase-recording.mjs` | 录制清单、命令解析、GIF 编码参数、产物签名/尺寸/体积检查 |
| 录制入口 | `scripts/record-mengto-showcase-demo.mjs` | 构建、启动单一组合预览、捕获四阶段、编码 GIF、关闭资源 |
| 归档纯契约 | `scripts/lib/mengto-seventh-project.mjs` | 两层 README、媒体来源、暂存范围与 06 索引边界检查 |
| 归档检查入口 | `scripts/check-mengto-seventh-project.mjs` | 对真实仓库执行只读检查并返回明确退出码 |
| 根级测试 | `tests/mengto-showcase-recording.test.mjs`, `tests/mengto-seventh-project.test.mjs` | 锁定录制和归档工具的纯接口与失败边界 |
| GIF 产物 | `docs/demos/07-mengto-skills-showcase.gif` | 两层 README 共用的 15 秒真实产品演示 |
| 项目文档契约 | `mengto-skills-showcase/tests/workspace-contract.test.mjs`, `mengto-skills-showcase/scripts/validate-workspace.mjs` | 锁定 README 顺序、来源、4/3 口径、安装信息和验证边界 |
| 项目说明 | `mengto-skills-showcase/README.md` | 完整说明来源、三产品、实现流程、安装影响、运行、验证和归档状态 |
| 总项目说明 | `README.md` | 增加第 07 项精炼入口，同时在提交版本中给第 06 项保留中性位置 |
| 验证账本 | `mengto-skills-showcase/docs/SHOWCASE-VALIDATION.md` | 记录本轮新鲜机器证据和继续开放的人工/外部环境 `defer` |

---

### Task 1: 稳定真实 Windows inspector 集成测试

**Files:**
- Modify: `mengto-skills-showcase/tests/showcase-build.test.mjs:476-482`

**Interfaces:**
- Consumes: `buildShowcase({ root, runBuild })` 的默认 `inspectTarget`；成功路径在 Windows 上启动九次独立 PowerShell reparse-point 检查。
- Produces: 该单一测试的 `15_000` 毫秒上限；生产代码、全局 Vitest 配置和其他测试仍保持原边界。

- [ ] **Step 1: 记录已有 RED，不伪造新的延迟**

使用设计阶段已观察到的完整并行套件失败作为 RED：

```text
tests/showcase-build.test.mjs
accepts an ordinary real directory chain with the default Windows inspector
Test timed out in 5000ms.
```

不要添加 `sleep`、mock inspector、retry 或循环运行直到偶发失败；根因已经由真实全套并行负载确认。

- [ ] **Step 2: 只给目标测试增加数字末参**

把该测试改为：

```js
it("accepts an ordinary real directory chain with the default Windows inspector", async () => {
  const root = await createBuildRoot();
  await expect(buildShowcase({
    root,
    runBuild: async () => {},
  })).resolves.toBe(join(root, "dist", "showcase"));
}, 15_000);
```

保持它直接调用 `buildShowcase()`；不得改成注入纯 JavaScript inspector 的 `runFixtureBuild()`。

- [ ] **Step 3: 运行聚焦测试**

Run:

```powershell
cd mengto-skills-showcase
npm test -- tests/showcase-build.test.mjs -t "accepts an ordinary real directory chain with the default Windows inspector"
```

Expected: PASS；测试仍调用默认 Windows inspector，且没有全局 timeout 或 retry 参数。

- [ ] **Step 4: 连续运行两次默认并行完整测试**

Run:

```powershell
npm test
npm test
```

Expected: 两次均 PASS；若任一次仍超时，停止并重新诊断，不继续扩大 timeout。

- [ ] **Step 5: 检查范围并提交**

Run:

```powershell
cd ..
git diff --check -- mengto-skills-showcase/tests/showcase-build.test.mjs
git diff -- mengto-skills-showcase/tests/showcase-build.test.mjs
git add -- mengto-skills-showcase/tests/showcase-build.test.mjs
git diff --cached --name-status
git diff --cached --check
git commit -m "test: allow Windows showcase inspection startup"
```

Expected: 提交只包含一个测试文件和一个 `15_000` 数字末参。

---

### Task 2: 建立录制与第 07 项检查的纯契约

**Files:**
- Create: `scripts/lib/mengto-showcase-recording.mjs`
- Create: `scripts/lib/mengto-seventh-project.mjs`
- Create: `tests/mengto-showcase-recording.test.mjs`
- Create: `tests/mengto-seventh-project.test.mjs`

**Interfaces:**
- Consumes: Node.js ESM、根仓库路径、两层 README 的相对位置、FFmpeg 命令行和 Playwright CommonJS/default export 形态。
- Produces: 上方锁定的 recording/archive-check exports；Task 3 的 CLI 只能通过这些接口执行业务。

- [ ] **Step 1: 写录制契约失败测试**

创建 `tests/mengto-showcase-recording.test.mjs`，包含以下测试：

```js
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  CAPTURE_STAGES,
  FRAME_RATE,
  GIF_WIDTH,
  MAX_GIF_BYTES,
  SHOWCASE_GIF,
  assertGifFile,
  commandInvocation,
  createGifCommands,
  resolveChromium,
  resolveFfmpegCommand,
} from "../scripts/lib/mengto-showcase-recording.mjs";

function gifHeader(width = GIF_WIDTH, height = 480) {
  const bytes = Buffer.alloc(16);
  bytes.write("GIF89a", 0, "ascii");
  bytes.writeUInt16LE(width, 6);
  bytes.writeUInt16LE(height, 8);
  return bytes;
}

test("recording manifest fixes one 15-second four-stage GIF", () => {
  assert.equal(SHOWCASE_GIF, "docs/demos/07-mengto-skills-showcase.gif");
  assert.deepEqual(CAPTURE_STAGES.map(({ id }) => id), [
    "showcase-hub",
    "monster-forge",
    "ashfall-arena",
    "mech-atelier",
  ]);
  assert.equal(
    CAPTURE_STAGES.reduce((sum, stage) => sum + stage.frames, 0),
    60,
  );
  assert.equal(60 / FRAME_RATE, 15);
  assert.equal(GIF_WIDTH, 720);
  assert.equal(MAX_GIF_BYTES, 5 * 1024 * 1024);
});

test("Windows npm and a configured FFmpeg executable resolve explicitly", () => {
  assert.deepEqual(commandInvocation("npm", "win32"), {
    command: "npm.cmd",
    shell: true,
  });
  assert.deepEqual(commandInvocation("node", "win32"), {
    command: "node",
    shell: false,
  });
  assert.equal(
    resolveFfmpegCommand({
      MENGTO_SHOWCASE_FFMPEG: "C:\\tools\\ffmpeg.exe",
    }),
    "C:\\tools\\ffmpeg.exe",
  );
  assert.equal(resolveFfmpegCommand({}), "ffmpeg");
});

test("CommonJS Playwright default export exposes Chromium", () => {
  const chromium = { launch: () => undefined };
  assert.equal(resolveChromium({ default: { chromium } }), chromium);
});

test("GIF commands use a two-pass 720px looping palette pipeline", () => {
  const commands = createGifCommands({
    framePattern: "frame-%03d.png",
    palettePath: "palette.png",
    outputPath: "showcase.gif",
  });
  assert.equal(commands.length, 2);
  assert.match(commands[0].join(" "), /palettegen/);
  assert.match(commands[1].join(" "), /paletteuse/);
  assert.match(commands[1].join(" "), /scale=720:-2/);
  assert.deepEqual(commands[1].slice(-3), ["-loop", "0", "showcase.gif"]);
});

test("GIF inspection rejects signatures, widths, and files over 5 MiB", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "mengto-gif-test-"));
  try {
    const valid = path.join(directory, "valid.gif");
    const invalid = path.join(directory, "invalid.gif");
    const wrongWidth = path.join(directory, "wrong-width.gif");
    const oversized = path.join(directory, "oversized.gif");
    await writeFile(valid, gifHeader());
    await writeFile(invalid, Buffer.from("not a gif"));
    await writeFile(wrongWidth, gifHeader(640));
    await writeFile(
      oversized,
      Buffer.concat([
        gifHeader(),
        Buffer.alloc(MAX_GIF_BYTES + 1 - gifHeader().length),
      ]),
    );

    assert.deepEqual(await assertGifFile(valid), {
      signature: "GIF89a",
      width: 720,
      size: 16,
    });
    await assert.rejects(() => assertGifFile(invalid), /GIF signature/);
    await assert.rejects(() => assertGifFile(wrongWidth), /720/);
    await assert.rejects(() => assertGifFile(oversized), /5 MiB/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: 写归档契约失败测试**

创建 `tests/mengto-seventh-project.test.mjs`：

```js
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  MENGTO_SKILLS_URL,
  PINNED_SKILLS_URL,
  VESPERFALL_URL,
  assertNoForbiddenStagedPaths,
  assertNoVesperfallMedia,
  assertStagedRootReadmeBoundary,
  extractGifReference,
  resolveReadmeMediaPath,
  validateSeventhProjectReadmes,
} from "../scripts/lib/mengto-seventh-project.mjs";

const disclaimer =
  "Vesperfall 仅作为关联效果参考。本项目没有复制或重新托管其源码、模型、贴图、动画或页面素材，也不存在官方关联。";
const runtimeBoundary =
  "Skill 指导 Codex 如何规划、实现、测试和交付；浏览器运行时不会加载 Skill，最终产物仍是普通的 Vite/Three.js 网页。";

function validRootReadme() {
  return [
    "| 07 | MengTo Skills 三产品能力展 |",
    '<img src="./docs/demos/07-mengto-skills-showcase.gif" width="720">',
    MENGTO_SKILLS_URL,
    PINNED_SKILLS_URL,
    VESPERFALL_URL,
    "四个可运行应用、三款产品",
    "当前未公开部署",
    disclaimer,
    runtimeBoundary,
  ].join("\n");
}

function validShowcaseReadme() {
  return [
    "## 先看当前效果",
    '<img src="../docs/demos/07-mengto-skills-showcase.gif" width="720">',
    "## 来源、参考与独立实现",
    MENGTO_SKILLS_URL,
    PINNED_SKILLS_URL,
    VESPERFALL_URL,
    disclaimer,
    runtimeBoundary,
    "## 四个应用、三款产品",
    "四个可运行应用，但只有三款展示产品",
    "## 一条命令本地运行",
    "## 项目如何实现",
    "## Skill 安装目录与全局影响",
    "## 16 项 Skill 与产品/阶段映射",
    "## 测试、构建与验证",
    "## 当前归档状态与验证边界",
    "当前未公开部署",
    "## Skill 更新与安全卸载",
  ].join("\n");
}

test("HTML and Markdown GIF references are both parsed", () => {
  assert.equal(
    extractGifReference(validRootReadme(), "root README"),
    "./docs/demos/07-mengto-skills-showcase.gif",
  );
  assert.equal(
    extractGifReference(
      "![演示](../docs/demos/07-mengto-skills-showcase.gif)",
      "showcase README",
    ),
    "../docs/demos/07-mengto-skills-showcase.gif",
  );
});

test("both README media references resolve to the same repository artifact", () => {
  const root = path.resolve("fixture-root");
  assert.equal(
    resolveReadmeMediaPath(
      root,
      "README.md",
      extractGifReference(validRootReadme(), "root README"),
    ),
    resolveReadmeMediaPath(
      root,
      "mengto-skills-showcase/README.md",
      extractGifReference(validShowcaseReadme(), "showcase README"),
    ),
  );
});

test("valid two-level Chinese documentation satisfies the archive contract", () => {
  assert.deepEqual(validateSeventhProjectReadmes({
    rootReadme: validRootReadme(),
    showcaseReadme: validShowcaseReadme(),
  }), []);
});

test("missing source and four-product wording are reported", () => {
  const failures = validateSeventhProjectReadmes({
    rootReadme: validRootReadme().replace(PINNED_SKILLS_URL, ""),
    showcaseReadme: validShowcaseReadme().replace(
      "四个可运行应用，但只有三款展示产品",
      "四款产品",
    ),
  });
  assert.ok(failures.some((failure) => failure.includes(PINNED_SKILLS_URL)));
  assert.ok(failures.some((failure) => failure.includes("四款产品")));
});

test("Vesperfall media names and user-owned staged prefixes are rejected", () => {
  for (const file of [
    "docs/demos/vesperfall-reference.mp4",
    "docs/vesperfall/reference.png",
  ]) {
    assert.throws(
      () => assertNoVesperfallMedia([file]),
      /Vesperfall media/,
    );
  }
  assert.doesNotThrow(() => assertNoVesperfallMedia([
    "docs/demos/07-mengto-skills-showcase.gif",
  ]));
  for (const file of [
    ".superpowers/session.json",
    "claude-of-duty-research/README.md",
    "test-results/report.json",
  ]) {
    assert.throws(
      () => assertNoForbiddenStagedPaths([file]),
      /forbidden staged path/,
    );
  }
});

test("a staged root README cannot expose the independently organized 06 path", () => {
  for (const reference of [
    "[研究](./claude-of-duty-research/RESEARCH.md)",
    "[研究](claude-of-duty-research/RESEARCH.md)",
    "https://github.com/mshumer/Claude-of-Duty",
  ]) {
    assert.throws(
      () => assertStagedRootReadmeBoundary({
        stagedFiles: ["README.md"],
        indexReadme: reference,
      }),
      /06 project path/,
    );
  }
  assert.doesNotThrow(() => assertStagedRootReadmeBoundary({
    stagedFiles: ["README.md"],
    indexReadme: [
      "| 06 | Claude of Duty 技术研究 | — | 独立整理中；不属于本次第 07 项归档。 |",
      "## 06 · Claude of Duty 技术研究",
      "该项目正在独立整理中，本次不纳入第 07 项归档或提交范围。",
    ].join("\n"),
  }));
});
```

- [ ] **Step 3: 运行测试并确认模块尚不存在**

Run:

```powershell
node --test tests/mengto-showcase-recording.test.mjs tests/mengto-seventh-project.test.mjs
```

Expected: FAIL，错误为两个 `scripts/lib/*.mjs` 模块不存在。

- [ ] **Step 4: 实现录制纯契约**

在 `scripts/lib/mengto-showcase-recording.mjs` 定义锁定常量，并实现：

```js
export function commandInvocation(command, platform = process.platform) {
  const windowsNpm = platform === "win32" && command === "npm";
  return {
    command: windowsNpm ? "npm.cmd" : command,
    shell: windowsNpm,
  };
}

export function resolveChromium(playwrightModule) {
  const chromium =
    playwrightModule.chromium ?? playwrightModule.default?.chromium;
  if (!chromium) {
    throw new Error("Playwright Chromium launcher is unavailable.");
  }
  return chromium;
}

export function resolveFfmpegCommand(environment = process.env) {
  const configured = environment.MENGTO_SHOWCASE_FFMPEG?.trim();
  return configured || "ffmpeg";
}

export function createGifCommands({
  framePattern,
  palettePath,
  outputPath,
}) {
  const scaled = `fps=${FRAME_RATE},scale=${GIF_WIDTH}:-2:flags=lanczos`;
  return [
    [
      "-y",
      "-framerate",
      String(FRAME_RATE),
      "-i",
      framePattern,
      "-vf",
      `${scaled},palettegen=max_colors=64:stats_mode=diff`,
      palettePath,
    ],
    [
      "-y",
      "-framerate",
      String(FRAME_RATE),
      "-i",
      framePattern,
      "-i",
      palettePath,
      "-lavfi",
      `${scaled}[frames];[frames][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
      "-loop",
      "0",
      outputPath,
    ],
  ];
}

export async function assertGifFile(
  filePath,
  { maxBytes = MAX_GIF_BYTES, expectedWidth = GIF_WIDTH } = {},
) {
  const [metadata, bytes] = await Promise.all([
    stat(filePath),
    readFile(filePath),
  ]);
  const signature = bytes.subarray(0, 6).toString("ascii");
  if (!["GIF87a", "GIF89a"].includes(signature)) {
    throw new Error(`Invalid GIF signature: ${filePath}`);
  }
  if (bytes.length < 10) {
    throw new Error(`GIF header is truncated: ${filePath}`);
  }
  const width = bytes.readUInt16LE(6);
  if (width !== expectedWidth) {
    throw new Error(`GIF width must be ${expectedWidth}, received ${width}.`);
  }
  if (metadata.size === 0 || metadata.size > maxBytes) {
    throw new Error(`GIF must be non-empty and no larger than 5 MiB: ${filePath}`);
  }
  return { signature, width, size: metadata.size };
}
```

Import `readFile` and `stat` from `node:fs/promises`。常量和 `CAPTURE_STAGES` 必须逐字采用 Public Contracts 中的值。

- [ ] **Step 5: 实现归档纯契约和真实仓库检查器**

在 `scripts/lib/mengto-seventh-project.mjs` 定义：

```js
const commonRequired = [
  MENGTO_SKILLS_URL,
  PINNED_SKILLS_URL,
  VESPERFALL_URL,
  "三款产品",
  "未公开部署",
  "Vesperfall 仅作为关联效果参考。本项目没有复制或重新托管其源码、模型、贴图、动画或页面素材，也不存在官方关联。",
  "Skill 指导 Codex 如何规划、实现、测试和交付；浏览器运行时不会加载 Skill，最终产物仍是普通的 Vite/Three.js 网页。",
];

const showcaseHeadings = [
  "## 先看当前效果",
  "## 来源、参考与独立实现",
  "## 四个应用、三款产品",
  "## 一条命令本地运行",
  "## 项目如何实现",
  "## Skill 安装目录与全局影响",
  "## 16 项 Skill 与产品/阶段映射",
  "## 测试、构建与验证",
  "## 当前归档状态与验证边界",
  "## Skill 更新与安全卸载",
];

const forbiddenStagedPrefixes = [
  ".superpowers/",
  "claude-of-duty-research/",
  "test-results/",
];

const neutralSixthProject = [
  "| 06 | Claude of Duty 技术研究 | — | 独立整理中；不属于本次第 07 项归档。 |",
  "## 06 · Claude of Duty 技术研究",
  "该项目正在独立整理中，本次不纳入第 07 项归档或提交范围。",
];

const vesperfallMedia =
  /vesperfall.*\.(gif|png|jpe?g|webp|mp4|webm|glb|gltf|fbx)$/i;
```

实现要求：

```js
export function resolveReadmeMediaPath(
  repositoryRoot,
  readmePath,
  mediaReference,
) {
  return path.resolve(
    repositoryRoot,
    path.dirname(readmePath),
    mediaReference,
  );
}

export function validateSeventhProjectReadmes({
  rootReadme,
  showcaseReadme,
}) {
  const failures = [];
  for (const required of commonRequired) {
    if (!rootReadme.includes(required)) {
      failures.push(`README.md missing: ${required}`);
    }
    if (!showcaseReadme.includes(required)) {
      failures.push(`mengto-skills-showcase/README.md missing: ${required}`);
    }
  }
  if (!rootReadme.includes("| 07 |")) {
    failures.push("README.md missing: | 07 |");
  }
  if (!rootReadme.includes("./docs/demos/07-mengto-skills-showcase.gif")) {
    failures.push("README.md missing the project 07 GIF reference");
  }
  if (!showcaseReadme.includes("../docs/demos/07-mengto-skills-showcase.gif")) {
    failures.push("showcase README missing the shared project 07 GIF reference");
  }
  if (!showcaseReadme.includes("四个可运行应用")) {
    failures.push("showcase README must describe four runnable applications");
  }
  if (!showcaseReadme.includes("只有三款展示产品")) {
    failures.push("showcase README must describe only three showcase products");
  }
  if (rootReadme.includes("四款产品") || showcaseReadme.includes("四款产品")) {
    failures.push("README files must not describe four products");
  }
  const positions = showcaseHeadings.map((heading) =>
    showcaseReadme.indexOf(heading));
  if (
    positions.some((position) => position < 0) ||
    positions.some((position, index) =>
      index > 0 && position <= positions[index - 1])
  ) {
    failures.push("showcase README headings are missing or out of order");
  }
  return failures;
}

export function assertNoVesperfallMedia(filePaths) {
  const violation = filePaths
    .map((filePath) => filePath.replaceAll("\\", "/"))
    .find((filePath) => vesperfallMedia.test(filePath));
  if (violation) {
    throw new Error(`Tracked Vesperfall media is forbidden: ${violation}`);
  }
}

export function assertNoForbiddenStagedPaths(filePaths) {
  const violation = filePaths
    .map((filePath) => filePath.replaceAll("\\", "/"))
    .find((filePath) =>
      forbiddenStagedPrefixes.some((prefix) => filePath.startsWith(prefix))
    );
  if (violation) {
    throw new Error(`forbidden staged path: ${violation}`);
  }
}

export function assertStagedRootReadmeBoundary({
  stagedFiles,
  indexReadme,
}) {
  if (!stagedFiles.includes("README.md")) {
    return;
  }
  if (
    indexReadme.includes("claude-of-duty-research/") ||
    indexReadme.includes("github.com/mshumer/Claude-of-Duty")
  ) {
    throw new Error("staged README exposes the independent 06 project path");
  }
  for (const required of neutralSixthProject) {
    if (!indexReadme.includes(required)) {
      throw new Error(`staged README is missing neutral 06 text: ${required}`);
    }
  }
}
```

`checkSeventhProject()` 读取两层 README，解析两条 GIF 引用，调用 `assertGifFile()`，用 `git ls-files` 检查 Vesperfall 命名媒体，用 `git diff --cached --name-only` 检查禁止暂存前缀；只有当根 README 已暂存时才通过 `git show :README.md` 检查 06 索引边界。使用以下骨架，不把真实媒体大小写死：

```js
import { execFile as execFileCallback } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { assertGifFile } from "./mengto-showcase-recording.mjs";

const execFile = promisify(execFileCallback);
const defaultRootDir = fileURLToPath(new URL("../..", import.meta.url));

export function extractGifReference(readme, label) {
  const markdownMatch = readme.match(
    /!\[[^\]]*\]\(([^)\s]*07-mengto-skills-showcase\.gif)\)/,
  );
  const htmlMatch = readme.match(
    /<img\b[^>]*\bsrc=["']([^"']*07-mengto-skills-showcase\.gif)["'][^>]*>/i,
  );
  const reference = markdownMatch?.[1] ?? htmlMatch?.[1];
  if (!reference) {
    throw new Error(`${label} is missing the project 07 GIF image.`);
  }
  return reference;
}

async function gitText(rootDir, args) {
  const { stdout } = await execFile("git", args, {
    cwd: rootDir,
    encoding: "utf8",
    windowsHide: true,
  });
  return stdout;
}

function nulPaths(output) {
  return output.split("\0").filter(Boolean);
}

export async function checkSeventhProject({
  rootDir = defaultRootDir,
} = {}) {
  const rootReadmePath = "README.md";
  const showcaseReadmePath = "mengto-skills-showcase/README.md";
  const [rootReadme, showcaseReadme, trackedOutput, stagedOutput] =
    await Promise.all([
      readFile(path.join(rootDir, rootReadmePath), "utf8"),
      readFile(path.join(rootDir, showcaseReadmePath), "utf8"),
      gitText(rootDir, ["ls-files", "-z"]),
      gitText(rootDir, ["diff", "--cached", "--name-only", "-z"]),
    ]);
  const trackedFiles = nulPaths(trackedOutput);
  const stagedFiles = nulPaths(stagedOutput);
  const failures = validateSeventhProjectReadmes({
    rootReadme,
    showcaseReadme,
  });
  let artifact = null;

  try {
    const rootMedia = resolveReadmeMediaPath(
      rootDir,
      rootReadmePath,
      extractGifReference(rootReadme, rootReadmePath),
    );
    const showcaseMedia = resolveReadmeMediaPath(
      rootDir,
      showcaseReadmePath,
      extractGifReference(showcaseReadme, showcaseReadmePath),
    );
    if (rootMedia !== showcaseMedia) {
      throw new Error("README GIF references do not resolve to one artifact.");
    }
    artifact = await assertGifFile(rootMedia);
  } catch (error) {
    failures.push(error.message);
  }

  for (const check of [
    () => assertNoVesperfallMedia(trackedFiles),
    () => assertNoForbiddenStagedPaths(stagedFiles),
  ]) {
    try {
      check();
    } catch (error) {
      failures.push(error.message);
    }
  }

  if (stagedFiles.includes("README.md")) {
    try {
      const indexReadme = await gitText(rootDir, ["show", ":README.md"]);
      assertStagedRootReadmeBoundary({ stagedFiles, indexReadme });
    } catch (error) {
      failures.push(error.message);
    }
  }

  return { failures, artifact };
}
```

成功返回值为 `{ failures: [], artifact: { signature, width, size } }`；`size` 必须来自真实文件。失败时保留所有可独立发现的错误，CLI 根据 `failures` 设置非零退出码。

- [ ] **Step 6: 运行两个根级测试**

Run:

```powershell
node --test tests/mengto-showcase-recording.test.mjs tests/mengto-seventh-project.test.mjs
```

Expected: 全部 PASS。

- [ ] **Step 7: 检查范围并提交**

Run:

```powershell
git diff --check -- scripts/lib/mengto-showcase-recording.mjs scripts/lib/mengto-seventh-project.mjs tests/mengto-showcase-recording.test.mjs tests/mengto-seventh-project.test.mjs
git add -- scripts/lib/mengto-showcase-recording.mjs scripts/lib/mengto-seventh-project.mjs tests/mengto-showcase-recording.test.mjs tests/mengto-seventh-project.test.mjs
git diff --cached --name-status
git diff --cached --check
git commit -m "feat: add MengTo archive tooling"
```

Expected: 只提交四个新文本文件。

---

### Task 3: 实现真实组合预览录制并生成唯一 GIF

**Files:**
- Modify: `scripts/lib/mengto-showcase-recording.mjs`
- Create: `scripts/record-mengto-showcase-demo.mjs`
- Create: `scripts/check-mengto-seventh-project.mjs`
- Create: `docs/demos/07-mengto-skills-showcase.gif`
- Test: `tests/mengto-showcase-recording.test.mjs`
- Test: `tests/mengto-seventh-project.test.mjs`

**Interfaces:**
- Consumes: Task 2 的 constants/helpers、`mengto-skills-showcase/node_modules/playwright/index.js`、套件 Vite CLI、`dist/showcase/`、FFmpeg。
- Produces: `recordMengToShowcaseDemo()`、两个根级 CLI，以及签名、宽度、体积均通过检查的唯一 GIF。

- [ ] **Step 1: 读取真实试玩 Skill，并给录制测试增加 preview 与帧清单约束**

先完整读取：

- `C:\Users\yun68\.codex\skills\test-playable-web-games\SKILL.md`，记录真实浏览器证据、确定性状态和清理要求；
- `C:\Users\yun68\.codex\skills\ship-web-games\SKILL.md`，记录本地组合产物、媒体检查和诚实交付证据要求。

这是 `mengto-skills-showcase/AGENTS.md` 对三产品试玩与产物检查的强制路由。不要读取未批准 Skill，也不要让 Skill 改变已批准的四阶段产品故事；本轮仍不部署。

然后把 `recordMengToShowcaseDemo` 和 `waitForServer` 加入该测试文件的现有录制库 import，并增加：

```js
test("capture paths use only the same-origin composite preview", () => {
  for (const stage of CAPTURE_STAGES) {
    assert.match(stage.path, /^\//);
    assert.doesNotMatch(stage.path, /417[2-5]|localhost|vesperfall/i);
  }
  assert.equal(
    CAPTURE_STAGES.find(({ id }) => id === "monster-forge")?.path,
    "/monster-forge/?review=ash-warden",
  );
  assert.match(
    CAPTURE_STAGES.find(({ id }) => id === "ashfall-arena")?.path ?? "",
    /fixture=fresh.*safeTraining=1.*capture=1/,
  );
});

test("preview readiness cannot be borrowed from an old service", async () => {
  let exitCode = null;
  const preview = {
    child: {
      get exitCode() {
        return exitCode;
      },
    },
    output: () => "Port 5277 is already in use",
  };
  await assert.rejects(
    () => waitForServer("http://127.0.0.1:5277/", preview, {
      fetchImpl: async () => ({
        ok: true,
        text: async () =>
          '<meta name="showcase-app" content="showcase-hub">',
      }),
      sleep: async () => {
        exitCode = 1;
      },
    }),
    /Port 5277 is already in use/,
  );
});

test("an old Hub cannot pass while the new child is still starting", async () => {
  let exitCode = null;
  let sleeps = 0;
  const preview = {
    child: {
      get exitCode() {
        return exitCode;
      },
    },
    output: () => "loading Vite config",
  };
  await assert.rejects(
    () => waitForServer("http://127.0.0.1:5277/", preview, {
      fetchImpl: async () => ({
        ok: true,
        text: async () =>
          '<meta name="showcase-app" content="showcase-hub">',
      }),
      sleep: async () => {
        sleeps += 1;
        if (sleeps === 3) {
          exitCode = 1;
        }
      },
    }),
    /Vite exited before/,
  );
  assert.equal(sleeps, 3);
});

test("readiness needs this child's Local URL and the Hub marker", async () => {
  const preview = {
    child: { exitCode: null },
    output: () => "➜  Local: http://127.0.0.1:5277/",
  };
  await waitForServer("http://127.0.0.1:5277/", preview, {
    fetchImpl: async () => ({
      ok: true,
      text: async () =>
        '<meta name="showcase-app" content="showcase-hub">',
    }),
    sleep: async () => undefined,
  });
});
```

- [ ] **Step 2: 运行聚焦测试并确认录制函数尚未存在**

```powershell
node --test tests/mengto-showcase-recording.test.mjs
```

Expected: FAIL，错误指出 `recordMengToShowcaseDemo` / `waitForServer` exports 尚不存在。

- [ ] **Step 3: 实现受控命令、preview 和帧保存**

先把录制库顶部 imports 扩展为以下精确集合，再加入受控命令和 preview helper：

```js
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

async function runCommand(command, args, { cwd }) {
  const invocation = commandInvocation(command);
  const child = spawn(invocation.command, args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    shell: invocation.shell,
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });
  const [code] = await once(child, "close");
  if (code !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed with exit code ${code}.\n${output}`,
    );
  }
  return output;
}

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function previewExitError(url, preview) {
  const details = preview.output().trim();
  return new Error(
    `Vite exited before ${url} became ready.` +
      (details ? `\n${details}` : ""),
  );
}

const ansiEscape = /\u001B\[[0-?]*[ -/]*[@-~]/g;

function hasOwnPreviewReadyMarker(url, preview) {
  const output = preview.output().replace(ansiEscape, "");
  const expected = new URL(url);
  return (
    output.includes("Local:") &&
    output.includes(`${expected.protocol}//${expected.host}`)
  );
}

export async function waitForServer(
  url,
  preview,
  {
    fetchImpl = globalThis.fetch,
    sleep = delay,
  } = {},
) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (preview.child.exitCode !== null) {
      throw previewExitError(url, preview);
    }
    let response;
    let html = "";
    try {
      response = await fetchImpl(url);
      html = response.ok ? await response.text() : "";
    } catch {
      if (preview.child.exitCode !== null) {
        throw previewExitError(url, preview);
      }
      await sleep(250);
      continue;
    }
    if (
      response.ok &&
      html.includes('<meta name="showcase-app" content="showcase-hub">') &&
      hasOwnPreviewReadyMarker(url, preview)
    ) {
      await sleep(250);
      if (preview.child.exitCode !== null) {
        throw previewExitError(url, preview);
      }
      return;
    }
    await sleep(250);
  }
  const details = preview.output().trim();
  throw new Error(
    `Timed out waiting for ${url}.` +
      (details ? `\n${details}` : ""),
  );
}

async function saveFrames(page, frameDirectory, frameState, count) {
  await mkdir(frameDirectory, { recursive: true });
  for (let index = 0; index < count; index += 1) {
    const file = path.join(
      frameDirectory,
      `frame-${String(frameState.index).padStart(3, "0")}.png`,
    );
    await page.screenshot({ path: file });
    frameState.index += 1;
    await new Promise((resolve) => setTimeout(resolve, 180));
  }
}
```

preview 必须直接启动，并返回可由清理逻辑关闭的 Node 子进程：

```js
function startPreview({ workspaceDir, port }) {
  const viteEntry = path.join(
    workspaceDir,
    "node_modules",
    "vite",
    "bin",
    "vite.js",
  );
  const child = spawn(process.execPath, [
    viteEntry,
    "preview",
    "--config",
    path.join(workspaceDir, "vite.showcase-preview.config.ts"),
    "--host=127.0.0.1",
    `--port=${port}`,
    "--strictPort",
  ], {
    cwd: workspaceDir,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let output = "";
  const appendOutput = (chunk) => {
    output = `${output}${chunk.toString()}`.slice(-16_384);
  };
  child.stdout.on("data", appendOutput);
  child.stderr.on("data", appendOutput);
  return {
    child,
    output: () => output,
  };
}

async function stopChild(child) {
  if (child.exitCode !== null) {
    return;
  }
  const closed = once(child, "close");
  child.kill();
  await closed;
}
```

不得启动 `npm run dev` 或四个 4172–4175 开发服务。

- [ ] **Step 4: 实现四阶段真实交互**

四阶段使用同一个空存储 browser context，视口固定为 `960 × 640`、`deviceScaleFactor: 1`、`reducedMotion: "no-preference"`。

```js
async function captureStage({
  page,
  stage,
  baseUrl,
  frameDirectory,
  frameState,
}) {
  await page.goto(new URL(stage.path, baseUrl).href, {
    waitUntil: "networkidle",
  });
  await page.locator('meta[name="showcase-app"]').waitFor({
    state: "attached",
  });
  const marker = await page.locator('meta[name="showcase-app"]')
    .getAttribute("content");
  if (marker !== stage.id) {
    throw new Error(`Expected ${stage.id} marker, received ${marker}.`);
  }

  if (stage.id === "showcase-hub") {
    await page.locator("[data-product-card]").first().waitFor({
      state: "visible",
    });
    const previews = page.locator("[data-product-card] img");
    if (await previews.count() !== 3) {
      throw new Error("Showcase Hub must expose three product previews.");
    }
    await page.waitForFunction(
      () => [...document.querySelectorAll("[data-product-card] img")]
        .every((image) => image.complete && image.naturalWidth > 0),
      null,
      { timeout: 10_000 },
    );
    await saveFrames(page, frameDirectory, frameState, 6);
    await page.locator("#product-monster-forge").scrollIntoViewIfNeeded();
    await saveFrames(page, frameDirectory, frameState, 6);
    return;
  }

  if (stage.id === "monster-forge") {
    await page.getByRole("button", {
      name: "开始体验",
      exact: true,
    }).click();
    await page.locator("[data-inspector] canvas").waitFor({
      state: "visible",
    });
    await page.locator(".live-status", {
      hasText: "实时模型已就绪",
    }).waitFor({ state: "visible" });
    await saveFrames(page, frameDirectory, frameState, 4);
    const crawler = page.getByRole("button", { name: /Glass Crawler/ });
    await crawler.click();
    await crawler.waitFor({
      state: "visible",
    });
    if (await crawler.getAttribute("aria-pressed") !== "true") {
      throw new Error("Glass Crawler did not become the active review asset.");
    }
    await saveFrames(page, frameDirectory, frameState, 6);
    await page.getByRole("checkbox", { name: /显示骨架/ }).check();
    await page.locator("[data-overlay-status]", {
      hasText: "骨架已显示",
    }).waitFor({ state: "visible" });
    await page.evaluate(() => window.scrollTo(0, 0));
    await saveFrames(page, frameDirectory, frameState, 6);
    return;
  }

  if (stage.id === "ashfall-arena") {
    const canvas = page.locator("[data-game-canvas]");
    await canvas.waitFor({ state: "visible" });
    if (await page.locator(".runtime-fallback").count() !== 0) {
      throw new Error("Ashfall entered its information fallback.");
    }
    await page.waitForFunction(
      () => window.__ashfallDiagnostics?.snapshot().frameCount > 3,
      null,
      { timeout: 10_000 },
    );
    await canvas.focus();
    await saveFrames(page, frameDirectory, frameState, 4);
    await page.keyboard.down("KeyW");
    try {
      await saveFrames(page, frameDirectory, frameState, 6);
    } finally {
      await page.keyboard.up("KeyW");
    }
    await page.keyboard.press("KeyJ");
    await saveFrames(page, frameDirectory, frameState, 6);
    return;
  }

  await page.getByRole("button", {
    name: "开始体验",
    exact: true,
  }).click();
  await page.locator("[data-product-canvas]").waitFor({
    state: "visible",
  });
  await page.waitForFunction(
    () => window.__MECH_ATELIER_DEBUG__?.nonEmptyPixelCount() > 120,
    null,
    { timeout: 10_000 },
  );
  await saveFrames(page, frameDirectory, frameState, 4);
  await page.getByRole("radio", { name: /光环头部/ }).check();
  await page.locator("[data-summary-price]", {
    hasText: "194,000",
  }).waitFor({ state: "visible" });
  await saveFrames(page, frameDirectory, frameState, 6);
  await page.locator("[data-summary]").scrollIntoViewIfNeeded();
  await saveFrames(page, frameDirectory, frameState, 6);
}
```

完成四阶段后必须断言：

```js
if (frameState.index !== 60) {
  throw new Error(`Expected 60 frames, captured ${frameState.index}.`);
}
```

- [ ] **Step 5: 实现完整生命周期和两遍 FFmpeg**

`recordMengToShowcaseDemo()` 使用以下完整生命周期骨架和 Step 3 已列出的精确 imports。FFmpeg 先写系统临时目录中的候选文件；只有候选签名、宽度和体积全部通过后才复制到 README 使用的最终路径：

```js
const defaultRootDir = fileURLToPath(new URL("../..", import.meta.url));

export async function recordMengToShowcaseDemo({
  rootDir = defaultRootDir,
  port = PREVIEW_PORT,
} = {}) {
  const workspaceDir = path.join(rootDir, "mengto-skills-showcase");
  const temporaryRoot = await mkdtemp(
    path.join(os.tmpdir(), "mengto-showcase-recording-"),
  );
  const frameDirectory = path.join(temporaryRoot, "frames");
  const palettePath = path.join(temporaryRoot, "palette.png");
  const candidatePath = path.join(temporaryRoot, "candidate.gif");
  const outputPath = path.join(rootDir, SHOWCASE_GIF);
  const baseUrl = `http://127.0.0.1:${port}/`;
  let browser = null;
  let preview = null;

  try {
    await runCommand("npm", ["run", "build:showcase"], {
      cwd: workspaceDir,
    });
    preview = startPreview({ workspaceDir, port });
    await waitForServer(baseUrl, preview);

    const playwrightEntry = path.join(
      workspaceDir,
      "node_modules",
      "playwright",
      "index.js",
    );
    const playwrightModule = await import(pathToFileURL(playwrightEntry).href);
    browser = await resolveChromium(playwrightModule).launch({
      headless: true,
    });
    const context = await browser.newContext({
      viewport: { width: 960, height: 640 },
      deviceScaleFactor: 1,
      reducedMotion: "no-preference",
    });
    const page = await context.newPage();
    const frameState = { index: 0 };

    for (const stage of CAPTURE_STAGES) {
      await captureStage({
        page,
        stage,
        baseUrl,
        frameDirectory,
        frameState,
      });
    }
    if (frameState.index !== 60) {
      throw new Error(`Expected 60 frames, captured ${frameState.index}.`);
    }

    const [paletteArgs, gifArgs] = createGifCommands({
      framePattern: path.join(frameDirectory, "frame-%03d.png"),
      palettePath,
      outputPath: candidatePath,
    });
    const ffmpeg = resolveFfmpegCommand();
    await runCommand(ffmpeg, paletteArgs, { cwd: rootDir });
    await runCommand(ffmpeg, gifArgs, { cwd: rootDir });
    await assertGifFile(candidatePath);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await copyFile(candidatePath, outputPath);
    const artifact = await assertGifFile(outputPath);
    return {
      output: SHOWCASE_GIF,
      ...artifact,
    };
  } finally {
    if (browser) {
      await browser.close().catch(() => undefined);
    }
    if (preview) {
      await stopChild(preview.child).catch(() => undefined);
    }
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}
```

FFmpeg 从任务专用的 `MENGTO_SHOWCASE_FFMPEG` 环境变量或 PATH 发现，不得把当前机器的 `D:\26project\...` 绝对路径写入代码或 README。

- [ ] **Step 6: 创建两个 CLI**

`scripts/record-mengto-showcase-demo.mjs`：

```js
import { recordMengToShowcaseDemo } from "./lib/mengto-showcase-recording.mjs";

recordMengToShowcaseDemo()
  .then(({ output, signature, width, size }) => {
    console.log(
      `Recorded ${output}\n${signature} ${width}px ${size} bytes`,
    );
  })
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
```

`scripts/check-mengto-seventh-project.mjs`：

```js
import { checkSeventhProject } from "./lib/mengto-seventh-project.mjs";

const result = await checkSeventhProject();
if (result.failures.length > 0) {
  for (const failure of result.failures) {
    console.error(`FAIL: ${failure}`);
  }
  process.exitCode = 1;
} else {
  const { signature, width, size } = result.artifact;
  console.log(
    `MengTo project 07 check passed: ${signature}, ${width}px, ${size} bytes.`,
  );
}
```

- [ ] **Step 7: 运行单元测试和真实录制**

Run:

```powershell
node --test tests/mengto-showcase-recording.test.mjs tests/mengto-seventh-project.test.mjs
node scripts/record-mengto-showcase-demo.mjs
```

Expected:

- 两个 `node:test` 文件全部 PASS；
- 构建和 preview 自动完成；
- 输出 `docs/demos/07-mengto-skills-showcase.gif`；
- 输出报告 `GIF87a` 或 `GIF89a`、`720px` 和不超过 `5242880` bytes；
- 5277 在脚本结束后可重新绑定，系统临时目录没有遗留 `mengto-showcase-recording-*`。

- [ ] **Step 8: 人工观看 GIF**

打开生成文件并逐段确认：

1. Hub 首屏和三产品卡；
2. Monster Forge 的 Glass Crawler 与骨架状态；
3. Ashfall 的真实移动和攻击反馈；
4. Mech 的光环头部与参数摘要变化；
5. 无空白帧、错误页、外部网页、Vesperfall 画面或开发端口文字。

若文件超过 5 MiB，只允许减少 `palettegen` 的 `max_colors` 或提高现有 Bayer 压缩强度；不得缩短到 12 秒以下、降低到 720px 以下或删除任一产品阶段。

- [ ] **Step 9: 确认文档检查器此时只因 README 尚未更新而失败**

Run:

```powershell
node scripts/check-mengto-seventh-project.mjs
```

Expected: 非零退出，只报告两层 README 缺少第 07 项、GIF 引用、来源或新标题；不得报告 GIF 签名、宽度、体积、Vesperfall 媒体或禁止暂存路径失败。

- [ ] **Step 10: 检查范围并提交**

Run:

```powershell
git diff --check -- scripts/lib/mengto-showcase-recording.mjs scripts/record-mengto-showcase-demo.mjs scripts/check-mengto-seventh-project.mjs tests/mengto-showcase-recording.test.mjs docs/demos/07-mengto-skills-showcase.gif
git add -- scripts/lib/mengto-showcase-recording.mjs scripts/record-mengto-showcase-demo.mjs scripts/check-mengto-seventh-project.mjs tests/mengto-showcase-recording.test.mjs docs/demos/07-mengto-skills-showcase.gif
git diff --cached --name-status
git diff --cached --check
git commit -m "feat: record MengTo showcase demo"
```

Expected: 提交只包含录制实现、两个 CLI 中的录制入口、新测试变化和唯一 GIF；归档检查库已在 Task 2 提交，不重复出现无关变化。

---

### Task 4: 重组项目 README 并锁定中文产品故事

**Files:**
- Modify: `mengto-skills-showcase/tests/workspace-contract.test.mjs:206-306`
- Modify: `mengto-skills-showcase/scripts/validate-workspace.mjs:191-224`
- Modify: `mengto-skills-showcase/README.md`

**Interfaces:**
- Consumes: Task 3 的 GIF、三个固定外部链接、现有 16 项 Skill 表、四个浏览器测试入口和六个共享包。
- Produces: 项目 README 的十段固定顺序，以及由 Vitest 和生产 validator 双重检查的文档契约。

- [ ] **Step 1: 先把 workspace 文档测试改为新契约**

把旧的“快速开始/产品矩阵/两个独立演示”标题断言替换为：

```js
it("documents the archive story in the required Chinese order", async () => {
  const readme = await readFile(
    new URL("../README.md", import.meta.url),
    "utf8",
  );
  const orderedHeadings = [
    "## 先看当前效果",
    "## 来源、参考与独立实现",
    "## 四个应用、三款产品",
    "## 一条命令本地运行",
    "## 项目如何实现",
    "## Skill 安装目录与全局影响",
    "## 16 项 Skill 与产品/阶段映射",
    "## 测试、构建与验证",
    "## 当前归档状态与验证边界",
    "## Skill 更新与安全卸载",
  ];
  const positions = orderedHeadings.map((heading) =>
    readme.indexOf(heading));
  expect(positions.every((position) => position >= 0)).toBe(true);
  expect([...positions].sort((left, right) => left - right))
    .toEqual(positions);

  for (const required of [
    '<img src="../docs/demos/07-mengto-skills-showcase.gif"',
    "https://github.com/MengTo/Skills",
    "https://github.com/MengTo/Skills/tree/93da48f13fb1b91bdbf4718d0f49df1a469edb45",
    "https://vesperfall.mengto.chatgpt.site/",
    "四个可运行应用",
    "只有三款展示产品",
    "当前未公开部署",
    "C:\\Users\\yun68\\.codex\\skills",
    "不会进入最终产品包",
    "不会自动同步",
    "node scripts/record-mengto-showcase-demo.mjs",
    "node scripts/check-mengto-seventh-project.mjs",
    "MENGTO_SHOWCASE_FFMPEG",
    "[验证记录](apps/ashfall-arena/docs/VALIDATION.md)",
    "Node.js 22.12+",
  ]) {
    expect(readme).toContain(required);
  }
  expect(readme).not.toContain("四款产品");
  expect(readme).not.toContain("## 两个独立演示");
});
```

保留现有“16 项表格与 JSON 一致”“四个浏览器命令”“Node 下限”等测试。

- [ ] **Step 2: 运行新契约并确认旧 README 失败**

Run:

```powershell
cd mengto-skills-showcase
npm test -- --run tests/workspace-contract.test.mjs
```

Expected: FAIL，缺少新标题顺序、GIF、固定提交链接和 Vesperfall 声明。

- [ ] **Step 3: 同步生产 validator**

在 `scripts/validate-workspace.mjs` 用与测试相同的 `orderedHeadings` 和必需短语替换旧标题列表：

```js
const orderedHeadings = [
  "## 先看当前效果",
  "## 来源、参考与独立实现",
  "## 四个应用、三款产品",
  "## 一条命令本地运行",
  "## 项目如何实现",
  "## Skill 安装目录与全局影响",
  "## 16 项 Skill 与产品/阶段映射",
  "## 测试、构建与验证",
  "## 当前归档状态与验证边界",
  "## Skill 更新与安全卸载",
];
const headingPositions = orderedHeadings.map((heading) =>
  readme.indexOf(heading));
if (
  headingPositions.some((position) => position < 0) ||
  headingPositions.some((position, index) =>
    index > 0 && position <= headingPositions[index - 1])
) {
  failures.push("README.md archive headings must exist in the required order");
}
```

必需短语加入三个外部链接、GIF 路径、4/3 口径、两句精确边界、“当前未公开部署”、两个根级归档命令和 `MENGTO_SHOWCASE_FFMPEG`；删除“两个独立演示”“不属于能力展厅三产品”的旧强制短语。保持 16 项动态 Skill 表、四应用、六共享包和四个 browser 命令检查不变。

- [ ] **Step 4: 重写项目 README 首屏和信息结构**

开头必须采用：

```markdown
# MengTo Skills 三产品能力展

这是一个由统一中文 Showcase Hub 串联的 Three.js 产品组合：四个可运行应用，只有三款展示产品。Monster Forge 检查 3D 资产，Ashfall Arena 展示可玩的动作游戏系统，Mech Atelier 配置复杂 3D 商品；Hub 负责解释、导航和组合验证，不是第四款产品。

## 先看当前效果

<img src="../docs/demos/07-mengto-skills-showcase.gif" alt="MengTo Skills 三产品能力展：展厅、怪物资产审阅、动作游戏与机甲配置演示" width="720">

GIF 来自本仓库 `dist/showcase/` 的本地组合生产构建，按 Hub → Monster Forge → Ashfall Arena → Mech Atelier 展示真实产品状态；它不包含 Vesperfall 画面。

## 来源、参考与独立实现

- 方法与工作流来源：[MengTo Skills](https://github.com/MengTo/Skills)
- 本项目实际审查和安装的固定版本：[MengTo Skills `93da48f13fb1b91bdbf4718d0f49df1a469edb45`](https://github.com/MengTo/Skills/tree/93da48f13fb1b91bdbf4718d0f49df1a469edb45)
- 关联效果参考：[Vesperfall](https://vesperfall.mengto.chatgpt.site/)

Vesperfall 仅作为关联效果参考。本项目没有复制或重新托管其源码、模型、贴图、动画或页面素材，也不存在官方关联。

Skill 指导 Codex 如何规划、实现、测试和交付；浏览器运行时不会加载 Skill，最终产物仍是普通的 Vite/Three.js 网页。
```

产品矩阵必须包含四行：

```markdown
## 四个应用、三款产品

| 应用 | 产品角色 | 主要作用 | 适合场景 | 验证记录 |
| --- | --- | --- | --- | --- |
| Showcase Hub｜产品能力展厅 | 统一中文入口，不是第四款产品 | 解释三产品关系、导航、中文说明和同源组合 | 产品组合介绍、内部展示、验收入口 | [套件账本](docs/SHOWCASE-VALIDATION.md) |
| Monster Forge｜怪物锻造所 | 资产审阅产品 | 检查怪物模型、动作、骨架、碰撞体、插槽和来源 | 游戏资产库、角色编辑器、数字资产验收 | [验证记录](apps/monster-forge/docs/VALIDATION.md) |
| Ashfall Arena｜灰烬竞技场 | 可玩动作游戏 | 体验战斗、敌人 AI、成长、存档和音画反馈 | 游戏原型、互动营销、战斗系统验证 | [验证记录](apps/ashfall-arena/docs/VALIDATION.md) |
| Mech Atelier｜机甲定制工坊 | 复杂商品配置器 | 更换部件并观察 3D 外观、兼容性、参数和分享状态 | 汽车选配、工业设备、家具和定制商品 | [验证记录](apps/mech-atelier/docs/VALIDATION.md) |
```

删除旧的 `## 两个独立演示`；灯塔和字母旗已有根 README 独立条目，不属于本项目说明。

- [ ] **Step 5: 写一条命令和六阶段实现流程**

README 中加入：

````markdown
## 一条命令本地运行

前置条件：Node.js 22.12+、npm，以及支持 WebGL 的浏览器；底层工具也兼容 Node.js 20.19+。没有 WebGL 时，三款产品会保留如实的静态或信息降级状态。

```powershell
npm install
npm run dev
```

终端显示“全部可访问”后打开 `http://127.0.0.1:4172/`。结束体验时在启动终端按 `Ctrl+C`，supervisor 会关闭 4172–4175 的四棵应用进程。

## 项目如何实现

1. **固定并审计来源：** 把 MengTo Skills 只读来源固定到完整提交，并把批准的 16 项 Skill 写入清单。
2. **冻结规格与路由：** 先确定三款产品的不同目标，再由 `AGENTS.md` 按目录选择最窄的 Skill。
3. **建立共享契约：** 先完成类型、资产、输入、Three.js 生命周期、UI 与产品引导包，产品不互相导入私有状态。
4. **依次实现产品：** Monster 先验证资产管线，Ashfall 再建立完整动作循环，Mech 最后验证复杂商品配置。
5. **增加统一展厅：** Hub 用中文解释三款产品，产品内说明和同标签返回把四个应用串成一个组合体验。
6. **分层验收：** Vitest 检查确定性逻辑，Playwright 检查真实旅程，`build:showcase` 生成同源组合产物，发布前账本诚实保留外部验证边界。
````

- [ ] **Step 6: 保留并重命名安装、映射、验证和卸载内容**

把现有内容按以下标题移动，不删除任何安装路径、16 行 Skill、四个 browser 命令或安全卸载说明：

```text
## Skill 安装目录与全局影响
## 16 项 Skill 与产品/阶段映射
## 测试、构建与验证
## 当前归档状态与验证边界
## Skill 更新与安全卸载
```

在 `## 测试、构建与验证` 中保留现有测试、浏览器与构建命令，并新增：

````markdown
### 重录综合 GIF 与归档检查

以下命令从仓库根目录执行。重录脚本会自行构建 `dist/showcase/`、启动受控本地预览、使用项目现有 Playwright Chromium 捕获四阶段画面，并在完成后关闭进程和删除临时帧：

```powershell
node scripts/record-mengto-showcase-demo.mjs
node scripts/check-mengto-seventh-project.mjs
```

重录需要 FFmpeg：默认从 PATH 查找 `ffmpeg`；如果不在 PATH，可把可执行文件绝对路径写入当前终端的 `MENGTO_SHOWCASE_FFMPEG` 环境变量。检查命令本身不会部署网站，也不会访问或录制 Vesperfall。
````

`当前归档状态与验证边界` 必须逐项写明：

- 当前未公开部署；
- `dist/showcase/` 是可托管的本地组合生产构建，但不是线上地址；
- 30 秒首次理解、Ashfall 8–12 分钟首次挑战、实体 safe-area、实体 GPU、真实浏览器 200% 缩放和公网部署继续为 `defer`；
- Mech 的信用点不代表真实定价，不包含库存、订单、支付或履约。

- [ ] **Step 7: 运行项目文档门禁**

Run:

```powershell
npm test -- --run tests/workspace-contract.test.mjs
npm run validate
```

Expected: 两个命令 PASS；16 项 Skill 表仍与 JSON 完全一致。

- [ ] **Step 8: 运行根级检查并确认只剩根 README 缺少 07**

Run:

```powershell
cd ..
node scripts/check-mengto-seventh-project.mjs
```

Expected: 非零退出，只报告根 `README.md` 缺少第 07 项、GIF、固定链接或 4/3 说明；项目 README 和 GIF 不再报告失败。

- [ ] **Step 9: 检查范围并提交**

Run:

```powershell
git diff --check -- mengto-skills-showcase/README.md mengto-skills-showcase/tests/workspace-contract.test.mjs mengto-skills-showcase/scripts/validate-workspace.mjs
git add -- mengto-skills-showcase/README.md mengto-skills-showcase/tests/workspace-contract.test.mjs mengto-skills-showcase/scripts/validate-workspace.mjs
git diff --cached --name-status
git diff --cached --check
git commit -m "docs: explain MengTo showcase archive"
```

Expected: 不暂存根 README，不触碰 06 或用户未跟踪目录。

---

### Task 5: 在根 README 安全提交 06 中性位置与完整 07

**Files:**
- Modify in working tree and index separately: `README.md`

**Interfaces:**
- Consumes: Task 3 的 GIF、Task 4 的项目 README、用户当前 06 详细行/章节/相关文档链接。
- Produces: Git 索引和提交中的“06 中性占位 + 完整 07”；工作树中的“用户 06 详情 + 完整 07”。

- [ ] **Step 1: 在任何编辑前重新读取用户 06 差异**

Run:

```powershell
git status --short
git diff -- README.md
```

Expected: 根 README 包含用户 06 详细行、`## 06 · Claude of Duty 技术研究` 详情和研究文档链接；`.superpowers/`、`claude-of-duty-research/`、`test-results/` 仍未跟踪。

若当前 06 内容已与计划记录不同，先按最新工作树重新定位，再执行同一“中性暂存、详细恢复”流程；不得用本计划的旧文字覆盖更新后的用户内容。

- [ ] **Step 2: 在工作树保留 06 详情并加入完整 07**

在目录表 06 后加入：

```markdown
| 07 | [MengTo Skills 三产品能力展](./mengto-skills-showcase/) | `mengto-skills-showcase` | 用固定、可审计的 MengTo Skills 工作流，完成 3D 资产审阅、等距动作游戏与复杂商品配置三款独立产品，并由统一中文展厅串联体验与验证。 |
```

在 `## 06` 之后、`## 相关文档` 之前加入：

````markdown
## 07 · MengTo Skills 三产品能力展

这是一个统一中文 Showcase Hub 加三款独立 Three.js 产品的能力展：Monster Forge 审阅怪物资产，Ashfall Arena 展示可玩的动作游戏系统，Mech Atelier 配置复杂 3D 商品。仓库中有四个可运行应用、三款产品；Hub 是解释和导航入口，不是第四款产品。

<img src="./docs/demos/07-mengto-skills-showcase.gif" alt="MengTo Skills 三产品能力展的四阶段演示" width="720">

- **Monster Forge：** 检查模型、动作、骨架、碰撞体、插槽和来源。
- **Ashfall Arena：** 体验等距移动、战斗、敌人 AI、成长、存档与音画反馈。
- **Mech Atelier：** 更换机甲部件，观察兼容性、价格、重量、性能和分享状态。

方法与工作流参考 [MengTo Skills](https://github.com/MengTo/Skills)，本项目实际审查和安装的版本固定为 [`93da48f13fb1b91bdbf4718d0f49df1a469edb45`](https://github.com/MengTo/Skills/tree/93da48f13fb1b91bdbf4718d0f49df1a469edb45)。[Vesperfall](https://vesperfall.mengto.chatgpt.site/) 仅作为关联效果参考。

Vesperfall 仅作为关联效果参考。本项目没有复制或重新托管其源码、模型、贴图、动画或页面素材，也不存在官方关联。

Skill 指导 Codex 如何规划、实现、测试和交付；浏览器运行时不会加载 Skill，最终产物仍是普通的 Vite/Three.js 网页。

```powershell
cd mengto-skills-showcase
npm install
npm run dev
```

四个本地应用就绪后打开 `http://127.0.0.1:4172/`。组合生产构建使用 `npm run build:showcase`；当前未公开部署，没有线上产品地址。

- [完整项目说明](./mengto-skills-showcase/README.md)
- [套件验证账本](./mengto-skills-showcase/docs/SHOWCASE-VALIDATION.md)
````

在“相关文档”增加同样两条项目链接。

- [ ] **Step 3: 在完整工作树版本上运行检查**

Run:

```powershell
node scripts/check-mengto-seventh-project.mjs
```

Expected: PASS；工作树中的用户 06 链接不属于 Vesperfall 媒体，也不应被当作暂存路径。

- [ ] **Step 4: 临时把工作树中的 06 改成中性提交版本**

仅为暂存操作，把 06 目录行替换为：

```markdown
| 06 | Claude of Duty 技术研究 | — | 独立整理中；不属于本次第 07 项归档。 |
```

把 06 章节临时替换为：

```markdown
## 06 · Claude of Duty 技术研究

该项目正在独立整理中，本次不纳入第 07 项归档或提交范围。
```

临时移除“相关文档”中的：

```markdown
- [Claude of Duty 技术研究](./claude-of-duty-research/RESEARCH.md)
```

完整 07 不得变化。

- [ ] **Step 5: 只暂存中性 README**

Run:

```powershell
git add -- README.md
git show :README.md
git diff --cached -- README.md
git diff --cached --name-status
```

Expected:

- 索引含 06 中性行和中性章节；
- 索引含完整 07 和两个项目链接；
- 索引不含 `./claude-of-duty-research/`；
- 暂存文件只有 `README.md`。

- [ ] **Step 6: 暂存后立即恢复工作树中的用户 06 详情**

使用 `apply_patch` 把 Step 1 实际读取到的 06 详细目录行、章节正文和相关文档链接恢复到工作树；不要再次执行 `git add README.md`。完整 07 继续保留。

恢复后运行：

```powershell
git show :README.md
git diff --cached -- README.md
git diff -- README.md
git status --short
```

Expected:

- `git show :README.md` 仍是 06 中性版本；
- `git diff --cached` 是 06 中性占位与完整 07；
- `git diff -- README.md` 只显示用户 06 详情相对中性索引的恢复差异；
- 工作树 07 与索引 07 相同，不出现在未暂存 diff；
- 用户三个未跟踪目录仍未暂存。

- [ ] **Step 7: 在最终索引状态上运行安全检查**

Run:

```powershell
node scripts/check-mengto-seventh-project.mjs
git diff --cached --name-only |
  Select-String '^(?:\.superpowers/|claude-of-duty-research/|test-results/)'
git diff --cached --check
```

Expected: 第一个命令 PASS；`Select-String` 无输出；cached diff 无空白错误。

- [ ] **Step 8: 只提交索引中的根 README**

Run:

```powershell
git commit -m "docs: add MengTo showcase as project 07"
```

不得使用 `git commit -a` 或在提交前重新 `git add README.md`。

- [ ] **Step 9: 提交后验证用户内容仍在本地**

Run:

```powershell
git show --stat --oneline HEAD
git diff -- README.md
git status --short
```

Expected:

- 提交只包含根 `README.md`；
- 本地状态仍显示 ` M README.md`；
- diff 只包含用户 06 详细目录行、章节正文和研究文档链接；
- `.superpowers/`、`claude-of-duty-research/`、`test-results/` 仍未跟踪。

---

### Task 6: 生成最终证据、复验并推送

**Files:**
- Modify: `mengto-skills-showcase/docs/SHOWCASE-VALIDATION.md`
- Regenerate and modify only when bytes differ: `docs/demos/07-mengto-skills-showcase.gif`

**Interfaces:**
- Consumes: Tasks 1–5 的已提交候选、当前真实运行环境、最终 GIF、现有验证账本。
- Produces: 带实际 SHA/命令结果/媒体元数据的归档候选记录，以及同步到 `origin/main` 的提交；不产生公开部署。

- [ ] **Step 1: 重新读取交付 Skill，录制最终 GIF 并记录媒体元数据**

先重新完整读取 `C:\Users\yun68\.codex\skills\ship-web-games\SKILL.md`，只采用与本地构建、产物检查、验证证据和 Git 交付相符的条款。本任务没有部署授权；Skill 中任何公开托管、部署或版本发布步骤都保持不执行。

Run:

```powershell
node scripts/record-mengto-showcase-demo.mjs
node scripts/check-mengto-seventh-project.mjs
git diff --numstat -- docs/demos/07-mengto-skills-showcase.gif
```

Expected: 录制和检查 PASS。若二进制因真实动画采样而变化，保留本次最新产物；不得恢复到未经本轮最终运行的旧 GIF。

若 `git diff --numstat` 有输出，立即把最新 GIF 作为媒体候选单独提交：

```powershell
git add -- docs/demos/07-mengto-skills-showcase.gif
git diff --cached --name-status
git diff --cached --check
git commit -m "docs: refresh MengTo showcase demo"
```

Expected: 该可选提交只包含 GIF。若 `git diff --numstat` 无输出，不创建空提交。

- [ ] **Step 2: 运行项目结构、Skill 和两次完整单元门禁**

Run:

```powershell
cd mengto-skills-showcase
npm run validate
node scripts/check-selected-skills.mjs
npm test
npm test
```

Expected:

- validator PASS；
- 16/16 批准 Skill 都报告可读；
- 两次默认并行完整 Vitest 均 PASS；
- Windows inspector 测试不再在 5 秒失败，且未使用 retry。

- [ ] **Step 3: 运行普通构建、组合构建和真实组合往返**

Run:

```powershell
npm run build
npm run build:showcase
npm run test:showcase-preview
```

Expected: 全部 PASS；组合 Playwright 使用 4292 单源站验证四入口和同标签返回。

- [ ] **Step 4: 运行根级工具和差异门禁**

Run:

```powershell
cd ..
node --test tests/mengto-showcase-recording.test.mjs tests/mengto-seventh-project.test.mjs
node scripts/check-mengto-seventh-project.mjs
git diff --check
git status --short
```

Expected:

- 两个根级测试和第 07 项检查 PASS；
- `git diff --check` PASS；
- 不出现本轮未提交代码、脚本、文档或 GIF；
- 根 README 的用户 06 详情和三个用户未跟踪目录仍保留。

- [ ] **Step 5: 取得实际内容候选 SHA 和 GIF 字节数**

Run:

```powershell
git rev-parse HEAD
(Get-Item -LiteralPath 'docs\demos\07-mengto-skills-showcase.gif').Length
```

复制两个命令的真实 stdout；不要缩短 SHA，不把计划中的示例数字写进账本。

- [ ] **Step 6: 在验证账本追加本轮真实证据**

在 `mengto-skills-showcase/docs/SHOWCASE-VALIDATION.md` 追加 `## 2026-07-30 第 07 项 README/GIF 归档候选`，逐项记录：

- Step 5 的完整内容候选 SHA；
- `docs/demos/07-mengto-skills-showcase.gif` 的实际字节数；
- `GIF87a`/`GIF89a` 实际签名、720 宽、4 FPS、60 帧、15 秒；
- Hub → Monster → Ashfall → Mech 的人工观看结果；
- 两次默认 `npm test` 的实际文件/测试计数；
- `npm run validate`、16/16 Skill 只读检查、普通构建、组合构建和组合 Playwright 的实际结果；
- 当前未公开部署；
- 30 秒首次理解、Ashfall 8–12 分钟、实体 safe-area、实体 GPU、真实 200% 和公网部署继续 `defer`，并保留现有复验条件。

不得把历史候选的测试数复制成当前结果；只写本轮命令 stdout。

- [ ] **Step 7: 暂存验证账本并检查禁止范围**

Run:

```powershell
git add -- mengto-skills-showcase/docs/SHOWCASE-VALIDATION.md
git diff --cached --name-status
git diff --cached --check
git diff --cached --name-only |
  Select-String '^(?:\.superpowers/|claude-of-duty-research/|test-results/)'
```

Expected:

- 暂存区只包含验证账本；
- `Select-String` 无输出；
- 根 README 的用户 06 工作树差异未暂存。

- [ ] **Step 8: 提交验证证据**

Run:

```powershell
git commit -m "docs: record MengTo archive verification"
```

- [ ] **Step 9: 提交后复跑文档敏感门禁**

Run:

```powershell
cd mengto-skills-showcase
npm test -- --run tests/workspace-contract.test.mjs
npm run validate
cd ..
node --test tests/mengto-showcase-recording.test.mjs tests/mengto-seventh-project.test.mjs
node scripts/check-mengto-seventh-project.mjs
git diff --check
```

Expected: 全部 PASS。

- [ ] **Step 10: 审计待推送提交和用户工作树**

Run:

```powershell
git log --oneline --decorate origin/main..HEAD
git diff --name-status origin/main...HEAD
git status --short
```

Expected:

- 待推送提交包含设计、实施计划和本计划列出的逻辑提交；
- `origin/main...HEAD` 不包含 `.superpowers/`、`claude-of-duty-research/`、`test-results/`；
- 工作树仍保留用户根 README 的 06 详情与三个未跟踪目录；
- 没有未提交的本轮代码、脚本、项目 README 或验证账本。

- [ ] **Step 11: 确认远端没有分叉后推送 main**

Run:

```powershell
git fetch origin main
git rev-list --left-right --count origin/main...HEAD
```

Expected: 左侧计数为 `0`，右侧为本轮待推送提交数。若左侧不是 `0`，停止；不得 force push。

随后运行：

```powershell
git push origin main
git rev-list --left-right --count origin/main...HEAD
```

Expected: push 成功，最终计数为 `0  0`。

- [ ] **Step 12: 最终交付说明**

最终回复必须给出：

- GitHub 仓库地址与最终推送 SHA；
- 项目 README、根 README、设计文档、实施计划、GIF 和验证账本的可点击本地路径；
- “四个应用、三款产品”的一句话口径；
- “Vesperfall 仅为关联效果参考、未复制媒体、无官方关联”的边界；
- “当前未公开部署”的状态；
- 仍开放的人工/真机/公网 `defer`；
- 用户第 06 项内容仍只留在本地工作树、未纳入本轮提交。
