import {
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Fog,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  RingGeometry,
  Scene,
  WebGLRenderer,
} from "three";

interface FlatPoint {
  x: number;
  y: 0;
  z: number;
}

interface FlatZone extends FlatPoint {
  id: "training" | "wave" | "elite" | "boss";
  radius: number;
}

interface FlatBox extends FlatPoint {
  id: string;
  halfWidth: number;
  halfDepth: number;
  kind: "perimeter" | "interior" | "gate";
}

interface LocalLightRecord {
  id: string;
  emitterId: string;
  position: FlatPoint;
  color: number;
  intensity: number;
  range: number;
  enabled: boolean;
}

export const ARENA_LEVEL = {
  id: "ashfall-arena",
  width: 36,
  depth: 24,
  gameplayPlaneY: 0,
  anchors: {
    spawn: { id: "spawn", x: 0, y: 0, z: -9 },
    training: { id: "training-center", x: 0, y: 0, z: -5 },
    wave: { id: "wave-center", x: 0, y: 0, z: 0 },
    elite: { id: "elite-center", x: 0, y: 0, z: 6 },
    boss: { id: "boss-center", x: 0, y: 0, z: 10 },
  },
  zones: [
    { id: "training", x: 0, y: 0, z: -5, radius: 2 },
    { id: "wave", x: 0, y: 0, z: 0, radius: 6 },
    { id: "elite", x: 0, y: 0, z: 6, radius: 4 },
    { id: "boss", x: 0, y: 0, z: 10, radius: 6 },
  ] satisfies FlatZone[],
  navigation: {
    points: [
      { id: "nav-spawn", x: 0, y: 0, z: -9 },
      { id: "nav-training", x: 0, y: 0, z: -5 },
      { id: "nav-wave-left", x: -2.2, y: 0, z: 0 },
      { id: "nav-wave-right", x: 2.2, y: 0, z: 0 },
      { id: "nav-elite", x: 0, y: 0, z: 6 },
      { id: "nav-boss", x: 0, y: 0, z: 10 },
    ],
    links: [
      { id: "link-spawn-training", from: "nav-spawn", to: "nav-training", slope: 0 },
      { id: "link-training-wave-left", from: "nav-training", to: "nav-wave-left", slope: 0 },
      { id: "link-training-wave-right", from: "nav-training", to: "nav-wave-right", slope: 0 },
      { id: "link-wave-elite-left", from: "nav-wave-left", to: "nav-elite", slope: 0 },
      { id: "link-wave-elite-right", from: "nav-wave-right", to: "nav-elite", slope: 0 },
      { id: "link-elite-boss", from: "nav-elite", to: "nav-boss", slope: 0, gateId: "boss-gate" },
    ],
    minimumRouteClearance: 3.2,
  },
  blockers: [
    { id: "blocker-west-anvil", x: -6.3, y: 0, z: -0.5, halfWidth: 1.2, halfDepth: 1.45, kind: "interior" },
    { id: "blocker-east-brazier-bank", x: 6.1, y: 0, z: 3.2, halfWidth: 1.25, halfDepth: 1.2, kind: "interior" },
  ] satisfies FlatBox[],
  collisions: [
    { id: "collision-north", x: 0, y: 0, z: 12, halfWidth: 18, halfDepth: 0.3, kind: "perimeter" },
    { id: "collision-south", x: 0, y: 0, z: -12, halfWidth: 18, halfDepth: 0.3, kind: "perimeter" },
    { id: "collision-west", x: -18, y: 0, z: 0, halfWidth: 0.3, halfDepth: 12, kind: "perimeter" },
    { id: "collision-east", x: 18, y: 0, z: 0, halfWidth: 0.3, halfDepth: 12, kind: "perimeter" },
    { id: "collision-west-anvil", x: -6.3, y: 0, z: -0.5, halfWidth: 1.2, halfDepth: 1.45, kind: "interior" },
    { id: "collision-east-brazier-bank", x: 6.1, y: 0, z: 3.2, halfWidth: 1.25, halfDepth: 1.2, kind: "interior" },
    { id: "boss-gate", x: 0, y: 0, z: 8, halfWidth: 2.6, halfDepth: 0.22, kind: "gate" },
  ] satisfies FlatBox[],
  visualIds: [
    "visual-floor",
    "visual-wall-north",
    "visual-wall-south",
    "visual-wall-west",
    "visual-wall-east",
    "visual-west-anvil",
    "visual-east-brazier-bank",
    "visual-boss-gate",
  ],
  worldLights: [
    {
      id: "ambient-ash-sky",
      kind: "ambient",
      purpose: "global route and silhouette readability",
    },
  ],
  localLights: [
    { id: "light-training-west", emitterId: "emitter-training-west", position: { x: -3.5, y: 0, z: -5 }, color: 0xff9348, intensity: 13, range: 7, enabled: true },
    { id: "light-training-east", emitterId: "emitter-training-east", position: { x: 3.5, y: 0, z: -5 }, color: 0xff9348, intensity: 13, range: 7, enabled: true },
    { id: "light-elite-west", emitterId: "emitter-elite-west", position: { x: -5.2, y: 0, z: 6 }, color: 0xe9b04e, intensity: 12, range: 7, enabled: true },
    { id: "light-elite-east", emitterId: "emitter-elite-east", position: { x: 5.2, y: 0, z: 6 }, color: 0xe9b04e, intensity: 12, range: 7, enabled: true },
  ] satisfies LocalLightRecord[],
} as const;

const gameplayRecords = [
  ...Object.values(ARENA_LEVEL.anchors),
  ...ARENA_LEVEL.zones,
  ...ARENA_LEVEL.navigation.points,
  ...ARENA_LEVEL.blockers,
  ...ARENA_LEVEL.collisions,
  ...ARENA_LEVEL.localLights.map(({ id, position }) => ({ id, ...position })),
];

const distanceToBox = (point: { x: number; z: number }, box: FlatBox) => {
  const outsideX = Math.max(0, Math.abs(point.x - box.x) - box.halfWidth);
  const outsideZ = Math.max(0, Math.abs(point.z - box.z) - box.halfDepth);
  return Math.hypot(outsideX, outsideZ);
};

const measuredRouteClearance = (
  points: ReadonlyArray<{ x: number; z: number }>,
) => {
  const authoredSolids = ARENA_LEVEL.collisions.filter(
    ({ kind }) => kind === "interior",
  );
  let clearance = Number.POSITIVE_INFINITY;
  for (let segment = 1; segment < points.length; segment += 1) {
    const start = points[segment - 1]!;
    const end = points[segment]!;
    for (let sample = 0; sample <= 100; sample += 1) {
      const alpha = sample / 100;
      const point = {
        x: start.x + (end.x - start.x) * alpha,
        z: start.z + (end.z - start.z) * alpha,
      };
      for (const solid of authoredSolids) {
        clearance = Math.min(clearance, distanceToBox(point, solid));
      }
    }
  }
  return clearance;
};

export function getArenaDiagnostics() {
  return {
    outOfPlaneIds: gameplayRecords
      .filter(({ y }) => Math.abs(y - ARENA_LEVEL.gameplayPlaneY) > 1e-6)
      .map(({ id }) => id),
    walkableSlopes: ARENA_LEVEL.navigation.links
      .filter(({ slope }) => slope !== 0)
      .map(({ id }) => id),
    interiorBlockerIds: ARENA_LEVEL.blockers.map(({ id }) => id),
    layerIds: {
      visual: [...ARENA_LEVEL.visualIds],
      collision: ARENA_LEVEL.collisions.map(({ id }) => id),
    },
    routeClearance: {
      spawnToTraining: measuredRouteClearance([
        ARENA_LEVEL.anchors.spawn,
        ARENA_LEVEL.anchors.training,
      ]),
      trainingToBoss: measuredRouteClearance([
        ARENA_LEVEL.anchors.training,
        ARENA_LEVEL.anchors.wave,
        ARENA_LEVEL.anchors.elite,
        ARENA_LEVEL.anchors.boss,
      ]),
    },
    ambientLightIds: ARENA_LEVEL.worldLights.map(({ id }) => id),
    localLights: ARENA_LEVEL.localLights.map((light) => ({
      id: light.id,
      emitterId: light.emitterId,
      attached: true,
      emitterVisible: true,
      enabled: light.enabled,
    })),
  };
}

const intersects = (
  point: { x: number; z: number },
  radius: number,
  box: FlatBox,
) =>
  Math.abs(point.x - box.x) < box.halfWidth + radius &&
  Math.abs(point.z - box.z) < box.halfDepth + radius;

const crosses = (
  start: { x: number; z: number },
  target: { x: number; z: number },
  radius: number,
  box: FlatBox,
) => {
  const minX = box.x - box.halfWidth - radius;
  const maxX = box.x + box.halfWidth + radius;
  const minZ = box.z - box.halfDepth - radius;
  const maxZ = box.z + box.halfDepth + radius;
  const deltaX = target.x - start.x;
  const deltaZ = target.z - start.z;
  let entry = 0;
  let exit = 1;
  for (const [origin, delta, min, max] of [
    [start.x, deltaX, minX, maxX],
    [start.z, deltaZ, minZ, maxZ],
  ] as const) {
    if (Math.abs(delta) < 1e-9) {
      if (origin < min || origin > max) return false;
      continue;
    }
    const first = (min - origin) / delta;
    const second = (max - origin) / delta;
    entry = Math.max(entry, Math.min(first, second));
    exit = Math.min(exit, Math.max(first, second));
    if (entry > exit) return false;
  }
  return entry <= 1 && exit >= 0;
};

export function resolveArenaMovement(
  start: { x: number; z: number },
  target: { x: number; z: number },
  actorRadius: number,
  gateOpen: boolean,
): { x: number; z: number } {
  const bounded = {
    x: Math.max(-18 + actorRadius, Math.min(18 - actorRadius, target.x)),
    z: Math.max(-12 + actorRadius, Math.min(12 - actorRadius, target.z)),
  };
  const solids = ARENA_LEVEL.collisions.filter(
    ({ kind }) => kind === "interior" || (kind === "gate" && !gateOpen),
  );

  if (
    !solids.some(
      (box) =>
        intersects(bounded, actorRadius, box) ||
        crosses(start, bounded, actorRadius, box),
    )
  ) {
    return bounded;
  }

  const xOnly = { x: bounded.x, z: start.z };
  if (
    !solids.some(
      (box) =>
        intersects(xOnly, actorRadius, box) ||
        crosses(start, xOnly, actorRadius, box),
    )
  ) return xOnly;
  const zOnly = { x: start.x, z: bounded.z };
  if (
    !solids.some(
      (box) =>
        intersects(zOnly, actorRadius, box) ||
        crosses(start, zOnly, actorRadius, box),
    )
  ) return zOnly;
  return { ...start };
}

export interface ArenaScene {
  scene: Scene;
  renderer: WebGLRenderer;
  setGateOpen(open: boolean): void;
  resize(width: number, height: number, pixelRatio?: number): void;
  render(camera: PerspectiveCamera): void;
  getDiagnostics(): {
    localLights: Array<{
      id: string;
      emitterId: string;
      attached: boolean;
      emitterVisible: boolean;
    }>;
  };
  dispose(): void;
}

export function createArenaScene(canvas: HTMLCanvasElement): ArenaScene {
  const scene = new Scene();
  scene.userData.provenance = {
    type: "procedural",
    factoryId: "create-arena-scene",
    source: "project-authored Three.js primitives and explicit level data",
    importedFiles: "none",
  };
  scene.background = new Color(0x121014);
  scene.fog = new Fog(0x121014, 22, 44);
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x121014, 1);

  const ownedGeometry = new Set<BufferGeometry>();
  const ownedMaterial = new Set<MeshBasicMaterial | MeshStandardMaterial>();
  const track = <T extends Mesh>(mesh: T): T => {
    ownedGeometry.add(mesh.geometry);
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    materials.forEach((material) =>
      ownedMaterial.add(material as MeshBasicMaterial | MeshStandardMaterial),
    );
    return mesh;
  };

  const groundMaterial = new MeshStandardMaterial({
    color: 0x30272a,
    roughness: 0.98,
    metalness: 0.02,
  });
  const floor = track(
    new Mesh(new PlaneGeometry(36, 24, 12, 8), groundMaterial),
  );
  floor.name = "visual-floor";
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const ringColors: Record<FlatZone["id"], number> = {
    training: 0xf0a342,
    wave: 0xaa5149,
    elite: 0xd6b65b,
    boss: 0xb83f52,
  };
  for (const zone of ARENA_LEVEL.zones) {
    const material = new MeshBasicMaterial({
      color: ringColors[zone.id],
      transparent: true,
      opacity: zone.id === "training" ? 0.68 : 0.25,
      depthWrite: false,
    });
    const ring = track(
      new Mesh(new RingGeometry(zone.radius - 0.08, zone.radius, 64), material),
    );
    ring.name = `visual-zone-${zone.id}`;
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(zone.x, 0.018, zone.z);
    scene.add(ring);
  }

  const wallMaterial = new MeshStandardMaterial({
    color: 0x514146,
    roughness: 0.9,
    metalness: 0.05,
  });
  const addWall = (
    name: string,
    width: number,
    depth: number,
    x: number,
    z: number,
  ) => {
    const wall = track(
      new Mesh(new BoxGeometry(width, 1.6, depth), wallMaterial),
    );
    wall.name = name;
    wall.position.set(x, 0.8, z);
    wall.receiveShadow = true;
    wall.castShadow = true;
    scene.add(wall);
  };
  addWall("visual-wall-north", 36, 0.55, 0, 12);
  addWall("visual-wall-south", 36, 0.55, 0, -12);
  addWall("visual-wall-west", 0.55, 24, -18, 0);
  addWall("visual-wall-east", 0.55, 24, 18, 0);

  const blockerMaterial = new MeshStandardMaterial({
    color: 0x46383a,
    roughness: 0.78,
    metalness: 0.16,
  });
  for (const blocker of ARENA_LEVEL.blockers) {
    const mesh = track(
      new Mesh(
        new BoxGeometry(blocker.halfWidth * 2, 1.3, blocker.halfDepth * 2),
        blockerMaterial,
      ),
    );
    mesh.name =
      blocker.id === "blocker-west-anvil"
        ? "visual-west-anvil"
        : "visual-east-brazier-bank";
    mesh.position.set(blocker.x, 0.65, blocker.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  const gateMaterial = new MeshStandardMaterial({
    color: 0x805235,
    emissive: 0x35140d,
    emissiveIntensity: 0.45,
    roughness: 0.46,
    metalness: 0.58,
  });
  const gate = new Group();
  gate.name = "visual-boss-gate";
  for (const x of [-2.25, -1.5, -0.75, 0, 0.75, 1.5, 2.25]) {
    const bar = track(
      new Mesh(new BoxGeometry(0.14, 2.7, 0.22), gateMaterial),
    );
    bar.position.set(x, 1.35, 0);
    gate.add(bar);
  }
  gate.position.set(0, 0, 8);
  scene.add(gate);

  const ambient = new AmbientLight(0x8d8a9b, 1.65);
  ambient.name = "ambient-ash-sky";
  scene.add(ambient);

  const brazierMetal = new MeshStandardMaterial({
    color: 0x3b3032,
    roughness: 0.56,
    metalness: 0.62,
  });
  const flameMaterial = new MeshBasicMaterial({ color: 0xffa24d });
  for (const record of ARENA_LEVEL.localLights) {
    const emitter = new Group();
    emitter.name = record.emitterId;
    emitter.position.set(record.position.x, 0, record.position.z);
    emitter.userData.visibleEmitter = true;
    const stem = track(
      new Mesh(new CylinderGeometry(0.12, 0.18, 1.05, 7), brazierMetal),
    );
    stem.position.y = 0.52;
    const bowl = track(
      new Mesh(new CylinderGeometry(0.42, 0.18, 0.22, 8), brazierMetal),
    );
    bowl.position.y = 1.08;
    const flame = track(
      new Mesh(new CylinderGeometry(0.03, 0.18, 0.42, 7), flameMaterial),
    );
    flame.name = `${record.emitterId}-flame`;
    flame.position.y = 1.38;
    emitter.add(stem, bowl, flame);
    const light = new PointLight(
      record.color,
      record.enabled ? record.intensity : 0,
      record.range,
      2,
    );
    light.name = record.id;
    light.position.y = 1.38;
    light.userData.emitterId = record.emitterId;
    emitter.add(light);
    scene.add(emitter);
  }

  let disposed = false;
  return {
    scene,
    renderer,
    setGateOpen(open) {
      gate.position.y = open ? -3.2 : 0;
      gate.visible = !open;
    },
    resize(width, height, pixelRatio = window.devicePixelRatio || 1) {
      renderer.setPixelRatio(Math.min(2, Math.max(1, pixelRatio)));
      renderer.setSize(Math.max(1, width), Math.max(1, height), false);
    },
    render(camera) {
      renderer.render(scene, camera);
    },
    getDiagnostics() {
      return {
        localLights: ARENA_LEVEL.localLights.map((record) => {
          const light = scene.getObjectByName(record.id);
          const emitter = scene.getObjectByName(record.emitterId);
          const flame = scene.getObjectByName(`${record.emitterId}-flame`);
          return {
            id: record.id,
            emitterId: record.emitterId,
            attached: light?.parent === emitter,
            emitterVisible: Boolean(emitter?.visible && flame?.visible),
          };
        }),
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      ownedGeometry.forEach((geometry) => geometry.dispose());
      ownedMaterial.forEach((material) => material.dispose());
      renderer.dispose();
      scene.clear();
    },
  };
}
