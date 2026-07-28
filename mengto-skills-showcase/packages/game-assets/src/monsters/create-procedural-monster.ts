import { DisposableScope } from "@showcase/three-runtime";
import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  type Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  type BufferGeometry,
  Vector3,
} from "three";
import {
  MONSTER_ACTION_DURATIONS,
  type MonsterActionName,
  type MonsterDefinition,
} from "./types";

export interface MonsterCollider {
  readonly root: Object3D;
  readonly layer: "solid";
  readonly radius: number;
  readonly height: number;
}

export interface MonsterActionState {
  readonly name: MonsterActionName;
  readonly elapsed: number;
  readonly progress: number;
  readonly completed: boolean;
}

export interface MonsterGroundContact {
  readonly name: string;
  readonly joint: Object3D;
}

export interface MonsterInstance {
  readonly root: Group;
  readonly joints: ReadonlyMap<string, Object3D>;
  readonly sockets: ReadonlyMap<string, Object3D>;
  readonly groundContacts: readonly MonsterGroundContact[];
  readonly collider: MonsterCollider;
  playAction(action: MonsterActionName): void;
  setPaused(paused: boolean): void;
  update(deltaSeconds: number): void;
  getActionState(): MonsterActionState;
  dispose(): void;
  isDisposed(): boolean;
}

interface RecipeContext {
  readonly definition: MonsterDefinition;
  readonly scope: DisposableScope;
  readonly root: Group;
  readonly body: Group;
  readonly joints: Map<string, Object3D>;
}

type RecipeBuilder = (context: RecipeContext) => void;

const RECIPES: Record<MonsterDefinition["factoryId"], RecipeBuilder> = {
  biped: buildBiped,
  crawler: buildCrawler,
  armored: buildArmored,
  quadruped: buildQuadruped,
};

const loopedActions = new Set<MonsterActionName>(["Idle", "Walk"]);
const GROUND_CONTACT_NAMES = {
  biped: ["foot-l", "foot-r"],
  crawler: ["foot-1-l", "foot-1-r", "foot-2-l", "foot-2-r", "foot-3-l", "foot-3-r"],
  armored: ["foot-l", "foot-r"],
  quadruped: ["front-foot-l", "front-foot-r", "rear-foot-l", "rear-foot-r"],
} as const satisfies Record<MonsterDefinition["factoryId"], readonly string[]>;

/** Builds a review-only, project-authored procedural monster with no external asset inputs. */
export function createProceduralMonster(definition: MonsterDefinition): MonsterInstance {
  const scope = new DisposableScope();
  const root = namedGroup("root");
  const motion = namedGroup("motion");
  const body = namedGroup("body");
  root.add(motion);
  motion.add(body);

  const joints = new Map<string, Object3D>();
  const sockets = new Map<string, Object3D>();
  joints.set(motion.name, motion);
  const context: RecipeContext = { definition, scope, root, body, joints };
  RECIPES[definition.factoryId](context);
  const groundContactAnchor = namedGroup("ground-contact");
  groundContactAnchor.position.y = definition.bounds.groundOffset;
  root.add(groundContactAnchor);
  joints.set(groundContactAnchor.name, groundContactAnchor);
  createDefinitionSockets(context, sockets);
  const groundContacts = Object.freeze(
    GROUND_CONTACT_NAMES[definition.factoryId].map((name) =>
      Object.freeze({ name, joint: requiredJoint(joints, name) }),
    ),
  );

  const colliderRoot = namedGroup("collider-solid");
  colliderRoot.userData = {
    layer: "solid",
    ownerId: definition.id,
    semanticPart: "body",
    localOffset: { x: 0, y: definition.collider.height / 2, z: 0 },
    size: { radius: definition.collider.radius, height: definition.collider.height },
    shape: "capsule",
  };
  const collider: MonsterCollider = {
    root: colliderRoot,
    layer: "solid",
    radius: definition.collider.radius,
    height: definition.collider.height,
  };

  const source = "runtime factory shipped; catalog PNG recapture required after grounding and animation revision";
  root.userData = {
    procedural: true,
    factoryId: definition.factoryId,
    action: "Idle",
    source,
    provenance: { type: "procedural", factoryId: definition.factoryId, source },
    review: {
      factoryId: definition.factoryId,
      actionCount: definition.actions.length,
      socketNames: definition.sockets.map(({ name }) => name),
      dimensions: definition.bounds,
      groundOffset: definition.bounds.groundOffset,
      catalogPreviewStatus: "recapture-required",
      importedFiles: "none",
    },
  };

  const restPose = new Map(
    [...joints.entries()].map(([name, joint]) => [name, {
      position: joint.position.clone(),
      rotation: joint.rotation.clone(),
      scale: joint.scale.clone(),
    }]),
  );
  let action: MonsterActionName = "Idle";
  let elapsed = 0;
  let completed = false;
  let paused = false;
  let disposed = false;

  const assertLive = () => {
    if (disposed) throw new Error("Monster instance is disposed");
  };
  const resetPose = () => {
    for (const [name, pose] of restPose) {
      const joint = joints.get(name)!;
      joint.position.copy(pose.position);
      joint.rotation.copy(pose.rotation);
      joint.scale.copy(pose.scale);
    }
  };
  const applyPose = () => {
    resetPose();
    const progress = Math.min(elapsed / MONSTER_ACTION_DURATIONS[action], 1);
    poseRecipe(definition.factoryId, joints, action, progress);
    if (loopedActions.has(action)) {
      compensateGrounding(root, motion, groundContacts, definition.bounds.groundOffset);
    }
  };

  return {
    root,
    joints,
    sockets,
    groundContacts,
    collider,
    playAction(nextAction) {
      assertLive();
      if (!(nextAction in MONSTER_ACTION_DURATIONS)) throw new Error(`Unknown monster action: ${String(nextAction)}`);
      action = nextAction;
      elapsed = 0;
      completed = false;
      root.userData.action = action;
      applyPose();
    },
    setPaused(nextPaused) {
      assertLive();
      paused = Boolean(nextPaused);
    },
    update(deltaSeconds) {
      assertLive();
      if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
        throw new TypeError("deltaSeconds must be a finite non-negative number");
      }
      if (paused) return;
      const delta = Math.min(deltaSeconds, 0.05);
      const duration = MONSTER_ACTION_DURATIONS[action];
      if (loopedActions.has(action)) {
        const nextElapsed = elapsed + delta;
        elapsed = nextElapsed + 1e-9 >= duration
          ? (nextElapsed >= duration ? nextElapsed % duration : 0)
          : nextElapsed;
        completed = false;
      } else {
        const nextElapsed = elapsed + delta;
        completed = nextElapsed + 1e-9 >= duration;
        elapsed = completed ? duration : nextElapsed;
      }
      applyPose();
    },
    getActionState() {
      assertLive();
      return { name: action, elapsed, progress: Math.min(elapsed / MONSTER_ACTION_DURATIONS[action], 1), completed };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      colliderRoot.removeFromParent();
      scope.dispose();
    },
    isDisposed: () => disposed,
  };
}

function buildBiped(context: RecipeContext): void {
  const { body, joints } = context;
  const pelvis = joint(context, body, "pelvis", [0, 1.05, 0]);
  const spine = joint(context, pelvis, "spine", [0, 0.45, 0]);
  const neck = joint(context, spine, "neck", [0, 0.4, 0]);
  const head = joint(context, neck, "head", [0, 0.25, 0.04]);
  visual(context, pelvis, "pelvis-visual", new BoxGeometry(0.48, 0.28, 0.3), 0x3b3437);
  visual(context, spine, "robe-torso", new ConeGeometry(0.42, 0.78, 8), 0x3b3437, [0, 0.12, 0]);
  visual(context, head, "mask", new SphereGeometry(0.21, 8, 6), 0x9c4a30, [0, 0.12, 0]);
  humanoidLimbs(context, pelvis, spine, { arm: 0.62, leg: 0.72, color: 0x9c4a30 });
  const hand = joints.get("hand-r")!;
  visual(context, hand, "staff", new CylinderGeometry(0.035, 0.035, 1.5, 6), 0xd26737, [0, -0.62, 0]);
}

function buildCrawler(context: RecipeContext): void {
  const { body } = context;
  const abdomen = joint(context, body, "abdomen", [0, 0.42, -0.35]);
  const thorax = joint(context, abdomen, "thorax", [0, 0, 0.52]);
  const crown = joint(context, thorax, "crystal-crown", [0, 0.18, 0.35]);
  const jaw = joint(context, crown, "jaw", [0, -0.12, 0.21]);
  visual(context, abdomen, "faceted-abdomen", new SphereGeometry(0.45, 7, 5), 0x29495c);
  visual(context, thorax, "crystal-thorax", new ConeGeometry(0.48, 0.7, 6), 0x6ca8b9, [0, 0.12, 0]);
  visual(context, crown, "crystal-crown-visual", new ConeGeometry(0.24, 0.48, 5), 0x9ce9ff, [0, 0.22, 0]);
  visual(context, jaw, "mandible", new BoxGeometry(0.28, 0.12, 0.3), 0x29495c, [0, 0, 0.13]);
  for (let pair = 1; pair <= 3; pair += 1) {
    for (const side of ["l", "r"] as const) {
      const sign = side === "l" ? 1 : -1;
      const upper = joint(context, thorax, `leg-${pair}-${side}-1`, [sign * 0.3, -0.08, 0.24 - pair * 0.2]);
      const lower = joint(context, upper, `leg-${pair}-${side}-2`, [sign * 0.35, -0.24, 0.02]);
      visual(context, upper, `leg-${pair}-${side}-upper`, new CylinderGeometry(0.045, 0.07, 0.42, 5), 0x6ca8b9, [sign * 0.14, -0.12, 0], [0, 0, sign * 0.85]);
      const foot = joint(context, lower, `foot-${pair}-${side}`, [sign * 0.28, -0.31, 0]);
      visual(context, lower, `leg-${pair}-${side}-lower`, new CylinderGeometry(0.035, 0.05, 0.36, 5), 0x29495c, [sign * 0.14, -0.13, 0], [0, 0, sign * 0.85]);
      visual(context, foot, `foot-${pair}-${side}-visual`, new BoxGeometry(0.12, 0.05, 0.16), 0x29495c, [0, 0.025, 0.04]);
    }
  }
}

function buildArmored(context: RecipeContext): void {
  const { body, joints } = context;
  const armorShell = joint(context, body, "armor-shell", [0, 0, 0]);
  const pelvis = joint(context, armorShell, "pelvis", [0, 0.92, 0]);
  const chest = joint(context, pelvis, "chest", [0, 0.48, 0]);
  const neck = joint(context, chest, "neck", [0, 0.38, 0]);
  const helm = joint(context, neck, "bell-helm", [0, 0.22, 0.03]);
  visual(context, pelvis, "armored-pelvis", new BoxGeometry(0.68, 0.35, 0.44), 0x342c27);
  visual(context, chest, "broad-cuirass", new BoxGeometry(0.92, 0.64, 0.5), 0x7a6b57, [0, 0.08, 0]);
  visual(context, helm, "bell-helm-visual", new ConeGeometry(0.34, 0.52, 10), 0xd5ac4f, [0, 0.1, 0]);
  humanoidLimbs(context, pelvis, chest, { arm: 0.55, leg: 0.62, color: 0x7a6b57 });
  const hand = joints.get("hand-r")!;
  visual(context, hand, "mace-shaft", new CylinderGeometry(0.055, 0.055, 0.65, 6), 0x342c27, [0, -0.32, 0]);
  visual(context, hand, "mace-head", new SphereGeometry(0.17, 7, 6), 0xd5ac4f, [0, -0.67, 0]);
}

function buildQuadruped(context: RecipeContext): void {
  const { body } = context;
  const hips = joint(context, body, "hips", [0, 0.62, -0.5]);
  const spine = joint(context, hips, "spine", [0, 0.08, 0.68]);
  const shoulders = joint(context, spine, "shoulders", [0, 0, 0.56]);
  const neck = joint(context, shoulders, "neck", [0, 0.16, 0.27]);
  const head = joint(context, neck, "head", [0, 0.05, 0.3]);
  const jaw = joint(context, head, "jaw", [0, -0.11, 0.24]);
  const tail = joint(context, hips, "tail-1", [0, 0.04, -0.38]);
  joint(context, tail, "tail-2", [0, 0.02, -0.36]);
  visual(context, spine, "long-back", new BoxGeometry(0.58, 0.46, 1.45), 0x556847, [0, 0, 0.1]);
  visual(context, head, "hound-head", new ConeGeometry(0.29, 0.52, 6), 0x29331f, [0, 0, 0.18], [Math.PI / 2, 0, 0]);
  visual(context, jaw, "hound-jaw", new BoxGeometry(0.28, 0.1, 0.34), 0x93b567, [0, -0.02, 0.14]);
  for (const [prefix, parent, z] of [["front", shoulders, 0], ["rear", hips, 0]] as const) {
    for (const side of ["l", "r"] as const) {
      const sign = side === "l" ? 1 : -1;
      const upper = joint(context, parent, `${prefix}-leg-${side}-1`, [sign * 0.28, -0.12, z]);
      const lower = joint(context, upper, `${prefix}-leg-${side}-2`, [0, -0.38, 0.08]);
      visual(context, upper, `${prefix}-leg-${side}-upper`, new CylinderGeometry(0.06, 0.09, 0.46, 6), 0x556847, [0, -0.18, 0]);
      const foot = joint(context, lower, `${prefix}-foot-${side}`, [0, -0.36, 0.04]);
      visual(context, lower, `${prefix}-leg-${side}-lower`, new CylinderGeometry(0.045, 0.06, 0.3, 6), 0x29331f, [0, -0.16, 0.04]);
      visual(context, foot, `${prefix}-foot-${side}-visual`, new BoxGeometry(0.2, 0.08, 0.3), 0x29331f, [0, 0.04, 0.08]);
    }
  }
}

function humanoidLimbs(
  context: RecipeContext,
  pelvis: Object3D,
  spine: Object3D,
  options: { arm: number; leg: number; color: number },
): void {
  for (const side of ["l", "r"] as const) {
    const sign = side === "l" ? 1 : -1;
    const shoulder = joint(context, spine, `shoulder-${side}`, [sign * 0.38, 0.2, 0]);
    const elbow = joint(context, shoulder, `elbow-${side}`, [sign * 0.3, -0.35, 0]);
    const wrist = joint(context, elbow, `wrist-${side}`, [sign * 0.16, -0.32, 0]);
    const hand = joint(context, wrist, `hand-${side}`, [sign * 0.04, -0.12, 0]);
    visual(context, shoulder, `upper-arm-${side}`, new CylinderGeometry(0.065, 0.09, options.arm, 6), options.color, [sign * 0.12, -0.14, 0], [0, 0, sign * 0.65]);
    visual(context, elbow, `forearm-${side}`, new CylinderGeometry(0.05, 0.07, options.arm, 6), options.color, [sign * 0.08, -0.14, 0], [0, 0, sign * 0.42]);
    visual(context, hand, `hand-${side}-visual`, new SphereGeometry(0.09, 6, 5), options.color);
    const hip = joint(context, pelvis, `hip-${side}`, [sign * 0.22, -0.13, 0]);
    const knee = joint(context, hip, `knee-${side}`, [0, -options.leg, 0.04]);
    const ankle = joint(context, knee, `ankle-${side}`, [0, -options.leg, -0.04]);
    const foot = joint(context, ankle, `foot-${side}`, [0, -0.08, 0.12]);
    visual(context, hip, `thigh-${side}`, new CylinderGeometry(0.08, 0.11, options.leg, 6), options.color, [0, -options.leg / 2, 0]);
    visual(context, knee, `shin-${side}`, new CylinderGeometry(0.065, 0.08, options.leg, 6), options.color, [0, -options.leg / 2, 0]);
    visual(context, foot, `foot-${side}-visual`, new BoxGeometry(0.2, 0.12, 0.3), options.color, [0, 0.06, 0.09]);
  }
}

function createDefinitionSockets(context: RecipeContext, sockets: Map<string, Object3D>): void {
  const fallback = context.body;
  for (const socketDefinition of context.definition.sockets) {
    const socket = namedGroup(socketDefinition.name);
    socket.userData = { type: "socket", bone: socketDefinition.bone };
    const parent = socketDefinition.bone === "root"
      ? context.root
      : (context.joints.get(socketDefinition.bone) ?? fallback);
    parent.add(socket);
    sockets.set(socketDefinition.name, socket);
  }
  const rightHand = context.joints.get("hand-r");
  if (rightHand && !sockets.has("right-hand")) {
    const socket = namedGroup("right-hand");
    rightHand.add(socket);
    sockets.set("right-hand", socket);
  }
}

function poseRecipe(factoryId: MonsterDefinition["factoryId"], joints: ReadonlyMap<string, Object3D>, action: MonsterActionName, progress: number): void {
  const phase = progress * Math.PI * 2;
  const rotate = (name: string, axis: "x" | "y" | "z", value: number) => {
    const jointNode = joints.get(name);
    if (jointNode) jointNode.rotation[axis] += value;
  };
  const trunk = {
    biped: "spine",
    crawler: "thorax",
    armored: "chest",
    quadruped: "spine",
  }[factoryId];
  if (action === "Idle") {
    rotate(trunk, "y", (1 - Math.cos(phase)) * 0.04);
  } else if (action === "Walk") {
    const gaitChains: readonly (readonly [leg: string, foot: string])[] = ({
      biped: [["hip-l", "foot-l"], ["hip-r", "foot-r"]],
      crawler: [
        ["leg-1-l-1", "foot-1-l"],
        ["leg-1-r-1", "foot-1-r"],
        ["leg-2-l-1", "foot-2-l"],
        ["leg-2-r-1", "foot-2-r"],
        ["leg-3-l-1", "foot-3-l"],
        ["leg-3-r-1", "foot-3-r"],
      ],
      armored: [["hip-l", "foot-l"], ["hip-r", "foot-r"]],
      quadruped: [
        ["front-leg-l-1", "front-foot-l"],
        ["front-leg-r-1", "front-foot-r"],
        ["rear-leg-l-1", "rear-foot-l"],
        ["rear-leg-r-1", "rear-foot-r"],
      ],
    } as const)[factoryId];
    for (const [index, [leg, foot]] of gaitChains.entries()) {
      const side = index % 2 === 0 ? 1 : -1;
      const angle = side * (1 - Math.cos(phase)) * 0.24;
      rotate(leg, "x", angle);
      rotate(foot, "x", -angle);
    }
  } else if (action === "Attack") {
    const weight = Math.sin(progress * Math.PI);
    if (factoryId === "biped") {
      rotate("spine", "x", -weight * 0.5);
      rotate("shoulder-r", "x", -weight * 0.9);
    } else if (factoryId === "crawler") {
      rotate("jaw", "x", weight * 0.55);
    } else if (factoryId === "armored") {
      rotate("chest", "x", -weight * 0.5);
      rotate("shoulder-r", "x", -weight * 0.75);
    } else {
      rotate("jaw", "x", weight * 0.55);
      rotate("spine", "x", -weight * 0.18);
    }
  } else if (action === "Hit") {
    rotate(trunk, "z", Math.sin(progress * Math.PI) * 0.22);
  } else if (action === "Death") {
    rotate(trunk, "z", Math.min(progress * 1.25, Math.PI / 2));
  }
}

function joint(context: RecipeContext, parent: Object3D, name: string, position: [number, number, number]): Group {
  const node = namedGroup(name);
  node.position.set(...position);
  parent.add(node);
  context.joints.set(name, node);
  return node;
}

function visual(
  context: RecipeContext,
  parent: Object3D,
  name: string,
  geometry: BufferGeometry,
  color: number,
  position: [number, number, number] = [0, 0, 0],
  rotation: [number, number, number] = [0, 0, 0],
): Mesh {
  const material = new MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.1 });
  context.scope.track(geometry);
  context.scope.track(material as Material);
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.userData = { visual: true, collider: false };
  parent.add(mesh);
  return mesh;
}

function namedGroup(name: string): Group {
  const group = new Group();
  group.name = name;
  return group;
}

function requiredJoint(joints: ReadonlyMap<string, Object3D>, name: string): Object3D {
  const jointNode = joints.get(name);
  if (!jointNode) throw new Error(`Recipe is missing required ground contact joint: ${name}`);
  return jointNode;
}

function compensateGrounding(
  root: Object3D,
  motion: Object3D,
  contacts: readonly MonsterGroundContact[],
  groundOffset: number,
): void {
  root.updateWorldMatrix(true, true);
  const world = new Vector3();
  let lowestContact = Number.POSITIVE_INFINITY;
  for (const { joint: contact } of contacts) {
    contact.getWorldPosition(world);
    lowestContact = Math.min(lowestContact, root.worldToLocal(world.clone()).y);
  }
  motion.position.y += groundOffset - lowestContact;
  root.updateWorldMatrix(true, true);
}
