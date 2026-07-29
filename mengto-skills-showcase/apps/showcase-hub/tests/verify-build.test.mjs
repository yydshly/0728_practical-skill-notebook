import { Buffer } from "node:buffer";

import { expect, it } from "vitest";

import { inspectAssetInventory } from "../scripts/verify-build.mjs";

function seededBytes(length) {
  const bytes = Buffer.allocUnsafe(length);
  let state = 0x9e3779b9;
  for (let index = 0; index < length; index += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    bytes[index] = state & 0xff;
  }
  return bytes;
}

it("accepts a local-only build inside the JS and CSS gzip budgets", () => {
  expect(
    inspectAssetInventory([
      { path: "assets/index.js", bytes: Buffer.alloc(20_000) },
      { path: "assets/index.css", bytes: Buffer.alloc(10_000) },
      {
        path: "index.html",
        bytes: Buffer.from('<script src="./assets/index.js"></script>'),
      },
    ]),
  ).toEqual([]);
});

it.each([
  ["assets/three-runtime.js", "Three.js"],
  ["index.html", "https://cdn.example.test/app.js"],
  ["assets/index.js", "127.0.0.1:4173"],
])("rejects forbidden production content in %s", (path, content) => {
  expect(
    inspectAssetInventory([{ path, bytes: Buffer.from(content) }]),
  ).not.toEqual([]);
});

it("rejects gzip and preview totals beyond the fixed budgets", () => {
  expect(
    inspectAssetInventory([
      { path: "assets/oversize.js", bytes: seededBytes(90 * 1024) },
    ]),
  ).toContainEqual(expect.stringContaining("JavaScript gzip"));
  expect(
    inspectAssetInventory([
      { path: "previews/one.png", bytes: seededBytes(310 * 1024) },
      { path: "previews/two.png", bytes: seededBytes(310 * 1024) },
    ]),
  ).toContainEqual(expect.stringContaining("preview bytes"));
});
