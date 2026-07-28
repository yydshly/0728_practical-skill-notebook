import { defaultConfiguration } from "../content/catalog";
import type {
  Catalog,
  ChassisDefinition,
  ChassisId,
  FinishEnvironment,
  FinishMetalness,
  FinishRoughness,
  MechConfiguration,
  MechFinish,
  NormalizationResult,
  PartDefinition,
  PartSlot,
  ValidationField,
  ValidationIssue,
  ValidationResult,
} from "./types";

const selectionFields = [
  "headId",
  "armorId",
  "leftWeaponId",
  "rightWeaponId",
  "rearModuleId",
] as const;

type SelectionField = (typeof selectionFields)[number];

const slotByField: Record<SelectionField, PartSlot> = {
  headId: "head",
  armorId: "armor",
  leftWeaponId: "leftWeapon",
  rightWeaponId: "rightWeapon",
  rearModuleId: "rearModule",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function findChassis(
  value: unknown,
  catalog: Catalog,
): ChassisDefinition | undefined {
  return catalog.chassis.find((candidate) => candidate.id === value);
}

function allParts(catalog: Catalog): readonly PartDefinition[] {
  return [
    ...catalog.heads,
    ...catalog.armors,
    ...catalog.weapons,
    ...catalog.rearModules,
  ];
}

function findPart(
  value: unknown,
  catalog: Catalog,
): PartDefinition | undefined {
  return allParts(catalog).find((candidate) => candidate.id === value);
}

function optionsForField(
  field: SelectionField,
  catalog: Catalog,
): readonly PartDefinition[] {
  if (field === "headId") return catalog.heads;
  if (field === "armorId") return catalog.armors;
  if (field === "rearModuleId") return catalog.rearModules;
  return catalog.weapons;
}

function isPartLegalForField(
  part: PartDefinition,
  field: SelectionField,
  chassisId?: ChassisId,
): boolean {
  return (
    part.slots.includes(slotByField[field]) &&
    (!chassisId || !part.incompatibleChassisIds?.includes(chassisId))
  );
}

function pushIssue(
  issues: ValidationIssue[],
  field: ValidationField,
  code: ValidationIssue["code"],
  value: unknown,
): void {
  issues.push({ field, code, value });
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function isMetalness(value: unknown): value is FinishMetalness {
  return value === 0 || value === 0.5 || value === 1;
}

function isRoughness(value: unknown): value is FinishRoughness {
  return value === 0.2 || value === 0.6 || value === 1;
}

function isEnvironment(value: unknown): value is FinishEnvironment {
  return value === "foundry" || value === "hangar" || value === "dusk";
}

function selectionWeight(
  config: Record<string, unknown>,
  chassis: ChassisDefinition,
  catalog: Catalog,
): number {
  let weight = chassis.weight;

  for (const field of selectionFields) {
    const part = findPart(config[field], catalog);
    if (part?.slots.includes(slotByField[field])) {
      weight += part.weight;
    }
  }

  return weight;
}

export function validateConfiguration(
  input: unknown,
  catalog: Catalog,
): ValidationResult {
  const config = isRecord(input) ? input : {};
  const issues: ValidationIssue[] = [];

  if (config.version !== 1) {
    pushIssue(issues, "version", "unsupported-version", config.version);
  }

  const chassis = findChassis(config.chassisId, catalog);
  if (!chassis) {
    pushIssue(issues, "chassisId", "unknown-option", config.chassisId);
  }

  for (const field of selectionFields) {
    const part = findPart(config[field], catalog);
    if (!part) {
      pushIssue(issues, field, "unknown-option", config[field]);
      continue;
    }

    if (!part.slots.includes(slotByField[field])) {
      pushIssue(issues, field, "slot-incompatible", config[field]);
      continue;
    }

    if (
      chassis &&
      part.incompatibleChassisIds?.includes(chassis.id)
    ) {
      pushIssue(issues, field, "chassis-incompatible", config[field]);
    }
  }

  const finish = isRecord(config.finish) ? config.finish : {};
  if (!isHexColor(finish.primary)) {
    pushIssue(issues, "finish.primary", "invalid-finish", finish.primary);
  }
  if (!isHexColor(finish.secondary)) {
    pushIssue(issues, "finish.secondary", "invalid-finish", finish.secondary);
  }
  if (!isMetalness(finish.metalness)) {
    pushIssue(issues, "finish.metalness", "invalid-finish", finish.metalness);
  }
  if (!isRoughness(finish.roughness)) {
    pushIssue(issues, "finish.roughness", "invalid-finish", finish.roughness);
  }
  if (!isEnvironment(finish.environment)) {
    pushIssue(
      issues,
      "finish.environment",
      "invalid-finish",
      finish.environment,
    );
  }

  if (chassis) {
    const weight = selectionWeight(config, chassis, catalog);
    if (weight > chassis.weightLimit) {
      pushIssue(issues, "weight", "weight-limit", weight);
    }
  }

  return issues.length === 0
    ? { ok: true, issues: [] }
    : { ok: false, issues };
}

function normalizeFinish(value: unknown): MechFinish {
  const finish = isRecord(value) ? value : {};
  return {
    primary: isHexColor(finish.primary)
      ? finish.primary
      : defaultConfiguration.finish.primary,
    secondary: isHexColor(finish.secondary)
      ? finish.secondary
      : defaultConfiguration.finish.secondary,
    metalness: isMetalness(finish.metalness)
      ? finish.metalness
      : defaultConfiguration.finish.metalness,
    roughness: isRoughness(finish.roughness)
      ? finish.roughness
      : defaultConfiguration.finish.roughness,
    environment: isEnvironment(finish.environment)
      ? finish.environment
      : defaultConfiguration.finish.environment,
  };
}

function firstLegalPart(
  field: SelectionField,
  catalog: Catalog,
  chassisId: ChassisId,
): PartDefinition {
  const part = optionsForField(field, catalog).find((candidate) =>
    isPartLegalForField(candidate, field, chassisId),
  );
  if (!part) {
    throw new Error(`Catalog has no legal option for ${field}`);
  }
  return part;
}

function normalizedPart(
  field: SelectionField,
  value: unknown,
  catalog: Catalog,
  chassisId: ChassisId,
): PartDefinition {
  const selected = findPart(value, catalog);
  return selected && isPartLegalForField(selected, field, chassisId)
    ? selected
    : firstLegalPart(field, catalog, chassisId);
}

function legalOptions(
  field: SelectionField,
  catalog: Catalog,
  chassisId: ChassisId,
): readonly PartDefinition[] {
  return optionsForField(field, catalog).filter((part) =>
    isPartLegalForField(part, field, chassisId),
  );
}

function repairWeight(
  config: MechConfiguration,
  catalog: Catalog,
): MechConfiguration {
  if (validateConfiguration(config, catalog).ok) {
    return config;
  }

  const currentIds = selectionFields.map((field) => config[field]);
  const optionGroups = selectionFields.map((field) =>
    legalOptions(field, catalog, config.chassisId),
  );
  let best: MechConfiguration | undefined;
  let bestChanges = Number.POSITIVE_INFINITY;

  for (const head of optionGroups[0]) {
    for (const armor of optionGroups[1]) {
      for (const leftWeapon of optionGroups[2]) {
        for (const rightWeapon of optionGroups[3]) {
          for (const rearModule of optionGroups[4]) {
            const candidate: MechConfiguration = {
              ...config,
              headId: head.id as MechConfiguration["headId"],
              armorId: armor.id as MechConfiguration["armorId"],
              leftWeaponId:
                leftWeapon.id as MechConfiguration["leftWeaponId"],
              rightWeaponId:
                rightWeapon.id as MechConfiguration["rightWeaponId"],
              rearModuleId:
                rearModule.id as MechConfiguration["rearModuleId"],
            };

            if (!validateConfiguration(candidate, catalog).ok) continue;

            const candidateIds = selectionFields.map(
              (field) => candidate[field],
            );
            const changes = candidateIds.reduce(
              (count, id, index) => count + Number(id !== currentIds[index]),
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

  if (!best) {
    throw new Error(
      `Catalog has no legal configuration for ${config.chassisId}`,
    );
  }
  return best;
}

export function normalizeConfiguration(
  input: unknown,
  catalog: Catalog,
): NormalizationResult {
  const source = isRecord(input) ? input : {};
  const issues = validateConfiguration(input, catalog).issues;
  const chassis =
    findChassis(source.chassisId, catalog) ?? catalog.chassis[0];

  if (!chassis) {
    throw new Error("Catalog has no chassis");
  }

  const normalized: MechConfiguration = {
    version: 1,
    chassisId: chassis.id,
    headId: normalizedPart(
      "headId",
      source.headId,
      catalog,
      chassis.id,
    ).id as MechConfiguration["headId"],
    armorId: normalizedPart(
      "armorId",
      source.armorId,
      catalog,
      chassis.id,
    ).id as MechConfiguration["armorId"],
    leftWeaponId: normalizedPart(
      "leftWeaponId",
      source.leftWeaponId,
      catalog,
      chassis.id,
    ).id as MechConfiguration["leftWeaponId"],
    rightWeaponId: normalizedPart(
      "rightWeaponId",
      source.rightWeaponId,
      catalog,
      chassis.id,
    ).id as MechConfiguration["rightWeaponId"],
    rearModuleId: normalizedPart(
      "rearModuleId",
      source.rearModuleId,
      catalog,
      chassis.id,
    ).id as MechConfiguration["rearModuleId"],
    finish: normalizeFinish(source.finish),
  };

  return {
    config: repairWeight(normalized, catalog),
    issues: [...issues],
  };
}
