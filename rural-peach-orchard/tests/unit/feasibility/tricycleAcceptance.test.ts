import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import runtimeAssetContractJson from '../../../public/feasibility/runtime-assets.json'
import { parseRuntimeAssetContract } from '../../../src/feasibility/assets/runtimeAssetContract'
import { COURSE_DEFINITION } from '../../../src/feasibility/course/courseDefinition'
import type { RouteResult } from '../../../src/feasibility/vehicle/types'
import {
  FLAT_BRAKE_INPUTS,
  SLOPE_RESTART_INPUTS,
  TURN_INPUTS,
  type RecordedVehicleInput,
} from '../../fixtures/feasibility/routeInputs'
import { replayVehicleFixture } from '../../fixtures/feasibility/replayVehicleFixture'
import { createRealTricyclePhysicsFixture } from '../../fixtures/feasibility/createRealTricyclePhysicsFixture'

const slopeSurface = COURSE_DEFINITION.surfaces.find(
  (surface) => surface.id === 'slope',
)!
const jointSurface = COURSE_DEFINITION.surfaces.find(
  (surface) => surface.id === 'joint',
)!
const turnPlatformSurface = COURSE_DEFINITION.surfaces.find(
  (surface) => surface.id === 'turn-platform',
)!
const vehicleContract = parseRuntimeAssetContract(
  runtimeAssetContractJson,
).vehicle
async function driveFromIdentity(
  throttle: number,
  steer: number,
): Promise<Readonly<{ displacement: Vector3; visualNose: Vector3 }>> {
  const fixture = await createRealTricyclePhysicsFixture()
  fixture.step(180, { throttle: 0, brake: 1, steer: 0 })
  const start = fixture.body.translation()
  fixture.step(180, { throttle, brake: 0, steer })
  const end = fixture.body.translation()
  return {
    displacement: new Vector3(
      end.x - start.x,
      end.y - start.y,
      end.z - start.z,
    ),
    visualNose: fixture.visualNose,
  }
}

function expectHoldStartOnSlope(result: RouteResult): void {
  expect(result.holdStart).not.toBeNull()
  const holdStart = result.holdStart!
  const slopeRadians = COURSE_DEFINITION.slopeDegrees * Math.PI / 180
  const slopeHalfExtentX = Math.cos(slopeRadians) * slopeSurface.halfExtents.x
    + Math.sin(slopeRadians) * slopeSurface.halfExtents.y
  expect(holdStart.position.x).toBeGreaterThanOrEqual(
    slopeSurface.translation.x - slopeHalfExtentX,
  )
  expect(holdStart.position.x).toBeLessThanOrEqual(
    slopeSurface.translation.x + slopeHalfExtentX,
  )
  expect(Math.abs(holdStart.position.z - slopeSurface.translation.z))
    .toBeLessThanOrEqual(slopeSurface.halfExtents.z)
  expect(Math.abs(holdStart.pitchDeg)).toBeGreaterThanOrEqual(
    COURSE_DEFINITION.slopeDegrees - 1,
  )
  expect(Math.abs(holdStart.pitchDeg)).toBeLessThanOrEqual(
    COURSE_DEFINITION.slopeDegrees + 1,
  )
  expect(Math.abs(Math.abs(holdStart.headingDeg) - 90))
    .toBeLessThanOrEqual(20)
  const slopeSin = 2 * slopeSurface.rotation.z * slopeSurface.rotation.w
  const slopeCos = 1 - 2 * slopeSurface.rotation.z ** 2
  const slopeTopY = slopeSurface.translation.y
    + slopeSin / slopeCos
      * (holdStart.position.x - slopeSurface.translation.x)
    + slopeSurface.halfExtents.y / slopeCos
  expect(Math.abs(holdStart.position.y - slopeTopY))
    .toBeLessThanOrEqual(vehicleContract.suspensionTravelM)
  expect(holdStart.groundedWheelCount).toBe(3)
  expect(holdStart.wheels).toHaveLength(3)
  expect(holdStart.wheels.every((wheel) => (
    wheel.grounded
    && wheel.hitDistanceM !== null
    && wheel.normalForceN > 0
  ))).toBe(true)
}

describe('tricycle G3/G4 road acceptance', () => {
  it('moves forward and reverse relative to the shared visual nose', async () => {
    const forwardDisplacement = await driveFromIdentity(1, 0)
    const reverseDisplacement = await driveFromIdentity(-1, 0)

    expect(forwardDisplacement.displacement.dot(forwardDisplacement.visualNose))
      .toBeGreaterThan(0)
    expect(reverseDisplacement.displacement.dot(reverseDisplacement.visualNose))
      .toBeLessThan(0)
  })

  it('steers left and right from the driver view at identity heading', async () => {
    const leftDisplacement = await driveFromIdentity(0.6, 1)
    const rightDisplacement = await driveFromIdentity(0.6, -1)

    expect(leftDisplacement.displacement.x).toBeLessThan(0)
    expect(rightDisplacement.displacement.x).toBeGreaterThan(0)
  })

  it('stops from 4 m/s within 7 m without reversing', async () => {
    const result = await replayVehicleFixture('flat', FLAT_BRAKE_INPUTS, 0)
    expect(result.distanceM).toBeLessThanOrEqual(7)
    expect(result.minimumForwardSpeedMps).toBeGreaterThanOrEqual(-0.05)
    expect(Math.abs(result.finalSpeedMps)).toBeLessThanOrEqual(0.15)
    expect(result.acceptanceStart?.forwardSpeedMps)
      .toBeGreaterThanOrEqual(3.9)
    expect(result.acceptanceStart?.forwardSpeedMps)
      .toBeLessThanOrEqual(4.1)
  })

  it('completes the 90 degree turn without exceeding 22 degrees roll', async () => {
    const result = await replayVehicleFixture('turn', TURN_INPUTS, 0)
    expect(result.headingChangeDeg).toBeGreaterThanOrEqual(85)
    expect(result.headingChangeDeg).toBeLessThanOrEqual(95)
    expect(result.maximumRollDeg).toBeLessThanOrEqual(22)
    expect(result.recoveryCount).toBe(0)
    expect(result.horizontalDisplacementM).toBeGreaterThanOrEqual(
      turnPlatformSurface.halfExtents.x,
    )
    expect(result.end.x).toBeGreaterThanOrEqual(
      jointSurface.translation.x - jointSurface.halfExtents.x,
    )
    expect(Math.abs(result.end.z - jointSurface.translation.z))
      .toBeLessThanOrEqual(jointSurface.halfExtents.z)
  })

  it('holds on the 8 degree slope and restarts uphill', async () => {
    const result = await replayVehicleFixture('slope', SLOPE_RESTART_INPUTS, 0)
    expect(result.backslideM).toBeLessThanOrEqual(0.35)
    expect(result.finalSpeedMps).toBeGreaterThanOrEqual(0.8)
    expect(result.recoveryCount).toBe(0)
    expectHoldStartOnSlope(result)
  })

  it('remains controllable after adding 120 kg cargo', async () => {
    const result = await replayVehicleFixture('slope', SLOPE_RESTART_INPUTS, 120)
    expect(result.maximumRollDeg).toBeLessThanOrEqual(24)
    expect(result.finalSpeedMps).toBeGreaterThanOrEqual(0.8)
    expect(result.recoveryCount).toBe(0)
    expectHoldStartOnSlope(result)
  })
})

describe('tricycle acceptance evidence', () => {
  it('counts an observable recovery trigger when the route falls off course', async () => {
    const repeat = (
      count: number,
      input: RecordedVehicleInput['input'],
      marker?: RecordedVehicleInput['marker'],
    ): RecordedVehicleInput[] => Array.from({ length: count }, (_, index) => ({
      input,
      marker: index === 0 ? marker : undefined,
    }))
    const offCourseInputs = [
      ...repeat(180, { throttle: 0, brake: 0, steer: 0 }),
      ...repeat(
        360,
        { throttle: 1, brake: 0, steer: 0 },
        'acceptance-start',
      ),
    ]

    const result = await replayVehicleFixture('turn', offCourseInputs, 0)

    expect(result.recoveryCount).toBeGreaterThan(0)
  })
})
