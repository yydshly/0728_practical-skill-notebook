# r3f-scroll-rig README 双 GIF 展示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 录制原库 Demo 与《雾屿灯塔》Demo 的真实浏览器动画 GIF，并在根 README 与项目 README 中形成“原库能力 → 我们的应用”对照展示。

**Architecture:** 录制脚本只读取未跟踪的固定历史仓库：用进程内静态 HTTP 服务提供其现有 `examples/build/`，避免旧 Create React App 开发服务器的启动问题；用当前项目自己的 Vite 提供灯塔 Demo。Playwright 在固定视口按四个滚动阶段生成 40 帧，FFmpeg 转为循环 GIF，最终只跟踪脚本、测试、两张 GIF 与 README。

**Tech Stack:** Node.js ESM、Playwright 1.62.0、Vite 5.4.11、React 18、Vitest/Node test、FFmpeg、GIF89a

## Global Constraints

- 交付文件固定为 `docs/demos/08-r3f-scroll-rig-original.gif` 和 `docs/demos/08-r3f-scroll-rig-lighthouse.gif`。
- 视口固定为 `960 × 640`，每个四阶段序列固定为 40 帧、5 fps、约 8 秒、循环播放。
- 每张 GIF 必须在 10 KB 与 8 MB 之间，签名必须是 `GIF87a` 或 `GIF89a`。
- 原库固定提交为 `adf7d47ea5bf3d8e8cf957b0f3667bea752e5f63`，仓库元数据版本为 `7.0.7`，历史示例实际安装版本为 `6.0.5`。
- 灯塔使用 `@14islands/r3f-scroll-rig 8.15.0`，默认录制“稳定构图”。
- 不新增双入口页面，不修改现有 Demo UI，不跟踪 `r3f-scroll-rig-legacy-demo/`、`r3f-scroll-rig-research/`、`node_modules/`、`dist/` 或临时帧。
- README 必须明确：原库回答“这个库能做什么”，灯塔回答“我们如何把它用于真实场景”，该库不是图片自动转 3D 工具。

## File Structure

- `scripts/lib/r3f-scroll-rig-recording.mjs`：来源验证、静态服务、Vite 生命周期、帧序列、Playwright 采集、FFmpeg 转换与清理。
- `scripts/record-r3f-scroll-rig-demos.mjs`：单一命令行入口。
- `tests/r3f-scroll-rig-recording.test.mjs`：纯函数、来源、输出和 GIF 合同测试。
- `tests/r3f-project-eight.test.mjs`：README 双 GIF 引用和项目编号合同。
- `r3f-scroll-rig-showcase/package.json` / `package-lock.json`：固定 Playwright 录制依赖。
- `docs/demos/08-r3f-scroll-rig-original.gif`：原库能力证据。
- `docs/demos/08-r3f-scroll-rig-lighthouse.gif`：灯塔应用证据。
- `README.md` / `r3f-scroll-rig-showcase/README.md`：双 GIF 对照说明。

---

### Task 1: 建立可重复的双 Demo 录制管线

**Files:**
- Modify: `r3f-scroll-rig-showcase/package.json`
- Modify: `r3f-scroll-rig-showcase/package-lock.json`
- Modify: `scripts/lib/r3f-scroll-rig-recording.mjs`
- Create: `scripts/record-r3f-scroll-rig-demos.mjs`
- Modify: `tests/r3f-scroll-rig-recording.test.mjs`

**Interfaces:**
- Consumes: `R3F_LEGACY_DIR`、`legacyDir/examples/build/`、灯塔 Vite 项目、Playwright Chromium、FFmpeg。
- Produces: `buildScrollFrames(stops, framesPerStage): number[]`、`resolveStaticAsset(buildDir, pathname): string`、`recordR3fScrollRigDemos({ rootDir, legacyDir }): Promise<string[]>`。

- [ ] **Step 1: 添加帧序列和静态路径的失败测试**

在 `tests/r3f-scroll-rig-recording.test.mjs` 导入 `buildScrollFrames` 与 `resolveStaticAsset`，增加：

```js
test("four story stops become a forty-frame eight-second sequence", () => {
  const frames = buildScrollFrames([0, 720, 1440, 2280], 10);
  assert.equal(frames.length, 40);
  assert.equal(frames[0], 0);
  assert.equal(frames[9], 0);
  assert.equal(frames.at(-1), 2280);
  assert.ok(frames.every((value, index) => index === 0 || value >= frames[index - 1]));
});

test("static server resolves files inside the historical build only", () => {
  const buildDir = path.resolve("legacy/build");
  assert.equal(
    resolveStaticAsset(buildDir, "/static/js/main.js"),
    path.join(buildDir, "static", "js", "main.js"),
  );
  assert.equal(resolveStaticAsset(buildDir, "/"), path.join(buildDir, "index.html"));
  assert.throws(
    () => resolveStaticAsset(buildDir, "/../package.json"),
    /outside historical build/,
  );
});
```

- [ ] **Step 2: 运行测试并确认 RED**

Run:

```powershell
node --test tests/r3f-scroll-rig-recording.test.mjs
```

Expected: FAIL，提示 `buildScrollFrames` 或 `resolveStaticAsset` 尚未导出。

- [ ] **Step 3: 固定 Playwright 依赖**

Run:

```powershell
cd r3f-scroll-rig-showcase
npm install --save-dev --save-exact playwright@1.62.0
```

确认 `package.json` 包含：

```json
"playwright": "1.62.0"
```

检查 `chromium.executablePath()` 指向的文件是否存在；只有不存在时才运行一次：

```powershell
npx playwright install chromium
```

不要在浏览器已存在时重复下载安装。

- [ ] **Step 4: 实现纯函数与历史来源验证**

在 `scripts/lib/r3f-scroll-rig-recording.mjs` 保留现有常量和验证器，并加入：

```js
export function buildScrollFrames(stops, framesPerStage = 10) {
  return stops.flatMap((target, stageIndex) => {
    const start = stageIndex === 0 ? target : stops[stageIndex - 1];
    return Array.from({ length: framesPerStage }, (_, frameIndex) => {
      if (stageIndex === 0) return target;
      const progress = (frameIndex + 1) / framesPerStage;
      return Math.round(start + (target - start) * progress);
    });
  });
}

export function resolveStaticAsset(buildDir, pathname) {
  const relative = decodeURIComponent(pathname === "/" ? "index.html" : pathname.slice(1));
  const resolved = path.resolve(buildDir, relative);
  const boundary = `${path.resolve(buildDir)}${path.sep}`;
  if (resolved !== path.join(path.resolve(buildDir), "index.html") && !resolved.startsWith(boundary)) {
    throw new Error(`Static asset is outside historical build: ${pathname}`);
  }
  return resolved;
}
```

`inspectLegacySource(legacyDir)` 必须读取并验证：

```js
const head = await run("git", [
  "-c",
  `safe.directory=${legacyDir.replaceAll("\\", "/")}`,
  "-C",
  legacyDir,
  "rev-parse",
  "HEAD",
]);
const repositoryVersion = (await readJson(path.join(legacyDir, "package.json"))).version;
const resolvedVersion = (
  await readJson(
    path.join(
      legacyDir,
      "examples",
      "node_modules",
      "@14islands",
      "r3f-scroll-rig",
      "package.json",
    ),
  )
).version;
assertLegacySource({ legacyDir, head, repositoryVersion, resolvedVersion });
```

- [ ] **Step 5: 实现两个可靠服务**

历史 Demo 使用 `node:http` 直接服务 `examples/build/`，根路径和未知客户端路径回退到 `index.html`；按 `.html`、`.js`、`.css`、`.json`、`.png`、`.jpg`、`.webp`、`.glb`、`.drc` 设置内容类型。返回 `{ url, close }`，其中 `close()` 使用 Promise 等待 `server.close()`。

```js
const CONTENT_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".webp", "image/webp"],
  [".glb", "model/gltf-binary"],
  [".drc", "application/octet-stream"],
]);

async function startStaticServer(buildDir, port = 5223) {
  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
      let assetPath = resolveStaticAsset(buildDir, requestUrl.pathname);
      try {
        response.setHeader(
          "Content-Type",
          CONTENT_TYPES.get(path.extname(assetPath)) ?? "application/octet-stream",
        );
        response.end(await readFile(assetPath));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        assetPath = path.join(buildDir, "index.html");
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.end(await readFile(assetPath));
      }
    } catch (error) {
      response.statusCode = 500;
      response.end(error.message);
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return {
    url: `http://127.0.0.1:${port}/`,
    close: () => new Promise((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve())),
  };
}
```

灯塔 Demo 直接启动 Vite 入口，不通过 `npm.cmd`：

```js
const child = spawn(
  process.execPath,
  [path.join(showcaseDir, "node_modules", "vite", "bin", "vite.js"),
   "--host=127.0.0.1", "--port=5224", "--strictPort"],
  {
    cwd: showcaseDir,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  },
);
```

`waitForServer(url, child)` 的每次 fetch 使用 `AbortSignal.timeout(1_000)`，总等待不超过 30 秒；启动失败必须包含子进程 stdout/stderr。`finally` 中先关闭浏览器，再停止 Vite，再关闭静态服务，最后只删除本次 `mkdtemp` 创建的帧目录。

顶层编排必须保留每个资源引用，即使后续步骤失败也能清理：

```js
export async function recordR3fScrollRigDemos({
  rootDir = repositoryRoot,
  legacyDir,
} = {}) {
  const resolvedLegacyDir = resolveLegacyDirectory(rootDir, legacyDir);
  await inspectLegacySource(resolvedLegacyDir);
  const temporaryRoot = await mkdtemp(
    path.join(os.tmpdir(), "r3f-scroll-rig-recording-"),
  );
  let originalServer;
  let showcaseServer;
  let browser;
  try {
    originalServer = await startStaticServer(
      path.join(resolvedLegacyDir, "examples", "build"),
      5223,
    );
    showcaseServer = await startShowcaseServer(rootDir);
    browser = await (await loadChromium(rootDir)).launch({
      headless: true,
      args: ["--enable-webgl", "--ignore-gpu-blocklist", "--use-angle=swiftshader"],
    });
    await captureOriginal(browser, path.join(temporaryRoot, "original"));
    await captureLighthouse(browser, path.join(temporaryRoot, "lighthouse"));
    const outputs = RECORDINGS.map(({ output }) => path.join(rootDir, output));
    await framesToGif(path.join(temporaryRoot, "original"), outputs[0]);
    await framesToGif(path.join(temporaryRoot, "lighthouse"), outputs[1]);
    await Promise.all(outputs.map(assertGifFile));
    return outputs;
  } finally {
    await browser?.close();
    await stopShowcaseServer(showcaseServer);
    await originalServer?.close();
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}
```

- [ ] **Step 6: 实现 Playwright 采集与 FFmpeg 转换**

Playwright 从 `r3f-scroll-rig-showcase/node_modules/playwright` 动态导入。Chromium 使用：

```js
browser = await chromium.launch({
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist", "--use-angle=swiftshader"],
});
```

每个页面使用 `CAPTURE_VIEWPORT`，按 `buildScrollFrames(stops, 10)` 设置 `window.scrollTo(0, top)`，等待 120 ms 后保存 `frame-%03d.png`。

页面就绪断言：

```js
await originalPage.getByText(
  "A ScrollScene with a Cube mesh inside using global lights.",
  { exact: true },
).waitFor({ timeout: 60_000 });

await lighthousePage.getByRole("heading", { name: "雾屿灯塔", exact: true }).waitFor();
await lighthousePage.getByRole("button", { name: "稳定构图", exact: true }).waitFor();
await lighthousePage.waitForFunction(
  () => document.documentElement.classList.contains("webgl-ready"),
  null,
  { timeout: 60_000 },
);
```

FFmpeg 使用 5 fps、960 像素宽、128 色调色板和无限循环：

```js
await run("ffmpeg", [
  "-y",
  "-framerate", "5",
  "-i", "frame-%03d.png",
  "-filter_complex",
  "[0:v]fps=5,scale=960:-2:flags=lanczos,split[p][s];[s]palettegen=max_colors=128:stats_mode=diff[pal];[p][pal]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle",
  "-loop", "0",
  outputFile,
], { cwd: frameDirectory });
```

- [ ] **Step 7: 创建命令行入口**

创建 `scripts/record-r3f-scroll-rig-demos.mjs`：

```js
import { recordR3fScrollRigDemos } from "./lib/r3f-scroll-rig-recording.mjs";

recordR3fScrollRigDemos()
  .then((files) => {
    console.log(`Recorded r3f-scroll-rig GIFs:\n${files.join("\n")}`);
  })
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
```

- [ ] **Step 8: 运行 GREEN 验证并提交管线**

Run:

```powershell
node --test tests/r3f-scroll-rig-recording.test.mjs
cd r3f-scroll-rig-showcase
npm test
npm run build
```

Expected: Node 测试全部通过；Vitest 10 个文件、63 项测试通过；Vite 构建退出 `0`。

Commit:

```powershell
git add r3f-scroll-rig-showcase/package.json r3f-scroll-rig-showcase/package-lock.json scripts/lib/r3f-scroll-rig-recording.mjs scripts/record-r3f-scroll-rig-demos.mjs tests/r3f-scroll-rig-recording.test.mjs
git commit -m "feat: add r3f demo recording pipeline"
```

---

### Task 2: 生成并检查两张真实 GIF

**Files:**
- Create: `docs/demos/08-r3f-scroll-rig-original.gif`
- Create: `docs/demos/08-r3f-scroll-rig-lighthouse.gif`

**Interfaces:**
- Consumes: Task 1 的 `recordR3fScrollRigDemos()`、固定历史构建、灯塔 Vite 项目。
- Produces: 两张经过签名、大小和视觉检查的 README 媒体文件。

- [ ] **Step 1: 验证历史来源和构建文件**

Run:

```powershell
git -c safe.directory=D:/codex_project_work/0728_some_github/r3f-scroll-rig-legacy-demo -C D:/codex_project_work/0728_some_github/r3f-scroll-rig-legacy-demo rev-parse HEAD
node -p "require('./r3f-scroll-rig-legacy-demo/package.json').version"
node -p "require('./r3f-scroll-rig-legacy-demo/examples/node_modules/@14islands/r3f-scroll-rig/package.json').version"
Test-Path ./r3f-scroll-rig-legacy-demo/examples/build/index.html
```

Expected: `adf7d47ea5bf3d8e8cf957b0f3667bea752e5f63`、`7.0.7`、`6.0.5`、`True`。

- [ ] **Step 2: 运行一次录制**

Run:

```powershell
$env:R3F_LEGACY_DIR=(Resolve-Path ./r3f-scroll-rig-legacy-demo).Path
node scripts/record-r3f-scroll-rig-demos.mjs
```

Expected: 打印两个 GIF 的绝对路径，退出 `0`，端口 5223/5224 无残留监听。

- [ ] **Step 3: 验证文件合同**

Run:

```powershell
node --test tests/r3f-scroll-rig-recording.test.mjs
Get-Item docs/demos/08-r3f-scroll-rig-original.gif,docs/demos/08-r3f-scroll-rig-lighthouse.gif | Select-Object Name,Length
```

Expected: 两张文件均在 10 KB 与 8 MB 之间，测试通过。

- [ ] **Step 4: 生成四阶段接触表并视觉检查**

使用 FFmpeg 从每张 GIF 的第 0、10、20、30 帧生成 2×2 接触表：

```powershell
ffmpeg -y -i docs/demos/08-r3f-scroll-rig-original.gif -vf "select='eq(n,0)+eq(n,10)+eq(n,20)+eq(n,30)',scale=480:320,tile=2x2" C:/tmp/08-r3f-original-contact.png
ffmpeg -y -i docs/demos/08-r3f-scroll-rig-lighthouse.gif -vf "select='eq(n,0)+eq(n,10)+eq(n,20)+eq(n,30)',scale=480:320,tile=2x2" C:/tmp/08-r3f-lighthouse-contact.png
```

视觉检查必须确认：

- 原库：内联 3D、Sticky、图片视差至少各有一阶段可辨认。
- 灯塔：开场、接近、信号、路线档案四阶段可辨认，且“稳定构图”被选中。
- 两张图均无浏览器边框、错误覆盖层、空白 Canvas、调试控件或明显裁切。

- [ ] **Step 5: 提交媒体**

```powershell
git add docs/demos/08-r3f-scroll-rig-original.gif docs/demos/08-r3f-scroll-rig-lighthouse.gif
git commit -m "docs: record r3f project eight demos"
```

---

### Task 3: 在两级 README 中展示双 GIF

**Files:**
- Modify: `README.md`
- Modify: `r3f-scroll-rig-showcase/README.md`
- Modify: `tests/r3f-project-eight.test.mjs`

**Interfaces:**
- Consumes: Task 2 的两张 GIF 和现有项目 08/09/10 编号。
- Produces: 根 README 与项目 README 的双演示对照，以及防止链接和措辞回退的测试。

- [ ] **Step 1: 添加 README 合同失败测试**

在 `tests/r3f-project-eight.test.mjs` 的文档测试中加入：

```js
for (const required of [
  "./docs/demos/08-r3f-scroll-rig-original.gif",
  "./docs/demos/08-r3f-scroll-rig-lighthouse.gif",
  "原库 Demo 回答“这个库能做什么”",
  "灯塔 Demo 回答“我们如何把它用于真实场景”",
  "adf7d47ea5bf3d8e8cf957b0f3667bea752e5f63",
  "上游采用 ISC 许可",
]) {
  assert.ok(rootReadme.includes(required), `README.md missing: ${required}`);
}

for (const required of [
  "../docs/demos/08-r3f-scroll-rig-original.gif",
  "../docs/demos/08-r3f-scroll-rig-lighthouse.gif",
]) {
  assert.ok(projectReadme.includes(required), `project README missing: ${required}`);
}
```

同时删除旧的无 GIF 断言：

```js
assert.doesNotMatch(`${rootReadme}\n${projectReadme}`, /08-r3f-scroll-rig-.*\.gif/);
```

- [ ] **Step 2: 运行测试并确认 RED**

Run:

```powershell
node --test tests/r3f-project-eight.test.mjs
```

Expected: FAIL，报告缺少 GIF 路径或对照结论。

- [ ] **Step 3: 更新根 README**

在 `## 08 · r3f-scroll-rig 原库能力与雾屿灯塔应用验证` 中、运行命令之前加入：

```markdown
原库 Demo 回答“这个库能做什么”：

<img src="./docs/demos/08-r3f-scroll-rig-original.gif" alt="r3f-scroll-rig 原库 Demo 的滚动、Sticky 与视差能力展示" width="720">

灯塔 Demo 回答“我们如何把它用于真实场景”：

<img src="./docs/demos/08-r3f-scroll-rig-lighthouse.gif" alt="雾屿灯塔滚动叙事 Demo" width="720">

原库录制固定来自 [14islands/r3f-scroll-rig](https://github.com/14islands/r3f-scroll-rig) 提交 `adf7d47ea5bf3d8e8cf957b0f3667bea752e5f63`，历史样例实际安装版本为 `6.0.5`。上游采用 ISC 许可；本仓库是独立研究与应用验证，不表示官方关联。
```

保留项目 08、Finesse 09、My Room 10 的编号，不修改其余项目内容。

- [ ] **Step 4: 更新项目 README**

在简介和“本地运行”之间加入 `## 两个演示分别证明什么`，使用项目相对路径：

```markdown
## 两个演示分别证明什么

原库 Demo 回答“这个库能做什么”：

<img src="../docs/demos/08-r3f-scroll-rig-original.gif" alt="r3f-scroll-rig 原库 Demo 的滚动、Sticky 与视差能力展示" width="720">

灯塔 Demo 回答“我们如何把它用于真实场景”：

<img src="../docs/demos/08-r3f-scroll-rig-lighthouse.gif" alt="雾屿灯塔滚动叙事 Demo" width="720">
```

保留“不是图片自动转 3D”、ISC 和非官方关联说明。

- [ ] **Step 5: 运行 GREEN 验证并提交 README**

Run:

```powershell
node --test tests/r3f-project-eight.test.mjs
git diff --check
```

Expected: 测试通过；无空白错误。

Commit:

```powershell
git add README.md r3f-scroll-rig-showcase/README.md tests/r3f-project-eight.test.mjs
git commit -m "docs: show both r3f project eight demos"
```

---

### Task 4: 完整验证并安全推送

**Files:**
- Modify only if evidence is inaccurate: `README.md`
- Modify only if evidence is inaccurate: `r3f-scroll-rig-showcase/README.md`

**Interfaces:**
- Consumes: Tasks 1–3 的录制管线、媒体、文档和测试。
- Produces: 本地与远端一致的 `main`，不覆盖远端新内容。

- [ ] **Step 1: 运行完整验证**

Run:

```powershell
node --test tests/*.test.mjs
cd r3f-scroll-rig-showcase
npm ci
npm test
npm run build
```

Expected: 根测试全部通过；Vitest 10 文件、63 项测试通过；Vite 构建退出 `0`。

- [ ] **Step 2: 审计媒体和跟踪范围**

Run:

```powershell
node -e "import('./scripts/lib/r3f-scroll-rig-recording.mjs').then(async m => Promise.all(m.RECORDINGS.map(({output}) => m.assertGifFile(output))))"
git ls-files | rg "r3f-scroll-rig-legacy-demo|r3f-scroll-rig-research|node_modules|(^|/)dist/|r3f-scroll-rig-recording-"
git diff --check
git status --short
```

Expected: GIF 验证成功；禁止路径搜索无结果；只保留用户已有的未跟踪研究目录。

- [ ] **Step 3: 对齐远端并比较分叉**

Run:

```powershell
git fetch origin --prune
git rev-list --left-right --count origin/main...main
```

如果左侧为 `0`，执行普通快进推送；如果左侧非 `0`，先普通合并 `origin/main`、解决冲突并重复 Steps 1–2。禁止 `--force` 和 `--force-with-lease`。

- [ ] **Step 4: 普通推送并验证一致**

Run:

```powershell
git push origin main
git rev-parse main
git rev-parse origin/main
```

Expected: 两个提交哈希完全一致。
