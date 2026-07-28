import { Mesh } from "three";
import { describe, expect, it, vi } from "vitest";
import { monsters } from "../src/monsters/definitions";
import { createProceduralMonster } from "../src/monsters/create-procedural-monster";

describe("createProceduralMonster", () => {
  it.each(monsters)("builds $factoryId with its declared sockets and an independent collider", (definition) => {
    const instance = createProceduralMonster(definition);

    expect(instance.root.userData.provenance).toMatchObject({
      type: "procedural",
      factoryId: definition.factoryId,
      source: "runtime factory shipped; catalog PNG not shipped",
    });
    expect(instance.root.children.map((child) => child.name)).toContain("motion");
    expect(instance.root.getObjectByName("body")).toBeTruthy();
    expect([...instance.sockets.keys()]).toEqual(expect.arrayContaining(definition.sockets.map(({ name }) => name)));
    expect(instance.sockets.get("ground")?.parent?.name).toBe("root");
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
