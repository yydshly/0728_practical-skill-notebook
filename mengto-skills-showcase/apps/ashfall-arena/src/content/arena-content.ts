import type { GameContent } from "../simulation/types";
import { ARENA_LEVEL } from "./arena-level";
import { enemyDefinitions } from "./enemy-definitions";

export const arenaContent: GameContent = {
  arena: {
    min: { x: -18, y: -12 },
    max: { x: 18, y: 12 },
    playerSpawn: { x: 0, y: -9 },
    trainingCenter: { x: 0, y: -5 },
    waveCenter: { x: 0, y: 0 },
    eliteCenter: { x: 0, y: 6 },
    bossCenter: { x: 0, y: 10 },
    collisions: ARENA_LEVEL.collisions,
  },
  playerMovement: {
    walkSpeed: 4.2,
    actorRadius: 0.35,
    dodge: {
      speed: 9,
      startup: 0.04,
      duration: 0.24,
      staminaCost: 24,
      invulnerabilityStart: 0.08,
      invulnerabilityEnd: 0.2,
    },
  },
  weapons: {
    oathblade: {
      light1: {
        startup: 0.16,
        active: 0.12,
        recovery: 0.28,
        damage: 18,
        stamina: 12,
      },
      light2: {
        startup: 0.18,
        active: 0.14,
        recovery: 0.34,
        damage: 24,
        stamina: 16,
      },
      range: 1.8,
      targetRadius: 0.35,
      facingHalfAngleDegrees: 55,
      comboWindow: {
        recoveryStart: 0.1,
        recoveryEnd: 0.28,
      },
    },
    "ember-bow": {
      shot: {
        startup: 0.28,
        active: 0,
        recovery: 0.42,
        damage: 15,
        stamina: 10,
      },
      projectile: {
        speed: 12,
        radius: 0.16,
        targetRadius: 0.35,
        lifetime: 1.25,
      },
    },
  },
  combat: {
    fixedHz: 60,
    staminaRegenPerSecond: 18,
    playerHitRecoverySeconds: 0.3,
    guard: {
      releaseRecovery: 0.12,
      damageReceivedMultiplier: 0.35,
      staminaPerHit: 9,
      facingHalfAngleDegrees: 70,
    },
  },
  enemyHealth: Object.freeze(
    Object.fromEntries(
      Object.entries(enemyDefinitions).map(([id, definition]) => [
        id,
        definition.maxHealth,
      ]),
    ) as GameContent["enemyHealth"],
  ),
};
