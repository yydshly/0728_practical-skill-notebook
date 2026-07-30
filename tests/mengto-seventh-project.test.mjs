import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  MENGTO_SKILLS_URL, PINNED_SKILLS_URL, VESPERFALL_URL,
  assertNoForbiddenStagedPaths, assertNoVesperfallMedia,
  assertStagedRootReadmeBoundary, checkSeventhProject, extractGifReference, resolveReadmeMediaPath,
  validateSeventhProjectReadmes,
} from "../scripts/lib/mengto-seventh-project.mjs";

const disclaimer = "Vesperfall 仅作为关联效果参考。本项目没有复制或重新托管其源码、模型、贴图、动画或页面素材，也不存在官方关联。";
const runtimeBoundary = "Skill 指导 Codex 如何规划、实现、测试和交付；浏览器运行时不会加载 Skill，最终产物仍是普通的 Vite/Three.js 网页。";

function validRootReadme() {
  return [
    "| 06 | [《雾村：逃离》](./rural-mutation-escape/) | `rural-mutation-escape` | 第三人称农村变异逃生原型 |",
    "| 07 | MengTo Skills 三产品能力展 |",
    "## 06 · 《雾村：逃离》",
    "- [项目 README](./rural-mutation-escape/README.md)",
    "- [参考来源](./rural-mutation-escape/docs/REFERENCES.md)",
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
  return ["## 先看当前效果", '<img src="../docs/demos/07-mengto-skills-showcase.gif" width="720">', "## 来源、参考与独立实现", MENGTO_SKILLS_URL, PINNED_SKILLS_URL, VESPERFALL_URL, disclaimer, runtimeBoundary, "## 四个应用、三款产品", "四个可运行应用，但只有三款展示产品", "## 一条命令本地运行", "## 项目如何实现", "## Skill 安装目录与全局影响", "## 16 项 Skill 与产品/阶段映射", "## 测试、构建与验证", "## 当前归档状态与验证边界", "当前未公开部署", "## Skill 更新与安全卸载"].join("\n");
}

function git(rootDir, ...args) {
  execFileSync("git", args, { cwd: rootDir, stdio: "pipe", windowsHide: true });
}

function archiveGif() {
  const oneFrame = Buffer.from(
    "R0lGODlh0ALgAYAAAAAAAP///yH/C05FVFNDQVBFMi4wAwEAAAAh+QQAGQAAACwAAAAAAQABAAACAkQBADs=",
    "base64",
  );
  const gceOffset = oneFrame.indexOf(Buffer.from([0x21, 0xf9, 0x04]));
  const trailerOffset = oneFrame.lastIndexOf(0x3b);
  const prefix = oneFrame.subarray(0, gceOffset);
  const frame = oneFrame.subarray(gceOffset, trailerOffset);
  return Buffer.concat([
    prefix,
    ...Array.from({ length: 60 }, () => frame),
    Buffer.from([0x3b]),
  ]);
}

async function createRepository() {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "mengto-seventh-project-"));
  await mkdir(path.join(rootDir, "mengto-skills-showcase"), { recursive: true });
  await mkdir(path.join(rootDir, "docs", "demos"), { recursive: true });
  await writeFile(path.join(rootDir, "README.md"), validRootReadme());
  await writeFile(path.join(rootDir, "mengto-skills-showcase", "README.md"), validShowcaseReadme());
  await writeFile(path.join(rootDir, "docs", "demos", "07-mengto-skills-showcase.gif"), archiveGif());
  git(rootDir, "init");
  git(rootDir, "config", "user.name", "Task 2 Test");
  git(rootDir, "config", "user.email", "task-2-test@example.invalid");
  git(rootDir, "add", "README.md", "mengto-skills-showcase/README.md", "docs/demos/07-mengto-skills-showcase.gif");
  git(rootDir, "commit", "-m", "fixture");
  return rootDir;
}

test("HTML and Markdown GIF references are both parsed", () => {
  assert.equal(extractGifReference(validRootReadme(), "root README"), "./docs/demos/07-mengto-skills-showcase.gif");
  assert.equal(extractGifReference("![演示](../docs/demos/07-mengto-skills-showcase.gif)", "showcase README"), "../docs/demos/07-mengto-skills-showcase.gif");
});

test("conflicting project 07 GIF references are rejected", () => {
  assert.throws(
    () => extractGifReference(
      [
        "![wrong](https://example.invalid/07-mengto-skills-showcase.gif)",
        '<img src="./docs/demos/07-mengto-skills-showcase.gif">',
      ].join("\n"),
      "root README",
    ),
    /conflicting project 07 GIF references/,
  );
});

test("both README media references resolve to the same repository artifact", () => {
  const root = path.resolve("fixture-root");
  assert.equal(resolveReadmeMediaPath(root, "README.md", extractGifReference(validRootReadme(), "root README")), resolveReadmeMediaPath(root, "mengto-skills-showcase/README.md", extractGifReference(validShowcaseReadme(), "showcase README")));
});

test("valid two-level Chinese documentation satisfies the archive contract", () => {
  assert.deepEqual(validateSeventhProjectReadmes({ rootReadme: validRootReadme(), showcaseReadme: validShowcaseReadme() }), []);
});

test("missing source and four-product wording are reported", () => {
  const failures = validateSeventhProjectReadmes({ rootReadme: validRootReadme().replace(PINNED_SKILLS_URL, ""), showcaseReadme: validShowcaseReadme().replace("四个可运行应用，但只有三款展示产品", "四款产品") });
  assert.ok(failures.some((failure) => failure.includes(PINNED_SKILLS_URL)));
  assert.ok(failures.some((failure) => failure.includes("四款产品")));
});

test("Vesperfall media names and user-owned staged prefixes are rejected", () => {
  for (const file of ["docs/demos/vesperfall-reference.mp4", "docs/vesperfall/reference.png"]) assert.throws(() => assertNoVesperfallMedia([file]), /Vesperfall media/);
  assert.doesNotThrow(() => assertNoVesperfallMedia(["docs/demos/07-mengto-skills-showcase.gif"]));
  for (const file of [".superpowers/session.json", "claude-of-duty-research/README.md", "test-results/report.json"]) assert.throws(() => assertNoForbiddenStagedPaths([file]), /forbidden staged path/);
});

test("a staged root README preserves the registered rural project 06 and rejects the obsolete path", () => {
  for (const reference of ["[研究](./claude-of-duty-research/RESEARCH.md)", "[研究](claude-of-duty-research/RESEARCH.md)", "https://github.com/mshumer/Claude-of-Duty"]) assert.throws(() => assertStagedRootReadmeBoundary({ stagedFiles: ["README.md"], indexReadme: reference }), /06 project path/);
  assert.doesNotThrow(() => assertStagedRootReadmeBoundary({
    stagedFiles: ["README.md"],
    indexReadme: validRootReadme(),
  }));
  assert.throws(
    () => assertStagedRootReadmeBoundary({
      stagedFiles: ["README.md"],
      indexReadme: "| 06 | Claude of Duty 技术研究 | — | 独立整理中；不属于本次第 07 项归档。 |",
    }),
    /registered 06 text/,
  );
});

test("repository archive check succeeds for one shared tracked GIF", async () => {
  const rootDir = await createRepository();
  try {
    assert.deepEqual(await checkSeventhProject({ rootDir }), {
      failures: [],
      artifact: {
        signature: "GIF89a",
        width: 720,
        height: 480,
        frameRate: 4,
        frames: 60,
        durationSeconds: 15,
        loopCount: 0,
        size: archiveGif().length,
      },
    });
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("repository archive check reads a staged root README boundary", async () => {
  const rootDir = await createRepository();
  try {
    await writeFile(
      path.join(rootDir, "README.md"),
      `${validRootReadme()}\n[research](./claude-of-duty-research/RESEARCH.md)`,
    );
    git(rootDir, "add", "README.md");
    const { failures } = await checkSeventhProject({ rootDir });
    assert.ok(failures.some((failure) => failure.includes("independent 06 project path")));
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("repository archive check aggregates GIF, tracked-media, and staged-path failures", async () => {
  const rootDir = await createRepository();
  try {
    await rm(path.join(rootDir, "docs", "demos", "07-mengto-skills-showcase.gif"));
    await writeFile(path.join(rootDir, "docs", "demos", "vesperfall-reference.mp4"), "blocked");
    await mkdir(path.join(rootDir, ".superpowers"));
    await writeFile(path.join(rootDir, ".superpowers", "session.json"), "{}");
    git(rootDir, "add", "docs/demos/vesperfall-reference.mp4", ".superpowers/session.json");
    const { failures } = await checkSeventhProject({ rootDir });
    assert.ok(failures.some((failure) => failure.includes("ENOENT")));
    assert.ok(failures.some((failure) => failure.includes("Vesperfall media")));
    assert.ok(failures.some((failure) => failure.includes("forbidden staged path")));
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
