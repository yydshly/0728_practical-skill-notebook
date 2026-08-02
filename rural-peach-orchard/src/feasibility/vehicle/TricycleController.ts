import RAPIER, {
  type RigidBody,
} from '@dimforge/rapier3d-compat'
import {
  MathUtils,
  Quaternion,
  Vector3,
} from 'three'
import {
  worldForward,
  type RuntimeOrientation,
} from '../assets/RuntimeOrientation'
import type { RuntimeAssetContract } from '../assets/runtimeAssetContract'
import type { PhysicsWorld } from '../physics/PhysicsWorld'
import type {
  TricycleWheelId,
  VehicleTelemetrySample,
  WheelTelemetrySample,
} from './VehicleTelemetry'
import type { TricycleColliderVector } from './types'

type RuntimeVehicleContract = RuntimeAssetContract['vehicle']

export interface VehicleInput {
  readonly throttle: number
  readonly brake: number
  readonly steer: number
}

export interface WheelAnchor {
  readonly id: TricycleWheelId
  readonly position: Readonly<{ x: number; y: number; z: number }>
  readonly radiusM: number
  readonly driven: boolean
}

export interface TricycleControllerDependencies {
  readonly physics: PhysicsWorld
  readonly body: RigidBody
  readonly contract: RuntimeVehicleContract
  readonly orientation: RuntimeOrientation
  readonly wheelAnchors: readonly WheelAnchor[]
  readonly cargoAnchorLocal: Readonly<TricycleColliderVector>
}

const LOCAL_UP = new Vector3(0, 1, 0)
const FIXED_SECONDS = 1 / 60

function copyQuaternion(body: RigidBody): Quaternion {
  const rotation = body.rotation()
  return new Quaternion(rotation.x, rotation.y, rotation.z, rotation.w)
}

function clampInput(input: VehicleInput): VehicleInput {
  return {
    throttle: MathUtils.clamp(input.throttle, -1, 1),
    brake: MathUtils.clamp(input.brake, 0, 1),
    steer: MathUtils.clamp(input.steer, -1, 1),
  }
}

function length(vector: Readonly<{ x: number; y: number; z: number }>): number {
  return Math.hypot(vector.x, vector.y, vector.z)
}

export class TricycleController {
  private readonly physics: PhysicsWorld
  private readonly body: RigidBody
  private readonly contract: RuntimeVehicleContract
  private readonly orientation: RuntimeOrientation
  private readonly wheelAnchors: readonly WheelAnchor[]
  private readonly cargoAnchorLocal: Readonly<TricycleColliderVector>
  private readonly inertia: Readonly<TricycleColliderVector>
  private readonly inertiaFrame: Readonly<{
    x: number
    y: number
    z: number
    w: number
  }>

  constructor(dependencies: TricycleControllerDependencies) {
    if (dependencies.wheelAnchors.length !== 3) {
      throw new Error('TRICYCLE_REQUIRES_THREE_WHEEL_ANCHORS')
    }
    if (dependencies.wheelAnchors.filter((wheel) => wheel.driven).length !== 2) {
      throw new Error('TRICYCLE_REQUIRES_TWO_DRIVEN_REAR_WHEELS')
    }
    this.physics = dependencies.physics
    this.body = dependencies.body
    this.contract = dependencies.contract
    this.orientation = dependencies.orientation
    this.wheelAnchors = dependencies.wheelAnchors
    this.cargoAnchorLocal = dependencies.cargoAnchorLocal
    this.body.recomputeMassPropertiesFromColliders()
    const measuredColliderMassKg = this.body.mass()
    if (!Number.isFinite(measuredColliderMassKg) || measuredColliderMassKg <= 0) {
      throw new Error('TRICYCLE_COLLIDER_MASS_INVALID')
    }
    const densityScale = this.contract.emptyMassKg / measuredColliderMassKg
    for (let index = 0; index < this.body.numColliders(); index += 1) {
      const collider = this.body.collider(index)
      collider.setDensity(collider.density() * densityScale)
    }
    this.body.recomputeMassPropertiesFromColliders()
    this.inertia = dependencies.body.principalInertia()
    this.inertiaFrame = dependencies.body.principalInertiaLocalFrame()
  }

  setCargoMass(cargoKg: number): void {
    if (!Number.isFinite(cargoKg) || cargoKg < 0) {
      throw new RangeError('cargoKg')
    }
    const totalMassKg = this.contract.emptyMassKg + cargoKg
    const [emptyX, emptyY, emptyZ] = this.contract.centerOfMass
    const center = {
      x: (emptyX * this.contract.emptyMassKg
        + this.cargoAnchorLocal.x * cargoKg) / totalMassKg,
      y: (emptyY * this.contract.emptyMassKg
        + this.cargoAnchorLocal.y * cargoKg) / totalMassKg,
      z: (emptyZ * this.contract.emptyMassKg
        + this.cargoAnchorLocal.z * cargoKg) / totalMassKg,
    }
    for (let index = 0; index < this.body.numColliders(); index += 1) {
      this.body.collider(index).setDensity(0)
    }
    this.body.setAdditionalMassProperties(
      totalMassKg,
      center,
      this.inertia,
      this.inertiaFrame,
      true,
    )
    this.body.recomputeMassPropertiesFromColliders()
  }

  update(input: VehicleInput): VehicleTelemetrySample {
    this.body.resetForces(true)
    this.body.resetTorques(true)
    const normalizedInput = clampInput(input)
    const rotation = copyQuaternion(this.body)
    const translation = this.body.translation()
    const up = LOCAL_UP.clone().applyQuaternion(rotation)
    const forward = worldForward(this.orientation, rotation)
    const velocity = this.body.linvel()
    const forwardSpeedMps = new Vector3(
      velocity.x,
      velocity.y,
      velocity.z,
    ).dot(forward)
    const maxWheelForceN = this.contract.springNPerM
      * this.contract.suspensionTravelM
    const drivenWheelCount = this.wheelAnchors.filter(
      (wheel) => wheel.driven,
    ).length
    const wheelCount = this.wheelAnchors.length
    const massPerWheelKg = this.body.mass() / wheelCount

    const wheels = this.wheelAnchors.map((wheel): WheelTelemetrySample => {
      const anchor = new Vector3(
        wheel.position.x,
        wheel.position.y,
        wheel.position.z,
      ).applyQuaternion(rotation).add(new Vector3(
        translation.x,
        translation.y,
        translation.z,
      ))
      const rayOrigin = anchor.clone().addScaledVector(
        up,
        this.contract.suspensionRestM,
      )
      const ray = new RAPIER.Ray(
        rayOrigin,
        { x: -up.x, y: -up.y, z: -up.z },
      )
      const maxHitDistanceM = wheel.radiusM
        + this.contract.suspensionRestM
        + this.contract.suspensionTravelM
      const hit = this.physics.world.castRay(
        ray,
        maxHitDistanceM,
        false,
        RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
        undefined,
        undefined,
        this.body,
      )

      if (!hit) {
        return {
          id: wheel.id,
          grounded: false,
          hitDistanceM: null,
          compressionM: 0,
          normalForceN: 0,
          angularDeltaRad: 0,
        }
      }

      const contactPoint = ray.pointAt(hit.timeOfImpact)
      const pointVelocity = this.body.velocityAtPoint(contactPoint)
      const velocityAlongUp = pointVelocity.x * up.x
        + pointVelocity.y * up.y
        + pointVelocity.z * up.z
      const compressionM = MathUtils.clamp(
        this.contract.suspensionRestM
          - (hit.timeOfImpact - wheel.radiusM),
        -this.contract.suspensionTravelM,
        this.contract.suspensionTravelM,
      )
      const damping = velocityAlongUp < 0
        ? this.contract.compressionDampingNsPerM
        : this.contract.reboundDampingNsPerM
      const normalForceN = MathUtils.clamp(
        compressionM * this.contract.springNPerM
          - velocityAlongUp * damping,
        0,
        maxWheelForceN,
      )

      this.body.addForceAtPoint(
        {
          x: up.x * normalForceN,
          y: up.y * normalForceN,
          z: up.z * normalForceN,
        },
        contactPoint,
        true,
      )

      const wheelForward = wheel.id === 'front'
        ? forward.clone().applyAxisAngle(
          up,
          normalizedInput.steer * this.contract.maxSteerRad,
        )
        : forward.clone()
      const wheelLateral = new Vector3()
        .crossVectors(up, wheelForward)
        .normalize()
      const pointVelocityVector = new Vector3(
        pointVelocity.x,
        pointVelocity.y,
        pointVelocity.z,
      )
      const lateralSpeedMps = pointVelocityVector.dot(wheelLateral)
      const lateralForceLimitN = normalForceN
        * this.contract.lateralGripCoefficient
      const lateralForceN = MathUtils.clamp(
        -lateralSpeedMps * massPerWheelKg / FIXED_SECONDS,
        -lateralForceLimitN,
        lateralForceLimitN,
      )
      this.body.addForceAtPoint(
        {
          x: wheelLateral.x * lateralForceN,
          y: wheelLateral.y * lateralForceN,
          z: wheelLateral.z * lateralForceN,
        },
        contactPoint,
        true,
      )

      const longitudinalSpeedMps = pointVelocityVector.dot(wheelForward)
      const brakeLimitPerWheelN = normalizedInput.brake
        * this.contract.maxBrakeForceN
        / wheelCount
      const brakeForceN = Math.min(
        Math.abs(longitudinalSpeedMps) * massPerWheelKg / FIXED_SECONDS,
        brakeLimitPerWheelN,
      )
      if (Math.abs(longitudinalSpeedMps) > Number.EPSILON) {
        const brakeDirection = -Math.sign(longitudinalSpeedMps)
        this.body.addForceAtPoint(
          {
            x: wheelForward.x * brakeForceN * brakeDirection,
            y: wheelForward.y * brakeForceN * brakeDirection,
            z: wheelForward.z * brakeForceN * brakeDirection,
          },
          contactPoint,
          true,
        )
      }

      const atSpeedLimit = normalizedInput.throttle > 0
        ? forwardSpeedMps >= this.contract.maxSpeedMps
        : forwardSpeedMps <= -this.contract.maxSpeedMps
      if (wheel.driven && !atSpeedLimit) {
        const driveForceN = normalizedInput.throttle
          * this.contract.maxDriveForceN
          / drivenWheelCount
        this.body.addForceAtPoint(
          {
            x: wheelForward.x * driveForceN,
            y: wheelForward.y * driveForceN,
            z: wheelForward.z * driveForceN,
          },
          contactPoint,
          true,
        )
      }

      return {
        id: wheel.id,
        grounded: true,
        hitDistanceM: hit.timeOfImpact,
        compressionM,
        normalForceN,
        angularDeltaRad: longitudinalSpeedMps * FIXED_SECONDS / wheel.radiusM,
      }
    })

    return {
      speedMps: length(velocity),
      forwardSpeedMps,
      steerAngleRad: normalizedInput.steer * this.contract.maxSteerRad,
      wheels,
    }
  }
}
