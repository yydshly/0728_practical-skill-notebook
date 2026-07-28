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

  const guide = await readFile("docs/skill-installation.md", "utf8");
  for (const skill of selection.skills) {
    if (!guide.includes(`\`${skill.name}\``)) {
      failures.push(`docs/skill-installation.md must document ${skill.name}`);
    }
  }

  for (const phrase of ["C:\\Users\\yun68\\.codex\\skills", "开发操作规范", "不是运行时依赖", "所有 Codex 项目"]) {
    if (!guide.includes(phrase)) {
      failures.push(`docs/skill-installation.md must explain: ${phrase}`);
    }
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Workspace contract valid.");
}
