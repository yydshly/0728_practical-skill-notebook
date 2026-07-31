import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

test("project 08 documentation is registered without GIF dependencies", async () => {
  const [rootReadme, projectReadme] = await Promise.all([
    readFile(path.join(rootDir, "README.md"), "utf8"),
    readFile(path.join(rootDir, SHOWCASE_DIRECTORY, "README.md"), "utf8"),
  ]);

  assert.match(
    rootReadme,
    /\| 08 \| \[r3f-scroll-rig 原库能力与雾屿灯塔应用验证\]\(\.\/r3f-scroll-rig-showcase\/\)/,
  );
  assert.match(rootReadme, /## 08 · r3f-scroll-rig 原库能力与雾屿灯塔应用验证/);
  assert.match(rootReadme, /## 09 · Finesse Skill 产品研究/);
  assert.doesNotMatch(rootReadme, /## 08 · Finesse Skill 产品研究/);
  assert.match(projectReadme, /@14islands\/r3f-scroll-rig 8\.15\.0/);
  assert.match(projectReadme, /adf7d47ea5bf3d8e8cf957b0f3667bea752e5f63/);
  assert.match(projectReadme, /实际安装 `6\.0\.5`/);
  assert.doesNotMatch(`${rootReadme}\n${projectReadme}`, /08-r3f-scroll-rig-.*\.gif/);
});
