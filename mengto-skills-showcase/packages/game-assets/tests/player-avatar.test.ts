import { Box3, Mesh } from "three";
import { expect, it, vi } from "vitest";
import { createVesperKnight } from "../src/player/create-vesper-knight";

it("creates an original procedural knight with stable equipment sockets", () => {
  const knight = createVesperKnight();

  expect([...knight.sockets.keys()]).toEqual([
    "right-hand",
    "left-hand",
    "back",
  ]);
  expect(knight.root.userData.provenance).toEqual({
    type: "procedural",
    factoryId: "create-vesper-knight",
    source: "project-authored Three.js primitives",
    importedFiles: "none",
  });
  expect(knight.root.getObjectByName("oathblade-placeholder")).toBeTruthy();
  expect(knight.root.getObjectByName("ember-bow-placeholder")).toBeTruthy();

  knight.dispose();
});

it("grounds its authored visual footprint on the gameplay plane", () => {
  const knight = createVesperKnight();
  const bounds = new Box3().setFromObject(knight.root);

  expect(bounds.min.y).toBeCloseTo(0, 6);
  expect(knight.root.userData.collider).toEqual({
    shape: "capsule",
    radius: 0.35,
    height: 2.65,
    gameplayPlaneY: 0,
  });
  knight.dispose();
});

it("reparents equipped weapons between real hand and back sockets", () => {
  const knight = createVesperKnight();
  const oathblade = knight.root.getObjectByName("oathblade-placeholder")!;
  const bow = knight.root.getObjectByName("ember-bow-placeholder")!;

  expect(oathblade.parent).toBe(knight.sockets.get("right-hand"));
  expect(bow.parent).toBe(knight.sockets.get("back"));

  knight.equipWeapon("ember-bow");
  expect(bow.parent).toBe(knight.sockets.get("left-hand"));
  expect(oathblade.parent).toBe(knight.sockets.get("back"));
  expect(knight.root.userData.equippedWeapon).toBe("ember-bow");

  knight.equipWeapon("ember-bow");
  expect(bow.parent).toBe(knight.sockets.get("left-hand"));
  expect(oathblade.parent).toBe(knight.sockets.get("back"));

  knight.equipWeapon("oathblade");
  expect(oathblade.parent).toBe(knight.sockets.get("right-hand"));
  expect(bow.parent).toBe(knight.sockets.get("back"));
  knight.dispose();
});

it("releases every owned geometry and material exactly once", () => {
  const knight = createVesperKnight();
  const spies = knight.root
    .getObjectsByProperty("isMesh", true)
    .flatMap((object) => {
      const mesh = object as Mesh;
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      return [
        vi.spyOn(mesh.geometry, "dispose"),
        ...materials.map((material) => vi.spyOn(material, "dispose")),
      ];
    });

  knight.dispose();
  knight.dispose();

  expect(knight.isDisposed()).toBe(true);
  expect(spies.length).toBeGreaterThan(10);
  expect(spies.every((spy) => spy.mock.calls.length === 1)).toBe(true);
});
