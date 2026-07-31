import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  SHOWCASE_DEPENDENCY_VERSION,
  SHOWCASE_DIRECTORY,
  assertNoTrackedResearchTrees,
  validateShowcase,
} from "../scripts/lib/r3f-project-eight.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("project 08 is a standalone lighthouse showcase pinned to scroll-rig 8.15.0", async () => {
  assert.equal(SHOWCASE_DIRECTORY, "r3f-scroll-rig-showcase");
  assert.equal(SHOWCASE_DEPENDENCY_VERSION, "8.15.0");
  await validateShowcase(rootDir);
});

test("nested research repositories and generated folders are forbidden", () => {
  assert.throws(
    () => assertNoTrackedResearchTrees(["r3f-scroll-rig-research/.git/config"]),
    /forbidden project-08 path/,
  );
  assert.throws(
    () => assertNoTrackedResearchTrees(["r3f-scroll-rig-showcase/node_modules/vite/index.js"]),
    /forbidden project-08 path/,
  );
  assert.doesNotThrow(() =>
    assertNoTrackedResearchTrees(["r3f-scroll-rig-showcase/src/App.jsx"]),
  );
});
