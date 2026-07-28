import { Scene } from "three";
import { describe, expect, it } from "vitest";
import { createVfx } from "../src/feedback/create-vfx";
import { createInitialState } from "../src/simulation/create-initial-state";
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
});
