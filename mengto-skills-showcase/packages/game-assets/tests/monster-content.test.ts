import { describe, expect, it } from "vitest";
import { monsters } from "../src/monsters/definitions";

describe("monster catalog", () => {
  it("contains four truthful procedural review assets", () => {
    expect(monsters.map((monster) => monster.id)).toEqual([
      "ash-warden",
      "glass-crawler",
      "bell-knight",
      "mire-hound",
    ]);

    for (const monster of monsters) {
      expect(monster.source.type).toBe("procedural");
      expect(monster.source.description).toContain("Project-authored Three.js geometry");
      expect(monster.previewPath).toBe(`/asset-catalog/monsters/${monster.id}.png`);
      expect(monster.actions).toEqual(["Idle", "Walk", "Attack", "Hit", "Death"]);
      expect(monster.bounds.width).toBeGreaterThan(0);
      expect(monster.bounds.height).toBeGreaterThan(0);
      expect(monster.bounds.depth).toBeGreaterThan(0);
      expect(monster.collider.radius).toBeGreaterThan(0);
      expect(monster.collider.height).toBeGreaterThan(0);
      expect(monster.sockets.length).toBeGreaterThan(0);
    }
  });

  it("keeps Chinese and English names while recording the factory silhouette", () => {
    expect(monsters.map(({ displayName, factoryId }) => ({ displayName, factoryId }))).toEqual([
      { displayName: "灰烬守卫 / Ash Warden", factoryId: "biped" },
      { displayName: "琉璃爬行者 / Glass Crawler", factoryId: "crawler" },
      { displayName: "钟甲骑士 / Bell Knight", factoryId: "armored" },
      { displayName: "泥沼猎犬 / Mire Hound", factoryId: "quadruped" },
    ]);
  });

  it("declares the procedural contract without claiming unshipped factories or PNGs", () => {
    for (const monster of monsters) {
      expect(monster.deliveryStatus).toBe("declared-not-shipped");
      expect(monster.source.description.startsWith("Project-authored Three.js geometry")).toBe(true);
      expect(monster.source.description).toContain("contract declared, runtime factory not shipped yet");
      expect(monster.source.description).toContain("previewPath is declared for a future catalog PNG");
    }
  });

  it("keeps authored content immutable at runtime", () => {
    expect(Object.isFrozen(monsters)).toBe(true);
    for (const monster of monsters) {
      expect(Object.isFrozen(monster)).toBe(true);
      expect(Object.isFrozen(monster.actions)).toBe(true);
      expect(Object.isFrozen(monster.sockets)).toBe(true);
      expect(Object.isFrozen(monster.bounds)).toBe(true);
      expect(Object.isFrozen(monster.collider)).toBe(true);
    }
  });
});
