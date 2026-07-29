import { DisposableScope } from "@showcase/three-runtime";
import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  OctahedronGeometry,
  Object3D,
  SphereGeometry,
  TorusGeometry,
  type BufferGeometry,
} from "three";
import { MECH_VISUAL_CATALOG } from "./catalog";
import type {
  MechArmorId,
  MechAssembly,
  MechChassisId,
  MechEnvironment,
  MechFinish,
  MechFinishUpdate,
  MechHeadId,
  MechLeftWeaponId,
  MechModuleSlot,
  MechPartSlot,
  MechRearModuleId,
  MechRightWeaponId,
  MechVisualConfiguration,
} from "./types";

type FinishChannel = "primary" | "secondary" | "structure";

interface PartPalette {
  readonly primary: MeshStandardMaterial;
  readonly secondary: MeshStandardMaterial;
  readonly structure: MeshStandardMaterial;
}

interface OwnedPart {
  readonly root: Group;
  readonly geometries: Set<BufferGeometry>;
  readonly materials: Set<MeshStandardMaterial>;
  readonly hotspot: Object3D | null;
  readonly sockets?: Map<MechModuleSlot, Object3D>;
  dispose(): void;
}

interface PartContext {
  readonly root: Group;
  readonly scope: DisposableScope;
  readonly geometries: Set<BufferGeometry>;
  readonly materials: Set<MeshStandardMaterial>;
  readonly palette: PartPalette;
}

const moduleSlots = [
  "head",
  "armor",
  "leftWeapon",
  "rightWeapon",
  "rearModule",
] as const satisfies readonly MechModuleSlot[];

const partSlots = [
  "chassis",
  ...moduleSlots,
] as const satisfies readonly MechPartSlot[];

const socketLayouts = {
  "strider-scout": {
    head: [0, 3.18, 0.03],
    armor: [0, 2.7, 0.47],
    leftWeapon: [-1.02, 2.68, 0.03],
    rightWeapon: [1.02, 2.68, 0.03],
    rearModule: [0, 2.66, -0.5],
  },
  "bastion-hauler": {
    head: [0, 3.45, 0.02],
    armor: [0, 2.9, 0.57],
    leftWeapon: [-1.28, 2.8, 0.02],
    rightWeapon: [1.28, 2.8, 0.02],
    rearModule: [0, 2.82, -0.62],
  },
  "oracle-frame": {
    head: [0, 3.32, 0.06],
    armor: [0, 2.82, 0.44],
    leftWeapon: [-1.05, 2.76, 0.06],
    rightWeapon: [1.05, 2.76, 0.06],
    rearModule: [0, 2.78, -0.48],
  },
} as const satisfies Record<
  MechChassisId,
  Record<MechModuleSlot, readonly [number, number, number]>
>;

/**
 * Creates one self-contained, project-authored procedural mech assembly.
 * No imported meshes, textures, remote URLs, or global mutable materials are used.
 */
export function createMechAssembly(input: MechVisualConfiguration): MechAssembly {
  assertConfiguration(input);
  let current = cloneConfiguration(input);
  let disposed = false;

  const root = new Group();
  root.name = "mech-assembly";
  root.userData = {
    provenance: {
      type: "procedural",
      description: "Project-authored Three.js geometry",
    },
    importedFiles: "none",
    coordinateSystem: {
      upAxis: "+Y",
      forwardAxis: "+Z",
      groundPlaneY: 0,
    },
  };

  const parts = new Map<MechPartSlot, Group>();
  const sockets = new Map<MechModuleSlot, Object3D>();
  const hotspots = new Map<MechModuleSlot, Object3D>();
  const owned = new Map<MechPartSlot, OwnedPart>();

  const chassis = createChassisPart(current.chassisId, current.finish);
  root.add(chassis.root);
  owned.set("chassis", chassis);
  parts.set("chassis", chassis.root);
  for (const slot of moduleSlots) {
    sockets.set(slot, requiredSocket(chassis, slot));
  }

  const initialModules: Record<MechModuleSlot, OwnedPart> = {
    head: createHeadPart(current.headId, current.finish),
    armor: createArmorPart(current.armorId, current.finish),
    leftWeapon: createLeftWeaponPart(current.leftWeaponId, current.finish),
    rightWeapon: createRightWeaponPart(current.rightWeaponId, current.finish),
    rearModule: createRearModulePart(current.rearModuleId, current.finish),
  };
  for (const slot of moduleSlots) {
    installModule(slot, initialModules[slot]);
  }

  function assertLive(): void {
    if (disposed) throw new Error("Mech assembly is disposed");
  }

  function installModule(slot: MechModuleSlot, part: OwnedPart): void {
    sockets.get(slot)!.add(part.root);
    owned.set(slot, part);
    parts.set(slot, part.root);
    if (part.hotspot) hotspots.set(slot, part.hotspot);
  }

  function replaceChassis(nextId: MechChassisId): void {
    const replacement = createChassisPart(nextId, current.finish);
    root.add(replacement.root);
    for (const slot of moduleSlots) {
      const nextSocket = requiredSocket(replacement, slot);
      nextSocket.add(parts.get(slot)!);
      sockets.set(slot, nextSocket);
    }
    const previous = owned.get("chassis")!;
    owned.set("chassis", replacement);
    parts.set("chassis", replacement.root);
    previous.dispose();
  }

  function replaceModule(slot: MechModuleSlot, replacement: OwnedPart): void {
    const previous = owned.get(slot)!;
    sockets.get(slot)!.add(replacement.root);
    owned.set(slot, replacement);
    parts.set(slot, replacement.root);
    if (replacement.hotspot) hotspots.set(slot, replacement.hotspot);
    else hotspots.delete(slot);
    previous.dispose();
  }

  function applyFinishInternal(finish: MechFinish): void {
    for (const part of owned.values()) {
      for (const material of part.materials) {
        const channel = material.userData.finishChannel as FinishChannel;
        if (channel === "primary") material.color.set(finish.primary);
        if (channel === "secondary") material.color.set(finish.secondary);
        material.metalness = finish.metalness;
        material.roughness = finish.roughness;
      }
    }
  }

  return {
    root,
    parts,
    sockets,
    hotspots,
    applyFinish(finish) {
      assertLive();
      assertFinish(finish);
      applyFinishInternal(finish);
      current = {
        ...current,
        finish: cloneFinish(finish),
      };
      return finish.environment
        ? {
            type: "environment-change",
            environment: finish.environment,
          }
        : null;
    },
    updateConfiguration(next) {
      assertLive();
      assertConfiguration(next);

      if (next.chassisId !== current.chassisId) {
        replaceChassis(next.chassisId);
      }
      if (next.headId !== current.headId) {
        replaceModule("head", createHeadPart(next.headId, current.finish));
      }
      if (next.armorId !== current.armorId) {
        replaceModule("armor", createArmorPart(next.armorId, current.finish));
      }
      if (next.leftWeaponId !== current.leftWeaponId) {
        replaceModule(
          "leftWeapon",
          createLeftWeaponPart(next.leftWeaponId, current.finish),
        );
      }
      if (next.rightWeaponId !== current.rightWeaponId) {
        replaceModule(
          "rightWeapon",
          createRightWeaponPart(next.rightWeaponId, current.finish),
        );
      }
      if (next.rearModuleId !== current.rearModuleId) {
        replaceModule(
          "rearModule",
          createRearModulePart(next.rearModuleId, current.finish),
        );
      }
      applyFinishInternal(next.finish);
      current = cloneConfiguration(next);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      for (const slot of partSlots) owned.get(slot)?.dispose();
      root.clear();
      owned.clear();
      parts.clear();
      sockets.clear();
      hotspots.clear();
    },
    isDisposed: () => disposed,
  };
}

function createChassisPart(
  id: MechChassisId,
  finish: MechFinish,
): OwnedPart {
  const context = createPartContext("chassis", id, finish);
  if (id === "strider-scout") {
    const foot = ownGeometry(context, new BoxGeometry(0.52, 0.3, 0.86));
    const shin = ownGeometry(context, new CylinderGeometry(0.14, 0.2, 1.08, 6));
    const thigh = ownGeometry(context, new BoxGeometry(0.42, 0.72, 0.5));
    for (const sign of [-1, 1]) {
      addVisual(context, `foot-${sign}`, foot, context.palette.structure, [sign * 0.5, 0.15, 0.1]);
      addVisual(context, `shin-${sign}`, shin, context.palette.secondary, [sign * 0.5, 0.83, 0]);
      addVisual(context, `thigh-${sign}`, thigh, context.palette.primary, [sign * 0.5, 1.65, 0]);
    }
    addVisual(context, "scout-hips", new BoxGeometry(1.38, 0.45, 0.75), context.palette.structure, [0, 2.1, 0]);
    addVisual(context, "scout-torso", new BoxGeometry(1.58, 0.82, 0.82), context.palette.primary, [0, 2.7, 0]);
  } else if (id === "bastion-hauler") {
    const foot = ownGeometry(context, new BoxGeometry(0.72, 0.34, 1.02));
    const shin = ownGeometry(context, new BoxGeometry(0.46, 1.05, 0.52));
    const piston = ownGeometry(context, new CylinderGeometry(0.09, 0.12, 0.82, 7));
    for (const sign of [-1, 1]) {
      addVisual(context, `foot-${sign}`, foot, context.palette.structure, [sign * 0.63, 0.17, 0.12]);
      addVisual(context, `shin-${sign}`, shin, context.palette.primary, [sign * 0.63, 0.95, 0]);
      addVisual(context, `piston-${sign}`, piston, context.palette.secondary, [sign * 0.63, 1.75, -0.2]);
    }
    addVisual(context, "hauler-hips", new BoxGeometry(1.75, 0.56, 0.94), context.palette.structure, [0, 2.12, 0]);
    addVisual(context, "hauler-torso", new BoxGeometry(2.08, 0.98, 1.02), context.palette.primary, [0, 2.87, 0]);
  } else {
    const foot = ownGeometry(context, new BoxGeometry(0.48, 0.25, 0.78));
    const leg = ownGeometry(context, new CylinderGeometry(0.13, 0.2, 1.38, 5));
    const knee = ownGeometry(context, new OctahedronGeometry(0.24, 0));
    for (const sign of [-1, 1]) {
      addVisual(context, `foot-${sign}`, foot, context.palette.structure, [sign * 0.48, 0.125, 0.12]);
      addVisual(context, `leg-${sign}`, leg, context.palette.secondary, [sign * 0.48, 0.9, 0]);
      addVisual(context, `knee-${sign}`, knee, context.palette.primary, [sign * 0.48, 1.62, 0.08]);
    }
    addVisual(context, "oracle-hips", new CylinderGeometry(0.68, 0.82, 0.5, 8), context.palette.structure, [0, 2.08, 0]);
    addVisual(context, "oracle-torso", new ConeGeometry(1.02, 1.08, 6), context.palette.primary, [0, 2.73, 0], [0, 0, Math.PI]);
  }

  const sockets = new Map<MechModuleSlot, Object3D>();
  for (const slot of moduleSlots) {
    const socket = new Group();
    socket.name = `socket-${slot}`;
    const [x, y, z] = socketLayouts[id][slot];
    socket.position.set(x, y, z);
    socket.userData = {
      type: "attachment-socket",
      slot,
      chassisId: id,
    };
    context.root.add(socket);
    sockets.set(slot, socket);
  }
  return finishPart(context, null, sockets);
}

function createHeadPart(id: MechHeadId, finish: MechFinish): OwnedPart {
  const context = createPartContext("head", id, finish);
  if (id === "surveyor-head") {
    addVisual(context, "surveyor-dome", new SphereGeometry(0.32, 8, 6), context.palette.primary, [0, 0.28, 0]);
    addVisual(context, "surveyor-visor", new BoxGeometry(0.5, 0.11, 0.15), context.palette.secondary, [0, 0.25, 0.27]);
    addVisual(context, "surveyor-optic", new CylinderGeometry(0.07, 0.07, 0.18, 8), context.palette.structure, [0, 0.25, 0.38], [Math.PI / 2, 0, 0]);
  } else if (id === "bulwark-head") {
    addVisual(context, "bulwark-helm", new BoxGeometry(0.62, 0.48, 0.55), context.palette.primary, [0, 0.27, 0]);
    addVisual(context, "bulwark-brow", new BoxGeometry(0.7, 0.12, 0.18), context.palette.secondary, [0, 0.32, 0.3]);
    addVisual(context, "bulwark-slit", new BoxGeometry(0.38, 0.06, 0.08), context.palette.structure, [0, 0.22, 0.34]);
  } else {
    addVisual(context, "halo-core", new OctahedronGeometry(0.31, 0), context.palette.primary, [0, 0.3, 0]);
    addVisual(context, "halo-ring", new TorusGeometry(0.42, 0.045, 5, 16), context.palette.secondary, [0, 0.34, 0], [Math.PI / 2, 0, 0]);
    addVisual(context, "halo-face", new ConeGeometry(0.17, 0.34, 5), context.palette.structure, [0, 0.23, 0.28], [Math.PI / 2, 0, 0]);
  }
  return finishPart(context, createHotspot(context, "head", [0, 0.68, 0]));
}

function createArmorPart(id: MechArmorId, finish: MechFinish): OwnedPart {
  const context = createPartContext("armor", id, finish);
  if (id === "ceramic-shell") {
    addVisual(context, "ceramic-breastplate", new BoxGeometry(1.32, 0.7, 0.22), context.palette.primary, [0, 0, 0.02]);
    addVisual(context, "ceramic-keel", new ConeGeometry(0.18, 0.52, 4), context.palette.secondary, [0, -0.02, 0.2], [0, 0, Math.PI / 4]);
  } else if (id === "reactive-bastion") {
    addVisual(context, "bastion-breastplate", new BoxGeometry(1.58, 0.86, 0.3), context.palette.primary, [0, 0, 0.02]);
    const tile = ownGeometry(context, new BoxGeometry(0.32, 0.25, 0.12));
    for (const x of [-0.42, 0, 0.42]) {
      addVisual(context, `reactive-tile-${x}`, tile, context.palette.secondary, [x, 0.08, 0.23]);
    }
  } else {
    addVisual(context, "weave-cuirass", new OctahedronGeometry(0.66, 0), context.palette.primary, [0, 0, -0.02], [0, 0, Math.PI / 4]);
    addVisual(context, "weave-ribs", new TorusGeometry(0.43, 0.055, 5, 12, Math.PI), context.palette.secondary, [0, 0.02, 0.3]);
  }
  return finishPart(context, createHotspot(context, "armor", [0, 0.55, 0.3]));
}

function createLeftWeaponPart(
  id: MechLeftWeaponId,
  finish: MechFinish,
): OwnedPart {
  const context = createPartContext("leftWeapon", id, finish);
  if (id === "arc-blade") buildArcBlade(context, -1);
  else if (id === "aegis-shield") buildAegisShield(context);
  else buildDroneRack(context, -1);
  return finishPart(context, createHotspot(context, "leftWeapon", [-0.25, 0.25, 0.1]));
}

function createRightWeaponPart(
  id: MechRightWeaponId,
  finish: MechFinish,
): OwnedPart {
  const context = createPartContext("rightWeapon", id, finish);
  if (id === "arc-blade") buildArcBlade(context, 1);
  else if (id === "rail-lance") buildRailLance(context);
  else buildDroneRack(context, 1);
  return finishPart(context, createHotspot(context, "rightWeapon", [0.25, 0.25, 0.1]));
}

function createRearModulePart(
  id: MechRearModuleId,
  finish: MechFinish,
): OwnedPart {
  const context = createPartContext("rearModule", id, finish);
  if (id === "jump-pack") {
    const thruster = ownGeometry(context, new CylinderGeometry(0.18, 0.25, 0.68, 8));
    for (const x of [-0.3, 0.3]) {
      addVisual(context, `jump-thruster-${x}`, thruster, context.palette.primary, [x, 0, -0.18], [Math.PI / 2, 0, 0]);
    }
    addVisual(context, "jump-spine", new BoxGeometry(0.32, 0.7, 0.3), context.palette.secondary, [0, 0.1, -0.08]);
  } else if (id === "siege-reactor") {
    addVisual(context, "reactor-core", new CylinderGeometry(0.42, 0.42, 0.72, 10), context.palette.primary, [0, 0, -0.14], [Math.PI / 2, 0, 0]);
    addVisual(context, "reactor-ring", new TorusGeometry(0.48, 0.08, 6, 16), context.palette.secondary, [0, 0, -0.52]);
  } else {
    addVisual(context, "relay-body", new BoxGeometry(0.72, 0.62, 0.34), context.palette.primary, [0, 0, -0.13]);
    addVisual(context, "relay-dish", new SphereGeometry(0.38, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), context.palette.secondary, [0, 0.32, -0.34], [Math.PI / 2, 0, 0]);
    addVisual(context, "relay-mast", new CylinderGeometry(0.035, 0.035, 0.62, 6), context.palette.structure, [0, 0.62, -0.34]);
  }
  return finishPart(context, createHotspot(context, "rearModule", [0, 0.65, -0.45]));
}

function buildArcBlade(context: PartContext, side: -1 | 1): void {
  addVisual(context, "arc-grip", new CylinderGeometry(0.08, 0.08, 0.42, 7), context.palette.structure, [side * 0.08, -0.16, 0]);
  addVisual(context, "arc-guard", new BoxGeometry(0.42, 0.1, 0.2), context.palette.primary, [0, -0.37, 0]);
  addVisual(context, "arc-edge", new BoxGeometry(0.14, 1.02, 0.1), context.palette.secondary, [side * 0.08, -0.92, 0]);
}

function buildAegisShield(context: PartContext): void {
  addVisual(context, "aegis-face", new BoxGeometry(0.85, 1.2, 0.18), context.palette.primary, [-0.18, -0.35, 0.08], [0, 0, -0.12]);
  addVisual(context, "aegis-boss", new OctahedronGeometry(0.24, 0), context.palette.secondary, [-0.2, -0.28, 0.23]);
}

function buildDroneRack(context: PartContext, side: -1 | 1): void {
  addVisual(context, "drone-rack-body", new BoxGeometry(0.54, 0.52, 0.72), context.palette.primary, [side * 0.12, -0.04, -0.02]);
  const pod = ownGeometry(context, new CylinderGeometry(0.08, 0.08, 0.48, 7));
  for (const x of [-0.13, 0.13]) {
    addVisual(context, `drone-pod-${x}`, pod, context.palette.secondary, [side * 0.14 + x, -0.03, 0.26], [Math.PI / 2, 0, 0]);
  }
}

function buildRailLance(context: PartContext): void {
  addVisual(context, "rail-stock", new BoxGeometry(0.5, 0.4, 0.7), context.palette.primary, [0.12, -0.05, 0.15]);
  addVisual(context, "rail-barrel", new CylinderGeometry(0.09, 0.13, 1.65, 8), context.palette.structure, [0.12, -0.08, 1.22], [Math.PI / 2, 0, 0]);
  addVisual(context, "rail-coil", new TorusGeometry(0.2, 0.055, 5, 12), context.palette.secondary, [0.12, -0.08, 0.72]);
}

function createPartContext(
  slot: MechPartSlot,
  id: string,
  finish: MechFinish,
): PartContext {
  const root = new Group();
  root.name = `part-${slot}-${id}`;
  root.userData = {
    slot,
    assetId: id,
    provenance: {
      type: "procedural",
      description: "Project-authored Three.js geometry",
    },
    importedFiles: "none",
  };
  const materials = new Set<MeshStandardMaterial>();
  const scope = new DisposableScope();
  let primary: MeshStandardMaterial | undefined;
  let secondary: MeshStandardMaterial | undefined;
  let structure: MeshStandardMaterial | undefined;
  const registerMaterial = (
    channel: FinishChannel,
    color: string,
  ): MeshStandardMaterial => {
    const material = createMaterial(channel, color, finish);
    materials.add(material);
    scope.track(material);
    return material;
  };
  const palette: PartPalette = {
    get primary() {
      return primary ??= registerMaterial("primary", finish.primary);
    },
    get secondary() {
      return secondary ??= registerMaterial("secondary", finish.secondary);
    },
    get structure() {
      return structure ??= registerMaterial("structure", "#242833");
    },
  };
  return {
    root,
    scope,
    geometries: new Set<BufferGeometry>(),
    materials,
    palette,
  };
}

function createMaterial(
  channel: FinishChannel,
  color: string,
  finish: MechFinish,
): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    color,
    metalness: finish.metalness,
    roughness: finish.roughness,
  });
  material.name = `mech-${channel}`;
  material.userData.finishChannel = channel;
  return material;
}

function ownGeometry<T extends BufferGeometry>(
  context: PartContext,
  geometry: T,
): T {
  context.geometries.add(geometry);
  context.scope.track(geometry);
  return geometry;
}

function addVisual(
  context: PartContext,
  name: string,
  geometry: BufferGeometry,
  material: MeshStandardMaterial,
  position: readonly [number, number, number],
  rotation: readonly [number, number, number] = [0, 0, 0],
): Mesh {
  context.geometries.add(geometry);
  context.scope.track(geometry);
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = {
    visual: true,
    collider: false,
    finishChannel: material.userData.finishChannel,
  };
  context.root.add(mesh);
  return mesh;
}

function createHotspot(
  context: PartContext,
  slot: MechModuleSlot,
  position: readonly [number, number, number],
): Object3D {
  const hotspot = new Object3D();
  hotspot.name = `hotspot-${slot}`;
  hotspot.position.set(...position);
  hotspot.userData = { type: "hotspot", slot };
  context.root.add(hotspot);
  return hotspot;
}

function finishPart(
  context: PartContext,
  hotspot: Object3D | null,
  sockets?: Map<MechModuleSlot, Object3D>,
): OwnedPart {
  let disposed = false;
  return {
    ...context,
    hotspot,
    ...(sockets ? { sockets } : {}),
    dispose() {
      if (disposed) return;
      disposed = true;
      context.root.removeFromParent();
      context.scope.dispose();
      context.root.clear();
      context.geometries.clear();
      context.materials.clear();
      sockets?.clear();
    },
  };
}

function requiredSocket(
  chassis: OwnedPart,
  slot: MechModuleSlot,
): Object3D {
  const socket = chassis.sockets?.get(slot);
  if (!socket) throw new Error(`Chassis is missing required socket: ${slot}`);
  return socket;
}

function cloneConfiguration(
  input: MechVisualConfiguration,
): MechVisualConfiguration {
  return {
    chassisId: input.chassisId,
    headId: input.headId,
    armorId: input.armorId,
    leftWeaponId: input.leftWeaponId,
    rightWeaponId: input.rightWeaponId,
    rearModuleId: input.rearModuleId,
    finish: cloneFinish(input.finish),
  };
}

function cloneFinish(finish: MechFinish): MechFinish {
  return {
    primary: finish.primary,
    secondary: finish.secondary,
    metalness: finish.metalness,
    roughness: finish.roughness,
  };
}

function assertConfiguration(
  input: MechVisualConfiguration,
): asserts input is MechVisualConfiguration {
  if (!input || typeof input !== "object") {
    throw new TypeError("Mech visual configuration must be an object");
  }
  assertKnown("chassisId", input.chassisId, MECH_VISUAL_CATALOG.chassis);
  assertKnown("headId", input.headId, MECH_VISUAL_CATALOG.head);
  assertKnown("armorId", input.armorId, MECH_VISUAL_CATALOG.armor);
  assertKnown(
    "leftWeaponId",
    input.leftWeaponId,
    MECH_VISUAL_CATALOG.leftWeapon,
  );
  assertKnown(
    "rightWeaponId",
    input.rightWeaponId,
    MECH_VISUAL_CATALOG.rightWeapon,
  );
  assertKnown(
    "rearModuleId",
    input.rearModuleId,
    MECH_VISUAL_CATALOG.rearModule,
  );
  assertFinish(input.finish);
}

function assertKnown(
  field: string,
  value: unknown,
  approved: readonly string[],
): void {
  if (typeof value !== "string" || !approved.includes(value)) {
    throw new RangeError(`Unknown ${field}: ${String(value)}`);
  }
}

function assertFinish(finish: MechFinishUpdate): void {
  if (!finish || typeof finish !== "object") {
    throw new TypeError("Mech finish must be an object");
  }
  assertHexColor("primary", finish.primary);
  assertHexColor("secondary", finish.secondary);
  if (![0, 0.5, 1].includes(finish.metalness)) {
    throw new RangeError(`Invalid finish metalness: ${String(finish.metalness)}`);
  }
  if (![0.2, 0.6, 1].includes(finish.roughness)) {
    throw new RangeError(`Invalid finish roughness: ${String(finish.roughness)}`);
  }
  if (finish.environment !== undefined) {
    assertEnvironment(finish.environment);
  }
}

function assertHexColor(field: string, value: unknown): void {
  if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) {
    throw new RangeError(`Invalid finish ${field}: ${String(value)}`);
  }
}

function assertEnvironment(
  environment: unknown,
): asserts environment is MechEnvironment {
  if (!["foundry", "hangar", "dusk"].includes(String(environment))) {
    throw new RangeError(`Unknown environment: ${String(environment)}`);
  }
}
