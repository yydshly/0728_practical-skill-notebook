import { describe, expect, it } from "vitest";
import { resolveMechAtelierHubHref } from "../src/showcase/resolve-hub-href";

describe("Mech Atelier showcase hub URL", () => {
  it("appends the fixed Mech anchor to dev, prod and relative hub bases", () => {
    expect(
      resolveMechAtelierHubHref(
        { DEV: true },
        "http://127.0.0.1:4175/",
      ),
    ).toBe("http://127.0.0.1:4172/#product-mech-atelier");
    expect(
      resolveMechAtelierHubHref(
        { DEV: false },
        "https://example.test/mech/",
      ),
    ).toBe("https://example.test/#product-mech-atelier");
    expect(
      resolveMechAtelierHubHref(
        { DEV: false, VITE_SHOWCASE_HUB_URL: "../" },
        "https://example.test/demos/mech-atelier/",
      ),
    ).toBe("https://example.test/demos/#product-mech-atelier");
  });
});
