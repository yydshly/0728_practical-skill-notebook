import { enterEliteAfterUpgrade } from "./encounters";
import type {
  DropDefinitionId,
  EnemyKind,
  GameEvent,
  GameState,
  StepGameResult,
} from "./types";

export interface DropDefinition {
  readonly id: DropDefinitionId;
  readonly kind: "souls" | "healing";
  readonly amount: number;
}

export const dropDefinitions = Object.freeze({
  "glass-crawler-souls": Object.freeze({
    id: "glass-crawler-souls",
    kind: "souls",
    amount: 10,
  }),
  "ash-warden-souls": Object.freeze({
    id: "ash-warden-souls",
    kind: "souls",
    amount: 15,
  }),
  "bell-elite-souls": Object.freeze({
    id: "bell-elite-souls",
    kind: "souls",
    amount: 35,
  }),
  "bell-elite-healing": Object.freeze({
    id: "bell-elite-healing",
    kind: "healing",
    amount: 1,
  }),
} satisfies Record<DropDefinitionId, DropDefinition>);

const enemyDropDefinitions = Object.freeze({
  "glass-crawler": ["glass-crawler-souls"],
  "ash-warden": ["ash-warden-souls"],
  "bell-elite": ["bell-elite-souls", "bell-elite-healing"],
  "bell-sovereign": [],
} satisfies Record<EnemyKind, readonly DropDefinitionId[]>);

const isDropDefinitionId = (value: string): value is DropDefinitionId =>
  Object.prototype.hasOwnProperty.call(dropDefinitions, value);

const dropSuffix = (definitionId: DropDefinitionId): string =>
  definitionId.endsWith("-healing") ? "healing" : "souls";

export function createDropsForDefeats(
  state: GameState,
  events: readonly GameEvent[],
): StepGameResult {
  const defeatedIds = [...new Set(
    events
      .filter(
        (event): event is Extract<GameEvent, { type: "defeated" }> =>
          event.type === "defeated",
      )
      .map(({ actorId }) => actorId),
  )].sort();
  const eligible = defeatedIds.filter((id) => {
    const enemy = state.enemies[id];
    return Boolean(
      enemy &&
        !enemy.nonlethal &&
        !state.rewardedEnemyIds.includes(id) &&
        enemyDropDefinitions[enemy.kind].length > 0,
    );
  });
  if (eligible.length === 0) return { state, events: [] };

  const drops = [...state.drops];
  const rewardedEnemyIds = [...state.rewardedEnemyIds];
  const produced: GameEvent[] = [];
  for (const enemyId of eligible) {
    const enemy = state.enemies[enemyId]!;
    rewardedEnemyIds.push(enemyId);
    for (const [index, definitionId] of enemyDropDefinitions[
      enemy.kind
    ].entries()) {
      const id = `${enemyId}:${dropSuffix(definitionId)}`;
      if (
        state.claimedDropIds.includes(id) ||
        drops.some((drop) => drop.id === id)
      ) {
        continue;
      }
      drops.push({
        id,
        definitionId,
        position: {
          x: enemy.position.x + (index === 0 ? 0 : 0.25),
          y: enemy.position.y,
        },
      });
      produced.push({ type: "drop", dropId: id });
    }
  }

  if (produced.length === 0) {
    return {
      state: rewardedEnemyIds.length === state.rewardedEnemyIds.length
        ? state
        : { ...state, rewardedEnemyIds },
      events: [],
    };
  }
  return {
    state: {
      ...state,
      drops,
      rewardedEnemyIds,
    },
    events: produced,
  };
}

const applyDropDefinition = (
  player: GameState["player"],
  definition: DropDefinition,
): GameState["player"] => {
  if (definition.kind === "souls") {
    return {
      ...player,
      souls: player.souls + definition.amount,
    };
  }
  return {
    ...player,
    healingCharges: Math.min(
      3,
      player.healingCharges + definition.amount,
    ),
  };
};

const commitDrop = (
  state: GameState,
  dropId: string,
): GameState => {
  const index = state.drops.findIndex(({ id }) => id === dropId);
  if (index < 0 || state.claimedDropIds.includes(dropId)) return state;
  const drop = state.drops[index]!;
  if (!isDropDefinitionId(drop.definitionId)) return state;
  const definition = dropDefinitions[drop.definitionId];
  const player = applyDropDefinition(state.player, definition);
  const drops = state.drops.filter((_, candidate) => candidate !== index);
  return {
    ...state,
    player,
    drops,
    claimedDropIds: [...state.claimedDropIds, drop.id],
  };
};

export function collectDrop(
  state: GameState,
  dropId: string,
): GameState {
  if (
    state.status !== "playing" ||
    state.paused ||
    state.player.health <= 0 ||
    state.player.action === "dead"
  ) {
    return state;
  }
  const drop = state.drops.find(({ id }) => id === dropId);
  if (
    !drop ||
    !isDropDefinitionId(drop.definitionId) ||
    state.claimedDropIds.includes(dropId) ||
    Math.hypot(
        drop.position.x - state.player.position.x,
        drop.position.y - state.player.position.y,
      ) > 1.25
  ) {
    return state;
  }
  return commitDrop(state, dropId);
}

export function collectNearbyDrops(state: GameState): GameState {
  let working = state;
  for (const drop of state.drops) {
    working = collectDrop(working, drop.id);
  }
  return working;
}

export function settlePendingDrops(state: GameState): GameState {
  let working = state;
  for (const drop of state.drops) {
    working = commitDrop(working, drop.id);
  }
  return working;
}

export type UpgradeId = "vitality" | "power";

export function applyPlayerHealing(
  state: GameState,
  amount: number,
): StepGameResult {
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    state.player.health <= 0 ||
    state.player.health >= state.player.maxHealth
  ) {
    return { state, events: [] };
  }
  const health = Math.min(
    state.player.maxHealth,
    state.player.health + amount,
  );
  const healed = health - state.player.health;
  return {
    state: {
      ...state,
      player: {
        ...state.player,
        health,
      },
    },
    events: [
      {
        type: "healed",
        actorId: state.player.id,
        amount: healed,
      },
    ],
  };
}

export function applyUpgrade(
  state: GameState,
  upgradeId: UpgradeId,
): GameState {
  if (state.player.upgradeId !== null) {
    throw new Error("upgrade already chosen");
  }
  if (
    state.status !== "upgrade" ||
    state.encounter.phase !== "wave-one"
  ) {
    throw new Error("upgrade is not currently offered");
  }

  const player =
    upgradeId === "vitality"
      ? {
          ...state.player,
          health: Math.min(125, state.player.health + 20),
          maxHealth: 125,
          upgradeId,
        }
      : {
          ...state.player,
          powerMultiplier: 1.2 as const,
          upgradeId,
        };
  const committed: GameState = {
    ...state,
    status: "playing",
    player,
  };
  return enterEliteAfterUpgrade(committed);
}

export function useHealingChargeWithEvents(
  state: GameState,
): StepGameResult {
  if (
    state.status !== "playing" ||
    state.paused ||
    state.player.health <= 0 ||
    state.player.health >= state.player.maxHealth ||
    state.player.healingCharges <= 0 ||
    state.player.action === "attack" ||
    state.player.action === "dodge" ||
    state.player.action === "hit" ||
    state.player.action === "dead"
  ) {
    return { state, events: [] };
  }
  const healed = applyPlayerHealing(state, 35);
  return {
    state: {
      ...healed.state,
      player: {
        ...healed.state.player,
        healingCharges: state.player.healingCharges - 1,
      },
    },
    events: healed.events,
  };
}

export function useHealingCharge(state: GameState): GameState {
  return useHealingChargeWithEvents(state).state;
}
