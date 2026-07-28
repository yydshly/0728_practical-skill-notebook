import { describe, expect, it } from "vitest";
import { arenaContent } from "../src/content/arena-content";
import {
  applyIncomingDamage,
  getAttackPhase,
  isContactAccepted,
  resolveIncomingDamage,
  sweptCircleContact,
} from "../src/simulation/combat";
import { createInitialState } from "../src/simulation/create-initial-state";
import { stepGame } from "../src/simulation/step-game";
import type {
  GameEvent,
  GameState,
  IncomingHit,
} from "../src/simulation/types";
import {
  createEnemyState,
  neutralIntent,
  runTicks,
} from "./helpers/simulation-fixtures";

const enemyAhead = (
  id = "enemy-1",
  position = { x: 0, y: -7.6 },
) => ({
  ...createEnemyState("glass-crawler", {
    id,
    position,
  }),
  id,
});

const withEnemy = (
  state: GameState,
  enemy = enemyAhead(),
): GameState => ({
  ...state,
  enemies: {
    ...state.enemies,
    [enemy.id]: enemy,
  },
});

const combatEvents = (events: readonly GameEvent[]) =>
  events.filter(({ type }) =>
    type === "contact" || type === "damage" || type === "defeated"
  );

const incomingHit = (
  overrides: Partial<IncomingHit> = {},
): IncomingHit => ({
  attackId: "enemy-attack-1",
  attackerId: "enemy-1",
  damage: 20,
  angleDegrees: 20,
  collisionLayer: "enemy",
  ...overrides,
});

describe("authoritative oathblade combat", () => {
  it("applies light-one damage once to an in-range target during the active window", () => {
    const result = runTicks(
      withEnemy(createInitialState(1)),
      new Map([[0, { attackPressed: true }]]),
      60,
    );

    expect(combatEvents(result.events)).toEqual([
      {
        type: "contact",
        attackerId: "player",
        targetId: "enemy-1",
        attackId: "player:0:0",
      },
      {
        type: "damage",
        targetId: "enemy-1",
        amount: 18,
        guarded: false,
      },
    ]);
    expect(result.state.enemies["enemy-1"]!.health).toBe(18);
  });

  it("uses discrete startup, active, and recovery boundaries without early or late contact", () => {
    const attackIntent = new Map([[0, { attackPressed: true }]]);
    const beforeActive = runTicks(
      withEnemy(createInitialState(1)),
      attackIntent,
      9,
    );
    const firstActive = runTicks(
      withEnemy(createInitialState(1)),
      attackIntent,
      10,
    );

    expect(combatEvents(beforeActive.events)).toEqual([]);
    expect(combatEvents(firstActive.events)).toHaveLength(2);
    expect(firstActive.state.combat.activeAttack?.elapsedTicks).toBe(10);
    expect(
      getAttackPhase(
        "oathblade-light-1",
        9,
        arenaContent,
      ),
    ).toBe("startup");
    expect(
      getAttackPhase(
        "oathblade-light-1",
        10,
        arenaContent,
      ),
    ).toBe("active");
    expect(
      getAttackPhase(
        "oathblade-light-1",
        17,
        arenaContent,
      ),
    ).toBe("active");
    expect(
      getAttackPhase(
        "oathblade-light-1",
        18,
        arenaContent,
      ),
    ).toBe("recovery");
    expect(
      getAttackPhase(
        "oathblade-light-1",
        34,
        arenaContent,
      ),
    ).toBe("complete");
    expect(getAttackPhase("oathblade-light-2", 10, arenaContent)).toBe(
      "startup",
    );
    expect(getAttackPhase("oathblade-light-2", 11, arenaContent)).toBe(
      "active",
    );
    expect(getAttackPhase("oathblade-light-2", 20, arenaContent)).toBe(
      "active",
    );
    expect(getAttackPhase("oathblade-light-2", 21, arenaContent)).toBe(
      "recovery",
    );
    expect(getAttackPhase("oathblade-light-2", 40, arenaContent)).toBe(
      "complete",
    );
    expect(getAttackPhase("ember-bow-shot", 16, arenaContent)).toBe(
      "startup",
    );
    expect(getAttackPhase("ember-bow-shot", 17, arenaContent)).toBe(
      "recovery",
    );
    expect(getAttackPhase("ember-bow-shot", 42, arenaContent)).toBe(
      "complete",
    );

    const beforeLastActive = runTicks(
      createInitialState(1),
      attackIntent,
      16,
    ).state;
    const atLastActive = stepGame(
      withEnemy(beforeLastActive),
      neutralIntent,
      1 / 60,
      arenaContent,
    );
    const beforeRecovery = runTicks(
      createInitialState(1),
      attackIntent,
      17,
    ).state;
    const atRecovery = stepGame(
      withEnemy(beforeRecovery),
      neutralIntent,
      1 / 60,
      arenaContent,
    );

    expect(combatEvents(atLastActive.events)).toHaveLength(2);
    expect(combatEvents(atRecovery.events)).toEqual([]);
  });

  it.each([
    {
      name: "wrong facing cone",
      enemy: enemyAhead("enemy-1", { x: 0, y: -10.4 }),
    },
    {
      name: "outside authoritative range",
      enemy: enemyAhead("enemy-1", { x: 0, y: -6.8 }),
    },
    {
      name: "same collision layer",
      enemy: {
        ...enemyAhead(),
        collisionLayer: "player" as const,
      },
    },
    {
      name: "dead target",
      enemy: {
        ...enemyAhead(),
        health: 0,
        action: "dead" as const,
      },
    },
    {
      name: "invulnerable target",
      enemy: {
        ...enemyAhead(),
        action: "dodge" as const,
        actionTime: 0.12,
      },
    },
  ])("rejects contact for $name", ({ enemy }) => {
    const result = runTicks(
      withEnemy(createInitialState(1), enemy),
      new Map([[0, { attackPressed: true }]]),
      20,
    );

    expect(combatEvents(result.events)).toEqual([]);
    expect(result.state.enemies["enemy-1"]!.health).toBe(enemy.health);
  });

  it("hits each valid target once while preserving deterministic target order", () => {
    const initial = createInitialState(1);
    initial.enemies = {
      "enemy-b": enemyAhead("enemy-b", { x: 0.45, y: -7.65 }),
      "enemy-a": enemyAhead("enemy-a", { x: -0.45, y: -7.65 }),
    };

    const result = runTicks(
      initial,
      new Map([[0, { attackPressed: true }]]),
      60,
    );

    expect(
      result.events
        .filter(
          (event): event is Extract<GameEvent, { type: "contact" }> =>
            event.type === "contact",
        )
        .map((event) => event.targetId),
    ).toEqual(["enemy-a", "enemy-b"]);
    expect(
      result.events.filter(({ type }) => type === "damage"),
    ).toEqual([
      {
        type: "damage",
        targetId: "enemy-a",
        amount: 18,
        guarded: false,
      },
      {
        type: "damage",
        targetId: "enemy-b",
        amount: 18,
        guarded: false,
      },
    ]);
    expect(result.state.enemies["enemy-a"]!.health).toBe(18);
    expect(result.state.enemies["enemy-b"]!.health).toBe(18);
  });

  it("rejects insufficient stamina, regenerates only while idle or moving, then accepts a new edge", () => {
    const initial = createInitialState(1);
    initial.player.stamina = 11;

    const rejected = stepGame(
      initial,
      { ...neutralIntent, attackPressed: true },
      1 / 60,
      arenaContent,
    ).state;
    const released = stepGame(
      rejected,
      neutralIntent,
      1 / 60,
      arenaContent,
    ).state;
    const recovered = runTicks(released, new Map(), 3).state;
    const accepted = stepGame(
      recovered,
      { ...neutralIntent, attackPressed: true },
      1 / 60,
      arenaContent,
    ).state;

    expect(rejected.combat.activeAttack).toBeNull();
    expect(rejected.player.stamina).toBe(11);
    expect(recovered.player.stamina).toBeCloseTo(12.2, 10);
    expect(accepted.combat.activeAttack).toMatchObject({
      id: "player:5:0",
      actionId: "oathblade-light-1",
    });
    expect(accepted.player.stamina).toBeCloseTo(0.2, 10);

    const duringAttack = runTicks(accepted, new Map(), 5).state;
    expect(duringAttack.player.stamina).toBeCloseTo(0.2, 10);
  });

  it("does not repeat attacks while the attack input remains held", () => {
    const held = new Map(
      Array.from({ length: 100 }, (_, tick) => [
        tick,
        { attackPressed: true },
      ]),
    );
    const result = runTicks(createInitialState(1), held, 100);

    expect(result.state.combat.attackSequence).toBe(1);
    expect(result.state.player.stamina).toBeGreaterThan(88);
  });

  it("queues light two only in the authored combo window and spends its own stamina on transition", () => {
    const lightOne = runTicks(
      createInitialState(1),
      new Map([[0, { attackPressed: true }]]),
      22,
    ).state;
    const queued = stepGame(
      lightOne,
      { ...neutralIntent, attackPressed: true },
      1 / 60,
      arenaContent,
    ).state;
    const transitioned = runTicks(queued, new Map(), 12).state;

    expect(queued.combat.activeAttack).toMatchObject({
      actionId: "oathblade-light-1",
      comboQueued: true,
    });
    expect(transitioned.combat.activeAttack).toMatchObject({
      id: "player:33:1",
      actionId: "oathblade-light-2",
    });
    expect(transitioned.player.stamina).toBe(72);
  });

  it("resolves the queued light-two contact with its own 24 damage truth", () => {
    const initial = withEnemy(createInitialState(1), {
      ...enemyAhead(),
      health: 100,
      maxHealth: 100,
    });
    const result = runTicks(
      initial,
      new Map([
        [0, { attackPressed: true }],
        [22, { attackPressed: true }],
      ]),
      60,
    );

    expect(
      result.events
        .filter(
          (event): event is Extract<GameEvent, { type: "damage" }> =>
            event.type === "damage",
        )
        .map(({ amount }) => amount),
    ).toEqual([18, 24]);
    expect(result.state.enemies["enemy-1"]!.health).toBe(58);
  });

  it("ignores an early combo edge and resets the next idle attack to light one", () => {
    const lightOne = runTicks(
      createInitialState(1),
      new Map([[0, { attackPressed: true }]]),
      19,
    ).state;
    const tooEarly = stepGame(
      lightOne,
      { ...neutralIntent, attackPressed: true },
      1 / 60,
      arenaContent,
    ).state;
    const idle = runTicks(tooEarly, new Map(), 20).state;
    const restarted = stepGame(
      idle,
      { ...neutralIntent, attackPressed: true },
      1 / 60,
      arenaContent,
    ).state;

    expect(tooEarly.combat.activeAttack?.comboQueued).toBe(false);
    expect(idle.combat.activeAttack).toBeNull();
    expect(restarted.combat.activeAttack?.actionId).toBe(
      "oathblade-light-1",
    );
  });

  it("dodge interrupts an attack and clears its combo state", () => {
    const attacking = runTicks(
      createInitialState(1),
      new Map([[0, { attackPressed: true }]]),
      5,
    ).state;
    const dodging = stepGame(
      attacking,
      { ...neutralIntent, dodgePressed: true },
      1 / 60,
      arenaContent,
    ).state;

    expect(dodging.player).toMatchObject({
      action: "dodge",
      stamina: 64,
    });
    expect(dodging.combat.activeAttack).toBeNull();
  });
});

describe("authoritative ember bow projectile", () => {
  const equipBow = (state = createInitialState(1)) =>
    runTicks(
      state,
      new Map([[0, { switchWeaponPressed: true }]]),
      2,
    ).state;

  it("switches only while idle and synchronizes the real weapon state", () => {
    const bow = equipBow();
    const attacking = stepGame(
      bow,
      { ...neutralIntent, attackPressed: true },
      1 / 60,
      arenaContent,
    ).state;
    const rejected = stepGame(
      attacking,
      { ...neutralIntent, switchWeaponPressed: true },
      1 / 60,
      arenaContent,
    ).state;

    expect(bow.player.weaponId).toBe("ember-bow");
    expect(rejected.player.weaponId).toBe("ember-bow");
    expect(rejected.combat.activeAttack?.actionId).toBe("ember-bow-shot");
  });

  it("spawns a serializable projectile after startup and resolves swept contact once", () => {
    const bow = withEnemy(
      equipBow(),
      enemyAhead("enemy-1", { x: 0, y: -5.8 }),
    );
    const result = runTicks(
      bow,
      new Map([[0, { attackPressed: true }]]),
      60,
    );

    expect(combatEvents(result.events)).toEqual([
      {
        type: "contact",
        attackerId: "player",
        targetId: "enemy-1",
        attackId: "player:2:0",
      },
      {
        type: "damage",
        targetId: "enemy-1",
        amount: 15,
        guarded: false,
      },
    ]);
    expect(result.state.enemies["enemy-1"]!.health).toBe(21);
    expect(result.state.combat.projectiles).toEqual([]);
  });

  it("uses the full segment so a discrete projectile step cannot tunnel", () => {
    expect(
      sweptCircleContact(
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 1, y: 0.03 },
        0.04,
      ),
    ).toBe(true);
    expect(
      sweptCircleContact(
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 1, y: 0.06 },
        0.04,
      ),
    ).toBe(false);
  });

  it("removes projectiles after leaving the authored arena or reaching lifetime", () => {
    const bowAtEdge = equipBow(createInitialState(1));
    bowAtEdge.player.position = { x: 0, y: 11.5 };
    bowAtEdge.player.facingRadians = 0;
    const outOfBounds = runTicks(
      bowAtEdge,
      new Map([[0, { attackPressed: true }]]),
      25,
    ).state;

    const bowForLifetime = equipBow(createInitialState(2));
    bowForLifetime.player.position = { x: 0, y: 0 };
    const expired = runTicks(
      bowForLifetime,
      new Map([[0, { attackPressed: true }]]),
      100,
    ).state;

    expect(outOfBounds.combat.projectiles).toEqual([]);
    expect(expired.combat.projectiles).toEqual([]);
  });
});

describe("incoming damage, guard, dodge, and death", () => {
  it("rounds frontal guard damage to 35 percent and spends nine stamina", () => {
    const player = createInitialState(1).player;
    const result = resolveIncomingDamage(
      player,
      incomingHit(),
      true,
      arenaContent,
    );

    expect(result).toEqual({
      accepted: true,
      health: 98,
      stamina: 91,
      guarded: true,
      guardBroken: false,
      defeated: false,
    });
  });

  it("does not guard a back hit and explicitly breaks guard without nine stamina", () => {
    const player = createInitialState(1).player;
    const backHit = resolveIncomingDamage(
      player,
      incomingHit({ angleDegrees: 160 }),
      true,
      arenaContent,
    );
    const exhausted = {
      ...player,
      stamina: 8,
    };
    const guardBreak = resolveIncomingDamage(
      exhausted,
      incomingHit(),
      true,
      arenaContent,
    );

    expect(backHit).toMatchObject({
      accepted: true,
      health: 85,
      stamina: 100,
      guarded: false,
      guardBroken: false,
    });
    expect(guardBreak).toMatchObject({
      accepted: true,
      health: 85,
      stamina: 0,
      guarded: false,
      guardBroken: true,
    });
  });

  it("rejects dodge contact exactly from 0.08 through 0.20 seconds", () => {
    expect(isContactAccepted({ action: "dodge", actionTime: 0.079 })).toBe(
      true,
    );
    expect(isContactAccepted({ action: "dodge", actionTime: 0.08 })).toBe(
      false,
    );
    expect(isContactAccepted({ action: "dodge", actionTime: 0.2 })).toBe(
      false,
    );
    expect(isContactAccepted({ action: "dodge", actionTime: 0.201 })).toBe(
      true,
    );
    expect(isContactAccepted({ action: "dead", actionTime: 0 })).toBe(
      false,
    );
  });

  it("interrupts an attack on accepted damage and emits one ordered defeat", () => {
    const attacking = runTicks(
      createInitialState(1),
      new Map([[0, { attackPressed: true }]]),
      4,
    ).state;
    attacking.player.health = 15;
    const result = applyIncomingDamage(
      attacking,
      incomingHit({ damage: 20 }),
      false,
      arenaContent,
    );

    expect(result.state.player).toMatchObject({
      health: 0,
      action: "dead",
      actionTime: 0,
    });
    expect(result.state.status).toBe("defeated");
    expect(result.state.combat.activeAttack).toBeNull();
    expect(result.events).toEqual([
      {
        type: "contact",
        attackerId: "enemy-1",
        targetId: "player",
        attackId: "enemy-attack-1",
      },
      {
        type: "damage",
        targetId: "player",
        amount: 20,
        guarded: false,
      },
      { type: "defeated", actorId: "player" },
    ]);

    const duplicate = applyIncomingDamage(
      result.state,
      incomingHit({ damage: 20 }),
      false,
      arenaContent,
    );
    expect(duplicate.state).toBe(result.state);
    expect(duplicate.events).toEqual([]);
  });

  it("does not turn raw guard input into a block while an attack is active", () => {
    const attacking = runTicks(
      createInitialState(1),
      new Map([[0, { attackPressed: true }]]),
      4,
    ).state;
    const result = applyIncomingDamage(
      attacking,
      incomingHit(),
      true,
      arenaContent,
    );

    expect(result.state.player).toMatchObject({
      health: 85,
      stamina: 88,
      action: "hit",
    });
    expect(result.state.combat.activeAttack).toBeNull();
    expect(result.events[1]).toEqual({
      type: "damage",
      targetId: "player",
      amount: 20,
      guarded: false,
    });
  });

  it("keeps an invulnerable dodge and every frozen game status unchanged", () => {
    const dodging = createInitialState(1);
    dodging.player.action = "dodge";
    dodging.player.actionTime = 0.12;
    const rejected = applyIncomingDamage(
      dodging,
      incomingHit(),
      false,
      arenaContent,
    );

    expect(rejected.state).toBe(dodging);
    expect(rejected.events).toEqual([]);

    for (const status of ["upgrade", "defeated", "complete"] as const) {
      const frozen = createInitialState(1);
      frozen.status = status;
      const result = applyIncomingDamage(
        frozen,
        incomingHit(),
        false,
        arenaContent,
      );
      expect(result.state).toBe(frozen);
      expect(result.events).toEqual([]);
    }
  });

  it("holds guard, observes release recovery, and allows a new action only at its boundary", () => {
    const held = runTicks(
      createInitialState(1),
      new Map(
        Array.from({ length: 5 }, (_, tick) => [
          tick,
          { guardHeld: true },
        ]),
      ),
      5,
    ).state;
    const releasing = runTicks(held, new Map(), 7).state;
    const recovered = stepGame(
      releasing,
      neutralIntent,
      1 / 60,
      arenaContent,
    ).state;
    const attack = stepGame(
      recovered,
      { ...neutralIntent, attackPressed: true },
      1 / 60,
      arenaContent,
    ).state;

    expect(held.player.action).toBe("guard");
    expect(releasing.player.action).toBe("guard");
    expect(recovered.player.action).toBe("idle");
    expect(attack.player.action).toBe("attack");
  });
});

describe("combat state integration", () => {
  it("keeps the old state, intent, and authored content unchanged on a combat tick", () => {
    const state = withEnemy(createInitialState(1));
    const intent = { ...neutralIntent, attackPressed: true };
    const stateSnapshot = structuredClone(state);
    const intentSnapshot = structuredClone(intent);
    const contentSnapshot = structuredClone(arenaContent);

    const result = stepGame(state, intent, 1 / 60, arenaContent);

    expect(state).toEqual(stateSnapshot);
    expect(intent).toEqual(intentSnapshot);
    expect(arenaContent).toEqual(contentSnapshot);
    expect(result.state).not.toBe(state);
    expect(result.state.combat.activeAttack?.id).toBe("player:0:0");
  });

  it("does not advance attack timers while paused or in a frozen status", () => {
    const attacking = runTicks(
      createInitialState(1),
      new Map([[0, { attackPressed: true }]]),
      5,
    ).state;
    const paused = stepGame(
      attacking,
      { ...neutralIntent, pausePressed: true },
      1 / 60,
      arenaContent,
    ).state;
    const pausedResult = stepGame(
      paused,
      neutralIntent,
      1 / 60,
      arenaContent,
    );
    const upgrade = {
      ...attacking,
      status: "upgrade" as const,
    };
    const upgradeResult = stepGame(
      upgrade,
      neutralIntent,
      1 / 60,
      arenaContent,
    );

    expect(pausedResult.state).toBe(paused);
    expect(pausedResult.state.combat.activeAttack?.elapsedTicks).toBe(5);
    expect(upgradeResult.state).toBe(upgrade);
    expect(upgradeResult.state.combat.activeAttack?.elapsedTicks).toBe(5);
  });

  it("round-trips every active combat record through JSON", () => {
    let state = runTicks(
      createInitialState(1),
      new Map([[0, { switchWeaponPressed: true }]]),
      2,
    ).state;
    state = runTicks(
      state,
      new Map([[0, { attackPressed: true }]]),
      18,
    ).state;

    expect(state.combat.activeAttack?.actionId).toBe("ember-bow-shot");
    expect(state.combat.projectiles).toHaveLength(1);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it("produces the same attacks, projectile states, contacts, and damage on replay", () => {
    const run = () => {
      const initial = withEnemy(
        createInitialState(7481),
        enemyAhead("enemy-1", { x: 0, y: -5.8 }),
      );
      const intents = new Map<number, Partial<typeof neutralIntent>>([
        [0, { switchWeaponPressed: true }],
        [2, { attackPressed: true }],
        [50, { switchWeaponPressed: true }],
        [52, { attackPressed: true }],
      ]);
      return runTicks(initial, intents, 100);
    };

    expect(run()).toEqual(run());
  });
});
