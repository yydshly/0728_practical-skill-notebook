import { describe, expect, it } from "vitest";
import { arenaContent } from "../src/content/arena-content";
import { createInitialState } from "../src/simulation/create-initial-state";
import { isDodgeInvulnerable, stepGame } from "../src/simulation/step-game";
import type { GameIntent } from "../src/simulation/types";
import { neutralIntent, runTicks } from "./helpers/simulation-fixtures";

describe("fixed-step simulation", () => {
  it("produces identical state for identical seed and intent sequence", () => {
    const run = () => {
      let state = createInitialState(7481);
      for (let frame = 0; frame < 120; frame += 1) {
        state = stepGame(
          state,
          {
            ...neutralIntent,
            moveY: 1,
            attackPressed: frame === 60,
          },
          1 / 60,
          arenaContent,
        ).state;
      }
      return state;
    };

    expect(run()).toEqual(run());
  });

  it("starts with the approved player and encounter values", () => {
    const state = createInitialState(1);

    expect(state).toMatchObject({
      version: 1,
      seed: 1,
      tick: 0,
      status: "playing",
      paused: false,
      encounter: { phase: "training", gateOpen: false },
    });
    expect(state.player).toMatchObject({
      health: 105,
      maxHealth: 105,
      stamina: 100,
      maxStamina: 100,
      weaponId: "oathblade",
      healingCharges: 3,
    });
    expect(state.player.position).toEqual({ x: 0, y: -9 });
  });

  it("rejects every delta other than exactly one sixtieth of a second", () => {
    const state = createInitialState(1);

    expect(() => stepGame(state, neutralIntent, 1 / 30, arenaContent)).toThrow(
      "fixedDelta must equal 1 / 60",
    );
    expect(() =>
      stepGame(state, neutralIntent, 1 / 60 + Number.EPSILON, arenaContent),
    ).toThrow("fixedDelta must equal 1 / 60");
  });

  it("moves at 4.2 units per second and clamps to the authored bounds", () => {
    const initial = createInitialState(1);
    const afterOneSecond = runTicks(
      initial,
      new Map(Array.from({ length: 60 }, (_, tick) => [tick, { moveY: 1 }])),
      60,
    ).state;
    const atNorthWall = runTicks(
      initial,
      new Map(Array.from({ length: 600 }, (_, tick) => [tick, { moveY: 1 }])),
      600,
    ).state;

    expect(afterOneSecond.player.position.x).toBe(0);
    expect(afterOneSecond.player.position.y).toBeCloseTo(-4.8, 10);
    expect(atNorthWall.player.position).toEqual({ x: 0, y: 12 });
  });

  it("normalizes diagonal input so it cannot move faster", () => {
    const state = runTicks(
      createInitialState(1),
      new Map(Array.from({ length: 60 }, (_, tick) => [tick, { moveX: 1, moveY: 1 }])),
      60,
    ).state;
    const displacement = Math.hypot(
      state.player.position.x,
      state.player.position.y + 9,
    );

    expect(displacement).toBeCloseTo(4.2, 10);
    expect(state.player.position.x).toBeCloseTo(2.9698484809835, 10);
    expect(state.player.position.y).toBeCloseTo(-6.0301515190165, 10);
  });

  it("starts a 0.24 second dodge at speed 9 and spends 24 stamina", () => {
    const first = stepGame(
      createInitialState(1),
      { ...neutralIntent, moveY: 1, dodgePressed: true },
      1 / 60,
      arenaContent,
    ).state;
    const beforeEnd = runTicks(first, new Map(), 13).state;
    const finished = stepGame(
      beforeEnd,
      neutralIntent,
      1 / 60,
      arenaContent,
    ).state;

    expect(first.player).toMatchObject({
      stamina: 76,
      action: "dodge",
      actionTime: 1 / 60,
    });
    expect(first.player.position.y).toBeCloseTo(-8.85, 10);
    expect(beforeEnd.player.action).toBe("dodge");
    expect(beforeEnd.player.actionTime).toBeCloseTo(14 / 60, 10);
    expect(finished.player).toMatchObject({ action: "idle", actionTime: 0 });
    expect(finished.player.position.y).toBeCloseTo(-6.84, 10);
  });

  it("rejects dodge without enough stamina", () => {
    const initial = createInitialState(1);
    initial.player.stamina = 23;

    const result = stepGame(
      initial,
      { ...neutralIntent, moveY: 1, dodgePressed: true },
      1 / 60,
      arenaContent,
    ).state;

    expect(result.player).toMatchObject({
      stamina: 23,
      action: "move",
      actionTime: 1 / 60,
    });
    expect(result.player.position.y).toBeCloseTo(-8.93, 10);
  });

  it("grants invulnerability only from 0.08 through 0.20 seconds of a dodge", () => {
    expect(
      isDodgeInvulnerable(
        { action: "dodge", actionTime: 0.079 },
        arenaContent,
      ),
    ).toBe(false);
    expect(
      isDodgeInvulnerable(
        { action: "dodge", actionTime: 0.08 },
        arenaContent,
      ),
    ).toBe(true);
    expect(
      isDodgeInvulnerable(
        { action: "dodge", actionTime: 0.2 },
        arenaContent,
      ),
    ).toBe(true);
    expect(
      isDodgeInvulnerable(
        { action: "dodge", actionTime: 0.201 },
        arenaContent,
      ),
    ).toBe(false);
    expect(
      isDodgeInvulnerable(
        { action: "move", actionTime: 0.12 },
        arenaContent,
      ),
    ).toBe(false);
  });

  it("toggles pause while advancing one tick and freezes gameplay until resumed", () => {
    const paused = stepGame(
      createInitialState(1),
      { ...neutralIntent, moveY: 1, pausePressed: true },
      1 / 60,
      arenaContent,
    ).state;
    const stillPaused = stepGame(
      paused,
      { ...neutralIntent, moveY: 1 },
      1 / 60,
      arenaContent,
    ).state;
    const resumed = stepGame(
      stillPaused,
      { ...neutralIntent, moveY: 1, pausePressed: true },
      1 / 60,
      arenaContent,
    ).state;
    const moving = stepGame(
      resumed,
      { ...neutralIntent, moveY: 1 },
      1 / 60,
      arenaContent,
    ).state;

    expect(paused).toMatchObject({ tick: 1, paused: true });
    expect(stillPaused).toMatchObject({ tick: 2, paused: true });
    expect(resumed).toMatchObject({ tick: 3, paused: false });
    expect(resumed.player.position).toEqual({ x: 0, y: -9 });
    expect(moving.player.position.y).toBeCloseTo(-8.93, 10);
  });

  it("does not mutate the old state, intent, or content and increments one tick", () => {
    const state = createInitialState(1);
    const stateSnapshot = structuredClone(state);
    const intent: GameIntent = { ...neutralIntent, moveX: 1 };
    const intentSnapshot = structuredClone(intent);
    const contentSnapshot = structuredClone(arenaContent);

    const result = stepGame(state, intent, 1 / 60, arenaContent);

    expect(state).toEqual(stateSnapshot);
    expect(intent).toEqual(intentSnapshot);
    expect(arenaContent).toEqual(contentSnapshot);
    expect(result.state.tick).toBe(state.tick + 1);
    expect(result.events).toEqual([]);
  });

  it("preserves unchanged state branches on a neutral tick", () => {
    const state = createInitialState(1);

    const result = stepGame(state, neutralIntent, 1 / 60, arenaContent).state;

    expect(result).not.toBe(state);
    expect(result.player).toBe(state.player);
    expect(result.enemies).toBe(state.enemies);
    expect(result.encounter).toBe(state.encounter);
    expect(result.drops).toBe(state.drops);
  });

  it("round-trips the state through JSON without losing information", () => {
    const state = runTicks(
      createInitialState(7481),
      new Map([
        [0, { moveX: 1 }],
        [1, { moveY: 1, dodgePressed: true }],
      ]),
      20,
    ).state;

    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});
