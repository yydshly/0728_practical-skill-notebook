import type {
  OrchardSensorId,
  OrchardWorldDefinition,
  WorldObstacle,
  WorldPoint,
  WorldSensor,
} from './orchardWorldDefinition'

const PLANE_EPSILON_M = 0.001
const MIN_TREE_CLEARANCE_M = 2.6
const CORRIDOR_WIDTH_EPSILON_M = 0.001
const PLAYER_RADIUS_M = 0.22
const GRID_SIZE_M = 0.5
const SPAWN_POSITION_EPSILON_M = 0.001
const SPAWN_YAW_EPSILON_RADIANS = 0.001
const REQUIRED_SENSOR_IDS: readonly OrchardSensorId[] = [
  'parking', 'tree-inventory', 'basket', 'crate', 'cargo-slot', 'delivery',
]

export function validateOrchardWorldDefinition(definition: OrchardWorldDefinition): void {
  validateIds(definition)
  validatePlaneAndBounds(definition)
  validateVehicleSpawnContract(definition)
  validateSensors(definition)
  validateRouteClearance(definition)
  validateTreeClearance(definition)
  validateLighting(definition)
  validateReachability(definition)
  validateRouteEndpoints(definition)
}

function validateVehicleSpawnContract(
  definition: OrchardWorldDefinition,
): void {
  const outbound = definition.route.outbound
  const firstSegment = outbound.slice(1).map((to, index) => ({
    x: to.x - outbound[index]!.x,
    z: to.z - outbound[index]!.z,
  })).find(({ x, z }) => Math.hypot(x, z) > PLANE_EPSILON_M)
  const yaw = definition.spawnPoses.vehicle.yawRadians
  if (!firstSegment || !Number.isFinite(yaw)) {
    throw new Error('WORLD_VEHICLE_SPAWN_HEADING_INVALID')
  }
  const segmentLength = Math.hypot(firstSegment.x, firstSegment.z)
  const alignment = (
    -Math.sin(yaw) * firstSegment.x
    - Math.cos(yaw) * firstSegment.z
  ) / segmentLength
  if (!Number.isFinite(alignment) || alignment <= 0) {
    throw new Error('WORLD_VEHICLE_SPAWN_HEADING_INVALID')
  }

  const safePoint = definition.safePoints.find(({ id }) => (
    id === 'vehicle-spawn-safe-point'
  ))
  const spawn = definition.spawnPoses.vehicle
  const yawDifference = safePoint
    ? Math.atan2(
        Math.sin(safePoint.pose.yawRadians - spawn.yawRadians),
        Math.cos(safePoint.pose.yawRadians - spawn.yawRadians),
      )
    : Number.NaN
  if (!safePoint
    || !Number.isFinite(yawDifference)
    || Math.abs(yawDifference) > SPAWN_YAW_EPSILON_RADIANS
    || Math.hypot(
      safePoint.pose.translation.x - spawn.translation.x,
      safePoint.pose.translation.y - spawn.translation.y,
      safePoint.pose.translation.z - spawn.translation.z,
    ) > SPAWN_POSITION_EPSILON_M) {
    throw new Error('WORLD_VEHICLE_SPAWN_SAFE_POINT_INVALID')
  }
}

function validateIds(definition: OrchardWorldDefinition): void {
  const ids = [
    ...definition.sensors.map(({ id }) => id),
    ...definition.safePoints.map(({ id }) => id),
    ...definition.treeInstances.map(({ id }) => id),
    ...definition.obstacles.map(({ id }) => id),
    ...definition.landmarks.map(({ id }) => id),
  ]
  if (new Set(ids).size !== ids.length) {
    throw new Error('WORLD_DUPLICATE_ID')
  }
}

function validatePlaneAndBounds(definition: OrchardWorldDefinition): void {
  if (definition.gameplayPlaneY !== 0) {
    throw new Error('WORLD_OUT_OF_PLANE')
  }
  if (definition.bounds.widthM !== 80 || definition.bounds.depthM !== 60) {
    throw new Error('WORLD_BOUNDS_INVALID')
  }
  const points = [
    definition.spawnPoses.vehicle.translation,
    definition.spawnPoses.player.translation,
    ...definition.route.outbound,
    ...definition.route.returning,
    ...definition.sensors.map(({ translation }) => translation),
    ...definition.safePoints.map(({ pose }) => pose.translation),
    ...definition.treeInstances.map(({ translation }) => translation),
    ...definition.obstacles.map(({ translation }) => translation),
    ...definition.landmarks.map(({ translation }) => translation),
  ]
  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z)) {
      throw new Error('WORLD_OUT_OF_PLANE')
    }
    if (Math.abs(point.y) > PLANE_EPSILON_M) {
      throw new Error('WORLD_OUT_OF_PLANE')
    }
    if (Math.abs(point.x) > definition.bounds.widthM / 2 || Math.abs(point.z) > definition.bounds.depthM / 2) {
      throw new Error('WORLD_OUT_OF_BOUNDS')
    }
  }
}

function validateSensors(definition: OrchardWorldDefinition): void {
  const sensorIds = definition.sensors.map(({ id }) => id)
  if (sensorIds.length !== REQUIRED_SENSOR_IDS.length || REQUIRED_SENSOR_IDS.some((id) => !sensorIds.includes(id))) {
    throw new Error('WORLD_SEMANTIC_SENSORS_INVALID')
  }

  const landmarkNodeNames = new Set(definition.landmarks.map(({ nodeName }) => nodeName))
  const treeIds = new Set(definition.treeInstances.map(({ id }) => id))
  for (const sensor of definition.sensors) {
    if (sensor.visualBinding.kind === 'world-node' && !landmarkNodeNames.has(sensor.visualBinding.nodeName)) {
      throw new Error(`WORLD_BINDING_INVALID: ${sensor.id}`)
    }
    if (sensor.visualBinding.kind === 'tree-instance' && !treeIds.has(sensor.visualBinding.instanceId)) {
      throw new Error(`WORLD_BINDING_INVALID: ${sensor.id}`)
    }
    if (sensor.visualBinding.kind === 'vehicle-anchor' && sensor.visualBinding.nodeName !== 'cargo_slot_01') {
      throw new Error(`WORLD_BINDING_INVALID: ${sensor.id}`)
    }
  }
}

function validateRouteClearance(definition: OrchardWorldDefinition): void {
  if (!Number.isFinite(definition.vehicleCorridorHalfWidthM)
    || Math.abs(definition.vehicleCorridorHalfWidthM - 2.5) > CORRIDOR_WIDTH_EPSILON_M) {
    throw new Error('WORLD_VEHICLE_CORRIDOR_WIDTH_INVALID')
  }
  const segments = routeSegments(definition)
  if (definition.obstacles.some((obstacle) => segments.some(([from, to]) => obstacleIntersectsCorridor(obstacle, from, to, definition.vehicleCorridorHalfWidthM)))) {
    throw new Error('WORLD_ROUTE_CLEARANCE_BLOCKED')
  }
}

function routeSegments(definition: OrchardWorldDefinition): Array<[WorldPoint, WorldPoint]> {
  const paths = [definition.route.outbound, definition.route.returning]
  return paths.flatMap((path) => path.slice(1).map((point, index) => [path[index]!, point]))
}

function obstacleIntersectsCorridor(obstacle: WorldObstacle, from: WorldPoint, to: WorldPoint, corridorHalfWidthM: number): boolean {
  const samples = obstacle.kind === 'box'
    ? [
        { x: obstacle.translation.x - obstacle.halfExtents.x, z: obstacle.translation.z - obstacle.halfExtents.z },
        { x: obstacle.translation.x - obstacle.halfExtents.x, z: obstacle.translation.z + obstacle.halfExtents.z },
        { x: obstacle.translation.x + obstacle.halfExtents.x, z: obstacle.translation.z - obstacle.halfExtents.z },
        { x: obstacle.translation.x + obstacle.halfExtents.x, z: obstacle.translation.z + obstacle.halfExtents.z },
      ]
    : [{ x: obstacle.translation.x, z: obstacle.translation.z }]
  const radius = obstacle.kind === 'trunk' ? obstacle.radiusM : 0
  return samples.some((point) => distanceToSegment(point, from, to) <= corridorHalfWidthM + radius)
    || (obstacle.kind === 'box' && (segmentIntersectsBox(from, to, obstacle)
      || [from, to].some((point) => distanceToBox(point, obstacle) <= corridorHalfWidthM)))
}

function distanceToBox(point: Pick<WorldPoint, 'x' | 'z'>, obstacle: Extract<WorldObstacle, { kind: 'box' }>): number {
  const nearestX = Math.max(obstacle.translation.x - obstacle.halfExtents.x, Math.min(point.x, obstacle.translation.x + obstacle.halfExtents.x))
  const nearestZ = Math.max(obstacle.translation.z - obstacle.halfExtents.z, Math.min(point.z, obstacle.translation.z + obstacle.halfExtents.z))
  return Math.hypot(point.x - nearestX, point.z - nearestZ)
}

function segmentIntersectsBox(from: WorldPoint, to: WorldPoint, obstacle: Extract<WorldObstacle, { kind: 'box' }>): boolean {
  const minX = obstacle.translation.x - obstacle.halfExtents.x
  const maxX = obstacle.translation.x + obstacle.halfExtents.x
  const minZ = obstacle.translation.z - obstacle.halfExtents.z
  const maxZ = obstacle.translation.z + obstacle.halfExtents.z
  const dx = to.x - from.x
  const dz = to.z - from.z
  let entry = 0
  let exit = 1
  for (const [origin, direction, minimum, maximum] of [[from.x, dx, minX, maxX], [from.z, dz, minZ, maxZ]] as const) {
    if (direction === 0) {
      if (origin < minimum || origin > maximum) return false
      continue
    }
    const first = (minimum - origin) / direction
    const second = (maximum - origin) / direction
    entry = Math.max(entry, Math.min(first, second))
    exit = Math.min(exit, Math.max(first, second))
  }
  return entry <= exit
}

function distanceToSegment(point: Pick<WorldPoint, 'x' | 'z'>, from: WorldPoint, to: WorldPoint): number {
  const dx = to.x - from.x
  const dz = to.z - from.z
  const lengthSquared = dx * dx + dz * dz
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.z - from.z) * dz) / lengthSquared))
  return Math.hypot(point.x - (from.x + dx * t), point.z - (from.z + dz * t))
}

function validateTreeClearance(definition: OrchardWorldDefinition): void {
  const trunks = definition.obstacles.filter((obstacle): obstacle is Extract<WorldObstacle, { kind: 'trunk' }> => obstacle.kind === 'trunk')
  for (let index = 0; index < trunks.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < trunks.length; otherIndex += 1) {
      const first = trunks[index]!
      const second = trunks[otherIndex]!
      if (Math.abs(first.translation.z - second.translation.z) > PLANE_EPSILON_M) continue
      const clearWidth = Math.abs(first.translation.x - second.translation.x) - first.radiusM - second.radiusM
      if (clearWidth < MIN_TREE_CLEARANCE_M) {
        throw new Error('WORLD_TREE_CLEARANCE_INVALID')
      }
    }
  }
}

function validateLighting(definition: OrchardWorldDefinition): void {
  if (definition.lighting.sun.id !== 'orchard-sun' || definition.lighting.sky.id !== 'orchard-sky'
    || !Number.isFinite(definition.lighting.sun.intensity) || definition.lighting.sun.intensity <= 0
    || !Number.isFinite(definition.lighting.sky.intensity) || definition.lighting.sky.intensity <= 0) {
    throw new Error('WORLD_LIGHTING_INVALID')
  }
  const localLightIds = new Set<string>()
  for (const light of definition.lighting.localLights) {
    if (localLightIds.has(light.id)) {
      throw new Error('WORLD_LOCAL_LIGHT_DUPLICATE_ID')
    }
    localLightIds.add(light.id)
    const emitter = definition.landmarks.find((landmark) => landmark.id === light.emitter.landmarkId)
    if (!emitter || emitter.nodeName !== light.emitter.nodeName) {
      throw new Error(`WORLD_LOCAL_LIGHT_EMITTER_INVALID: ${light.id}`)
    }
    if (!Number.isFinite(light.attachment.translation.x)
      || !Number.isFinite(light.attachment.translation.y)
      || !Number.isFinite(light.attachment.translation.z)
      || !Number.isFinite(light.attachment.yawRadians)
      || !Number.isFinite(light.rangeM) || light.rangeM <= 0
      || !Number.isFinite(light.color) || light.color < 0 || light.color > 0xffffff
      || !Number.isFinite(light.intensity) || light.intensity <= 0
      || (light.type !== 'point' && light.type !== 'spot')
      || typeof light.castsShadow !== 'boolean'
      || (light.occlusionIntent !== 'casts-shadow' && light.occlusionIntent !== 'unoccluded')
      || typeof light.enabled !== 'boolean'
      || light.fallback !== 'disable-when-emitter-unavailable') {
      throw new Error(`WORLD_LOCAL_LIGHT_INVALID: ${light.id}`)
    }
  }
}

function validateReachability(definition: OrchardWorldDefinition): void {
  const width = Math.ceil(definition.bounds.widthM / GRID_SIZE_M)
  const depth = Math.ceil(definition.bounds.depthM / GRID_SIZE_M)
  const blocked = new Set<number>()
  for (let zIndex = 0; zIndex < depth; zIndex += 1) {
    for (let xIndex = 0; xIndex < width; xIndex += 1) {
      const point = gridPoint(definition, xIndex, zIndex)
      if (definition.obstacles.some((obstacle) => pointIsInInflatedObstacle(point, obstacle))) {
        blocked.add(gridKey(xIndex, zIndex, width))
      }
    }
  }

  const start = gridIndexForPoint(definition, definition.spawnPoses.player.translation, width, depth)
  const reachable = floodFill(start, width, depth, blocked)
  for (const sensor of definition.sensors) {
    const targetCells = cellsInSensor(definition, sensor, width, depth)
    if (!targetCells.some(([x, z]) => reachable.has(gridKey(x, z, width)))) {
      throw new Error(`WORLD_TARGET_UNREACHABLE: ${sensor.id}`)
    }
  }
}

function gridPoint(definition: OrchardWorldDefinition, xIndex: number, zIndex: number): Pick<WorldPoint, 'x' | 'z'> {
  return {
    x: -definition.bounds.widthM / 2 + (xIndex + 0.5) * GRID_SIZE_M,
    z: -definition.bounds.depthM / 2 + (zIndex + 0.5) * GRID_SIZE_M,
  }
}

function gridIndexForPoint(definition: OrchardWorldDefinition, point: WorldPoint, width: number, depth: number): [number, number] {
  const x = Math.max(0, Math.min(width - 1, Math.floor((point.x + definition.bounds.widthM / 2) / GRID_SIZE_M)))
  const z = Math.max(0, Math.min(depth - 1, Math.floor((point.z + definition.bounds.depthM / 2) / GRID_SIZE_M)))
  return [x, z]
}

function pointIsInInflatedObstacle(point: Pick<WorldPoint, 'x' | 'z'>, obstacle: WorldObstacle): boolean {
  if (obstacle.kind === 'box') {
    return Math.abs(point.x - obstacle.translation.x) <= obstacle.halfExtents.x + PLAYER_RADIUS_M
      && Math.abs(point.z - obstacle.translation.z) <= obstacle.halfExtents.z + PLAYER_RADIUS_M
  }
  return Math.hypot(point.x - obstacle.translation.x, point.z - obstacle.translation.z) <= obstacle.radiusM + PLAYER_RADIUS_M
}

function cellsInSensor(definition: OrchardWorldDefinition, sensor: WorldSensor, width: number, depth: number): Array<[number, number]> {
  const minX = Math.max(0, Math.floor((sensor.translation.x - sensor.halfExtents.x + definition.bounds.widthM / 2) / GRID_SIZE_M))
  const maxX = Math.min(width - 1, Math.floor((sensor.translation.x + sensor.halfExtents.x + definition.bounds.widthM / 2) / GRID_SIZE_M))
  const minZ = Math.max(0, Math.floor((sensor.translation.z - sensor.halfExtents.z + definition.bounds.depthM / 2) / GRID_SIZE_M))
  const maxZ = Math.min(depth - 1, Math.floor((sensor.translation.z + sensor.halfExtents.z + definition.bounds.depthM / 2) / GRID_SIZE_M))
  const cells: Array<[number, number]> = []
  for (let z = minZ; z <= maxZ; z += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const point = gridPoint(definition, x, z)
      if (Math.abs(point.x - sensor.translation.x) <= sensor.halfExtents.x && Math.abs(point.z - sensor.translation.z) <= sensor.halfExtents.z) {
        cells.push([x, z])
      }
    }
  }
  return cells
}

function floodFill(start: [number, number], width: number, depth: number, blocked: Set<number>): Set<number> {
  const reached = new Set<number>()
  const startKey = gridKey(start[0], start[1], width)
  if (blocked.has(startKey)) return reached
  const queue: Array<[number, number]> = [start]
  reached.add(startKey)
  for (let index = 0; index < queue.length; index += 1) {
    const [x, z] = queue[index]!
    const neighbours: ReadonlyArray<readonly [number, number]> = [[x - 1, z], [x + 1, z], [x, z - 1], [x, z + 1]]
    for (const [nextX, nextZ] of neighbours) {
      if (nextX < 0 || nextX >= width || nextZ < 0 || nextZ >= depth) continue
      const key = gridKey(nextX, nextZ, width)
      if (blocked.has(key) || reached.has(key)) continue
      reached.add(key)
      queue.push([nextX, nextZ])
    }
  }
  return reached
}

function gridKey(x: number, z: number, width: number): number {
  return z * width + x
}

function validateRouteEndpoints(definition: OrchardWorldDefinition): void {
  const parking = definition.sensors.find(({ id }) => id === 'parking')!
  const delivery = definition.sensors.find(({ id }) => id === 'delivery')!
  const outbound = definition.route.outbound
  const returning = definition.route.returning
  if (!withinDistance(
    outbound[0],
    definition.spawnPoses.vehicle.translation,
    SPAWN_POSITION_EPSILON_M,
  )
    || !withinDistance(outbound.at(-1), parking.translation, 2)
    || !withinDistance(returning[0], parking.translation, 2)
    || !withinDistance(returning.at(-1), delivery.translation, 2)) {
    throw new Error('WORLD_ROUTE_ENDPOINTS_INVALID')
  }
}

function withinDistance(first: WorldPoint | undefined, second: WorldPoint, maximumDistanceM: number): boolean {
  return first !== undefined && Math.hypot(first.x - second.x, first.z - second.z) <= maximumDistanceM
}
