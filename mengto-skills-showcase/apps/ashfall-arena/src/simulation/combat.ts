import { arenaContent } from "../content/arena-content";
import { enemyMoves } from "../content/enemy-definitions";
import type {
  ActorState,
  AttackActionId,
  AttackInstance,
  AttackPhase,
  CombatActionContent,
  EnemyProjectileState,
  GameContent,
  GameEvent,
  GameIntent,
  GameState,
  IncomingHit,
  ProjectileState,
  StepGameResult,
  Vec2,
} from "./types";
import { hasEnemyLineOfSight } from "./enemy-ai";

const TIME_EPSILON = 1e-9;
const PROJECTILE_TOI_TIE_EPSILON = 1e-9;

export interface ProjectileContactCandidate {
  readonly id: string;
  readonly kind: "enemy" | "world";
  readonly time: number;
  readonly targetId?: string;
}

export function selectEarliestProjectileContact(
  candidates: readonly ProjectileContactCandidate[],
): ProjectileContactCandidate | null {
  const finiteCandidates = candidates.filter(({ time }) =>
    Number.isFinite(time)
  );
  if (finiteCandidates.length === 0) return null;

  const minimumTime = Math.min(
    ...finiteCandidates.map(({ time }) => time),
  );
  const nearCandidates = finiteCandidates.filter(
    ({ time }) =>
      time <= minimumTime + PROJECTILE_TOI_TIE_EPSILON,
  );
  const preferredKind = nearCandidates.some(
    ({ kind }) => kind === "world",
  )
    ? "world"
    : "enemy";

  let selected: ProjectileContactCandidate | null = null;
  for (const candidate of nearCandidates) {
    if (candidate.kind !== preferredKind) continue;
    if (
      selected === null ||
      candidate.time < selected.time ||
      (
        candidate.time === selected.time &&
        candidate.id.localeCompare(selected.id) < 0
      )
    ) {
      selected = candidate;
    }
  }
  return selected;
}

const ticksFor = (seconds: number, content: GameContent): number =>
  Math.ceil(seconds * content.combat.fixedHz - TIME_EPSILON);

const actionContent = (
  actionId: AttackActionId,
  content: GameContent,
): CombatActionContent => {
  switch (actionId) {
    case "oathblade-light-1":
      return content.weapons.oathblade.light1;
    case "oathblade-light-2":
      return content.weapons.oathblade.light2;
    case "ember-bow-shot":
      return content.weapons["ember-bow"].shot;
  }
};

export function getAttackPhase(
  actionId: AttackActionId,
  elapsedTicks: number,
  content: GameContent,
): AttackPhase {
  const action = actionContent(actionId, content);
  const startupEnd = ticksFor(action.startup, content);
  const activeEnd = ticksFor(action.startup + action.active, content);
  const completeAt = ticksFor(
    action.startup + action.active + action.recovery,
    content,
  );

  if (elapsedTicks >= completeAt) return "complete";
  if (elapsedTicks < startupEnd) return "startup";
  if (action.active > 0 && elapsedTicks <= activeEnd) return "active";
  return "recovery";
}

export function isContactAccepted(
  actor: Pick<ActorState, "action" | "actionTime">,
  content: GameContent = arenaContent,
): boolean {
  if (actor.action === "dead") return false;
  if (actor.action !== "dodge") return true;

  const { invulnerabilityStart, invulnerabilityEnd } =
    content.playerMovement.dodge;
  return !(
    actor.actionTime + TIME_EPSILON >= invulnerabilityStart &&
    actor.actionTime <= invulnerabilityEnd + TIME_EPSILON
  );
}

export interface IncomingDamageResult {
  accepted: boolean;
  health: number;
  stamina: number;
  guarded: boolean;
  guardBroken: boolean;
  defeated: boolean;
}

export function resolveIncomingDamage(
  actor: Readonly<ActorState>,
  hit: Readonly<IncomingHit>,
  guardHeld: boolean,
  content: GameContent = arenaContent,
): IncomingDamageResult {
  const rejected =
    actor.health <= 0 ||
    hit.collisionLayer !== "enemy" ||
    !isContactAccepted(actor, content);
  if (rejected) {
    return {
      accepted: false,
      health: actor.health,
      stamina: actor.stamina,
      guarded: false,
      guardBroken: false,
      defeated: actor.health <= 0,
    };
  }

  const guard = content.combat.guard;
  const frontal =
    Math.abs(hit.angleDegrees) <= guard.facingHalfAngleDegrees + TIME_EPSILON;
  const guardAttempted = guardHeld && frontal;
  const guarded =
    guardAttempted &&
    !hit.guardBreak &&
    actor.stamina >= guard.staminaPerHit;
  const guardBroken = guardAttempted && !guarded;
  const damage = guarded
    ? Math.round(hit.damage * guard.damageReceivedMultiplier)
    : hit.damage;
  const health = Math.max(0, actor.health - damage);

  return {
    accepted: true,
    health,
    stamina: guarded
      ? actor.stamina - guard.staminaPerHit
      : guardBroken
        ? 0
        : actor.stamina,
    guarded,
    guardBroken,
    defeated: health === 0,
  };
}

export function applyIncomingDamage(
  state: GameState,
  hit: IncomingHit,
  guardHeld: boolean,
  content: GameContent = arenaContent,
): StepGameResult {
  if (
    state.status !== "playing" ||
    state.paused ||
    state.combat.receivedAttackIds.includes(hit.attackId)
  ) {
    return { state, events: [] };
  }

  const resolution = resolveIncomingDamage(
    state.player,
    hit,
    guardHeld && state.player.action === "guard",
    content,
  );
  if (!resolution.accepted) return { state, events: [] };

  const damage = resolution.guarded
    ? Math.round(hit.damage * content.combat.guard.damageReceivedMultiplier)
    : hit.damage;
  const action = resolution.defeated
    ? "dead"
    : resolution.guarded
      ? "guard"
      : "hit";
  const player = {
    ...state.player,
    health: resolution.health,
    stamina: resolution.stamina,
    action,
    actionTime: 0,
  } satisfies GameState["player"];
  const events: GameEvent[] = [
    {
      type: "contact",
      attackerId: hit.attackerId,
      targetId: state.player.id,
      attackId: hit.attackId,
    },
    {
      type: "damage",
      targetId: state.player.id,
      amount: damage,
      guarded: resolution.guarded,
      ...(resolution.guardBroken ? { guardBroken: true as const } : {}),
    },
  ];
  if (resolution.defeated) {
    events.push({ type: "defeated", actorId: state.player.id });
  }

  return {
    state: {
      ...state,
      status: resolution.defeated ? "defeated" : state.status,
      player,
      combat: {
        ...state.combat,
        activeAttack: null,
        receivedAttackIds: [
          ...state.combat.receivedAttackIds,
          hit.attackId,
        ],
        guardReleaseTicks: 0,
        playerHitRecoveryTicks: 0,
      },
    },
    events,
  };
}

export function sweptCircleContact(
  from: Readonly<Vec2>,
  to: Readonly<Vec2>,
  center: Readonly<Vec2>,
  combinedRadius: number,
): boolean {
  return (
    segmentCircleTimeOfImpact(from, to, center, combinedRadius) !== null
  );
}

const segmentCircleTimeOfImpact = (
  from: Readonly<Vec2>,
  to: Readonly<Vec2>,
  center: Readonly<Vec2>,
  combinedRadius: number,
): number | null => {
  const segmentX = to.x - from.x;
  const segmentY = to.y - from.y;
  const offsetX = from.x - center.x;
  const offsetY = from.y - center.y;
  const radiusSquared = combinedRadius * combinedRadius;
  const c = offsetX * offsetX + offsetY * offsetY - radiusSquared;
  if (c <= 0) return 0;

  const a = segmentX * segmentX + segmentY * segmentY;
  if (a <= TIME_EPSILON) return null;
  const b = 2 * (offsetX * segmentX + offsetY * segmentY);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const first = (-b - Math.sqrt(discriminant)) / (2 * a);
  return first >= 0 && first <= 1 ? first : null;
};

const segmentAabbTimeOfImpact = (
  from: Readonly<Vec2>,
  to: Readonly<Vec2>,
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  },
): number | null => {
  let enter = 0;
  let exit = 1;

  for (const [start, end, minimum, maximum] of [
    [from.x, to.x, bounds.minX, bounds.maxX],
    [from.y, to.y, bounds.minY, bounds.maxY],
  ] as const) {
    const delta = end - start;
    if (Math.abs(delta) <= TIME_EPSILON) {
      if (start < minimum || start > maximum) return null;
      continue;
    }
    const first = (minimum - start) / delta;
    const second = (maximum - start) / delta;
    const near = Math.min(first, second);
    const far = Math.max(first, second);
    enter = Math.max(enter, near);
    exit = Math.min(exit, far);
    if (enter > exit) return null;
  }

  return enter >= 0 && enter <= 1 ? enter : null;
};

const arenaBoundaryTimeOfImpact = (
  from: Readonly<Vec2>,
  to: Readonly<Vec2>,
  projectileRadius: number,
  content: GameContent,
): number | null => {
  const minX = content.arena.min.x + projectileRadius;
  const maxX = content.arena.max.x - projectileRadius;
  const minY = content.arena.min.y + projectileRadius;
  const maxY = content.arena.max.y - projectileRadius;
  const startsInside =
    from.x >= minX &&
    from.x <= maxX &&
    from.y >= minY &&
    from.y <= maxY;
  if (!startsInside) return 0;
  if (
    to.x >= minX &&
    to.x <= maxX &&
    to.y >= minY &&
    to.y <= maxY
  ) {
    return null;
  }

  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const candidates: number[] = [];
  if (deltaX > 0 && to.x > maxX) {
    candidates.push((maxX - from.x) / deltaX);
  } else if (deltaX < 0 && to.x < minX) {
    candidates.push((minX - from.x) / deltaX);
  }
  if (deltaY > 0 && to.y > maxY) {
    candidates.push((maxY - from.y) / deltaY);
  } else if (deltaY < 0 && to.y < minY) {
    candidates.push((minY - from.y) / deltaY);
  }
  return candidates.length > 0 ? Math.min(...candidates) : null;
};

const directionFromFacing = (facingRadians: number): Vec2 => ({
  x: Math.sin(facingRadians),
  y: Math.cos(facingRadians),
});

const isInFacingCone = (
  origin: Readonly<Vec2>,
  facingRadians: number,
  target: Readonly<Vec2>,
  halfAngleDegrees: number,
): boolean => {
  const offsetX = target.x - origin.x;
  const offsetY = target.y - origin.y;
  const distance = Math.hypot(offsetX, offsetY);
  if (distance <= TIME_EPSILON) return true;
  const forward = directionFromFacing(facingRadians);
  const cosine = (forward.x * offsetX + forward.y * offsetY) / distance;
  return cosine + TIME_EPSILON >= Math.cos(halfAngleDegrees * Math.PI / 180);
};

export const applyAuthoritativeEnemyDamage = (
  state: GameState,
  targetId: string,
  attack: AttackInstance,
  damage: number,
): StepGameResult => {
  const target = state.enemies[targetId];
  if (
    !target ||
    target.health <= 0 ||
    state.status !== "playing" ||
    state.paused
  ) {
    return { state, events: [] };
  }
  const health = Math.max(0, target.health - damage);
  const targetState = {
    ...target,
    health,
    action: health === 0 ? "dead" as const : "hit" as const,
    actionTime: 0,
    intent: health === 0 ? "dead" as const : "stagger" as const,
    intentTicks: 0,
    targetId: health === 0 ? null : target.targetId,
    currentMoveId: null,
    movePhase: "none" as const,
    moveElapsedTicks: 0,
    hitTargetIds: [],
    staggerTicks: health === 0 ? 0 : 18,
  };
  const events: GameEvent[] = [
    {
      type: "contact",
      attackerId: attack.ownerId,
      targetId,
      attackId: attack.id,
    },
    {
      type: "damage",
      targetId,
      amount: damage,
      guarded: false,
    },
  ];
  if (health === 0) events.push({ type: "defeated", actorId: targetId });

  return {
    state: {
      ...state,
      enemies: {
        ...state.enemies,
        [targetId]: targetState,
      },
    },
    events,
  };
};

const validMeleeTargets = (
  state: GameState,
  attack: AttackInstance,
  content: GameContent,
): string[] => {
  const weapon = content.weapons.oathblade;
  return Object.values(state.enemies)
    .filter((target) => {
      if (
        target.health <= 0 ||
        target.collisionLayer !== "enemy" ||
        attack.hitTargetIds.includes(target.id) ||
        !isContactAccepted(target, content)
      ) {
        return false;
      }
      const distance = Math.hypot(
        target.position.x - state.player.position.x,
        target.position.y - state.player.position.y,
      );
      return (
        distance <= weapon.range + weapon.targetRadius + TIME_EPSILON &&
        isInFacingCone(
          state.player.position,
          state.player.facingRadians,
          target.position,
          weapon.facingHalfAngleDegrees,
        )
      );
    })
    .map(({ id }) => id)
    .sort();
};

const startAttack = (
  state: GameState,
  actionId: AttackActionId,
  content: GameContent,
): StepGameResult => {
  const action = actionContent(actionId, content);
  if (state.player.stamina + TIME_EPSILON < action.stamina) {
    return { state, events: [] };
  }

  const attack: AttackInstance = {
    id: `${state.player.id}:${state.tick}:${state.combat.attackSequence}`,
    ownerId: state.player.id,
    actionId,
    weaponId: state.player.weaponId,
    startedTick: state.tick,
    elapsedTicks: 1,
    hitTargetIds: [],
    comboQueued: false,
    projectileSpawned: false,
  };
  return {
    state: {
      ...state,
      player: {
        ...state.player,
        stamina: state.player.stamina - action.stamina,
        action: "attack",
        actionTime: 1 / content.combat.fixedHz,
      },
      combat: {
        ...state.combat,
        attackSequence: state.combat.attackSequence + 1,
        activeAttack: attack,
        guardReleaseTicks: 0,
      },
    },
    events: [
      {
        type: "action-started",
        actorId: state.player.id,
        actionId,
        attackId: attack.id,
        tick: state.tick,
      },
    ],
  };
};

const spawnProjectile = (
  state: GameState,
  attack: AttackInstance,
  content: GameContent,
): ProjectileState => {
  const authored = content.weapons["ember-bow"].projectile;
  const direction = directionFromFacing(state.player.facingRadians);
  const muzzleOffset =
    content.playerMovement.actorRadius + authored.radius;
  return {
    id: `${attack.id}:projectile`,
    attackId: attack.id,
    ownerId: attack.ownerId,
    position: {
      x: state.player.position.x + direction.x * muzzleOffset,
      y: state.player.position.y + direction.y * muzzleOffset,
    },
    direction,
    speed: authored.speed,
    radius: authored.radius,
    ageTicks: 0,
    lifetimeTicks: ticksFor(authored.lifetime, content),
    targetLayer: "enemy",
    hitTargetIds: [],
  };
};

const comboWindowAccepts = (
  attack: AttackInstance,
  content: GameContent,
): boolean => {
  if (attack.actionId !== "oathblade-light-1") return false;
  const lightOne = content.weapons.oathblade.light1;
  const recoveryElapsed =
    attack.elapsedTicks / content.combat.fixedHz -
    lightOne.startup -
    lightOne.active;
  const { recoveryStart, recoveryEnd } =
    content.weapons.oathblade.comboWindow;
  return (
    recoveryElapsed + TIME_EPSILON >= recoveryStart &&
    recoveryElapsed <= recoveryEnd + TIME_EPSILON
  );
};

const stepActiveAttack = (
  state: GameState,
  attackEdge: boolean,
  content: GameContent,
): StepGameResult => {
  const current = state.combat.activeAttack;
  if (!current) return { state, events: [] };

  const nextAttack: AttackInstance = {
    ...current,
    elapsedTicks: current.elapsedTicks + 1,
  };
  if (
    attackEdge &&
    comboWindowAccepts(nextAttack, content) &&
    state.player.stamina + TIME_EPSILON >=
      content.weapons.oathblade.light2.stamina
  ) {
    nextAttack.comboQueued = true;
  }

  let working: GameState = {
    ...state,
    player: {
      ...state.player,
      action: "attack",
      actionTime: nextAttack.elapsedTicks / content.combat.fixedHz,
    },
    combat: {
      ...state.combat,
      activeAttack: nextAttack,
    },
  };
  const events: GameEvent[] = [];
  const phase = getAttackPhase(
    nextAttack.actionId,
    nextAttack.elapsedTicks,
    content,
  );

  if (
    phase === "active" &&
    nextAttack.weaponId === "oathblade"
  ) {
    const damage = Math.round(
      actionContent(nextAttack.actionId, content).damage *
        working.player.powerMultiplier,
    );
    const targetIds = validMeleeTargets(working, nextAttack, content);
    if (targetIds.length > 0) {
      nextAttack.hitTargetIds = [
        ...current.hitTargetIds,
        ...targetIds,
      ];
    }
    for (const targetId of targetIds) {
      const result = applyAuthoritativeEnemyDamage(
        working,
        targetId,
        nextAttack,
        damage,
      );
      working = result.state;
      events.push(...result.events);
    }
    working = {
      ...working,
      combat: {
        ...working.combat,
        activeAttack: { ...nextAttack },
      },
    };
  }

  if (
    nextAttack.actionId === "ember-bow-shot" &&
    !nextAttack.projectileSpawned &&
    nextAttack.elapsedTicks >=
      ticksFor(content.weapons["ember-bow"].shot.startup, content)
  ) {
    nextAttack.projectileSpawned = true;
    working = {
      ...working,
      combat: {
        ...working.combat,
        activeAttack: { ...nextAttack },
        projectiles: [
          ...working.combat.projectiles,
          spawnProjectile(working, nextAttack, content),
        ],
      },
    };
  }

  if (phase !== "complete") return { state: working, events };

  if (nextAttack.weaponId === "oathblade") {
    events.push({
      type: "attack-resolved",
      actorId: nextAttack.ownerId,
      actionId: nextAttack.actionId,
      attackId: nextAttack.id,
      result: nextAttack.hitTargetIds.length > 0 ? "hit" : "miss",
    });
  }

  if (
    nextAttack.comboQueued &&
    nextAttack.actionId === "oathblade-light-1" &&
    working.player.stamina + TIME_EPSILON >=
      content.weapons.oathblade.light2.stamina
  ) {
    const withoutAttack = {
      ...working,
      player: {
        ...working.player,
        action: "idle" as const,
        actionTime: 0,
      },
      combat: {
        ...working.combat,
        activeAttack: null,
      },
    };
    const chained = startAttack(
      withoutAttack,
      "oathblade-light-2",
      content,
    );
    return {
      state: chained.state,
      events: [...events, ...chained.events],
    };
  }

  return {
    state: {
      ...working,
      player: {
        ...working.player,
        action: "idle",
        actionTime: 0,
      },
      combat: {
        ...working.combat,
        activeAttack: null,
      },
    },
    events,
  };
};

const stepProjectiles = (
  state: GameState,
  content: GameContent,
): StepGameResult => {
  if (state.combat.projectiles.length === 0) {
    return { state, events: [] };
  }

  let working = state;
  const survivors: ProjectileState[] = [];
  const events: GameEvent[] = [];
  const targetRadius = content.weapons["ember-bow"].projectile.targetRadius;

  for (const projectile of state.combat.projectiles) {
    const from = projectile.position;
    const to = {
      x:
        from.x +
        projectile.direction.x *
          projectile.speed /
          content.combat.fixedHz,
      y:
        from.y +
        projectile.direction.y *
          projectile.speed /
          content.combat.fixedHz,
    };
    const nextProjectile = {
      ...projectile,
      position: to,
      ageTicks: projectile.ageTicks + 1,
    };
    const candidates: ProjectileContactCandidate[] = [];

    for (const target of Object.values(working.enemies)) {
      if (
        target.health > 0 &&
        target.collisionLayer === projectile.targetLayer &&
        !projectile.hitTargetIds.includes(target.id) &&
        isContactAccepted(target, content)
      ) {
        const time = segmentCircleTimeOfImpact(
          from,
          to,
          target.position,
          projectile.radius + targetRadius,
        );
        if (time !== null) {
          candidates.push({
            id: target.id,
            kind: "enemy",
            time,
            targetId: target.id,
          });
        }
      }
    }

    for (const collision of content.arena.collisions) {
      if (collision.kind === "gate" && state.encounter.gateOpen) continue;
      const time = segmentAabbTimeOfImpact(from, to, {
        minX: collision.x - collision.halfWidth - projectile.radius,
        maxX: collision.x + collision.halfWidth + projectile.radius,
        minY: collision.z - collision.halfDepth - projectile.radius,
        maxY: collision.z + collision.halfDepth + projectile.radius,
      });
      if (time !== null) {
        candidates.push({
          id: collision.id,
          kind: "world",
          time,
        });
      }
    }

    const boundaryTime = arenaBoundaryTimeOfImpact(
      from,
      to,
      projectile.radius,
      content,
    );
    if (boundaryTime !== null) {
      candidates.push({
        id: "arena-boundary",
        kind: "world",
        time: boundaryTime,
      });
    }

    const firstContact = selectEarliestProjectileContact(candidates);

    if (firstContact?.kind === "enemy" && firstContact.targetId) {
      const targetId = firstContact.targetId;
      const attack: AttackInstance = {
        id: projectile.attackId,
        ownerId: projectile.ownerId,
        actionId: "ember-bow-shot",
        weaponId: "ember-bow",
        startedTick: 0,
        elapsedTicks: 0,
        hitTargetIds: [targetId],
        comboQueued: false,
        projectileSpawned: true,
      };
      const damage = Math.round(
        content.weapons["ember-bow"].shot.damage *
          working.player.powerMultiplier,
      );
      const result = applyAuthoritativeEnemyDamage(
        working,
        targetId,
        attack,
        damage,
      );
      working = result.state;
      events.push(...result.events);
      events.push({
        type: "attack-resolved",
        actorId: projectile.ownerId,
        actionId: "ember-bow-shot",
        attackId: projectile.attackId,
        result: "hit",
      });
      continue;
    }

    if (firstContact?.kind === "world") {
      events.push({
        type: "attack-resolved",
        actorId: projectile.ownerId,
        actionId: "ember-bow-shot",
        attackId: projectile.attackId,
        result: "miss",
      });
      continue;
    }

    if (nextProjectile.ageTicks < nextProjectile.lifetimeTicks) {
      survivors.push(nextProjectile);
    } else {
      events.push({
        type: "attack-resolved",
        actorId: projectile.ownerId,
        actionId: "ember-bow-shot",
        attackId: projectile.attackId,
        result: "miss",
      });
    }
  }

  return {
    state: {
      ...working,
      combat: {
        ...working.combat,
        projectiles: survivors,
      },
    },
    events,
  };
};

const stepGuard = (
  state: GameState,
  intent: GameIntent,
  content: GameContent,
): GameState => {
  if (intent.guardHeld) {
    if (
      state.player.action !== "idle" &&
      state.player.action !== "move" &&
      state.player.action !== "guard"
    ) {
      return state;
    }
    return {
      ...state,
      player: {
        ...state.player,
        action: "guard",
        actionTime:
          state.player.action === "guard"
            ? state.player.actionTime + 1 / content.combat.fixedHz
            : 0,
      },
      combat: {
        ...state.combat,
        guardReleaseTicks: 0,
      },
    };
  }

  if (state.player.action !== "guard") return state;
  const recoveryTicks = state.combat.guardReleaseTicks + 1;
  const finished =
    recoveryTicks >=
    ticksFor(content.combat.guard.releaseRecovery, content);
  return {
    ...state,
    player: {
      ...state.player,
      action: finished ? "idle" : "guard",
      actionTime: finished
        ? 0
        : recoveryTicks / content.combat.fixedHz,
    },
    combat: {
      ...state.combat,
      guardReleaseTicks: finished ? 0 : recoveryTicks,
    },
  };
};

const signedAngleDegrees = (
  facingRadians: number,
  origin: Readonly<Vec2>,
  target: Readonly<Vec2>,
): number => {
  const targetRadians = Math.atan2(
    target.x - origin.x,
    target.y - origin.y,
  );
  let delta = targetRadians - facingRadians;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta * 180 / Math.PI;
};

const enemyAttackId = (
  enemy: GameState["enemies"][string],
): string =>
  `${enemy.id}:${enemy.currentMoveId}:${enemy.attackSequence}`;

const spawnEnemyProjectile = (
  enemy: GameState["enemies"][string],
  attackId: string,
  content: GameContent,
): EnemyProjectileState => {
  const move = enemyMoves["warden-bolt"];
  const projectile = move.projectile;
  if (!projectile) {
    throw new Error("warden-bolt requires projectile content");
  }
  const direction = directionFromFacing(enemy.lockedFacingRadians);
  return {
    id: `${attackId}:projectile`,
    attackId,
    ownerId: enemy.id,
    moveId: "warden-bolt",
    position: {
      x: enemy.position.x + direction.x * projectile.originForward,
      y: enemy.position.y + direction.y * projectile.originForward,
    },
    direction,
    speed: projectile.speed,
    radius: projectile.radius,
    ageTicks: 0,
    lifetimeTicks: ticksFor(projectile.lifetimeSeconds, content),
    targetLayer: "player",
    team: "enemy",
    hitTargetIds: [],
  };
};

export const stepEnemyProjectiles = (
  state: GameState,
  intent: GameIntent,
  content: GameContent,
): StepGameResult => {
  if (state.combat.enemyProjectiles.length === 0) {
    return { state, events: [] };
  }

  let working = state;
  const survivors: EnemyProjectileState[] = [];
  const events: GameEvent[] = [];
  for (const projectile of state.combat.enemyProjectiles) {
    const from = projectile.position;
    const to = {
      x:
        from.x +
        projectile.direction.x *
          projectile.speed /
          content.combat.fixedHz,
      y:
        from.y +
        projectile.direction.y *
          projectile.speed /
          content.combat.fixedHz,
    };
    const candidates: ProjectileContactCandidate[] = [];
    if (
      working.player.health > 0 &&
      !projectile.hitTargetIds.includes(working.player.id)
    ) {
      const time = segmentCircleTimeOfImpact(
        from,
        to,
        working.player.position,
        projectile.radius + content.playerMovement.actorRadius,
      );
      if (time !== null) {
        candidates.push({
          id: working.player.id,
          kind: "enemy",
          time,
          targetId: working.player.id,
        });
      }
    }
    for (const collision of content.arena.collisions) {
      if (collision.kind === "gate" && working.encounter.gateOpen) {
        continue;
      }
      const time = segmentAabbTimeOfImpact(from, to, {
        minX: collision.x - collision.halfWidth - projectile.radius,
        maxX: collision.x + collision.halfWidth + projectile.radius,
        minY: collision.z - collision.halfDepth - projectile.radius,
        maxY: collision.z + collision.halfDepth + projectile.radius,
      });
      if (time !== null) {
        candidates.push({
          id: collision.id,
          kind: "world",
          time,
        });
      }
    }
    const boundaryTime = arenaBoundaryTimeOfImpact(
      from,
      to,
      projectile.radius,
      content,
    );
    if (boundaryTime !== null) {
      candidates.push({
        id: "arena-boundary",
        kind: "world",
        time: boundaryTime,
      });
    }

    const contact = selectEarliestProjectileContact(candidates);
    if (contact?.kind === "world") continue;
    if (contact?.targetId === working.player.id) {
      const impact = {
        x: from.x + (to.x - from.x) * contact.time,
        y: from.y + (to.y - from.y) * contact.time,
      };
      const source = {
        x: impact.x - projectile.direction.x,
        y: impact.y - projectile.direction.y,
      };
      const move = enemyMoves[projectile.moveId];
      const result = applyIncomingDamage(
        working,
        {
          attackId: projectile.attackId,
          attackerId: projectile.ownerId,
          damage: move.damage,
          angleDegrees: signedAngleDegrees(
            working.player.facingRadians,
            working.player.position,
            source,
          ),
          collisionLayer: "enemy",
          guardBreak: move.guardBreak,
        },
        intent.guardHeld,
        content,
      );
      working = result.state;
      events.push(...result.events);
      continue;
    }

    const next = {
      ...projectile,
      position: to,
      ageTicks: projectile.ageTicks + 1,
    };
    if (next.ageTicks < next.lifetimeTicks) survivors.push(next);
  }

  return {
    state: {
      ...working,
      combat: {
        ...working.combat,
        enemyProjectiles: survivors,
      },
    },
    events,
  };
};

const canEnemyMoveContactPlayer = (
  state: GameState,
  enemy: GameState["enemies"][string],
  content: GameContent,
): boolean => {
  if (
    enemy.currentMoveId === null ||
    enemy.targetId !== state.player.id ||
    state.player.health <= 0 ||
    enemy.health <= 0
  ) {
    return false;
  }
  const move = enemyMoves[enemy.currentMoveId];
  if (
    move.contactKind === "summon" ||
    move.contactKind === "projectile"
  ) {
    return false;
  }
  const playerDistance = Math.hypot(
    state.player.position.x - enemy.position.x,
    state.player.position.y - enemy.position.y,
  );
  if (
    playerDistance + TIME_EPSILON < move.minimumRange ||
    playerDistance >
      move.maximumRange +
        content.playerMovement.actorRadius +
        TIME_EPSILON
  ) {
    return false;
  }
  if (
    !hasEnemyLineOfSight(
      enemy.position,
      state.player.position,
      content.arena,
      state.encounter.gateOpen,
    )
  ) {
    return false;
  }
  return (
    move.contactKind === "shockwave" ||
    isInFacingCone(
      enemy.position,
      enemy.lockedFacingRadians,
      state.player.position,
      move.facingHalfAngleDegrees,
    )
  );
};

export function stepEnemyCombat(
  state: GameState,
  intent: GameIntent,
  events: readonly GameEvent[],
  content: GameContent,
): StepGameResult {
  let working = state;
  const produced: GameEvent[] = [...events];

  for (const enemyId of Object.keys(working.enemies).sort()) {
    let enemy = working.enemies[enemyId];
    if (!enemy || enemy.currentMoveId === null) continue;
    if (enemy.health <= 0 || enemy.staggerTicks > 0) {
      const interrupted = {
        ...enemy,
        intent: enemy.health <= 0 ? "dead" as const : "stagger" as const,
        currentMoveId: null,
        movePhase: "none" as const,
        moveElapsedTicks: 0,
        hitTargetIds: [],
      };
      working = {
        ...working,
        enemies: { ...working.enemies, [enemyId]: interrupted },
      };
      continue;
    }

    const move = enemyMoves[enemy.currentMoveId];
    const attackId = enemyAttackId(enemy);
    if (enemy.movePhase === "telegraph") {
      if (enemy.moveElapsedTicks === 0) {
        produced.push({
          type: "enemy-telegraph",
          enemyId,
          moveId: enemy.currentMoveId,
          attackId,
        });
      }
      const elapsed = enemy.moveElapsedTicks + 1;
      const complete =
        elapsed >= ticksFor(move.telegraphSeconds, content);
      if (complete && move.contactKind === "summon") {
        produced.push({
          type: "enemy-move-active",
          enemyId,
          moveId: enemy.currentMoveId,
          attackId,
        });
      }
      enemy = {
        ...enemy,
        intent: complete ? "attack" : "telegraph",
        movePhase: complete ? "active" : "telegraph",
        moveElapsedTicks: complete ? 0 : elapsed,
        action: complete ? "attack" : "idle",
        actionTime: complete
          ? 0
          : elapsed / content.combat.fixedHz,
      };
      working = {
        ...working,
        enemies: { ...working.enemies, [enemyId]: enemy },
        enemyAi:
          complete && move.slot === "ranged"
            ? { ...working.enemyAi, rangedWindowUsed: true }
            : working.enemyAi,
      };
      continue;
    }

    if (enemy.movePhase === "active") {
      if (
        enemy.currentMoveId === "warden-bolt" &&
        !working.combat.spawnedEnemyAttackIds.includes(attackId)
      ) {
        const projectile = spawnEnemyProjectile(enemy, attackId, content);
        working = {
          ...working,
          combat: {
            ...working.combat,
            enemyProjectiles: [
              ...working.combat.enemyProjectiles,
              projectile,
            ],
            spawnedEnemyAttackIds: [
              ...working.combat.spawnedEnemyAttackIds,
              attackId,
            ],
          },
        };
        produced.push({
          type: "enemy-projectile-spawned",
          projectileId: projectile.id,
          attackId: projectile.attackId,
          ownerId: projectile.ownerId,
          position: { ...projectile.position },
          velocity: {
            x: projectile.direction.x * projectile.speed,
            y: projectile.direction.y * projectile.speed,
          },
        });
      }
      if (
        !enemy.hitTargetIds.includes(state.player.id) &&
        canEnemyMoveContactPlayer(working, enemy, content)
      ) {
        const damage = enemy.nonlethal
          ? Math.max(0, Math.min(move.damage, working.player.health - 1))
          : move.damage;
        const result = applyIncomingDamage(
          working,
          {
            attackId,
            attackerId: enemy.id,
            damage,
            angleDegrees: signedAngleDegrees(
              working.player.facingRadians,
              working.player.position,
              enemy.position,
            ),
            collisionLayer: "enemy",
            guardBreak: move.guardBreak,
          },
          intent.guardHeld,
          content,
        );
        working = result.state;
        produced.push(...result.events);
        const contacted = working.enemies[enemyId];
        if (contacted) {
          enemy = {
            ...contacted,
            hitTargetIds: [state.player.id],
          };
          working = {
            ...working,
            enemies: { ...working.enemies, [enemyId]: enemy },
          };
        }
      }

      const latest = working.enemies[enemyId];
      if (!latest || latest.currentMoveId === null) continue;
      const elapsed = latest.moveElapsedTicks + 1;
      const complete =
        elapsed >= ticksFor(move.activeSeconds, content);
      enemy = {
        ...latest,
        intent: complete ? "recover" : "attack",
        movePhase: complete ? "recover" : "active",
        moveElapsedTicks: complete ? 0 : elapsed,
        action: complete ? "idle" : "attack",
        actionTime: complete
          ? 0
          : elapsed / content.combat.fixedHz,
      };
      working = {
        ...working,
        enemies: { ...working.enemies, [enemyId]: enemy },
      };
      continue;
    }

    if (enemy.movePhase === "recover") {
      const elapsed = enemy.moveElapsedTicks + 1;
      const complete =
        elapsed >= ticksFor(move.recoverySeconds, content);
      enemy = {
        ...enemy,
        intent: "recover",
        currentMoveId: complete ? null : enemy.currentMoveId,
        movePhase: complete ? "none" : "recover",
        moveElapsedTicks: complete ? 0 : elapsed,
        cooldownTicks: complete
          ? ticksFor(move.cooldownSeconds, content)
          : enemy.cooldownTicks,
        hitTargetIds: complete ? [] : enemy.hitTargetIds,
        action: "idle",
        actionTime: complete
          ? 0
          : elapsed / content.combat.fixedHz,
      };
      working = {
        ...working,
        enemies: { ...working.enemies, [enemyId]: enemy },
      };
    }
  }

  return { state: working, events: produced };
}

export function stepCombat(
  state: GameState,
  intent: GameIntent,
  events: readonly GameEvent[],
  content: GameContent,
): StepGameResult {
  const attackEdge =
    intent.attackPressed && !state.combat.attackInputHeld;
  const switchEdge =
    intent.switchWeaponPressed && !state.combat.switchInputHeld;
  let working: GameState =
    state.combat.attackInputHeld === intent.attackPressed &&
    state.combat.switchInputHeld === intent.switchWeaponPressed
      ? state
      : {
          ...state,
          combat: {
            ...state.combat,
            attackInputHeld: intent.attackPressed,
            switchInputHeld: intent.switchWeaponPressed,
          },
        };
  const produced: GameEvent[] = [...events];

  if (working.player.action === "hit") {
    const recoveryTicks = working.combat.playerHitRecoveryTicks + 1;
    const finished =
      recoveryTicks >=
      ticksFor(content.combat.playerHitRecoverySeconds, content);
    working = {
      ...working,
      player: {
        ...working.player,
        action: finished ? "idle" : "hit",
        actionTime: finished
          ? 0
          : recoveryTicks / content.combat.fixedHz,
      },
      combat: {
        ...working.combat,
        activeAttack: null,
        playerHitRecoveryTicks: finished ? 0 : recoveryTicks,
      },
    };
    const projectileResult = stepProjectiles(working, content);
    const enemyProjectileResult = stepEnemyProjectiles(
      projectileResult.state,
      intent,
      content,
    );
    return {
      state: enemyProjectileResult.state,
      events: [
        ...produced,
        ...projectileResult.events,
        ...enemyProjectileResult.events,
      ],
    };
  }

  if (
    working.combat.activeAttack &&
    working.player.action !== "attack"
  ) {
    working = {
      ...working,
      combat: {
        ...working.combat,
        activeAttack: null,
      },
    };
  }

  if (working.combat.activeAttack) {
    const result = stepActiveAttack(working, attackEdge, content);
    working = result.state;
    produced.push(...result.events);
  } else {
    working = stepGuard(working, intent, content);

    if (
      switchEdge &&
      (working.player.action === "idle" ||
        working.player.action === "move")
    ) {
      working = {
        ...working,
        player: {
          ...working.player,
          weaponId:
            working.player.weaponId === "oathblade"
              ? "ember-bow"
              : "oathblade",
        },
      };
    }

    if (
      attackEdge &&
      (working.player.action === "idle" ||
        working.player.action === "move")
    ) {
      const started = startAttack(
        working,
        working.player.weaponId === "oathblade"
          ? "oathblade-light-1"
          : "ember-bow-shot",
        content,
      );
      working = started.state;
      produced.push(...started.events);
    }
  }

  const projectileResult = stepProjectiles(working, content);
  working = projectileResult.state;
  produced.push(...projectileResult.events);

  const enemyResult = stepEnemyCombat(working, intent, produced, content);
  working = enemyResult.state;
  produced.splice(0, produced.length, ...enemyResult.events);
  const enemyProjectileResult = stepEnemyProjectiles(
    working,
    intent,
    content,
  );
  working = enemyProjectileResult.state;
  produced.push(...enemyProjectileResult.events);

  if (
    !attackEdge &&
    !intent.dodgePressed &&
    !intent.guardHeld &&
    working.combat.activeAttack === null &&
    (working.player.action === "idle" ||
      working.player.action === "move") &&
    working.player.stamina < working.player.maxStamina
  ) {
    const stamina = Math.min(
      working.player.maxStamina,
      working.player.stamina +
        content.combat.staminaRegenPerSecond /
          content.combat.fixedHz,
    );
    working = {
      ...working,
      player: {
        ...working.player,
        stamina,
      },
    };
  }

  return { state: working, events: produced };
}
