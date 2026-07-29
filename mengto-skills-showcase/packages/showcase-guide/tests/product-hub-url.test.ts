import { expect, it } from "vitest";
import * as guide from "../src/index";

it("keeps the root entry limited to the three product guide contract", () => {
  expect(guide.PRODUCT_IDS).toEqual([
    "monster-forge",
    "ashfall-arena",
    "mech-atelier",
  ]);
  expect("createGuidePreferenceAccess" in guide).toBe(false);
});

it.each([
  [
    "http://127.0.0.1:4172/",
    "monster-forge",
    "http://127.0.0.1:4173/",
    "http://127.0.0.1:4172/#product-monster-forge",
  ],
  [
    "../",
    "ashfall-arena",
    "https://example.test/demos/ashfall-arena/",
    "https://example.test/demos/#product-ashfall-arena",
  ],
  [
    "/gallery/?source=direct#old",
    "mech-atelier",
    "https://example.test/products/mech/",
    "https://example.test/gallery/?source=direct#product-mech-atelier",
  ],
] as const)(
  "resolves %s for %s",
  (base, productId, currentHref, expected) => {
    expect(guide.resolveProductHubHref(base, productId, currentHref)).toBe(expected);
  },
);
