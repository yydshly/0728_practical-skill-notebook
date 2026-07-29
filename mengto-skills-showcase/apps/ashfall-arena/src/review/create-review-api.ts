import { arenaContent } from "../content/arena-content";
import {
  applyAuthoritativeEnemyDamage,
  applyIncomingDamage,
} from "../simulation/combat";
import { applyPlayerHealing } from "../simulation/inventory";
import type {
  AttackInstance,
  GameState,
  StepGameResult,
} from "../simulation/types";

export interface AshfallReviewApi<Diagnostics = unknown> {
  triggerPlayerHit(): void;
  setPlayerHealth(value: number): void;
  defeatEnemy(id: string): void;
  getSerializableState(): GameState;
  getDiagnostics(): Diagnostics;
}

declare global {
  interface Window {
    __review?: AshfallReviewApi;
  }
}

export function installReviewApi<Diagnostics>(
  enabled: boolean,
  dependencies: {
    readState(): Readonly<GameState>;
    commit(result: StepGameResult): void;
    readDiagnostics(): Diagnostics;
    assertMutationAllowed?(): void;
  },
): { dispose(): void } {
  let sequence = 0;

  if (!enabled) {
    delete window.__review;
    return { dispose() {} };
  }

  const nextAttackId = (kind: string) => {
    sequence += 1;
    return `review:${kind}:${sequence}`;
  };

  const api: AshfallReviewApi<Diagnostics> = {
    triggerPlayerHit() {
      dependencies.assertMutationAllowed?.();
      const state = dependencies.readState();
      if (state.status !== "playing" || state.paused) return;
      const attackerId =
        Object.values(state.enemies)
          .filter(({ health }) => health > 0)
          .sort((left, right) => left.id.localeCompare(right.id))[0]?.id ??
        "review-enemy";
      dependencies.commit(
        applyIncomingDamage(
          state as GameState,
          {
            attackId: nextAttackId("player-hit"),
            attackerId,
            damage: 1,
            angleDegrees: 0,
            collisionLayer: "enemy",
          },
          false,
          arenaContent,
        ),
      );
    },
    setPlayerHealth(value) {
      dependencies.assertMutationAllowed?.();
      const state = dependencies.readState();
      if (
        state.status !== "playing" ||
        state.paused ||
        !Number.isFinite(value)
      ) {
        return;
      }
      const target = Math.round(
        Math.min(state.player.maxHealth, Math.max(0, value)),
      );
      if (target === state.player.health) return;
      if (target < state.player.health) {
        dependencies.commit(
          applyIncomingDamage(
            state as GameState,
            {
              attackId: nextAttackId("set-health"),
              attackerId: "review-enemy",
              damage: state.player.health - target,
              angleDegrees: 180,
              collisionLayer: "enemy",
            },
            false,
            arenaContent,
          ),
        );
        return;
      }
      dependencies.commit(
        applyPlayerHealing(state as GameState, target - state.player.health),
      );
    },
    defeatEnemy(id) {
      dependencies.assertMutationAllowed?.();
      const state = dependencies.readState();
      const enemy = state.enemies[id];
      if (!enemy) throw new Error(`Unknown enemy: ${id}`);
      if (enemy.health <= 0) return;
      const attack: AttackInstance = {
        id: nextAttackId("enemy-defeat"),
        ownerId: state.player.id,
        actionId: "oathblade-light-1",
        weaponId: "oathblade",
        startedTick: state.tick,
        elapsedTicks: 1,
        hitTargetIds: [],
        comboQueued: false,
        projectileSpawned: false,
      };
      dependencies.commit(
        applyAuthoritativeEnemyDamage(
          state as GameState,
          id,
          attack,
          enemy.health,
        ),
      );
    },
    getSerializableState() {
      return JSON.parse(JSON.stringify(dependencies.readState())) as GameState;
    },
    getDiagnostics() {
      return dependencies.readDiagnostics();
    },
  };

  window.__review = api as AshfallReviewApi;
  return {
    dispose() {
      if (window.__review === api) delete window.__review;
    },
  };
}
