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

  it("records exactly the approved skills with unique names and source paths", async () => {
    const selection = await readJson("../config/selected-skills.json");
    expect(selection.skills).toHaveLength(16);
    expect(new Set(selection.skills.map((skill) => skill.name)).size).toBe(16);
    for (const skill of selection.skills) {
      expect(skill.sourcePath).toBe(`agent-skills/game-development/${skill.name}`);
      expect(skill.products.length).toBeGreaterThan(0);
      expect(skill.phases.length).toBeGreaterThan(0);
    }
  });

  it("pins the upstream repository to a full commit SHA", async () => {
    const lock = await readJson("../config/skill-source-lock.json");
    expect(lock.repository).toBe("https://github.com/MengTo/Skills.git");
    expect(lock.branch).toBe("main");
    expect(lock.commit).toMatch(/^[0-9a-f]{40}$/);
  });
});
