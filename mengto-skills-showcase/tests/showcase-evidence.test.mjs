import { readdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const evidenceDirectory = new URL(
  "../apps/showcase-hub/docs/evidence/",
  import.meta.url,
);
const expectedEvidence = [
  ["showcase-desktop.png", 1440, 900],
  ["showcase-dialog.png", 1440, 900],
  ["showcase-mobile.png", 390, 844],
];
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function readPngSize(bytes, filename) {
  expect(bytes.subarray(0, 8), `${filename} signature`).toEqual(pngSignature);
  expect(bytes.toString("ascii", 12, 16), `${filename} IHDR`).toBe("IHDR");
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

describe("showcase final evidence", () => {
  it("keeps exactly the three approved screenshots at their review viewports", async () => {
    const filenames = (await readdir(evidenceDirectory))
      .filter((filename) => filename.endsWith(".png"))
      .sort();
    expect(filenames).toEqual(expectedEvidence.map(([name]) => name).sort());

    for (const [filename, width, height] of expectedEvidence) {
      const bytes = await readFile(new URL(filename, evidenceDirectory));
      expect(readPngSize(bytes, filename)).toEqual({ width, height });
    }
  });
});
