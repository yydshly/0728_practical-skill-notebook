import { describe, expect, it } from "vitest";
import { resolveAshfallHubHref } from "../src/showcase/resolve-hub-href";

describe("Ashfall showcase hub URL", () => {
  it("uses the local Hub port in development", () => {
    expect(resolveAshfallHubHref(
      { DEV: true },
      "http://127.0.0.1:4174/",
    )).toBe("http://127.0.0.1:4172/#product-ashfall-arena");
  });

  it("uses the origin root in production", () => {
    expect(resolveAshfallHubHref(
      { DEV: false },
      "https://example.test/ashfall/",
    )).toBe("https://example.test/#product-ashfall-arena");
  });

  it("resolves an explicit relative Hub URL from the product page", () => {
    expect(resolveAshfallHubHref(
      { DEV: false, VITE_SHOWCASE_HUB_URL: "../" },
      "https://example.test/demos/ashfall-arena/",
    )).toBe("https://example.test/demos/#product-ashfall-arena");
  });
});
