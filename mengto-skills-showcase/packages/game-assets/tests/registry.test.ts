import { describe, expect, it } from "vitest";
import { AssetRegistry } from "../src/index";

const assets = [
  {
    id: "ash-warden",
    kind: "monster" as const,
    displayName: "Ash Warden",
    previewPath: "/assets/ash-warden.webp",
    source: { type: "procedural" as const, description: "由程序生成的演示模型" },
    animations: [],
    sockets: [],
    bounds: { width: 1, height: 2, depth: 1, groundOffset: 0 },
  },
  {
    id: "forge-hammer",
    kind: "weapon" as const,
    displayName: "Forge Hammer",
    previewPath: "/assets/forge-hammer.webp",
    source: { type: "imported" as const, description: "项目授权的演示资产" },
    animations: [],
    sockets: [],
    bounds: { width: 1, height: 1, depth: 2, groundOffset: 0 },
  },
];

describe("AssetRegistry", () => {
  it("gets an asset by id", () => {
    expect(new AssetRegistry(assets).get("ash-warden")).toEqual(assets[0]);
  });

  it("lists only assets of the requested kind", () => {
    expect(new AssetRegistry(assets).list("weapon")).toEqual([assets[1]]);
  });

  it("reports an unknown asset id clearly", () => {
    expect(() => new AssetRegistry(assets).get("missing")).toThrow("Unknown asset: missing");
  });
});
