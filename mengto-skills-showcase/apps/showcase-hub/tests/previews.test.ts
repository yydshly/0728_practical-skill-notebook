import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { SHOWCASE_PRODUCTS } from "../src/content/products";
import { readPngHeader } from "./helpers/read-png-header";

const expected = [
  ["monster-forge-review.png", "怪物锻造所的怪物目录与实时模型检查器"],
  ["ashfall-arena-combat.png", "灰烬竞技场中的等距动作战斗与中文状态界面"],
  ["mech-atelier-configurator.png", "机甲定制工坊中的三维机甲与部件配置面板"],
] as const;

describe("showcase preview assets", () => {
  it("ships three 16:10 PNG previews under the 600 KiB combined budget", async () => {
    let total = 0;
    for (const [filename] of expected) {
      const path = new URL(`../public/previews/${filename}`, import.meta.url);
      const bytes = await readFile(path);
      const { width, height } = readPngHeader(bytes, filename);
      expect({ width, height }).toEqual({ width: 800, height: 500 });
      total += bytes.byteLength;
    }
    expect(total).toBeLessThan(600 * 1024);
  });

  it("keeps fixed filenames and exact Chinese alt text", () => {
    expect(
      SHOWCASE_PRODUCTS.map((product) => [
        product.card.previewFilename,
        product.card.previewAlt,
      ]),
    ).toEqual(expected);
  });
});
