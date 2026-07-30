import { execFile as execFileCallback } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { assertGifFile } from "./mengto-showcase-recording.mjs";

export const MENGTO_SKILLS_URL = "https://github.com/MengTo/Skills";
export const PINNED_SKILLS_URL = "https://github.com/MengTo/Skills/tree/93da48f13fb1b91bdbf4718d0f49df1a469edb45";
export const VESPERFALL_URL = "https://vesperfall.mengto.chatgpt.site/";

const commonRequired = [MENGTO_SKILLS_URL, PINNED_SKILLS_URL, VESPERFALL_URL, "三款产品", "未公开部署", "Vesperfall 仅作为关联效果参考。本项目没有复制或重新托管其源码、模型、贴图、动画或页面素材，也不存在官方关联。", "Skill 指导 Codex 如何规划、实现、测试和交付；浏览器运行时不会加载 Skill，最终产物仍是普通的 Vite/Three.js 网页。"];
const showcaseHeadings = ["## 先看当前效果", "## 来源、参考与独立实现", "## 四个应用、三款产品", "## 一条命令本地运行", "## 项目如何实现", "## Skill 安装目录与全局影响", "## 16 项 Skill 与产品/阶段映射", "## 测试、构建与验证", "## 当前归档状态与验证边界", "## Skill 更新与安全卸载"];
const forbiddenStagedPrefixes = [".superpowers/", "claude-of-duty-research/", "test-results/"];
const neutralSixthProject = ["| 06 | Claude of Duty 技术研究 | — | 独立整理中；不属于本次第 07 项归档。 |", "## 06 · Claude of Duty 技术研究", "该项目正在独立整理中，本次不纳入第 07 项归档或提交范围。"];
const vesperfallMedia = /vesperfall.*\.(gif|png|jpe?g|webp|mp4|webm|glb|gltf|fbx)$/i;
const execFile = promisify(execFileCallback);
const defaultRootDir = fileURLToPath(new URL("../..", import.meta.url));

export function resolveReadmeMediaPath(repositoryRoot, readmePath, mediaReference) {
  return path.resolve(repositoryRoot, path.dirname(readmePath), mediaReference);
}

export function extractGifReference(readme, label) {
  const markdownMatch = readme.match(/!\[[^\]]*\]\(([^)\s]*07-mengto-skills-showcase\.gif)\)/);
  const htmlMatch = readme.match(/<img\b[^>]*\bsrc=["']([^"']*07-mengto-skills-showcase\.gif)["'][^>]*>/i);
  const reference = markdownMatch?.[1] ?? htmlMatch?.[1];
  if (!reference) throw new Error(`${label} is missing the project 07 GIF image.`);
  return reference;
}

export function validateSeventhProjectReadmes({ rootReadme, showcaseReadme }) {
  const failures = [];
  for (const required of commonRequired) {
    if (!rootReadme.includes(required)) failures.push(`README.md missing: ${required}`);
    if (!showcaseReadme.includes(required)) failures.push(`mengto-skills-showcase/README.md missing: ${required}`);
  }
  if (!rootReadme.includes("| 07 |")) failures.push("README.md missing: | 07 |");
  if (!rootReadme.includes("./docs/demos/07-mengto-skills-showcase.gif")) failures.push("README.md missing the project 07 GIF reference");
  if (!showcaseReadme.includes("../docs/demos/07-mengto-skills-showcase.gif")) failures.push("showcase README missing the shared project 07 GIF reference");
  if (!showcaseReadme.includes("四个可运行应用")) failures.push("showcase README must describe four runnable applications");
  if (!showcaseReadme.includes("只有三款展示产品")) failures.push("showcase README must describe only three showcase products");
  if (rootReadme.includes("四款产品") || showcaseReadme.includes("四款产品")) failures.push("README files must not describe four products: 四款产品");
  const positions = showcaseHeadings.map((heading) => showcaseReadme.indexOf(heading));
  if (positions.some((position) => position < 0) || positions.some((position, index) => index > 0 && position <= positions[index - 1])) failures.push("showcase README headings are missing or out of order");
  return failures;
}

export function assertNoVesperfallMedia(filePaths) {
  const violation = filePaths.map((filePath) => filePath.replaceAll("\\", "/")).find((filePath) => vesperfallMedia.test(filePath));
  if (violation) throw new Error(`Tracked Vesperfall media is forbidden: ${violation}`);
}

export function assertNoForbiddenStagedPaths(filePaths) {
  const violation = filePaths.map((filePath) => filePath.replaceAll("\\", "/")).find((filePath) => forbiddenStagedPrefixes.some((prefix) => filePath.startsWith(prefix)));
  if (violation) throw new Error(`forbidden staged path: ${violation}`);
}

export function assertStagedRootReadmeBoundary({ stagedFiles, indexReadme }) {
  if (!stagedFiles.includes("README.md")) return;
  if (indexReadme.includes("claude-of-duty-research/") || indexReadme.includes("github.com/mshumer/Claude-of-Duty")) throw new Error("staged README exposes the independent 06 project path");
  for (const required of neutralSixthProject) if (!indexReadme.includes(required)) throw new Error(`staged README is missing neutral 06 text: ${required}`);
}

async function gitText(rootDir, args) {
  const { stdout } = await execFile("git", args, { cwd: rootDir, encoding: "utf8", windowsHide: true });
  return stdout;
}

function nulPaths(output) { return output.split("\0").filter(Boolean); }

export async function checkSeventhProject({ rootDir = defaultRootDir } = {}) {
  const rootReadmePath = "README.md";
  const showcaseReadmePath = "mengto-skills-showcase/README.md";
  const [rootReadme, showcaseReadme, trackedOutput, stagedOutput] = await Promise.all([
    readFile(path.join(rootDir, rootReadmePath), "utf8"), readFile(path.join(rootDir, showcaseReadmePath), "utf8"),
    gitText(rootDir, ["ls-files", "-z"]), gitText(rootDir, ["diff", "--cached", "--name-only", "-z"]),
  ]);
  const trackedFiles = nulPaths(trackedOutput);
  const stagedFiles = nulPaths(stagedOutput);
  const failures = validateSeventhProjectReadmes({ rootReadme, showcaseReadme });
  let artifact = null;
  try {
    const rootMedia = resolveReadmeMediaPath(rootDir, rootReadmePath, extractGifReference(rootReadme, rootReadmePath));
    const showcaseMedia = resolveReadmeMediaPath(rootDir, showcaseReadmePath, extractGifReference(showcaseReadme, showcaseReadmePath));
    if (rootMedia !== showcaseMedia) throw new Error("README GIF references do not resolve to one artifact.");
    artifact = await assertGifFile(rootMedia);
  } catch (error) { failures.push(error.message); }
  for (const check of [() => assertNoVesperfallMedia(trackedFiles), () => assertNoForbiddenStagedPaths(stagedFiles)]) {
    try { check(); } catch (error) { failures.push(error.message); }
  }
  if (stagedFiles.includes("README.md")) {
    try { assertStagedRootReadmeBoundary({ stagedFiles, indexReadme: await gitText(rootDir, ["show", ":README.md"]) }); } catch (error) { failures.push(error.message); }
  }
  return { failures, artifact };
}
