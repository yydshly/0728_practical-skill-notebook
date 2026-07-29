import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const projectRoot = path.join(repoRoot, "rural-mutation-escape");

async function read(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

function assertIncludesAll(text, values, label) {
  for (const value of values) {
    assert.ok(text.includes(value), `${label} is missing: ${value}`);
  }
}

async function assertLocalLinksResolve(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  const markdown = await readFile(absolutePath, "utf8");
  const links = [...markdown.matchAll(/\[[^\]]+\]\((?!https?:|#)([^)#]+)(?:#[^)]+)?\)/g)];
  for (const [, target] of links) {
    await access(path.resolve(path.dirname(absolutePath), target));
  }
}

test("subtree target is an ordinary runnable project directory", async () => {
  await access(path.join(projectRoot, "package.json"));
  await access(path.join(projectRoot, "src", "main.js"));
  await access(path.join(projectRoot, "audio-source", "manifest.json"));
  await assert.rejects(
    access(path.join(projectRoot, ".git")),
    (error) => error?.code === "ENOENT",
  );
});

test("project README is complete and distinguishes shipped from planned behavior", async () => {
  const readme = await read("rural-mutation-escape/README.md");
  assertIncludesAll(readme, [
    "# 《雾村：逃离》",
    "## 当前状态",
    "## 当前可玩内容与尚未实现范围",
    "## 桌面操作",
    "## 安装与运行",
    "## 测试、音频与构建",
    "## 目录结构",
    "## 技术方案",
    "## 参考来源、原创性与许可边界",
    "## 已知限制",
    "## 核心闭环研究文档",
    "## 非官方声明",
    "W/A/S/D",
    "Shift",
    "鼠标左键",
    "C",
    "E",
    "声音按钮",
    "npm.cmd install",
    "npm.cmd ci",
    "npm.cmd run dev",
    "npm.cmd run test:unit",
    "npm.cmd run test:audio",
    "npm.cmd test",
    "npm.cmd run audio:verify",
    "npm.cmd run build",
    "数据驱动村庄",
    "共享角色碰撞",
    "第一/第三人称镜头",
    "目标、故事与引导",
    "追逐与危险反馈",
    "Web Audio 动态音乐",
    "Node 与 Playwright",
    "当前版本尚未实现",
    "| 领域 | 当前已经实现 | 当前未实现或本轮不包含 |",
    "失败/重试",
    "检查点",
    "视野与听觉感知 AI",
    "持续交互开启的南门",
    "核心闭环验证状态",
    "非官方",
  ], "project README");
  await assertLocalLinksResolve("rural-mutation-escape/README.md");
  const validationStatus = await read(
    "rural-mutation-escape/docs/superpowers/validation/2026-07-30-rural-mutation-escape-core-loop-status.md",
  );
  assertIncludesAll(validationStatus, [
    "状态：尚未执行",
    "不是核心闭环已经完成的证据",
    "失败与重试",
    "检查点恢复",
    "感知 AI",
    "动态南门",
    "真实浏览器完整路线",
  ], "core-loop validation status");
});

test("reference document pins the upstream and the independent implementation boundary", async () => {
  const references = await read("rural-mutation-escape/docs/REFERENCES.md");
  assertIncludesAll(references, [
    "https://github.com/mshumer/Claude-of-Duty",
    "d9b237b75c9304ab8d9ef4cfa0c3568c7c11a853",
    "MIT",
    "Three.js/WebGL",
    "程序化几何",
    "浏览器证据",
    "设计契约、测试与 Git 提交历史",
    "未复制",
    "武器",
    "纹理",
    "音频",
    "scripts/rural-score-core.mjs",
    "audio-source/manifest.json",
    "FFmpeg",
    "不随本项目分发",
  ], "reference document");
});

test("third-party notices state verified licenses without selecting a project license", async () => {
  const notices = await read("rural-mutation-escape/THIRD_PARTY_NOTICES.md");
  assertIncludesAll(notices, [
    "mshumer/Claude-of-Duty",
    "Three.js",
    "0.180.0",
    "Vite",
    "7.3.6",
    "Playwright",
    "1.62.0",
    "Apache-2.0",
    "FFmpeg/FFprobe",
    "不决定《雾村：逃离》的整体许可证",
  ], "third-party notices");
});

test("project ignore rules retain selected evidence and audio provenance", async () => {
  const lines = (await read("rural-mutation-escape/.gitignore"))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (const expected of [
    "node_modules/",
    "dist/",
    "playwright-report/",
    "test-results/",
    ".tmp/",
    ".cache/",
  ]) {
    assert.ok(lines.includes(expected), `.gitignore is missing ${expected}`);
  }
  assert.ok(!lines.includes("artifacts/"), "project artifacts must remain trackable");
  assert.ok(!lines.includes("audio-source/"), "audio provenance must remain trackable");
});
