export type OrchardSensorId =
  | 'parking' | 'tree-inventory' | 'basket'
  | 'crate' | 'cargo-slot' | 'delivery'

export interface WorldPoint { x: number; y: number; z: number }
export interface WorldPose {
  translation: WorldPoint
  yawRadians: number
}
export interface WorldSensor {
  id: OrchardSensorId
  translation: WorldPoint
  halfExtents: WorldPoint
  visualBinding:
    | { kind: 'world-node'; nodeName: string }
    | { kind: 'tree-instance'; instanceId: string }
    | { kind: 'vehicle-anchor'; nodeName: 'cargo_slot_01' }
}
export interface OrchardTreeInstance {
  id: string
  variant: 'a' | 'b' | 'c'
  translation: WorldPoint
  yawRadians: number
  uniformScale: number
}
export type WorldObstacle =
  | { id: string; kind: 'box'; translation: WorldPoint; halfExtents: WorldPoint }
  | { id: string; kind: 'trunk'; translation: WorldPoint; radiusM: number; halfHeightM: number }

export interface OrchardLocalLight {
  id: string
  emitter: { landmarkId: string; nodeName: string }
  attachment: WorldPose
  type: 'point' | 'spot'
  rangeM: number
  color: number
  intensity: number
  castsShadow: boolean
  occlusionIntent: 'casts-shadow' | 'unoccluded'
  enabled: boolean
  fallback: 'disable-when-emitter-unavailable'
}

export interface OrchardWorldDefinition {
  bounds: { widthM: 80; depthM: 60 }
  gameplayPlaneY: 0
  vehicleCorridorHalfWidthM: 2.5
  spawnPoses: { vehicle: WorldPose; player: WorldPose }
  route: { outbound: readonly WorldPoint[]; returning: readonly WorldPoint[] }
  sensors: WorldSensor[]
  safePoints: Array<{ id: string; pose: WorldPose }>
  treeInstances: OrchardTreeInstance[]
  obstacles: WorldObstacle[]
  landmarks: Array<{ id: string; nodeName: string; translation: WorldPoint }>
  lighting: {
    sun: { id: 'orchard-sun'; direction: WorldPoint; color: 0xffe0b2; intensity: 2.6 }
    sky: { id: 'orchard-sky'; color: 0xbfd8e8; groundColor: 0x6a513b; intensity: 1.25 }
    localLights: OrchardLocalLight[]
  }
}

const ROW_X = [-13.5, -9, -4.5, 4.5, 9, 13.5] as const
const TREE_Z = [12, 16.5, 21, 25.5, 30] as const
const OUTBOUND = [
  { x: 0, y: 0, z: -16.5 },
  { x: 0, y: 0, z: -5 },
  { x: 0, y: 0, z: 7 },
  { x: 0, y: 0, z: 10.5 },
] as const
const RETURNING = [
  { x: 0, y: 0, z: 10.5 },
  { x: 0, y: 0, z: 6 },
  { x: 0, y: 0, z: -5 },
  { x: 0, y: 0, z: -18 },
] as const

const TREE_YAWS_RADIANS = [
  -0.45, 0.2, 0.85, -1.1, 1.35,
  0.65, -0.8, 1.1, -0.25, 0.4,
  1.45, -1.3, 0.1, 0.95, -0.6,
  0.3, -0.95, 1.25, -0.15, 0.7,
  -1.15, 0.55, -0.35, 1.4, -0.7,
  1.0, -0.1, 0.75, -1.4, 0.45,
] as const

const TREE_SCALES = [0.94, 0.97, 1, 1.03, 1.06] as const

const treeInstances: OrchardTreeInstance[] = ROW_X.flatMap((x, rowIndex) =>
  TREE_Z.map((z, columnIndex) => {
    const index = rowIndex * TREE_Z.length + columnIndex
    return {
      id: `orchard-tree-r${String(rowIndex + 1).padStart(2, '0')}-c${String(columnIndex + 1).padStart(2, '0')}`,
      variant: (['a', 'b', 'c'] as const)[index % 3]!,
      translation: { x, y: 0, z },
      yawRadians: TREE_YAWS_RADIANS[index]!,
      uniformScale: TREE_SCALES[index % TREE_SCALES.length]!,
    }
  }),
)

const obstacles: WorldObstacle[] = [
  { id: 'farmhouse', kind: 'box', translation: { x: -13, y: 0, z: -18 }, halfExtents: { x: 4.5, y: 2.5, z: 3.5 } },
  { id: 'yard-wall-west', kind: 'box', translation: { x: -18, y: 0, z: -13 }, halfExtents: { x: 0.2, y: 1.2, z: 6 } },
  { id: 'yard-wall-north', kind: 'box', translation: { x: -13, y: 0, z: -7 }, halfExtents: { x: 5.2, y: 1.2, z: 0.2 } },
  { id: 'yard-gate', kind: 'box', translation: { x: -8.2, y: 0, z: -13 }, halfExtents: { x: 0.2, y: 1.2, z: 1.5 } },
  { id: 'work-prop', kind: 'box', translation: { x: 8, y: 0, z: 8 }, halfExtents: { x: 1.2, y: 0.8, z: 1.2 } },
  ...treeInstances.map((tree): WorldObstacle => ({
    id: `${tree.id}-trunk`,
    kind: 'trunk',
    translation: { ...tree.translation },
    radiusM: 0.18,
    halfHeightM: 0.8,
  })),
]

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child)
    }
  }
  return value
}

export const ORCHARD_WORLD_DEFINITION: OrchardWorldDefinition = deepFreeze({
  bounds: { widthM: 80, depthM: 60 },
  gameplayPlaneY: 0,
  vehicleCorridorHalfWidthM: 2.5,
  spawnPoses: {
    vehicle: { translation: { x: 0, y: 0, z: -16.5 }, yawRadians: Math.PI },
    player: { translation: { x: 1.2, y: 0, z: -16.5 }, yawRadians: Math.PI },
  },
  route: { outbound: OUTBOUND, returning: RETURNING },
  sensors: [
    { id: 'parking', translation: { x: 0, y: 0, z: 10.5 }, halfExtents: { x: 1.5, y: 0.75, z: 1.5 }, visualBinding: { kind: 'world-node', nodeName: 'orchard_parking_anchor' } },
    { id: 'tree-inventory', translation: { x: 4.5, y: 0, z: 12 }, halfExtents: { x: 1, y: 1, z: 1 }, visualBinding: { kind: 'tree-instance', instanceId: 'orchard-tree-r04-c01' } },
    { id: 'basket', translation: { x: 2.6, y: 0, z: 12.5 }, halfExtents: { x: 0.75, y: 0.75, z: 0.75 }, visualBinding: { kind: 'world-node', nodeName: 'harvest_basket_anchor' } },
    { id: 'crate', translation: { x: 1.4, y: 0, z: 12.5 }, halfExtents: { x: 0.75, y: 0.75, z: 0.75 }, visualBinding: { kind: 'world-node', nodeName: 'packing_crate_anchor' } },
    { id: 'cargo-slot', translation: { x: 0.7, y: 0, z: 10.5 }, halfExtents: { x: 0.75, y: 0.75, z: 0.75 }, visualBinding: { kind: 'vehicle-anchor', nodeName: 'cargo_slot_01' } },
    { id: 'delivery', translation: { x: 0, y: 0, z: -18 }, halfExtents: { x: 1.5, y: 0.75, z: 1.5 }, visualBinding: { kind: 'world-node', nodeName: 'farmhouse_delivery_anchor' } },
  ],
  safePoints: [
    { id: 'vehicle-spawn-safe-point', pose: { translation: { x: 0, y: 0, z: -16.5 }, yawRadians: Math.PI } },
    { id: 'parking-safe-point', pose: { translation: { x: 0, y: 0, z: 10.5 }, yawRadians: 0 } },
    { id: 'delivery-safe-point', pose: { translation: { x: 0, y: 0, z: -18 }, yawRadians: 0 } },
  ],
  treeInstances,
  obstacles,
  landmarks: [
    { id: 'orchard-parking-landmark', nodeName: 'orchard_parking_anchor', translation: { x: 0, y: 0, z: 10.5 } },
    { id: 'harvest-basket-landmark', nodeName: 'harvest_basket_anchor', translation: { x: 2.6, y: 0, z: 12.5 } },
    { id: 'packing-crate-landmark', nodeName: 'packing_crate_anchor', translation: { x: 1.4, y: 0, z: 12.5 } },
    { id: 'farmhouse-delivery-landmark', nodeName: 'farmhouse_delivery_anchor', translation: { x: 0, y: 0, z: -18 } },
  ],
  lighting: {
    sun: { id: 'orchard-sun', direction: { x: -0.4, y: -1, z: 0.25 }, color: 0xffe0b2, intensity: 2.6 },
    sky: { id: 'orchard-sky', color: 0xbfd8e8, groundColor: 0x6a513b, intensity: 1.25 },
    localLights: [],
  },
})
