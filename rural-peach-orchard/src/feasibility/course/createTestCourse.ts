import RAPIER, {
  type Collider,
} from '@dimforge/rapier3d-compat'
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  type Scene,
} from 'three'
import type { PhysicsWorld } from '../physics/PhysicsWorld'
import {
  COURSE_DEFINITION,
  type CourseCuboidDefinition,
  type CourseSensorDefinition,
  type CourseSensorId,
} from './courseDefinition'

const COURSE_DEBUG_ROOT_NAME = 'debug-course'
const COURSE_DEBUG_ROOT_OWNER = 'controlled-physical-test-course'

export interface CourseSensor {
  readonly id: CourseSensorId
  readonly collider: Collider
}

export interface CourseSurface {
  readonly id: string
  readonly collider: Collider
}

export interface TestCourse {
  readonly spawnPoses: typeof COURSE_DEFINITION.spawnPoses
  readonly parkingSensor: CourseSensor
  readonly harvestSensors: Readonly<{
    treeInventory: CourseSensor
    basket: CourseSensor
    crate: CourseSensor
    cargoSlot: CourseSensor
  }>
  readonly deliverySensor: CourseSensor
  readonly safePoints: typeof COURSE_DEFINITION.safePoints
  readonly surfaceColliders: readonly CourseSurface[]
  readonly debugRoot: Group | null
  readonly debugMeshes: readonly Mesh[]
}

function createFixedSurface(
  physics: PhysicsWorld,
  definition: CourseCuboidDefinition,
): CourseSurface {
  const { translation, halfExtents, rotation } = definition
  const body = physics.world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed()
      .setTranslation(translation.x, translation.y, translation.z)
      .setRotation(rotation),
  )
  const collider = physics.world.createCollider(
    RAPIER.ColliderDesc.cuboid(
      halfExtents.x,
      halfExtents.y,
      halfExtents.z,
    ),
    body,
  )
  return { id: definition.id, collider }
}

function createSensor(
  physics: PhysicsWorld,
  definition: CourseSensorDefinition,
): CourseSensor {
  const { translation, halfExtents, rotation } = definition
  const collider = physics.world.createCollider(
    RAPIER.ColliderDesc.cuboid(
      halfExtents.x,
      halfExtents.y,
      halfExtents.z,
    )
      .setTranslation(translation.x, translation.y, translation.z)
      .setRotation(rotation)
      .setSensor(true),
  )
  return { id: definition.id, collider }
}

function createDebugMesh(
  definition: CourseCuboidDefinition,
  sensor: boolean,
): Mesh {
  const { translation, halfExtents, rotation } = definition
  const material = new MeshBasicMaterial({
    color: sensor ? 0xffa62b : 0x31d158,
    wireframe: true,
    transparent: sensor,
    opacity: sensor ? 0.5 : 1,
    depthWrite: !sensor,
  })
  const mesh = new Mesh(
    new BoxGeometry(
      halfExtents.x * 2,
      halfExtents.y * 2,
      halfExtents.z * 2,
    ),
    material,
  )
  mesh.name = `debug-course-${definition.id}`
  mesh.position.set(translation.x, translation.y, translation.z)
  mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
  mesh.userData.debugOnly = true
  return mesh
}

function addDebugGeometry(scene: Scene): {
  debugRoot: Group
  debugMeshes: readonly Mesh[]
} {
  const debugRoot = new Group()
  debugRoot.name = COURSE_DEBUG_ROOT_NAME
  debugRoot.userData.debugOnly = true
  debugRoot.userData.courseDebugOwner = COURSE_DEBUG_ROOT_OWNER
  const debugMeshes = [
    ...COURSE_DEFINITION.surfaces.map((surface) => (
      createDebugMesh(surface, false)
    )),
    ...COURSE_DEFINITION.sensors.map((sensor) => (
      createDebugMesh(sensor, true)
    )),
  ]
  debugRoot.add(...debugMeshes)
  scene.add(debugRoot)
  return { debugRoot, debugMeshes }
}

function removeCourseDebugGeometry(scene: Scene): void {
  const ownedRoots = scene.children.filter((child) => (
    child.name === COURSE_DEBUG_ROOT_NAME
    && child.userData.courseDebugOwner === COURSE_DEBUG_ROOT_OWNER
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

export function createTestCourse(
  threeScene: Scene,
  physicsWorld: PhysicsWorld,
  debugEnabled: boolean,
): TestCourse {
  removeCourseDebugGeometry(threeScene)
  const surfaceColliders = COURSE_DEFINITION.surfaces.map((surface) => (
    createFixedSurface(physicsWorld, surface)
  ))
  const sensors = new Map(
    COURSE_DEFINITION.sensors.map((definition) => {
      const sensor = createSensor(physicsWorld, definition)
      return [sensor.id, sensor] as const
    }),
  )
  const requireSensor = (id: CourseSensorId): CourseSensor => {
    const sensor = sensors.get(id)
    if (!sensor) throw new Error(`COURSE_SENSOR_MISSING: ${id}`)
    return sensor
  }
  const debug = debugEnabled
    ? addDebugGeometry(threeScene)
    : { debugRoot: null, debugMeshes: [] as readonly Mesh[] }

  return {
    spawnPoses: COURSE_DEFINITION.spawnPoses,
    parkingSensor: requireSensor('parking'),
    harvestSensors: Object.freeze({
      treeInventory: requireSensor('tree-inventory'),
      basket: requireSensor('basket'),
      crate: requireSensor('crate'),
      cargoSlot: requireSensor('cargo-slot'),
    }),
    deliverySensor: requireSensor('delivery'),
    safePoints: COURSE_DEFINITION.safePoints,
    surfaceColliders,
    debugRoot: debug.debugRoot,
    debugMeshes: debug.debugMeshes,
  }
}
