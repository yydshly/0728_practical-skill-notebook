import { spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { extname, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "vitest";

const appRoot = fileURLToPath(new URL("../", import.meta.url));
const distRoot = new URL("../dist/", import.meta.url);
const runtimeTextExtensions = new Set([".cjs", ".css", ".html", ".js", ".mjs"]);
const forbiddenLoopback = /127\.0\.0\.1|localhost|\[::1\]/i;

async function buildProductionBundle() {
  const npmExecPath = process.env.npm_execpath;
  if (!npmExecPath) {
    throw new Error("npm_execpath is required to build the production fixture");
  }

  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [npmExecPath, "run", "build"], {
      cwd: appRoot,
      env: { ...process.env, NODE_ENV: "production" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Hub production build exited ${code}\n${output}`));
    });
  });
}

async function findLoopbackAssets(directory, matches = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const url = new URL(entry.name, directory);
    if (entry.isDirectory()) {
      await findLoopbackAssets(new URL(`${entry.name}/`, directory), matches);
      continue;
    }
    if (!entry.isFile() || !runtimeTextExtensions.has(extname(entry.name))) {
      continue;
    }
    const text = await readFile(url, "utf8");
    const match = text.match(forbiddenLoopback);
    if (match) {
      matches.push(
        `${relative(appRoot, fileURLToPath(url)).replaceAll("\\", "/")}: ${match[0]}`,
      );
    }
  }
  return matches;
}

test(
  "the real production bundle contains no loopback host literals",
  async () => {
    await buildProductionBundle();

    expect(await findLoopbackAssets(distRoot)).toEqual([]);
  },
  30_000,
);
