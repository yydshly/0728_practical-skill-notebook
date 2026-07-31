import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  CAPTURE_VIEWPORT,
  ORIGINAL_SCROLL_STOPS,
  RECORDINGS,
  SHOWCASE_SCROLL_STOPS,
  UPSTREAM_COMMIT,
  UPSTREAM_REPOSITORY_VERSION,
  assertGifFile,
  assertLegacySource,
  buildScrollFrames,
  resolveStaticAsset,
} from "../scripts/lib/r3f-scroll-rig-recording.mjs";

test("recording contract pins source, outputs, viewport, and story stops", () => {
  assert.equal(UPSTREAM_COMMIT, "adf7d47ea5bf3d8e8cf957b0f3667bea752e5f63");
  assert.equal(UPSTREAM_REPOSITORY_VERSION, "7.0.7");
  assert.deepEqual(CAPTURE_VIEWPORT, { width: 960, height: 640 });
  assert.deepEqual(RECORDINGS.map(({ output }) => output), [
    "docs/demos/08-r3f-scroll-rig-original.gif",
    "docs/demos/08-r3f-scroll-rig-lighthouse.gif",
  ]);
  assert.deepEqual(ORIGINAL_SCROLL_STOPS, [0, 720, 1440, 2280]);
  assert.deepEqual(SHOWCASE_SCROLL_STOPS, [0, 1100, 2200, 3800]);
});

test("GIF validation rejects a non-GIF artifact", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "r3f-gif-test-"));
  try {
    const invalid = path.join(directory, "invalid.gif");
    await writeFile(invalid, "not a gif");
    await assert.rejects(() => assertGifFile(invalid), /GIF artifact is invalid/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("legacy source validation requires the pinned commit and versions", () => {
  const source = {
    legacyDir: "C:/temporary/r3f-scroll-rig",
    head: UPSTREAM_COMMIT,
    repositoryVersion: UPSTREAM_REPOSITORY_VERSION,
    resolvedVersion: "8.15.0",
  };
  assert.doesNotThrow(() => assertLegacySource(source));
  assert.throws(
    () => assertLegacySource({ ...source, head: "wrong-commit" }),
    /legacy source commit/,
  );
  assert.throws(
    () => assertLegacySource({ ...source, repositoryVersion: "7.0.6" }),
    /legacy source repository version/,
  );
  assert.throws(
    () => assertLegacySource({ ...source, resolvedVersion: "latest" }),
    /legacy source resolved version/,
  );
});

test("four story stops become a forty-frame eight-second sequence", () => {
  const frames = buildScrollFrames([0, 720, 1440, 2280], 10);
  assert.equal(frames.length, 40);
  assert.equal(frames[0], 0);
  assert.equal(frames[9], 0);
  assert.equal(frames.at(-1), 2280);
  assert.ok(frames.every((value, index) => index === 0 || value >= frames[index - 1]));
});

test("static server resolves files inside the historical build only", () => {
  const buildDir = path.resolve("legacy/build");
  assert.equal(
    resolveStaticAsset(buildDir, "/static/js/main.js"),
    path.join(buildDir, "static", "js", "main.js"),
  );
  assert.equal(resolveStaticAsset(buildDir, "/"), path.join(buildDir, "index.html"));
  assert.throws(
    () => resolveStaticAsset(buildDir, "/../package.json"),
    /outside historical build/,
  );
});
