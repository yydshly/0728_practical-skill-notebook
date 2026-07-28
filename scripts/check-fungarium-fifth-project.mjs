import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  RECORDINGS,
  assertGifFile,
  assertNoTrackedUpstreamFiles,
} from "./lib/fungarium-recording.mjs";

const executeFile = promisify(execFile);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readmeRequired = [
  "| 05 |",
  "https://github.com/nesdesignco/fungarium",
  "a139bd08fc64cf0be76bd1dae447da6848d89899",
  "未复制上游源码或第三方 GLB/PBR 素材",
  "不存在官方关联",
  "05-fungarium-original.gif",
  "05-fungarium-product-showcase.gif",
];
const failures = [];

try {
  const readme = await readFile(path.join(rootDir, "README.md"), "utf8");
  for (const required of readmeRequired) {
    if (!readme.includes(required)) failures.push(`README.md 缺少：${required}`);
  }
} catch (error) {
  failures.push(`无法读取 README.md：${error.message}`);
}

for (const { output } of RECORDINGS) {
  try {
    await assertGifFile(path.join(rootDir, output));
  } catch (error) {
    failures.push(error.message);
  }
}

try {
  const { stdout } = await executeFile("git", ["ls-files"], { cwd: rootDir });
  assertNoTrackedUpstreamFiles(stdout.split(/\r?\n/).filter(Boolean));
} catch (error) {
  failures.push(error.message);
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exitCode = 1;
} else {
  console.log("Fungarium fifth-project documentation and media check passed.");
}
