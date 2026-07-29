import { arenaContent } from "../../src/content/arena-content";
import { stepGame } from "../../src/simulation/step-game";
import { createEncounterEnemy } from "../../src/simulation/encounters";
import type {
  EnemyState,
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
  overrides: Partial<EnemyState> = {},
): GameState["enemies"][string] {
  return createEncounterEnemy(
    overrides.id ?? "enemy-1",
    kind,
    overrides.position ?? { x: 0, y: 1.4 },
    { aiEnabled: false, ...overrides },
  );
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
