import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inspectSkillSourcePin } from "./validate-skill-source.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(scriptDirectory, "..");
const repositoryRoot = resolve(workspaceRoot, "..");
const fromWorkspace = (path) => resolve(workspaceRoot, path);
const appFolders = [
  "showcase-hub",
  "monster-forge",
  "ashfall-arena",
  "mech-atelier",
];
const packageFolders = [
  "content-schema",
  "game-assets",
  "input-system",
  "showcase-guide",
  "three-runtime",
  "ui-system",
];

const toSkillRows = (markdown, pattern) => [...markdown.matchAll(pattern)].map(
  ([, name, sourcePath, products, phases]) => ({
    name,
    sourcePath,
    products: products.split(", "),
    phases: phases.split(", "),
  }),
);

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
    await access(fromWorkspace(path));
  } catch {
    failures.push(`Missing required file: ${path}`);
  }
}

if (failures.length === 0) {
  const selection = JSON.parse(await readFile(fromWorkspace("config/selected-skills.json"), "utf8"));
  if (!Array.isArray(selection.skills) || selection.skills.length !== 16) {
    failures.push("config/selected-skills.json must contain exactly 16 approved skills");
  }

  if (new Set(selection.skills.map((skill) => skill.name)).size !== 16) {
    failures.push("config/selected-skills.json must use unique skill names");
  }

  const lock = JSON.parse(await readFile(fromWorkspace("config/skill-source-lock.json"), "utf8"));
  if (lock.repository !== "https://github.com/MengTo/Skills.git" || lock.branch !== "main") {
    failures.push("config/skill-source-lock.json must pin the approved MengTo/Skills source");
  }
  if (!/^[0-9a-f]{40}$/.test(lock.commit ?? "")) {
    failures.push("config/skill-source-lock.json must contain a full commit SHA");
  } else {
    failures.push(...inspectSkillSourcePin({
      lockCommit: lock.commit,
      submodulePath: fromWorkspace("skills-source/MengTo-Skills"),
      repositoryRoot,
      gitlinkPath: "mengto-skills-showcase/skills-source/MengTo-Skills",
      displayPath: "skills-source/MengTo-Skills",
    }));
  }

  const guide = await readFile(fromWorkspace("docs/skill-installation.md"), "utf8");
  const readme = await readFile(fromWorkspace("README.md"), "utf8");
  const agents = await readFile(fromWorkspace("AGENTS.md"), "utf8");
  const rootManifest = JSON.parse(await readFile(fromWorkspace("package.json"), "utf8"));
  const apps = await Promise.all(appFolders.map(async (folder) => JSON.parse(
    await readFile(fromWorkspace(`apps/${folder}/package.json`), "utf8"),
  )));
  const packages = await Promise.all(packageFolders.map(async (folder) => JSON.parse(
    await readFile(fromWorkspace(`packages/${folder}/package.json`), "utf8"),
  )));
  const expectedAppNames = [
    "@showcase/ashfall-arena",
    "@showcase/hub",
    "@showcase/mech-atelier",
    "@showcase/monster-forge",
  ];
  const expectedPackageNames = [
    "@showcase/content-schema",
    "@showcase/game-assets",
    "@showcase/input-system",
    "@showcase/showcase-guide",
    "@showcase/three-runtime",
    "@showcase/ui-system",
  ];

  if (JSON.stringify(rootManifest.workspaces) !== JSON.stringify(["apps/*", "packages/*"])) {
    failures.push("package.json must expose apps/* and packages/* workspaces");
  }
  if (JSON.stringify(rootManifest.engines) !== JSON.stringify({
    node: "^20.19.0 || >=22.12.0",
  })) {
    failures.push("package.json must preserve the supported Node.js engine range");
  }
  if (JSON.stringify(apps.map(({ name }) => name).sort()) !== JSON.stringify(expectedAppNames)) {
    failures.push("workspace must expose the four approved showcase apps");
  }
  if (JSON.stringify(packages.map(({ name }) => name).sort()) !== JSON.stringify(expectedPackageNames)) {
    failures.push("workspace must expose the six approved shared packages");
  }
  if (apps.some(({ private: isPrivate }) => isPrivate !== true)
    || packages.some(({ private: isPrivate }) => isPrivate !== true)) {
    failures.push("showcase apps and shared packages must remain private workspaces");
  }

  const sharedGuide = packages.find(({ name }) => name === "@showcase/showcase-guide");
  if (JSON.stringify(sharedGuide?.exports) !== JSON.stringify({
    ".": "./src/index.ts",
    "./styles.css": "./src/styles.css",
  })) {
    failures.push("@showcase/showcase-guide must expose its script and stylesheet routes");
  }
  for (const app of apps) {
    if (app.dependencies?.["@showcase/showcase-guide"] !== "*") {
      failures.push(`${app.name} must route product guidance through @showcase/showcase-guide`);
    }
  }
  for (const [script, command] of Object.entries({
    dev: "node scripts/dev-showcase.mjs",
    "dev:hub": "npm run dev --workspace @showcase/hub",
    "build:showcase": "node scripts/build-showcase.mjs",
    "test:showcase-preview": "playwright test --config playwright.showcase-preview.config.ts",
  })) {
    if (rootManifest.scripts?.[script] !== command) {
      failures.push(`package.json script ${script} must be ${command}`);
    }
  }
  const expectedRows = selection.skills.map(({ name, sourcePath, products, phases }) => ({
    name,
    sourcePath,
    products,
    phases,
  }));
  const readmeRows = toSkillRows(
    readme,
    /^\| `([^`]+)` \| `([^`]+)` \| `([^`]+)` \| `([^`]+)` \|$/gm,
  );
  const guideRows = toSkillRows(
    guide,
    /^\| `([^`]+)` \| `([^`]+)` \| `([^`]+)` \| `([^`]+)` \| [^|]+ \|$/gm,
  );
  for (const skill of selection.skills) {
    if (!guide.includes(`\`${skill.name}\``)) {
      failures.push(`docs/skill-installation.md must document ${skill.name}`);
    }
    if (!readme.includes(`\`${skill.name}\``)) {
      failures.push(`README.md must document ${skill.name}`);
    }
  }

  if (JSON.stringify(readmeRows) !== JSON.stringify(expectedRows)) {
    failures.push("README.md skill table must match selected-skills.json product and phase mappings");
  }
  if (JSON.stringify(guideRows) !== JSON.stringify(expectedRows)) {
    failures.push("docs/skill-installation.md skill table must match selected-skills.json product and phase mappings");
  }

  const arpg = selection.skills.find((skill) => skill.name === "build-isometric-arpg");
  if (JSON.stringify(arpg?.products) !== JSON.stringify(["ashfall-arena"])) {
    failures.push("build-isometric-arpg must route only to ashfall-arena");
  }
  if (selection.skills.some((skill) => skill.sourcePath.includes("/web-design/"))) {
    failures.push("Unapproved web-design skills must not be recorded in selected-skills.json");
  }

  for (const phrase of [
    "C:\\Users\\yun68\\.codex\\skills",
    "开发操作规范",
    "不是运行时依赖",
    "所有 Codex 项目",
    "Skill 是 Codex 开发与验收时读取的工作说明",
    "网页运行时不会加载这些 Skill",
    "本项目代码位于当前 `mengto-skills-showcase` 套件目录",
    "不属于能力展厅三产品",
  ]) {
    if (!guide.includes(phrase)) {
      failures.push(`docs/skill-installation.md must explain: ${phrase}`);
    }
  }

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
    headingPositions.some((position) => position < 0)
    || headingPositions.some((position, index) =>
      index > 0 && position <= headingPositions[index - 1])
  ) {
    failures.push("README.md archive headings must exist in the required order");
  }

  for (const phrase of [
    '<img src="../docs/demos/07-mengto-skills-showcase.gif"',
    "https://github.com/MengTo/Skills",
    "https://github.com/MengTo/Skills/tree/93da48f13fb1b91bdbf4718d0f49df1a469edb45",
    "https://vesperfall.mengto.chatgpt.site/",
    "Vesperfall 仅作为关联效果参考。本项目没有复制或重新托管其源码、模型、贴图、动画或页面素材，也不存在官方关联。",
    "Skill 指导 Codex 如何规划、实现、测试和交付；浏览器运行时不会加载 Skill，最终产物仍是普通的 Vite/Three.js 网页。",
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
    if (!readme.includes(phrase)) failures.push(`README.md must explain: ${phrase}`);
  }
  for (const forbidden of ["四款产品", "## 两个独立演示"]) {
    if (readme.includes(forbidden)) {
      failures.push(`README.md must not contain: ${forbidden}`);
    }
  }
  for (const workspace of ["hub", "monster-forge", "ashfall-arena", "mech-atelier"]) {
    const command = `npm run test:browser --workspace @showcase/${workspace}`;
    if (!readme.includes(command)) failures.push(`README.md must document: ${command}`);
  }

  for (const phrase of [
    "Read the narrowest matching SKILL.md before acting",
    "apps/monster-forge",
    "apps/ashfall-arena",
    "apps/mech-atelier",
    "build-hybrid-game-assets",
    "build-vesperfall-review-assets",
    "build-game-monster-system",
    "build-isometric-arpg",
    "test-playable-web-games",
    "ship-web-games",
    "skills-source/MengTo-Skills",
    "Mech Atelier 当前没有批准任何 web-design Skill",
    "未批准的 web-design Skill 不得",
  ]) {
    if (!agents.includes(phrase)) failures.push(`AGENTS.md must route: ${phrase}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Workspace contract valid.");
}
