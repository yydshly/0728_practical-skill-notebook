import { describe, expect, it } from "vitest";

import { calculateSummary } from "../src/configuration/calculate-summary";
import { catalog, defaultConfiguration } from "../src/content/catalog";
import type { MechConfiguration } from "../src/configuration/types";

describe("calculateSummary", () => {
  it("calculates the approved default exactly", () => {
    expect(calculateSummary(defaultConfiguration, catalog)).toEqual({
      priceCredits: 184000,
      weight: 28,
      power: 62,
      guard: 41,
      mobility: 78,
    });
  });

  it("calculates another legal configuration exactly", () => {
    const oracleConfiguration: MechConfiguration = {
      version: 1,
      chassisId: "oracle-frame",
      headId: "halo-head",
      armorId: "void-weave",
      leftWeaponId: "drone-rack",
      rightWeaponId: "rail-lance",
      rearModuleId: "field-relay",
      finish: {
        primary: "#273349",
        secondary: "#d8b36a",
        metalness: 1,
        roughness: 0.2,
        environment: "dusk",
      },
    };

    expect(calculateSummary(oracleConfiguration, catalog)).toEqual({
      priceCredits: 274000,
      weight: 38,
      power: 96,
      guard: 36,
      mobility: 52,
    });
  });
});
