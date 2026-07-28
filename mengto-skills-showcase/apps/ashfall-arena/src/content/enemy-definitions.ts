import type {
  EnemyDefinition,
  EnemyKind,
  EnemyMoveDefinition,
  EnemyMoveId,
  EnemyRewardId,
} from "../simulation/types";

const deepFreeze = <Value>(value: Value): Value => {
  const seen = new WeakSet<object>();
  const freeze = (candidate: unknown): void => {
    if (
      candidate === null ||
      (typeof candidate !== "object" && typeof candidate !== "function") ||
      seen.has(candidate)
    ) {
      return;
    }
    seen.add(candidate);
    for (const child of Object.values(candidate)) freeze(child);
    Object.freeze(candidate);
  };
  freeze(value);
  return value;
};

const rewards = deepFreeze({
  "crawler-reward": { id: "crawler-reward", souls: 10 },
  "warden-reward": { id: "warden-reward", souls: 15 },
  "elite-reward": {
    id: "elite-reward",
    souls: 35,
    healingCharges: 1,
  },
  "sovereign-reward": {
    id: "sovereign-reward",
    completion: true,
  },
} satisfies Record<EnemyRewardId, Readonly<Record<string, string | number | boolean>>>);

const freezeMove = (
  move: EnemyMoveDefinition,
): EnemyMoveDefinition => deepFreeze(move);

const moveRecord = {
  "crawler-lunge": {
    id: "crawler-lunge",
    ownerKinds: ["glass-crawler"],
    slot: "melee",
    contactKind: "lunge",
    minimumRange: 0,
    maximumRange: 1.8,
    telegraphSeconds: 0.36,
    activeSeconds: 0.12,
    recoverySeconds: 0.32,
    cooldownSeconds: 0.75,
    minimumCommitmentSeconds: 0.36,
    damage: 14,
    guardBreak: false,
    facingHalfAngleDegrees: 50,
  },
  "warden-bolt": {
    id: "warden-bolt",
    ownerKinds: ["ash-warden"],
    slot: "ranged",
    contactKind: "projectile",
    minimumRange: 4,
    maximumRange: 6.2,
    telegraphSeconds: 0.55,
    activeSeconds: 0.15,
    recoverySeconds: 0.48,
    cooldownSeconds: 1.35,
    minimumCommitmentSeconds: 0.55,
    damage: 16,
    guardBreak: false,
    facingHalfAngleDegrees: 18,
    projectile: {
      speed: 8,
      radius: 0.18,
      lifetimeSeconds: 1.5,
      originForward: 0.62,
    },
  },
  "elite-sweep": {
    id: "elite-sweep",
    ownerKinds: ["bell-elite"],
    slot: "melee",
    contactKind: "sweep",
    minimumRange: 0,
    maximumRange: 2.45,
    telegraphSeconds: 0.65,
    activeSeconds: 0.22,
    recoverySeconds: 0.7,
    cooldownSeconds: 1.55,
    minimumCommitmentSeconds: 0.65,
    damage: 26,
    guardBreak: true,
    facingHalfAngleDegrees: 72,
  },
  "sovereign-sweep": {
    id: "sovereign-sweep",
    ownerKinds: ["bell-sovereign"],
    slot: "melee",
    contactKind: "sweep",
    minimumRange: 0,
    maximumRange: 2.7,
    telegraphSeconds: 0.55,
    activeSeconds: 0.25,
    recoverySeconds: 0.62,
    cooldownSeconds: 1.35,
    minimumCommitmentSeconds: 0.55,
    damage: 24,
    guardBreak: true,
    facingHalfAngleDegrees: 78,
  },
  "sovereign-shockwave": {
    id: "sovereign-shockwave",
    ownerKinds: ["bell-sovereign"],
    slot: "ranged",
    contactKind: "shockwave",
    minimumRange: 1.2,
    maximumRange: 4.5,
    telegraphSeconds: 0.8,
    activeSeconds: 0.3,
    recoverySeconds: 0.8,
    cooldownSeconds: 2.4,
    minimumCommitmentSeconds: 0.8,
    damage: 28,
    guardBreak: false,
    facingHalfAngleDegrees: 180,
  },
  "sovereign-summon": {
    id: "sovereign-summon",
    ownerKinds: ["bell-sovereign"],
    slot: "support",
    contactKind: "summon",
    minimumRange: 0,
    maximumRange: 99,
    telegraphSeconds: 0.7,
    activeSeconds: 0.1,
    recoverySeconds: 0.8,
    cooldownSeconds: 5,
    minimumCommitmentSeconds: 0.7,
    damage: 0,
    guardBreak: false,
    facingHalfAngleDegrees: 180,
  },
} as const satisfies Record<EnemyMoveId, EnemyMoveDefinition>;

export const enemyMoves = Object.freeze(
  Object.fromEntries(
    Object.entries(moveRecord).map(([id, move]) => [
      id,
      freezeMove(move),
    ]),
  ) as Record<EnemyMoveId, EnemyMoveDefinition>,
);

const freezeDefinition = (
  definition: EnemyDefinition,
): EnemyDefinition => deepFreeze(definition);

const definitionRecord = {
  "glass-crawler": {
    id: "glass-crawler",
    role: "skirmisher",
    maxHealth: 36,
    speed: 3.8,
    actorRadius: 0.45,
    perceptionSeconds: 0.35,
    preferredRange: { minimum: 0.8, maximum: 1.65 },
    moveIds: ["crawler-lunge"],
    rewardId: "crawler-reward",
    presentation: {
      monsterId: "glass-crawler",
      provenance: "shared-procedural",
      footprintRadius: 0.71,
      visualScale: 1,
    },
  },
  "ash-warden": {
    id: "ash-warden",
    role: "ranged",
    maxHealth: 44,
    speed: 2.7,
    actorRadius: 0.46,
    perceptionSeconds: 0.35,
    preferredRange: { minimum: 4, maximum: 6 },
    moveIds: ["warden-bolt"],
    rewardId: "warden-reward",
    presentation: {
      monsterId: "ash-warden",
      provenance: "shared-procedural",
      footprintRadius: 0.46,
      visualScale: 1,
    },
  },
  "bell-elite": {
    id: "bell-elite",
    role: "elite",
    maxHealth: 110,
    speed: 2.2,
    actorRadius: 0.61,
    perceptionSeconds: 0.4,
    preferredRange: { minimum: 1.2, maximum: 2.2 },
    moveIds: ["elite-sweep"],
    rewardId: "elite-reward",
    presentation: {
      monsterId: "bell-knight",
      provenance: "shared-procedural",
      footprintRadius: 0.61,
      visualScale: 1,
    },
  },
  "bell-sovereign": {
    id: "bell-sovereign",
    role: "boss",
    maxHealth: 360,
    speed: 1.9,
    actorRadius: 0.72,
    perceptionSeconds: 0.45,
    preferredRange: { minimum: 1.4, maximum: 4.1 },
    moveIds: [
      "sovereign-sweep",
      "sovereign-shockwave",
      "sovereign-summon",
    ],
    rewardId: "sovereign-reward",
    presentation: {
      monsterId: "bell-knight",
      provenance: "shared-procedural",
      footprintRadius: 0.72,
      visualScale: 1.18,
    },
  },
} as const satisfies Record<EnemyKind, EnemyDefinition>;

export const enemyDefinitions = Object.freeze(
  Object.fromEntries(
    Object.entries(definitionRecord).map(([id, definition]) => [
      id,
      freezeDefinition(definition),
    ]),
  ) as Record<EnemyKind, EnemyDefinition>,
);

export interface EnemyContentValidation {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export function validateEnemyContent(
  definitions: Readonly<Record<string, EnemyDefinition>>,
  moves: Readonly<Record<string, EnemyMoveDefinition>>,
): EnemyContentValidation {
  const errors: string[] = [];
  const definitionIds = new Set<string>();
  const moveIds = new Set<string>();

  for (const [key, move] of Object.entries(moves).sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    if (move === undefined) {
      errors.push(`${key} is undefined`);
      continue;
    }
    if (key !== move.id) errors.push(`${key} has mismatched move id ${move.id}`);
    if (moveIds.has(move.id)) errors.push(`duplicate move id ${move.id}`);
    moveIds.add(move.id);
    if (
      move.telegraphSeconds < 0.35 ||
      move.activeSeconds <= 0 ||
      move.recoverySeconds <= 0 ||
      move.cooldownSeconds < move.recoverySeconds ||
      move.minimumRange < 0 ||
      move.maximumRange < move.minimumRange
    ) {
      errors.push(`${move.id} has invalid timing or range`);
    }
    if (
      move.contactKind === "projectile" &&
      move.projectile === undefined
    ) {
      errors.push(
        `${move.id} projectile contact requires projectile content`,
      );
    }
    if (
      move.projectile !== undefined &&
      (
        move.contactKind !== "projectile" ||
        move.slot !== "ranged"
      )
    ) {
      errors.push(
        `${move.id} projectile content requires a ranged projectile contact`,
      );
    }
    if (move.projectile !== undefined) {
      for (const field of [
        "speed",
        "radius",
        "lifetimeSeconds",
        "originForward",
      ] as const) {
        const value = move.projectile[field];
        if (!Number.isFinite(value) || value <= 0) {
          errors.push(`${move.id} has invalid projectile ${field}`);
        }
      }
    }
  }

  for (const [key, definition] of Object.entries(definitions).sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    if (definition === undefined) {
      errors.push(`${key} is undefined`);
      continue;
    }
    if (key !== definition.id) {
      errors.push(`${key} has mismatched definition id ${definition.id}`);
    }
    if (definitionIds.has(definition.id)) {
      errors.push(`duplicate enemy id ${definition.id}`);
    }
    definitionIds.add(definition.id);
    const referencedMoveIds = new Set<EnemyMoveId>();
    for (const moveId of definition.moveIds) {
      if (referencedMoveIds.has(moveId)) {
        errors.push(
          `${definition.id} references duplicate move ${String(moveId)}`,
        );
        continue;
      }
      referencedMoveIds.add(moveId);
      const move = moves[moveId];
      if (!move) {
        errors.push(`${definition.id} references missing move ${moveId}`);
      } else if (!move.ownerKinds.includes(definition.id)) {
        errors.push(`${definition.id} cannot own move ${moveId}`);
      }
    }
    if (!(definition.rewardId in rewards)) {
      errors.push(
        `${definition.id} references missing reward ${definition.rewardId}`,
      );
    }
    if (
      definition.maxHealth <= 0 ||
      definition.speed <= 0 ||
      definition.actorRadius <= 0 ||
      definition.perceptionSeconds < 0.35 ||
      definition.preferredRange.minimum < 0 ||
      definition.preferredRange.maximum <
        definition.preferredRange.minimum
    ) {
      errors.push(`${definition.id} has invalid role stats`);
    }
  }

  return { valid: errors.length === 0, errors };
}
