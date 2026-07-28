import { arenaContent } from "../content/arena-content";
import type { GameState } from "./types";

export function createInitialState(seed: number): GameState {
  if (!Number.isSafeInteger(seed) || Object.is(seed, -0)) {
    throw new TypeError("seed must be a finite safe integer other than -0");
  }

  return {
    version: 1,
    seed,
    tick: 0,
    status: "playing",
    paused: false,
    player: {
      id: "player",
      position: { ...arenaContent.arena.playerSpawn },
      facingRadians: 0,
      health: 105,
      maxHealth: 105,
      stamina: 100,
      maxStamina: 100,
      action: "idle",
      actionTime: 0,
      collisionLayer: "player",
      weaponId: "oathblade",
      healingCharges: 3,
      souls: 0,
      powerMultiplier: 1,
      upgradeId: null,
      lockTargetId: null,
    },
    enemies: {},
    encounter: {
      phase: "training",
      gateOpen: false,
    },
    drops: [],
    combat: {
      attackSequence: 0,
      activeAttack: null,
      projectiles: [],
      receivedAttackIds: [],
      attackInputHeld: false,
      switchInputHeld: false,
      guardReleaseTicks: 0,
    },
  };
}
