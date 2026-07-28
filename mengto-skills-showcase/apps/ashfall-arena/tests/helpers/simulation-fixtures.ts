import { arenaContent } from "../../src/content/arena-content";
import { stepGame } from "../../src/simulation/step-game";
import type {
  ActorState,
  EnemyKind,
  GameEvent,
  GameIntent,
  GameState,
} from "../../src/simulation/types";

export const neutralIntent: GameIntent = {
  moveX: 0,
  moveY: 0,
  attackPressed: false,
  guardHeld: false,
  dodgePressed: false,
  lockPressed: false,
  healPressed: false,
  switchWeaponPressed: false,
  pausePressed: false,
};

export function createEnemyState(
  kind: EnemyKind,
  overrides: Partial<ActorState> = {},
): GameState["enemies"][string] {
  return {
    id: "enemy-1",
    kind,
    position: { x: 0, y: 1.4 },
    facingRadians: Math.PI,
    health: 36,
    maxHealth: 36,
    stamina: 100,
    maxStamina: 100,
    action: "idle",
    actionTime: 0,
    intent: "observe",
    cooldown: 0,
    ...overrides,
  };
}

export function runTicks(
  initial: GameState,
  intents: ReadonlyMap<number, Partial<GameIntent>>,
  count: number,
) {
  let state = initial;
  const events: GameEvent[] = [];

  for (let tick = 0; tick < count; tick += 1) {
    const result = stepGame(
      state,
      { ...neutralIntent, ...intents.get(tick) },
      1 / 60,
      arenaContent,
    );
    state = result.state;
    events.push(...result.events);
  }

  return { state, events };
}
