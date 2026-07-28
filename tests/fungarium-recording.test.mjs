import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  RECORDINGS,
  UPSTREAM_COMMIT,
  assertNoTrackedUpstreamFiles,
  assertGifFile,
  commandInvocation,
  resolveChromium,
} from "../scripts/lib/fungarium-recording.mjs";

test("recording manifest pins the upstream comparison and both committed GIF paths", () => {
  assert.equal(UPSTREAM_COMMIT, "a139bd08fc64cf0be76bd1dae447da6848d89899");
  assert.deepEqual(RECORDINGS.map(({ output }) => output), [
    "docs/demos/05-fungarium-original.gif",
    "docs/demos/05-fungarium-product-showcase.gif",
  ]);
});

test("assertGifFile rejects an empty or non-GIF artifact", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "fungarium-gif-test-"));
  try {
    const invalid = path.join(directory, "invalid.gif");
    await writeFile(invalid, "not a gif");
    await assert.rejects(() => assertGifFile(invalid), /GIF/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("npm uses a shell invocation on Windows", () => {
  const invocation = commandInvocation("npm");
  assert.equal(invocation.command, "npm.cmd");
  assert.equal(invocation.shell, true);
});

test("resolveChromium accepts Playwright's CommonJS default export shape", () => {
  const chromium = { launch: () => undefined };
  assert.equal(resolveChromium({ default: { chromium } }), chromium);
});

test("tracked upstream source paths are rejected while GIF artifacts remain allowed", () => {
  assert.throws(
    () => assertNoTrackedUpstreamFiles(["artifacts/fungarium-upstream-run/src/main.jsx"]),
    /upstream checkout/,
  );
  assert.doesNotThrow(() => {
    assertNoTrackedUpstreamFiles(["docs/demos/05-fungarium-original.gif"]);
  });
});
