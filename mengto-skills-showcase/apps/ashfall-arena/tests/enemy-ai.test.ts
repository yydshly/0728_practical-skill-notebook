import { describe, expect, it } from "vitest";
import {
  enemyDefinitions,
  enemyMoves,
  validateEnemyContent,
} from "../src/content/enemy-definitions";
import {
  chooseEnemyIntent,
  hasEnemyLineOfSight,
  requestEnemyMove,
  stepEnemyAi,
} from "../src/simulation/enemy-ai";
import {
  createEncounterEnemy,
  createEncounterFixture,
} from "../src/simulation/encounters";
import { stepGame } from "../src/simulation/step-game";
import { stepEnemyCombat } from "../src/simulation/combat";
import type {
  EnemyIntent,
  EnemyMoveId,
  GameState,
} from "../src/simulation/types";
import {
  neutralIntent,
  runTicks,
} from "./helpers/simulation-fixtures";
import { arenaContent } from "../src/content/arena-content";

const intentById = (state: GameState) =>
  Object.fromEntries(
    Object.values(state.enemies)
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((enemy) => [
        enemy.id,
        {
          intent: enemy.intent,
          moveId: enemy.currentMoveId,
          phase: enemy.movePhase,
          position: enemy.position,
        },
      ]),
  );

const decisionById = (state: GameState) =>
  Object.fromEntries(
    Object.values(state.enemies)
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((enemy) => [
        enemy.id,
        {
          intent: enemy.intent,
          moveId: enemy.currentMoveId,
          phase: enemy.movePhase,
        },
      ]),
  );

describe("enemy authored content", () => {
  it("is immutable and has valid unique move, role, stat, and reward references", () => {
    expect(validateEnemyContent(enemyDefinitions, enemyMoves)).toEqual({
      valid: true,
      errors: [],
    });
    expect(Object.keys(enemyDefinitions).sort()).toEqual([
      "ash-warden",
      "bell-elite",
      "bell-sovereign",
      "glass-crawler",
    ]);
    expect(Object.isFrozen(enemyDefinitions)).toBe(true);
    expect(Object.isFrozen(enemyMoves)).toBe(true);

    const ids = Object.values(enemyMoves).map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const move of Object.values(enemyMoves)) {
      expect(move.telegraphSeconds).toBeGreaterThanOrEqual(0.35);
      expect(move.activeSeconds).toBeGreaterThan(0);
      expect(move.recoverySeconds).toBeGreaterThan(0);
      expect(move.cooldownSeconds).toBeGreaterThanOrEqual(
        move.recoverySeconds,
      );
    }
  });

  it("rejects missing move and reward references without mutating authored content", () => {
    const invalid = {
      ...enemyDefinitions,
      "glass-crawler": {
        ...enemyDefinitions["glass-crawler"],
        moveIds: ["missing-move" as EnemyMoveId],
        rewardId: "missing-reward",
      },
    };
    const before = JSON.stringify(invalid);

    const result = validateEnemyContent(invalid, enemyMoves);

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      "glass-crawler references missing move missing-move",
      "glass-crawler references missing reward missing-reward",
    ]);
    expect(JSON.stringify(invalid)).toBe(before);
  });
});

describe("bounded enemy decisions", () => {
  it("observes for at least 0.35 seconds before approaching", () => {
    const enemy = createEncounterEnemy(
      "crawler-a",
      "glass-crawler",
      { x: 0, y: 3 },
    );

    expect(
      chooseEnemyIntent(enemy, {
        playerDistance: 3,
        visibleSeconds: 0.1,
        hasLineOfSight: true,
        targetAvailable: true,
        pathSucceeded: true,
        meleeSlotOwner: null,
        rangedSlotOwner: null,
      }),
    ).toBe("observe");
    expect(
      chooseEnemyIntent(enemy, {
        playerDistance: 3,
        visibleSeconds: 0.5,
        hasLineOfSight: true,
        targetAvailable: true,
        pathSucceeded: true,
        meleeSlotOwner: null,
        rangedSlotOwner: null,
      }),
    ).toBe("approach");
  });

  it("orbits when spacing, a blocker, or an occupied melee slot makes attack illegal", () => {
    const warden = createEncounterEnemy(
      "warden-a",
      "ash-warden",
      { x: 0, y: 2.5 },
    );
    const crawler = createEncounterEnemy(
      "crawler-a",
      "glass-crawler",
      { x: 0, y: 1.4 },
    );
    const base = {
      visibleSeconds: 1,
      targetAvailable: true,
      pathSucceeded: true,
      rangedSlotOwner: null,
    };

    expect(
      chooseEnemyIntent(warden, {
        ...base,
        playerDistance: 2.5,
        hasLineOfSight: true,
        meleeSlotOwner: "crawler-a",
      }),
    ).toBe("retreat");
    expect(
      chooseEnemyIntent(crawler, {
        ...base,
        playerDistance: 1.4,
        hasLineOfSight: true,
        meleeSlotOwner: "crawler-b",
      }),
    ).toBe("orbit");
    expect(
      chooseEnemyIntent(crawler, {
        ...base,
        playerDistance: 1.4,
        hasLineOfSight: false,
        meleeSlotOwner: null,
      }),
    ).toBe("approach");
  });

  it.each([
    ["dead", { health: 0, action: "dead" }, "dead"],
    ["stagger", { staggerTicks: 12 }, "stagger"],
    ["target loss", { targetId: null }, "observe"],
  ] as const)("handles %s without selecting a move", (_, overrides, expected) => {
    const enemy = createEncounterEnemy(
      "crawler-a",
      "glass-crawler",
      { x: 0, y: 1.4 },
      overrides,
    );

    expect(
      chooseEnemyIntent(enemy, {
        playerDistance: 1.4,
        visibleSeconds: 2,
        hasLineOfSight: true,
        targetAvailable: enemy.targetId !== null,
        pathSucceeded: true,
        meleeSlotOwner: null,
        rangedSlotOwner: null,
      }),
    ).toBe(expected);
  });

  it("makes decisions only every six ticks and leaves committed facing unchanged", () => {
    let state = createEncounterFixture(11, "wave-one");
    state = {
      ...state,
      tick: 1,
      enemies: Object.fromEntries(
        Object.entries(state.enemies).map(([id, enemy]) => [
          id,
          {
            ...enemy,
            visibleTicks: 60,
            intent: "orbit" as EnemyIntent,
            intentTicks: 4,
          },
        ]),
      ),
    };
    const before = JSON.stringify(state);

    const skipped = stepEnemyAi(state, arenaContent);
    expect(decisionById(skipped)).toEqual(decisionById(state));
    expect(JSON.stringify(state)).toBe(before);

    const crawler = skipped.enemies["wave-one-crawler-a"]!;
    const committed = {
      ...skipped,
      tick: 6,
      enemies: {
        ...skipped.enemies,
        [crawler.id]: {
          ...crawler,
          intent: "telegraph" as const,
          currentMoveId: "crawler-lunge" as const,
          movePhase: "telegraph" as const,
          lockedFacingRadians: 1.25,
        },
      },
    };
    const next = stepEnemyAi(committed, arenaContent);
    expect(next.enemies[crawler.id]!.facingRadians).toBe(
      committed.enemies[crawler.id]!.facingRadians,
    );
    expect(next.enemies[crawler.id]!.lockedFacingRadians).toBe(1.25);
  });

  it("arbitrates one melee and one ranged slot stably regardless of record insertion order", () => {
    const original = createEncounterFixture(12, "wave-one");
    const ready = {
      ...original,
      tick: 6,
      player: {
        ...original.player,
        position: { x: 0, y: 0 },
      },
      enemies: Object.fromEntries(
        Object.entries(original.enemies).map(([id, enemy]) => [
          id,
          {
            ...enemy,
            visibleTicks: 60,
            position:
              enemy.kind === "ash-warden"
                ? { x: 0, y: 4.5 }
                : { x: 0, y: 1.3 },
          },
        ]),
      ),
    };
    const reversed = {
      ...ready,
      enemies: Object.fromEntries(Object.entries(ready.enemies).reverse()),
    };

    const first = stepEnemyAi(ready, arenaContent);
    const second = stepEnemyAi(reversed, arenaContent);
    expect(intentById(first)).toEqual(intentById(second));

    const telegraphs = Object.values(first.enemies).filter(
      ({ intent }) => intent === "telegraph",
    );
    expect(
      telegraphs.filter(({ kind }) => kind !== "ash-warden"),
    ).toHaveLength(1);
    expect(
      telegraphs.filter(({ kind }) => kind === "ash-warden"),
    ).toHaveLength(1);
  });

  it("rotates ranged ownership fairly across consecutive half-second windows", () => {
    const initial = createEncounterFixture(13, "fresh");
    const wardenA = createEncounterEnemy(
      "warden-a",
      "ash-warden",
      { x: -4.5, y: 0 },
      { visibleTicks: 60 },
    );
    const wardenB = createEncounterEnemy(
      "warden-b",
      "ash-warden",
      { x: 4.5, y: 0 },
      { visibleTicks: 60 },
    );
    const state = {
      ...initial,
      tick: 0,
      player: { ...initial.player, position: { x: 0, y: 0 } },
      enemies: { "warden-b": wardenB, "warden-a": wardenA },
    };

    const firstWindow = stepEnemyAi(state, arenaContent);
    expect(
      Object.values(firstWindow.enemies)
        .filter(({ intent }) => intent === "telegraph")
        .map(({ id }) => id),
    ).toEqual(["warden-a"]);

    const resetEnemies = Object.fromEntries(
      Object.entries(firstWindow.enemies).map(([id, enemy]) => [
        id,
        {
          ...enemy,
          currentMoveId: null,
          movePhase: "none" as const,
          moveElapsedTicks: 0,
          cooldownTicks: 0,
          intent: "observe" as const,
        },
      ]),
    );
    const secondWindow = stepEnemyAi(
      { ...firstWindow, tick: 30, enemies: resetEnemies },
      arenaContent,
    );
    expect(
      Object.values(secondWindow.enemies)
        .filter(({ intent }) => intent === "telegraph")
        .map(({ id }) => id),
    ).toEqual(["warden-b"]);
  });

  it("uses authoritative blockers for visibility and never commits through the closed boss gate", () => {
    expect(
      hasEnemyLineOfSight(
        { x: 0, y: 9 },
        { x: 0, y: 7 },
        arenaContent.arena,
        false,
      ),
    ).toBe(false);
    expect(
      hasEnemyLineOfSight(
        { x: 0, y: 9 },
        { x: 0, y: 7 },
        arenaContent.arena,
        true,
      ),
    ).toBe(true);

    const boss = createEncounterEnemy(
      "boss",
      "bell-sovereign",
      { x: 0, y: 9 },
      { visibleTicks: 120 },
    );
    const state = createInitialForEnemy(boss, { x: 0, y: 7 });
    const next = stepEnemyAi({ ...state, tick: 6 }, arenaContent);
    expect(next.enemies.boss!.intent).not.toBe("telegraph");
  });

  it("uses authoritative movement results to count path failures and choose a reposition", () => {
    const crawler = createEncounterEnemy(
      "crawler-a",
      "glass-crawler",
      { x: -6.3, y: -2.2 },
      {
        visibleTicks: 120,
        intent: "approach",
        pathFailureTicks: 11,
      },
    );
    const state = createInitialForEnemy(crawler, { x: -6.3, y: 0.8 });

    const next = stepEnemyAi({ ...state, tick: 1 }, arenaContent);

    expect(next.enemies[crawler.id]!.pathFailureTicks).toBeGreaterThanOrEqual(
      12,
    );
    expect(
      chooseEnemyIntent(next.enemies[crawler.id]!, {
        playerDistance: 3,
        visibleSeconds: 1,
        hasLineOfSight: true,
        targetAvailable: true,
        pathSucceeded: false,
        meleeSlotOwner: null,
        rangedSlotOwner: null,
      }),
    ).toBe("orbit");
  });

  it("only accepts a move ID authored for that enemy", () => {
    const crawler = createEncounterEnemy(
      "crawler-a",
      "glass-crawler",
      { x: 0, y: 1.4 },
    );

    expect(() =>
      requestEnemyMove(crawler, "warden-bolt", 1),
    ).toThrow("glass-crawler cannot use warden-bolt");
    expect(
      requestEnemyMove(crawler, "crawler-lunge", 1),
    ).toMatchObject({
      currentMoveId: "crawler-lunge",
      intent: "telegraph",
      movePhase: "telegraph",
    });
  });
});

describe("authoritative enemy combat", () => {
  it("telegraphs before applying one stable contact and cannot spam during recovery", () => {
    const crawler = requestEnemyMove(
      createEncounterEnemy(
        "crawler-a",
        "glass-crawler",
        { x: 0, y: -7.7 },
        { aiEnabled: false, facingRadians: Math.PI },
      ),
      "crawler-lunge",
      1,
    );
    const initial = createInitialForEnemy(crawler, { x: 0, y: -9 });
    const beforeActive = runTicks(initial, new Map(), 21);
    expect(beforeActive.events.filter(({ type }) => type === "damage")).toEqual(
      [],
    );
    expect(beforeActive.state.enemies[crawler.id]!.intent).toBe("telegraph");

    const result = runTicks(beforeActive.state, new Map(), 60);
    const damage = result.events.filter(({ type }) => type === "damage");
    expect(damage).toEqual([
      {
        type: "damage",
        targetId: "player",
        amount: 14,
        guarded: false,
      },
    ]);
    expect(
      result.state.combat.receivedAttackIds.filter((id) =>
        id.startsWith("crawler-a:crawler-lunge:"),
      ),
    ).toHaveLength(1);
    expect(result.state.enemies[crawler.id]!.cooldownTicks).toBeGreaterThan(0);
  });

  it("routes guard and dodge through the existing authoritative player damage rules", () => {
    const makeState = () => {
      const crawler = requestEnemyMove(
        createEncounterEnemy(
          "crawler-a",
          "glass-crawler",
          { x: 0, y: -7.7 },
          { aiEnabled: false, facingRadians: Math.PI },
        ),
        "crawler-lunge",
        9,
      );
      return createInitialForEnemy(crawler, { x: 0, y: -9 });
    };

    const guardIntents = new Map(
      Array.from({ length: 40 }, (_, tick) => [
        tick,
        { guardHeld: true },
      ]),
    );
    const guarded = runTicks(makeState(), guardIntents, 40);
    expect(
      guarded.events.find(
        (event) => event.type === "damage" && event.targetId === "player",
      ),
    ).toEqual({
      type: "damage",
      targetId: "player",
      amount: 5,
      guarded: true,
    });

    const dodgeIntents = new Map<number, { dodgePressed: boolean }>([
      [17, { dodgePressed: true }],
    ]);
    const dodged = runTicks(makeState(), dodgeIntents, 40);
    expect(
      dodged.events.filter(
        (event) => event.type === "damage" && event.targetId === "player",
      ),
    ).toEqual([]);
    expect(dodged.state.player.health).toBe(105);
  });

  it("lets an authored elite guard-break interrupt guard through authoritative damage", () => {
    const requested = requestEnemyMove(
      createEncounterEnemy(
        "elite-a",
        "bell-elite",
        { x: 0, y: -7.5 },
        { aiEnabled: false, facingRadians: Math.PI },
      ),
      "elite-sweep",
      4,
    );
    const elite = {
      ...requested,
      intent: "attack" as const,
      movePhase: "active" as const,
    };
    const initial = createInitialForEnemy(elite, { x: 0, y: -9 });
    const state = {
      ...initial,
      player: {
        ...initial.player,
        action: "guard" as const,
        stamina: 100,
      },
    };

    const result = stepEnemyCombat(
      state,
      { ...neutralIntent, guardHeld: true },
      [],
      arenaContent,
    );

    expect(result.state.player).toMatchObject({
      health: 79,
      stamina: 0,
      action: "hit",
    });
    expect(result.events).toContainEqual({
      type: "damage",
      targetId: "player",
      amount: 26,
      guarded: false,
    });
  });

  it("caps training contact at one health without emitting player defeat", () => {
    const requested = requestEnemyMove(
      createEncounterEnemy(
        "training-crawler",
        "glass-crawler",
        { x: 0, y: -7.7 },
        {
          aiEnabled: false,
          facingRadians: Math.PI,
          nonlethal: true,
        },
      ),
      "crawler-lunge",
      5,
    );
    const crawler = {
      ...requested,
      intent: "attack" as const,
      movePhase: "active" as const,
    };
    const initial = createInitialForEnemy(crawler, { x: 0, y: -9 });
    const state = {
      ...initial,
      player: { ...initial.player, health: 5 },
    };

    const result = stepEnemyCombat(
      state,
      neutralIntent,
      [],
      arenaContent,
    );

    expect(result.state.player.health).toBe(1);
    expect(result.state.status).toBe("playing");
    expect(
      result.events.filter(
        (event) =>
          event.type === "defeated" && event.actorId === "player",
      ),
    ).toEqual([]);
  });

  it("interrupts a committed enemy move when authoritative player damage staggers it", () => {
    const crawler = requestEnemyMove(
      createEncounterEnemy(
        "crawler-a",
        "glass-crawler",
        { x: 0, y: -7.7 },
        { aiEnabled: false, facingRadians: Math.PI },
      ),
      "crawler-lunge",
      6,
    );
    const state = createInitialForEnemy(crawler, { x: 0, y: -9 });

    const result = runTicks(
      state,
      new Map([[0, { attackPressed: true }]]),
      20,
    );

    expect(result.state.enemies["crawler-a"]).toMatchObject({
      health: 18,
      intent: "stagger",
      currentMoveId: null,
      movePhase: "none",
    });
    expect(result.state.enemies["crawler-a"]!.staggerTicks).toBeGreaterThan(0);
  });

  it("consumes a projectile contact rejected by dodge instead of retrying later in the active window", () => {
    const requested = requestEnemyMove(
      createEncounterEnemy(
        "warden-a",
        "ash-warden",
        { x: 0, y: -4.5 },
        { aiEnabled: false, facingRadians: Math.PI },
      ),
      "warden-bolt",
      10,
    );
    const warden = {
      ...requested,
      intent: "attack" as const,
      movePhase: "active" as const,
      moveElapsedTicks: 0,
    };
    const initial = createInitialForEnemy(warden, { x: 0, y: -9 });
    const state = {
      ...initial,
      player: {
        ...initial.player,
        action: "dodge" as const,
        actionTime: 0.12,
      },
    };
    const rejected = stepEnemyCombat(
      state,
      neutralIntent,
      [],
      arenaContent,
    );
    const retried = stepEnemyCombat(
      {
        ...rejected.state,
        player: {
          ...rejected.state.player,
          action: "idle",
          actionTime: 0,
        },
      },
      neutralIntent,
      rejected.events,
      arenaContent,
    );

    expect(
      retried.events.filter(
        (event) =>
          event.type === "damage" && event.targetId === "player",
      ),
    ).toEqual([]);
    expect(retried.state.enemies["warden-a"]!.hitTargetIds).toEqual([
      "player",
    ]);
  });

  it("rejects an active sweep through a blocker and defeats the player only at zero health", () => {
    const elite = requestEnemyMove(
      createEncounterEnemy(
        "elite",
        "bell-elite",
        { x: 0, y: 9 },
        { aiEnabled: false, facingRadians: Math.PI },
      ),
      "elite-sweep",
      2,
    );
    let state = createInitialForEnemy(elite, { x: 0, y: 7 });
    state = {
      ...state,
      player: { ...state.player, health: 1 },
    };
    const blocked = runTicks(state, new Map(), 90);
    expect(blocked.state.player.health).toBe(1);
    expect(blocked.state.status).toBe("playing");

    const clear = runTicks(
      {
        ...state,
        encounter: { ...state.encounter, gateOpen: true },
      },
      new Map(),
      90,
    );
    expect(clear.state.player.health).toBe(0);
    expect(clear.state.status).toBe("defeated");
    expect(
      clear.events.filter(
        (event) => event.type === "defeated" && event.actorId === "player",
      ),
    ).toHaveLength(1);
  });

  it("is replayable after JSON serialization and does not mutate the old state", () => {
    const initial = createEncounterFixture(7481, "wave-one");
    const before = JSON.stringify(initial);
    const restored = JSON.parse(before) as GameState;

    const first = stepGame(
      initial,
      neutralIntent,
      1 / 60,
      arenaContent,
    );
    const second = stepGame(
      restored,
      neutralIntent,
      1 / 60,
      arenaContent,
    );

    expect(first).toEqual(second);
    expect(JSON.stringify(initial)).toBe(before);
  });
});

function createInitialForEnemy(
  enemy: GameState["enemies"][string],
  playerPosition: { x: number; y: number },
): GameState {
  const state = createEncounterFixture(1, "fresh");
  return {
    ...state,
    player: {
      ...state.player,
      position: playerPosition,
      facingRadians: 0,
    },
    enemies: { [enemy.id]: enemy },
    encounter: {
      ...state.encounter,
      trainingSpawned: true,
    },
  };
}
