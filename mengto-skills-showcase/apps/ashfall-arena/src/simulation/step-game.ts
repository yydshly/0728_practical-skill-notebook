import type {
  GameContent,
  GameIntent,
  StepGameResult,
  GameState,
  Vec2,
} from "./types";
import { stepCombat } from "./combat";
import { stepEnemyAi } from "./enemy-ai";
import { stepEncounter } from "./encounters";
import {
  collectNearbyDrops,
  createDropsForDefeats,
  settlePendingDrops,
  useHealingChargeWithEvents,
} from "./inventory";
import { resolveArenaMovement } from "./resolve-movement";

const FIXED_DELTA = 1 / 60;

export function isDodgeInvulnerable(
  actor: Pick<GameState["player"], "action" | "actionTime">,
  content: GameContent,
): boolean {
  const { invulnerabilityStart, invulnerabilityEnd } =
    content.playerMovement.dodge;

  return (
    actor.action === "dodge" &&
    actor.actionTime >= invulnerabilityStart &&
    actor.actionTime <= invulnerabilityEnd
  );
}

function normalizedDirection(intent: GameIntent): Vec2 {
  const { moveX: x, moveY: y } = intent;
  const length = Math.hypot(x, y);

  if (length === 0) {
    return { x: 0, y: 0 };
  }

  const scale = length > 1 ? 1 / length : 1;
  return { x: x * scale, y: y * scale };
}

function directionFromFacing(facingRadians: number): Vec2 {
  return {
    x: Math.sin(facingRadians),
    y: Math.cos(facingRadians),
  };
}

function movedPosition(
  position: Vec2,
  direction: Vec2,
  distance: number,
  content: GameContent,
  gateOpen: boolean,
): Vec2 {
  return resolveArenaMovement(
    position,
    {
      x: position.x + direction.x * distance,
      y: position.y + direction.y * distance,
    },
    content.playerMovement.actorRadius,
    gateOpen,
    content.arena,
  );
}

function stepDodge(
  state: GameState,
  content: GameContent,
): GameState["player"] {
  const dodge = content.playerMovement.dodge;
  const remaining = Math.max(0, dodge.duration - state.player.actionTime);
  const travelTime = Math.min(FIXED_DELTA, remaining);
  const position = movedPosition(
    state.player.position,
    directionFromFacing(state.player.facingRadians),
    dodge.speed * travelTime,
    content,
    state.encounter.gateOpen,
  );
  const elapsed = state.player.actionTime + travelTime;
  const finished = elapsed >= dodge.duration;

  return {
    ...state.player,
    position,
    action: finished ? "idle" : "dodge",
    actionTime: finished ? 0 : elapsed,
  };
}

function stepPlayer(
  state: GameState,
  intent: GameIntent,
  content: GameContent,
): GameState["player"] {
  if (
    state.player.action === "hit" ||
    state.player.action === "dead"
  ) {
    return state.player;
  }

  if (state.player.action === "dodge") {
    return stepDodge(state, content);
  }

  const direction = normalizedDirection(intent);
  const hasMovement = direction.x !== 0 || direction.y !== 0;
  const facingRadians = hasMovement
    ? Math.atan2(direction.x, direction.y)
    : state.player.facingRadians;
  const dodge = content.playerMovement.dodge;

  if (intent.dodgePressed && state.player.stamina >= dodge.staminaCost) {
    return {
      ...state.player,
      position: movedPosition(
        state.player.position,
        directionFromFacing(facingRadians),
        dodge.speed * FIXED_DELTA,
        content,
        state.encounter.gateOpen,
      ),
      facingRadians,
      stamina: state.player.stamina - dodge.staminaCost,
      action: "dodge",
      actionTime: FIXED_DELTA,
    };
  }

  if (
    state.player.action === "attack" ||
    state.player.action === "guard"
  ) {
    return state.player;
  }

  const action = hasMovement ? "move" : "idle";
  const actionTime =
    action === "idle"
      ? 0
      : state.player.action === action
        ? state.player.actionTime + FIXED_DELTA
        : FIXED_DELTA;

  if (
    !hasMovement &&
    action === state.player.action &&
    actionTime === state.player.actionTime
  ) {
    return state.player;
  }

  return {
    ...state.player,
    position: hasMovement
      ? movedPosition(
          state.player.position,
          direction,
          content.playerMovement.walkSpeed * FIXED_DELTA,
          content,
          state.encounter.gateOpen,
        )
      : state.player.position,
    facingRadians,
    action,
    actionTime,
  };
}

const availableLockTargets = (state: GameState) => {
  const enemyIds = Object.values(state.enemies)
    .filter(({ health }) => health > 0)
    .map(({ id }) => id)
    .sort();
  return enemyIds.length > 0 ? enemyIds : ["training-lock-target"];
};

const nextLockTarget = (
  state: GameState,
  lockPressed: boolean,
): string | null => {
  const candidates = availableLockTargets(state);
  const current = candidates.includes(state.player.lockTargetId ?? "")
    ? state.player.lockTargetId
    : null;
  if (!lockPressed) return current;
  if (current === null) return candidates[0]!;
  const index = candidates.indexOf(current);
  return index >= 0 && index < candidates.length - 1
    ? candidates[index + 1]!
    : null;
};

const canHandleLockIntent = (state: GameState): boolean =>
  state.status === "playing" &&
  !state.paused &&
  state.player.health > 0 &&
  state.player.action !== "hit" &&
  state.player.action !== "dead";

export function settleAuthoritativeResult(
  result: StepGameResult,
): StepGameResult {
  const rewards = createDropsForDefeats(
    result.state,
    result.events,
  );
  const collected = collectNearbyDrops(rewards.state);
  const encounter = stepEncounter(collected, result.events);
  const crossedRewardBoundary = encounter.events.some(
    (event) =>
      event.type === "upgrade-offered" ||
      event.type === "encounter-complete" ||
      (event.type === "encounter-phase" && event.phase === "boss"),
  );
  const state = crossedRewardBoundary
    ? settlePendingDrops(encounter.state)
    : encounter.state;
  return {
    state,
    events: [
      ...result.events,
      ...rewards.events,
      ...encounter.events,
    ],
  };
}

export function stepGame(
  state: GameState,
  intent: GameIntent,
  fixedDelta: number,
  content: GameContent,
): StepGameResult {
  if (fixedDelta !== FIXED_DELTA) {
    throw new RangeError("fixedDelta must equal 1 / 60");
  }

  if (state.status !== "playing") {
    return {
      state,
      events: [],
    };
  }

  if (intent.pausePressed) {
    return {
      state: {
        ...state,
        paused: !state.paused,
      },
      events: [],
    };
  }

  if (state.paused) {
    return {
      state,
      events: [],
    };
  }

  const progression =
    intent.healPressed &&
      !intent.attackPressed &&
      !intent.dodgePressed &&
      !intent.guardHeld
      ? useHealingChargeWithEvents(state)
      : { state, events: [] };
  const progressionState = progression.state;
  const steppedPlayer = stepPlayer(progressionState, intent, content);
  const movedState =
    steppedPlayer === progressionState.player
      ? progressionState
      : {
          ...progressionState,
          player: steppedPlayer,
        };
  const aiState = stepEnemyAi(movedState, content);
  const combat = stepCombat(
    aiState,
    intent,
    progression.events,
    content,
  );
  const settled = settleAuthoritativeResult(combat);
  const progressedEncounterState = settled.state;
  const lockTargetId = canHandleLockIntent(state)
    ? nextLockTarget(progressedEncounterState, intent.lockPressed)
    : progressedEncounterState.player.lockTargetId;
  const player =
    progressedEncounterState.player.lockTargetId === lockTargetId
      ? progressedEncounterState.player
      : { ...progressedEncounterState.player, lockTargetId };

  return {
    state: {
      ...progressedEncounterState,
      tick: state.tick + 1,
      player,
    },
    events: [
      ...settled.events,
    ],
  };
}
