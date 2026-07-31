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

test("project 08 documentation presents approved original and lighthouse GIF evidence", async () => {
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
  assert.match(rootReadme, /## 10 · My Room in 3D 空间化产品承载研究/);
  assert.doesNotMatch(rootReadme, /## 08 · Finesse Skill 产品研究/);
  assert.match(rootReadme, /不是把一张图片自动转换成 3D 的工具/);
  assert.match(rootReadme, /不表示官方关联/);
  assert.match(rootReadme, /\.\/docs\/demos\/08-r3f-scroll-rig-original\.gif/);
  assert.match(rootReadme, /\.\/docs\/demos\/08-r3f-scroll-rig-lighthouse\.gif/);
  assert.match(
    rootReadme,
    /<img src="\.\/docs\/demos\/08-r3f-scroll-rig-original\.gif" alt="r3f-scroll-rig 原库 Demo 的滚动同步、Sticky 与内联 3D 能力展示" width="720">/,
  );
  assert.doesNotMatch(
    rootReadme,
    /<img src="\.\/docs\/demos\/08-r3f-scroll-rig-original\.gif" alt="[^"]*(?:图片视差|image-parallax)[^"]*"/i,
  );
  assert.match(rootReadme, /原库 Demo 回答“这个库能做什么”/);
  assert.match(rootReadme, /灯塔 Demo 回答“我们如何把它用于真实场景”/);
  assert.match(rootReadme, /adf7d47ea5bf3d8e8cf957b0f3667bea752e5f63/);
  assert.match(rootReadme, /历史样例实际安装版本为 `6\.0\.5`/);
  assert.match(rootReadme, /上游采用 ISC 许可/);
  assert.match(projectReadme, /@14islands\/r3f-scroll-rig 8\.15\.0/);
  assert.match(projectReadme, /不是将图片自动转换为 3D 的服务或模型生成器/);
  assert.match(projectReadme, /adf7d47ea5bf3d8e8cf957b0f3667bea752e5f63/);
  assert.match(projectReadme, /实际安装 `6\.0\.5`/);
  assert.match(projectReadme, /上游采用 ISC 许可/);
  assert.match(projectReadme, /不表示与上游存在官方关联/);
  assert.match(projectReadme, /\.\.\/docs\/demos\/08-r3f-scroll-rig-original\.gif/);
  assert.match(projectReadme, /\.\.\/docs\/demos\/08-r3f-scroll-rig-lighthouse\.gif/);
  assert.match(
    projectReadme,
    /<img src="\.\.\/docs\/demos\/08-r3f-scroll-rig-original\.gif" alt="r3f-scroll-rig 原库 Demo 的滚动同步、Sticky 与内联 3D 能力展示" width="720">/,
  );

  const assertDemoOrder = (readme, originalGif, lighthouseGif, localRun) => {
    const originalIndex = readme.indexOf(originalGif);
    const lighthouseIndex = readme.indexOf(lighthouseGif);
    const localRunIndex = readme.indexOf(localRun);

    assert.ok(originalIndex >= 0, `missing ${originalGif}`);
    assert.ok(lighthouseIndex > originalIndex, "lighthouse GIF must follow original GIF");
    assert.ok(localRunIndex > lighthouseIndex, "local run instructions must follow both GIFs");
  };

  assertDemoOrder(
    rootReadme,
    "./docs/demos/08-r3f-scroll-rig-original.gif",
    "./docs/demos/08-r3f-scroll-rig-lighthouse.gif",
    "运行和验证方式如下：",
  );
  assertDemoOrder(
    projectReadme,
    "../docs/demos/08-r3f-scroll-rig-original.gif",
    "../docs/demos/08-r3f-scroll-rig-lighthouse.gif",
    "## 本地运行",
  );
});
