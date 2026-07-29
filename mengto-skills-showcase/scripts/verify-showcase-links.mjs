import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const textExtensions = new Set([".html", ".js", ".css", ".json", ".map"]);
const forbiddenLoopback = /127\.0\.0\.1|localhost|\[::1\]/gi;
const jsUrlControlAtom =
  String.raw`(?:[\t\n\r]|\\[tnr]|\\x0(?:9|[aA]|[dD])|\\u000(?:9|[aA]|[dD])|\\u\{0*(?:9|[aA]|[dD])\}|\\(?:\r\n|[\n\r\u2028\u2029]))`;
const jsUrlControl = `(?:${jsUrlControlAtom})*`;
const jsUrlLetterAtoms = {
  h: String.raw`(?:[hH]|\\[hH]|\\x(?:68|48)|\\u(?:0068|0048)|\\u\{0*(?:68|48)\})`,
  t: String.raw`(?:[tT]|\\T|\\x(?:74|54)|\\u(?:0074|0054)|\\u\{0*(?:74|54)\})`,
  p: String.raw`(?:[pP]|\\[pP]|\\x(?:70|50)|\\u(?:0070|0050)|\\u\{0*(?:70|50)\})`,
  s: String.raw`(?:[sS]|\\[sS]|\\x(?:73|53)|\\u(?:0073|0053)|\\u\{0*(?:73|53)\})`,
};
const jsUrlColon =
  String.raw`(?::|\\:|\\x3[aA]|\\u003[aA]|\\u\{0*3[aA]\}|%3[aA])`;
const jsUrlSlash =
  String.raw`(?:\/|\\\/|\\x2[fF]|\\u002[fF]|\\u\{0*2[fF]\}|%2[fF]|\\\\|\\x5[cC]|\\u005[cC]|\\u\{0*5[cC]\})`;
const remoteStart = new RegExp(
  `${jsUrlLetterAtoms.h}${jsUrlControl}${jsUrlLetterAtoms.t}${jsUrlControl}`
    + `${jsUrlLetterAtoms.t}${jsUrlControl}${jsUrlLetterAtoms.p}${jsUrlControl}`
    + `(?:${jsUrlLetterAtoms.s})?${jsUrlControl}${jsUrlColon}${jsUrlControl}`
    + `${jsUrlSlash}${jsUrlControl}${jsUrlSlash}`,
  "g",
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
const MAX_SRCDOC_DEPTH = 8;
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
    if (index >= source.length) break;
    if (source[index] === "/") {
      index += 1;
      continue;
    }
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
      }
    }
    if (!attributes.some((attribute) => attribute.name === name)) {
      attributes.push({ name, value });
    }
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

export function findHtmlCommentEnd(html, start) {
  const contentStart = start + 4;
  if (html[contentStart] === ">") return contentStart + 1;
  if (html[contentStart] === "-" && html[contentStart + 1] === ">") {
    return contentStart + 2;
  }
  for (let index = contentStart; index < html.length; index += 1) {
    if (html.startsWith("-->", index)) return index + 3;
    if (html.startsWith("--!>", index)) return index + 4;
  }
  return html.length;
}

function htmlStartTags(html) {
  const startTags = [];
  let index = 0;
  while (index < html.length) {
    const tagStart = html.indexOf("<", index);
    if (tagStart < 0) break;
    if (html.startsWith("<!--", tagStart)) {
      index = findHtmlCommentEnd(html, tagStart);
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
      startTags.push(parsed);
      if (["script", "style"].includes(parsed.tagName)) {
        const closeStart = findRawTextCloseStart(html, parsed.tagName, tag.end);
        if (closeStart < 0) break;
        index = readHtmlTag(html, closeStart).end;
        continue;
      }
    }
    index = tag.end;
  }
  return startTags;
}

function htmlStartTagAttributes(html) {
  return htmlStartTags(html).flatMap(({ attributes }) => attributes);
}

const htmlNamedCharacterReferences = [
  ["NewLine", "\n"],
  ["lowbar", "_"],
  ["colon", ":"],
  ["apos", "'"],
  ["bsol", "\\"],
  ["quot", '"'],
  ["QUOT", '"'],
  ["amp", "&"],
  ["AMP", "&"],
  ["sol", "/"],
  ["Tab", "\t"],
  ["gt", ">"],
  ["GT", ">"],
  ["lt", "<"],
  ["LT", "<"],
];
const legacyHtmlNamedCharacterReferences = htmlNamedCharacterReferences
  .filter(([name]) => ["amp", "AMP", "gt", "GT", "lt", "LT", "quot", "QUOT"]
    .includes(name));

function decodeHtmlAttribute(value) {
  let decoded = "";
  let index = 0;
  while (index < value.length) {
    if (value[index] !== "&") {
      decoded += value[index];
      index += 1;
      continue;
    }

    const numeric = value.slice(index).match(/^&#(?:x([0-9a-f]+)|([0-9]+));?/i);
    if (numeric) {
      const codePoint = Number.parseInt(
        numeric[1] ?? numeric[2],
        numeric[1] ? 16 : 10,
      );
      decoded += (
        codePoint === 0
        || codePoint > 0x10ffff
        || (codePoint >= 0xd800 && codePoint <= 0xdfff)
      )
        ? "\ufffd"
        : String.fromCodePoint(codePoint);
      index += numeric[0].length;
      continue;
    }

    const exact = htmlNamedCharacterReferences.find(([name]) =>
      value.startsWith(`&${name};`, index));
    if (exact) {
      decoded += exact[1];
      index += exact[0].length + 2;
      continue;
    }

    const legacy = legacyHtmlNamedCharacterReferences.find(([name]) => {
      if (!value.startsWith(`&${name}`, index)) return false;
      const following = value[index + name.length + 1] ?? "";
      return !/[a-z0-9=]/i.test(following);
    });
    if (legacy) {
      decoded += legacy[1];
      index += legacy[0].length + 1;
      continue;
    }

    decoded += "&";
    index += 1;
  }
  return decoded;
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
    while (
      index < value.length
      && !ASCII_WHITESPACE.test(value[index])
    ) index += 1;
    const url = value.slice(start, index);
    if (url.endsWith(",")) {
      const candidate = url.replace(/,+$/, "");
      if (candidate) candidates.push(candidate);
      continue;
    }
    if (url) candidates.push(url);

    let state = "in descriptor";
    while (index < value.length) {
      const character = value[index];
      if (state === "in descriptor") {
        if (ASCII_WHITESPACE.test(character)) {
          state = "after descriptor";
        } else if (character === ",") {
          index += 1;
          break;
        } else if (character === "(") {
          state = "in parens";
        }
      } else if (state === "in parens") {
        if (character === ")") state = "in descriptor";
      } else if (ASCII_WHITESPACE.test(character)) {
        // Remain after the descriptor.
      } else if (character === ",") {
        index += 1;
        break;
      } else if (character === "(") {
        state = "in parens";
      } else {
        state = "in descriptor";
      }
      index += 1;
    }
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

function htmlDocumentFailures(html, relativePath, srcdocDepth = 0) {
  const failures = remoteFailures(html, relativePath);
  for (const { tagName, attributes } of htmlStartTags(html)) {
    failures.push(...htmlAttributeFailures(attributes, relativePath));
    if (tagName !== "iframe") continue;
    const srcdoc = attributes.find(({ name }) => name === "srcdoc");
    if (!srcdoc) continue;
    if (srcdocDepth >= MAX_SRCDOC_DEPTH) {
      failures.push(
        `srcdoc nesting depth exceeds defensive limit ${MAX_SRCDOC_DEPTH}`,
      );
      continue;
    }
    failures.push(...htmlDocumentFailures(
      decodeHtmlAttribute(srcdoc.value),
      relativePath,
      srcdocDepth + 1,
    ));
  }
  return failures;
}

function htmlAttributeFailures(attributes, relativePath) {
  const failures = [];
  for (const { name, value } of attributes) {
    if (name === "srcdoc") continue;
    const decoded = decodeHtmlAttribute(value);
    failures.push(...remoteFailures(decoded, relativePath));
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
    if (extname(path).toLowerCase() === ".html") {
      failures.push(...htmlDocumentFailures(text, relativePath).map((failure) =>
        `${relativePath}: ${failure}`));
    } else {
      failures.push(...remoteFailures(text, relativePath).map((failure) =>
        `${relativePath}: ${failure}`));
    }
    if (directory === "." && hubThreeToken.test(text)) {
      failures.push(`${relativePath}: forbidden Hub Three runtime`);
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
