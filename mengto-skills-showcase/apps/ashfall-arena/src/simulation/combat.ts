import { arenaContent } from "../content/arena-content";
import type {
  ActorState,
  AttackActionId,
  AttackInstance,
  AttackPhase,
  CombatActionContent,
  GameContent,
  GameEvent,
  GameIntent,
  GameState,
  IncomingHit,
  ProjectileState,
  StepGameResult,
  Vec2,
} from "./types";

const TIME_EPSILON = 1e-9;
const PROJECTILE_TOI_TIE_EPSILON = 1e-9;

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
  const guarded = guardAttempted && actor.stamina >= guard.staminaPerHit;
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

const applyEnemyDamage = (
  state: GameState,
  targetId: string,
  attack: AttackInstance,
  damage: number,
): StepGameResult => {
  const target = state.enemies[targetId];
  if (!target) return { state, events: [] };
  const health = Math.max(0, target.health - damage);
  const targetState = {
    ...target,
    health,
    action: health === 0 ? "dead" as const : "hit" as const,
    actionTime: 0,
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
): GameState => {
  const action = actionContent(actionId, content);
  if (state.player.stamina + TIME_EPSILON < action.stamina) return state;

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
      const result = applyEnemyDamage(
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
    return {
      state: startAttack(
        withoutAttack,
        "oathblade-light-2",
        content,
      ),
      events,
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
    const candidates: Array<{
      id: string;
      kind: "enemy" | "world";
      time: number;
      targetId?: string;
    }> = [];

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

    candidates.sort((left, right) => {
      const timeDelta = left.time - right.time;
      if (Math.abs(timeDelta) > PROJECTILE_TOI_TIE_EPSILON) {
        return timeDelta;
      }
      if (left.kind !== right.kind) {
        return left.kind === "world" ? -1 : 1;
      }
      return left.id.localeCompare(right.id);
    });
    const firstContact = candidates[0];

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
      const result = applyEnemyDamage(working, targetId, attack, damage);
      working = result.state;
      events.push(...result.events);
      continue;
    }

    if (firstContact?.kind === "world") continue;

    if (nextProjectile.ageTicks < nextProjectile.lifetimeTicks) {
      survivors.push(nextProjectile);
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
    return {
      state: projectileResult.state,
      events: [...produced, ...projectileResult.events],
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
      working = startAttack(
        working,
        working.player.weaponId === "oathblade"
          ? "oathblade-light-1"
          : "ember-bow-shot",
        content,
      );
    }
  }

  const projectileResult = stepProjectiles(working, content);
  working = projectileResult.state;
  produced.push(...projectileResult.events);

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
