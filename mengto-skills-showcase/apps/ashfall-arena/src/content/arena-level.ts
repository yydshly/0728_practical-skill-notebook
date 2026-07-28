export interface ArenaFlatPoint {
  x: number;
  y: 0;
  z: number;
}

export interface ArenaZone extends ArenaFlatPoint {
  id: "training" | "wave" | "elite" | "boss";
  radius: number;
}

import type { ArenaCollisionData } from "../simulation/types";

export interface ArenaLocalLight {
  id: string;
  emitterId: string;
  position: ArenaFlatPoint;
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
  ] satisfies ArenaZone[],
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
  },
  collisions: [
    { id: "collision-north", x: 0, y: 0, z: 12, halfWidth: 18, halfDepth: 0.3, height: 1.6, kind: "perimeter" },
    { id: "collision-south", x: 0, y: 0, z: -12, halfWidth: 18, halfDepth: 0.3, height: 1.6, kind: "perimeter" },
    { id: "collision-west", x: -18, y: 0, z: 0, halfWidth: 0.3, halfDepth: 12, height: 1.6, kind: "perimeter" },
    { id: "collision-east", x: 18, y: 0, z: 0, halfWidth: 0.3, halfDepth: 12, height: 1.6, kind: "perimeter" },
    { id: "collision-west-anvil", x: -6.3, y: 0, z: -0.5, halfWidth: 1.2, halfDepth: 1.45, height: 1.3, kind: "interior" },
    { id: "collision-east-brazier-bank", x: 6.1, y: 0, z: 3.2, halfWidth: 1.25, halfDepth: 1.2, height: 8, kind: "interior" },
    { id: "boss-portal-west-wall", x: -10.3, y: 0, z: 8, halfWidth: 7.7, halfDepth: 0.3, height: 3.4, kind: "portal-wall" },
    { id: "boss-portal-east-wall", x: 10.3, y: 0, z: 8, halfWidth: 7.7, halfDepth: 0.3, height: 3.4, kind: "portal-wall" },
    { id: "boss-gate", x: 0, y: 0, z: 8, halfWidth: 2.6, halfDepth: 0.3, height: 2.7, kind: "gate" },
  ] satisfies ArenaCollisionData[],
  collisionVisuals: [
    { id: "visual-wall-north", collisionId: "collision-north", color: 0x514146 },
    { id: "visual-wall-south", collisionId: "collision-south", color: 0x514146 },
    { id: "visual-wall-west", collisionId: "collision-west", color: 0x514146 },
    { id: "visual-wall-east", collisionId: "collision-east", color: 0x514146 },
    { id: "visual-west-anvil", collisionId: "collision-west-anvil", color: 0x46383a },
    { id: "visual-east-brazier-bank", collisionId: "collision-east-brazier-bank", color: 0x46383a },
    { id: "visual-boss-west-wall", collisionId: "boss-portal-west-wall", color: 0x514146 },
    { id: "visual-boss-east-wall", collisionId: "boss-portal-east-wall", color: 0x514146 },
  ],
  visualIds: [
    "visual-floor",
    "visual-wall-north",
    "visual-wall-south",
    "visual-wall-west",
    "visual-wall-east",
    "visual-west-anvil",
    "visual-east-brazier-bank",
    "visual-boss-west-wall",
    "visual-boss-east-wall",
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
  ] satisfies ArenaLocalLight[],
} as const;

const gameplayRecords = [
  ...Object.values(ARENA_LEVEL.anchors),
  ...ARENA_LEVEL.zones,
  ...ARENA_LEVEL.navigation.points,
  ...ARENA_LEVEL.collisions,
  ...ARENA_LEVEL.localLights.map(({ id, position }) => ({ id, ...position })),
];

const distanceToBox = (
  point: { x: number; z: number },
  box: ArenaCollisionData,
) => {
  const outsideX = Math.max(0, Math.abs(point.x - box.x) - box.halfWidth);
  const outsideZ = Math.max(0, Math.abs(point.z - box.z) - box.halfDepth);
  return Math.hypot(outsideX, outsideZ);
};

const measuredRouteClearance = (
  points: ReadonlyArray<{ x: number; z: number }>,
) => {
  const authoredSolids = ARENA_LEVEL.collisions.filter(
    ({ kind }) => kind === "interior" || kind === "portal-wall",
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
    interiorBlockerIds: ARENA_LEVEL.collisions
      .filter(({ kind }) => kind === "interior")
      .map(({ id }) => id),
    portalCollisionIds: ARENA_LEVEL.collisions
      .filter(({ kind }) => kind === "portal-wall" || kind === "gate")
      .map(({ id }) => id),
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
