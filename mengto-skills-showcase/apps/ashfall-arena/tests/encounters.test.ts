import { describe, expect, it } from "vitest";
import { arenaContent } from "../src/content/arena-content";
import { stepEnemyCombat } from "../src/simulation/combat";
import { createInitialState } from "../src/simulation/create-initial-state";
import {
  createEncounterFixture,
  createEncounterEnemy,
  stepEncounter,
} from "../src/simulation/encounters";
import * as encounterApi from "../src/simulation/encounters";
import { stepGame } from "../src/simulation/step-game";
import type { GameEvent, GameState } from "../src/simulation/types";
import { neutralIntent } from "./helpers/simulation-fixtures";

const defeat = (actorId: string): GameEvent => ({
  type: "defeated",
  actorId,
});

const withEnemyTransients = (source: GameState): GameState => {
  const firstEnemy = Object.values(source.enemies)
    .sort((left, right) => left.id.localeCompare(right.id))[0];
  return {
    ...source,
    enemies:
      firstEnemy === undefined
        ? source.enemies
        : {
            ...source.enemies,
            [firstEnemy.id]: {
              ...firstEnemy,
              intent: "attack",
              currentMoveId:
                firstEnemy.kind === "ash-warden"
                  ? "warden-bolt"
                  : firstEnemy.kind === "bell-sovereign"
                    ? "sovereign-shockwave"
                    : firstEnemy.kind === "bell-elite"
                      ? "elite-sweep"
                      : "crawler-lunge",
              movePhase: "active",
              moveElapsedTicks: 1,
              cooldownTicks: 17,
              hitTargetIds: ["player"],
            },
          },
    enemyAi: {
      ...source.enemyAi,
      meleeSlotOwner: firstEnemy?.id ?? "stale-melee",
      rangedSlotOwner: "stale-ranged",
      rangedWindowUsed: true,
      supportSlotOwner: "stale-support",
    },
    combat: {
      ...source.combat,
      projectiles: [{
        id: "player-shot:projectile",
        attackId: "player-shot",
        ownerId: "player",
        position: { x: 0, y: -2 },
        direction: { x: 0, y: 1 },
        speed: 12,
        radius: 0.16,
        ageTicks: 2,
        lifetimeTicks: 75,
        targetLayer: "enemy",
        hitTargetIds: [],
      }],
      enemyProjectiles: [{
        id: "old-warden:warden-bolt:7:projectile",
        attackId: "old-warden:warden-bolt:7",
        ownerId: "old-warden",
        moveId: "warden-bolt",
        position: {
          x: source.player.position.x,
          y: source.player.position.y - 1,
        },
        direction: { x: 0, y: 1 },
        speed: 8,
        radius: 0.18,
        ageTicks: 3,
        lifetimeTicks: 90,
        targetLayer: "player",
        team: "enemy",
        hitTargetIds: [],
      }],
      spawnedEnemyAttackIds: ["old-warden:warden-bolt:7"],
      receivedAttackIds: ["old-warden:warden-bolt:6"],
    },
  };
};

const expectEnemyTransientsCleared = (state: GameState): void => {
  expect(state.combat.enemyProjectiles).toEqual([]);
  expect(state.combat.spawnedEnemyAttackIds).toEqual([]);
  expect(state.combat.receivedAttackIds).toEqual([]);
  expect(state.combat.projectiles).toHaveLength(1);
  expect(state.enemyAi).toMatchObject({
    meleeSlotOwner: null,
    rangedSlotOwner: null,
    rangedWindowUsed: false,
    supportSlotOwner: null,
  });
  for (const enemy of Object.values(state.enemies)) {
    expect(enemy.currentMoveId).toBeNull();
    expect(enemy.movePhase).toBe("none");
    expect(enemy.moveElapsedTicks).toBe(0);
    expect(enemy.cooldownTicks).toBe(0);
    expect(enemy.hitTargetIds).toEqual([]);
  }
};

describe("encounter fixtures", () => {
  it("exports a pure reusable enemy-transient reset for fixture and retry boundaries", () => {
    const clear = (
      encounterApi as typeof encounterApi & {
        clearTransientEnemyCombat?: (
          state: Readonly<GameState>,
        ) => GameState;
      }
    ).clearTransientEnemyCombat;
    expect(clear).toBeTypeOf("function");
    if (!clear) return;

    const source = withEnemyTransients(
      createEncounterFixture(700, "boss"),
    );
    const before = JSON.stringify(source);
    const result = clear(source);

    expectEnemyTransientsCleared(result);
    expect(JSON.stringify(source)).toBe(before);
    expect(clear(result)).toBe(result);
  });

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
  it.each([
    ["wave-one", ["wave-one-crawler-a", "wave-one-crawler-b", "wave-one-warden"]],
    ["elite", ["elite-bell", "elite-crawler"]],
    ["boss", ["boss-sovereign"]],
  ] as const)(
    "clears in-flight enemy attacks when %s reaches its phase boundary",
    (fixture, defeatedIds) => {
      const source = withEnemyTransients(
        createEncounterFixture(701, fixture),
      );
      const before = JSON.stringify(source);
      const result = stepEncounter(
        source,
        defeatedIds.map(defeat),
      );

      expectEnemyTransientsCleared(result.state);
      expect(JSON.stringify(source)).toBe(before);
      if (fixture === "wave-one") {
        expect(result.events).toEqual([{ type: "upgrade-offered" }]);
      } else if (fixture === "elite") {
        expect(result.events).toEqual([
          { type: "encounter-phase", phase: "boss" },
        ]);
      } else {
        expect(result.events).toEqual([
          { type: "encounter-complete" },
          { type: "encounter-phase", phase: "complete" },
        ]);
      }
    },
  );

  it("clears enemy attacks on defeat so a resumed state cannot receive an old hit", () => {
    const source = withEnemyTransients(
      createEncounterFixture(702, "wave-one"),
    );
    const defeated = stepEncounter({
      ...source,
      status: "defeated",
      player: {
        ...source.player,
        health: 0,
        action: "dead",
      },
    }, [defeat("player")]);

    expectEnemyTransientsCleared(defeated.state);
    let resumedState = {
      ...defeated.state,
      status: "playing",
      player: {
        ...defeated.state.player,
        health: defeated.state.player.maxHealth,
        action: "idle",
      },
    } as GameState;
    const resumedEvents: GameEvent[] = [];
    for (let tick = 0; tick < 12; tick += 1) {
      const result = stepGame(
        resumedState,
        neutralIntent,
        1 / 60,
        arenaContent,
      );
      resumedState = result.state;
      resumedEvents.push(...result.events);
    }
    expect(resumedState.player.health).toBe(
      resumedState.player.maxHealth,
    );
    expect(
      resumedEvents.filter(
        (event) =>
          event.type === "contact" &&
          event.attackId.startsWith("old-warden:"),
      ),
    ).toEqual([]);
  });

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

  it("keeps the real training trigger while the safe browser fixture disables only its AI", () => {
    const safe = createEncounterFixture(9, "fresh", {
      trainingAiEnabled: false,
    });
    expect(safe.enemies).toEqual({});
    expect(safe.encounter.trainingAiEnabled).toBe(false);

    const inside = stepEncounter({
      ...safe,
      player: {
        ...safe.player,
        position: { x: 0, y: -5 },
      },
    }, []);
    expect(inside.state.enemies["training-crawler"]).toMatchObject({
      aiEnabled: false,
      nonlethal: true,
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
      encounter: { phase: "wave-one", gateOpen: false },
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

  it.each([
    [
      "wave-one",
      [
        "wave-one-crawler-a",
        "wave-one-crawler-b",
        "wave-one-warden",
      ],
    ],
    ["elite", ["elite-bell", "elite-crawler"]],
    ["boss", ["boss-sovereign"]],
  ] as const)(
    "keeps defeated terminal priority during a %s mutual kill",
    (fixture, enemyIds) => {
      const source = createEncounterFixture(41, fixture);
      const state = {
        ...source,
        status: "defeated" as const,
        player: {
          ...source.player,
          health: 0,
          action: "dead" as const,
        },
      };
      const result = stepEncounter(state, [
        defeat("player"),
        ...enemyIds.map(defeat),
      ]);

      expect(result.state.status).toBe("defeated");
      expect(result.state.encounter.phase).toBe(fixture);
      expect(result.state.encounter.completedIds).toEqual(
        expect.arrayContaining([...enemyIds]),
      );
      expect(result.events).toEqual([]);
    },
  );

  it("queues Boss thresholds and spawns only from the matching active summon event", () => {
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
    ]);
    expect(phaseTwo.state.encounter.bossThresholds).toEqual({
      65: true,
      30: false,
    });
    expect(phaseTwo.state.encounter.pendingSummons).toEqual([65]);
    expect(phaseTwo.events).toEqual([
      { type: "boss-phase", phase: 2, threshold: 65 },
    ]);
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
    expect(phaseThree.state.encounter.bossThresholds).toEqual({
      65: true,
      30: true,
    });
    expect(phaseThree.state.encounter.pendingSummons).toEqual([65, 30]);

    const firstActive = stepEncounter(phaseThree.state, [{
      type: "enemy-move-active",
      enemyId: "boss-sovereign",
      moveId: "sovereign-summon",
      attackId: "boss-sovereign:sovereign-summon:1",
    }]);
    expect(Object.keys(firstActive.state.enemies).sort()).toEqual([
      "boss-sovereign",
      "boss-summon-65-crawler",
    ]);
    expect(firstActive.state.encounter.pendingSummons).toEqual([30]);
    expect(firstActive.state.encounter.completedSummons).toEqual([65]);
    expect(firstActive.events).toEqual([{
      type: "enemy-summoned",
      enemyId: "boss-summon-65-crawler",
      threshold: 65,
    }]);

    const duplicate = stepEncounter(firstActive.state, [{
      type: "enemy-move-active",
      enemyId: "boss-sovereign",
      moveId: "sovereign-summon",
      attackId: "boss-sovereign:sovereign-summon:1",
    }]);
    const secondActive = stepEncounter(duplicate.state, [{
      type: "enemy-move-active",
      enemyId: "boss-sovereign",
      moveId: "sovereign-summon",
      attackId: "boss-sovereign:sovereign-summon:2",
    }]);
    const enemyIds = Object.keys(secondActive.state.enemies).sort();
    expect(enemyIds).toEqual([
      "boss-sovereign",
      "boss-summon-30-warden",
      "boss-summon-65-crawler",
    ]);
    expect(duplicate.events).toEqual([]);
    expect(secondActive.state.encounter.pendingSummons).toEqual([]);
    expect(secondActive.state.encounter.completedSummons).toEqual([65, 30]);
    expect(enemyIds).toHaveLength(3);
    expect(JSON.parse(JSON.stringify(secondActive.state))).toEqual(
      secondActive.state,
    );
  });

  it("keeps an interrupted summon pending, freezes it while paused, and cancels it on Boss death", () => {
    const base = createEncounterFixture(55, "boss");
    const boss = base.enemies["boss-sovereign"]!;
    const queued = stepEncounter({
      ...base,
      enemies: {
        ...base.enemies,
        [boss.id]: {
          ...boss,
          health: Math.floor(boss.maxHealth * 0.65),
        },
      },
    }, []).state;
    const committed = {
      ...queued,
      enemies: {
        ...queued.enemies,
        [boss.id]: {
          ...queued.enemies[boss.id]!,
          currentMoveId: "sovereign-summon" as const,
          movePhase: "telegraph" as const,
          intent: "telegraph" as const,
          staggerTicks: 4,
        },
      },
    };

    const interrupted = stepEnemyCombat(
      committed,
      neutralIntent,
      [],
      arenaContent,
    );
    expect(interrupted.state.enemies[boss.id]).toMatchObject({
      currentMoveId: null,
      movePhase: "none",
      intent: "stagger",
    });
    expect(interrupted.state.encounter.pendingSummons).toEqual([65]);

    const paused = stepGame(
      { ...interrupted.state, paused: true },
      neutralIntent,
      1 / 60,
      arenaContent,
    );
    expect(paused.state).toEqual({ ...interrupted.state, paused: true });

    const dead = stepEncounter({
      ...interrupted.state,
      enemies: {
        ...interrupted.state.enemies,
        [boss.id]: {
          ...interrupted.state.enemies[boss.id]!,
          health: 0,
          action: "dead",
        },
      },
    }, [
      { type: "defeated", actorId: boss.id },
      {
        type: "enemy-move-active",
        enemyId: boss.id,
        moveId: "sovereign-summon",
        attackId: "boss-sovereign:sovereign-summon:1",
      },
    ]);
    expect(dead.state.status).toBe("complete");
    expect(dead.state.encounter.pendingSummons).toEqual([]);
    expect(dead.events).not.toContainEqual(expect.objectContaining({
      type: "enemy-summoned",
    }));
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
