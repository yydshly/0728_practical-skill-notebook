import { describe, expect, it } from "vitest";
import { monsters } from "@showcase/game-assets";
import { readPngMetadata } from "./helpers/read-png-metadata";

describe("catalog preview delivery", () => {
  it.each(monsters)("has a 512x512 transparent catalog preview for $id", async ({ previewPath }) => {
    const metadata = await readPngMetadata(`public${previewPath}`);
    expect(metadata).toMatchObject({ width: 512, height: 512, colorType: "RGBA" });
    expect(metadata.hasTransparentCorner).toBe(true);
  });
});
