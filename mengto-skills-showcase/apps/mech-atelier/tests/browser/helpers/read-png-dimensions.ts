import { readFile } from "node:fs/promises";
import { PNG } from "pngjs";

export interface PngEvidence {
  width: number;
  height: number;
  signature: string;
  uniqueSampledColors: number;
  productEdgePixels: number;
}

export async function readPngDimensions(path: string) {
  const png = PNG.sync.read(await readFile(path));
  return { width: png.width, height: png.height };
}

export async function readPngEvidence(path: string): Promise<PngEvidence> {
  const bytes = await readFile(path);
  const png = PNG.sync.read(bytes);
  const colors = new Set<string>();
  for (let y = 0; y < png.height; y += 13) {
    for (let x = 0; x < png.width; x += 13) {
      const offset = (y * png.width + x) * 4;
      colors.add(
        `${png.data[offset]},${png.data[offset + 1]},${png.data[offset + 2]},${png.data[offset + 3]}`,
      );
    }
  }

  let productEdgePixels = 0;
  for (let y = 190; y < 1090; y += 4) {
    for (let x = 70; x < 980; x += 4) {
      const offset = (y * png.width + x) * 4;
      const right = offset + 4;
      const delta =
        Math.abs((png.data[offset] ?? 0) - (png.data[right] ?? 0)) +
        Math.abs((png.data[offset + 1] ?? 0) - (png.data[right + 1] ?? 0)) +
        Math.abs((png.data[offset + 2] ?? 0) - (png.data[right + 2] ?? 0));
      if (delta > 42) productEdgePixels += 1;
    }
  }

  return {
    width: png.width,
    height: png.height,
    signature: bytes.subarray(0, 8).toString("hex"),
    uniqueSampledColors: colors.size,
    productEdgePixels,
  };
}

