import { describe, expect, it } from "vitest";
import { arenaContent } from "../src/content/arena-content";
import { createInitialState } from "../src/simulation/create-initial-state";
import {
  createEncounterEnemy,
  createEncounterFixture,
} from "../src/simulation/encounters";
import {
  applyUpgrade,
  collectDrop,
  createDropsForDefeats,
  dropDefinitions,
  settlePendingDrops,
  useHealingCharge,
} from "../src/simulation/inventory";
import { stepGame } from "../src/simulation/step-game";
import type { GameEvent, GameState } from "../src/simulation/types";
import { neutralIntent } from "./helpers/simulation-fixtures";

const defeated = (actorId: string): GameEvent => ({
  type: "defeated",
  actorId,
});

describe("authoritative drops", () => {
  it("creates fixed definition-backed drops once for every eligible defeated enemy", () => {
    const source = createEncounterFixture(21, "elite");
    const before = JSON.stringify(source);
    const first = createDropsForDefeats(source, [
      defeated("elite-bell"),
      defeated("elite-crawler"),
    ]);
    const repeated = createDropsForDefeats(first.state, [
      defeated("elite-bell"),
      defeated("elite-crawler"),
      defeated("elite-bell"),
    ]);

    expect(first.state.drops).toEqual([
      {
        id: "elite-bell:souls",
        definitionId: "bell-elite-souls",
        position: { x: 0, y: 6.7 },
      },
      {
        id: "elite-bell:healing",
        definitionId: "bell-elite-healing",
        position: { x: 0.25, y: 6.7 },
      },
      {
        id: "elite-crawler:souls",
        definitionId: "glass-crawler-souls",
        position: { x: 2.2, y: 5.3 },
      },
    ]);
    expect(first.events).toEqual([
      { type: "drop", dropId: "elite-bell:souls" },
      { type: "drop", dropId: "elite-bell:healing" },
      { type: "drop", dropId: "elite-crawler:souls" },
    ]);
    expect(repeated.state).toBe(first.state);
    expect(repeated.events).toEqual([]);
    expect(JSON.stringify(source)).toBe(before);
  });

  it("never creates rewards for training, the boss, an unknown actor, or a forged event", () => {
    const training = createEncounterFixture(22, "fresh");
    const boss = createEncounterFixture(23, "boss");
    const trainingResult = createDropsForDefeats(training, [
      defeated("training-crawler"),
      defeated("missing-enemy"),
    ]);
    const bossResult = createDropsForDefeats(boss, [
      defeated("boss-sovereign"),
    ]);

    expect(trainingResult.state).toBe(training);
    expect(trainingResult.events).toEqual([]);
    expect(bossResult.state).toBe(boss);
    expect(bossResult.events).toEqual([]);
  });

  it("collects an existing in-range drop exactly once and conserves reward identity", () => {
    const source = createInitialState(24);
    const state: GameState = {
      ...source,
      player: {
        ...source.player,
        position: { x: 0, y: 0 },
        healingCharges: 2,
      },
      drops: [
        {
          id: "enemy-a:souls",
          definitionId: "ash-warden-souls",
          position: { x: 0.5, y: 0 },
        },
        {
          id: "enemy-b:healing",
          definitionId: "bell-elite-healing",
          position: { x: 0.8, y: 0 },
        },
      ],
    };
    const before = JSON.stringify(state);

    const souls = collectDrop(state, "enemy-a:souls");
    const healing = collectDrop(souls, "enemy-b:healing");
    const repeated = collectDrop(healing, "enemy-a:souls");

    expect(souls.player.souls).toBe(15);
    expect(healing.player.healingCharges).toBe(3);
    expect(healing.drops).toEqual([]);
    expect(healing.claimedDropIds).toEqual([
      "enemy-a:souls",
      "enemy-b:healing",
    ]);
    expect(repeated).toBe(healing);
    expect(JSON.stringify(state)).toBe(before);
    expect(
      souls.player.souls +
        souls.drops.reduce(
          (total, drop) =>
            total +
            (dropDefinitions[drop.definitionId].kind === "souls"
              ? dropDefinitions[drop.definitionId].amount
              : 0),
          0,
        ),
    ).toBe(15);
  });

  it.each([
    ["missing", (state: GameState) => state],
    [
      "out-of-range",
      (state: GameState) => ({
        ...state,
        drops: [{
          id: "souls-1",
          definitionId: "glass-crawler-souls" as const,
          position: { x: 9, y: 9 },
        }],
      }),
    ],
    [
      "paused",
      (state: GameState) => ({
        ...state,
        paused: true,
        drops: [{
          id: "souls-1",
          definitionId: "glass-crawler-souls" as const,
          position: { ...state.player.position },
        }],
      }),
    ],
    [
      "not-playing",
      (state: GameState) => ({
        ...state,
        status: "upgrade" as const,
        drops: [{
          id: "souls-1",
          definitionId: "glass-crawler-souls" as const,
          position: { ...state.player.position },
        }],
      }),
    ],
    [
      "forged-definition",
      (state: GameState) => ({
        ...state,
        drops: [{
          id: "souls-1",
          definitionId: "forged" as "glass-crawler-souls",
          position: { ...state.player.position },
        }],
      }),
    ],
  ] as const)(
    "rejects %s pickup atomically",
    (_, arrange) => {
      const state = arrange(createInitialState(25));
      const before = JSON.stringify(state);
      const result = collectDrop(state, "souls-1");
      expect(result).toBe(state);
      expect(JSON.stringify(state)).toBe(before);
    },
  );

  it("settles phase-boundary rewards explicitly without persisting active drops", () => {
    const source = createInitialState(26);
    const state: GameState = {
      ...source,
      player: { ...source.player, healingCharges: 3 },
      drops: [
        {
          id: "warden:souls",
          definitionId: "ash-warden-souls",
          position: { x: 9, y: 9 },
        },
        {
          id: "elite:healing",
          definitionId: "bell-elite-healing",
          position: { x: 9, y: 9 },
        },
      ],
    };
    const settled = settlePendingDrops(state);
    expect(settled.player).toMatchObject({
      souls: 15,
      healingCharges: 3,
    });
    expect(settled.drops).toEqual([]);
    expect(settled.claimedDropIds).toEqual([
      "warden:souls",
      "elite:healing",
    ]);
    expect(settlePendingDrops(settled)).toBe(settled);
  });
});

describe("one upgrade", () => {
  it.each([
    [
      "vitality",
      {
        health: 120,
        maxHealth: 125,
        powerMultiplier: 1,
        upgradeId: "vitality",
      },
    ],
    [
      "power",
      {
        health: 100,
        maxHealth: 105,
        powerMultiplier: 1.2,
        upgradeId: "power",
      },
    ],
  ] as const)("applies %s once and enters the authoritative elite spawn", (id, player) => {
    const base = createEncounterFixture(31, "wave-one");
    const state: GameState = {
      ...base,
      status: "upgrade",
      player: {
        ...base.player,
        health: 100,
        maxHealth: 105,
        powerMultiplier: 1,
        upgradeId: null,
      },
      enemies: {},
      encounter: {
        ...base.encounter,
        phase: "wave-one",
        spawnedIds: [],
      },
    };
    const before = JSON.stringify(state);
    const upgraded = applyUpgrade(state, id);

    expect(upgraded.status).toBe("playing");
    expect(upgraded.player).toMatchObject(player);
    expect(Object.keys(upgraded.enemies).sort()).toEqual([
      "elite-bell",
      "elite-crawler",
    ]);
    expect(JSON.stringify(state)).toBe(before);
    expect(() => applyUpgrade(upgraded, id === "power" ? "vitality" : "power"))
      .toThrow("upgrade already chosen");
  });

  it("rejects an upgrade outside the offer without changing the state", () => {
    const state = createInitialState(32);
    const before = JSON.stringify(state);
    expect(() => applyUpgrade(state, "power")).toThrow(
      "upgrade is not currently offered",
    );
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe("healing charge", () => {
  it("heals 35 with a maximum-health clamp and consumes exactly one charge", () => {
    const source = createInitialState(41);
    const state = {
      ...source,
      player: { ...source.player, health: 80 },
    };
    const healed = useHealingCharge(state);
    expect(healed.player).toMatchObject({
      health: 105,
      healingCharges: 2,
    });
    expect(state.player).toMatchObject({
      health: 80,
      healingCharges: 3,
    });
  });

  it.each([
    ["full-health", {}],
    ["zero-charges", { health: 60, healingCharges: 0 }],
    ["attack", { health: 60, action: "attack" }],
    ["dodge", { health: 60, action: "dodge" }],
    ["hit", { health: 60, action: "hit" }],
    ["dead", { health: 0, action: "dead" }],
  ] as const)("rejects %s without changing identity", (_, overrides) => {
    const source = createInitialState(42);
    const state = {
      ...source,
      player: { ...source.player, ...overrides },
    } as GameState;
    expect(useHealingCharge(state)).toBe(state);
  });

  it.each([
    ["paused", { paused: true }],
    ["upgrade", { status: "upgrade" }],
    ["defeated", { status: "defeated" }],
    ["complete", { status: "complete" }],
  ] as const)("rejects %s game state without changing identity", (_, overrides) => {
    const source = createInitialState(43);
    const state = {
      ...source,
      ...overrides,
      player: { ...source.player, health: 60 },
    } as GameState;
    expect(useHealingCharge(state)).toBe(state);
  });
});

describe("stepGame progression integration", () => {
  it("routes a real combat defeat through fixed drop creation and in-range collection once", () => {
    const source = createInitialState(51);
    const enemy = createEncounterEnemy(
      "reward-crawler",
      "glass-crawler",
      { x: 0, y: -7.8 },
      {
        health: 18,
        aiEnabled: false,
      },
    );
    let state: GameState = {
      ...source,
      encounter: {
        ...source.encounter,
        phase: "boss",
        gateOpen: true,
      },
      enemies: { [enemy.id]: enemy },
    };
    const events: GameEvent[] = [];

    for (let tick = 0; tick < 60; tick += 1) {
      const result = stepGame(
        state,
        {
          ...neutralIntent,
          attackPressed: tick === 0,
        },
        1 / 60,
        arenaContent,
      );
      state = result.state;
      events.push(...result.events);
    }

    expect(events).toContainEqual({
      type: "defeated",
      actorId: "reward-crawler",
    });
    expect(events).toContainEqual({
      type: "drop",
      dropId: "reward-crawler:souls",
    });
    expect(state.player.souls).toBe(10);
    expect(state.claimedDropIds).toEqual(["reward-crawler:souls"]);
    expect(state.drops).toEqual([]);
  });

  it("consumes the normalized heal edge but rejects simultaneous attack or dodge", () => {
    const source = createInitialState(52);
    const injured: GameState = {
      ...source,
      player: { ...source.player, health: 40 },
    };
    const healed = stepGame(
      injured,
      { ...neutralIntent, healPressed: true },
      1 / 60,
      arenaContent,
    ).state;
    const attackConflict = stepGame(
      injured,
      {
        ...neutralIntent,
        healPressed: true,
        attackPressed: true,
      },
      1 / 60,
      arenaContent,
    ).state;
    const dodgeConflict = stepGame(
      injured,
      {
        ...neutralIntent,
        healPressed: true,
        dodgePressed: true,
      },
      1 / 60,
      arenaContent,
    ).state;

    expect(healed.player).toMatchObject({
      health: 75,
      healingCharges: 2,
    });
    expect(attackConflict.player.health).toBe(40);
    expect(dodgeConflict.player.health).toBe(40);
  });

  it("settles an unclaimed summon reward before the completion checkpoint", () => {
    const source = createEncounterFixture(53, "boss");
    const boss = source.enemies["boss-sovereign"]!;
    let state: GameState = {
      ...source,
      enemies: {
        ...source.enemies,
        [boss.id]: {
          ...boss,
          position: { x: 0, y: 8.2 },
          health: 18,
          aiEnabled: false,
        },
      },
      drops: [{
        id: "boss-summon-30-warden:souls",
        definitionId: "ash-warden-souls",
        position: { x: 9, y: 9 },
      }],
    };
    for (let tick = 0; tick < 60; tick += 1) {
      state = stepGame(
        state,
        {
          ...neutralIntent,
          attackPressed: tick === 0,
        },
        1 / 60,
        arenaContent,
      ).state;
    }
    expect(state.status).toBe("complete");
    expect(state.player.souls).toBe(15);
    expect(state.drops).toEqual([]);
    expect(state.claimedDropIds).toContain(
      "boss-summon-30-warden:souls",
    );
  });
});
