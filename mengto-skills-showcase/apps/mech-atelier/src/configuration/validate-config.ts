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

function createPartIndex(catalog: Catalog): ReadonlyMap<unknown, PartDefinition> {
  const index = new Map<unknown, PartDefinition>();
  for (const part of [
    ...catalog.heads,
    ...catalog.armors,
    ...catalog.weapons,
    ...catalog.rearModules,
  ]) {
    if (!index.has(part.id)) {
      index.set(part.id, part);
    }
  }
  return index;
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
  partIndex: ReadonlyMap<unknown, PartDefinition>,
): number {
  let weight = chassis.weight;

  for (const field of selectionFields) {
    const part = partIndex.get(config[field]);
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
  const partIndex = createPartIndex(catalog);

  if (config.version !== 1) {
    pushIssue(issues, "version", "unsupported-version", config.version);
  }

  const chassis = findChassis(config.chassisId, catalog);
  if (!chassis) {
    pushIssue(issues, "chassisId", "unknown-option", config.chassisId);
  }

  for (const field of selectionFields) {
    const part = partIndex.get(config[field]);
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
    const weight = selectionWeight(config, chassis, partIndex);
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

function normalizedPart(
  field: SelectionField,
  value: unknown,
  catalog: Catalog,
  chassisId: ChassisId,
  partIndex: ReadonlyMap<unknown, PartDefinition>,
): PartDefinition | undefined {
  const selected = partIndex.get(value);
  if (selected && isPartLegalForField(selected, field, chassisId)) {
    return selected;
  }

  const options = optionsForField(field, catalog);
  const firstLegal = options.find((candidate) =>
    isPartLegalForField(candidate, field, chassisId),
  );
  if (firstLegal) return firstLegal;

  if (selected?.slots.includes(slotByField[field])) return selected;
  return options.find((candidate) =>
    candidate.slots.includes(slotByField[field]),
  );
}

function normalizedPartId<Field extends SelectionField>(
  field: Field,
  value: unknown,
  catalog: Catalog,
  chassisId: ChassisId,
  partIndex: ReadonlyMap<unknown, PartDefinition>,
  fallback: MechConfiguration[Field],
): MechConfiguration[Field] {
  return (
    normalizedPart(field, value, catalog, chassisId, partIndex)?.id ?? fallback
  ) as MechConfiguration[Field];
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

interface WeightSearchState {
  weight: number;
  changes: number;
  optionIndices: readonly number[];
  partIds: readonly string[];
}

function compareIndexVectors(
  left: readonly number[],
  right: readonly number[],
): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    if (left[index] !== right[index]) {
      return left[index] - right[index];
    }
  }
  return left.length - right.length;
}

function isPreferredState(
  candidate: WeightSearchState,
  current: WeightSearchState | undefined,
): boolean {
  if (!current) return true;
  if (candidate.changes !== current.changes) {
    return candidate.changes < current.changes;
  }
  return (
    compareIndexVectors(candidate.optionIndices, current.optionIndices) < 0
  );
}

function repairWeight(
  config: MechConfiguration,
  catalog: Catalog,
): MechConfiguration {
  const validation = validateConfiguration(config, catalog);
  if (
    validation.ok ||
    !validation.issues.some((issue) => issue.code === "weight-limit")
  ) {
    return config;
  }

  const chassis = findChassis(config.chassisId, catalog);
  if (!chassis) return config;

  const currentIds = selectionFields.map((field) => config[field]);
  const optionGroups = selectionFields.map((field) =>
    legalOptions(field, catalog, config.chassisId),
  );
  if (optionGroups.some((options) => options.length === 0)) {
    return config;
  }

  let frontier = new Map<number, WeightSearchState>([
    [
      chassis.weight,
      {
        weight: chassis.weight,
        changes: 0,
        optionIndices: [],
        partIds: [],
      },
    ],
  ]);

  for (let fieldIndex = 0; fieldIndex < optionGroups.length; fieldIndex += 1) {
    const nextFrontier = new Map<number, WeightSearchState>();
    const options = optionGroups[fieldIndex];

    for (const state of frontier.values()) {
      for (let optionIndex = 0; optionIndex < options.length; optionIndex += 1) {
        const part = options[optionIndex];
        const weight = state.weight + part.weight;
        if (weight > chassis.weightLimit) continue;

        const partId = part.id;
        const candidate: WeightSearchState = {
          weight,
          changes:
            state.changes + Number(partId !== currentIds[fieldIndex]),
          optionIndices: [...state.optionIndices, optionIndex],
          partIds: [...state.partIds, partId],
        };
        const current = nextFrontier.get(weight);
        if (isPreferredState(candidate, current)) {
          nextFrontier.set(weight, candidate);
        }
      }
    }

    frontier = nextFrontier;
    if (frontier.size === 0) return config;
  }

  let best: WeightSearchState | undefined;
  for (const candidate of frontier.values()) {
    if (isPreferredState(candidate, best)) {
      best = candidate;
    }
  }
  if (!best) return config;

  return {
    ...config,
    headId: best.partIds[0] as MechConfiguration["headId"],
    armorId: best.partIds[1] as MechConfiguration["armorId"],
    leftWeaponId: best.partIds[2] as MechConfiguration["leftWeaponId"],
    rightWeaponId: best.partIds[3] as MechConfiguration["rightWeaponId"],
    rearModuleId: best.partIds[4] as MechConfiguration["rearModuleId"],
  };
}

function mergeIssues(
  original: readonly ValidationIssue[],
  final: readonly ValidationIssue[],
): ValidationIssue[] {
  const merged = [...original];
  for (const issue of final) {
    const alreadyReported = merged.some(
      (candidate) =>
        candidate.field === issue.field &&
        candidate.code === issue.code &&
        Object.is(candidate.value, issue.value),
    );
    if (!alreadyReported) merged.push(issue);
  }
  return merged;
}

export function normalizeConfiguration(
  input: unknown,
  catalog: Catalog,
): NormalizationResult {
  const source = isRecord(input) ? input : {};
  const originalIssues = validateConfiguration(input, catalog).issues;
  const chassis =
    findChassis(source.chassisId, catalog) ?? catalog.chassis[0];
  const chassisId = chassis?.id ?? defaultConfiguration.chassisId;
  const partIndex = createPartIndex(catalog);

  const normalized: MechConfiguration = {
    version: 1,
    chassisId,
    headId: normalizedPartId(
      "headId",
      source.headId,
      catalog,
      chassisId,
      partIndex,
      defaultConfiguration.headId,
    ),
    armorId: normalizedPartId(
      "armorId",
      source.armorId,
      catalog,
      chassisId,
      partIndex,
      defaultConfiguration.armorId,
    ),
    leftWeaponId: normalizedPartId(
      "leftWeaponId",
      source.leftWeaponId,
      catalog,
      chassisId,
      partIndex,
      defaultConfiguration.leftWeaponId,
    ),
    rightWeaponId: normalizedPartId(
      "rightWeaponId",
      source.rightWeaponId,
      catalog,
      chassisId,
      partIndex,
      defaultConfiguration.rightWeaponId,
    ),
    rearModuleId: normalizedPartId(
      "rearModuleId",
      source.rearModuleId,
      catalog,
      chassisId,
      partIndex,
      defaultConfiguration.rearModuleId,
    ),
    finish: normalizeFinish(source.finish),
  };
  const repaired = repairWeight(normalized, catalog);
  const finalIssues = validateConfiguration(repaired, catalog).issues;

  return {
    config: repaired,
    issues: mergeIssues(originalIssues, finalIssues),
  };
}
