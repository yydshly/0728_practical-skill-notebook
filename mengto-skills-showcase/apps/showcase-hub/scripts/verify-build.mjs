import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

const limits = {
  javascriptGzip: 75 * 1024,
  cssGzip: 20 * 1024,
  previewBytes: 600 * 1024,
};
const forbiddenText = [
  /https?:\/\//i,
  /\bthree(?:\.module)?\b/i,
  /127\.0\.0\.1|localhost|\[::1\]/i,
];

export function inspectAssetInventory(assets) {
  const issues = [];
  let javascriptGzip = 0;
  let cssGzip = 0;
  let previewBytes = 0;
  for (const asset of assets) {
    const normalizedPath = asset.path.replaceAll("\\", "/");
    const extension = extname(normalizedPath).toLowerCase();
    if (extension === ".js") {
      javascriptGzip += gzipSync(asset.bytes).byteLength;
    }
    if (extension === ".css") {
      cssGzip += gzipSync(asset.bytes).byteLength;
    }
    if (/^previews\/[^/]+\.png$/i.test(normalizedPath)) {
      previewBytes += asset.bytes.byteLength;
    }
    if ([".html", ".js", ".css"].includes(extension)) {
      const text = asset.bytes.toString("utf8");
      for (const pattern of forbiddenText) {
        if (pattern.test(normalizedPath) || pattern.test(text)) {
          issues.push(
            `${normalizedPath} contains forbidden runtime text ${pattern}`,
          );
        }
      }
    }
  }
  if (javascriptGzip > limits.javascriptGzip) {
    issues.push(
      `JavaScript gzip ${javascriptGzip} exceeds ${limits.javascriptGzip}`,
    );
  }
  if (cssGzip > limits.cssGzip) {
    issues.push(`CSS gzip ${cssGzip} exceeds ${limits.cssGzip}`);
  }
  if (previewBytes >= limits.previewBytes) {
    issues.push(
      `preview bytes ${previewBytes} must stay below ${limits.previewBytes}`,
    );
  }
  return issues;
}

async function collectAssets(rootDirectory, directory = rootDirectory) {
  const assets = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      assets.push(...(await collectAssets(rootDirectory, absolutePath)));
    } else if (entry.isFile()) {
      assets.push({
        path: relative(rootDirectory, absolutePath).replaceAll("\\", "/"),
        bytes: await readFile(absolutePath),
      });
    }
  }
  return assets;
}

export async function inspectHubBuild(distDir) {
  return inspectAssetInventory(await collectAssets(resolve(distDir)));
}

const invokedDirectly =
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (invokedDirectly) {
  const distDir =
    process.argv[2] ?? fileURLToPath(new URL("../dist/", import.meta.url));
  const issues = await inspectHubBuild(distDir);
  if (issues.length > 0) {
    throw new Error(
      `Hub build verification failed:\n- ${issues.join("\n- ")}`,
    );
  }
}
