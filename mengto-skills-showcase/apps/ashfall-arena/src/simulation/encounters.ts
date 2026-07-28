import { enemyDefinitions } from "../content/enemy-definitions";
import { createInitialState } from "./create-initial-state";
import type {
  EncounterPhase,
  EnemyKind,
  EnemyState,
  GameEvent,
  GameState,
  StepGameResult,
  Vec2,
} from "./types";

export type EncounterFixture =
  | "fresh"
  | "wave-one"
  | "elite"
  | "boss"
  | "complete";

const PHASE_ENEMY_IDS = Object.freeze({
  training: ["training-crawler"],
  "wave-one": [
    "wave-one-crawler-a",
    "wave-one-crawler-b",
    "wave-one-warden",
  ],
  elite: ["elite-bell", "elite-crawler"],
  boss: ["boss-sovereign"],
  complete: [],
} satisfies Record<EncounterPhase, readonly string[]>);

const SPAWNS = Object.freeze({
  "training-crawler": {
    kind: "glass-crawler",
    position: { x: 0, y: -4.1 },
    nonlethal: true,
  },
  "wave-one-crawler-a": {
    kind: "glass-crawler",
    position: { x: 0, y: 0 },
  },
  "wave-one-crawler-b": {
    kind: "glass-crawler",
    position: { x: 2.2, y: 0.5 },
  },
  "wave-one-warden": {
    kind: "ash-warden",
    position: { x: -4.5, y: 0 },
  },
  "elite-bell": {
    kind: "bell-elite",
    position: { x: 0, y: 6.7 },
  },
  "elite-crawler": {
    kind: "glass-crawler",
    position: { x: 2.2, y: 5.3 },
  },
  "boss-sovereign": {
    kind: "bell-sovereign",
    position: { x: 0, y: 10.2 },
  },
  "boss-summon-65-crawler": {
    kind: "glass-crawler",
    position: { x: -2.6, y: 9.4 },
    spawnedBy: "boss-sovereign",
  },
  "boss-summon-30-warden": {
    kind: "ash-warden",
    position: { x: 3.7, y: 10.4 },
    spawnedBy: "boss-sovereign",
  },
} as const satisfies Record<
  string,
  {
    kind: EnemyKind;
    position: Vec2;
    nonlethal?: boolean;
    spawnedBy?: string;
  }
>);

export function createEncounterEnemy(
  id: string,
  kind: EnemyKind,
  position: Vec2,
  overrides: Partial<EnemyState> = {},
): EnemyState {
  const definition = enemyDefinitions[kind];
  return {
    id,
    kind,
    definitionId: kind,
    facingRadians: Math.PI,
    health: definition.maxHealth,
    maxHealth: definition.maxHealth,
    stamina: 100,
    maxStamina: 100,
    action: "idle",
    actionTime: 0,
    collisionLayer: "enemy",
    intent: "observe",
    intentTicks: 0,
    visibleTicks: 0,
    cooldownTicks: 0,
    targetId: "player",
    currentMoveId: null,
    movePhase: "none",
    moveElapsedTicks: 0,
    attackSequence: 0,
    hitTargetIds: [],
    lockedFacingRadians: Math.PI,
    pathFailureTicks: 0,
    staggerTicks: 0,
    aiEnabled: true,
    nonlethal: false,
    bossPhase: 1,
    spawnedBy: null,
    ...overrides,
    position: overrides.position
      ? { ...overrides.position }
      : { ...position },
  };
}

const spawnById = (id: keyof typeof SPAWNS): EnemyState => {
  const spawn = SPAWNS[id];
  return createEncounterEnemy(id, spawn.kind, spawn.position, {
    nonlethal: "nonlethal" in spawn ? Boolean(spawn.nonlethal) : false,
    spawnedBy: "spawnedBy" in spawn ? spawn.spawnedBy : null,
  });
};

const spawnPhase = (
  state: GameState,
  phase: EncounterPhase,
): GameState => {
  const ids = PHASE_ENEMY_IDS[phase].filter(
    (id) => !state.encounter.spawnedIds.includes(id),
  );
  if (ids.length === 0) return state;

  const enemies = { ...state.enemies };
  for (const id of ids) {
    enemies[id] = spawnById(id as keyof typeof SPAWNS);
  }
  return {
    ...state,
    enemies,
    encounter: {
      ...state.encounter,
      spawnedIds: [...state.encounter.spawnedIds, ...ids],
    },
  };
};

const removeEnemies = (
  state: GameState,
  ids: readonly string[],
): GameState => {
  if (!ids.some((id) => id in state.enemies)) return state;
  const enemies = { ...state.enemies };
  for (const id of ids) delete enemies[id];
  return { ...state, enemies };
};

const recordDefeats = (
  state: GameState,
  events: readonly GameEvent[],
): GameState => {
  const defeatedIds = events
    .filter(
      (event): event is Extract<GameEvent, { type: "defeated" }> =>
        event.type === "defeated" &&
        event.actorId !== state.player.id &&
        event.actorId in state.enemies,
    )
    .map(({ actorId }) => actorId)
    .sort();
  const newIds = defeatedIds.filter(
    (id) => !state.encounter.completedIds.includes(id),
  );
  if (newIds.length === 0) return state;
  return {
    ...state,
    encounter: {
      ...state.encounter,
      completedIds: [...state.encounter.completedIds, ...newIds],
    },
  };
};

const allCompleted = (
  state: GameState,
  phase: EncounterPhase,
): boolean =>
  PHASE_ENEMY_IDS[phase].every((id) =>
    state.encounter.completedIds.includes(id)
  );

export function clearTransientEnemyCombat(
  state: Readonly<GameState>,
): GameState {
  const combatChanged =
    state.combat.enemyProjectiles.length > 0 ||
    state.combat.spawnedEnemyAttackIds.length > 0 ||
    state.combat.receivedAttackIds.length > 0;
  const enemyAiChanged =
    state.enemyAi.meleeSlotOwner !== null ||
    state.enemyAi.rangedSlotOwner !== null ||
    state.enemyAi.rangedWindowUsed ||
    state.enemyAi.supportSlotOwner !== null;
  const transientEnemyIds = new Set(
    Object.values(state.enemies)
      .filter(
        (enemy) =>
          enemy.currentMoveId !== null ||
          enemy.movePhase !== "none" ||
          enemy.moveElapsedTicks !== 0 ||
          enemy.cooldownTicks !== 0 ||
          enemy.hitTargetIds.length > 0,
      )
      .map(({ id }) => id),
  );
  if (
    !combatChanged &&
    !enemyAiChanged &&
    transientEnemyIds.size === 0
  ) {
    return state as GameState;
  }

  const enemies =
    transientEnemyIds.size === 0
      ? state.enemies
      : Object.fromEntries(
          Object.entries(state.enemies).map(([id, enemy]) => {
            if (!transientEnemyIds.has(id)) return [id, enemy];
            const wasAttacking = enemy.action === "attack";
            return [
              id,
              {
                ...enemy,
                intent:
                  enemy.intent === "telegraph" ||
                    enemy.intent === "attack" ||
                    enemy.intent === "recover"
                    ? "observe" as const
                    : enemy.intent,
                action: wasAttacking ? "idle" as const : enemy.action,
                actionTime: wasAttacking ? 0 : enemy.actionTime,
                currentMoveId: null,
                movePhase: "none" as const,
                moveElapsedTicks: 0,
                cooldownTicks: 0,
                hitTargetIds: [],
              },
            ];
          }),
        );

  return {
    ...state,
    enemies,
    combat: combatChanged
      ? {
          ...state.combat,
          enemyProjectiles: [],
          spawnedEnemyAttackIds: [],
          receivedAttackIds: [],
        }
      : state.combat,
    enemyAi: enemyAiChanged
      ? {
          ...state.enemyAi,
          meleeSlotOwner: null,
          rangedSlotOwner: null,
          rangedWindowUsed: false,
          supportSlotOwner: null,
        }
      : state.enemyAi,
  };
}

const transition = (
  state: GameState,
  phase: EncounterPhase,
  gateOpen: boolean,
): GameState =>
  clearTransientEnemyCombat({
    ...state,
    encounter: {
      ...state.encounter,
      phase,
      gateOpen,
      phaseEntryTick: state.tick,
    },
  });

const isInsideTraining = (state: GameState): boolean =>
  Math.hypot(
    state.player.position.x,
    state.player.position.y + 5,
  ) <= 2;

function stepTraining(
  state: GameState,
  events: readonly GameEvent[],
): StepGameResult {
  let working = state;
  const produced: GameEvent[] = [];

  if (!working.encounter.trainingSpawned && isInsideTraining(working)) {
    working = spawnPhase(working, "training");
    const trainingEnemy = working.enemies["training-crawler"];
    working = {
      ...working,
      enemies:
        trainingEnemy && !working.encounter.trainingAiEnabled
          ? {
              ...working.enemies,
              [trainingEnemy.id]: {
                ...trainingEnemy,
                aiEnabled: false,
              },
            }
          : working.enemies,
      encounter: {
        ...working.encounter,
        trainingSpawned: true,
      },
    };
  }

  const attackSeen =
    working.encounter.trainingAttackSeen ||
    events.some(
      (event) =>
        event.type === "damage" &&
        event.targetId === "training-crawler",
    );
  const guardSeen =
    working.encounter.trainingGuardSeen ||
    events.some(
      (event) =>
        event.type === "damage" &&
        event.targetId === working.player.id &&
        event.guarded,
    );
  if (
    attackSeen !== working.encounter.trainingAttackSeen ||
    guardSeen !== working.encounter.trainingGuardSeen
  ) {
    working = {
      ...working,
      encounter: {
        ...working.encounter,
        trainingAttackSeen: attackSeen,
        trainingGuardSeen: guardSeen,
      },
    };
  }

  if (attackSeen && guardSeen) {
    working = removeEnemies(working, PHASE_ENEMY_IDS.training);
    working = transition(working, "wave-one", false);
    working = spawnPhase(working, "wave-one");
    produced.push({ type: "encounter-phase", phase: "wave-one" });
  }

  return { state: working, events: produced };
}

function stepBossThresholds(state: GameState): StepGameResult {
  const boss = state.enemies["boss-sovereign"];
  if (!boss || boss.health <= 0) return { state, events: [] };

  let working = state;
  const produced: GameEvent[] = [];
  const ratio = boss.health / boss.maxHealth;
  const thresholds = [
    {
      key: 65 as const,
      ratio: 0.65,
      phase: 2 as const,
    },
    {
      key: 30 as const,
      ratio: 0.3,
      phase: 3 as const,
    },
  ];

  for (const threshold of thresholds) {
    if (
      ratio > threshold.ratio ||
      working.encounter.bossThresholds[threshold.key]
    ) {
      continue;
    }
    const currentBoss = working.enemies["boss-sovereign"]!;
    working = {
      ...working,
      enemies: {
        ...working.enemies,
        [currentBoss.id]: {
          ...currentBoss,
          bossPhase: threshold.phase,
        },
      },
      encounter: {
        ...working.encounter,
        bossThresholds: {
          ...working.encounter.bossThresholds,
          [threshold.key]: true,
        },
        pendingSummons: working.encounter.pendingSummons.includes(
            threshold.key,
          )
          ? working.encounter.pendingSummons
          : [...working.encounter.pendingSummons, threshold.key],
      },
    };
    produced.push({
      type: "boss-phase",
      phase: threshold.phase,
      threshold: threshold.key,
    });
  }
  return { state: working, events: produced };
}

const consumeBossSummon = (
  state: GameState,
  events: readonly GameEvent[],
): StepGameResult => {
  const active = events.find(
    (event): event is Extract<GameEvent, { type: "enemy-move-active" }> =>
      event.type === "enemy-move-active" &&
      event.enemyId === "boss-sovereign" &&
      event.moveId === "sovereign-summon" &&
      !state.encounter.consumedSummonAttackIds.includes(event.attackId),
  );
  const threshold = state.encounter.pendingSummons[0];
  const boss = state.enemies["boss-sovereign"];
  if (!active || threshold === undefined || !boss || boss.health <= 0) {
    return { state, events: [] };
  }

  const id = threshold === 65
    ? "boss-summon-65-crawler"
    : "boss-summon-30-warden";
  if (
    state.encounter.completedSummons.includes(threshold) ||
    state.encounter.spawnedIds.includes(id)
  ) {
    return {
      state: {
        ...state,
        encounter: {
          ...state.encounter,
          pendingSummons: state.encounter.pendingSummons.slice(1),
          consumedSummonAttackIds: [
            ...state.encounter.consumedSummonAttackIds,
            active.attackId,
          ],
        },
      },
      events: [],
    };
  }

  return {
    state: {
      ...state,
      enemies: {
        ...state.enemies,
        [id]: spawnById(id),
      },
      encounter: {
        ...state.encounter,
        pendingSummons: state.encounter.pendingSummons.slice(1),
        completedSummons: [
          ...state.encounter.completedSummons,
          threshold,
        ],
        consumedSummonAttackIds: [
          ...state.encounter.consumedSummonAttackIds,
          active.attackId,
        ],
        spawnedIds: [...state.encounter.spawnedIds, id],
      },
    },
    events: [{ type: "enemy-summoned", enemyId: id, threshold }],
  };
};

export function stepEncounter(
  state: GameState,
  events: readonly GameEvent[],
): StepGameResult {
  let working = recordDefeats(state, events);
  if (working.player.health <= 0 || working.status === "defeated") {
    const bossDefeated =
      working.encounter.completedIds.includes("boss-sovereign") ||
      (working.enemies["boss-sovereign"]?.health ?? 1) <= 0;
    const defeatedState = clearTransientEnemyCombat({
      ...working,
      status: "defeated" as const,
      encounter: bossDefeated
        ? { ...working.encounter, pendingSummons: [] }
        : working.encounter,
    });
    return {
      state: defeatedState,
      events: [],
    };
  }
  if (working.encounter.phase === "complete") {
    return { state: working, events: [] };
  }

  if (working.encounter.phase === "training") {
    return stepTraining(working, events);
  }

  if (
    working.encounter.phase === "wave-one" &&
    allCompleted(working, "wave-one")
  ) {
    working = removeEnemies(working, PHASE_ENEMY_IDS["wave-one"]);
    working = transition(working, "elite", false);
    return {
      state: { ...working, status: "upgrade" },
      events: [{ type: "upgrade-offered" }],
    };
  }

  if (
    working.encounter.phase === "elite" &&
    allCompleted(working, "elite")
  ) {
    working = removeEnemies(working, PHASE_ENEMY_IDS.elite);
    working = transition(working, "boss", true);
    working = spawnPhase(working, "boss");
    return {
      state: working,
      events: [{ type: "encounter-phase", phase: "boss" }],
    };
  }

  if (
    working.encounter.phase === "boss" &&
    working.encounter.completedIds.includes("boss-sovereign")
  ) {
    working = removeEnemies(working, Object.keys(working.enemies));
    working = transition(working, "complete", true);
    return {
      state: {
        ...working,
        status: "complete",
        encounter: {
          ...working.encounter,
          pendingSummons: [],
        },
      },
      events: [
        { type: "encounter-complete" },
        { type: "encounter-phase", phase: "complete" },
      ],
    };
  }

  if (working.encounter.phase === "boss") {
    const threshold = stepBossThresholds(working);
    const summon = consumeBossSummon(threshold.state, events);
    return {
      state: summon.state,
      events: [...threshold.events, ...summon.events],
    };
  }

  if (
    working.encounter.phase === "elite" &&
    working.status === "playing"
  ) {
    working = spawnPhase(working, "elite");
  }

  return { state: working, events: [] };
}

export function createEncounterFixture(
  seed: number,
  fixture: EncounterFixture,
  options: Readonly<{
    accelerated?: boolean;
    trainingAiEnabled?: boolean;
    enemyAiEnabled?: boolean;
  }> = {},
): GameState {
  const source = createInitialState(seed);
  const initial =
    options.trainingAiEnabled === undefined
      ? source
      : {
          ...source,
          encounter: {
            ...source.encounter,
            trainingAiEnabled: options.trainingAiEnabled,
          },
        };
  const finish = (state: GameState): GameState => {
    if (
      !options.accelerated &&
      options.enemyAiEnabled === undefined
    ) {
      return clearTransientEnemyCombat(state);
    }
    return clearTransientEnemyCombat({
      ...state,
      enemies: Object.fromEntries(
        Object.entries(state.enemies).map(([id, enemy]) => [
          id,
          {
            ...enemy,
            health: options.accelerated
              ? Math.min(enemy.health, 18)
              : enemy.health,
            aiEnabled:
              options.enemyAiEnabled ?? enemy.aiEnabled,
          },
        ]),
      ),
    });
  };
  switch (fixture) {
    case "fresh":
      return finish(initial);
    case "wave-one":
      return finish(spawnPhase(
        {
          ...initial,
          player: {
            ...initial.player,
            position: { x: 0, y: -1.4 },
            facingRadians: 0,
          },
          encounter: {
            ...initial.encounter,
            phase: "wave-one",
            trainingSpawned: true,
            trainingAttackSeen: true,
            trainingGuardSeen: true,
          },
        },
        "wave-one",
      ));
    case "elite":
      return finish(spawnPhase(
        {
          ...initial,
          player: {
            ...initial.player,
            position: { x: 0, y: 4.2 },
            facingRadians: 0,
          },
          encounter: {
            ...initial.encounter,
            phase: "elite",
            trainingSpawned: true,
            trainingAttackSeen: true,
            trainingGuardSeen: true,
          },
        },
        "elite",
      ));
    case "boss":
      return finish(spawnPhase(
        {
          ...initial,
          player: {
            ...initial.player,
            position: { x: 0, y: 7 },
            facingRadians: 0,
          },
          encounter: {
            ...initial.encounter,
            phase: "boss",
            gateOpen: true,
            trainingSpawned: true,
            trainingAttackSeen: true,
            trainingGuardSeen: true,
          },
        },
        "boss",
      ));
    case "complete":
      return finish({
        ...initial,
        status: "complete",
        encounter: {
          ...initial.encounter,
          phase: "complete",
          gateOpen: true,
          trainingSpawned: true,
          trainingAttackSeen: true,
          trainingGuardSeen: true,
        },
      });
    default:
      throw new Error(`Unknown encounter fixture: ${String(fixture)}`);
  }
}
