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
