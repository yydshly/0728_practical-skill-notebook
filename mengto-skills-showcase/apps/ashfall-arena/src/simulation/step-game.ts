import type {
  GameContent,
  GameIntent,
  GameState,
  StepGameResult,
  Vec2,
} from "./types";

const FIXED_DELTA = 1 / 60;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

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
): Vec2 {
  return {
    x: clamp(
      position.x + direction.x * distance,
      content.arena.min.x,
      content.arena.max.x,
    ),
    y: clamp(
      position.y + direction.y * distance,
      content.arena.min.y,
      content.arena.max.y,
    ),
  };
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
      ),
      facingRadians,
      stamina: state.player.stamina - dodge.staminaCost,
      action: "dodge",
      actionTime: FIXED_DELTA,
    };
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
        )
      : state.player.position,
    facingRadians,
    action,
    actionTime,
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

  const nextTick = state.tick + 1;

  if (intent.pausePressed) {
    return {
      state: {
        ...state,
        tick: nextTick,
        paused: !state.paused,
      },
      events: [],
    };
  }

  if (state.paused) {
    return {
      state: {
        ...state,
        tick: nextTick,
      },
      events: [],
    };
  }

  const player = stepPlayer(state, intent, content);

  return {
    state: {
      ...state,
      tick: nextTick,
      player,
    },
    events: [],
  };
}
