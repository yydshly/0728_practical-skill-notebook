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
  GameContent,
  GameState,
  IncomingHit,
  ProjectileState,
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

const withManualProjectile = (
  state: GameState,
  overrides: Partial<ProjectileState>,
): GameState => ({
  ...state,
  combat: {
    ...state.combat,
    projectiles: [
      {
        id: "manual-shot:projectile",
        attackId: "manual-shot",
        ownerId: "player",
        position: { x: 0, y: -5 },
        direction: { x: 0, y: 1 },
        speed: 120,
        radius: 0.16,
        ageTicks: 0,
        lifetimeTicks: 75,
        targetLayer: "enemy",
        hitTargetIds: [],
        ...overrides,
      },
    ],
  },
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

describe("projectile world time of impact", () => {
  const tieFixture = (worldTimeOffset: number) => {
    const content: GameContent = {
      ...arenaContent,
      arena: {
        ...arenaContent.arena,
        collisions: [
          {
            id: "z-wall",
            x: 0,
            y: 0,
            z: 0.75 + worldTimeOffset * 2,
            halfWidth: 1,
            halfDepth: 0.1,
            height: 1,
            kind: "interior",
          },
        ],
      },
    };
    const initial = createInitialState(1);
    initial.enemies = {
      "a-target": enemyAhead("a-target", { x: 0, y: 1 }),
    };
    return {
      content,
      state: withManualProjectile(initial, {
        position: { x: 0, y: 0 },
        direction: { x: 0, y: 1 },
        speed: 120,
        radius: 0.1,
      }),
    };
  };

  it("prioritizes world contact over an enemy at the same TOI regardless of IDs", () => {
    const { state, content } = tieFixture(0);

    const result = stepGame(
      state,
      neutralIntent,
      1 / 60,
      content,
    );

    expect(result.events).toEqual([]);
    expect(result.state.enemies["a-target"]!.health).toBe(36);
    expect(result.state.combat.projectiles).toEqual([]);
  });

  it.each([
    {
      name: "world later within epsilon is treated as a tie",
      worldTimeOffset: 0.5e-9,
      expectedHealth: 36,
    },
    {
      name: "world later beyond epsilon loses to the enemy",
      worldTimeOffset: 2e-9,
      expectedHealth: 21,
    },
    {
      name: "world earlier beyond epsilon remains first",
      worldTimeOffset: -2e-9,
      expectedHealth: 36,
    },
  ])("$name", ({ worldTimeOffset, expectedHealth }) => {
    const { state, content } = tieFixture(worldTimeOffset);

    const result = stepGame(
      state,
      neutralIntent,
      1 / 60,
      content,
    );

    expect(result.state.enemies["a-target"]!.health).toBe(
      expectedHealth,
    );
    expect(result.state.combat.projectiles).toEqual([]);
  });

  it("destroys a shot on the closed boss gate before it can damage an enemy behind it", () => {
    const initial = createInitialState(1);
    initial.enemies = {
      "enemy-behind-gate": enemyAhead(
        "enemy-behind-gate",
        { x: 0, y: 8.8 },
      ),
    };
    const state = withManualProjectile(initial, {
      position: { x: 0, y: 7 },
      direction: { x: 0, y: 1 },
      speed: 120,
    });

    const result = stepGame(
      state,
      neutralIntent,
      1 / 60,
      arenaContent,
    );

    expect(result.events).toEqual([]);
    expect(result.state.enemies["enemy-behind-gate"]!.health).toBe(36);
    expect(result.state.combat.projectiles).toEqual([]);
  });

  it("lets the same shot hit through the open boss gate", () => {
    const initial = createInitialState(1);
    initial.encounter.gateOpen = true;
    initial.enemies = {
      "enemy-behind-gate": enemyAhead(
        "enemy-behind-gate",
        { x: 0, y: 8.8 },
      ),
    };
    const state = withManualProjectile(initial, {
      position: { x: 0, y: 7 },
      direction: { x: 0, y: 1 },
      speed: 120,
    });

    const result = stepGame(
      state,
      neutralIntent,
      1 / 60,
      arenaContent,
    );

    expect(result.events).toEqual([
      {
        type: "contact",
        attackerId: "player",
        targetId: "enemy-behind-gate",
        attackId: "manual-shot",
      },
      {
        type: "damage",
        targetId: "enemy-behind-gate",
        amount: 15,
        guarded: false,
      },
    ]);
    expect(result.state.enemies["enemy-behind-gate"]!.health).toBe(21);
    expect(result.state.combat.projectiles).toEqual([]);
  });

  it("uses an active interior AABB as an earlier world contact", () => {
    const initial = createInitialState(1);
    initial.enemies = {
      "enemy-behind-anvil": enemyAhead(
        "enemy-behind-anvil",
        { x: -4.2, y: -0.5 },
      ),
    };
    const state = withManualProjectile(initial, {
      position: { x: -8, y: -0.5 },
      direction: { x: 1, y: 0 },
      speed: 240,
    });

    const result = stepGame(
      state,
      neutralIntent,
      1 / 60,
      arenaContent,
    );

    expect(result.events).toEqual([]);
    expect(result.state.enemies["enemy-behind-anvil"]!.health).toBe(36);
    expect(result.state.combat.projectiles).toEqual([]);
  });

  it("selects the nearer enemy by TOI even when its ID sorts later", () => {
    const initial = createInitialState(1);
    initial.enemies = {
      "a-far": enemyAhead("a-far", { x: 0, y: -3.2 }),
      "z-near": enemyAhead("z-near", { x: 0, y: -4 }),
    };
    const state = withManualProjectile(initial, {});

    const result = stepGame(
      state,
      neutralIntent,
      1 / 60,
      arenaContent,
    );

    expect(
      result.events.find(({ type }) => type === "contact"),
    ).toEqual({
      type: "contact",
      attackerId: "player",
      targetId: "z-near",
      attackId: "manual-shot",
    });
    expect(result.state.enemies["z-near"]!.health).toBe(21);
    expect(result.state.enemies["a-far"]!.health).toBe(36);
  });

  it("uses stable target ID only for an exact TOI tie", () => {
    const initial = createInitialState(1);
    initial.enemies = {
      "z-target": enemyAhead("z-target", { x: 0, y: -4 }),
      "a-target": enemyAhead("a-target", { x: 0, y: -4 }),
    };
    const state = withManualProjectile(initial, {});

    const result = stepGame(
      state,
      neutralIntent,
      1 / 60,
      arenaContent,
    );

    expect(
      result.events.find(({ type }) => type === "contact"),
    ).toEqual({
      type: "contact",
      attackerId: "player",
      targetId: "a-target",
      attackId: "manual-shot",
    });
    expect(result.state.enemies["a-target"]!.health).toBe(21);
    expect(result.state.enemies["z-target"]!.health).toBe(36);
  });

  it("cannot tunnel through a circle during one large fixed-step segment", () => {
    const initial = createInitialState(1);
    initial.enemies = {
      "thin-crossing": enemyAhead(
        "thin-crossing",
        { x: 0, y: -4 },
      ),
    };
    const state = withManualProjectile(initial, {
      position: { x: 0, y: -5 },
      direction: { x: 0, y: 1 },
      speed: 120,
      radius: 0.01,
    });

    const result = stepGame(
      state,
      neutralIntent,
      1 / 60,
      arenaContent,
    );

    expect(result.state.enemies["thin-crossing"]!.health).toBe(21);
    expect(result.state.combat.projectiles).toEqual([]);
  });

  it("treats leaving the arena bounds as world contact during the segment", () => {
    const initial = createInitialState(1);
    initial.enemies = {
      "outside-target": enemyAhead(
        "outside-target",
        { x: 0, y: 12.5 },
      ),
    };
    const state = withManualProjectile(initial, {
      position: { x: 0, y: 11.7 },
      direction: { x: 0, y: 1 },
      speed: 120,
    });
    const boundaryOnlyContent = {
      ...arenaContent,
      arena: {
        ...arenaContent.arena,
        collisions: [],
      },
    };

    const result = stepGame(
      state,
      neutralIntent,
      1 / 60,
      boundaryOnlyContent,
    );

    expect(result.events).toEqual([]);
    expect(result.state.enemies["outside-target"]!.health).toBe(36);
    expect(result.state.combat.projectiles).toEqual([]);
  });

  it("keeps the old projectile hit set and state pure while resolving TOI", () => {
    const initial = createInitialState(1);
    initial.enemies = {
      "new-target": enemyAhead("new-target", { x: 0, y: -4 }),
    };
    const state = withManualProjectile(initial, {
      hitTargetIds: ["already-hit"],
    });
    const oldProjectile = state.combat.projectiles[0]!;
    const oldHitTargetIds = oldProjectile.hitTargetIds;
    const snapshot = structuredClone(state);

    const result = stepGame(
      state,
      neutralIntent,
      1 / 60,
      arenaContent,
    ).state;

    expect(state).toEqual(snapshot);
    expect(state.combat.projectiles[0]).toBe(oldProjectile);
    expect(oldProjectile.hitTargetIds).toBe(oldHitTargetIds);
    expect(oldHitTargetIds).toEqual(["already-hit"]);
    expect(result.enemies["new-target"]!.health).toBe(21);
  });

  it("shares an unchanged projectile hit set while only its position advances", () => {
    const state = withManualProjectile(createInitialState(1), {
      speed: 12,
      hitTargetIds: ["already-hit"],
    });
    const oldProjectile = state.combat.projectiles[0]!;
    const oldHitTargetIds = oldProjectile.hitTargetIds;

    const result = stepGame(
      state,
      neutralIntent,
      1 / 60,
      arenaContent,
    ).state;

    expect(result.combat.projectiles).toHaveLength(1);
    expect(result.combat.projectiles[0]).not.toBe(oldProjectile);
    expect(result.combat.projectiles[0]?.hitTargetIds).toBe(
      oldHitTargetIds,
    );
    expect(oldHitTargetIds).toEqual(["already-hit"]);
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

  it("recovers a nonfatal hit on tick 18 and accepts movement plus attack only on the following tick", () => {
    const hit = applyIncomingDamage(
      createInitialState(1),
      incomingHit(),
      false,
      arenaContent,
    ).state;
    const beforeBoundary = runTicks(hit, new Map(), 17).state;
    const atBoundary = stepGame(
      beforeBoundary,
      { ...neutralIntent, lockPressed: true },
      1 / 60,
      arenaContent,
    ).state;
    const afterBoundary = stepGame(
      atBoundary,
      {
        ...neutralIntent,
        moveY: 1,
        attackPressed: true,
        lockPressed: true,
      },
      1 / 60,
      arenaContent,
    ).state;

    expect(hit.player).toMatchObject({ action: "hit", actionTime: 0 });
    expect(hit.combat.playerHitRecoveryTicks).toBe(0);
    expect(beforeBoundary.player.action).toBe("hit");
    expect(beforeBoundary.player.actionTime).toBeCloseTo(17 / 60, 10);
    expect(beforeBoundary.combat.playerHitRecoveryTicks).toBe(17);
    expect(atBoundary.player).toMatchObject({
      action: "idle",
      actionTime: 0,
      lockTargetId: null,
    });
    expect(atBoundary.combat.playerHitRecoveryTicks).toBe(0);
    expect(afterBoundary.player.action).toBe("attack");
    expect(afterBoundary.player.position.y).toBeCloseTo(-8.93, 10);
    expect(afterBoundary.combat.activeAttack?.actionId).toBe(
      "oathblade-light-1",
    );
    expect(afterBoundary.player.lockTargetId).toBe(
      "training-lock-target",
    );
  });

  it("ignores every player verb during hit recovery, including dodge with enough stamina", () => {
    const hit = applyIncomingDamage(
      createInitialState(1),
      incomingHit(),
      false,
      arenaContent,
    ).state;
    const result = stepGame(
      hit,
      {
        ...neutralIntent,
        moveX: 1,
        moveY: 1,
        attackPressed: true,
        guardHeld: true,
        dodgePressed: true,
        lockPressed: true,
        switchWeaponPressed: true,
        healPressed: true,
      },
      1 / 60,
      arenaContent,
    ).state;

    expect(result.player).toMatchObject({
      action: "hit",
      actionTime: 1 / 60,
      position: { x: 0, y: -9 },
      stamina: 100,
      weaponId: "oathblade",
      healingCharges: 3,
      lockTargetId: null,
    });
    expect(result.combat).toMatchObject({
      activeAttack: null,
      playerHitRecoveryTicks: 1,
    });
  });

  it("produces the same hit-recovery state with or without lock input", () => {
    const hit = applyIncomingDamage(
      createInitialState(1),
      incomingHit(),
      false,
      arenaContent,
    ).state;
    const withoutLock = stepGame(
      hit,
      neutralIntent,
      1 / 60,
      arenaContent,
    ).state;
    const withLock = stepGame(
      hit,
      { ...neutralIntent, lockPressed: true },
      1 / 60,
      arenaContent,
    ).state;

    expect(withLock).toEqual(withoutLock);
    expect(withLock.player.lockTargetId).toBeNull();
    expect(withLock.combat).toEqual(withoutLock.combat);
  });

  it("resets hit recovery on another accepted nonfatal hit", () => {
    const first = applyIncomingDamage(
      createInitialState(1),
      incomingHit(),
      false,
      arenaContent,
    ).state;
    const recovering = runTicks(first, new Map(), 10).state;
    const second = applyIncomingDamage(
      recovering,
      incomingHit({ attackId: "enemy-attack-2", damage: 5 }),
      false,
      arenaContent,
    ).state;
    const beforeBoundary = runTicks(second, new Map(), 17).state;
    const recovered = stepGame(
      beforeBoundary,
      neutralIntent,
      1 / 60,
      arenaContent,
    ).state;

    expect(recovering.combat.playerHitRecoveryTicks).toBe(10);
    expect(second.player).toMatchObject({
      action: "hit",
      actionTime: 0,
      health: 80,
    });
    expect(second.combat.playerHitRecoveryTicks).toBe(0);
    expect(beforeBoundary.player.action).toBe("hit");
    expect(recovered.player.action).toBe("idle");
  });

  it("freezes hit recovery while paused or in a non-playing status and never recovers dead", () => {
    const hit = applyIncomingDamage(
      createInitialState(1),
      incomingHit(),
      false,
      arenaContent,
    ).state;
    const paused = stepGame(
      hit,
      { ...neutralIntent, pausePressed: true },
      1 / 60,
      arenaContent,
    ).state;
    const pausedFrame = stepGame(
      paused,
      { ...neutralIntent, lockPressed: true },
      1 / 60,
      arenaContent,
    );
    const upgrade = {
      ...hit,
      status: "upgrade" as const,
    };
    const upgradeFrame = stepGame(
      upgrade,
      { ...neutralIntent, lockPressed: true },
      1 / 60,
      arenaContent,
    );
    const lethalState = createInitialState(2);
    lethalState.player.health = 5;
    const dead = applyIncomingDamage(
      lethalState,
      incomingHit({ damage: 20 }),
      false,
      arenaContent,
    ).state;
    const deadFrame = stepGame(
      dead,
      { ...neutralIntent, lockPressed: true },
      1 / 60,
      arenaContent,
    );

    expect(pausedFrame.state).toBe(paused);
    expect(pausedFrame.state.combat.playerHitRecoveryTicks).toBe(0);
    expect(upgradeFrame.state).toBe(upgrade);
    expect(upgradeFrame.state.combat.playerHitRecoveryTicks).toBe(0);
    expect(dead.player.action).toBe("dead");
    expect(deadFrame.state).toBe(dead);
    expect(deadFrame.state.player.action).toBe("dead");
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
  it("shares an unchanged hit set across an attack tick with no new contact", () => {
    const before = runTicks(
      createInitialState(1),
      new Map([[0, { attackPressed: true }]]),
      5,
    ).state;
    const oldAttack = before.combat.activeAttack!;
    const oldHitTargetIds = oldAttack.hitTargetIds;

    const result = stepGame(
      before,
      neutralIntent,
      1 / 60,
      arenaContent,
    ).state;

    expect(result.combat.activeAttack).not.toBe(oldAttack);
    expect(result.combat.activeAttack?.hitTargetIds).toBe(oldHitTargetIds);
    expect(oldHitTargetIds).toEqual([]);
  });

  it("keeps the pre-contact attack and hit set deeply immutable on one melee hit", () => {
    const beforeContact = runTicks(
      withEnemy(createInitialState(1)),
      new Map([[0, { attackPressed: true }]]),
      9,
    ).state;
    const oldAttack = beforeContact.combat.activeAttack!;
    const oldHitTargetIds = oldAttack.hitTargetIds;
    const snapshot = structuredClone(beforeContact);

    const result = stepGame(
      beforeContact,
      neutralIntent,
      1 / 60,
      arenaContent,
    ).state;

    expect(beforeContact).toEqual(snapshot);
    expect(beforeContact.combat.activeAttack).toBe(oldAttack);
    expect(oldAttack.hitTargetIds).toBe(oldHitTargetIds);
    expect(oldHitTargetIds).toEqual([]);
    expect(result.combat.activeAttack).not.toBe(oldAttack);
    expect(result.combat.activeAttack?.hitTargetIds).toEqual(["enemy-1"]);
    expect(result.encounter).toBe(beforeContact.encounter);
    expect(result.drops).toBe(beforeContact.drops);
  });

  it("copy-on-writes one hit set for same-frame and later melee contacts", () => {
    const initial = createInitialState(1);
    initial.enemies = {
      "enemy-b": enemyAhead("enemy-b", { x: 0.45, y: -7.65 }),
      "enemy-a": enemyAhead("enemy-a", { x: -0.45, y: -7.65 }),
    };
    const beforeFirstContacts = runTicks(
      initial,
      new Map([[0, { attackPressed: true }]]),
      9,
    ).state;
    const firstOldAttack = beforeFirstContacts.combat.activeAttack!;
    const firstOldIds = firstOldAttack.hitTargetIds;
    const first = stepGame(
      beforeFirstContacts,
      neutralIntent,
      1 / 60,
      arenaContent,
    ).state;

    expect(firstOldIds).toEqual([]);
    expect(first.combat.activeAttack?.hitTargetIds).toEqual([
      "enemy-a",
      "enemy-b",
    ]);

    const beforeLaterContact: GameState = {
      ...first,
      enemies: {
        ...first.enemies,
        "enemy-c": enemyAhead("enemy-c", { x: 0, y: -7.5 }),
      },
    };
    const laterOldAttack = beforeLaterContact.combat.activeAttack!;
    const laterOldIds = laterOldAttack.hitTargetIds;
    const laterSnapshot = structuredClone(beforeLaterContact);
    const later = stepGame(
      beforeLaterContact,
      neutralIntent,
      1 / 60,
      arenaContent,
    ).state;

    expect(beforeLaterContact).toEqual(laterSnapshot);
    expect(laterOldAttack.hitTargetIds).toBe(laterOldIds);
    expect(laterOldIds).toEqual(["enemy-a", "enemy-b"]);
    expect(later.combat.activeAttack?.hitTargetIds).toEqual([
      "enemy-a",
      "enemy-b",
      "enemy-c",
    ]);
  });

  it("keeps the old projectile, projectile hit set, and enemy snapshot unchanged on contact", () => {
    let state = runTicks(
      createInitialState(1),
      new Map([[0, { switchWeaponPressed: true }]]),
      2,
    ).state;
    state.player.position = { x: 0, y: -9 };
    state.enemies = {
      "enemy-1": enemyAhead("enemy-1", { x: 0, y: -7.6 }),
    };
    state = runTicks(
      state,
      new Map([[0, { attackPressed: true }]]),
      16,
    ).state;
    const beforeContact = stepGame(
      state,
      neutralIntent,
      1 / 60,
      arenaContent,
    ).state;
    const oldProjectile = beforeContact.combat.projectiles[0]!;
    const oldHitTargetIds = oldProjectile.hitTargetIds;
    const snapshot = structuredClone(beforeContact);

    const result = stepGame(
      beforeContact,
      neutralIntent,
      1 / 60,
      arenaContent,
    ).state;

    expect(beforeContact).toEqual(snapshot);
    expect(oldProjectile.hitTargetIds).toBe(oldHitTargetIds);
    expect(oldHitTargetIds).toEqual([]);
    expect(beforeContact.enemies["enemy-1"]!.health).toBe(36);
    expect(result.enemies["enemy-1"]!.health).toBe(21);
    expect(result.combat.projectiles).toEqual([]);
  });

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
