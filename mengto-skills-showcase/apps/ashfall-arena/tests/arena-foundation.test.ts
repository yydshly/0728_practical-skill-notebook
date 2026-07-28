import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import {
  ARENA_LEVEL,
  getArenaDiagnostics,
} from "../src/content/arena-level";
import { arenaContent } from "../src/content/arena-content";
import { resolveArenaMovement } from "../src/simulation/resolve-movement";
import { createGameCamera } from "../src/scene/create-game-camera";
import { resolveCameraOcclusion } from "../src/scene/resolve-camera-occlusion";
import {
  GamepadInputTracker,
  HeldInputOwnership,
  InputAccumulator,
  mapStandardGamepad,
} from "../src/input/create-input-adapter";

describe("authored flat arena contract", () => {
  it("keeps every gameplay anchor, zone, blocker, collision, and navigation point on y=0", () => {
    const diagnostics = getArenaDiagnostics();

    expect(ARENA_LEVEL).toMatchObject({
      width: 36,
      depth: 24,
      gameplayPlaneY: 0,
      anchors: {
        spawn: { id: "spawn", x: 0, z: -9 },
      },
    });
    expect(ARENA_LEVEL.zones.map(({ id, x, z, radius }) => ({
      id,
      x,
      z,
      radius,
    }))).toEqual([
      { id: "training", x: 0, z: -5, radius: 2 },
      { id: "wave", x: 0, z: 0, radius: 6 },
      { id: "elite", x: 0, z: 6, radius: 4 },
      { id: "boss", x: 0, z: 10, radius: 6 },
    ]);
    expect(diagnostics.outOfPlaneIds).toEqual([]);
    expect(diagnostics.walkableSlopes).toEqual([]);
    expect(diagnostics.interiorBlockerIds.length).toBeGreaterThanOrEqual(2);
    expect(diagnostics.layerIds.visual).not.toEqual(
      diagnostics.layerIds.collision,
    );
    expect(diagnostics.routeClearance.spawnToTraining).toBeGreaterThanOrEqual(
      2.2,
    );
    expect(diagnostics.routeClearance.trainingToBoss).toBeGreaterThanOrEqual(
      2.2,
    );
  });

  it("uses explicit collision primitives and lets encounter state open the boss gate", () => {
    const blocked = resolveArenaMovement(
      { x: 0, y: 7.4 },
      { x: 0, y: 8.6 },
      0.35,
      false,
      arenaContent.arena,
    );
    const opened = resolveArenaMovement(
      { x: 0, y: 7.4 },
      { x: 0, y: 8.6 },
      0.35,
      true,
      arenaContent.arena,
    );

    expect(blocked.y).toBeLessThan(8);
    expect(opened).toEqual({ x: 0, y: 8.6 });
  });

  it("associates every local light with a visible emitter", () => {
    const diagnostics = getArenaDiagnostics();

    expect(diagnostics.ambientLightIds).toEqual(["ambient-ash-sky"]);
    expect(diagnostics.localLights.length).toBeGreaterThanOrEqual(4);
    expect(
      diagnostics.localLights.every(
        ({ emitterId, attached, emitterVisible }) =>
          emitterId.length > 0 && attached && emitterVisible,
      ),
    ).toBe(true);
  });
});

describe("game camera", () => {
  it("measures real occlusion against the same collision data used by simulation", () => {
    const clearTarget = new Vector3(0, 1.05, -8.15);
    const clearDesired = new Vector3(7.8, 10.45, 1.65);
    const clear = resolveCameraOcclusion(
      clearTarget,
      clearDesired,
      arenaContent.arena.collisions,
      false,
    );
    expect(clear.occluderId).toBeNull();
    expect(clear.distance).toBeCloseTo(
      clearTarget.distanceTo(clearDesired),
      10,
    );

    const blockedTarget = new Vector3(0, 1.05, -4.15);
    const blockedDesired = new Vector3(7.8, 10.45, 5.65);
    const blocked = resolveCameraOcclusion(
      blockedTarget,
      blockedDesired,
      arenaContent.arena.collisions,
      false,
    );
    expect(blocked.occluderId).toBe("collision-east-brazier-bank");
    expect(blocked.distance).toBeLessThan(
      blockedTarget.distanceTo(blockedDesired),
    );
    expect(blocked.distance).toBeGreaterThan(5.5);
  });

  it("returns a finite pushed-out distance when the camera target starts inside a blocker", () => {
    const eastTarget = new Vector3(5, 1.05, 2.05);
    const eastDesired = new Vector3(12.8, 10.45, 11.85);
    const east = resolveCameraOcclusion(
      eastTarget,
      eastDesired,
      arenaContent.arena.collisions,
      false,
    );

    expect(east.occluderId).toBe("collision-east-brazier-bank");
    expect(Number.isFinite(east.distance)).toBe(true);
    expect(east.distance).toBeGreaterThan(0);
    expect(east.distance).toBeLessThan(eastTarget.distanceTo(eastDesired));

    const northTarget = new Vector3(0, 1.05, 11.8);
    const northDesired = new Vector3(7.8, 10.45, 21.6);
    const north = resolveCameraOcclusion(
      northTarget,
      northDesired,
      arenaContent.arena.collisions,
      false,
    );

    expect(north.occluderId).toBe("collision-north");
    expect(Number.isFinite(north.distance)).toBe(true);
    expect(north.distance).toBeGreaterThan(0);
    expect(north.distance).toBeLessThan(
      northTarget.distanceTo(northDesired),
    );

    const cornerTarget = new Vector3(17.9, 1, 11.9);
    const cornerDesired = new Vector3(25.7, 10.4, 21.7);
    const corner = resolveCameraOcclusion(
      cornerTarget,
      cornerDesired,
      arenaContent.arena.collisions,
      false,
    );

    expect(corner.occluderId).toBe("collision-north");
    expect(Number.isFinite(corner.distance)).toBe(true);
    expect(corner.distance).toBeGreaterThan(0);
    expect(corner.distance).toBeLessThan(
      cornerTarget.distanceTo(cornerDesired),
    );
  });

  it("follows with independent smoothing, world bounds, and a safe obstacle distance", () => {
    const camera = new PerspectiveCamera(42, 16 / 9, 0.1, 100);
    const controller = createGameCamera(camera, {
      bounds: { minX: -18, maxX: 18, minZ: -12, maxZ: 12 },
      resolveDistance: () => 2,
    });

    controller.snapTo(new Vector3(17.8, 0, 11.8));
    controller.update(new Vector3(19, 0, 14), 1 / 60);
    const diagnostics = controller.getDiagnostics();

    expect(diagnostics.target.x).toBeLessThanOrEqual(18);
    expect(diagnostics.target.z).toBeLessThanOrEqual(12);
    expect(diagnostics.distance).toBeCloseTo(5.5, 10);
    expect(diagnostics.position.equals(diagnostics.target)).toBe(false);
    controller.dispose();
  });

  it("frames lock targets and bounds shake while reduced motion removes it", () => {
    const camera = new PerspectiveCamera(42, 16 / 9, 0.1, 100);
    const controller = createGameCamera(camera);
    const player = new Vector3(-2, 0, 1);
    const target = new Vector3(4, 0, 5);

    controller.snapTo(player);
    controller.setLockTarget(target);
    for (let index = 0; index < 5; index += 1) {
      controller.update(player, 0.1);
    }
    expect(controller.getDiagnostics().target.x).toBeCloseTo(1, 1);
    expect(controller.getDiagnostics().lockFraming).toBe(true);

    expect(controller.shake(9, 4)).toEqual({
      amplitude: 0.24,
      duration: 0.45,
    });
    controller.setReducedMotion(true);
    expect(controller.shake(1, 1)).toEqual({ amplitude: 0, duration: 0 });
    expect(controller.getDiagnostics().reducedMotion).toBe(true);
    controller.dispose();
  });
});

describe("normalized device input", () => {
  it("keeps held input owned by the last meaningful device", () => {
    const held = new HeldInputOwnership();

    held.activate("keyboard-mouse");
    expect(held.setGuard("keyboard-mouse", true)).toBe(true);
    expect(held.setGuard("gamepad", false)).toBe(true);
    expect(held.setGuard("gamepad", false)).toBe(true);
    expect(held.getDeviceMode()).toBe("keyboard-mouse");
    expect(held.setGuard("keyboard-mouse", false)).toBe(false);

    held.setGuard("touch", true);
    expect(held.activate("touch")).toBe(true);
    expect(held.setGuard("gamepad", false)).toBe(true);
    expect(held.setGuard("touch", false)).toBe(false);

    held.setGuard("gamepad", true);
    expect(held.activate("gamepad")).toBe(true);
    expect(held.setGuard("gamepad", false)).toBe(false);
    expect(held.getDeviceMode()).toBe("gamepad");

    held.setGuard("keyboard-mouse", true);
    expect(held.activate("keyboard-mouse")).toBe(true);
    expect(held.setGuard("gamepad", false)).toBe(true);
    expect(held.getDeviceMode()).toBe("keyboard-mouse");
  });

  it("emits edge actions once and clears all state on interruption", () => {
    const input = new InputAccumulator();
    input.setMove(2, -2);
    input.setHeld("guardHeld", true);
    input.press("attackPressed");
    input.press("dodgePressed");

    const first = input.sample();
    expect(first).toMatchObject({
      attackPressed: true,
      dodgePressed: true,
      guardHeld: true,
    });
    expect(first.moveX).toBeCloseTo(Math.SQRT1_2, 12);
    expect(first.moveY).toBeCloseTo(-Math.SQRT1_2, 12);
    expect(input.sample()).toMatchObject({
      attackPressed: false,
      dodgePressed: false,
      guardHeld: true,
    });

    input.clear();
    expect(input.sample()).toEqual({
      moveX: 0,
      moveY: 0,
      attackPressed: false,
      guardHeld: false,
      dodgePressed: false,
      lockPressed: false,
      healPressed: false,
      switchWeaponPressed: false,
      pausePressed: false,
    });
  });

  it("maps the complete standard gamepad vocabulary", () => {
    const intent = mapStandardGamepad({
      axes: [0.6, -0.8],
      buttons: Array.from({ length: 16 }, (_, index) => ({
        pressed: [0, 1, 3, 9, 10, 14].includes(index),
        value: index === 6 ? 0.9 : 0,
      })),
    });

    expect(intent).toEqual({
      moveX: 0.6,
      moveY: 0.8,
      attackPressed: true,
      guardHeld: true,
      dodgePressed: true,
      lockPressed: true,
      healPressed: true,
      switchWeaponPressed: true,
      pausePressed: true,
    });
  });

  it("writes centered axes every frame and keeps gamepad edges single-shot", () => {
    const tracker = new GamepadInputTracker();
    const buttons = Array.from({ length: 16 }, (_, index) => ({
      pressed: index === 0,
      value: index === 0 ? 1 : 0,
    }));
    const moving = tracker.update({ axes: [0, -1], buttons });
    const centered = tracker.update({ axes: [0, 0], buttons });

    expect(moving).toMatchObject({ moveX: 0, moveY: 1, attackPressed: true });
    expect(centered).toMatchObject({
      moveX: 0,
      moveY: 0,
      attackPressed: false,
    });
    expect(tracker.disconnect()).toEqual({
      moveX: 0,
      moveY: 0,
      attackPressed: false,
      guardHeld: false,
      dodgePressed: false,
      lockPressed: false,
      healPressed: false,
      switchWeaponPressed: false,
      pausePressed: false,
    });
  });
});
