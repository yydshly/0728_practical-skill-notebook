import { catalog, defaultConfiguration } from "../content/catalog";
import type {
  MechConfiguration,
  ValidationField,
  ValidationIssue,
} from "./types";
import {
  normalizeConfiguration,
  validateConfiguration,
} from "./validate-config";

export type ParseIssue =
  | ValidationIssue
  | {
      field: ValidationField;
      code:
        | "missing-version"
        | "malformed-value"
        | "duplicate-key";
      value?: unknown;
    };

export interface ParseResult {
  ok: boolean;
  config: MechConfiguration;
  issues: ParseIssue[];
}

const queryFields = [
  ["v", "version"],
  ["c", "chassisId"],
  ["h", "headId"],
  ["a", "armorId"],
  ["lw", "leftWeaponId"],
  ["rw", "rightWeaponId"],
  ["r", "rearModuleId"],
  ["p", "finish.primary"],
  ["s", "finish.secondary"],
  ["m", "finish.metalness"],
  ["rf", "finish.roughness"],
  ["e", "finish.environment"],
] as const satisfies readonly (readonly [string, ValidationField])[];

const selectionQueryFields = [
  ["c", "chassisId"],
  ["h", "headId"],
  ["a", "armorId"],
  ["lw", "leftWeaponId"],
  ["rw", "rightWeaponId"],
  ["r", "rearModuleId"],
] as const;

export function hasConfigurationQuery(
  search: string | URLSearchParams,
): boolean {
  const params =
    typeof search === "string"
      ? new URLSearchParams(stripLeadingQuestion(search))
      : search;
  return queryFields.some(([key]) => params.has(key));
}

export function serializeConfiguration(config: MechConfiguration): string {
  const validation = validateConfiguration(config, catalog);
  if (!validation.ok) {
    throw new Error("只能序列化合法配置。");
  }

  const params = new URLSearchParams();
  params.set("v", "1");
  params.set("c", config.chassisId);
  setUnlessDefault(params, "h", config.headId, defaultConfiguration.headId);
  setUnlessDefault(params, "a", config.armorId, defaultConfiguration.armorId);
  setUnlessDefault(
    params,
    "lw",
    config.leftWeaponId,
    defaultConfiguration.leftWeaponId,
  );
  setUnlessDefault(
    params,
    "rw",
    config.rightWeaponId,
    defaultConfiguration.rightWeaponId,
  );
  setUnlessDefault(
    params,
    "r",
    config.rearModuleId,
    defaultConfiguration.rearModuleId,
  );

  const primary = colorValue(config.finish.primary);
  const secondary = colorValue(config.finish.secondary);
  setUnlessDefault(
    params,
    "p",
    primary,
    colorValue(defaultConfiguration.finish.primary),
  );
  setUnlessDefault(
    params,
    "s",
    secondary,
    colorValue(defaultConfiguration.finish.secondary),
  );
  setUnlessDefault(
    params,
    "m",
    String(config.finish.metalness),
    String(defaultConfiguration.finish.metalness),
  );
  setUnlessDefault(
    params,
    "rf",
    String(config.finish.roughness),
    String(defaultConfiguration.finish.roughness),
  );
  setUnlessDefault(
    params,
    "e",
    config.finish.environment,
    defaultConfiguration.finish.environment,
  );

  return `?${params.toString()}`;
}

export function parseConfiguration(search: string): ParseResult {
  const params = new URLSearchParams(stripLeadingQuestion(search));
  const duplicateIssues = collectDuplicateIssues(params);
  const versions = params.getAll("v");

  if (versions.length === 0) {
    return {
      ok: false,
      config: cloneConfiguration(defaultConfiguration),
      issues: [{ field: "version", code: "missing-version" }],
    };
  }

  const version = versions[0]!;
  if (!/^\d+$/.test(version)) {
    return {
      ok: false,
      config: cloneConfiguration(defaultConfiguration),
      issues: [
        {
          field: "version",
          code: "malformed-value",
          value: version,
        },
        ...duplicateIssues,
      ],
    };
  }
  if (version !== "1") {
    return {
      ok: false,
      config: cloneConfiguration(defaultConfiguration),
      issues: [
        {
          field: "version",
          code: "unsupported-version",
          value: version,
        },
        ...duplicateIssues,
      ],
    };
  }

  const source: Record<string, unknown> = {
    ...cloneConfiguration(defaultConfiguration),
    finish: { ...defaultConfiguration.finish },
  };
  for (const [key, field] of selectionQueryFields) {
    const value = params.get(key);
    if (value !== null) source[field] = value;
  }

  const finish = source.finish as Record<string, unknown>;
  const primary = params.get("p");
  if (primary !== null) finish.primary = `#${primary}`;
  const secondary = params.get("s");
  if (secondary !== null) finish.secondary = `#${secondary}`;
  const metalness = params.get("m");
  if (metalness !== null) finish.metalness = parseFiniteNumber(metalness);
  const roughness = params.get("rf");
  if (roughness !== null) finish.roughness = parseFiniteNumber(roughness);
  const environment = params.get("e");
  if (environment !== null) finish.environment = environment;

  const normalized = normalizeConfiguration(source, catalog);
  return {
    ok: true,
    config: normalized.config,
    issues: [...duplicateIssues, ...normalized.issues],
  };
}

function setUnlessDefault(
  params: URLSearchParams,
  key: string,
  value: string,
  defaultValue: string,
): void {
  if (value !== defaultValue) params.set(key, value);
}

function colorValue(value: string): string {
  return value.slice(1).toLowerCase();
}

function stripLeadingQuestion(search: string): string {
  return search.startsWith("?") ? search.slice(1) : search;
}

function parseFiniteNumber(value: string): number | string {
  if (value.trim() === "") return value;
  const number = Number(value);
  return Number.isFinite(number) ? number : value;
}

function collectDuplicateIssues(params: URLSearchParams): ParseIssue[] {
  const issues: ParseIssue[] = [];
  for (const [key, field] of queryFields) {
    const values = params.getAll(key);
    for (const duplicate of values.slice(1)) {
      issues.push({
        field,
        code: "duplicate-key",
        value: duplicate,
      });
    }
  }
  return issues;
}

function cloneConfiguration(
  config: MechConfiguration,
): MechConfiguration {
  return {
    ...config,
    finish: { ...config.finish },
  };
}
