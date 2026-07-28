import { describe, expect, it } from "vitest";
import { createInitialState } from "../src/simulation/create-initial-state";
import { createEncounterFixture } from "../src/simulation/encounters";
import {
  ASHFALL_SAVE_KEY,
  clearSave,
  createStateFromSave,
  parseSave,
  readSave,
  serializeSave,
  writeSave,
  type SaveStorage,
} from "../src/persistence/save-game";
import type { GameState } from "../src/simulation/types";

class MemoryStorage implements SaveStorage {
  readonly values = new Map<string, string>();
  reads: string[] = [];
  writes: Array<[string, string]> = [];
  removals: string[] = [];
  fail: "read" | "write" | "remove" | null = null;

  getItem(key: string): string | null {
    this.reads.push(key);
    if (this.fail === "read") throw new Error("blocked");
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.fail === "write") throw new Error("quota");
    this.writes.push([key, value]);
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    if (this.fail === "remove") throw new Error("blocked");
    this.removals.push(key);
    this.values.delete(key);
  }
}

const savedEliteState = (): GameState => {
  const fixture = createEncounterFixture(7481, "elite");
  return {
    ...fixture,
    player: {
      ...fixture.player,
      health: 91,
      maxHealth: 125,
      healingCharges: 2,
      souls: 55,
      powerMultiplier: 1,
      upgradeId: "vitality",
      weaponId: "ember-bow",
    },
    claimedDropIds: [
      "wave-one-crawler-a:souls",
      "wave-one-crawler-b:souls",
      "wave-one-warden:souls",
    ],
  };
};

describe("versioned save schema", () => {
  it("serializes a deterministic minimal checkpoint and no simulation transient", () => {
    const source = savedEliteState();
    const dirty: GameState = {
      ...source,
      tick: 1234,
      paused: true,
      drops: [{
        id: "active:souls",
        definitionId: "glass-crawler-souls",
        position: { x: 1, y: 2 },
      }],
      combat: {
        ...source.combat,
        receivedAttackIds: ["enemy:attack:7"],
      },
    };
    const serialized = serializeSave(dirty);

    expect(serialized).toBe(
      '{"version":1,"seed":7481,"player":{"health":91,"maxHealth":125,"weaponId":"ember-bow","healingCharges":2,"souls":55,"powerMultiplier":1,"upgradeId":"vitality","claimedRewardIds":["wave-one-crawler-a:souls","wave-one-crawler-b:souls","wave-one-warden:souls"]},"encounter":{"phase":"elite"},"completion":false}',
    );
    expect(serialized).not.toMatch(
      /tick|paused|drops|enemy|projectile|attackSequence|renderer|input/,
    );
    expect(serializeSave(JSON.parse(JSON.stringify(dirty)) as GameState))
      .toBe(serialized);
  });

  it.each([
    ["unsupported-version", '{"version":99}'],
    ["malformed-json", "{"],
    ["invalid-schema", "null"],
    [
      "invalid-schema",
      '{"version":1,"seed":1,"player":{"health":"91","maxHealth":125,"weaponId":"ember-bow","healingCharges":2,"souls":55,"powerMultiplier":1,"upgradeId":"vitality","claimedRewardIds":[]},"encounter":{"phase":"elite"},"completion":false}',
    ],
    [
      "invalid-schema",
      '{"version":1,"seed":1,"player":{"health":91,"maxHealth":125,"weaponId":"forged","healingCharges":2,"souls":55,"powerMultiplier":1,"upgradeId":"vitality","claimedRewardIds":[]},"encounter":{"phase":"elite"},"completion":false}',
    ],
    [
      "invalid-schema",
      '{"version":1,"seed":1,"player":{"health":91,"maxHealth":125,"weaponId":"ember-bow","healingCharges":4,"souls":55,"powerMultiplier":1,"upgradeId":"vitality","claimedRewardIds":[]},"encounter":{"phase":"elite"},"completion":false}',
    ],
    [
      "invalid-schema",
      '{"version":1,"seed":1,"player":{"health":91,"maxHealth":125,"weaponId":"ember-bow","healingCharges":2,"souls":-1,"powerMultiplier":1,"upgradeId":"vitality","claimedRewardIds":[]},"encounter":{"phase":"elite"},"completion":false}',
    ],
    [
      "invalid-schema",
      '{"version":1,"seed":1,"player":{"health":91,"maxHealth":125,"weaponId":"ember-bow","healingCharges":2,"souls":55,"powerMultiplier":1.2,"upgradeId":"vitality","claimedRewardIds":[]},"encounter":{"phase":"elite"},"completion":false}',
    ],
    [
      "invalid-schema",
      '{"version":1,"seed":1,"player":{"health":91,"maxHealth":125,"weaponId":"ember-bow","healingCharges":2,"souls":55,"powerMultiplier":1,"upgradeId":"vitality","claimedRewardIds":["forged:souls"]},"encounter":{"phase":"elite"},"completion":false}',
    ],
    [
      "invalid-schema",
      '{"version":1,"seed":1,"player":{"health":91,"maxHealth":125,"weaponId":"ember-bow","healingCharges":2,"souls":55,"powerMultiplier":1,"upgradeId":"vitality","claimedRewardIds":[]},"encounter":{"phase":"complete"},"completion":false}',
    ],
    [
      "invalid-schema",
      '{"version":1,"seed":1e999,"player":{"health":91,"maxHealth":125,"weaponId":"ember-bow","healingCharges":2,"souls":55,"powerMultiplier":1,"upgradeId":"vitality","claimedRewardIds":[]},"encounter":{"phase":"elite"},"completion":false}',
    ],
  ] as const)("returns %s for invalid data without throwing", (reason, raw) => {
    expect(parseSave(raw)).toEqual({ ok: false, reason });
  });

  it("parses the canonical save and returns an independent value", () => {
    const raw = serializeSave(savedEliteState());
    const first = parseSave(raw);
    const second = parseSave(raw);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first).toMatchObject({
      ok: true,
      save: {
        version: 1,
        seed: 7481,
        encounter: { phase: "elite" },
        completion: false,
      },
    });
  });
});

describe("safe storage adapter", () => {
  it("writes and reads only the exact save key after schema validation", () => {
    const storage = new MemoryStorage();
    const write = writeSave(savedEliteState(), storage);
    const read = readSave(storage);

    expect(write).toEqual({ ok: true });
    expect(read).toMatchObject({ ok: true });
    expect(storage.writes).toHaveLength(1);
    expect(storage.writes[0]![0]).toBe(ASHFALL_SAVE_KEY);
    expect(storage.reads).toEqual([ASHFALL_SAVE_KEY]);
  });

  it.each(["read", "write", "remove"] as const)(
    "contains %s failures without breaking the run",
    (failure) => {
      const storage = new MemoryStorage();
      storage.values.set(ASHFALL_SAVE_KEY, serializeSave(savedEliteState()));
      storage.fail = failure;

      const result =
        failure === "read"
          ? readSave(storage)
          : failure === "write"
            ? writeSave(savedEliteState(), storage)
            : clearSave(storage);
      expect(result).toEqual({ ok: false, reason: "storage-unavailable" });
    },
  );

  it("reports a corrupt save without rewriting or removing storage", () => {
    const storage = new MemoryStorage();
    storage.values.set(ASHFALL_SAVE_KEY, "{");
    expect(readSave(storage)).toEqual({
      ok: false,
      reason: "malformed-json",
    });
    expect(storage.writes).toEqual([]);
    expect(storage.removals).toEqual([]);
  });

  it("new run clears only the exact key", () => {
    const storage = new MemoryStorage();
    storage.values.set(ASHFALL_SAVE_KEY, "save");
    storage.values.set("another-product:v1", "keep");
    expect(clearSave(storage)).toEqual({ ok: true });
    expect(storage.removals).toEqual([ASHFALL_SAVE_KEY]);
    expect(storage.values.get("another-product:v1")).toBe("keep");
  });
});

describe("authoritative continuation and retry", () => {
  it("builds continuation from a fresh authoritative fixture and clears transients", () => {
    const parsed = parseSave(serializeSave(savedEliteState()));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const restored = createStateFromSave(parsed.save, "continue");

    expect(restored).toMatchObject({
      status: "playing",
      paused: false,
      tick: 0,
      encounter: { phase: "elite", gateOpen: false },
      player: {
        health: 91,
        maxHealth: 125,
        stamina: 100,
        weaponId: "ember-bow",
        healingCharges: 2,
        souls: 55,
        upgradeId: "vitality",
      },
    });
    expect(Object.keys(restored.enemies).sort()).toEqual([
      "elite-bell",
      "elite-crawler",
    ]);
    expect(restored.drops).toEqual([]);
    expect(restored.combat.projectiles).toEqual([]);
    expect(restored.combat.enemyProjectiles).toEqual([]);
  });

  it("retry restores the latest checkpoint at full vitals without losing progression", () => {
    const parsed = parseSave(serializeSave(savedEliteState()));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const retry = createStateFromSave(parsed.save, "retry");
    const repeated = createStateFromSave(parsed.save, "retry");

    expect(retry.player).toMatchObject({
      health: 125,
      maxHealth: 125,
      stamina: 100,
      weaponId: "ember-bow",
      healingCharges: 2,
      souls: 55,
      powerMultiplier: 1,
      upgradeId: "vitality",
    });
    expect(retry).toEqual(repeated);
    expect(Object.keys(retry.enemies).sort()).toEqual([
      "elite-bell",
      "elite-crawler",
    ]);
    expect(retry.drops).toEqual([]);
  });

  it("reloads a completion record with terminal continuation semantics", () => {
    const complete = createEncounterFixture(77, "complete");
    const parsed = parseSave(serializeSave(complete));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const restored = createStateFromSave(parsed.save, "continue");
    expect(restored.status).toBe("complete");
    expect(restored.encounter).toMatchObject({
      phase: "complete",
      gateOpen: true,
    });
    expect(restored.enemies).toEqual({});
  });
});
