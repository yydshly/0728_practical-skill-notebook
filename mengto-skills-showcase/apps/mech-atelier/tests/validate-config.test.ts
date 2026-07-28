import { describe, expect, it } from "vitest";

import { catalog, defaultConfiguration } from "../src/content/catalog";
import {
  normalizeConfiguration,
  validateConfiguration,
} from "../src/configuration/validate-config";

describe("validateConfiguration", () => {
  it("rejects a right-only rail lance in the left slot", () => {
    const result = validateConfiguration(
      {
        ...defaultConfiguration,
        leftWeaponId: "rail-lance",
      },
      catalog,
    );

    expect(result).toEqual({
      ok: false,
      issues: [
        {
          field: "leftWeaponId",
          code: "slot-incompatible",
          value: "rail-lance",
        },
      ],
    });
  });

  it("rejects both explicit chassis incompatibilities", () => {
    expect(
      validateConfiguration(
        {
          ...defaultConfiguration,
          armorId: "reactive-bastion",
        },
        catalog,
      ).issues,
    ).toContainEqual({
      field: "armorId",
      code: "chassis-incompatible",
      value: "reactive-bastion",
    });

    expect(
      validateConfiguration(
        {
          ...defaultConfiguration,
          chassisId: "oracle-frame",
          rearModuleId: "siege-reactor",
        },
        catalog,
      ).issues,
    ).toContainEqual({
      field: "rearModuleId",
      code: "chassis-incompatible",
      value: "siege-reactor",
    });
  });

  it("rejects a Scout configuration above its weight limit", () => {
    const result = validateConfiguration(
      {
        ...defaultConfiguration,
        chassisId: "strider-scout",
        armorId: "reactive-bastion",
        rightWeaponId: "rail-lance",
        rearModuleId: "siege-reactor",
      },
      catalog,
    );

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        field: "weight",
        code: "weight-limit",
        value: 48,
      }),
    );
  });

  it("reports unsupported versions, unknown options, and invalid finish values from runtime input", () => {
    const result = validateConfiguration(
      {
        ...defaultConfiguration,
        version: 2,
        headId: "missing-head",
        finish: {
          primary: "red",
          secondary: "#12345g",
          metalness: 0.25,
          roughness: 0.4,
          environment: "space",
        },
      },
      catalog,
    );

    expect(result.issues).toEqual([
      { field: "version", code: "unsupported-version", value: 2 },
      { field: "headId", code: "unknown-option", value: "missing-head" },
      { field: "finish.primary", code: "invalid-finish", value: "red" },
      {
        field: "finish.secondary",
        code: "invalid-finish",
        value: "#12345g",
      },
      { field: "finish.metalness", code: "invalid-finish", value: 0.25 },
      { field: "finish.roughness", code: "invalid-finish", value: 0.4 },
      {
        field: "finish.environment",
        code: "invalid-finish",
        value: "space",
      },
    ]);
  });

  it("returns multiple issues in stable field order on repeated calls", () => {
    const input = {
      ...defaultConfiguration,
      version: 7,
      armorId: "reactive-bastion",
      rightWeaponId: "rail-lance",
      rearModuleId: "siege-reactor",
      finish: {
        ...defaultConfiguration.finish,
        primary: "not-a-color",
      },
    };

    const first = validateConfiguration(input, catalog);
    const second = validateConfiguration(input, catalog);

    expect(first).toEqual(second);
    expect(first.issues.map((issue) => issue.field)).toEqual([
      "version",
      "armorId",
      "finish.primary",
      "weight",
    ]);
  });
});

describe("normalizeConfiguration", () => {
  it("returns the nearest legal configuration without mutating runtime input", () => {
    const input = {
      ...defaultConfiguration,
      armorId: "reactive-bastion",
      leftWeaponId: "rail-lance",
      rearModuleId: "siege-reactor",
      finish: {
        ...defaultConfiguration.finish,
        primary: "red",
      },
    };
    const snapshot = structuredClone(input);

    const result = normalizeConfiguration(input, catalog);

    expect(input).toEqual(snapshot);
    expect(result.config).toEqual(defaultConfiguration);
    expect(result.issues.map(({ field, code }) => ({ field, code }))).toEqual([
      { field: "armorId", code: "chassis-incompatible" },
      { field: "leftWeaponId", code: "slot-incompatible" },
      { field: "finish.primary", code: "invalid-finish" },
      { field: "weight", code: "weight-limit" },
    ]);
    expect(validateConfiguration(result.config, catalog)).toEqual({
      ok: true,
      issues: [],
    });
  });

  it("is deterministic across repeated normalization calls", () => {
    const input = {
      ...defaultConfiguration,
      chassisId: "oracle-frame",
      headId: "missing-head",
      rearModuleId: "siege-reactor",
    };

    expect(normalizeConfiguration(input, catalog)).toEqual(
      normalizeConfiguration(input, catalog),
    );
  });
});
