import { catalog } from "../content/catalog";
import type {
  MechConfiguration,
  ValidationIssue,
} from "../configuration/types";
import { validateConfiguration } from "../configuration/validate-config";

export const SAVED_CONFIG_KEY = "mech-atelier:v1";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type SavedConfigurationIssue =
  | ValidationIssue
  | {
      field: "storage";
      code:
        | "missing"
        | "malformed"
        | "unsupported-version"
        | "unavailable";
      value?: unknown;
    };

export type SaveConfigurationResult =
  | { ok: true }
  | { ok: false; issues: SavedConfigurationIssue[] };

export type LoadConfigurationResult =
  | {
      ok: true;
      config: MechConfiguration;
      issues: [];
    }
  | {
      ok: false;
      config: null;
      issues: SavedConfigurationIssue[];
    };

export interface SavedConfigurationController {
  schedule(config: MechConfiguration): boolean;
  flush(): SaveConfigurationResult;
  dispose(): void;
}

interface SavedPayload {
  version: 1;
  config: MechConfiguration;
}

export function saveConfiguration(
  config: MechConfiguration,
  storage: StorageLike = window.localStorage,
): SaveConfigurationResult {
  const validation = validateConfiguration(config, catalog);
  if (!validation.ok) {
    return { ok: false, issues: validation.issues };
  }

  const payload: SavedPayload = {
    version: 1,
    config: cloneConfiguration(config),
  };
  try {
    storage.setItem(SAVED_CONFIG_KEY, JSON.stringify(payload));
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      issues: [
        {
          field: "storage",
          code: "unavailable",
          value: error instanceof Error ? error.message : String(error),
        },
      ],
    };
  }
}

export function loadConfiguration(
  storage: StorageLike = window.localStorage,
): LoadConfigurationResult {
  let serialized: string | null;
  try {
    serialized = storage.getItem(SAVED_CONFIG_KEY);
  } catch (error) {
    return {
      ok: false,
      config: null,
      issues: [
        {
          field: "storage",
          code: "unavailable",
          value: error instanceof Error ? error.message : String(error),
        },
      ],
    };
  }
  if (serialized === null) {
    return {
      ok: false,
      config: null,
      issues: [{ field: "storage", code: "missing" }],
    };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(serialized);
  } catch {
    return {
      ok: false,
      config: null,
      issues: [{ field: "storage", code: "malformed" }],
    };
  }
  if (!isRecord(payload) || payload.version !== 1) {
    return {
      ok: false,
      config: null,
      issues: [
        {
          field: "storage",
          code: "unsupported-version",
          value: isRecord(payload) ? payload.version : undefined,
        },
      ],
    };
  }

  const validation = validateConfiguration(payload.config, catalog);
  if (!validation.ok) {
    return {
      ok: false,
      config: null,
      issues: validation.issues,
    };
  }
  return {
    ok: true,
    config: cloneConfiguration(payload.config as MechConfiguration),
    issues: [],
  };
}

export function createSavedConfigurationController({
  storage = window.localStorage,
  delayMs = 250,
}: {
  storage?: StorageLike;
  delayMs?: number;
} = {}): SavedConfigurationController {
  let pending: MechConfiguration | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clearPendingTimer = (): void => {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
  };

  const flush = (): SaveConfigurationResult => {
    clearPendingTimer();
    if (pending === null) return { ok: true };
    const config = pending;
    pending = null;
    return saveConfiguration(config, storage);
  };

  return {
    schedule(config) {
      if (!validateConfiguration(config, catalog).ok) return false;
      pending = cloneConfiguration(config);
      clearPendingTimer();
      timer = setTimeout(flush, delayMs);
      return true;
    },
    flush,
    dispose() {
      clearPendingTimer();
      pending = null;
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneConfiguration(
  config: MechConfiguration,
): MechConfiguration {
  return {
    ...config,
    finish: { ...config.finish },
  };
}
