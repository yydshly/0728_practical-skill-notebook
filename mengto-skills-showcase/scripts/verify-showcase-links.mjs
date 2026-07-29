import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const textExtensions = new Set([".html", ".js", ".css", ".json", ".map"]);
const forbiddenLoopback = /127\.0\.0\.1|localhost|\[::1\]/gi;
const jsUrlControl =
  String.raw`(?:[\t\n\r]|\\[tnr]|\\x0(?:9|a|d)|\\u000(?:9|a|d)|\\u\{0*(?:9|a|d)\})*`;
const jsUrlColon =
  String.raw`(?::|\\:|\\x3a|\\u003a|\\u\{0*3a\}|%3a)`;
const jsUrlSlash =
  String.raw`(?:\/|\\\/|\\x2f|\\u002f|\\u\{0*2f\}|%2f|\\\\|\\x5c|\\u005c|\\u\{0*5c\})`;
const remoteStart = new RegExp(
  `h${jsUrlControl}t${jsUrlControl}t${jsUrlControl}`
    + `p${jsUrlControl}s?${jsUrlControl}${jsUrlColon}`
    + `${jsUrlSlash}${jsUrlSlash}`,
  "gi",
);
const hubThreeToken = /(?:^|[^a-z0-9])three(?:\.module)?(?:[^a-z0-9]|$)/i;
const ASCII_WHITESPACE = /[\t\n\f\r ]/;
const htmlUrlAttributes = new Set([
  "action",
  "data",
  "formaction",
  "href",
  "imagesrcset",
  "ping",
  "poster",
  "src",
  "srcset",
]);
const htmlSrcsetAttributes = new Set(["imagesrcset", "srcset"]);
const htmlEntryAssetAttributes = new Set(["href", "src"]);
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

function readHtmlTag(html, start) {
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

function parseHtmlStartTag(source) {
  let index = 0;
  while (ASCII_WHITESPACE.test(source[index] ?? "")) index += 1;
  const nameStart = index;
  while (
    index < source.length
    && !ASCII_WHITESPACE.test(source[index])
    && source[index] !== "/"
  ) index += 1;
  const tagName = source.slice(nameStart, index).toLowerCase();
  const attributes = [];
  while (index < source.length) {
    while (ASCII_WHITESPACE.test(source[index] ?? "")) index += 1;
    if (source[index] === "/" || index >= source.length) break;
    const attributeStart = index;
    while (
      index < source.length
      && !ASCII_WHITESPACE.test(source[index])
      && !["=", "/"].includes(source[index])
    ) index += 1;
    const name = source.slice(attributeStart, index).toLowerCase();
    if (!name) {
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
        ) index += 1;
        value = source.slice(valueStart, index);
        if (value.endsWith("/")) value = value.slice(0, -1);
      }
    }
    attributes.push({ name, value });
  }
  return { tagName, attributes };
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
      && (
        ASCII_WHITESPACE.test(following ?? "")
        || following === "/"
        || following === ">"
      )
    ) return closeStart;
    closeStart = html.indexOf("<", closeStart + 1);
  }
  return -1;
}

function htmlStartTagAttributes(html) {
  const attributes = [];
  let index = 0;
  while (index < html.length) {
    const tagStart = html.indexOf("<", index);
    if (tagStart < 0) break;
    if (html.startsWith("<!--", tagStart)) {
      const commentEnd = html.indexOf("-->", tagStart + 4);
      index = commentEnd < 0 ? html.length : commentEnd + 3;
      continue;
    }
    const tag = readHtmlTag(html, tagStart);
    const trimmed = tag.source.trimStart();
    if (trimmed.startsWith("!") || trimmed.startsWith("?")) {
      index = tag.end;
      continue;
    }
    const closing = trimmed.startsWith("/");
    const parsed = parseHtmlStartTag(closing ? trimmed.slice(1) : trimmed);
    if (!closing) {
      attributes.push(...parsed.attributes);
      if (["script", "style"].includes(parsed.tagName)) {
        const closeStart = findRawTextCloseStart(html, parsed.tagName, tag.end);
        if (closeStart < 0) break;
        index = readHtmlTag(html, closeStart).end;
        continue;
      }
    }
    index = tag.end;
  }
  return attributes;
}

function decodeHtmlAttribute(value) {
  return value.replace(
    /&(?:#([0-9]+);?|#x([0-9a-f]+);?|(colon|sol|lowbar|amp|tab|newline);)/gi,
    (reference, decimal, hexadecimal, named) => {
      if (decimal || hexadecimal) {
        const codePoint = Number.parseInt(
          decimal ?? hexadecimal,
          decimal ? 10 : 16,
        );
        if (
          Number.isInteger(codePoint)
          && codePoint >= 0
          && codePoint <= 0x10ffff
          && !(codePoint >= 0xd800 && codePoint <= 0xdfff)
        ) return String.fromCodePoint(codePoint);
        return reference;
      }
      return {
        amp: "&",
        colon: ":",
        lowbar: "_",
        newline: "\n",
        sol: "/",
        tab: "\t",
      }[named.toLowerCase()];
    },
  );
}

const htmlUrlBase = new URL("https://showcase.invalid/__showcase_base__/");

function normalizeHtmlUrlValue(value) {
  return value
    .replace(/[\t\n\r]/g, "")
    .replace(/^[\u0000-\u0020]+|[\u0000-\u0020]+$/g, "");
}

function srcsetCandidates(value) {
  const candidates = [];
  let index = 0;
  while (index < value.length) {
    while (
      index < value.length
      && (ASCII_WHITESPACE.test(value[index]) || value[index] === ",")
    ) index += 1;
    if (index >= value.length) break;
    const start = index;
    const isDataUrl = value.slice(index, index + 5).toLowerCase() === "data:";
    while (
      index < value.length
      && !ASCII_WHITESPACE.test(value[index])
      && (isDataUrl || value[index] !== ",")
    ) index += 1;
    let candidate = value.slice(start, index);
    if (!isDataUrl) candidate = candidate.replace(/,+$/, "");
    if (candidate) candidates.push(candidate);
    while (index < value.length && value[index] !== ",") index += 1;
    if (value[index] === ",") index += 1;
  }
  return candidates;
}

function htmlAttributeUrls(name, value) {
  if (htmlSrcsetAttributes.has(name)) return srcsetCandidates(value);
  if (name === "ping") return value.split(ASCII_WHITESPACE).filter(Boolean);
  return [value];
}

function urlAttributeFailures(value) {
  const failures = [];
  const url = normalizeHtmlUrlValue(value);
  if (!url) return failures;
  let parsed;
  try {
    parsed = new URL(url, htmlUrlBase);
  } catch {
    return failures;
  }
  const isHttp = parsed.protocol === "http:" || parsed.protocol === "https:";
  const isNetworkPath = /^(?:\/|\\){2}/.test(url);
  if (
    isHttp
    && (
      /^https?:/i.test(url)
      || isNetworkPath
      || parsed.origin !== htmlUrlBase.origin
    )
  ) {
    failures.push(`forbidden remote URL ${url}`);
  }
  if (parsed.origin === htmlUrlBase.origin && parsed.pathname.startsWith("/assets/")) {
    failures.push("uses forbidden /assets/");
  }
  return failures;
}

function htmlAttributeFailures(attributes) {
  const failures = [];
  for (const { name, value } of attributes) {
    const decoded = decodeHtmlAttribute(value);
    if (name === "target" && decoded.toLowerCase() === "_blank") {
      failures.push("target=_blank");
    }
    if (!htmlUrlAttributes.has(name)) continue;
    for (const url of htmlAttributeUrls(name, decoded)) {
      failures.push(...urlAttributeFailures(url));
    }
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
    if (extname(path).toLowerCase() === ".html") {
      const attributes = htmlStartTagAttributes(text);
      failures.push(...htmlAttributeFailures(attributes).map((failure) =>
        `${relativePath}: ${failure}`));
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
      const entryAsset = htmlStartTagAttributes(indexText).some(({ name, value }) =>
        htmlEntryAssetAttributes.has(name)
        && normalizeHtmlUrlValue(decodeHtmlAttribute(value)).startsWith("./assets/"));
      if (!entryAsset) {
        failures.push(`${directory} index is missing ./assets/`);
      }
    }
  }
  if (failures.length) {
    throw new Error(`invalid showcase production links:\n${failures.join("\n")}`);
  }
}
