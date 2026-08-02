import RAPIER, {
  type RigidBody,
} from '@dimforge/rapier3d-compat'
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Scene,
  Vector3,
} from 'three'
import runtimeAssetContractJson from '../../../public/feasibility/runtime-assets.json'
import {
  createRuntimeOrientation,
  worldForward,
} from '../../../src/feasibility/assets/RuntimeOrientation'
import { parseRuntimeAssetContract } from '../../../src/feasibility/assets/runtimeAssetContract'
import { createTestCourse } from '../../../src/feasibility/course/createTestCourse'
import { PhysicsWorld } from '../../../src/feasibility/physics/PhysicsWorld'
import { buildTricycleColliders } from '../../../src/feasibility/vehicle/buildTricycleColliders'
import {
  TricycleController,
  type VehicleInput,
  type WheelAnchor,
} from '../../../src/feasibility/vehicle/TricycleController'
import type { VehicleTelemetrySample } from '../../../src/feasibility/vehicle/VehicleTelemetry'

export const ZERO_VEHICLE_INPUT: VehicleInput = Object.freeze({
  throttle: 0,
  brake: 0,
  steer: 0,
})

const runtimeContract = parseRuntimeAssetContract(runtimeAssetContractJson)
const runtimeOrientation = createRuntimeOrientation(runtimeContract.vehicle)

interface CuboidFixtureDefinition {
  readonly name: string
  readonly center: readonly [number, number, number]
  readonly dimensions: readonly [number, number, number]
}

const CHASSIS_CUBOIDS: readonly CuboidFixtureDefinition[] = [
  { name: 'box_chassis', center: [0, 0.29, 0.10], dimensions: [0.82, 0.20, 2.30] },
  { name: 'box_driver_mass', center: [0, 0.55, -0.28], dimensions: [0.74, 0.72, 0.72] },
  { name: 'box_bed_floor', center: [0, 0.63, 0.75], dimensions: [1.06, 0.08, 1.50] },
  { name: 'box_bed_left_wall', center: [0.5525, 0.85, 0.75], dimensions: [0.045, 0.42, 1.50] },
  { name: 'box_bed_right_wall', center: [-0.5525, 0.85, 0.75], dimensions: [0.045, 0.42, 1.50] },
  { name: 'box_bed_front_wall', center: [0, 0.85, -0.025], dimensions: [1.06, 0.42, 0.05] },
  { name: 'box_bed_rear_wall', center: [0, 0.85, 1.525], dimensions: [1.06, 0.42, 0.05] },
]

const WHEEL_ENVELOPES: readonly CuboidFixtureDefinition[] = [
  { name: 'convex_front_wheel', center: [0, 0.29, -1.10], dimensions: [0.15, 0.58, 0.58] },
  { name: 'convex_rear_left', center: [0.47, 0.275, 0.90], dimensions: [0.14, 0.55, 0.55] },
  { name: 'convex_rear_right', center: [-0.47, 0.275, 0.90], dimensions: [0.14, 0.55, 0.55] },
]

const WHEEL_ANCHORS: readonly WheelAnchor[] = Object.freeze([
  Object.freeze({ id: 'front', position: Object.freeze({ x: 0, y: 0.29, z: -1.10 }), radiusM: 0.29, driven: false }),
  Object.freeze({ id: 'rear-left', position: Object.freeze({ x: 0.47, y: 0.275, z: 0.90 }), radiusM: 0.275, driven: true }),
  Object.freeze({ id: 'rear-right', position: Object.freeze({ x: -0.47, y: 0.275, z: 0.90 }), radiusM: 0.275, driven: true }),
])

function addMeasuredBox(
  parent: Group,
  definition: CuboidFixtureDefinition,
): void {
  const geometry = new BoxGeometry(...definition.dimensions)
  geometry.translate(...definition.center)
  const mesh = new Mesh(geometry, new MeshBasicMaterial())
  mesh.name = definition.name
  parent.add(mesh)
}

function createCollisionScene(): Group {
  const scene = new Group()
  for (const definition of [...CHASSIS_CUBOIDS, ...WHEEL_ENVELOPES]) {
    addMeasuredBox(scene, definition)
  }
  return scene
}

function setContractMass(body: RigidBody): void {
  const measuredMassKg = body.mass()
  if (!Number.isFinite(measuredMassKg) || measuredMassKg <= 0) {
    throw new Error('TRICYCLE_COLLIDER_MASS_INVALID')
  }
  const densityScale = runtimeContract.vehicle.emptyMassKg / measuredMassKg
  for (let index = 0; index < body.numColliders(); index += 1) {
    const collider = body.collider(index)
    collider.setDensity(collider.density() * densityScale)
  }
}

function createBody(
  physics: PhysicsWorld,
  course: 'flat' | 'turn' | 'slope',
  initialYaw?: number,
): RigidBody {
  const poses = {
    flat: { translation: { x: 0, y: 0, z: -8 }, yaw: Math.PI },
    turn: { translation: { x: 0, y: 0, z: 7 }, yaw: Math.PI },
    slope: { translation: { x: 7.3, y: 0.06, z: 13 }, yaw: -Math.PI / 2 },
  } as const
  const pose = poses[course]
  const yaw = initialYaw ?? pose.yaw
  return physics.world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(pose.translation.x, pose.translation.y, pose.translation.z)
      .setRotation({
        x: 0,
        y: Math.sin(yaw / 2),
        z: 0,
        w: Math.cos(yaw / 2),
      })
      .setCanSleep(false),
  )
}

function samplePostStepTelemetry(
  body: RigidBody,
  wheels: VehicleTelemetrySample['wheels'],
): VehicleTelemetrySample {
  const velocity = body.linvel()
  const rotation = body.rotation()
  const forward = worldForward(runtimeOrientation, new Quaternion(
    rotation.x,
    rotation.y,
    rotation.z,
    rotation.w,
  ))
  return {
    speedMps: Math.hypot(velocity.x, velocity.y, velocity.z),
    forwardSpeedMps: forward.dot(new Vector3(
      velocity.x,
      velocity.y,
      velocity.z,
    )),
    steerAngleRad: 0,
    wheels,
  }
}

export interface TricyclePhysicsFixture {
  readonly physics: PhysicsWorld
  readonly body: RigidBody
  readonly controller: TricycleController
  telemetry: VehicleTelemetrySample
  step(count: number, input: VehicleInput): void
}

export async function createTricyclePhysicsFixture(
  course: 'flat' | 'turn' | 'slope',
  initialYaw?: number,
): Promise<TricyclePhysicsFixture> {
  const physics = await PhysicsWorld.create()
  createTestCourse(new Scene(), physics, false)
  const body = createBody(physics, course, initialYaw)
  buildTricycleColliders(
    physics.world,
    body,
    createCollisionScene(),
    runtimeContract.vehicle,
  )
  setContractMass(body)
  const controller = new TricycleController({
    physics,
    body,
    contract: runtimeContract.vehicle,
    orientation: runtimeOrientation,
    wheelAnchors: WHEEL_ANCHORS,
    cargoAnchorLocal: { x: 0, y: 0.85, z: 0.75 },
  })
  let telemetry = controller.update(ZERO_VEHICLE_INPUT)
  const fixture: TricyclePhysicsFixture = {
    physics,
    body,
    controller,
    telemetry,
    step(count, input) {
      for (let index = 0; index < count; index += 1) {
        const forceApplicationSample = controller.update(input)
        physics.step()
        fixture.telemetry = samplePostStepTelemetry(
          body,
          forceApplicationSample.wheels,
        )
      }
    },
  }
  return fixture
}
