# r3f-scroll-rig Project Eight Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Register `r3f-scroll-rig` as the root notebook’s reproducible project 08, preserve Finesse as project 09, and present truthful evidence from both the library’s historical bundled example and our lighthouse application.

**Architecture:** The root repository will track a focused `r3f-scroll-rig-showcase/` package copied from the completed lighthouse demo, not the unpublished nested research repository. Root README evidence will follow the existing Fungarium pattern: one committed GIF for the upstream example, one committed GIF for our application, concise capability mapping, source boundaries, and independent run instructions.

**Tech Stack:** React 18, Vite 5, Vitest, `@14islands/r3f-scroll-rig@8.15.0`, React Three Fiber, Node.js test runner, Playwright-compatible browser capture, FFmpeg, Markdown.

## Global Constraints

- Reuse the existing root README comparison pattern; do not create a new comparison hub or dual-WebGL page.
- Register `r3f-scroll-rig` as project `08` and move Finesse Skill research to project `09` without deleting or reducing its content.
- Pin the historical library-example source to `https://github.com/14islands/r3f-scroll-rig` commit `adf7d47ea5bf3d8e8cf957b0f3667bea752e5f63`; repository metadata at that snapshot reports version `7.0.7`.
- Read and record the historical example’s actually resolved package version; never claim it is the same version as the lighthouse demo.
- Keep the lighthouse dependency exact at `@14islands/r3f-scroll-rig@8.15.0`.
- The canonical lighthouse runtime is `http://127.0.0.1:4174/`.
- Do not track `r3f-scroll-rig-research/`, `r3f-scroll-rig-legacy-demo/`, nested `.git` data, `node_modules`, `dist`, browser caches, temporary frames, or intermediate recordings.
- Preserve all unrelated untracked files already present in the root workspace; stage only explicit task paths.
- The project remains a 2.5D layered-image demonstration, not an automatic image-to-3D conversion.
- No deployment and no forced dependency-audit upgrade are in scope.

---

### Task 1: Create the reproducible project 08 package

**Files:**
- Create: `r3f-scroll-rig-showcase/.gitignore`
- Create: `r3f-scroll-rig-showcase/index.html`
- Create: `r3f-scroll-rig-showcase/package.json`
- Create: `r3f-scroll-rig-showcase/package-lock.json`
- Create: `r3f-scroll-rig-showcase/vite.config.js`
- Create: `r3f-scroll-rig-showcase/src/`
- Create: `r3f-scroll-rig-showcase/public/assets/routes/`
- Create: `r3f-scroll-rig-showcase/public/assets/scene/`
- Create: `scripts/lib/r3f-project-eight.mjs`
- Create: `tests/r3f-project-eight.test.mjs`

**Interfaces:**
- Consumes: the tracked files at `r3f-scroll-rig-research/examples/lighthouse-scroll-rig-demo/` from commit `8cd60e3`.
- Produces: `validateShowcase(rootDir: string): Promise<void>`, `assertNoTrackedResearchTrees(paths: string[]): void`, `SHOWCASE_DIRECTORY`, `SHOWCASE_DEPENDENCY_VERSION`, and a standalone project 08 package used by every later task.

- [ ] **Step 1: Write the failing project-package test**

Create `tests/r3f-project-eight.test.mjs` with these assertions:

```js
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  SHOWCASE_DEPENDENCY_VERSION,
  SHOWCASE_DIRECTORY,
  assertNoTrackedResearchTrees,
  validateShowcase,
} from "../scripts/lib/r3f-project-eight.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("project 08 is a standalone lighthouse showcase pinned to scroll-rig 8.15.0", async () => {
  assert.equal(SHOWCASE_DIRECTORY, "r3f-scroll-rig-showcase");
  assert.equal(SHOWCASE_DEPENDENCY_VERSION, "8.15.0");
  await validateShowcase(rootDir);
});

test("nested research repositories and generated folders are forbidden", () => {
  assert.throws(
    () => assertNoTrackedResearchTrees(["r3f-scroll-rig-research/.git/config"]),
    /forbidden project-08 path/,
  );
  assert.throws(
    () => assertNoTrackedResearchTrees(["r3f-scroll-rig-showcase/node_modules/vite/index.js"]),
    /forbidden project-08 path/,
  );
  assert.doesNotThrow(() =>
    assertNoTrackedResearchTrees(["r3f-scroll-rig-showcase/src/App.jsx"]),
  );
});
```

- [ ] **Step 2: Run the test and verify the missing module failure**

Run:

```powershell
node --test tests/r3f-project-eight.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/lib/r3f-project-eight.mjs`.

- [ ] **Step 3: Add the validation module**

Create `scripts/lib/r3f-project-eight.mjs`:

```js
import { access, readFile } from "node:fs/promises";
import path from "node:path";

export const SHOWCASE_DIRECTORY = "r3f-scroll-rig-showcase";
export const SHOWCASE_DEPENDENCY_VERSION = "8.15.0";

const requiredFiles = [
  "index.html",
  "package.json",
  "package-lock.json",
  "vite.config.js",
  "src/App.jsx",
  "src/main.jsx",
  "src/story.js",
  "src/composition-mode.js",
  "public/assets/scene/30-lighthouse.webp",
];

export function assertNoTrackedResearchTrees(paths) {
  const forbidden = paths.find(
    (filePath) =>
      filePath === "r3f-scroll-rig-research" ||
      filePath.startsWith("r3f-scroll-rig-research/") ||
      filePath === "r3f-scroll-rig-legacy-demo" ||
      filePath.startsWith("r3f-scroll-rig-legacy-demo/") ||
      filePath.includes("/.git/") ||
      filePath.includes("/node_modules/") ||
      filePath.includes("/dist/"),
  );
  if (forbidden) throw new Error(`forbidden project-08 path: ${forbidden}`);
}

export async function validateShowcase(rootDir) {
  const projectDir = path.join(rootDir, SHOWCASE_DIRECTORY);
  for (const relativePath of requiredFiles) {
    await access(path.join(projectDir, relativePath));
  }
  const manifest = JSON.parse(await readFile(path.join(projectDir, "package.json"), "utf8"));
  if (manifest.name !== "r3f-scroll-rig-showcase") {
    throw new Error(`unexpected project name: ${manifest.name}`);
  }
  if (manifest.dependencies?.["@14islands/r3f-scroll-rig"] !== SHOWCASE_DEPENDENCY_VERSION) {
    throw new Error("scroll-rig dependency must remain pinned to 8.15.0");
  }
}
```

- [ ] **Step 4: Copy only the finished demo’s reproducible source files**

Create `r3f-scroll-rig-showcase/`, then mechanically copy only these source-controlled inputs from `r3f-scroll-rig-research/examples/lighthouse-scroll-rig-demo/`:

```text
.gitignore
index.html
package.json
package-lock.json
vite.config.js
src/**
public/assets/routes/**
public/assets/scene/**
```

Do not copy `node_modules/`, `dist/`, local screenshots, `.git`, or the research repository’s docs. Change `package.json` name to `r3f-scroll-rig-showcase`, then refresh the lock-file root package name without changing dependency versions:

```powershell
cd r3f-scroll-rig-showcase
npm install --package-lock-only --ignore-scripts
```

- [ ] **Step 5: Run package validation and the full migrated demo tests**

Run:

```powershell
node --test tests/r3f-project-eight.test.mjs
cd r3f-scroll-rig-showcase
npm ci
npm test
npm run build
```

Expected:

- Root test: PASS.
- Vitest: 10 files and 63 tests pass.
- Vite: production build exits `0`; the existing chunk-size warning may remain.

- [ ] **Step 6: Verify tracked-path scope and commit**

Run:

```powershell
git ls-files --others --exclude-standard r3f-scroll-rig-showcase scripts/lib/r3f-project-eight.mjs tests/r3f-project-eight.test.mjs
```

Confirm the output contains only the explicit project package, validation module, and test. Then commit:

```powershell
git add r3f-scroll-rig-showcase scripts/lib/r3f-project-eight.mjs tests/r3f-project-eight.test.mjs
git commit -m "feat: add r3f project eight showcase"
```

---

### Task 2: Define the two-recording evidence contract

**Files:**
- Create: `scripts/lib/r3f-scroll-rig-recording.mjs`
- Create: `tests/r3f-scroll-rig-recording.test.mjs`

**Interfaces:**
- Consumes: `r3f-scroll-rig-showcase/`, the local historical source path supplied through `R3F_LEGACY_DIR`, and FFmpeg.
- Produces: `UPSTREAM_REPOSITORY`, `UPSTREAM_COMMIT`, `UPSTREAM_REPOSITORY_VERSION`, `RECORDINGS`, `CAPTURE_VIEWPORT`, `ORIGINAL_SCROLL_STOPS`, `SHOWCASE_SCROLL_STOPS`, `assertGifFile(filePath)`, and `assertLegacySource(options)`.

- [ ] **Step 1: Write failing recording-contract tests**

Create `tests/r3f-scroll-rig-recording.test.mjs`:

```js
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  CAPTURE_VIEWPORT,
  ORIGINAL_SCROLL_STOPS,
  RECORDINGS,
  SHOWCASE_SCROLL_STOPS,
  UPSTREAM_COMMIT,
  UPSTREAM_REPOSITORY_VERSION,
  assertGifFile,
} from "../scripts/lib/r3f-scroll-rig-recording.mjs";

test("recording contract pins source, outputs, viewport, and story stops", () => {
  assert.equal(UPSTREAM_COMMIT, "adf7d47ea5bf3d8e8cf957b0f3667bea752e5f63");
  assert.equal(UPSTREAM_REPOSITORY_VERSION, "7.0.7");
  assert.deepEqual(CAPTURE_VIEWPORT, { width: 960, height: 640 });
  assert.deepEqual(RECORDINGS.map(({ output }) => output), [
    "docs/demos/08-r3f-scroll-rig-original.gif",
    "docs/demos/08-r3f-scroll-rig-lighthouse.gif",
  ]);
  assert.deepEqual(ORIGINAL_SCROLL_STOPS, [0, 720, 1440, 2280]);
  assert.deepEqual(SHOWCASE_SCROLL_STOPS, [0, 1100, 2200, 3800]);
});

test("GIF validation rejects a non-GIF artifact", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "r3f-gif-test-"));
  try {
    const invalid = path.join(directory, "invalid.gif");
    await writeFile(invalid, "not a gif");
    await assert.rejects(() => assertGifFile(invalid), /GIF artifact is invalid/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the tests and verify the missing module failure**

Run:

```powershell
node --test tests/r3f-scroll-rig-recording.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the recording constants and validators**

Create `scripts/lib/r3f-scroll-rig-recording.mjs` with:

```js
import { readFile, stat } from "node:fs/promises";

export const UPSTREAM_REPOSITORY = "https://github.com/14islands/r3f-scroll-rig";
export const UPSTREAM_COMMIT = "adf7d47ea5bf3d8e8cf957b0f3667bea752e5f63";
export const UPSTREAM_REPOSITORY_VERSION = "7.0.7";
export const CAPTURE_VIEWPORT = { width: 960, height: 640 };
export const ORIGINAL_SCROLL_STOPS = [0, 720, 1440, 2280];
export const SHOWCASE_SCROLL_STOPS = [0, 1100, 2200, 3800];
export const RECORDINGS = [
  { id: "original", output: "docs/demos/08-r3f-scroll-rig-original.gif" },
  { id: "lighthouse", output: "docs/demos/08-r3f-scroll-rig-lighthouse.gif" },
];

export async function assertGifFile(filePath) {
  const [metadata, bytes] = await Promise.all([stat(filePath), readFile(filePath)]);
  const signature = bytes.subarray(0, 6).toString("ascii");
  if (
    metadata.size < 10_000 ||
    metadata.size > 8_000_000 ||
    (signature !== "GIF87a" && signature !== "GIF89a")
  ) {
    throw new Error(`GIF artifact is invalid: ${filePath}`);
  }
}
```

Also implement `assertLegacySource({ legacyDir, head, repositoryVersion, resolvedVersion })` so it throws unless:

- `head === UPSTREAM_COMMIT`;
- `repositoryVersion === "7.0.7"`;
- `resolvedVersion` is a non-empty semantic version read from the installed example tree.

- [ ] **Step 4: Run focused tests and commit**

Run:

```powershell
node --test tests/r3f-scroll-rig-recording.test.mjs
```

Expected: PASS.

Commit:

```powershell
git add scripts/lib/r3f-scroll-rig-recording.mjs tests/r3f-scroll-rig-recording.test.mjs
git commit -m "test: define r3f showcase evidence contract"
```

---

### Task 3: Record the real upstream and lighthouse effects

**Files:**
- Modify: `r3f-scroll-rig-showcase/package.json`
- Modify: `r3f-scroll-rig-showcase/package-lock.json`
- Modify: `scripts/lib/r3f-scroll-rig-recording.mjs`
- Create: `scripts/record-r3f-scroll-rig-demos.mjs`
- Create: `docs/demos/08-r3f-scroll-rig-original.gif`
- Create: `docs/demos/08-r3f-scroll-rig-lighthouse.gif`

**Interfaces:**
- Consumes: the Task 2 recording manifest, `R3F_LEGACY_DIR`, the historical example’s installed package tree, `r3f-scroll-rig-showcase/`, Playwright Chromium, and FFmpeg.
- Produces: `recordR3fScrollRigDemos({ rootDir, legacyDir }): Promise<string[]>` and two committed GIF artifacts.

- [ ] **Step 1: Extend the tests with the required source-check contract**

Add to `tests/r3f-scroll-rig-recording.test.mjs`:

```js
import { assertLegacySource } from "../scripts/lib/r3f-scroll-rig-recording.mjs";

test("legacy source validation rejects the wrong commit or an unknown installed version", () => {
  assert.throws(
    () =>
      assertLegacySource({
        legacyDir: "legacy",
        head: "wrong",
        repositoryVersion: "7.0.7",
        resolvedVersion: "6.0.5",
      }),
    /legacy source mismatch/,
  );
  assert.throws(
    () =>
      assertLegacySource({
        legacyDir: "legacy",
        head: UPSTREAM_COMMIT,
        repositoryVersion: "7.0.7",
        resolvedVersion: "",
      }),
    /resolved package version/,
  );
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
node --test tests/r3f-scroll-rig-recording.test.mjs
```

Expected: FAIL until `assertLegacySource` implements both checks.

- [ ] **Step 3: Add reproducible browser-capture tooling**

Add exact dev dependency `playwright@1.62.0` to `r3f-scroll-rig-showcase/package.json` and refresh the lock file:

```powershell
cd r3f-scroll-rig-showcase
npm install --save-dev --save-exact playwright@1.62.0
```

In `scripts/lib/r3f-scroll-rig-recording.mjs`:

- resolve `legacyDir` from the explicit function argument, then `R3F_LEGACY_DIR`, then the sibling default `r3f-scroll-rig-legacy-demo`;
- read the legacy Git HEAD with `git rev-parse HEAD`;
- read repository version from `legacyDir/package.json`;
- read the actual installed version from `legacyDir/examples/node_modules/@14islands/r3f-scroll-rig/package.json`;
- start the historical example on `127.0.0.1:5223`;
- start the showcase on `127.0.0.1:5224`;
- launch Chromium from `r3f-scroll-rig-showcase/node_modules/playwright`;
- capture four frames at each declared scroll stop;
- convert each frame directory to a looping 960-pixel-wide GIF at 5 fps;
- close Chromium, stop both servers, and remove only the generated temporary frame directory in `finally`.

The page checks must be concrete:

```js
await originalPage.getByText(
  "A ScrollScene with a Cube mesh inside using global lights.",
  { exact: true },
).waitFor();

await lighthousePage.getByRole("heading", { name: "雾屿灯塔", exact: true }).waitFor();
await lighthousePage.getByRole("button", { name: "稳定构图", exact: true }).waitFor();
```

Create `scripts/record-r3f-scroll-rig-demos.mjs`:

```js
import { recordR3fScrollRigDemos } from "./lib/r3f-scroll-rig-recording.mjs";

recordR3fScrollRigDemos()
  .then((files) => console.log(`Recorded r3f-scroll-rig GIFs:\n${files.join("\n")}`))
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
```

- [ ] **Step 4: Verify the historical source before recording**

Run:

```powershell
git -C r3f-scroll-rig-legacy-demo rev-parse HEAD
node -p "require('./r3f-scroll-rig-legacy-demo/package.json').version"
node -p "require('./r3f-scroll-rig-legacy-demo/examples/node_modules/@14islands/r3f-scroll-rig/package.json').version"
```

Expected:

- HEAD equals `adf7d47ea5bf3d8e8cf957b0f3667bea752e5f63`.
- Repository version equals `7.0.7`.
- Installed example version is a concrete semantic version and is recorded for Task 4 copy.

- [ ] **Step 5: Generate and validate both GIFs**

Run:

```powershell
$env:R3F_LEGACY_DIR = (Resolve-Path .\r3f-scroll-rig-legacy-demo).Path
node scripts/record-r3f-scroll-rig-demos.mjs
node --test tests/r3f-scroll-rig-recording.test.mjs
```

Expected:

- Both GIF paths are printed.
- Both files have a valid GIF signature and remain between 10 KB and 8 MB.
- Temporary frame directories and child servers are removed.

- [ ] **Step 6: Inspect the two final GIFs and commit**

Open both GIFs and verify:

- Original: at least one inline 3D/WebGL object, one sticky section, and one parallax/image section remain recognizable.
- Lighthouse: establish, approach, signal, and route/archive phases remain recognizable; default mode is `稳定构图`.
- Neither recording contains an error overlay, blank Canvas, clipped browser chrome, or debug controls.

Commit:

```powershell
git add r3f-scroll-rig-showcase/package.json r3f-scroll-rig-showcase/package-lock.json scripts/lib/r3f-scroll-rig-recording.mjs scripts/record-r3f-scroll-rig-demos.mjs tests/r3f-scroll-rig-recording.test.mjs docs/demos/08-r3f-scroll-rig-original.gif docs/demos/08-r3f-scroll-rig-lighthouse.gif
git commit -m "docs: record r3f project eight evidence"
```

---

### Task 4: Register project 08 and move Finesse to project 09

**Files:**
- Modify: `README.md`
- Create: `r3f-scroll-rig-showcase/README.md`
- Create: `scripts/check-r3f-project-eight.mjs`
- Modify: `tests/r3f-project-eight.test.mjs`

**Interfaces:**
- Consumes: Task 1’s standalone package, Task 2’s source constants, Task 3’s resolved historical-example version and two GIF paths.
- Produces: project numbering, root documentation, project documentation, and `node scripts/check-r3f-project-eight.mjs` as the delivery audit command.

- [ ] **Step 1: Add failing README and artifact assertions**

Extend `tests/r3f-project-eight.test.mjs`:

```js
import { access, readFile } from "node:fs/promises";

test("root README registers r3f as 08 and Finesse as 09", async () => {
  const readme = await readFile(path.join(rootDir, "README.md"), "utf8");
  for (const required of [
    "| 08 | [r3f-scroll-rig：原库样例与灯塔应用验证](./r3f-scroll-rig-showcase/)",
    "## 08 · r3f-scroll-rig：原库样例与灯塔应用验证",
    "| 09 | [Finesse Skill 产品研究](./finesse-skill-product-research/)",
    "## 09 · Finesse Skill 产品研究",
    "./docs/demos/08-r3f-scroll-rig-original.gif",
    "./docs/demos/08-r3f-scroll-rig-lighthouse.gif",
    "原库样例回答“这个封装库能做什么”",
    "灯塔样例回答“我们如何把它用于一个真实的滚动视觉场景”",
  ]) {
    assert.ok(readme.includes(required), `README.md missing: ${required}`);
  }
});

test("project 08 documentation and both GIF artifacts exist", async () => {
  await access(path.join(rootDir, "r3f-scroll-rig-showcase", "README.md"));
  await access(path.join(rootDir, "docs", "demos", "08-r3f-scroll-rig-original.gif"));
  await access(path.join(rootDir, "docs", "demos", "08-r3f-scroll-rig-lighthouse.gif"));
});
```

- [ ] **Step 2: Run the focused test and verify the documentation failure**

Run:

```powershell
node --test tests/r3f-project-eight.test.mjs
```

Expected: FAIL because the root README has not yet been renumbered and the project README does not exist.

- [ ] **Step 3: Update the root README without introducing a new UI**

Modify `README.md` in four places:

1. Directory table:
   - add project 08 with link `./r3f-scroll-rig-showcase/`;
   - change Finesse to project 09.
2. Insert `## 08 · r3f-scroll-rig：原库样例与灯塔应用验证` before Finesse.
3. Change the Finesse heading to `## 09 · Finesse Skill 产品研究`.
4. Add project 08 run/test/build commands and related-document links.

The project 08 section must contain:

- the original GIF;
- the lighthouse GIF;
- upstream URL, commit `adf7d47…`, repository metadata version `7.0.7`, and the installed historical-example version measured in Task 3;
- ISC license and no-official-affiliation wording;
- the lighthouse dependency `8.15.0`;
- the exact conclusion contrasting “库能做什么” with “我们如何用上它”;
- the 2.5D/non-image-to-3D boundary.

- [ ] **Step 4: Write the project README**

Create `r3f-scroll-rig-showcase/README.md` with these sections:

```markdown
# r3f-scroll-rig 原库样例与《雾屿灯塔》应用验证

## 两个方向分别证明什么
## 本地运行
## 稳定构图与原始漂移对照
## 自动测试与生产构建
## 上游来源、版本与许可
## 能力边界与已知风险
```

Use commands:

```powershell
npm ci
npm run dev
npm test
npm run build
```

Document these comparison routes:

```text
http://127.0.0.1:4174/
http://127.0.0.1:4174/?composition=legacy
http://127.0.0.1:4174/?fallback=1
http://127.0.0.1:4174/?reduced=1
```

- [ ] **Step 5: Add the project audit command**

Create `scripts/check-r3f-project-eight.mjs` that:

- reads root and project README files;
- calls `validateShowcase(rootDir)`;
- calls `assertGifFile` for both recording outputs;
- runs `git ls-files`;
- calls `assertNoTrackedResearchTrees`;
- prints all failures with `FAIL:` and exits non-zero, or prints `r3f-scroll-rig project-eight documentation and media check passed.`.

Core structure:

```js
const failures = [];
try {
  await validateShowcase(rootDir);
} catch (error) {
  failures.push(error.message);
}
for (const { output } of RECORDINGS) {
  try {
    await assertGifFile(path.join(rootDir, output));
  } catch (error) {
    failures.push(error.message);
  }
}
if (failures.length) {
  failures.forEach((failure) => console.error(`FAIL: ${failure}`));
  process.exitCode = 1;
} else {
  console.log("r3f-scroll-rig project-eight documentation and media check passed.");
}
```

- [ ] **Step 6: Run documentation tests and commit**

Run:

```powershell
node --test tests/r3f-project-eight.test.mjs tests/r3f-scroll-rig-recording.test.mjs
node scripts/check-r3f-project-eight.mjs
```

Expected: all tests pass and the audit prints its success line.

Commit:

```powershell
git add README.md r3f-scroll-rig-showcase/README.md scripts/check-r3f-project-eight.mjs tests/r3f-project-eight.test.mjs
git commit -m "docs: register r3f scroll rig as project eight"
```

---

### Task 5: Verify the final project and root-repository boundary

**Files:**
- Modify only if evidence is inaccurate: `README.md`
- Modify only if evidence is inaccurate: `r3f-scroll-rig-showcase/README.md`
- Modify only if a check is incomplete: `scripts/check-r3f-project-eight.mjs`

**Interfaces:**
- Consumes: every earlier task’s package, tests, documentation, and GIF artifacts.
- Produces: final browser, build, documentation, and Git-scope evidence.

- [ ] **Step 1: Run the complete root project-08 audit**

Run:

```powershell
node --test tests/r3f-project-eight.test.mjs tests/r3f-scroll-rig-recording.test.mjs
node scripts/check-r3f-project-eight.mjs
```

Expected: all tests pass; no missing link, media, source pin, or forbidden tracked path.

- [ ] **Step 2: Run the complete standalone showcase verification**

Run:

```powershell
cd r3f-scroll-rig-showcase
npm ci
npm test
npm run build
```

Expected: 10 test files and 63 tests pass; production build exits `0`.

- [ ] **Step 3: Verify the canonical runtime in a fresh browser**

Start:

```powershell
cd r3f-scroll-rig-showcase
npm run dev
```

At `http://127.0.0.1:4174/`, verify:

- one Canvas and `webgl-ready`;
- default `data-composition-mode="locked"`;
- `稳定构图` is pressed and `原始漂移` is not pressed;
- four route cards remain present;
- horizontal overflow is `0`;
- fresh console contains no new warning or error.

Then click `原始漂移` and verify the URL becomes `?composition=legacy` without resetting scroll position. Check `?fallback=1` and `?reduced=1` retain readable content and controls.

- [ ] **Step 4: Audit numbering, links, artifacts, and Git scope**

Run:

```powershell
rg -n "^\| 08 \||^\| 09 \||^## 08 ·|^## 09 ·" README.md
rg -n "08-r3f-scroll-rig-original.gif|08-r3f-scroll-rig-lighthouse.gif|adf7d47|8.15.0|ISC" README.md r3f-scroll-rig-showcase/README.md
git ls-files | rg "r3f-scroll-rig-research|r3f-scroll-rig-legacy-demo|node_modules|(^|/)dist/|(^|/)\.git/"
git diff --check
git status --short
```

Expected:

- exactly one project 08 row/heading and one project 09 row/heading;
- both GIF paths and both version/source boundaries are documented;
- the forbidden-path search returns no tracked result;
- `git diff --check` is clean;
- only intentionally modified delivery files appear before the final commit.

- [ ] **Step 5: Correct only evidence mismatches**

If any README claim differs from the observed runtime, installed historical-example version, GIF content, test count, build result, or dependency audit, edit that claim to match the evidence. Do not change the application to make an inaccurate sentence true.

- [ ] **Step 6: Run fresh verification and commit any evidence correction**

Repeat Steps 1–4. If Task 5 required changes:

```powershell
git add README.md r3f-scroll-rig-showcase/README.md scripts/check-r3f-project-eight.mjs
git commit -m "docs: verify r3f project eight delivery"
```

If no files changed, do not create an empty commit.
