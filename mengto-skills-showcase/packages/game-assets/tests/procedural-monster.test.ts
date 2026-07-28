import { Box3, Mesh, Vector3 } from "three";
import { describe, expect, it, vi } from "vitest";
import { monsters } from "../src/monsters/definitions";
import {
  createProceduralMonster,
  type MonsterInstance,
} from "../src/monsters/create-procedural-monster";
import { MONSTER_ACTION_DURATIONS } from "../src/monsters/types";

const expectedGroundOffsets = {
  "ash-warden": -0.6,
  "glass-crawler": -0.21,
  "bell-knight": -0.53,
  "mire-hound": -0.24,
} as const;

const expectedPoseJoints = {
  biped: {
    Idle: "spine",
    Walk: "hip-l",
    Attack: "shoulder-r",
    Hit: "spine",
    Death: "spine",
  },
  crawler: {
    Idle: "thorax",
    Walk: "leg-1-l-1",
    Attack: "jaw",
    Hit: "thorax",
    Death: "thorax",
  },
  armored: {
    Idle: "chest",
    Walk: "hip-l",
    Attack: "chest",
    Hit: "chest",
    Death: "chest",
  },
  quadruped: {
    Idle: "spine",
    Walk: "front-leg-l-1",
    Attack: "jaw",
    Hit: "spine",
    Death: "spine",
  },
} as const;

const advance = (instance: MonsterInstance, seconds: number) => {
  let remaining = seconds;
  while (remaining > 1e-9) {
    const step = Math.min(remaining, 0.05);
    instance.update(step);
    remaining -= step;
  }
};

const rootLocalY = (instance: MonsterInstance, object: object) => {
  instance.root.updateMatrixWorld(true);
  const world = (object as import("three").Object3D).getWorldPosition(new Vector3());
  return instance.root.worldToLocal(world).y;
};

describe("createProceduralMonster", () => {
  it.each(monsters)("builds $factoryId with its declared sockets and an independent collider", (definition) => {
    const instance = createProceduralMonster(definition);

    expect(instance.root.userData.provenance).toMatchObject({
      type: "procedural",
      factoryId: definition.factoryId,
      source: "runtime factory shipped; catalog PNG recapture required after grounding and animation revision",
    });
    expect(instance.root.userData.source).not.toContain("catalog PNG not shipped");
    expect(instance.root.userData.review).toMatchObject({
      factoryId: definition.factoryId,
      actionCount: definition.actions.length,
      socketNames: definition.sockets.map(({ name }) => name),
      dimensions: definition.bounds,
      groundOffset: definition.bounds.groundOffset,
      catalogPreviewStatus: "recapture-required",
      importedFiles: "none",
    });
    expect(instance.root.children.map((child) => child.name)).toContain("motion");
    expect(instance.root.getObjectByName("body")).toBeTruthy();
    expect([...instance.sockets.keys()]).toEqual(expect.arrayContaining(definition.sockets.map(({ name }) => name)));
    expect(instance.sockets.get("ground")?.parent?.name).toBe("ground-contact");
    expect(instance.collider.root.parent).toBeNull();
    expect(instance.collider.root.userData).toMatchObject({
      layer: "solid",
      ownerId: definition.id,
      size: { radius: definition.collider.radius, height: definition.collider.height },
    });
    expect(instance.root.getObjectByProperty("uuid", instance.collider.root.uuid)).toBeUndefined();
    expect(instance.root.getObjectsByProperty("isMesh", true).every((node) => node !== instance.collider.root)).toBe(true);

    instance.dispose();
  });

  it.each([
    ["ash-warden", ["foot-l", "foot-r"]],
    ["glass-crawler", ["foot-1-l", "foot-1-r", "foot-2-l", "foot-2-r", "foot-3-l", "foot-3-r"]],
    ["bell-knight", ["foot-l", "foot-r"]],
    ["mire-hound", ["front-foot-l", "front-foot-r", "rear-foot-l", "rear-foot-r"]],
  ] as const)("exposes immutable semantic ground contacts for %s", (monsterId, expectedNames) => {
    const definition = monsters.find(({ id }) => id === monsterId)!;
    const instance = createProceduralMonster(definition);

    expect(instance.groundContacts.map(({ name }) => name)).toEqual(expectedNames);
    expect(Object.isFrozen(instance.groundContacts)).toBe(true);
    expect(instance.groundContacts.every(({ name, joint }) => joint === instance.joints.get(name))).toBe(true);

    instance.dispose();
  });

  it.each(monsters)("keeps $id grounded through deterministic Idle and Walk samples", (definition) => {
    const groundOffset = expectedGroundOffsets[definition.id];
    expect(definition.bounds.groundOffset).toBe(groundOffset);

    for (const action of ["Idle", "Walk"] as const) {
      const duration = definition.animations.find(({ name }) => name === action)!.durationSeconds;
      for (const progress of [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1]) {
        const instance = createProceduralMonster(definition);
        instance.playAction(action);
        advance(instance, duration * progress);
        const contactYs = instance.groundContacts.map(({ joint }) => rootLocalY(instance, joint));
        const soleMins = instance.groundContacts.map(({ name }) =>
          new Box3().setFromObject(instance.root.getObjectByName(`${name}-visual`)!).min.y,
        );

        expect(Math.min(...contactYs)).toBeCloseTo(groundOffset, 5);
        expect(contactYs.every((y) => y >= groundOffset - 1e-6)).toBe(true);
        expect(Math.min(...soleMins)).toBeCloseTo(groundOffset, 5);
        expect(soleMins.every((y) => y >= groundOffset - 1e-6)).toBe(true);
        expect(rootLocalY(instance, instance.sockets.get("ground")!)).toBeCloseTo(groundOffset, 5);
        instance.dispose();
      }
    }
  });

  it("uses one duration contract in every manifest and runtime boundary", () => {
    expect(MONSTER_ACTION_DURATIONS).toEqual({
      Idle: 2,
      Walk: 1,
      Attack: 0.8,
      Hit: 0.45,
      Death: 1.4,
    });

    for (const definition of monsters) {
      expect(Object.fromEntries(definition.animations.map(({ name, durationSeconds }) => [name, durationSeconds])))
        .toEqual(MONSTER_ACTION_DURATIONS);

      for (const { name, durationSeconds } of definition.animations) {
        const instance = createProceduralMonster(definition);
        instance.playAction(name);
        advance(instance, durationSeconds - 0.001);
        expect(instance.getActionState().completed).toBe(false);
        advance(instance, 0.001);
        const state = instance.getActionState();
        if (name === "Idle" || name === "Walk") {
          expect(state.elapsed).toBeCloseTo(0, 6);
          expect(state.completed).toBe(false);
        } else {
          expect(state.elapsed).toBeCloseTo(durationSeconds, 6);
          expect(state.completed).toBe(true);
        }
        instance.dispose();
      }
    }
  });

  it.each(monsters)("moves real $factoryId joints at every action midpoint and holds Death", (definition) => {
    const poseJoints = expectedPoseJoints[definition.factoryId];
    for (const action of definition.actions) {
      const instance = createProceduralMonster(definition);
      const joint = instance.joints.get(poseJoints[action])!;
      const restRotation = joint.quaternion.clone();
      const duration = definition.animations.find(({ name }) => name === action)!.durationSeconds;

      instance.playAction(action);
      advance(instance, duration / 2);
      expect(joint.quaternion.angleTo(restRotation)).toBeGreaterThan(1e-4);
      instance.dispose();
    }

    const death = createProceduralMonster(definition);
    const deathJoint = death.joints.get(poseJoints.Death)!;
    death.playAction("Death");
    advance(death, MONSTER_ACTION_DURATIONS.Death);
    const finalRotation = deathJoint.quaternion.clone();
    death.update(0.05);
    expect(deathJoint.quaternion.angleTo(finalRotation)).toBeLessThan(1e-8);
    expect(death.getActionState()).toEqual({
      name: "Death",
      elapsed: MONSTER_ACTION_DURATIONS.Death,
      progress: 1,
      completed: true,
    });
    death.dispose();
  });

  it("keeps joint chains parented and switches four recognizably different recipes", () => {
    const instances = monsters.map(createProceduralMonster);
    const bodySignatures = instances.map((instance) =>
      instance.root
        .getObjectByName("body")!
        .children.map((child) => child.name)
        .sort()
        .join(","),
    );

    expect(new Set(bodySignatures).size).toBe(4);
    expect(instances[0].joints.get("shoulder-r")?.parent?.name).toBe("spine");
    expect(instances[0].joints.get("elbow-r")?.parent?.name).toBe("shoulder-r");
    expect(instances[1].joints.get("leg-1-r-2")?.parent?.name).toBe("leg-1-r-1");
    expect(instances[3].joints.get("front-leg-r-2")?.parent?.name).toBe("front-leg-r-1");

    instances.forEach((instance) => instance.dispose());
  });

  it("clamps deltas, loops locomotion, holds terminal review actions, and honours pause", () => {
    const instance = createProceduralMonster(monsters[0]);

    instance.playAction("Attack");
    for (let index = 0; index < 16; index += 1) instance.update(2);
    expect(instance.getActionState()).toEqual({ name: "Attack", elapsed: 0.8, progress: 1, completed: true });

    instance.playAction("Walk");
    instance.update(0.05);
    instance.update(0.05);
    expect(instance.getActionState()).toEqual({ name: "Walk", elapsed: 0.1, progress: 0.1, completed: false });
    instance.setPaused(true);
    instance.update(0.05);
    expect(instance.getActionState().elapsed).toBe(0.1);

    instance.setPaused(false);
    instance.playAction("Death");
    for (let index = 0; index < 28; index += 1) instance.update(0.05);
    expect(instance.getActionState()).toEqual({ name: "Death", elapsed: 1.4, progress: 1, completed: true });
    instance.dispose();
  });

  it("resets the previous pose on action changes and rejects invalid or disposed calls clearly", () => {
    const instance = createProceduralMonster(monsters[0]);
    const spine = instance.joints.get("spine")!;

    instance.playAction("Attack");
    instance.update(0.05);
    expect(spine.rotation.x).not.toBe(0);
    instance.playAction("Idle");
    expect(spine.rotation.x).toBe(0);
    expect(() => instance.playAction("Dance" as never)).toThrow("Unknown monster action: Dance");

    instance.dispose();
    expect(() => instance.update(0.01)).toThrow("Monster instance is disposed");
    expect(() => instance.getActionState()).toThrow("Monster instance is disposed");
  });

  it("disposes every tracked visual resource exactly once for every recipe", () => {
    for (const definition of monsters) {
      const instance = createProceduralMonster(definition);
      const disposeSpies = instance.root
        .getObjectsByProperty("isMesh", true)
        .flatMap((node) => {
          const mesh = node as Mesh;
          return [vi.spyOn(mesh.geometry, "dispose"), vi.spyOn(mesh.material, "dispose")];
        });

      instance.dispose();
      instance.dispose();
      expect(disposeSpies.every((spy) => spy.mock.calls.length === 1)).toBe(true);
    }
  });

});
