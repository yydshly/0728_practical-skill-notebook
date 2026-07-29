import { gzipSync } from "node:zlib";
import { readdir, readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const distDirectory = fileURLToPath(new URL("../dist/", import.meta.url));
const assetsDirectory = path.join(distDirectory, "assets");
const indexPath = path.join(distDirectory, "index.html");
const kibibytes = (bytes) => `${(bytes / 1024).toFixed(2)} KiB`;

const indexHtml = await readFile(indexPath, "utf8");
const referencedAssets = Array.from(
  indexHtml.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g),
  ([, assetPath]) => assetPath,
);

if (referencedAssets.length === 0) {
  throw new Error("index.html 没有引用任何生产资源。");
}

for (const assetPath of referencedAssets) {
  const resolvedPath = path.resolve(
    distDirectory,
    `.${assetPath}`,
  );
  const relativePath = path.relative(distDirectory, resolvedPath);
  if (
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`生产资源路径越界：${assetPath}`);
  }
  await stat(resolvedPath);
}

const assetNames = await readdir(assetsDirectory);
const measuredAssets = await Promise.all(
  assetNames
    .filter((name) => name.endsWith(".js") || name.endsWith(".css"))
    .sort()
    .map(async (name) => {
      const content = await readFile(path.join(assetsDirectory, name));
      return {
        name,
        kind: name.endsWith(".js") ? "js" : "css",
        rawBytes: content.byteLength,
        gzipBytes: gzipSync(content).byteLength,
      };
    }),
);

const jsAssets = measuredAssets.filter(({ kind }) => kind === "js");
const cssAssets = measuredAssets.filter(({ kind }) => kind === "css");
const total = (assets, key) =>
  assets.reduce((sum, asset) => sum + asset[key], 0);

const budgets = {
  maxJavascriptChunkBytes: 500 * 1024,
  totalJavascriptGzipBytes: 190 * 1024,
  totalCssGzipBytes: 8 * 1024,
};

if (jsAssets.length < 2) {
  throw new Error("JavaScript 未形成真实分包。");
}
for (const asset of jsAssets) {
  if (asset.rawBytes > budgets.maxJavascriptChunkBytes) {
    throw new Error(
      `${asset.name} 原始体积 ${kibibytes(asset.rawBytes)} 超过 500 KiB。`,
    );
  }
}

const javascriptGzipBytes = total(jsAssets, "gzipBytes");
const cssGzipBytes = total(cssAssets, "gzipBytes");
if (javascriptGzipBytes > budgets.totalJavascriptGzipBytes) {
  throw new Error(
    `JavaScript gzip 总量 ${kibibytes(javascriptGzipBytes)} 超过 190 KiB。`,
  );
}
if (cssGzipBytes > budgets.totalCssGzipBytes) {
  throw new Error(
    `CSS gzip 总量 ${kibibytes(cssGzipBytes)} 超过 8 KiB。`,
  );
}

console.log("Ashfall Arena 生产包预算通过：");
for (const asset of measuredAssets) {
  console.log(
    `- ${asset.name}: raw ${kibibytes(asset.rawBytes)}, gzip ${kibibytes(asset.gzipBytes)}`,
  );
}
console.log(
  `- JavaScript gzip 合计：${kibibytes(javascriptGzipBytes)} / 190.00 KiB`,
);
console.log(
  `- CSS gzip 合计：${kibibytes(cssGzipBytes)} / 8.00 KiB`,
);
