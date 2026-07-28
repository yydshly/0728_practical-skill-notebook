import type { PlayerIntent } from "@showcase/input-system";

export interface Vec2 {
  x: number;
  y: number;
}

export type GameStatus = "playing" | "upgrade" | "defeated" | "complete";
export type EnemyKind =
  | "glass-crawler"
  | "ash-warden"
  | "bell-elite"
  | "bell-sovereign";
export type ActorAction =
  | "idle"
  | "move"
  | "attack"
  | "guard"
  | "dodge"
  | "hit"
  | "dead";

export interface GameIntent extends PlayerIntent {
  healPressed: boolean;
  switchWeaponPressed: boolean;
  pausePressed: boolean;
}

export interface ActorState {
  id: string;
  position: Vec2;
  facingRadians: number;
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
  action: ActorAction;
  actionTime: number;
}

export interface GameState {
  version: 1;
  seed: number;
  tick: number;
  status: GameStatus;
  paused: boolean;
  player: ActorState & {
    weaponId: "oathblade" | "ember-bow";
    healingCharges: number;
    souls: number;
    powerMultiplier: 1 | 1.2;
    upgradeId: "vitality" | "power" | null;
  };
  enemies: Record<
    string,
    ActorState & {
      kind: EnemyKind;
      intent: string;
      cooldown: number;
    }
  >;
  encounter: {
    phase: "training" | "wave-one" | "elite" | "boss" | "complete";
    gateOpen: boolean;
  };
  drops: Array<{
    id: string;
    position: Vec2;
    kind: "souls" | "healing";
    amount: number;
  }>;
}

export type GameEvent =
  | {
      type: "contact";
      attackerId: string;
      targetId: string;
      attackId: string;
    }
  | { type: "damage"; targetId: string; amount: number; guarded: boolean }
  | { type: "defeated"; actorId: string }
  | { type: "drop"; dropId: string }
  | { type: "upgrade-offered" }
  | { type: "encounter-complete" };

export interface GameContent {
  arena: {
    min: Vec2;
    max: Vec2;
    playerSpawn: Vec2;
    trainingCenter: Vec2;
    waveCenter: Vec2;
    eliteCenter: Vec2;
    bossCenter: Vec2;
  };
  playerMovement: {
    walkSpeed: number;
    dodge: {
      speed: number;
      duration: number;
      staminaCost: number;
      invulnerabilityStart: number;
      invulnerabilityEnd: number;
    };
  };
  weapons: Record<
    "oathblade" | "ember-bow",
    {
      damage: number;
      stamina: number;
      startup: number;
      active: number;
      recovery: number;
    }
  >;
  enemyHealth: Record<EnemyKind, number>;
}

export interface StepGameResult {
  state: GameState;
  events: GameEvent[];
}
