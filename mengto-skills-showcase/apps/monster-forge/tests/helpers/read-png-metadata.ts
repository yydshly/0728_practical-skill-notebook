import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { PNG } from "pngjs";

export async function readPngMetadata(path: string) {
  const packageRoot = fileURLToPath(new URL("../../", import.meta.url));
  const png = PNG.sync.read(await readFile(resolve(packageRoot, path)));
  const alphaAt = (x: number, y: number) => png.data[(png.width * y + x) * 4 + 3];
  return {
    width: png.width,
    height: png.height,
    colorType: png.colorType === 6 ? "RGBA" : `color-type-${png.colorType}`,
    hasTransparentCorner: [
      alphaAt(0, 0),
      alphaAt(png.width - 1, 0),
      alphaAt(0, png.height - 1),
      alphaAt(png.width - 1, png.height - 1),
    ].some((alpha) => alpha === 0),
  };
}
