import type { PlayerIntent } from "@showcase/input-system";

export interface Vec2 {
  x: number;
  y: number;
}

export type ArenaCollisionKind =
  | "perimeter"
  | "interior"
  | "portal-wall"
  | "gate";

export interface ArenaCollisionData {
  id: string;
  x: number;
  y: 0;
  z: number;
  halfWidth: number;
  halfDepth: number;
  height: number;
  kind: ArenaCollisionKind;
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
export type CollisionLayer = "player" | "enemy";
export type WeaponId = "oathblade" | "ember-bow";
export type AttackActionId =
  | "oathblade-light-1"
  | "oathblade-light-2"
  | "ember-bow-shot";
export type AttackPhase = "startup" | "active" | "recovery" | "complete";
export type EnemyIntent =
  | "observe"
  | "approach"
  | "orbit"
  | "telegraph"
  | "attack"
  | "recover"
  | "retreat"
  | "stagger"
  | "dead";
export type EnemyMovePhase =
  | "none"
  | "telegraph"
  | "active"
  | "recover";
export type EnemyMoveId =
  | "crawler-lunge"
  | "warden-bolt"
  | "elite-sweep"
  | "sovereign-sweep"
  | "sovereign-shockwave"
  | "sovereign-summon";
export type EnemyRole = "skirmisher" | "ranged" | "elite" | "boss";
export type EnemyRewardId =
  | "crawler-reward"
  | "warden-reward"
  | "elite-reward"
  | "sovereign-reward";
export type EncounterPhase =
  | "training"
  | "wave-one"
  | "elite"
  | "boss"
  | "complete";

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
  collisionLayer: CollisionLayer;
}

export interface EnemyState extends ActorState {
  kind: EnemyKind;
  definitionId: EnemyKind;
  intent: EnemyIntent;
  intentTicks: number;
  visibleTicks: number;
  cooldownTicks: number;
  targetId: string | null;
  currentMoveId: EnemyMoveId | null;
  movePhase: EnemyMovePhase;
  moveElapsedTicks: number;
  attackSequence: number;
  hitTargetIds: string[];
  lockedFacingRadians: number;
  pathFailureTicks: number;
  staggerTicks: number;
  aiEnabled: boolean;
  nonlethal: boolean;
  bossPhase: 1 | 2 | 3;
  spawnedBy: string | null;
}

export interface AttackInstance {
  id: string;
  ownerId: string;
  actionId: AttackActionId;
  weaponId: WeaponId;
  startedTick: number;
  elapsedTicks: number;
  hitTargetIds: string[];
  comboQueued: boolean;
  projectileSpawned: boolean;
}

export interface ProjectileState {
  id: string;
  attackId: string;
  ownerId: string;
  position: Vec2;
  direction: Vec2;
  speed: number;
  radius: number;
  ageTicks: number;
  lifetimeTicks: number;
  targetLayer: CollisionLayer;
  hitTargetIds: string[];
}

export interface EnemyProjectileState {
  id: string;
  attackId: string;
  ownerId: string;
  moveId: "warden-bolt";
  position: Vec2;
  direction: Vec2;
  speed: number;
  radius: number;
  ageTicks: number;
  lifetimeTicks: number;
  targetLayer: "player";
  team: "enemy";
  hitTargetIds: string[];
}

export interface CombatState {
  attackSequence: number;
  activeAttack: AttackInstance | null;
  projectiles: ProjectileState[];
  enemyProjectiles: EnemyProjectileState[];
  spawnedEnemyAttackIds: string[];
  receivedAttackIds: string[];
  attackInputHeld: boolean;
  switchInputHeld: boolean;
  guardReleaseTicks: number;
  playerHitRecoveryTicks: number;
}

export interface IncomingHit {
  attackId: string;
  attackerId: string;
  damage: number;
  angleDegrees: number;
  collisionLayer: CollisionLayer;
  guardBreak?: boolean;
}

export interface GameState {
  version: 1;
  seed: number;
  tick: number;
  status: GameStatus;
  paused: boolean;
  player: ActorState & {
    weaponId: WeaponId;
    healingCharges: number;
    souls: number;
    powerMultiplier: 1 | 1.2;
    upgradeId: "vitality" | "power" | null;
    lockTargetId: string | null;
  };
  enemies: Record<string, EnemyState>;
  encounter: {
    phase: EncounterPhase;
    gateOpen: boolean;
    trainingSpawned: boolean;
    trainingAttackSeen: boolean;
    trainingGuardSeen: boolean;
    spawnedIds: string[];
    completedIds: string[];
    bossThresholds: { 65: boolean; 30: boolean };
    pendingSummons: Array<65 | 30>;
    completedSummons: Array<65 | 30>;
    consumedSummonAttackIds: string[];
    trainingAiEnabled: boolean;
    phaseEntryTick: number;
  };
  enemyAi: {
    meleeSlotOwner: string | null;
    rangedWindow: number;
    rangedSlotOwner: string | null;
    rangedWindowUsed: boolean;
    supportSlotOwner: string | null;
  };
  drops: Array<{
    id: string;
    position: Vec2;
    kind: "souls" | "healing";
    amount: number;
  }>;
  combat: CombatState;
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
  | { type: "encounter-complete" }
  | { type: "encounter-phase"; phase: EncounterPhase }
  | {
      type: "enemy-telegraph";
      enemyId: string;
      moveId: EnemyMoveId;
      attackId: string;
    }
  | {
      type: "enemy-move-active";
      enemyId: string;
      moveId: EnemyMoveId;
      attackId: string;
    }
  | {
      type: "boss-phase";
      phase: 2 | 3;
      threshold: 65 | 30;
    }
  | {
      type: "enemy-summoned";
      enemyId: string;
      threshold: 65 | 30;
    };

export interface GameContent {
  arena: {
    min: Vec2;
    max: Vec2;
    playerSpawn: Vec2;
    trainingCenter: Vec2;
    waveCenter: Vec2;
    eliteCenter: Vec2;
    bossCenter: Vec2;
    collisions: readonly ArenaCollisionData[];
  };
  playerMovement: {
    walkSpeed: number;
    actorRadius: number;
    dodge: {
      speed: number;
      startup: number;
      duration: number;
      staminaCost: number;
      invulnerabilityStart: number;
      invulnerabilityEnd: number;
    };
  };
  weapons: {
    oathblade: {
      light1: CombatActionContent;
      light2: CombatActionContent;
      range: number;
      targetRadius: number;
      facingHalfAngleDegrees: number;
      comboWindow: {
        recoveryStart: number;
        recoveryEnd: number;
      };
    };
    "ember-bow": {
      shot: CombatActionContent;
      projectile: {
        speed: number;
        radius: number;
        targetRadius: number;
        lifetime: number;
      };
    };
  };
  combat: {
    fixedHz: 60;
    staminaRegenPerSecond: number;
    playerHitRecoverySeconds: number;
    guard: {
      releaseRecovery: number;
      damageReceivedMultiplier: number;
      staminaPerHit: number;
      facingHalfAngleDegrees: number;
    };
  };
  enemyHealth: Record<EnemyKind, number>;
}

export interface CombatActionContent {
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  stamina: number;
}

export interface EnemyMoveDefinition {
  readonly id: EnemyMoveId;
  readonly ownerKinds: readonly EnemyKind[];
  readonly slot: "melee" | "ranged" | "support";
  readonly contactKind: "lunge" | "projectile" | "sweep" | "shockwave" | "summon";
  readonly minimumRange: number;
  readonly maximumRange: number;
  readonly telegraphSeconds: number;
  readonly activeSeconds: number;
  readonly recoverySeconds: number;
  readonly cooldownSeconds: number;
  readonly minimumCommitmentSeconds: number;
  readonly damage: number;
  readonly guardBreak: boolean;
  readonly facingHalfAngleDegrees: number;
  readonly projectile?: Readonly<{
    speed: number;
    radius: number;
    lifetimeSeconds: number;
    originForward: number;
  }>;
}

export interface EnemyDefinition {
  readonly id: EnemyKind;
  readonly role: EnemyRole;
  readonly maxHealth: number;
  readonly speed: number;
  readonly actorRadius: number;
  readonly perceptionSeconds: number;
  readonly preferredRange: Readonly<{ minimum: number; maximum: number }>;
  readonly moveIds: readonly EnemyMoveId[];
  readonly rewardId: EnemyRewardId | string;
  readonly presentation: Readonly<{
    monsterId: "glass-crawler" | "ash-warden" | "bell-knight";
    provenance: "shared-procedural";
    footprintRadius: number;
    visualScale: number;
  }>;
}

export interface StepGameResult {
  state: GameState;
  events: GameEvent[];
}
