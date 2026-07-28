import { CAPABILITIES, SHOWCASE_CAMERAS } from "../../src/config/showcaseConfig";

test("publishes three evidence-backed capability entries", () => {
  expect(CAPABILITIES.map((entry) => entry.id)).toEqual([
    "immersive-storytelling",
    "interactive-campaign",
    "product-prototype",
  ]);
  expect(CAPABILITIES.every((entry) => entry.caseHref.startsWith("../"))).toBe(true);
  expect(Object.keys(SHOWCASE_CAMERAS)).toEqual(["overview", "interaction", "case"]);
});
