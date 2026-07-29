import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const textExtensions = new Set([".html", ".js", ".css", ".json", ".map"]);
const forbiddenLoopback = /127\.0\.0\.1|localhost|\[::1\]/gi;
const remoteStart = /https?:\/\/|https?:\\\/\\\/|https?:\\u002f\\u002f|https?%3a%2f%2f/gi;
const hubThreeToken = /(?:^|[^a-z0-9])three(?:\.module)?(?:[^a-z0-9]|$)/i;
const productDirectories = new Set([
  "monster-forge",
  "ashfall-arena",
  "mech-atelier",
]);
const xhtmlNamespace = "http://www.w3.org/1999/xhtml";
const shaderCitation = "https://jcgt.org/published/0007/04/01/";
const requiredByDirectory = new Map([
  [".", ["./monster-forge/", "./ashfall-arena/", "./mech-atelier/"]],
  ["monster-forge", ["../"]],
  ["ashfall-arena", ["../"]],
  ["mech-atelier", ["../"]],
]);

function productAssetsJavaScript(relativePath) {
  return /^(monster-forge|ashfall-arena|mech-atelier)\/assets\/[^/]+\.js$/
    .test(relativePath);
}

function isXhtmlNamespaceContext(text, index) {
  const prefix = text.slice(Math.max(0, index - 256), index);
  const call = prefix.match(/createElementNS\s*\(\s*(["'`])$/);
  if (!call) return false;
  const suffix = text.slice(index + xhtmlNamespace.length);
  return suffix.startsWith(call[1])
    && /^\s*,/.test(suffix.slice(1));
}

function isShaderCitationContext(text, index) {
  const lineStart = text.lastIndexOf("\n", index - 1) + 1;
  if (!/\/\/[ \t]*$/.test(text.slice(lineStart, index))) return false;
  const following = text[index + shaderCitation.length] ?? "";
  if (following && !/[\t\n\f\r "'`]/.test(following)) return false;
  const nearby = text.slice(
    Math.max(0, index - 2_048),
    Math.min(text.length, index + 2_048),
  );
  return nearby.includes("importanceSampleGGX_VNDF");
}

function isAllowedInertThreeUrl(text, index, relativePath) {
  if (!productAssetsJavaScript(relativePath)) return false;
  if (
    text.startsWith(xhtmlNamespace, index)
    && isXhtmlNamespaceContext(text, index)
  ) {
    return true;
  }
  return text.startsWith(shaderCitation, index)
    && isShaderCitationContext(text, index);
}

function remoteTokenAt(text, index) {
  const match = text.slice(index).match(/^[^\s"'`<>{}\[\](),;]+/);
  return match?.[0] ?? text.slice(index, index + 64);
}

function remoteFailures(text, relativePath) {
  const failures = [];
  remoteStart.lastIndex = 0;
  for (let match = remoteStart.exec(text); match; match = remoteStart.exec(text)) {
    const token = match[0];
    if (
      (token.startsWith("http://") || token.startsWith("https://"))
      && isAllowedInertThreeUrl(text, match.index, relativePath)
    ) {
      continue;
    }
    failures.push(`forbidden remote URL ${remoteTokenAt(text, match.index)}`);
  }
  return failures;
}

export async function walkFiles(root, directory = root) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`symbolic links are forbidden in showcase output: ${path}`);
    }
    if (entry.isDirectory()) {
      files.push(...await walkFiles(root, path));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }
  return files;
}

export async function scanShowcaseText(root) {
  const failures = [];
  const textByDirectory = new Map(
    [...requiredByDirectory.keys()].map((directory) => [directory, ""]),
  );
  const indexTextByDirectory = new Map();
  const javascriptByDirectory = new Map(
    [...requiredByDirectory.keys()].map((directory) => [directory, ""]),
  );
  for (const path of await walkFiles(root)) {
    const relativePath = relative(root, path).replaceAll("\\", "/");
    const firstSegment = relativePath.split("/")[0];
    const directory = productDirectories.has(firstSegment) ? firstSegment : ".";
    if (directory === "." && hubThreeToken.test(relativePath)) {
      failures.push(`${relativePath}: forbidden Hub Three filename`);
    }
    if (!textExtensions.has(extname(path).toLowerCase())) continue;
    const text = await readFile(path, "utf8");
    if (extname(path).toLowerCase() === ".js") {
      javascriptByDirectory.set(
        directory,
        `${javascriptByDirectory.get(directory) ?? ""}\n${text}`,
      );
    }
    for (const match of text.matchAll(forbiddenLoopback)) {
      failures.push(`${relativePath}: forbidden loopback ${match[0]}`);
    }
    failures.push(...remoteFailures(text, relativePath).map((failure) =>
      `${relativePath}: ${failure}`));
    if (directory === "." && hubThreeToken.test(text)) {
      failures.push(`${relativePath}: forbidden Hub Three runtime`);
    }
    if (
      extname(path).toLowerCase() === ".html"
      && /target\s*=\s*(?:"_blank"|'_blank'|_blank(?=[\t\n\f\r />]|$))/i.test(text)
    ) {
      failures.push(`${relativePath}: target=_blank`);
    }
    textByDirectory.set(
      directory,
      `${textByDirectory.get(directory) ?? ""}\n${text}`,
    );
    const expectedIndex = directory === "."
      ? "index.html"
      : `${directory}/index.html`;
    if (relativePath === expectedIndex) indexTextByDirectory.set(directory, text);
  }
  for (const [directory, tokens] of requiredByDirectory) {
    const combinedText = textByDirectory.get(directory) ?? "";
    for (const token of tokens) {
      if (!combinedText.includes(token)) {
        failures.push(`${directory} is missing ${token}`);
      }
    }
    if (directory !== ".") {
      const javascript = javascriptByDirectory.get(directory) ?? "";
      if (!javascript.includes("product-")) {
        failures.push(`${directory} is missing product-`);
      }
      if (!javascript.includes(directory)) {
        failures.push(`${directory} is missing ${directory}`);
      }
    }
    const indexText = indexTextByDirectory.get(directory);
    if (indexText === undefined) {
      failures.push(`${directory} is missing index.html`);
    } else {
      if (!indexText.includes("./assets/")) {
        failures.push(`${directory} index is missing ./assets/`);
      }
      if (/=\s*(?:"\/assets\/|'\/assets\/|\/assets\/)/i.test(indexText)) {
        failures.push(`${directory} index uses forbidden /assets/`);
      }
    }
  }
  if (failures.length) {
    throw new Error(`invalid showcase production links:\n${failures.join("\n")}`);
  }
}
