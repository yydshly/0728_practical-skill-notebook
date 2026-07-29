import { Scene } from "three";
import { describe, expect, it } from "vitest";
import { createVfx } from "../src/feedback/create-vfx";
import { createInitialState } from "../src/simulation/create-initial-state";
import { createEncounterEnemy } from "../src/simulation/encounters";
import type { GameEvent } from "../src/simulation/types";

const playerDamage = (index: number): GameEvent => ({
  type: "damage",
  targetId: "player",
  amount: index >= 0 ? 1 : 2,
  guarded: false,
});

describe("bounded combat feedback", () => {
  it("caps rapid hit effects and pauses their presentation clock", () => {
    const scene = new Scene();
    const vfx = createVfx(scene, { reducedMotion: false, quality: "high" });
    const state = createInitialState(1);

    vfx.consume(
      Array.from({ length: 100 }, (_, index) => playerDamage(index)),
      state,
    );

    const saturated = vfx.getDiagnostics();
    expect(saturated.pools.hitSparks).toEqual({
      active: 12,
      capacity: 12,
    });
    expect(saturated.totalActive).toBe(12);

    vfx.update(0.1, true);
    expect(vfx.getDiagnostics().totalActive).toBe(12);
    vfx.update(1, false);
    expect(vfx.getDiagnostics().totalActive).toBe(0);
  });

  it("keeps reduced-motion damage meaning while disabling displacement", () => {
    const scene = new Scene();
    const vfx = createVfx(scene, { reducedMotion: true, quality: "low" });
    const state = createInitialState(2);

    vfx.consume([playerDamage(1)], state);

    const diagnostics = vfx.getDiagnostics();
    expect(diagnostics).toMatchObject({
      reducedMotion: true,
      damageFlashActive: true,
      particleDisplacement: false,
    });
    expect(diagnostics.pools.hitSparks.active).toBeGreaterThan(0);
    expect(diagnostics.pools.hitSparks.capacity).toBe(12);
  });

  it("resets and disposes every preallocated pool idempotently", () => {
    const scene = new Scene();
    const baselineChildren = scene.children.length;
    const vfx = createVfx(scene, { reducedMotion: false, quality: "high" });
    const state = createInitialState(3);

    vfx.consume([playerDamage(1)], state);
    vfx.reset();
    vfx.reset();
    expect(vfx.getDiagnostics().totalActive).toBe(0);

    vfx.dispose();
    vfx.dispose();
    expect(scene.children).toHaveLength(baselineChildren);
    expect(vfx.getDiagnostics()).toMatchObject({
      disposed: true,
      totalActive: 0,
    });
  });

  it.each([
    ["+X", { x: 8, y: 0 }],
    ["-X", { x: -8, y: 0 }],
    ["+Z", { x: 0, y: 8 }],
    ["-Z", { x: 0, y: -8 }],
    ["diagonal", { x: 4, y: -4 }],
  ])(
    "orients and moves a %s trace from authoritative projectile velocity",
    (_label, velocity) => {
      const scene = new Scene();
      const vfx = createVfx(scene, {
        reducedMotion: false,
        quality: "high",
      });
      const state = createInitialState(4);
      const event = {
        type: "enemy-projectile-spawned",
        projectileId: `projectile-${_label}`,
        attackId: `attack-${_label}`,
        ownerId: "warden-a",
        position: { x: 2, y: -3 },
        velocity,
      } as unknown as GameEvent;

      vfx.consume([event], state);
      const before = vfx.getDiagnostics() as unknown as {
        projectileTraces: Array<{
          projectileId: string;
          position: { x: number; z: number };
          velocity: { x: number; z: number };
          rotationY: number;
        }>;
      };
      expect(before.projectileTraces).toHaveLength(1);
      expect(before.projectileTraces[0]).toMatchObject({
        projectileId: `projectile-${_label}`,
        position: { x: 2, z: -3 },
        velocity: { x: velocity.x, z: velocity.y },
      });
      expect(before.projectileTraces[0]!.rotationY).toBeCloseTo(
        -Math.atan2(velocity.y, velocity.x),
        10,
      );

      vfx.update(0.1, false);
      const after = vfx.getDiagnostics() as unknown as typeof before;
      expect(after.projectileTraces[0]!.position.x).toBeCloseTo(
        2 + velocity.x * 0.1,
        10,
      );
      expect(after.projectileTraces[0]!.position.z).toBeCloseTo(
        -3 + velocity.y * 0.1,
        10,
      );
      vfx.dispose();
    },
  );

  it("creates dodge feedback only from the fixed-step action event", () => {
    const scene = new Scene();
    const vfx = createVfx(scene, { reducedMotion: false, quality: "high" });
    const state = createInitialState(5);
    state.player.action = "dodge";

    vfx.sync(state);
    expect(vfx.getDiagnostics().pools.dodgeTrails.active).toBe(0);

    vfx.consume([
      {
        type: "action-started",
        actorId: "player",
        actionId: "dodge",
        attackId: "player:dodge:0",
        tick: 0,
      } as unknown as GameEvent,
    ], state);
    expect(vfx.getDiagnostics().pools.dodgeTrails.active).toBe(3);
    vfx.dispose();
  });

  it.each([false, true])(
    "keeps the sovereign active ring bounded and readable when reducedMotion=%s",
    (reducedMotion) => {
      const scene = new Scene();
      const vfx = createVfx(scene, {
        reducedMotion,
        quality: "high",
      });
      const state = createInitialState(6);
      state.enemies["boss-sovereign"] = createEncounterEnemy(
        "boss-sovereign",
        "bell-sovereign",
        { x: 0, y: 8 },
      );
      vfx.consume(
        Array.from({ length: 10 }, (_, index) => ({
          type: "enemy-move-active" as const,
          enemyId: "boss-sovereign",
          moveId: "sovereign-shockwave" as const,
          attackId: `boss-sovereign:sovereign-shockwave:${index}`,
        })),
        state,
      );

      expect(vfx.getDiagnostics()).toMatchObject({
        reducedMotion,
        particleDisplacement: !reducedMotion,
        pools: {
          bossShockwaves: {
            active: 4,
            capacity: 4,
          },
        },
      });

      vfx.sync({
        ...state,
        encounter: { ...state.encounter, phase: "boss" },
      });
      expect(vfx.getDiagnostics().pools.bossShockwaves.active).toBe(0);
      vfx.dispose();
    },
  );

  it("does not leave a visual effect when an attack is interrupted", () => {
    const scene = new Scene();
    const vfx = createVfx(scene, { reducedMotion: false, quality: "high" });
    const state = createInitialState(7);

    vfx.consume([
      {
        type: "attack-resolved",
        actorId: "player",
        actionId: "oathblade-light-1",
        attackId: "player:0:0",
        result: "interrupted",
        reason: "damage",
      },
    ], state);

    expect(vfx.getDiagnostics().totalActive).toBe(0);
    vfx.dispose();
  });
});
