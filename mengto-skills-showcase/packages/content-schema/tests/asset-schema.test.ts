import { describe, expect, it } from "vitest";
import { parseAssetManifest } from "../src/index";

const validAsset = {
  id: "ash-warden",
  kind: "monster",
  displayName: "Ash Warden",
  previewPath: "/assets/ash-warden.webp",
  source: { type: "procedural", description: "由程序生成的演示模型" },
  animations: [{ name: "idle", durationSeconds: 1.25 }],
  sockets: [{ name: "weapon", bone: "hand_r" }],
  bounds: { width: 1, height: 2, depth: 1, groundOffset: 0 },
};

describe("parseAssetManifest", () => {
  it("returns a complete public asset manifest", () => {
    expect(parseAssetManifest(validAsset)).toEqual(validAsset);
  });

  it("rejects an asset without truthful provenance", () => {
    expect(() => parseAssetManifest({
      ...validAsset,
      source: { type: "procedural" },
    })).toThrow("source.description");
  });

  it.each([
    ["id", { ...validAsset, id: "" }],
    ["kind", { ...validAsset, kind: "vehicle" }],
    ["displayName", { ...validAsset, displayName: "" }],
    ["previewPath", { ...validAsset, previewPath: "" }],
    ["source.type", { ...validAsset, source: { ...validAsset.source, type: "other" } }],
    ["animations", { ...validAsset, animations: "idle" }],
    ["sockets", { ...validAsset, sockets: "weapon" }],
    ["bounds.width", { ...validAsset, bounds: { ...validAsset.bounds, width: -1 } }],
  ])("rejects an invalid %s field", (field, asset) => {
    expect(() => parseAssetManifest(asset)).toThrow(field);
  });
});
