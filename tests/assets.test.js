import { describe, expect, it } from "vitest";
import manifest from "../public/assets/asset-manifest.json";
import { validateManifest } from "../scripts/validate-assets.mjs";

describe("asset manifest", () => {
  it("contains every required scene role and route image", () => {
    const result = validateManifest(manifest);

    expect(result.errors).toEqual([]);
    expect(manifest.scene.map(({ role }) => role)).toEqual(["00", "10", "20", "30", "40", "41", "50"]);
    expect(manifest.routes.map(({ id }) => id)).toEqual([
      "tidal-garden",
      "echo-bay",
      "keeper-house",
      "north-wind-path",
    ]);
  });
});
