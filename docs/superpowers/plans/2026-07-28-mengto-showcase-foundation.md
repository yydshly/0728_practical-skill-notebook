# MengTo Skills Showcase Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the isolated showcase workspace, pin the upstream `MengTo/Skills` repository, install and document the approved skills, and establish tested shared packages for the three products.

**Architecture:** The new `mengto-skills-showcase` directory is an npm workspace containing independent applications and focused shared packages. The upstream Skills repository is pinned as a read-only git submodule, while selected skills are installed separately into Codex's global skill directory and recorded from one machine-readable manifest.

**Tech Stack:** Node.js 22+, npm workspaces, Vite 8, TypeScript, Three.js, Vitest 4, Playwright 1.62, PowerShell, git submodules.

## 中文执行摘要

本计划先在当前工作区创建 `mengto-skills-showcase` 独立目录，然后把 `MengTo/Skills` 作为只读子模块固定到项目中；再把批准的 16 个游戏开发 Skill 安装到 Codex 全局目录。项目会用一份机器可读清单记录每个 Skill 的来源、影响产品和使用阶段，并在中文 README 与安装文档中解释安装位置、全局影响、更新、校验和安全移除方法。最后建立三款产品共同使用的类型、资产、输入、UI 和 Three.js 生命周期基础包。

面向用户的 README、安装说明、验证报告和交付说明以中文为主。代码名称、目录、命令、包名和上游 `SKILL.md` 保留英文原文。

项目所有者优先阅读：[中文实施指南](./2026-07-28-mengto-showcase-中文实施指南.md)。

## Global Constraints

- Create all new suite files under `D:\codex_project_work\0728_some_github\mengto-skills-showcase`.
- Keep the upstream repository at `mengto-skills-showcase/skills-source/MengTo-Skills` and never edit it in place.
- Install selected skills under `C:\Users\yun68\.codex\skills\<skill-name>`.
- Treat skills as development instructions only; no production bundle may depend on the global Codex directory or the pinned skill source.
- Keep Monster Forge, Ashfall Arena, and Mech Atelier independently buildable and deployable.
- Use TypeScript for new application and shared-package source.
- Use Vitest for deterministic unit tests and Playwright for browser journeys.
- Record every installed skill, its upstream path, its intended products, and its development impact in the root README and `docs/skill-installation.md`.
- Write human-facing project documentation in Chinese first; retain English for executable identifiers, commands, paths, package names, and unchanged upstream skill files.
- Preserve unrelated files and commits in the parent repository.

---

## File Map

```text
mengto-skills-showcase/
├── .gitignore                         # Generated output and local cache exclusions
├── AGENTS.md                          # Directory-to-skill routing rules
├── README.md                          # User-facing setup, products, skill effects, and commands
├── package.json                       # npm workspaces and suite-wide commands
├── tsconfig.base.json                 # Shared strict TypeScript settings
├── config/
│   ├── selected-skills.json           # Source of truth for installed skills and impacts
│   └── skill-source-lock.json         # Recorded upstream URL, branch, and exact commit
├── docs/
│   └── skill-installation.md          # Detailed install, update, divergence, and removal guide
├── scripts/
│   ├── check-selected-skills.mjs      # Read-only global installation audit
│   ├── install-selected-skills.ps1    # Wrapper around the Codex skill installer
│   ├── record-skill-source.mjs        # Records the actual pinned submodule revision
│   └── validate-workspace.mjs         # Workspace, docs, lock, and skill-manifest validation
├── tests/
│   └── workspace-contract.test.mjs    # Foundation contract tests
├── apps/
│   ├── monster-forge/package.json
│   ├── ashfall-arena/package.json
│   └── mech-atelier/package.json
├── packages/
│   ├── content-schema/
│   │   ├── package.json
│   │   ├── src/index.ts
│   │   └── tests/asset-schema.test.ts
│   ├── game-assets/
│   │   ├── package.json
│   │   ├── src/index.ts
│   │   └── tests/registry.test.ts
│   ├── input-system/
│   │   ├── package.json
│   │   ├── src/index.ts
│   │   └── tests/input.test.ts
│   ├── three-runtime/
│   │   ├── package.json
│   │   ├── src/index.ts
│   │   └── tests/disposable-scope.test.ts
│   └── ui-system/
│       ├── package.json
│       ├── src/index.ts
│       └── src/tokens.css
└── skills-source/
    └── MengTo-Skills/                  # Git submodule
```

### Task 1: Create the workspace contract

**Files:**
- Create: `mengto-skills-showcase/package.json`
- Create: `mengto-skills-showcase/tsconfig.base.json`
- Create: `mengto-skills-showcase/.gitignore`
- Create: `mengto-skills-showcase/tests/workspace-contract.test.mjs`
- Create: `mengto-skills-showcase/scripts/validate-workspace.mjs`
- Create: `mengto-skills-showcase/apps/monster-forge/package.json`
- Create: `mengto-skills-showcase/apps/ashfall-arena/package.json`
- Create: `mengto-skills-showcase/apps/mech-atelier/package.json`

**Interfaces:**
- Produces: npm workspace names `@showcase/monster-forge`, `@showcase/ashfall-arena`, and `@showcase/mech-atelier`.
- Produces: suite commands `npm run validate`, `npm test`, `npm run build`, and app-specific `dev:*` commands.
- Consumes: no earlier task.

- [ ] **Step 1: Write the failing workspace contract test**

```js
// tests/workspace-contract.test.mjs
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));

describe("showcase workspace", () => {
  it("declares three independent apps and five shared package workspaces", async () => {
    const manifest = await readJson("../package.json");
    expect(manifest.workspaces).toEqual(["apps/*", "packages/*"]);
    expect(manifest.scripts).toMatchObject({
      validate: "node scripts/validate-workspace.mjs",
      test: "vitest run",
      build: "npm run build --workspaces --if-present",
    });
  });

  it.each([
    ["monster-forge", "@showcase/monster-forge"],
    ["ashfall-arena", "@showcase/ashfall-arena"],
    ["mech-atelier", "@showcase/mech-atelier"],
  ])("keeps %s independently addressable", async (folder, name) => {
    const manifest = await readJson(`../apps/${folder}/package.json`);
    expect(manifest.name).toBe(name);
    expect(manifest.private).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test and verify the workspace does not exist**

Run from `mengto-skills-showcase` after creating only the test file:

```powershell
npx vitest run tests/workspace-contract.test.mjs
```

Expected: FAIL because `package.json` and app manifests do not exist.

- [ ] **Step 3: Add the root manifest and TypeScript contract**

```json
{
  "name": "mengto-skills-showcase",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev:forge": "npm run dev --workspace @showcase/monster-forge",
    "dev:arena": "npm run dev --workspace @showcase/ashfall-arena",
    "dev:atelier": "npm run dev --workspace @showcase/mech-atelier",
    "validate": "node scripts/validate-workspace.mjs",
    "test": "vitest run",
    "test:browser": "playwright test",
    "build": "npm run build --workspaces --if-present"
  },
  "devDependencies": {
    "@playwright/test": "^1.62.0",
    "typescript": "^5.9.0",
    "vite": "^8.1.5",
    "vitest": "^4.1.10"
  }
}
```

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "useDefineForClassFields": true,
    "skipLibCheck": true
  }
}
```

Each initial app manifest contains its approved workspace name, `private: true`, `type: "module"`, and empty `scripts` object. Later product plans replace the empty scripts with working Vite commands.

- [ ] **Step 4: Add the validator and ignore rules**

```js
// scripts/validate-workspace.mjs
import { access, readFile } from "node:fs/promises";

const required = [
  "README.md",
  "AGENTS.md",
  "config/selected-skills.json",
  "config/skill-source-lock.json",
  "docs/skill-installation.md",
];

const failures = [];
for (const path of required) {
  try {
    await access(path);
  } catch {
    failures.push(`Missing required file: ${path}`);
  }
}

if (failures.length === 0) {
  const selection = JSON.parse(await readFile("config/selected-skills.json", "utf8"));
  if (!Array.isArray(selection.skills) || selection.skills.length !== 16) {
    failures.push("config/selected-skills.json must contain exactly 16 approved skills");
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Workspace contract valid.");
}
```

`.gitignore` must include `node_modules/`, `dist/`, `coverage/`, `playwright-report/`, `test-results/`, and local `.env*` files while retaining `.env.example`.

- [ ] **Step 5: Install the foundation dependencies and run the focused test**

```powershell
npm install
npm exec vitest run tests/workspace-contract.test.mjs
```

Expected: PASS for both workspace assertions.

- [ ] **Step 6: Commit the workspace contract**

```powershell
git add mengto-skills-showcase/.gitignore mengto-skills-showcase/package.json mengto-skills-showcase/package-lock.json mengto-skills-showcase/tsconfig.base.json mengto-skills-showcase/apps mengto-skills-showcase/scripts/validate-workspace.mjs mengto-skills-showcase/tests/workspace-contract.test.mjs
git commit -m "chore: scaffold skills showcase workspace"
```

### Task 2: Pin the upstream Skills repository and define the selected-skill manifest

**Files:**
- Create: `.gitmodules`
- Create: `mengto-skills-showcase/skills-source/MengTo-Skills` as a git submodule
- Create: `mengto-skills-showcase/config/selected-skills.json`
- Create: `mengto-skills-showcase/config/skill-source-lock.json`
- Create: `mengto-skills-showcase/scripts/record-skill-source.mjs`
- Modify: `mengto-skills-showcase/tests/workspace-contract.test.mjs`

**Interfaces:**
- Produces: `selected-skills.json` entries with `{name, sourcePath, products, phases}`.
- Produces: `skill-source-lock.json` with `{repository, branch, commit, recordedAt}`.
- Consumes: the workspace created in Task 1.

- [ ] **Step 1: Extend the test with the selection and lock contracts**

```js
it("records exactly the approved skills with unique names and source paths", async () => {
  const selection = await readJson("../config/selected-skills.json");
  expect(selection.skills).toHaveLength(16);
  expect(new Set(selection.skills.map((skill) => skill.name)).size).toBe(16);
  for (const skill of selection.skills) {
    expect(skill.sourcePath).toBe(`agent-skills/game-development/${skill.name}`);
    expect(skill.products.length).toBeGreaterThan(0);
    expect(skill.phases.length).toBeGreaterThan(0);
  }
});

it("pins the upstream repository to a full commit SHA", async () => {
  const lock = await readJson("../config/skill-source-lock.json");
  expect(lock.repository).toBe("https://github.com/MengTo/Skills.git");
  expect(lock.branch).toBe("main");
  expect(lock.commit).toMatch(/^[0-9a-f]{40}$/);
});
```

- [ ] **Step 2: Run the test and confirm the manifest is missing**

```powershell
npm exec vitest run tests/workspace-contract.test.mjs
```

Expected: FAIL because both config files are missing.

- [ ] **Step 3: Add the upstream repository as a pinned submodule**

Run from the parent repository root:

```powershell
git submodule add https://github.com/MengTo/Skills.git mengto-skills-showcase/skills-source/MengTo-Skills
git -C mengto-skills-showcase/skills-source/MengTo-Skills switch main
```

Do not modify files inside the submodule. Record the exact checked-out SHA in the next step.

- [ ] **Step 4: Add the selected-skill manifest**

`config/selected-skills.json` must contain one object for each of these names:

```json
[
  "build-isometric-arpg",
  "author-game-levels",
  "build-game-camera-controls",
  "design-action-combat",
  "build-threejs-enemy-systems",
  "build-game-monster-system",
  "tune-enemy-ai",
  "build-game-inventory",
  "build-hybrid-game-assets",
  "build-vesperfall-review-assets",
  "create-game-vfx",
  "build-game-audio-feedback",
  "build-mobile-threejs-games",
  "optimize-threejs-games",
  "test-playable-web-games",
  "ship-web-games"
]
```

For every entry, set `sourcePath` to `agent-skills/game-development/<name>`, list one or more of `monster-forge`, `ashfall-arena`, `mech-atelier`, and use phases from `assets`, `foundation`, `combat`, `feedback`, `mobile`, `performance`, `validation`, or `release`.

- [ ] **Step 5: Add and run the lock recorder**

```js
// scripts/record-skill-source.mjs
import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";

const cwd = "skills-source/MengTo-Skills";
const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd, encoding: "utf8" }).trim();
const branch = execFileSync("git", ["branch", "--show-current"], { cwd, encoding: "utf8" }).trim();
const lock = {
  repository: "https://github.com/MengTo/Skills.git",
  branch,
  commit,
  recordedAt: new Date().toISOString(),
};

await writeFile("config/skill-source-lock.json", `${JSON.stringify(lock, null, 2)}\n`, "utf8");
console.log(`Recorded MengTo/Skills ${commit}`);
```

Run:

```powershell
node scripts/record-skill-source.mjs
npm exec vitest run tests/workspace-contract.test.mjs
```

Expected: PASS and the lock contains the actual 40-character submodule commit.

- [ ] **Step 6: Commit the pinned source and selection**

```powershell
git add .gitmodules mengto-skills-showcase/skills-source/MengTo-Skills mengto-skills-showcase/config mengto-skills-showcase/scripts/record-skill-source.mjs mengto-skills-showcase/tests/workspace-contract.test.mjs
git commit -m "chore: pin MengTo skills source"
```

### Task 3: Install, audit, and document the selected Codex skills

**Files:**
- Create: `mengto-skills-showcase/scripts/install-selected-skills.ps1`
- Create: `mengto-skills-showcase/scripts/check-selected-skills.mjs`
- Create: `mengto-skills-showcase/docs/skill-installation.md`
- Modify: `mengto-skills-showcase/scripts/validate-workspace.mjs`
- Modify: `mengto-skills-showcase/tests/workspace-contract.test.mjs`

**Interfaces:**
- Consumes: `config/selected-skills.json` from Task 2.
- Produces: read-only audit output with `{name, installed, installPath}` per selected skill.
- Produces: global directories at `C:\Users\yun68\.codex\skills\<skill-name>`.

- [ ] **Step 1: Write tests for installation-document coverage**

```js
it("documents every selected skill and the global install impact", async () => {
  const selection = await readJson("../config/selected-skills.json");
  const guide = await readFile(new URL("../docs/skill-installation.md", import.meta.url), "utf8");
  for (const skill of selection.skills) {
    expect(guide).toContain(`\`${skill.name}\``);
  }
  expect(guide).toContain("C:\\Users\\yun68\\.codex\\skills");
  expect(guide).toContain("开发操作规程");
  expect(guide).toContain("不是运行时依赖");
  expect(guide).toContain("所有 Codex 项目");
});
```

- [ ] **Step 2: Run the focused test and confirm the guide is missing**

```powershell
npm exec vitest run tests/workspace-contract.test.mjs
```

Expected: FAIL because `docs/skill-installation.md` does not exist.

- [ ] **Step 3: Add the read-only installation audit**

```js
// scripts/check-selected-skills.mjs
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

const selection = JSON.parse(await readFile("config/selected-skills.json", "utf8"));
const installRoot = join(process.env.USERPROFILE, ".codex", "skills");
const results = [];

for (const skill of selection.skills) {
  const installPath = join(installRoot, skill.name);
  let installed = true;
  try {
    await access(join(installPath, "SKILL.md"));
  } catch {
    installed = false;
  }
  results.push({ name: skill.name, installed, installPath });
}

console.table(results);
if (results.some((result) => !result.installed)) process.exitCode = 1;
```

- [ ] **Step 4: Add the installer wrapper**

`scripts/install-selected-skills.ps1` must:

1. Resolve `C:\Users\yun68\.codex\skills` from `$env:USERPROFILE`.
2. Read `config/selected-skills.json`.
3. Skip entries that already contain `SKILL.md` and report them without overwriting.
4. Pass only missing source paths to the bundled `install-skill-from-github.py`.
5. Use `--repo MengTo/Skills --ref main`.
6. Run `node scripts/check-selected-skills.mjs` after installation.
7. Exit non-zero if the bundled installer is unavailable or any selected skill remains missing.

Use the installed system helper at:

```text
C:\Users\yun68\.codex\skills\.system\skill-installer\scripts\install-skill-from-github.py
```

The wrapper must not delete or overwrite an existing skill directory.

- [ ] **Step 5: Install the missing skills**

Run from `mengto-skills-showcase`:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-selected-skills.ps1
node scripts/check-selected-skills.mjs
```

Expected: all 16 rows report `installed: true`. Newly installed skills become available to Codex on the next turn.

- [ ] **Step 6: Write the detailed installation guide**

`docs/skill-installation.md` must include:

- the pinned source location and current lock-file fields;
- the global installation root;
- a 16-row table generated from `selected-skills.json`;
- one sentence per skill explaining its product and development-phase impact;
- the install and read-only check commands;
- an update procedure that first updates the submodule intentionally, records the new SHA, reviews upstream diffs, and then replaces only explicitly approved global copies;
- a safe removal procedure that first moves an exact skill directory outside `.codex\skills` for recovery, verifies Codex behavior on the next turn, and deletes the backup only after user approval;
- the warning that global installation affects discovery in all Codex projects;
- the warning that local source updates and global installed copies do not synchronize automatically;
- the statement that skills are development instructions and not runtime dependencies.

- [ ] **Step 7: Run the documentation and installation checks**

```powershell
npm exec vitest run tests/workspace-contract.test.mjs
node scripts/check-selected-skills.mjs
node scripts/validate-workspace.mjs
```

Expected: all commands PASS.

- [ ] **Step 8: Commit the installation tooling and evidence**

```powershell
git add mengto-skills-showcase/scripts/install-selected-skills.ps1 mengto-skills-showcase/scripts/check-selected-skills.mjs mengto-skills-showcase/scripts/validate-workspace.mjs mengto-skills-showcase/docs/skill-installation.md mengto-skills-showcase/tests/workspace-contract.test.mjs
git commit -m "docs: record selected Codex skills"
```

### Task 4: Establish the shared content, input, asset, UI, and lifecycle contracts

**Files:**
- Create: `mengto-skills-showcase/packages/content-schema/package.json`
- Create: `mengto-skills-showcase/packages/content-schema/src/index.ts`
- Create: `mengto-skills-showcase/packages/content-schema/tests/asset-schema.test.ts`
- Create: `mengto-skills-showcase/packages/game-assets/package.json`
- Create: `mengto-skills-showcase/packages/game-assets/src/index.ts`
- Create: `mengto-skills-showcase/packages/game-assets/tests/registry.test.ts`
- Create: `mengto-skills-showcase/packages/input-system/package.json`
- Create: `mengto-skills-showcase/packages/input-system/src/index.ts`
- Create: `mengto-skills-showcase/packages/input-system/tests/input.test.ts`
- Create: `mengto-skills-showcase/packages/three-runtime/package.json`
- Create: `mengto-skills-showcase/packages/three-runtime/src/index.ts`
- Create: `mengto-skills-showcase/packages/three-runtime/tests/disposable-scope.test.ts`
- Create: `mengto-skills-showcase/packages/ui-system/package.json`
- Create: `mengto-skills-showcase/packages/ui-system/src/index.ts`
- Create: `mengto-skills-showcase/packages/ui-system/src/tokens.css`

**Interfaces:**
- Produces: `AssetManifest`, `AnimationClipRef`, `SocketRef`, and `MeasuredBounds`.
- Produces: `AssetRegistry.get(id)` and `AssetRegistry.list(kind)`.
- Produces: `normalizeInput(snapshot): PlayerIntent`.
- Produces: `DisposableScope.track(resource)` and `DisposableScope.dispose()`.
- Consumes: foundation TypeScript and workspace contracts.

- [ ] **Step 1: Write failing tests for the shared public interfaces**

```ts
// content-schema/tests/asset-schema.test.ts
import { describe, expect, it } from "vitest";
import { parseAssetManifest } from "../src/index";

describe("parseAssetManifest", () => {
  it("rejects an asset without truthful provenance", () => {
    expect(() => parseAssetManifest({
      id: "ash-warden",
      kind: "monster",
      displayName: "Ash Warden",
      previewPath: "/assets/ash-warden.webp",
      source: { type: "procedural" },
      animations: [],
      sockets: [],
      bounds: { width: 1, height: 2, depth: 1, groundOffset: 0 },
    })).toThrow("source.description");
  });
});
```

```ts
// input-system/tests/input.test.ts
import { expect, it } from "vitest";
import { normalizeInput } from "../src/index";

it("clamps movement while preserving action edges", () => {
  expect(normalizeInput({
    moveX: 2,
    moveY: -2,
    attackPressed: true,
    guardHeld: false,
    dodgePressed: false,
    lockPressed: false,
  })).toMatchObject({ moveX: 1, moveY: -1, attackPressed: true });
});
```

```ts
// three-runtime/tests/disposable-scope.test.ts
import { expect, it, vi } from "vitest";
import { DisposableScope } from "../src/index";

it("disposes every tracked resource exactly once", () => {
  const dispose = vi.fn();
  const scope = new DisposableScope();
  scope.track({ dispose });
  scope.dispose();
  scope.dispose();
  expect(dispose).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run the package tests and confirm missing implementations**

```powershell
npm test --workspace @showcase/content-schema
npm test --workspace @showcase/input-system
npm test --workspace @showcase/three-runtime
```

Expected: FAIL because package manifests and source modules do not exist.

- [ ] **Step 3: Implement the content schema**

```ts
export type AssetKind = "monster" | "character" | "weapon" | "mech" | "module";
export type SourceType = "imported" | "procedural" | "reconstruction";

export interface AssetManifest {
  id: string;
  kind: AssetKind;
  displayName: string;
  previewPath: string;
  modelPath?: string;
  source: { type: SourceType; description: string; license?: string };
  animations: Array<{ name: string; durationSeconds: number }>;
  sockets: Array<{ name: string; bone: string }>;
  bounds: { width: number; height: number; depth: number; groundOffset: number };
}

export function parseAssetManifest(value: unknown): AssetManifest {
  if (!value || typeof value !== "object") throw new Error("asset manifest");
  const asset = value as Partial<AssetManifest>;
  if (!asset.id) throw new Error("id");
  if (!asset.source?.description) throw new Error("source.description");
  if (!asset.previewPath) throw new Error("previewPath");
  return asset as AssetManifest;
}
```

- [ ] **Step 4: Implement the registry, input normalizer, and disposable scope**

```ts
// game-assets/src/index.ts
import type { AssetKind, AssetManifest } from "@showcase/content-schema";

export class AssetRegistry {
  constructor(private readonly assets: readonly AssetManifest[]) {}
  get(id: string): AssetManifest {
    const asset = this.assets.find((item) => item.id === id);
    if (!asset) throw new Error(`Unknown asset: ${id}`);
    return asset;
  }
  list(kind: AssetKind): AssetManifest[] {
    return this.assets.filter((asset) => asset.kind === kind);
  }
}
```

```ts
// input-system/src/index.ts
export interface InputSnapshot {
  moveX: number;
  moveY: number;
  attackPressed: boolean;
  guardHeld: boolean;
  dodgePressed: boolean;
  lockPressed: boolean;
}
export type PlayerIntent = InputSnapshot;
const clamp = (value: number) => Math.max(-1, Math.min(1, value));
export const normalizeInput = (input: InputSnapshot): PlayerIntent => ({
  ...input,
  moveX: clamp(input.moveX),
  moveY: clamp(input.moveY),
});
```

```ts
// three-runtime/src/index.ts
export interface Disposable { dispose(): void }
export class DisposableScope {
  private disposed = false;
  private readonly resources = new Set<Disposable>();
  track<T extends Disposable>(resource: T): T {
    if (this.disposed) throw new Error("DisposableScope is already disposed");
    this.resources.add(resource);
    return resource;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const resource of this.resources) resource.dispose();
    this.resources.clear();
  }
}
```

The UI package exports token names from `src/index.ts` and defines color, type, spacing, focus, and motion variables in `tokens.css`; it must not contain product-specific screens.

- [ ] **Step 5: Add focused package manifests and run all shared tests**

Each package manifest must:

- use its approved `@showcase/<package>` name;
- expose `src/index.ts`;
- include `test: "vitest run"`;
- declare only direct workspace dependencies;
- declare Three.js only in packages that construct or render 3D resources: `game-assets`, `three-runtime`, and product applications.

Run:

```powershell
npm install three --workspace @showcase/game-assets --workspace @showcase/three-runtime
npm test --workspaces --if-present
```

Expected: all shared-package tests PASS.

- [ ] **Step 6: Commit the shared contracts**

```powershell
git add mengto-skills-showcase/packages mengto-skills-showcase/package.json mengto-skills-showcase/package-lock.json
git commit -m "feat: add shared showcase contracts"
```

### Task 5: Add README and agent-routing documentation

**Files:**
- Create: `mengto-skills-showcase/README.md`
- Create: `mengto-skills-showcase/AGENTS.md`
- Modify: `mengto-skills-showcase/scripts/validate-workspace.mjs`
- Modify: `mengto-skills-showcase/tests/workspace-contract.test.mjs`

**Interfaces:**
- Consumes: selected skill manifest, lock file, install guide, and workspace commands.
- Produces: project onboarding and exact skill-routing instructions.

- [ ] **Step 1: Write the failing README and routing assertions**

```js
it("documents the source, global install root, products, and runtime boundary", async () => {
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  for (const heading of [
    "## 产品矩阵",
    "## 本地运行",
    "## Skill 源码与安装目录",
    "## 已安装 Skills",
    "## Skill 对项目的影响",
    "## 更新与卸载",
    "## 验证",
  ]) expect(readme).toContain(heading);
  expect(readme).toContain("skills-source/MengTo-Skills");
  expect(readme).toContain("C:\\Users\\yun68\\.codex\\skills");
  expect(readme).toContain("不会进入最终产品");
});

it("routes each app to explicit skills", async () => {
  const agents = await readFile(new URL("../AGENTS.md", import.meta.url), "utf8");
  expect(agents).toContain("apps/monster-forge");
  expect(agents).toContain("apps/ashfall-arena");
  expect(agents).toContain("apps/mech-atelier");
  expect(agents).toContain("Read the narrowest matching SKILL.md before acting");
});
```

- [ ] **Step 2: Run the focused test and verify both files are absent**

```powershell
npm exec vitest run tests/workspace-contract.test.mjs
```

Expected: FAIL because `README.md` and `AGENTS.md` do not exist.

- [ ] **Step 3: Write the suite README**

The README must:

- lead with the five-demo portfolio and the three new products;
- use Chinese as its primary explanatory language;
- list Node.js 22+, npm, and WebGL prerequisites;
- include exact install, app-specific dev, test, browser-test, validate, and build commands;
- show the pinned local source path and global installation path;
- render a 16-row skill table from the approved manifest content;
- explain global Codex discovery impact;
- state that skills do not enter product bundles;
- link `docs/skill-installation.md`;
- document update and recoverable-removal summaries;
- link each product's future validation record.

- [ ] **Step 4: Write `AGENTS.md` routing rules**

The file must require:

- shared assets and schemas: `build-hybrid-game-assets`;
- Monster Forge review surfaces: `build-vesperfall-review-assets` and `build-game-monster-system`;
- Ashfall Arena foundation: `build-isometric-arpg`, then the narrow matching camera, level, combat, enemy, AI, inventory, VFX, or audio skill;
- mobile and performance changes: their dedicated skills;
- browser QA and release: `test-playable-web-games` and `ship-web-games`;
- Mech Atelier: shared asset rules plus the narrow matching installed web-design skill only if later approved and recorded;
- no edits inside `skills-source/MengTo-Skills`.

- [ ] **Step 5: Run all foundation verification**

```powershell
npm run validate
npm test
node scripts/check-selected-skills.mjs
git diff --check
```

Expected: every command PASS, all 16 skills installed, and the worktree contains only the intended foundation changes.

- [ ] **Step 6: Commit the documentation baseline**

```powershell
git add mengto-skills-showcase/README.md mengto-skills-showcase/AGENTS.md mengto-skills-showcase/scripts/validate-workspace.mjs mengto-skills-showcase/tests/workspace-contract.test.mjs
git commit -m "docs: explain showcase skill workflow"
```

## Foundation Completion Gate

Before starting any product plan:

- `npm run validate` passes;
- all shared unit tests pass;
- the pinned submodule SHA is committed;
- `node scripts/check-selected-skills.mjs` reports all 16 skills installed;
- README documents both installation locations and global impact;
- no product application imports from `.codex`, `skills-source`, or another app;
- the user can identify which skill affects each development phase from README alone.
