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
