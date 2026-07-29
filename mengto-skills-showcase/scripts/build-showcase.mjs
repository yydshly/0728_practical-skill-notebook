import { execFile } from "node:child_process";
import {
  cp,
  lstat,
  mkdir,
  readFile,
  rm,
} from "node:fs/promises";
import { platform } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { scanShowcaseText } from "./verify-showcase-links.mjs";

const execFileAsync = promisify(execFile);
const defaultWorkspaceRoot = fileURLToPath(new URL("../", import.meta.url));
const ASCII_WHITESPACE = /[\t\n\f\r ]/;
const windowsReparseQuery = [
  "& {",
  "param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Paths)",
  "$ErrorActionPreference='Stop'",
  "foreach($path in $Paths){",
  "$item=Get-Item -Force -LiteralPath $path -ErrorAction Stop",
  "if(($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0){",
  "throw ('reparse point: '+$path)",
  "}",
  "}",
  "}",
].join(";");

export function assertSafeShowcaseTarget(root, target) {
  const expected = resolve(root, "dist", "showcase");
  const actual = resolve(target);
  if (actual !== expected) {
    throw new Error(`refusing to clean showcase target: ${actual}`);
  }
  return actual;
}

export function showcaseBuildJobs() {
  return [
    {
      id: "showcase-hub",
      marker: '<meta name="showcase-app" content="showcase-hub">',
      workspace: "@showcase/hub",
      source: "apps/showcase-hub/dist",
      destination: ".",
      env: {
        VITE_APP_BASE: "./",
        VITE_MONSTER_FORGE_URL: "./monster-forge/",
        VITE_ASHFALL_ARENA_URL: "./ashfall-arena/",
        VITE_MECH_ATELIER_URL: "./mech-atelier/",
      },
    },
    ...["monster-forge", "ashfall-arena", "mech-atelier"].map((id) => ({
      id,
      marker: `<meta name="showcase-app" content="${id}">`,
      workspace: `@showcase/${id}`,
      source: `apps/${id}/dist`,
      destination: id,
      env: { VITE_APP_BASE: "./", VITE_SHOWCASE_HUB_URL: "../" },
    })),
  ];
}

async function runWorkspaceBuild(job, root) {
  const npmExecPath = process.env.npm_execpath;
  if (!npmExecPath) {
    throw new Error("buildShowcase must be launched with npm run build:showcase");
  }
  await execFileAsync(
    process.execPath,
    [npmExecPath, "run", "build", "--workspace", job.workspace],
    {
      cwd: root,
      env: { ...process.env, ...job.env },
      windowsHide: true,
    },
  );
}

async function inspectTarget(root, safeTarget) {
  assertSafeShowcaseTarget(root, safeTarget);
  const chain = [resolve(root), resolve(root, "dist"), safeTarget];
  const existing = [];
  for (const [index, path] of chain.entries()) {
    let stats;
    try {
      stats = await lstat(path);
    } catch (error) {
      if (error?.code === "ENOENT" && index > 0) continue;
      throw new Error(`unsafe showcase path inspection failed: ${path}`, {
        cause: error,
      });
    }
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      throw new Error(`unsafe showcase path is not an ordinary directory: ${path}`);
    }
    existing.push(path);
  }
  if (platform() === "win32") {
    try {
      await execFileAsync(
        "powershell.exe",
        [
          "-NoLogo",
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          windowsReparseQuery,
          ...existing,
        ],
        { windowsHide: true },
      );
    } catch (error) {
      throw new Error("unsafe showcase path reparse-point query failed", {
        cause: error,
      });
    }
  }
}

async function removeExactTarget(target) {
  await rm(target, { recursive: true, force: true });
}

function readTag(html, start) {
  let quote;
  for (let index = start + 1; index < html.length; index += 1) {
    const character = html[index];
    if (quote) {
      if (character === quote) quote = undefined;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (character === ">") {
      return { source: html.slice(start + 1, index), end: index + 1 };
    }
  }
  return { source: html.slice(start + 1), end: html.length };
}

function parseStartTag(source) {
  let index = 0;
  while (ASCII_WHITESPACE.test(source[index] ?? "")) index += 1;
  const nameStart = index;
  while (
    index < source.length
    && !ASCII_WHITESPACE.test(source[index])
    && !["/", ">"].includes(source[index])
  ) index += 1;
  const tagName = source.slice(nameStart, index).toLowerCase();
  const attributes = new Map();
  let ambiguous = false;
  while (index < source.length) {
    while (ASCII_WHITESPACE.test(source[index] ?? "")) index += 1;
    if (source[index] === "/" || index >= source.length) break;
    const attributeStart = index;
    while (
      index < source.length
      && !ASCII_WHITESPACE.test(source[index])
      && !["=", "/", ">"].includes(source[index])
    ) index += 1;
    const attributeName = source.slice(attributeStart, index).toLowerCase();
    if (!attributeName) {
      index += 1;
      continue;
    }
    while (ASCII_WHITESPACE.test(source[index] ?? "")) index += 1;
    let value = "";
    if (source[index] === "=") {
      index += 1;
      while (ASCII_WHITESPACE.test(source[index] ?? "")) index += 1;
      const quote = source[index];
      if (quote === "'" || quote === '"') {
        index += 1;
        const valueStart = index;
        while (index < source.length && source[index] !== quote) index += 1;
        value = source.slice(valueStart, index);
        if (source[index] === quote) index += 1;
      } else {
        const valueStart = index;
        while (
          index < source.length
          && !ASCII_WHITESPACE.test(source[index])
          && !["/", ">"].includes(source[index])
        ) index += 1;
        value = source.slice(valueStart, index);
      }
    }
    if (attributes.has(attributeName)) ambiguous = true;
    else attributes.set(attributeName, value);
  }
  return { tagName, attributes, ambiguous };
}

function hasAsciiTagNameAt(html, start, tagName) {
  for (let offset = 0; offset < tagName.length; offset += 1) {
    const character = html.charCodeAt(start + offset);
    const lowercase = tagName.charCodeAt(offset);
    if (character !== lowercase && character !== lowercase - 32) return false;
  }
  return true;
}

function findRawTextCloseStart(html, tagName, start) {
  let closeStart = html.indexOf("<", start);
  while (closeStart >= 0) {
    const nameStart = closeStart + 2;
    const following = html[nameStart + tagName.length];
    if (
      html[closeStart + 1] === "/"
      && hasAsciiTagNameAt(html, nameStart, tagName)
      && (ASCII_WHITESPACE.test(following ?? "") || following === "/" || following === ">")
    ) return closeStart;
    closeStart = html.indexOf("<", closeStart + 1);
  }
  return -1;
}

function showcaseMetaContents(html) {
  const contents = [];
  let index = 0;
  while (index < html.length) {
    const tagStart = html.indexOf("<", index);
    if (tagStart < 0) break;
    if (html.startsWith("<!--", tagStart)) {
      const commentEnd = html.indexOf("-->", tagStart + 4);
      index = commentEnd < 0 ? html.length : commentEnd + 3;
      continue;
    }
    const tag = readTag(html, tagStart);
    const trimmed = tag.source.trimStart();
    if (trimmed.startsWith("!") || trimmed.startsWith("?")) {
      index = tag.end;
      continue;
    }
    const closing = trimmed.startsWith("/");
    const parsed = parseStartTag(closing ? trimmed.slice(1) : trimmed);
    if (!closing && ["script", "style"].includes(parsed.tagName)) {
      const closeStart = findRawTextCloseStart(html, parsed.tagName, tag.end);
      if (closeStart < 0) break;
      index = readTag(html, closeStart).end;
      continue;
    }
    if (!closing && parsed.tagName === "meta" && !parsed.ambiguous) {
      const name = parsed.attributes.get("name");
      if (name?.toLowerCase() === "showcase-app") {
        contents.push(parsed.attributes.has("content")
          ? parsed.attributes.get("content")
          : undefined);
      }
    }
    index = tag.end;
  }
  return contents;
}

async function validateCopiedIndexes(jobs, safeTarget) {
  for (const job of jobs) {
    const indexPath = job.destination === "."
      ? join(safeTarget, "index.html")
      : join(safeTarget, job.destination, "index.html");
    const contents = showcaseMetaContents(await readFile(indexPath, "utf8"));
    if (contents.length !== 1 || contents[0] !== job.id) {
      throw new Error(
        `${job.id} index has invalid showcase-app marker: ${JSON.stringify(contents)}`,
      );
    }
  }
}

export async function buildShowcase({
  root = defaultWorkspaceRoot,
  target = join(root, "dist", "showcase"),
  runBuild = runWorkspaceBuild,
  copyEntry = cp,
  scan = scanShowcaseText,
  inspectTarget: inspect = inspectTarget,
  removeExactTarget: remove = removeExactTarget,
} = {}) {
  const safeTarget = assertSafeShowcaseTarget(root, target);
  try {
    await inspect(root, safeTarget);
    await remove(safeTarget);
    const jobs = showcaseBuildJobs();
    for (const job of jobs) {
      await runBuild(job, root);
      const source = resolve(root, job.source);
      const destination = job.destination === "."
        ? safeTarget
        : join(safeTarget, job.destination);
      await inspect(root, safeTarget);
      await mkdir(destination, { recursive: true });
      await inspect(root, safeTarget);
      await copyEntry(source, destination, {
        recursive: true,
        force: true,
        errorOnExist: false,
      });
    }
    await validateCopiedIndexes(jobs, safeTarget);
    await scan(safeTarget);
    return safeTarget;
  } catch (originalError) {
    try {
      const cleanupTarget = assertSafeShowcaseTarget(root, safeTarget);
      await inspect(root, cleanupTarget);
      await remove(cleanupTarget);
    } catch (cleanupError) {
      throw new AggregateError(
        [originalError, cleanupError],
        "showcase build failed and exact-target cleanup failed",
        { cause: originalError },
      );
    }
    throw originalError;
  }
}

const invokedDirectly = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (invokedDirectly) await buildShowcase();
