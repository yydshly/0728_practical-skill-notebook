import { lstat, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const suiteRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const selection = JSON.parse(await readFile(join(suiteRoot, "config", "selected-skills.json"), "utf8"));
const installRoot = join(process.env.USERPROFILE, ".codex", "skills");
const results = [];

for (const skill of selection.skills) {
  const installPath = join(installRoot, skill.name);
  let installed = true;
  try {
    installed = (await lstat(join(installPath, "SKILL.md"))).isFile();
  } catch {
    installed = false;
  }
  results.push({ name: skill.name, installed, installPath });
}

console.table(results);
if (results.some((result) => !result.installed)) process.exitCode = 1;
