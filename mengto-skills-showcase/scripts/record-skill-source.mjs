import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";

const cwd = "skills-source/MengTo-Skills";
const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd, encoding: "utf8" }).trim();
const branch = execFileSync("git", ["branch", "--show-current"], { cwd, encoding: "utf8" }).trim();
const lock = {
  repository: "https://github.com/MengTo/Skills.git",
  branch,
  commit,
  recordedAt: new Date().toISOString(),
};

await writeFile("config/skill-source-lock.json", `${JSON.stringify(lock, null, 2)}\n`, "utf8");
console.log(`Recorded MengTo/Skills ${commit}`);
