import {
  BoxGeometry,
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
} from "three";

export type VesperKnightSocketName = "right-hand" | "left-hand" | "back";
export type VesperKnightWeapon = "oathblade" | "ember-bow";

export interface VesperKnight {
  root: Group;
  sockets: ReadonlyMap<VesperKnightSocketName, Object3D>;
  equipWeapon(weapon: VesperKnightWeapon): void;
  update(action: "idle" | "move" | "attack" | "guard" | "dodge" | "hit" | "dead", elapsed: number): void;
  dispose(): void;
  isDisposed(): boolean;
}

const createMaterial = (color: number, roughness = 0.72, metalness = 0.18) =>
  new MeshStandardMaterial({ color, roughness, metalness });

const addMesh = (
  parent: Object3D,
  name: string,
  geometry: Mesh["geometry"],
  material: Material,
  position: readonly [number, number, number],
  rotation: readonly [number, number, number] = [0, 0, 0],
): Mesh => {
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
};

export function createVesperKnight(): VesperKnight {
  const root = new Group();
  root.name = "vesper-knight";
  root.userData.provenance = {
    type: "procedural",
    factoryId: "create-vesper-knight",
    source: "project-authored Three.js primitives",
    importedFiles: "none",
  };
  root.userData.collider = {
    shape: "capsule",
    radius: 0.35,
    height: 2.65,
    gameplayPlaneY: 0,
  };

  const motion = new Group();
  motion.name = "motion";
  root.add(motion);

  const charcoal = createMaterial(0x181b24, 0.86, 0.08);
  const steel = createMaterial(0x6d7280, 0.42, 0.68);
  const ashGold = createMaterial(0xc18a3d, 0.54, 0.48);
  const ember = createMaterial(0xff8045, 0.44, 0.18);
  const cloth = createMaterial(0x4c2632, 0.92, 0.02);
  const pale = createMaterial(0xc9c2b3, 0.84, 0);

  const hips = new Group();
  hips.name = "hips";
  hips.position.y = 1.27;
  motion.add(hips);

  addMesh(hips, "waist-plate", new CylinderGeometry(0.35, 0.42, 0.38, 8), steel, [0, 0.08, 0]);
  addMesh(hips, "tabard", new BoxGeometry(0.36, 0.68, 0.08), cloth, [0, -0.28, 0.3], [-0.08, 0, 0]);

  const torso = new Group();
  torso.name = "torso";
  torso.position.y = 0.58;
  hips.add(torso);
  addMesh(torso, "chest-plate", new BoxGeometry(0.82, 0.82, 0.44), steel, [0, 0.16, 0]);
  addMesh(torso, "chest-ridge", new ConeGeometry(0.18, 0.52, 4), ashGold, [0, 0.18, 0.28], [0, 0, Math.PI / 4]);
  addMesh(torso, "shoulder-cloak", new BoxGeometry(1.14, 0.16, 0.48), cloth, [0, 0.48, -0.04]);

  const head = new Group();
  head.name = "head";
  head.position.y = 0.88;
  torso.add(head);
  addMesh(head, "helmet", new SphereGeometry(0.28, 10, 7), steel, [0, 0, 0]);
  addMesh(head, "visor", new BoxGeometry(0.46, 0.12, 0.14), charcoal, [0, -0.02, 0.23]);
  addMesh(head, "ember-eye", new BoxGeometry(0.26, 0.035, 0.02), ember, [0, -0.02, 0.315]);
  addMesh(head, "helm-crest", new ConeGeometry(0.12, 0.48, 5), cloth, [0, 0.44, -0.05]);

  const legs = new Map<string, Group>();
  for (const [side, x] of [["left", -0.23], ["right", 0.23]] as const) {
    const leg = new Group();
    leg.name = `${side}-leg`;
    leg.position.set(x, -0.1, 0);
    hips.add(leg);
    addMesh(leg, `${side}-thigh`, new CapsuleGeometry(0.13, 0.36, 4, 7), steel, [0, -0.3, 0]);
    addMesh(leg, `${side}-shin`, new CapsuleGeometry(0.12, 0.34, 4, 7), charcoal, [0, -0.76, 0]);
    addMesh(leg, `${side}-boot`, new BoxGeometry(0.26, 0.18, 0.42), steel, [0, -1.08, 0.09]);
    legs.set(side, leg);
  }

  const arms = new Map<string, Group>();
  for (const [side, x] of [["left", -0.56], ["right", 0.56]] as const) {
    const arm = new Group();
    arm.name = `${side}-arm`;
    arm.position.set(x, 0.35, 0);
    torso.add(arm);
    addMesh(arm, `${side}-pauldron`, new SphereGeometry(0.24, 8, 6), ashGold, [0, 0, 0]);
    addMesh(arm, `${side}-bracer`, new CapsuleGeometry(0.105, 0.42, 4, 6), steel, [0, -0.38, 0]);
    addMesh(arm, `${side}-glove`, new SphereGeometry(0.13, 7, 5), pale, [0, -0.7, 0]);
    arms.set(side, arm);
  }

  const rightHand = new Object3D();
  rightHand.name = "socket-right-hand";
  rightHand.position.set(0, -0.76, 0.02);
  arms.get("right")!.add(rightHand);
  const leftHand = new Object3D();
  leftHand.name = "socket-left-hand";
  leftHand.position.set(0, -0.76, 0.02);
  arms.get("left")!.add(leftHand);
  const back = new Object3D();
  back.name = "socket-back";
  back.position.set(0.36, 0.18, -0.3);
  back.rotation.z = -0.45;
  torso.add(back);

  const oathblade = new Group();
  oathblade.name = "oathblade-placeholder";
  addMesh(oathblade, "oathblade-grip", new CylinderGeometry(0.045, 0.045, 0.36, 7), charcoal, [0, -0.04, 0]);
  addMesh(oathblade, "oathblade-guard", new BoxGeometry(0.38, 0.055, 0.08), ashGold, [0, -0.22, 0]);
  addMesh(oathblade, "oathblade-edge", new BoxGeometry(0.105, 1.18, 0.055), steel, [0, -0.84, 0]);
  oathblade.rotation.z = Math.PI;
  rightHand.add(oathblade);

  const bow = new Group();
  bow.name = "ember-bow-placeholder";
  const upperLimb = addMesh(bow, "bow-upper", new CylinderGeometry(0.035, 0.05, 0.72, 7), ashGold, [0, 0.34, 0]);
  upperLimb.rotation.z = -0.2;
  const lowerLimb = addMesh(bow, "bow-lower", new CylinderGeometry(0.05, 0.035, 0.72, 7), ashGold, [0, -0.34, 0]);
  lowerLimb.rotation.z = 0.2;
  addMesh(bow, "bow-string", new BoxGeometry(0.012, 1.35, 0.012), pale, [0.13, 0, 0]);
  back.add(bow);

  const sockets = new Map<VesperKnightSocketName, Object3D>([
    ["right-hand", rightHand],
    ["left-hand", leftHand],
    ["back", back],
  ]);

  let disposed = false;
  let equipped: VesperKnightWeapon | null = null;

  const equipWeapon = (weapon: VesperKnightWeapon) => {
    if (disposed) throw new Error("Vesper Knight is disposed");
    if (equipped === weapon) return;
    equipped = weapon;
    if (weapon === "oathblade") {
      rightHand.add(oathblade);
      oathblade.position.set(0, 0, 0);
      oathblade.rotation.set(0, 0, Math.PI);
      back.add(bow);
      bow.position.set(0, 0, 0);
      bow.rotation.set(0, 0, 0);
    } else {
      leftHand.add(bow);
      bow.position.set(0, -0.08, 0.02);
      bow.rotation.set(0, 0, 0);
      back.add(oathblade);
      oathblade.position.set(-0.14, 0.08, 0.02);
      oathblade.rotation.set(0, 0, Math.PI);
    }
    oathblade.visible = true;
    bow.visible = true;
    oathblade.userData.equipped = weapon === "oathblade";
    bow.userData.equipped = weapon === "ember-bow";
    root.userData.equippedWeapon = weapon;
  };

  equipWeapon("oathblade");

  return {
    root,
    sockets,
    equipWeapon,
    update(action, elapsed) {
      if (disposed) throw new Error("Vesper Knight is disposed");
      const stride = action === "move" ? Math.sin(elapsed * 10) * 0.42 : 0;
      legs.get("left")!.rotation.x = stride;
      legs.get("right")!.rotation.x = -stride;
      arms.get("left")!.rotation.x = -stride * 0.55;
      arms.get("right")!.rotation.x =
        action === "attack" && equipped === "oathblade"
          ? -1.15
          : stride * 0.55;
      torso.rotation.z = action === "dodge" ? -0.18 : 0;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      const geometries = new Set<Mesh["geometry"]>();
      const materials = new Set<Material>();
      root.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        geometries.add(object.geometry);
        const ownedMaterials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        ownedMaterials.forEach((material) => materials.add(material));
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      root.removeFromParent();
    },
    isDisposed: () => disposed,
  };
}
