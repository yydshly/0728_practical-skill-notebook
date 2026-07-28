import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

const selection = JSON.parse(await readFile("config/selected-skills.json", "utf8"));
const installRoot = join(process.env.USERPROFILE, ".codex", "skills");
const results = [];

for (const skill of selection.skills) {
  const installPath = join(installRoot, skill.name);
  let installed = true;
  try {
    await access(join(installPath, "SKILL.md"));
  } catch {
    installed = false;
  }
  results.push({ name: skill.name, installed, installPath });
}

console.table(results);
if (results.some((result) => !result.installed)) process.exitCode = 1;
