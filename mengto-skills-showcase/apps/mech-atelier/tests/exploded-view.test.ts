import { createMechAssembly, type MechVisualConfiguration } from "@showcase/game-assets";
import { expect, it } from "vitest";
import { createExplodedView } from "../src/scene/create-exploded-view";

const visualConfiguration: MechVisualConfiguration = {
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
};

it("uses bounded socket-local offsets and returns every part exactly to assembly", () => {
  const assembly = createMechAssembly(visualConfiguration);
  const exploded = createExplodedView(assembly);
  const chassisStart = assembly.parts.get("chassis")!.position.clone();

  exploded.setExploded(true);
  exploded.update(0.18);
  expect(exploded.snapshot().progress).toBeCloseTo(0.5, 5);
  expect(assembly.parts.get("head")!.position.y).toBeCloseTo(0.625, 5);
  exploded.update(0.18);

  expect(assembly.parts.get("chassis")!.position.toArray()).toEqual(
    chassisStart.toArray(),
  );
  expect(assembly.parts.get("head")!.position.toArray()).toEqual([0, 1.25, 0]);
  expect(assembly.parts.get("armor")!.position.toArray()).toEqual([0, 0, 1.1]);
  expect(assembly.parts.get("leftWeapon")!.position.toArray()).toEqual([
    -1.4, 0, 0,
  ]);
  expect(assembly.parts.get("rightWeapon")!.position.toArray()).toEqual([
    1.4, 0, 0,
  ]);
  expect(assembly.parts.get("rearModule")!.position.toArray()).toEqual([
    0, 0, -1.3,
  ]);
  expect(exploded.snapshot().maxDisplacement).toBeLessThanOrEqual(1.8);

  exploded.setExploded(false);
  exploded.update(1);
  for (const slot of [
    "head",
    "armor",
    "leftWeapon",
    "rightWeapon",
    "rearModule",
  ] as const) {
    expect(assembly.parts.get(slot)!.position.toArray()).toEqual([0, 0, 0]);
  }
  exploded.dispose();
  assembly.dispose();
});

it("rebinds replaced modules while exploded without accumulating drift", () => {
  const assembly = createMechAssembly(visualConfiguration);
  const exploded = createExplodedView(assembly, { reducedMotion: true });

  for (let index = 0; index < 50; index += 1) {
    exploded.setExploded(true);
    exploded.setExploded(false);
  }
  expect(assembly.parts.get("leftWeapon")!.position.toArray()).toEqual([
    0, 0, 0,
  ]);

  exploded.setExploded(true);
  const previousHead = assembly.parts.get("head");
  assembly.updateConfiguration({
    ...visualConfiguration,
    chassisId: "bastion-hauler",
    headId: "bulwark-head",
  });
  exploded.rebind();

  expect(assembly.parts.get("head")).not.toBe(previousHead);
  expect(assembly.parts.get("head")!.position.toArray()).toEqual([0, 1.25, 0]);
  expect(assembly.parts.get("leftWeapon")!.position.toArray()).toEqual([
    -1.4, 0, 0,
  ]);
  expect(exploded.snapshot().progress).toBe(1);

  exploded.dispose();
  expect(() => exploded.update(1)).not.toThrow();
  assembly.dispose();
});
