import {
  createEncounterFixture,
  type EncounterFixture,
} from "../simulation/encounters";
import type {
  EncounterPhase,
  GameState,
  WeaponId,
} from "../simulation/types";

export const ASHFALL_SAVE_KEY = "ashfall-arena:v1";

export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface AshfallSaveV1 {
  readonly version: 1;
  readonly seed: number;
  readonly player: Readonly<{
    health: number;
    maxHealth: 105 | 125;
    weaponId: WeaponId;
    healingCharges: number;
    souls: number;
    powerMultiplier: 1 | 1.2;
    upgradeId: "vitality" | "power" | null;
    claimedRewardIds: readonly string[];
  }>;
  readonly encounter: Readonly<{
    phase: EncounterPhase;
  }>;
  readonly completion: boolean;
}

export type SaveFailureReason =
  | "missing-save"
  | "malformed-json"
  | "unsupported-version"
  | "invalid-schema"
  | "storage-unavailable";

export type ParseSaveResult =
  | { ok: true; save: AshfallSaveV1 }
  | { ok: false; reason: SaveFailureReason };

export type SaveOperationResult =
  | { ok: true }
  | { ok: false; reason: "storage-unavailable" | "invalid-schema" };

const ENCOUNTER_PHASES = new Set<EncounterPhase>([
  "training",
  "wave-one",
  "elite",
  "boss",
  "complete",
]);
const WEAPONS = new Set<WeaponId>(["oathblade", "ember-bow"]);
const KNOWN_REWARD_IDS = new Set([
  "wave-one-crawler-a:souls",
  "wave-one-crawler-b:souls",
  "wave-one-warden:souls",
  "elite-bell:souls",
  "elite-bell:healing",
  "elite-crawler:souls",
  "boss-summon-65-crawler:souls",
  "boss-summon-30-warden:souls",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasExactKeys = (
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
};

const isSafeSeed = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  !Object.is(value, -0);

const isBoundedInteger = (
  value: unknown,
  minimum: number,
  maximum: number,
): value is number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= minimum &&
  value <= maximum;

const isValidPlayer = (
  value: unknown,
): value is AshfallSaveV1["player"] => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "health",
      "maxHealth",
      "weaponId",
      "healingCharges",
      "souls",
      "powerMultiplier",
      "upgradeId",
      "claimedRewardIds",
    ])
  ) {
    return false;
  }
  const maxHealth =
    value.maxHealth === 105 || value.maxHealth === 125
      ? value.maxHealth
      : null;
  if (
    maxHealth === null ||
    !isBoundedInteger(value.health, 0, maxHealth) ||
    typeof value.weaponId !== "string" ||
    !WEAPONS.has(value.weaponId as WeaponId) ||
    !isBoundedInteger(value.healingCharges, 0, 3) ||
    !isBoundedInteger(value.souls, 0, Number.MAX_SAFE_INTEGER) ||
    (value.powerMultiplier !== 1 && value.powerMultiplier !== 1.2) ||
    (value.upgradeId !== null &&
      value.upgradeId !== "vitality" &&
      value.upgradeId !== "power") ||
    !Array.isArray(value.claimedRewardIds) ||
    value.claimedRewardIds.some(
      (id) => typeof id !== "string" || !KNOWN_REWARD_IDS.has(id),
    ) ||
    new Set(value.claimedRewardIds).size !== value.claimedRewardIds.length
  ) {
    return false;
  }
  if (
    value.upgradeId === "vitality" &&
    (maxHealth !== 125 || value.powerMultiplier !== 1)
  ) {
    return false;
  }
  if (
    value.upgradeId === "power" &&
    (maxHealth !== 105 || value.powerMultiplier !== 1.2)
  ) {
    return false;
  }
  if (
    value.upgradeId === null &&
    (maxHealth !== 105 || value.powerMultiplier !== 1)
  ) {
    return false;
  }
  return true;
};

const normalizeSave = (value: unknown): AshfallSaveV1 | null => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "version",
      "seed",
      "player",
      "encounter",
      "completion",
    ]) ||
    value.version !== 1 ||
    !isSafeSeed(value.seed) ||
    !isValidPlayer(value.player) ||
    !isRecord(value.encounter) ||
    !hasExactKeys(value.encounter, ["phase"]) ||
    typeof value.encounter.phase !== "string" ||
    !ENCOUNTER_PHASES.has(value.encounter.phase as EncounterPhase) ||
    typeof value.completion !== "boolean"
  ) {
    return null;
  }
  const phase = value.encounter.phase as EncounterPhase;
  if (value.completion !== (phase === "complete")) return null;

  return {
    version: 1,
    seed: value.seed,
    player: {
      health: value.player.health,
      maxHealth: value.player.maxHealth,
      weaponId: value.player.weaponId,
      healingCharges: value.player.healingCharges,
      souls: value.player.souls,
      powerMultiplier: value.player.powerMultiplier,
      upgradeId: value.player.upgradeId,
      claimedRewardIds: [...value.player.claimedRewardIds].sort(),
    },
    encounter: { phase },
    completion: value.completion,
  };
};

const saveFromState = (state: GameState): AshfallSaveV1 => ({
  version: 1,
  seed: state.seed,
  player: {
    health: state.player.health,
    maxHealth: state.player.maxHealth as 105 | 125,
    weaponId: state.player.weaponId,
    healingCharges: state.player.healingCharges,
    souls: state.player.souls,
    powerMultiplier: state.player.powerMultiplier,
    upgradeId: state.player.upgradeId,
    claimedRewardIds: [...state.claimedDropIds].sort(),
  },
  encounter: { phase: state.encounter.phase },
  completion:
    state.status === "complete" &&
    state.encounter.phase === "complete",
});

const canonicalStringify = (save: AshfallSaveV1): string =>
  JSON.stringify({
    version: 1,
    seed: save.seed,
    player: {
      health: save.player.health,
      maxHealth: save.player.maxHealth,
      weaponId: save.player.weaponId,
      healingCharges: save.player.healingCharges,
      souls: save.player.souls,
      powerMultiplier: save.player.powerMultiplier,
      upgradeId: save.player.upgradeId,
      claimedRewardIds: [...save.player.claimedRewardIds],
    },
    encounter: { phase: save.encounter.phase },
    completion: save.completion,
  });

export function serializeSave(state: GameState): string {
  const save = normalizeSave(saveFromState(state));
  if (!save) throw new TypeError("state is not a valid save checkpoint");
  return canonicalStringify(save);
}

export function parseSave(raw: unknown): ParseSaveResult {
  if (typeof raw !== "string") {
    return { ok: false, reason: "invalid-schema" };
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "malformed-json" };
  }
  if (
    isRecord(value) &&
    "version" in value &&
    value.version !== 1
  ) {
    return { ok: false, reason: "unsupported-version" };
  }
  const save = normalizeSave(value);
  return save
    ? { ok: true, save }
    : { ok: false, reason: "invalid-schema" };
}

export function writeSave(
  state: GameState,
  storage: SaveStorage,
): SaveOperationResult {
  let serialized: string;
  try {
    serialized = serializeSave(state);
  } catch {
    return { ok: false, reason: "invalid-schema" };
  }
  try {
    storage.setItem(ASHFALL_SAVE_KEY, serialized);
    return { ok: true };
  } catch {
    return { ok: false, reason: "storage-unavailable" };
  }
}

export function readSave(storage: SaveStorage): ParseSaveResult {
  let raw: string | null;
  try {
    raw = storage.getItem(ASHFALL_SAVE_KEY);
  } catch {
    return { ok: false, reason: "storage-unavailable" };
  }
  return raw === null
    ? { ok: false, reason: "missing-save" }
    : parseSave(raw);
}

export function clearSave(
  storage: SaveStorage,
): SaveOperationResult {
  try {
    storage.removeItem(ASHFALL_SAVE_KEY);
    return { ok: true };
  } catch {
    return { ok: false, reason: "storage-unavailable" };
  }
}

const fixtureForPhase = (phase: EncounterPhase): EncounterFixture =>
  phase === "training" ? "fresh" : phase;

export function createStateFromSave(
  save: AshfallSaveV1,
  mode: "continue" | "retry",
): GameState {
  const normalized = normalizeSave(save);
  if (!normalized) {
    throw new TypeError("save must be validated before restoration");
  }
  const fixture = createEncounterFixture(
    normalized.seed,
    fixtureForPhase(normalized.encounter.phase),
  );
  return {
    ...fixture,
    status: normalized.completion ? "complete" : "playing",
    paused: false,
    drops: [],
    rewardedEnemyIds: [],
    claimedDropIds: [...normalized.player.claimedRewardIds],
    player: {
      ...fixture.player,
      health:
        mode === "retry"
          ? normalized.player.maxHealth
          : normalized.player.health,
      maxHealth: normalized.player.maxHealth,
      stamina: fixture.player.maxStamina,
      weaponId: normalized.player.weaponId,
      healingCharges: normalized.player.healingCharges,
      souls: normalized.player.souls,
      powerMultiplier: normalized.player.powerMultiplier,
      upgradeId: normalized.player.upgradeId,
      action: "idle",
      actionTime: 0,
      lockTargetId: null,
    },
  };
}
