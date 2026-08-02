import RAPIER, { type Collider } from '@dimforge/rapier3d-compat'
import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  type Scene,
} from 'three'
import type { PhysicsWorld } from '../physics/PhysicsWorld'
import type {
  OrchardSensorId,
  OrchardWorldDefinition,
  WorldPoint,
} from '../world/orchardWorldDefinition'

const FLOOR_HALF_HEIGHT_M = 0.1
const DEBUG_ROOT_NAME = 'debug-orchard-course'
const DEBUG_ROOT_OWNER = 'orchard-runtime-authored-proxies'

export type CourseProxySetId =
  | 'orchard-tree-trunks-v1'
  | 'orchard-world-obstacles-v1'

export interface CourseSensor {
  readonly id: OrchardSensorId
  readonly collider: Collider
}

export interface CourseSurface {
  readonly id: string
  readonly collider: Collider
  readonly proxySetId: CourseProxySetId
}

export interface OrchardCourse {
  readonly spawnPoses: OrchardWorldDefinition['spawnPoses']
  readonly parkingSensor: CourseSensor
  readonly harvestSensors: {
    readonly treeInventory: CourseSensor
    readonly basket: CourseSensor
    readonly crate: CourseSensor
    readonly cargoSlot: CourseSensor
  }
  readonly deliverySensor: CourseSensor
  readonly safePoints: OrchardWorldDefinition['safePoints']
  readonly floorColliders: readonly CourseSurface[]
  readonly obstacleColliders: readonly CourseSurface[]
  readonly trunkColliders: readonly CourseSurface[]
  readonly sensorIds: readonly OrchardSensorId[]
  readonly debugRoot: Group | null
}

function createFixedCuboid(
  physics: PhysicsWorld,
  input: Readonly<{
    id: string
    translation: WorldPoint
    halfExtents: WorldPoint
    proxySetId: CourseProxySetId
  }>,
): CourseSurface {
  const body = physics.world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(
      input.translation.x,
      input.translation.y,
      input.translation.z,
    ),
  )
  const collider = physics.world.createCollider(
    RAPIER.ColliderDesc.cuboid(
      input.halfExtents.x,
      input.halfExtents.y,
      input.halfExtents.z,
    ),
    body,
  )
  return { id: input.id, collider, proxySetId: input.proxySetId }
}

function createFixedTrunk(
  physics: PhysicsWorld,
  obstacle: Extract<OrchardWorldDefinition['obstacles'][number], {
    kind: 'trunk'
  }>,
): CourseSurface {
  const body = physics.world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(
      obstacle.translation.x,
      obstacle.translation.y + obstacle.halfHeightM,
      obstacle.translation.z,
    ),
  )
  const collider = physics.world.createCollider(
    RAPIER.ColliderDesc.cylinder(obstacle.halfHeightM, obstacle.radiusM),
    body,
  )
  return {
    id: obstacle.id,
    collider,
    proxySetId: 'orchard-tree-trunks-v1',
  }
}

function createSensor(
  physics: PhysicsWorld,
  definition: OrchardWorldDefinition['sensors'][number],
): CourseSensor {
  const collider = physics.world.createCollider(
    RAPIER.ColliderDesc.cuboid(
      definition.halfExtents.x,
      definition.halfExtents.y,
      definition.halfExtents.z,
    )
      .setTranslation(
        definition.translation.x,
        definition.translation.y + definition.halfExtents.y,
        definition.translation.z,
      )
      .setSensor(true),
  )
  return { id: definition.id, collider }
}

function debugMesh(
  id: string,
  geometry: BoxGeometry | CylinderGeometry,
  translation: WorldPoint,
  sensor: boolean,
): Mesh {
  const mesh = new Mesh(geometry, new MeshBasicMaterial({
    color: sensor ? 0xffa62b : 0x31d158,
    wireframe: true,
    transparent: sensor,
    opacity: sensor ? 0.5 : 1,
    depthWrite: !sensor,
  }))
  mesh.name = `debug-orchard-course-${id}`
  mesh.position.set(translation.x, translation.y, translation.z)
  mesh.userData.debugOnly = true
  return mesh
}

function removeOwnedDebugRoot(scene: Scene): void {
  const ownedRoots = scene.children.filter((child) => (
    child.name === DEBUG_ROOT_NAME
    && child.userData.courseDebugOwner === DEBUG_ROOT_OWNER
  ))
  for (const root of ownedRoots) {
    root.traverse((object) => {
      if (!(object instanceof Mesh)) return
      object.geometry.dispose()
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material]
      for (const material of materials) material.dispose()
    })
    root.removeFromParent()
  }
}

function createDebugRoot(
  scene: Scene,
  definition: OrchardWorldDefinition,
): Group {
  const root = new Group()
  root.name = DEBUG_ROOT_NAME
  root.userData.debugOnly = true
  root.userData.courseDebugOwner = DEBUG_ROOT_OWNER
  root.add(debugMesh(
    'floor',
    new BoxGeometry(
      definition.bounds.widthM,
      FLOOR_HALF_HEIGHT_M * 2,
      definition.bounds.depthM,
    ),
    { x: 0, y: definition.gameplayPlaneY - FLOOR_HALF_HEIGHT_M, z: 0 },
    false,
  ))
  for (const obstacle of definition.obstacles) {
    if (obstacle.kind === 'box') {
      root.add(debugMesh(
        obstacle.id,
        new BoxGeometry(
          obstacle.halfExtents.x * 2,
          obstacle.halfExtents.y * 2,
          obstacle.halfExtents.z * 2,
        ),
        {
          x: obstacle.translation.x,
          y: obstacle.translation.y + obstacle.halfExtents.y,
          z: obstacle.translation.z,
        },
        false,
      ))
    } else {
      root.add(debugMesh(
        obstacle.id,
        new CylinderGeometry(
          obstacle.radiusM,
          obstacle.radiusM,
          obstacle.halfHeightM * 2,
          12,
        ),
        {
          x: obstacle.translation.x,
          y: obstacle.translation.y + obstacle.halfHeightM,
          z: obstacle.translation.z,
        },
        false,
      ))
    }
  }
  for (const sensor of definition.sensors) {
    root.add(debugMesh(
      sensor.id,
      new BoxGeometry(
        sensor.halfExtents.x * 2,
        sensor.halfExtents.y * 2,
        sensor.halfExtents.z * 2,
      ),
      {
        x: sensor.translation.x,
        y: sensor.translation.y + sensor.halfExtents.y,
        z: sensor.translation.z,
      },
      true,
    ))
  }
  scene.add(root)
  return root
}

export function createOrchardCourse(
  scene: Scene,
  physics: PhysicsWorld,
  definition: OrchardWorldDefinition,
  debugEnabled: boolean,
): OrchardCourse {
  removeOwnedDebugRoot(scene)
  const floorColliders = [createFixedCuboid(physics, {
    id: 'orchard-floor',
    translation: {
      x: 0,
      y: definition.gameplayPlaneY - FLOOR_HALF_HEIGHT_M,
      z: 0,
    },
    halfExtents: {
      x: definition.bounds.widthM / 2,
      y: FLOOR_HALF_HEIGHT_M,
      z: definition.bounds.depthM / 2,
    },
    proxySetId: 'orchard-world-obstacles-v1',
  })]
  const obstacleColliders = definition.obstacles
    .filter((obstacle) => obstacle.kind === 'box')
    .map((obstacle) => createFixedCuboid(physics, {
      id: obstacle.id,
      translation: {
        x: obstacle.translation.x,
        y: obstacle.translation.y + obstacle.halfExtents.y,
        z: obstacle.translation.z,
      },
      halfExtents: obstacle.halfExtents,
      proxySetId: 'orchard-world-obstacles-v1',
    }))
  const trunkColliders = definition.obstacles
    .filter((obstacle) => obstacle.kind === 'trunk')
    .map((obstacle) => createFixedTrunk(physics, obstacle))
  const sensors = new Map(definition.sensors.map((sensorDefinition) => {
    const sensor = createSensor(physics, sensorDefinition)
    return [sensor.id, sensor] as const
  }))
  const requireSensor = (id: OrchardSensorId): CourseSensor => {
    const sensor = sensors.get(id)
    if (!sensor) throw new Error(`COURSE_SENSOR_MISSING: ${id}`)
    return sensor
  }

  return {
    spawnPoses: definition.spawnPoses,
    parkingSensor: requireSensor('parking'),
    harvestSensors: Object.freeze({
      treeInventory: requireSensor('tree-inventory'),
      basket: requireSensor('basket'),
      crate: requireSensor('crate'),
      cargoSlot: requireSensor('cargo-slot'),
    }),
    deliverySensor: requireSensor('delivery'),
    safePoints: definition.safePoints,
    floorColliders: Object.freeze(floorColliders),
    obstacleColliders: Object.freeze(obstacleColliders),
    trunkColliders: Object.freeze(trunkColliders),
    sensorIds: Object.freeze(definition.sensors.map(({ id }) => id)),
    debugRoot: debugEnabled ? createDebugRoot(scene, definition) : null,
  }
}
