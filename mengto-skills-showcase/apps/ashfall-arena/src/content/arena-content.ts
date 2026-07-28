import type { GameContent } from "../simulation/types";

export const arenaContent: GameContent = {
  arena: {
    min: { x: -18, y: -12 },
    max: { x: 18, y: 12 },
    playerSpawn: { x: 0, y: -9 },
    trainingCenter: { x: 0, y: -5 },
    waveCenter: { x: 0, y: 0 },
    eliteCenter: { x: 0, y: 6 },
    bossCenter: { x: 0, y: 10 },
  },
  playerMovement: {
    walkSpeed: 4.2,
    dodge: {
      speed: 9,
      duration: 0.24,
      staminaCost: 24,
      invulnerabilityStart: 0.08,
      invulnerabilityEnd: 0.2,
    },
  },
  weapons: {
    oathblade: {
      damage: 18,
      stamina: 12,
      startup: 0.16,
      active: 0.12,
      recovery: 0.28,
    },
    "ember-bow": {
      damage: 15,
      stamina: 10,
      startup: 0.28,
      active: 0,
      recovery: 0.42,
    },
  },
  enemyHealth: {
    "glass-crawler": 36,
    "ash-warden": 44,
    "bell-elite": 110,
    "bell-sovereign": 360,
  },
};
