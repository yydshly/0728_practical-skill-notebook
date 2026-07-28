import { Box3, Group, Mesh, MeshStandardMaterial } from "three";
import { describe, expect, it, vi } from "vitest";
import {
  MECH_VISUAL_CATALOG,
  defaultMechFinish,
} from "../src/mechs/catalog";
import { createMechAssembly } from "../src/mechs/create-mech-assembly";
import type {
  MechFinish,
  MechPartSlot,
  MechVisualConfiguration,
} from "../src/mechs/types";

const visualConfiguration = {
  chassisId: "strider-scout",
  headId: "surveyor-head",
  armorId: "ceramic-shell",
  leftWeaponId: "arc-blade",
  rightWeaponId: "drone-rack",
  rearModuleId: "jump-pack",
  finish: {
    primary: "#7a2f24",
    secondary: "#d8b36a",
    metalness: 0.5,
    roughness: 0.6,
  },
} as const satisfies MechVisualConfiguration;

const expectedSlots = [
  "chassis",
  "head",
  "armor",
  "leftWeapon",
  "rightWeapon",
  "rearModule",
] as const satisfies readonly MechPartSlot[];

function meshes(root: Group): Mesh[] {
  const result: Mesh[] = [];
  root.traverse((object) => {
    if (object instanceof Mesh) result.push(object);
  });
  return result;
}

function uniqueResources(root: Group) {
  const geometries = new Set(meshes(root).map((mesh) => mesh.geometry));
  const materials = new Set(
    meshes(root).flatMap((mesh) =>
      Array.isArray(mesh.material) ? mesh.material : [mesh.material],
    ),
  );
  return { geometries, materials };
}

describe("procedural mech assembly contract", () => {
  it("creates ordered named parts, sockets, hotspots, and truthful provenance", () => {
    const assembly = createMechAssembly(visualConfiguration);

    expect([...assembly.parts.keys()]).toEqual(expectedSlots);
    expect([...assembly.sockets.keys()]).toEqual([
      "head",
      "armor",
      "leftWeapon",
      "rightWeapon",
      "rearModule",
    ]);
    expect([...assembly.hotspots.keys()]).toEqual(
      expect.arrayContaining(["head", "leftWeapon", "rightWeapon", "rearModule"]),
    );
    for (const slot of expectedSlots.slice(1)) {
      const part = assembly.parts.get(slot);
      const socket = assembly.sockets.get(slot);
      expect(part?.parent).toBe(socket);
      expect(socket?.name).toBe(`socket-${slot}`);
    }
    expect(assembly.root.userData.provenance).toEqual({
      type: "procedural",
      description: "Project-authored Three.js geometry",
    });
    expect(assembly.root.userData.coordinateSystem).toEqual({
      upAxis: "+Y",
      forwardAxis: "+Z",
      groundPlaneY: 0,
    });

    assembly.dispose();
  });

  it("exposes all approved part IDs and no remote asset sources", () => {
    expect(MECH_VISUAL_CATALOG).toEqual({
      chassis: ["strider-scout", "bastion-hauler", "oracle-frame"],
      head: ["surveyor-head", "bulwark-head", "halo-head"],
      armor: ["ceramic-shell", "reactive-bastion", "void-weave"],
      leftWeapon: ["arc-blade", "aegis-shield", "drone-rack"],
      rightWeapon: ["arc-blade", "rail-lance", "drone-rack"],
      rearModule: ["jump-pack", "siege-reactor", "field-relay"],
    });

    const assembly = createMechAssembly(visualConfiguration);
    expect(assembly.root.userData.importedFiles).toBe("none");
    for (const mesh of meshes(assembly.root)) {
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      expect(materials.every((material) => !("map" in material) || material.map == null)).toBe(true);
    }
    assembly.dispose();
  });

  it("creates every approved combination with finite grounded bounds and consistent axes", () => {
    let count = 0;

    for (const chassisId of MECH_VISUAL_CATALOG.chassis) {
      for (const headId of MECH_VISUAL_CATALOG.head) {
        for (const armorId of MECH_VISUAL_CATALOG.armor) {
          for (const leftWeaponId of MECH_VISUAL_CATALOG.leftWeapon) {
            for (const rightWeaponId of MECH_VISUAL_CATALOG.rightWeapon) {
              for (const rearModuleId of MECH_VISUAL_CATALOG.rearModule) {
                const assembly = createMechAssembly({
                  chassisId,
                  headId,
                  armorId,
                  leftWeaponId,
                  rightWeaponId,
                  rearModuleId,
                  finish: visualConfiguration.finish,
                });
                const bounds = new Box3().setFromObject(assembly.root);
                expect(
                  [...bounds.min.toArray(), ...bounds.max.toArray()].every(
                    Number.isFinite,
                  ),
                ).toBe(true);
                expect(bounds.isEmpty()).toBe(false);
                expect(bounds.min.y).toBeCloseTo(0, 6);
                expect(assembly.root.position.toArray()).toEqual([0, 0, 0]);
                count += 1;
                assembly.dispose();
              }
            }
          }
        }
      }
    }

    expect(count).toBe(729);
  }, 20_000);

  it("replaces only the changed module and disposes its old owned resources once", () => {
    const assembly = createMechAssembly(visualConfiguration);
    const oldParts = new Map(assembly.parts);
    const oldHead = assembly.parts.get("head")!;
    const oldResources = uniqueResources(oldHead);
    const geometrySpies = [...oldResources.geometries].map((resource) =>
      vi.spyOn(resource, "dispose"),
    );
    const materialSpies = [...oldResources.materials].map((resource) =>
      vi.spyOn(resource, "dispose"),
    );

    assembly.updateConfiguration({
      ...visualConfiguration,
      headId: "bulwark-head",
    });

    expect(assembly.parts.get("head")).not.toBe(oldHead);
    expect(oldHead.parent).toBeNull();
    for (const slot of expectedSlots.filter((slot) => slot !== "head")) {
      expect(assembly.parts.get(slot)).toBe(oldParts.get(slot));
    }
    expect(geometrySpies.every((spy) => spy.mock.calls.length === 1)).toBe(true);
    expect(materialSpies.every((spy) => spy.mock.calls.length === 1)).toBe(true);

    assembly.dispose();
  });

  it("replaces a chassis socket frame without rebuilding unchanged modules", () => {
    const assembly = createMechAssembly(visualConfiguration);
    const oldChassis = assembly.parts.get("chassis");
    const oldHead = assembly.parts.get("head");
    const oldHeadSocket = assembly.sockets.get("head");
    const oldHeadHotspot = assembly.hotspots.get("head");

    assembly.updateConfiguration({
      ...visualConfiguration,
      chassisId: "bastion-hauler",
    });

    expect(assembly.parts.get("chassis")).not.toBe(oldChassis);
    expect(assembly.parts.get("head")).toBe(oldHead);
    expect(assembly.sockets.get("head")).not.toBe(oldHeadSocket);
    expect(oldHead?.parent).toBe(assembly.sockets.get("head"));
    expect(assembly.hotspots.get("head")).toBe(oldHeadHotspot);
    assembly.dispose();
  });

  it("updates hotspot references when their part is replaced", () => {
    const assembly = createMechAssembly(visualConfiguration);
    const oldHotspot = assembly.hotspots.get("rearModule");

    assembly.updateConfiguration({
      ...visualConfiguration,
      rearModuleId: "field-relay",
    });

    const currentPart = assembly.parts.get("rearModule")!;
    const currentHotspot = assembly.hotspots.get("rearModule");
    expect(currentHotspot).not.toBe(oldHotspot);
    expect(currentHotspot).toBe(currentPart.getObjectByName("hotspot-rearModule"));
    assembly.dispose();
  });

  it("applies an isolated finish in place and does not mutate catalog defaults", () => {
    const first = createMechAssembly(visualConfiguration);
    const second = createMechAssembly(visualConfiguration);
    const firstResources = uniqueResources(first.root);
    const secondPrimary = meshes(second.root)
      .map((mesh) => mesh.material)
      .find(
        (material) =>
          material instanceof MeshStandardMaterial
          && material.userData.finishChannel === "primary",
      ) as MeshStandardMaterial;
    const defaultsBefore = { ...defaultMechFinish };
    const finish = {
      primary: "#123456",
      secondary: "#abcdef",
      metalness: 1,
      roughness: 0.2,
    } as const satisfies MechFinish;

    const request = first.applyFinish(finish);
    const firstResourcesAfter = uniqueResources(first.root);
    const firstPrimary = meshes(first.root)
      .map((mesh) => mesh.material)
      .find(
        (material) =>
          material instanceof MeshStandardMaterial
          && material.userData.finishChannel === "primary",
      ) as MeshStandardMaterial;

    expect(request).toBeNull();
    expect(firstResourcesAfter.geometries).toEqual(firstResources.geometries);
    expect(firstResourcesAfter.materials).toEqual(firstResources.materials);
    expect(`#${firstPrimary.color.getHexString()}`).toBe("#123456");
    expect(firstPrimary.metalness).toBe(1);
    expect(firstPrimary.roughness).toBe(0.2);
    expect(`#${secondPrimary.color.getHexString()}`).toBe("#7a2f24");
    expect(defaultMechFinish).toEqual(defaultsBefore);

    first.dispose();
    second.dispose();
  });

  it("returns an environment request without applying scene state in the asset package", () => {
    const assembly = createMechAssembly(visualConfiguration);

    expect(
      assembly.applyFinish({
        ...visualConfiguration.finish,
        environment: "dusk",
      }),
    ).toEqual({
      type: "environment-change",
      environment: "dusk",
    });
    expect(assembly.root.userData.environment).toBeUndefined();
    assembly.dispose();
  });

  it("rejects invalid runtime inputs atomically with clear errors", () => {
    expect(() =>
      createMechAssembly({
        ...visualConfiguration,
        chassisId: "unknown-frame",
      } as never),
    ).toThrow("Unknown chassisId: unknown-frame");

    const assembly = createMechAssembly(visualConfiguration);
    const head = assembly.parts.get("head");
    expect(() =>
      assembly.updateConfiguration({
        ...visualConfiguration,
        headId: "missing-head",
      } as never),
    ).toThrow("Unknown headId: missing-head");
    expect(assembly.parts.get("head")).toBe(head);
    expect(() =>
      assembly.applyFinish({
        ...visualConfiguration.finish,
        metalness: 0.25,
      } as never),
    ).toThrow("Invalid finish metalness: 0.25");
    assembly.dispose();
  });

  it("disposes idempotently, clears the root, and rejects later mutations", () => {
    const assembly = createMechAssembly(visualConfiguration);
    const scene = new Group();
    scene.add(assembly.root);
    const resources = uniqueResources(assembly.root);
    const geometrySpies = [...resources.geometries].map((resource) =>
      vi.spyOn(resource, "dispose"),
    );
    const materialSpies = [...resources.materials].map((resource) =>
      vi.spyOn(resource, "dispose"),
    );

    assembly.dispose();
    assembly.dispose();

    expect(assembly.isDisposed()).toBe(true);
    expect(assembly.root.parent).toBeNull();
    expect(assembly.root.children).toHaveLength(0);
    expect(assembly.parts.size).toBe(0);
    expect(assembly.sockets.size).toBe(0);
    expect(assembly.hotspots.size).toBe(0);
    expect(geometrySpies.every((spy) => spy.mock.calls.length === 1)).toBe(true);
    expect(materialSpies.every((spy) => spy.mock.calls.length === 1)).toBe(true);
    expect(() => assembly.updateConfiguration(visualConfiguration)).toThrow(
      "Mech assembly is disposed",
    );
    expect(() => assembly.applyFinish(visualConfiguration.finish)).toThrow(
      "Mech assembly is disposed",
    );
  });
});
