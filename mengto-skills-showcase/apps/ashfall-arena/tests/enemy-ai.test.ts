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
  stepEncounter,
} from "../src/simulation/encounters";
import { stepGame } from "../src/simulation/step-game";
import {
  stepCombat,
  stepEnemyCombat,
} from "../src/simulation/combat";
import type {
  EnemyDefinition,
  EnemyIntent,
  EnemyMoveDefinition,
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

  it("deep-freezes every authored move child and rejects attempted projectile mutation", () => {
    const visit = (value: unknown): void => {
      if (value === null || typeof value !== "object") return;
      expect(Object.isFrozen(value)).toBe(true);
      for (const child of Object.values(value)) visit(child);
    };
    visit(enemyMoves);

    const projectile = enemyMoves["warden-bolt"].projectile!;
    expect(() => {
      (projectile as { speed: number }).speed = 99;
    }).toThrow(TypeError);
    expect(projectile.speed).toBe(8);
  });

  it.each([
    ["speed", Number.NaN],
    ["speed", Number.POSITIVE_INFINITY],
    ["speed", 0],
    ["speed", -1],
    ["radius", Number.NaN],
    ["radius", Number.NEGATIVE_INFINITY],
    ["radius", 0],
    ["radius", -0.01],
    ["lifetimeSeconds", Number.NaN],
    ["lifetimeSeconds", Number.POSITIVE_INFINITY],
    ["lifetimeSeconds", 0],
    ["lifetimeSeconds", -1],
    ["originForward", Number.NaN],
    ["originForward", Number.NEGATIVE_INFINITY],
    ["originForward", 0],
    ["originForward", -0.1],
  ] as const)(
    "rejects projectile %s=%s on an isolated content clone",
    (field, value) => {
      const moves = structuredClone(enemyMoves) as Record<
        EnemyMoveId,
        EnemyMoveDefinition
      >;
      const projectile = moves["warden-bolt"].projectile!;
      (projectile as unknown as Record<string, number>)[field] = value;

      const result = validateEnemyContent(enemyDefinitions, moves);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        `warden-bolt has invalid projectile ${field}`,
      );
      expect(enemyMoves["warden-bolt"].projectile).toMatchObject({
        speed: 8,
        radius: 0.18,
        lifetimeSeconds: 1.5,
        originForward: 0.62,
      });
    },
  );

  it("requires projectile data only on ranged projectile-contact moves", () => {
    const missing = structuredClone(enemyMoves) as Record<
      EnemyMoveId,
      EnemyMoveDefinition
    >;
    delete (
      missing["warden-bolt"] as EnemyMoveDefinition & {
        projectile?: EnemyMoveDefinition["projectile"];
      }
    ).projectile;
    expect(validateEnemyContent(enemyDefinitions, missing).errors).toContain(
      "warden-bolt projectile contact requires projectile content",
    );

    const wrongContact = structuredClone(enemyMoves) as Record<
      EnemyMoveId,
      EnemyMoveDefinition
    >;
    (
      wrongContact["warden-bolt"] as EnemyMoveDefinition & {
        contactKind: EnemyMoveDefinition["contactKind"];
      }
    ).contactKind = "sweep";
    expect(
      validateEnemyContent(enemyDefinitions, wrongContact).errors,
    ).toContain(
      "warden-bolt projectile content requires a ranged projectile contact",
    );

    const wrongSlot = structuredClone(enemyMoves) as Record<
      EnemyMoveId,
      EnemyMoveDefinition
    >;
    (
      wrongSlot["warden-bolt"] as EnemyMoveDefinition & {
        slot: EnemyMoveDefinition["slot"];
      }
    ).slot = "melee";
    expect(
      validateEnemyContent(enemyDefinitions, wrongSlot).errors,
    ).toContain(
      "warden-bolt projectile content requires a ranged projectile contact",
    );

    const explicitUndefined = structuredClone(enemyMoves) as Record<
      EnemyMoveId,
      EnemyMoveDefinition
    >;
    (
      explicitUndefined["crawler-lunge"] as unknown as {
        projectile: EnemyMoveDefinition["projectile"] | undefined;
      }
    ).projectile = undefined;
    expect(
      validateEnemyContent(enemyDefinitions, explicitUndefined),
    ).toEqual({ valid: true, errors: [] });
  });

  it("rejects duplicate and undefined move references without mutating definitions", () => {
    const duplicateDefinitions = structuredClone(
      enemyDefinitions,
    ) as Record<string, EnemyDefinition>;
    duplicateDefinitions["glass-crawler"] = {
      ...duplicateDefinitions["glass-crawler"]!,
      moveIds: ["crawler-lunge", "crawler-lunge"],
    };
    expect(
      validateEnemyContent(duplicateDefinitions, enemyMoves).errors,
    ).toContain(
      "glass-crawler references duplicate move crawler-lunge",
    );

    const undefinedDefinitions = structuredClone(
      enemyDefinitions,
    ) as Record<string, EnemyDefinition>;
    undefinedDefinitions["glass-crawler"] = {
      ...undefinedDefinitions["glass-crawler"]!,
      moveIds: [undefined as unknown as EnemyMoveId],
    };
    expect(
      validateEnemyContent(undefinedDefinitions, enemyMoves).errors,
    ).toContain(
      "glass-crawler references missing move undefined",
    );
    expect(enemyDefinitions["glass-crawler"].moveIds).toEqual([
      "crawler-lunge",
    ]);
  });

  it("reports undefined content entries instead of throwing during validation", () => {
    const moves = {
      ...structuredClone(enemyMoves),
      "warden-bolt": undefined,
    } as unknown as Record<string, EnemyMoveDefinition>;
    expect(() =>
      validateEnemyContent(enemyDefinitions, moves)
    ).not.toThrow();
    expect(validateEnemyContent(enemyDefinitions, moves).errors).toEqual(
      expect.arrayContaining([
        "warden-bolt is undefined",
        "ash-warden references missing move warden-bolt",
      ]),
    );

    const definitions = {
      ...structuredClone(enemyDefinitions),
      "glass-crawler": undefined,
    } as unknown as Record<string, EnemyDefinition>;
    expect(() =>
      validateEnemyContent(definitions, enemyMoves)
    ).not.toThrow();
    expect(
      validateEnemyContent(definitions, enemyMoves).errors,
    ).toContain("glass-crawler is undefined");
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

  it("keeps a committed Warden ranged owner when a Boss selects shockwave, independent of insertion order", () => {
    const base = createEncounterFixture(61, "boss");
    const warden = requestEnemyMove(
      createEncounterEnemy(
        "warden-committed",
        "ash-warden",
        { x: -4.5, y: 0 },
        { visibleTicks: 60 },
      ),
      "warden-bolt",
      6,
    );
    const boss = {
      ...base.enemies["boss-sovereign"]!,
      position: { x: 0, y: 3.4 },
      visibleTicks: 60,
      currentMoveId: null,
      movePhase: "none" as const,
      intent: "observe" as const,
    };
    const make = (reverse: boolean) => ({
      ...base,
      tick: 6,
      player: { ...base.player, position: { x: 0, y: 0 } },
      enemies: reverse
        ? { [boss.id]: boss, [warden.id]: warden }
        : { [warden.id]: warden, [boss.id]: boss },
      enemyAi: {
        ...base.enemyAi,
        rangedWindow: 0,
        rangedSlotOwner: warden.id,
        rangedWindowUsed: false,
        supportSlotOwner: null,
      },
    } as GameState);

    const first = stepEnemyAi(make(false), arenaContent);
    const second = stepEnemyAi(make(true), arenaContent);

    expect(decisionById(first)).toEqual(decisionById(second));
    expect(first.enemies[warden.id]).toMatchObject({
      currentMoveId: "warden-bolt",
      movePhase: "telegraph",
    });
    expect(first.enemies[boss.id]!.currentMoveId).toBeNull();
    expect(first.enemyAi.rangedSlotOwner).toBe(warden.id);
  });

  it("releases stale ranged ownership on death or pre-contact recovery but keeps a used window closed", () => {
    const base = createEncounterFixture(62, "fresh");
    const ready = createEncounterEnemy(
      "warden-b",
      "ash-warden",
      { x: 4.5, y: 0 },
      { visibleTicks: 60 },
    );
    const owner = requestEnemyMove(
      createEncounterEnemy(
        "warden-a",
        "ash-warden",
        { x: -4.5, y: 0 },
        { visibleTicks: 60 },
      ),
      "warden-bolt",
      6,
    );
    const make = (
      ownerState: typeof owner,
      rangedWindowUsed: boolean,
      tick = 6,
    ) => ({
      ...base,
      tick,
      player: { ...base.player, position: { x: 0, y: 0 } },
      enemies: { [owner.id]: ownerState, [ready.id]: ready },
      enemyAi: {
        ...base.enemyAi,
        rangedWindow: 0,
        rangedSlotOwner: owner.id,
        rangedWindowUsed,
        supportSlotOwner: null,
      },
    } as GameState);

    const deadOwner = stepEnemyAi(
      make({ ...owner, health: 0, action: "dead" }, false),
      arenaContent,
    );
    expect(deadOwner.enemies[ready.id]!.currentMoveId).toBe("warden-bolt");

    const recoveringOwner = stepEnemyAi(
      make({
        ...owner,
        intent: "recover",
        movePhase: "recover",
      }, false),
      arenaContent,
    );
    expect(recoveringOwner.enemies[ready.id]!.currentMoveId).toBe(
      "warden-bolt",
    );

    const usedWindow = stepEnemyAi(
      make({
        ...owner,
        intent: "recover",
        movePhase: "recover",
      }, true, 29),
      arenaContent,
    );
    expect(usedWindow.enemies[ready.id]!.currentMoveId).toBeNull();

    const nextWindow = stepEnemyAi(
      make({
        ...owner,
        intent: "recover",
        movePhase: "recover",
      }, true, 30),
      arenaContent,
    );
    expect(nextWindow.enemies[ready.id]!.currentMoveId).toBe("warden-bolt");
  });

  it("uses an independent support slot for a pending Boss summon without overwriting committed combat lanes", () => {
    const base = createEncounterFixture(63, "boss");
    const bossSource = base.enemies["boss-sovereign"]!;
    const boss = {
      ...bossSource,
      health: Math.floor(bossSource.maxHealth * 0.3),
      bossPhase: 3 as const,
      visibleTicks: 60,
      currentMoveId: null,
      movePhase: "none" as const,
    };
    const warden = requestEnemyMove(
      createEncounterEnemy(
        "warden-committed",
        "ash-warden",
        { x: -4.5, y: 7 },
        { visibleTicks: 60 },
      ),
      "warden-bolt",
      6,
    );
    const crawler = requestEnemyMove(
      createEncounterEnemy(
        "crawler-committed",
        "glass-crawler",
        { x: 0, y: 8.2 },
        { visibleTicks: 60 },
      ),
      "crawler-lunge",
      6,
    );
    const state = {
      ...base,
      tick: 6,
      enemies: {
        [warden.id]: warden,
        [boss.id]: boss,
        [crawler.id]: crawler,
      },
      encounter: {
        ...base.encounter,
        pendingSummons: [30],
      },
      enemyAi: {
        ...base.enemyAi,
        meleeSlotOwner: crawler.id,
        rangedWindow: 0,
        rangedSlotOwner: warden.id,
        rangedWindowUsed: false,
        supportSlotOwner: null,
      },
    } as GameState;

    const result = stepEnemyAi(state, arenaContent);

    expect(result.enemies[boss.id]).toMatchObject({
      currentMoveId: "sovereign-summon",
      movePhase: "telegraph",
    });
    expect(result.enemyAi).toMatchObject({
      meleeSlotOwner: crawler.id,
      rangedSlotOwner: warden.id,
      supportSlotOwner: boss.id,
    });
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
  it("announces the Boss summon only when its telegraph commits to active", () => {
    const base = createEncounterFixture(64, "boss");
    const requested = requestEnemyMove(
      {
        ...base.enemies["boss-sovereign"]!,
        visibleTicks: 60,
      },
      "sovereign-summon",
      6,
    );
    const state = {
      ...base,
      encounter: {
        ...base.encounter,
        pendingSummons: [65 as const],
      },
      enemies: {
        [requested.id]: {
          ...requested,
          moveElapsedTicks: 41,
        },
      },
    };

    const committed = stepEnemyCombat(
      state,
      neutralIntent,
      [],
      arenaContent,
    );
    expect(committed.state.enemies[requested.id]).toMatchObject({
      movePhase: "active",
      moveElapsedTicks: 0,
    });
    expect(committed.events).toEqual([{
      type: "enemy-move-active",
      enemyId: requested.id,
      moveId: "sovereign-summon",
      attackId: "boss-sovereign:sovereign-summon:1",
    }]);

    const next = stepEnemyCombat(
      committed.state,
      neutralIntent,
      committed.events,
      arenaContent,
    );
    expect(next.events.filter(
      (event) => event.type === "enemy-move-active",
    )).toHaveLength(1);
  });

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
      guardBroken: true,
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

  it.each([
    [true, true],
    [false, false],
  ])(
    "emits observable zero-damage training contact at one health (guard=%s)",
    (guardHeld, expectedGuarded) => {
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
        51,
      );
      const crawler = {
        ...requested,
        intent: "attack" as const,
        movePhase: "active" as const,
      };
      const initial = createInitialForEnemy(crawler, { x: 0, y: -9 });
      const state = {
        ...initial,
        player: {
          ...initial.player,
          health: 1,
          action: guardHeld ? "guard" as const : "idle" as const,
        },
      };

      const result = stepEnemyCombat(
        state,
        { ...neutralIntent, guardHeld },
        [],
        arenaContent,
      );

      expect(result.state.player.health).toBe(1);
      expect(result.state.status).toBe("playing");
      expect(result.events).toEqual([
        {
          type: "contact",
          attackerId: "training-crawler",
          targetId: "player",
          attackId: "training-crawler:crawler-lunge:1",
        },
        {
          type: "damage",
          targetId: "player",
          amount: 0,
          guarded: expectedGuarded,
        },
      ]);
      const lesson = stepEncounter(result.state, result.events);
      expect(lesson.state.encounter.trainingGuardSeen).toBe(expectedGuarded);
    },
  );

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

  it("spawns a serialized Warden bolt at active commitment and requires flight time to hit", () => {
    const requested = requestEnemyMove(
      createEncounterEnemy(
        "warden-a",
        "ash-warden",
        { x: 0, y: -4.5 },
        {
          aiEnabled: false,
          facingRadians: 0,
          lockedFacingRadians: 0,
        },
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
    const state = createInitialForEnemy(warden, { x: 0, y: 0 });
    const spawned = stepEnemyCombat(
      state,
      neutralIntent,
      [],
      arenaContent,
    );

    expect(spawned.state.player.health).toBe(state.player.health);
    expect(spawned.events).toEqual([
      {
        type: "enemy-projectile-spawned",
        projectileId: "warden-a:warden-bolt:1:projectile",
        attackId: "warden-a:warden-bolt:1",
        ownerId: "warden-a",
        position: { x: 0, y: -3.88 },
        velocity: { x: 0, y: 8 },
      },
    ]);
    expect(spawned.state.combat.enemyProjectiles).toEqual([
      expect.objectContaining({
        id: "warden-a:warden-bolt:1:projectile",
        attackId: "warden-a:warden-bolt:1",
        ownerId: "warden-a",
        moveId: "warden-bolt",
        direction: { x: 0, y: 1 },
        speed: 8,
        radius: 0.18,
        targetLayer: "player",
        team: "enemy",
        hitTargetIds: [],
      }),
    ]);

    let flight = spawned.state;
    for (let tick = 0; tick < 18; tick += 1) {
      flight = stepCombat(
        flight,
        neutralIntent,
        [],
        arenaContent,
      ).state;
    }
    expect(flight.player.health).toBe(state.player.health);
    expect(flight.combat.enemyProjectiles).toHaveLength(1);

    for (let tick = 0; tick < 20; tick += 1) {
      flight = stepCombat(
        flight,
        neutralIntent,
        [],
        arenaContent,
      ).state;
    }
    expect(flight.player.health).toBe(state.player.health - 16);
    expect(flight.combat.enemyProjectiles).toEqual([]);
  });

  it.each([
    ["+X", Math.PI / 2, { x: 8, y: 0 }],
    ["-X", -Math.PI / 2, { x: -8, y: 0 }],
    ["+Z", 0, { x: 0, y: 8 }],
    ["-Z", Math.PI, { x: 0, y: -8 }],
    [
      "diagonal",
      Math.PI / 4,
      { x: 5.65685424949238, y: 5.656854249492381 },
    ],
  ])(
    "emits %s projectile velocity from the same serialized projectile truth",
    (_label, facingRadians, expectedVelocity) => {
      const requested = requestEnemyMove(
        createEncounterEnemy(
          "direction-warden",
          "ash-warden",
          { x: 1, y: -2 },
          {
            aiEnabled: false,
            facingRadians,
            lockedFacingRadians: facingRadians,
          },
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
      const state = createInitialForEnemy(warden, { x: 0, y: 0 });
      const before = JSON.parse(JSON.stringify(state));

      const first = stepEnemyCombat(state, neutralIntent, [], arenaContent);
      const replay = stepEnemyCombat(state, neutralIntent, [], arenaContent);
      const projectile = first.state.combat.enemyProjectiles[0]!;
      const event = first.events[0] as unknown as {
        type: string;
        projectileId: string;
        position: { x: number; y: number };
        velocity: { x: number; y: number };
      };

      expect(event).toMatchObject({
        type: "enemy-projectile-spawned",
        projectileId: projectile.id,
        position: projectile.position,
      });
      expect(event.velocity.x).toBeCloseTo(expectedVelocity.x, 10);
      expect(event.velocity.y).toBeCloseTo(expectedVelocity.y, 10);
      expect(event.velocity.x).toBeCloseTo(
        projectile.direction.x * projectile.speed,
        10,
      );
      expect(event.velocity.y).toBeCloseTo(
        projectile.direction.y * projectile.speed,
        10,
      );
      expect(first).toEqual(replay);
      expect(state).toEqual(before);
    },
  );

  it("lets blockers absorb a Warden bolt and never tracks after launch", () => {
    const gateWarden = requestEnemyMove(
      createEncounterEnemy(
        "warden-gate",
        "ash-warden",
        { x: 0, y: 9 },
        {
          aiEnabled: false,
          facingRadians: Math.PI,
          lockedFacingRadians: Math.PI,
        },
      ),
      "warden-bolt",
      10,
    );
    let blocked = createInitialForEnemy({
      ...gateWarden,
      intent: "attack",
      movePhase: "active",
    }, { x: 0, y: 7 });
    blocked = stepEnemyCombat(
      blocked,
      neutralIntent,
      [],
      arenaContent,
    ).state;
    blocked = stepCombat(
      blocked,
      neutralIntent,
      [],
      arenaContent,
    ).state;
    expect(blocked.combat.enemyProjectiles).toEqual([]);
    expect(blocked.player.health).toBe(blocked.player.maxHealth);

    const launched = stepEnemyCombat(
      createInitialForEnemy({
        ...requestEnemyMove(
          createEncounterEnemy(
            "warden-fixed",
            "ash-warden",
            { x: 0, y: -4.5 },
            {
              aiEnabled: false,
              facingRadians: 0,
              lockedFacingRadians: 0,
            },
          ),
          "warden-bolt",
          10,
        ),
        intent: "attack",
        movePhase: "active",
      }, { x: 0, y: 0 }),
      neutralIntent,
      [],
      arenaContent,
    ).state;
    let evaded = {
      ...launched,
      player: {
        ...launched.player,
        position: { x: 3, y: 0 },
      },
    };
    for (let tick = 0; tick < 100; tick += 1) {
      evaded = stepCombat(
        evaded,
        neutralIntent,
        [],
        arenaContent,
      ).state;
    }
    expect(evaded.player.health).toBe(evaded.player.maxHealth);
    expect(evaded.combat.enemyProjectiles).toEqual([]);
  });

  it.each([
    ["dodge", false, 0],
    ["guard", true, 6],
  ] as const)("resolves %s from player state at bolt impact", (
    action,
    guardHeld,
    expectedDamage,
  ) => {
    const base = createEncounterFixture(65, "fresh");
    const state = {
      ...base,
      player: {
        ...base.player,
        position: { x: 0, y: 0 },
        facingRadians: Math.PI,
        action,
        actionTime: action === "dodge" ? 0.12 : 0,
      },
      combat: {
        ...base.combat,
        enemyProjectiles: [{
          id: "impact-projectile",
          attackId: "warden-impact:warden-bolt:1",
          ownerId: "warden-impact",
          moveId: "warden-bolt" as const,
          position: { x: 0, y: -1 },
          direction: { x: 0, y: 1 },
          speed: 60,
          radius: 0.18,
          ageTicks: 0,
          lifetimeTicks: 60,
          targetLayer: "player" as const,
          team: "enemy" as const,
          hitTargetIds: [],
        }],
      },
    };
    const result = stepCombat(
      state,
      { ...neutralIntent, guardHeld },
      [],
      arenaContent,
    );

    expect(result.state.player.health).toBe(
      state.player.health - expectedDamage,
    );
    expect(result.state.combat.enemyProjectiles).toEqual([]);
    expect(result.events.filter(
      (event) => event.type === "damage",
    )).toEqual(
      expectedDamage === 0
        ? []
        : [{
            type: "damage",
            targetId: "player",
            amount: 6,
            guarded: true,
          }],
    );
  });

  it("uses swept earliest contact for a large bolt step and stays pure across JSON replay", () => {
    const base = createEncounterFixture(66, "fresh");
    const state = {
      ...base,
      player: {
        ...base.player,
        position: { x: 0, y: 0 },
      },
      combat: {
        ...base.combat,
        enemyProjectiles: [{
          id: "fast-projectile",
          attackId: "warden-fast:warden-bolt:1",
          ownerId: "warden-fast",
          moveId: "warden-bolt" as const,
          position: { x: 0, y: -5 },
          direction: { x: 0, y: 1 },
          speed: 600,
          radius: 0.18,
          ageTicks: 0,
          lifetimeTicks: 60,
          targetLayer: "player" as const,
          team: "enemy" as const,
          hitTargetIds: [],
        }],
      },
    };
    const before = JSON.stringify(state);
    const first = stepCombat(
      state,
      neutralIntent,
      [],
      arenaContent,
    );
    const replay = stepCombat(
      JSON.parse(before) as GameState,
      neutralIntent,
      [],
      arenaContent,
    );

    expect(first).toEqual(replay);
    expect(JSON.stringify(state)).toBe(before);
    expect(first.state.player.health).toBe(state.player.health - 16);
    expect(first.state.combat.enemyProjectiles).toEqual([]);
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
