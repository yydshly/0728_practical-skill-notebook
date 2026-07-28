import {
  enemyDefinitions,
  enemyMoves,
} from "../content/enemy-definitions";
import { resolveArenaMovement } from "./resolve-movement";
import type {
  EnemyIntent,
  EnemyMoveId,
  EnemyState,
  GameContent,
  GameState,
  Vec2,
} from "./types";

const DECISION_INTERVAL_TICKS = 6;
const RANGED_WINDOW_TICKS = 30;
const EPSILON = 1e-9;

export interface EnemyDecisionContext {
  readonly playerDistance: number;
  readonly visibleSeconds: number;
  readonly hasLineOfSight: boolean;
  readonly targetAvailable: boolean;
  readonly pathSucceeded: boolean;
  readonly meleeSlotOwner: string | null;
  readonly rangedSlotOwner: string | null;
}

const isCommitted = (enemy: EnemyState): boolean =>
  enemy.currentMoveId !== null &&
  (enemy.movePhase === "telegraph" || enemy.movePhase === "active");

export function chooseEnemyIntent(
  enemy: Readonly<EnemyState>,
  context: Readonly<EnemyDecisionContext>,
): EnemyIntent {
  if (enemy.health <= 0 || enemy.action === "dead") return "dead";
  if (enemy.staggerTicks > 0) return "stagger";
  if (!context.targetAvailable || enemy.targetId === null) return "observe";
  if (isCommitted(enemy)) return enemy.intent;

  const definition = enemyDefinitions[enemy.definitionId];
  if (context.visibleSeconds + EPSILON < definition.perceptionSeconds) {
    return "observe";
  }
  if (!context.hasLineOfSight) return "approach";
  if (!context.pathSucceeded) {
    return definition.role === "ranged" ? "retreat" : "orbit";
  }
  if (
    context.playerDistance + EPSILON <
    definition.preferredRange.minimum
  ) {
    return "retreat";
  }
  if (
    context.playerDistance >
    definition.preferredRange.maximum + EPSILON
  ) {
    return "approach";
  }

  if (definition.role === "ranged") {
    return context.rangedSlotOwner === null ||
        context.rangedSlotOwner === enemy.id
      ? "telegraph"
      : "orbit";
  }
  return context.meleeSlotOwner === null ||
      context.meleeSlotOwner === enemy.id
    ? "telegraph"
    : "orbit";
}

export function requestEnemyMove(
  enemy: Readonly<EnemyState>,
  moveId: EnemyMoveId,
  _tick: number,
): EnemyState {
  const definition = enemyDefinitions[enemy.definitionId];
  if (!definition.moveIds.includes(moveId)) {
    throw new Error(`${enemy.definitionId} cannot use ${moveId}`);
  }
  if (enemy.health <= 0 || enemy.currentMoveId !== null) return enemy;

  return {
    ...enemy,
    intent: "telegraph",
    intentTicks: 0,
    currentMoveId: moveId,
    movePhase: "telegraph",
    moveElapsedTicks: 0,
    attackSequence: enemy.attackSequence + 1,
    hitTargetIds: [],
    lockedFacingRadians: enemy.facingRadians,
    action: "idle",
    actionTime: 0,
  };
}

const lineIntersectsBox = (
  start: Readonly<Vec2>,
  end: Readonly<Vec2>,
  box: GameContent["arena"]["collisions"][number],
): boolean => {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  let enter = 0;
  let exit = 1;
  for (const [origin, delta, minimum, maximum] of [
    [start.x, deltaX, box.x - box.halfWidth, box.x + box.halfWidth],
    [start.y, deltaY, box.z - box.halfDepth, box.z + box.halfDepth],
  ] as const) {
    if (Math.abs(delta) <= EPSILON) {
      if (origin < minimum || origin > maximum) return false;
      continue;
    }
    const first = (minimum - origin) / delta;
    const second = (maximum - origin) / delta;
    enter = Math.max(enter, Math.min(first, second));
    exit = Math.min(exit, Math.max(first, second));
    if (enter > exit) return false;
  }
  return enter <= 1 && exit >= 0;
};

export function hasEnemyLineOfSight(
  start: Readonly<Vec2>,
  end: Readonly<Vec2>,
  arena: GameContent["arena"],
  gateOpen: boolean,
): boolean {
  return !arena.collisions.some((collision) => {
    const solid =
      collision.kind === "interior" ||
      collision.kind === "portal-wall" ||
      (collision.kind === "gate" && !gateOpen);
    return solid && lineIntersectsBox(start, end, collision);
  });
}

const distance = (left: Readonly<Vec2>, right: Readonly<Vec2>) =>
  Math.hypot(right.x - left.x, right.y - left.y);

const facingTo = (origin: Readonly<Vec2>, target: Readonly<Vec2>) =>
  Math.atan2(target.x - origin.x, target.y - origin.y);

const directionTo = (
  origin: Readonly<Vec2>,
  target: Readonly<Vec2>,
): Vec2 => {
  const x = target.x - origin.x;
  const y = target.y - origin.y;
  const length = Math.hypot(x, y);
  return length <= EPSILON
    ? { x: 0, y: 0 }
    : { x: x / length, y: y / length };
};

const moveDirection = (
  enemy: Readonly<EnemyState>,
  player: Readonly<Vec2>,
): Vec2 => {
  const toward = directionTo(enemy.position, player);
  switch (enemy.intent) {
    case "approach":
      return toward;
    case "retreat":
      return { x: -toward.x, y: -toward.y };
    case "orbit": {
      const clockwise =
        [...enemy.id].reduce((sum, character) => sum + character.charCodeAt(0), 0) %
          2 ===
        0;
      return clockwise
        ? { x: toward.y, y: -toward.x }
        : { x: -toward.y, y: toward.x };
    }
    default:
      return { x: 0, y: 0 };
  }
};

const applyMovement = (
  enemy: EnemyState,
  state: Readonly<GameState>,
  content: GameContent,
): EnemyState => {
  if (
    isCommitted(enemy) ||
    (enemy.intent !== "approach" &&
      enemy.intent !== "orbit" &&
      enemy.intent !== "retreat")
  ) {
    return enemy;
  }
  const definition = enemyDefinitions[enemy.definitionId];
  const direction = moveDirection(enemy, state.player.position);
  const target = {
    x: enemy.position.x +
      direction.x * definition.speed / content.combat.fixedHz,
    y: enemy.position.y +
      direction.y * definition.speed / content.combat.fixedHz,
  };
  const position = resolveArenaMovement(
    enemy.position,
    target,
    definition.actorRadius,
    state.encounter.gateOpen,
    content.arena,
  );
  const moved = distance(position, enemy.position) > EPSILON;
  return {
    ...enemy,
    position,
    facingRadians: facingTo(enemy.position, state.player.position),
    pathFailureTicks: moved ? 0 : enemy.pathFailureTicks + 1,
    action: moved ? "move" : "idle",
    actionTime: moved ? enemy.actionTime + 1 / content.combat.fixedHz : 0,
  };
};

const chooseMove = (
  enemy: Readonly<EnemyState>,
  playerDistance: number,
): EnemyMoveId | null => {
  const definition = enemyDefinitions[enemy.definitionId];
  const legal = definition.moveIds.filter((id) => {
    const move = enemyMoves[id];
    if (move.contactKind === "summon") {
      return enemy.kind === "bell-sovereign" &&
        enemy.bossPhase > 1 &&
        enemy.attackSequence % 3 === 2;
    }
    return (
      playerDistance + EPSILON >= move.minimumRange &&
      playerDistance <= move.maximumRange + EPSILON
    );
  });
  if (legal.length === 0) return null;
  if (enemy.kind !== "bell-sovereign") return legal[0]!;

  const preferred =
    playerDistance <= enemyMoves["sovereign-sweep"].maximumRange
      ? "sovereign-sweep"
      : "sovereign-shockwave";
  if (legal.includes(preferred)) return preferred;
  return legal[enemy.attackSequence % legal.length]!;
};

const activeSlotOwners = (
  enemies: readonly EnemyState[],
): { melee: string | null; ranged: string | null } => {
  let melee: string | null = null;
  let ranged: string | null = null;
  for (const enemy of enemies) {
    if (!isCommitted(enemy) || enemy.currentMoveId === null) continue;
    const slot = enemyMoves[enemy.currentMoveId].slot;
    if (slot === "melee" && melee === null) melee = enemy.id;
    if (slot === "ranged" && ranged === null) ranged = enemy.id;
  }
  return { melee, ranged };
};

export function stepEnemyAi(
  state: Readonly<GameState>,
  content: GameContent,
): GameState {
  const sorted = Object.values(state.enemies).sort((left, right) =>
    left.id.localeCompare(right.id)
  );
  if (sorted.length === 0) return state as GameState;

  const rangedWindow = Math.floor(state.tick / RANGED_WINDOW_TICKS);
  const windowChanged = rangedWindow !== state.enemyAi.rangedWindow;
  const active = activeSlotOwners(sorted);
  const rangedCandidates = sorted
    .filter(
      (enemy) =>
        enemy.aiEnabled &&
        enemy.health > 0 &&
        enemyDefinitions[enemy.definitionId].moveIds.some(
          (moveId) => enemyMoves[moveId].slot === "ranged",
        ),
    )
    .map(({ id }) => id);
  const fairRangedOwner =
    rangedCandidates.length === 0
      ? null
      : rangedCandidates[rangedWindow % rangedCandidates.length]!;
  let meleeOwner = active.melee;
  let rangedOwner = active.ranged ??
    (windowChanged ? fairRangedOwner : state.enemyAi.rangedSlotOwner);
  const enemies: Record<string, EnemyState> = {};
  let changed = windowChanged;

  for (const source of sorted) {
    const targetAvailable =
      state.player.health > 0 &&
      state.status === "playing";
    const lineOfSight =
      targetAvailable &&
      hasEnemyLineOfSight(
        source.position,
        state.player.position,
        content.arena,
        state.encounter.gateOpen,
      );
    let enemy: EnemyState = {
      ...source,
      visibleTicks: lineOfSight ? source.visibleTicks + 1 : 0,
      cooldownTicks: Math.max(0, source.cooldownTicks - 1),
      staggerTicks: Math.max(0, source.staggerTicks - 1),
      intentTicks: source.intentTicks + 1,
      targetId: targetAvailable ? state.player.id : null,
    };

    if (!source.aiEnabled) {
      enemies[source.id] = enemy;
      changed = changed ||
        enemy.visibleTicks !== source.visibleTicks ||
        enemy.cooldownTicks !== source.cooldownTicks;
      continue;
    }
    if (enemy.health <= 0) {
      enemy = {
        ...enemy,
        intent: "dead",
        action: "dead",
        targetId: null,
      };
      enemies[source.id] = enemy;
      changed = true;
      continue;
    }
    if (enemy.staggerTicks > 0) {
      enemy = {
        ...enemy,
        intent: "stagger",
        action: "hit",
        currentMoveId: null,
        movePhase: "none",
        moveElapsedTicks: 0,
        hitTargetIds: [],
      };
      enemies[source.id] = enemy;
      changed = true;
      continue;
    }
    if (isCommitted(enemy) || enemy.movePhase === "recover") {
      enemies[source.id] = enemy;
      changed = changed ||
        enemy.visibleTicks !== source.visibleTicks ||
        enemy.cooldownTicks !== source.cooldownTicks;
      continue;
    }

    if (state.tick % DECISION_INTERVAL_TICKS === 0) {
      const playerDistance = distance(enemy.position, state.player.position);
      const intent = chooseEnemyIntent(enemy, {
        playerDistance,
        visibleSeconds: enemy.visibleTicks / content.combat.fixedHz,
        hasLineOfSight: lineOfSight,
        targetAvailable,
        pathSucceeded: enemy.pathFailureTicks < 12,
        meleeSlotOwner: meleeOwner,
        rangedSlotOwner: rangedOwner,
      });
      enemy = {
        ...enemy,
        intent,
        intentTicks: intent === source.intent ? enemy.intentTicks : 0,
        facingRadians:
          intent === "telegraph"
            ? facingTo(enemy.position, state.player.position)
            : enemy.facingRadians,
      };

      if (intent === "telegraph" && enemy.cooldownTicks > 0) {
        enemy = { ...enemy, intent: "recover" };
      } else if (intent === "telegraph") {
        const moveId = chooseMove(enemy, playerDistance);
        if (moveId !== null) {
          enemy = requestEnemyMove(enemy, moveId, state.tick);
          const slot = enemyMoves[moveId].slot;
          if (slot === "melee") meleeOwner = enemy.id;
          if (slot === "ranged") rangedOwner = enemy.id;
        } else {
          enemy = {
            ...enemy,
            intent:
              playerDistance <
                enemyDefinitions[enemy.definitionId].preferredRange.minimum
                ? "retreat"
                : "approach",
          };
        }
      }
    }

    enemy = applyMovement(enemy, state as GameState, content);
    enemies[source.id] = enemy;
    changed = changed || JSON.stringify(enemy) !== JSON.stringify(source);
  }

  if (!changed) return state as GameState;
  return {
    ...state,
    enemies,
    enemyAi: {
      meleeSlotOwner: meleeOwner,
      rangedWindow,
      rangedSlotOwner: rangedOwner,
    },
  };
}
