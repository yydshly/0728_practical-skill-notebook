import { describe, expect, it } from "vitest";
import { createInitialState } from "../src/simulation/create-initial-state";
import {
  createEncounterFixture,
  createEncounterEnemy,
  stepEncounter,
} from "../src/simulation/encounters";
import type { GameEvent, GameState } from "../src/simulation/types";

const defeat = (actorId: string): GameEvent => ({
  type: "defeated",
  actorId,
});

describe("encounter fixtures", () => {
  it.each([
    ["fresh", "training", false, []],
    [
      "wave-one",
      "wave-one",
      false,
      [
        "wave-one-crawler-a",
        "wave-one-crawler-b",
        "wave-one-warden",
      ],
    ],
    ["elite", "elite", false, ["elite-bell", "elite-crawler"]],
    ["boss", "boss", true, ["boss-sovereign"]],
    ["complete", "complete", true, []],
  ] as const)(
    "builds %s through the real initializer",
    (fixture, phase, gateOpen, ids) => {
      const state = createEncounterFixture(7481, fixture);

      expect(state.encounter.phase).toBe(phase);
      expect(state.encounter.gateOpen).toBe(gateOpen);
      expect(Object.keys(state.enemies).sort()).toEqual([...ids].sort());
      expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    },
  );

  it("rejects an unknown fixture instead of silently producing a fake state", () => {
    expect(() => createEncounterFixture(1, "missing" as "fresh")).toThrow(
      "Unknown encounter fixture: missing",
    );
  });
});

describe("complete encounter arc", () => {
  it("spawns training only after entering the zone and completes both nonlethal lessons", () => {
    const initial = createInitialState(1);
    const outside = stepEncounter(initial, []);
    expect(outside.state.enemies).toEqual({});

    const inside = stepEncounter(
      {
        ...initial,
        player: {
          ...initial.player,
          position: { x: 0, y: -5 },
        },
      },
      [],
    );
    expect(Object.keys(inside.state.enemies)).toEqual([
      "training-crawler",
    ]);
    expect(inside.state.enemies["training-crawler"]!.nonlethal).toBe(true);

    const afterAttack = stepEncounter(inside.state, [
      {
        type: "damage",
        targetId: "training-crawler",
        amount: 18,
        guarded: false,
      },
    ]);
    const afterGuard = stepEncounter(afterAttack.state, [
      {
        type: "damage",
        targetId: "player",
        amount: 5,
        guarded: true,
      },
    ]);
    expect(afterGuard.state.encounter).toMatchObject({
      phase: "wave-one",
      trainingAttackSeen: true,
      trainingGuardSeen: true,
    });
    expect(Object.keys(afterGuard.state.enemies).sort()).toEqual([
      "wave-one-crawler-a",
      "wave-one-crawler-b",
      "wave-one-warden",
    ]);
    expect(afterGuard.events).toContainEqual({
      type: "encounter-phase",
      phase: "wave-one",
    });
  });

  it("offers the upgrade once after wave one and does not duplicate spawns or events", () => {
    const state = createEncounterFixture(2, "wave-one");
    const events = [
      defeat("wave-one-crawler-a"),
      defeat("wave-one-crawler-b"),
      defeat("wave-one-warden"),
    ];

    const first = stepEncounter(state, events);
    const repeated = stepEncounter(first.state, events);

    expect(first.state).toMatchObject({
      status: "upgrade",
      encounter: { phase: "elite", gateOpen: false },
    });
    expect(first.events.filter(({ type }) => type === "upgrade-offered")).toEqual(
      [{ type: "upgrade-offered" }],
    );
    expect(repeated.events).toEqual([]);
    expect(Object.keys(repeated.state.enemies)).toEqual([]);
  });

  it("opens the boss gate only after both elite actors are defeated", () => {
    const state = createEncounterFixture(3, "elite");
    const partial = stepEncounter(state, [defeat("elite-bell")]);
    expect(partial.state.encounter.gateOpen).toBe(false);
    expect(partial.state.encounter.phase).toBe("elite");

    const complete = stepEncounter(partial.state, [
      defeat("elite-crawler"),
    ]);
    expect(complete.state.encounter).toMatchObject({
      phase: "boss",
      gateOpen: true,
    });
    expect(Object.keys(complete.state.enemies)).toEqual([
      "boss-sovereign",
    ]);
  });

  it("emits completion once and enemy death remains idempotent", () => {
    const state = createEncounterFixture(4, "boss");
    const first = stepEncounter(state, [defeat("boss-sovereign")]);
    const repeated = stepEncounter(first.state, [
      defeat("boss-sovereign"),
    ]);

    expect(first.state.status).toBe("complete");
    expect(first.state.encounter.phase).toBe("complete");
    expect(first.events).toEqual([
      { type: "encounter-complete" },
      { type: "encounter-phase", phase: "complete" },
    ]);
    expect(repeated.state).toBe(first.state);
    expect(repeated.events).toEqual([]);
  });

  it("summons once at 65% and 30%, serializes thresholds, and keeps the summon cap", () => {
    let state = createEncounterFixture(5, "boss");
    const boss = state.enemies["boss-sovereign"]!;

    state = {
      ...state,
      enemies: {
        ...state.enemies,
        [boss.id]: {
          ...boss,
          health: Math.floor(boss.maxHealth * 0.65),
        },
      },
    };
    const phaseTwo = stepEncounter(state, []);
    const repeatedTwo = stepEncounter(phaseTwo.state, []);
    expect(Object.keys(phaseTwo.state.enemies).sort()).toEqual([
      "boss-sovereign",
      "boss-summon-65-crawler",
    ]);
    expect(phaseTwo.state.encounter.bossThresholds).toEqual({
      65: true,
      30: false,
    });
    expect(repeatedTwo.events).toEqual([]);

    const currentBoss = repeatedTwo.state.enemies["boss-sovereign"]!;
    const phaseThree = stepEncounter(
      {
        ...repeatedTwo.state,
        enemies: {
          ...repeatedTwo.state.enemies,
          [currentBoss.id]: {
            ...currentBoss,
            health: Math.floor(currentBoss.maxHealth * 0.3),
          },
        },
      },
      [],
    );
    const enemyIds = Object.keys(phaseThree.state.enemies).sort();
    expect(enemyIds).toEqual([
      "boss-sovereign",
      "boss-summon-30-warden",
      "boss-summon-65-crawler",
    ]);
    expect(phaseThree.state.encounter.bossThresholds).toEqual({
      65: true,
      30: true,
    });
    expect(enemyIds).toHaveLength(3);
    expect(JSON.parse(JSON.stringify(phaseThree.state))).toEqual(
      phaseThree.state,
    );
  });

  it("is pure, stable across record order, and reset creates the original fixture", () => {
    const state = createEncounterFixture(6, "elite");
    const reversed = {
      ...state,
      enemies: Object.fromEntries(Object.entries(state.enemies).reverse()),
    };
    const before = JSON.stringify(reversed);

    const first = stepEncounter(reversed, []);
    const second = stepEncounter(
      JSON.parse(before) as GameState,
      [],
    );

    expect(first).toEqual(second);
    expect(JSON.stringify(reversed)).toBe(before);
    expect(createEncounterFixture(6, "elite")).toEqual(state);
  });

  it("keeps training damage nonlethal while regular enemy damage may defeat", () => {
    const training = createEncounterEnemy(
      "training-crawler",
      "glass-crawler",
      { x: 0, y: -5 },
      { nonlethal: true },
    );
    expect(training.nonlethal).toBe(true);
    const regular = createEncounterEnemy(
      "wave-one-crawler-a",
      "glass-crawler",
      { x: 0, y: 0 },
    );
    expect(regular.nonlethal).toBe(false);
  });
});
