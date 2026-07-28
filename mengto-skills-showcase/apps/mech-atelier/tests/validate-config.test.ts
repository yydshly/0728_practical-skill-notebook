import { describe, expect, it } from "vitest";

import { catalog, defaultConfiguration } from "../src/content/catalog";
import {
  normalizeConfiguration,
  validateConfiguration,
} from "../src/configuration/validate-config";
import type {
  Catalog,
  ChassisDefinition,
  MechConfiguration,
  PartDefinition,
  PartSlot,
} from "../src/configuration/types";

function createExpandedCatalog(optionCount: number, accessBudget: number) {
  let idAccesses = 0;

  function createParts(
    prefix: string,
    slot: PartSlot,
  ): readonly PartDefinition[] {
    return Array.from({ length: optionCount }, (_, index) => {
      const part = {
        name: `${prefix} ${index}`,
        priceCredits: 0,
        weight: index === 0 ? 1 : 4,
        power: 0,
        guard: 0,
        mobility: 0,
        slots: [slot],
      };
      Object.defineProperty(part, "id", {
        enumerable: true,
        get() {
          idAccesses += 1;
          if (idAccesses > accessBudget) {
            throw new Error(`candidate access budget exceeded: ${idAccesses}`);
          }
          return `${prefix}-${index}`;
        },
      });
      return part as unknown as PartDefinition;
    });
  }

  const weapons = Array.from({ length: optionCount }, (_, index) => {
    const part = {
      name: `weapon ${index}`,
      priceCredits: 0,
      weight: index === 0 ? 1 : 4,
      power: 0,
      guard: 0,
      mobility: 0,
      slots: ["leftWeapon", "rightWeapon"],
    };
    Object.defineProperty(part, "id", {
      enumerable: true,
      get() {
        idAccesses += 1;
        if (idAccesses > accessBudget) {
          throw new Error(`candidate access budget exceeded: ${idAccesses}`);
        }
        return `weapon-${index}`;
      },
    });
    return part as unknown as PartDefinition;
  });

  const chassis: ChassisDefinition = {
    id: "strider-scout",
    name: "扩容测试底盘",
    priceCredits: 0,
    weight: 0,
    power: 0,
    guard: 0,
    mobility: 0,
    weightLimit: 14,
  };

  const expandedCatalog = {
    chassis: [chassis],
    heads: createParts("head", "head"),
    armors: createParts("armor", "armor"),
    weapons,
    rearModules: createParts("rear", "rearModule"),
  } as Catalog;

  return {
    catalog: expandedCatalog,
    getIdAccesses: () => idAccesses,
  };
}

const referenceFields = [
  "headId",
  "armorId",
  "leftWeaponId",
  "rightWeaponId",
  "rearModuleId",
] as const;

function referenceOptions(
  field: (typeof referenceFields)[number],
): readonly PartDefinition[] {
  if (field === "headId") return catalog.heads;
  if (field === "armorId") return catalog.armors;
  if (field === "rearModuleId") return catalog.rearModules;
  return catalog.weapons;
}

function referenceSlot(field: (typeof referenceFields)[number]): PartSlot {
  if (field === "headId") return "head";
  if (field === "armorId") return "armor";
  if (field === "rearModuleId") return "rearModule";
  return field === "leftWeaponId" ? "leftWeapon" : "rightWeapon";
}

function referenceNormalization(
  input: MechConfiguration,
): MechConfiguration {
  const preferredIds = referenceFields.map((field) => {
    const legal = referenceOptions(field).filter(
      (part) =>
        part.slots.includes(referenceSlot(field)) &&
        !part.incompatibleChassisIds?.includes(input.chassisId),
    );
    const selected = legal.find((part) => part.id === input[field]);
    return (selected ?? legal[0]).id;
  });
  let best: MechConfiguration | undefined;
  let bestChanges = Number.POSITIVE_INFINITY;

  for (const head of catalog.heads) {
    for (const armor of catalog.armors) {
      for (const leftWeapon of catalog.weapons) {
        for (const rightWeapon of catalog.weapons) {
          for (const rearModule of catalog.rearModules) {
            const candidate = {
              ...input,
              headId: head.id,
              armorId: armor.id,
              leftWeaponId: leftWeapon.id,
              rightWeaponId: rightWeapon.id,
              rearModuleId: rearModule.id,
            } as MechConfiguration;
            if (!validateConfiguration(candidate, catalog).ok) continue;

            const changes = referenceFields.reduce(
              (count, field, index) =>
                count + Number(candidate[field] !== preferredIds[index]),
              0,
            );
            if (changes < bestChanges) {
              best = candidate;
              bestChanges = changes;
            }
          }
        }
      }
    }
  }

  if (!best) throw new Error("Reference catalog unexpectedly has no solution");
  return best;
}

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

  it("bounds expanded-catalog work and resolves ties by catalog index order", () => {
    const expanded = createExpandedCatalog(12, 5_000);
    const input = {
      ...defaultConfiguration,
      headId: "head-11",
      armorId: "armor-11",
      leftWeaponId: "weapon-11",
      rightWeaponId: "weapon-11",
      rearModuleId: "rear-11",
    };

    const first = normalizeConfiguration(input, expanded.catalog);
    const second = normalizeConfiguration(input, expanded.catalog);

    expect(first).toEqual(second);
    expect(first.config).toMatchObject({
      headId: "head-0",
      armorId: "armor-0",
      leftWeaponId: "weapon-11",
      rightWeaponId: "weapon-11",
      rearModuleId: "rear-11",
    });
    expect(first.issues).toEqual([
      { field: "weight", code: "weight-limit", value: 20 },
    ]);
    expect(validateConfiguration(first.config, expanded.catalog)).toEqual({
      ok: true,
      issues: [],
    });
    expect(expanded.getIdAccesses()).toBeLessThanOrEqual(5_000);
  });

  it("returns a deterministic issue-bearing fallback when no legal configuration exists", () => {
    const impossibleCatalog: Catalog = {
      ...catalog,
      chassis: [
        {
          ...catalog.chassis[0],
          weightLimit: 10,
        },
      ],
      heads: [],
    };

    const first = normalizeConfiguration(defaultConfiguration, impossibleCatalog);
    const second = normalizeConfiguration(
      defaultConfiguration,
      impossibleCatalog,
    );

    expect(first).toEqual(second);
    expect(first.config).toEqual(defaultConfiguration);
    expect(first.issues).toEqual([
      {
        field: "headId",
        code: "unknown-option",
        value: "surveyor-head",
      },
      { field: "weight", code: "weight-limit", value: 26 },
    ]);
    expect(validateConfiguration(first.config, impossibleCatalog).ok).toBe(
      false,
    );
  });

  it("preserves normalization results for all 1296 existing catalog selections", () => {
    let cases = 0;

    for (const chassis of catalog.chassis) {
      for (const head of catalog.heads) {
        for (const armor of catalog.armors) {
          for (const leftWeapon of catalog.weapons) {
            for (const rightWeapon of catalog.weapons) {
              for (const rearModule of catalog.rearModules) {
                const input = {
                  ...defaultConfiguration,
                  chassisId: chassis.id,
                  headId: head.id,
                  armorId: armor.id,
                  leftWeaponId: leftWeapon.id,
                  rightWeaponId: rightWeapon.id,
                  rearModuleId: rearModule.id,
                } as MechConfiguration;
                const result = normalizeConfiguration(input, catalog);

                expect(result.config).toEqual(referenceNormalization(input));
                expect(result.issues).toEqual(
                  validateConfiguration(input, catalog).issues,
                );
                cases += 1;
              }
            }
          }
        }
      }
    }

    expect(cases).toBe(1_296);
    expect(normalizeConfiguration(defaultConfiguration, catalog)).toEqual({
      config: defaultConfiguration,
      issues: [],
    });
  });
});
