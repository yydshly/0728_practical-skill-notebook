import {
  Euler,
  MathUtils,
  Quaternion,
  Vector3,
} from 'three'
import runtimeAssetContractJson from '../../../public/feasibility/runtime-assets.json'
import {
  createRuntimeOrientation,
  worldForward,
} from '../../../src/feasibility/assets/RuntimeOrientation'
import { parseRuntimeAssetContract } from '../../../src/feasibility/assets/runtimeAssetContract'
import { COURSE_DEFINITION } from '../../../src/feasibility/course/courseDefinition'
import type {
  RouteMarkerState,
  RouteResult,
} from '../../../src/feasibility/vehicle/types'
import type { VehicleTelemetrySample } from '../../../src/feasibility/vehicle/VehicleTelemetry'
import { createTricyclePhysicsFixture } from './createTricyclePhysicsFixture'
import type { RecordedVehicleInput } from './routeInputs'

type CourseId = 'flat' | 'turn' | 'slope'
const orientation = createRuntimeOrientation(
  parseRuntimeAssetContract(runtimeAssetContractJson).vehicle,
)

function bodyPosition(body: { translation(): { x: number; y: number; z: number } }): Vector3 {
  const translation = body.translation()
  return new Vector3(translation.x, translation.y, translation.z)
}

function bodyQuaternion(body: { rotation(): { x: number; y: number; z: number; w: number } }): Quaternion {
  const rotation = body.rotation()
  return new Quaternion(rotation.x, rotation.y, rotation.z, rotation.w)
}

function headingDeg(rotation: Quaternion): number {
  const forward = worldForward(orientation, rotation)
  return MathUtils.radToDeg(Math.atan2(forward.x, forward.z))
}

function rollDeg(rotation: Quaternion): number {
  return Math.abs(MathUtils.radToDeg(
    new Euler().setFromQuaternion(rotation, 'YXZ').z,
  ))
}

function signedForwardSpeedMps(
  body: {
    linvel(): { x: number; y: number; z: number }
    rotation(): { x: number; y: number; z: number; w: number }
  },
): number {
  const velocity = body.linvel()
  const forward = worldForward(orientation, bodyQuaternion(body))
  return forward.dot(new Vector3(velocity.x, velocity.y, velocity.z))
}

function markerState(
  body: {
    linvel(): { x: number; y: number; z: number }
    rotation(): { x: number; y: number; z: number; w: number }
    translation(): { x: number; y: number; z: number }
  },
  wheels: VehicleTelemetrySample['wheels'],
): RouteMarkerState {
  const position = bodyPosition(body)
  const rotation = bodyQuaternion(body)
  const forward = worldForward(orientation, rotation)
  const wheelEvidence = wheels.map((wheel) => ({
    id: wheel.id,
    grounded: wheel.grounded,
    hitDistanceM: wheel.hitDistanceM,
    compressionM: wheel.compressionM,
    normalForceN: wheel.normalForceN,
    angularDeltaRad: wheel.angularDeltaRad,
  }))
  return {
    position: { x: position.x, y: position.y, z: position.z },
    headingDeg: headingDeg(rotation),
    pitchDeg: MathUtils.radToDeg(Math.asin(MathUtils.clamp(
      forward.y,
      -1,
      1,
    ))),
    rollDeg: rollDeg(rotation),
    forwardSpeedMps: signedForwardSpeedMps(body),
    groundedWheelCount: wheelEvidence.filter((wheel) => wheel.grounded).length,
    wheels: wheelEvidence,
  }
}

const COURSE_LOWER_BOUND_Y = Math.min(...COURSE_DEFINITION.surfaces.map(
  (surface) => {
    const sinAngle = 2 * surface.rotation.z * surface.rotation.w
    const cosAngle = 1 - 2 * surface.rotation.z ** 2
    const verticalRadius = Math.abs(surface.halfExtents.x * sinAngle)
      + Math.abs(surface.halfExtents.y * cosAngle)
    return surface.translation.y - verticalRadius
  },
))
const RECOVERY_ROLL_TRIGGER_DEG = 70

export interface RouteRecoveryEvidence {
  readonly position: Readonly<{ x: number; y: number; z: number }>
  readonly rollDeg: number
}

export function isRouteRecoveryTrigger(
  evidence: RouteRecoveryEvidence,
): boolean {
  return evidence.position.y < COURSE_LOWER_BOUND_Y
    || evidence.rollDeg > RECOVERY_ROLL_TRIGGER_DEG
}

function normalizeHeadingChange(degrees: number): number {
  let normalized = degrees
  while (normalized > 180) normalized -= 360
  while (normalized < -180) normalized += 360
  return Math.abs(normalized)
}

export async function replayVehicleFixture(
  course: CourseId,
  inputs: readonly RecordedVehicleInput[],
  cargoKg: number,
): Promise<RouteResult> {
  const fixture = await createTricyclePhysicsFixture(course)
  fixture.controller.setCargoMass(cargoKg)

  let start = bodyPosition(fixture.body)
  let previous = start.clone()
  let startHeadingDeg = headingDeg(bodyQuaternion(fixture.body))
  let distanceM = 0
  let minimumForwardSpeedMps = Number.POSITIVE_INFINITY
  let maximumRollDeg = 0
  let backslideM = 0
  let measuring = false
  let holdStart: Vector3 | null = null
  let holdForward: Vector3 | null = null
  let furthestForwardProgressM = 0
  let acceptanceStart: RouteMarkerState | null = null
  let holdStartState: RouteMarkerState | null = null
  let recoveryCount = 0
  let recoveryTriggerActive = false

  for (const recorded of inputs) {
    if (recorded.marker === 'acceptance-start') {
      acceptanceStart = markerState(fixture.body, fixture.telemetry.wheels)
      start = bodyPosition(fixture.body)
      previous = start.clone()
      startHeadingDeg = headingDeg(bodyQuaternion(fixture.body))
      distanceM = 0
      minimumForwardSpeedMps = Number.POSITIVE_INFINITY
      maximumRollDeg = 0
      furthestForwardProgressM = 0
      measuring = true
    }
    if (recorded.marker === 'hold-start') {
      holdStartState = markerState(fixture.body, fixture.telemetry.wheels)
      holdStart = bodyPosition(fixture.body)
      holdForward = worldForward(orientation, bodyQuaternion(fixture.body))
        .setY(0)
        .normalize()
      start = holdStart.clone()
      previous = start.clone()
      startHeadingDeg = headingDeg(bodyQuaternion(fixture.body))
      distanceM = 0
      minimumForwardSpeedMps = Number.POSITIVE_INFINITY
      maximumRollDeg = 0
      measuring = true
    }

    fixture.step(1, recorded.input)
    const position = bodyPosition(fixture.body)
    const rotation = bodyQuaternion(fixture.body)
    const currentRollDeg = rollDeg(rotation)
    const recoveryTriggered = isRouteRecoveryTrigger({
      position,
      rollDeg: currentRollDeg,
    })
    if (recoveryTriggered && !recoveryTriggerActive) recoveryCount += 1
    recoveryTriggerActive = recoveryTriggered
    if (!measuring) continue

    const forwardSpeedMps = signedForwardSpeedMps(fixture.body)
    distanceM += position.distanceTo(previous)
    previous = position
    minimumForwardSpeedMps = Math.min(
      minimumForwardSpeedMps,
      forwardSpeedMps,
    )
    maximumRollDeg = Math.max(maximumRollDeg, currentRollDeg)
    if (holdStart && holdForward) {
      const forwardProgressM = position.clone().sub(holdStart).dot(holdForward)
      furthestForwardProgressM = Math.max(
        furthestForwardProgressM,
        forwardProgressM,
      )
      backslideM = Math.max(
        backslideM,
        furthestForwardProgressM - forwardProgressM,
      )
    }
  }

  const end = bodyPosition(fixture.body)
  const endHeadingDeg = headingDeg(bodyQuaternion(fixture.body))
  return {
    start: { x: start.x, y: start.y, z: start.z },
    end: { x: end.x, y: end.y, z: end.z },
    distanceM,
    horizontalDisplacementM: Math.hypot(end.x - start.x, end.z - start.z),
    minimumForwardSpeedMps: Number.isFinite(minimumForwardSpeedMps)
      ? minimumForwardSpeedMps
      : signedForwardSpeedMps(fixture.body),
    maximumRollDeg,
    backslideM,
    recoveryCount,
    finalSpeedMps: signedForwardSpeedMps(fixture.body),
    headingChangeDeg: normalizeHeadingChange(endHeadingDeg - startHeadingDeg),
    acceptanceStart,
    holdStart: holdStartState,
  }
}
