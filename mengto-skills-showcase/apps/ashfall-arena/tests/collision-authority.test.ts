import { describe, expect, it } from "vitest";
import { arenaContent } from "../src/content/arena-content";
import { createInitialState } from "../src/simulation/create-initial-state";
import { resolveArenaMovement } from "../src/simulation/resolve-movement";
import { stepGame } from "../src/simulation/step-game";
import type { GameIntent, GameState } from "../src/simulation/types";

const forward: GameIntent = {
  moveX: 0,
  moveY: 1,
  attackPressed: false,
  guardHeld: false,
  dodgePressed: false,
  lockPressed: false,
  healPressed: false,
  switchWeaponPressed: false,
  pausePressed: false,
};

const idle: GameIntent = { ...forward, moveY: 0 };

const run = (initial: GameState, intent: GameIntent, ticks: number) => {
  let state = initial;
  for (let index = 0; index < ticks; index += 1) {
    state = stepGame(state, intent, 1 / 60, arenaContent).state;
  }
  return state;
};

describe("authoritative arena collision", () => {
  it("blocks movement against the west anvil inside stepGame", () => {
    const state = createInitialState(1);
    state.player.position = { x: -6.3, y: -4 };

    const result = run(state, forward, 120);

    expect(result.player.position.y).toBeLessThanOrEqual(-2.3);
    expect(result.player.position.x).toBe(-6.3);
  });

  it("closes every legal elite-to-boss crossing and opens the authored portal", () => {
    const collision = arenaContent.arena;
    for (const x of [-17.4, -12, -4, 0, 4, 12, 17.4]) {
      const closed = resolveArenaMovement(
        { x, y: 7.2 },
        { x, y: 8.8 },
        0.35,
        false,
        collision,
      );
      expect(closed.y, `closed gate crossing at x=${x}`).toBeLessThan(8);
    }

    for (const x of [-2.1, 0, 2.1]) {
      const opened = resolveArenaMovement(
        { x, y: 7.2 },
        { x, y: 8.8 },
        0.35,
        true,
        collision,
      );
      expect(opened, `open portal crossing at x=${x}`).toEqual({ x, y: 8.8 });
    }
  });

  it("uses the same gate data in stepGame without a post-render state patch", () => {
    const closed = createInitialState(2);
    closed.player.position = { x: 4, y: 7.2 };
    closed.encounter.gateOpen = false;
    expect(run(closed, forward, 90).player.position.y).toBeLessThan(8);

    const opened = createInitialState(2);
    opened.player.position = { x: 0, y: 6 };
    opened.encounter.gateOpen = true;
    expect(run(opened, forward, 75).player.position.y).toBeGreaterThan(10);
  });

  it("preserves deterministic replay with collisions and an open-gate path", () => {
    const replay = () => {
      const state = createInitialState(7481);
      state.player.position = { x: -6.3, y: -4 };
      const blocked = run(state, forward, 90);
      const repositioned: GameState = {
        ...blocked,
        player: {
          ...blocked.player,
          position: { x: 0, y: 6 },
        },
        encounter: { ...blocked.encounter, gateOpen: true },
      };
      return run(run(repositioned, idle, 1), forward, 75);
    };

    expect(replay()).toEqual(replay());
    expect(replay().player.position.y).toBeGreaterThan(10);
  });
});

describe("authoritative lock selection", () => {
  it("serializes the authored training target when no enemy is available", () => {
    const state = createInitialState(9);
    const locked = stepGame(
      state,
      { ...idle, lockPressed: true },
      1 / 60,
      arenaContent,
    ).state;
    const unlocked = stepGame(
      locked,
      { ...idle, lockPressed: true },
      1 / 60,
      arenaContent,
    ).state;

    expect(locked.player.lockTargetId).toBe("training-lock-target");
    expect(unlocked.player.lockTargetId).toBeNull();
    expect(JSON.parse(JSON.stringify(locked))).toEqual(locked);
  });
});
