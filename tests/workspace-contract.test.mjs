import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));

describe("showcase workspace", () => {
  it("declares three independent apps and five shared package workspaces", async () => {
    const manifest = await readJson("../package.json");
    expect(manifest.workspaces).toEqual(["apps/*", "packages/*"]);
    expect(manifest.scripts).toMatchObject({
      validate: "node scripts/validate-workspace.mjs",
      test: "vitest run",
      build: "npm run build --workspaces --if-present",
    });
  });

  it.each([
    ["monster-forge", "@showcase/monster-forge"],
    ["ashfall-arena", "@showcase/ashfall-arena"],
    ["mech-atelier", "@showcase/mech-atelier"],
  ])("keeps %s independently addressable", async (folder, name) => {
    const manifest = await readJson(`../apps/${folder}/package.json`);
    expect(manifest.name).toBe(name);
    expect(manifest.private).toBe(true);
  });
});
