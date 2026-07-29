import { describe, expect, it } from "vitest";
import { resolveMonsterForgeHubHref } from "../src/showcase/resolve-hub-href";

describe("Monster Forge showcase hub return", () => {
  it.each([
    [{ DEV: true }, "http://127.0.0.1:4172/#product-monster-forge"],
    [{ DEV: false }, "https://example.test/#product-monster-forge"],
    [
      { DEV: false, VITE_SHOWCASE_HUB_URL: "../" },
      "https://example.test/demos/#product-monster-forge",
    ],
  ])("resolves the Monster Forge hub return", (env, expected) => {
    expect(resolveMonsterForgeHubHref(
      env,
      "https://example.test/demos/monster-forge/",
    )).toBe(expected);
  });
});
