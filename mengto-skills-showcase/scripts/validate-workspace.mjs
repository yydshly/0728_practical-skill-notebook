import { access, readFile } from "node:fs/promises";

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

  if (new Set(selection.skills.map((skill) => skill.name)).size !== 16) {
    failures.push("config/selected-skills.json must use unique skill names");
  }

  const lock = JSON.parse(await readFile("config/skill-source-lock.json", "utf8"));
  if (lock.repository !== "https://github.com/MengTo/Skills.git" || lock.branch !== "main") {
    failures.push("config/skill-source-lock.json must pin the approved MengTo/Skills source");
  }
  if (!/^[0-9a-f]{40}$/.test(lock.commit ?? "")) {
    failures.push("config/skill-source-lock.json must contain a full commit SHA");
  }

  const guide = await readFile("docs/skill-installation.md", "utf8");
  const readme = await readFile("README.md", "utf8");
  const agents = await readFile("AGENTS.md", "utf8");
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

  for (const phrase of ["C:\\Users\\yun68\\.codex\\skills", "开发操作规范", "不是运行时依赖", "所有 Codex 项目"]) {
    if (!guide.includes(phrase)) {
      failures.push(`docs/skill-installation.md must explain: ${phrase}`);
    }
  }

  for (const heading of [
    "## 产品矩阵",
    "## 本地运行",
    "## Skill 源码与安装目录",
    "## 已安装 Skills",
    "## Skill 对项目的影响",
    "## 更新与卸载",
    "## 验证",
  ]) {
    if (!readme.includes(heading)) failures.push(`README.md must contain ${heading}`);
  }

  for (const phrase of [
    "skills-source/MengTo-Skills",
    "C:\\Users\\yun68\\.codex\\skills",
    "不会进入最终产品包",
    "不会自动同步",
    "已有演示",
    "规划中",
  ]) {
    if (!readme.includes(phrase)) failures.push(`README.md must explain: ${phrase}`);
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
