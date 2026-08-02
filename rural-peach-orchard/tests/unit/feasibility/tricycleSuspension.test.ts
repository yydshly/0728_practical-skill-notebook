import { describe, expect, it } from 'vitest'
import { Quaternion, Vector3 } from 'three'
import runtimeAssetContractJson from '../../../public/feasibility/runtime-assets.json'
import {
  createRuntimeOrientation,
  worldForward,
} from '../../../src/feasibility/assets/RuntimeOrientation'
import { parseRuntimeAssetContract } from '../../../src/feasibility/assets/runtimeAssetContract'
import {
  createTricyclePhysicsFixture,
  ZERO_VEHICLE_INPUT,
} from '../../fixtures/feasibility/createTricyclePhysicsFixture'

const orientation = createRuntimeOrientation(
  parseRuntimeAssetContract(runtimeAssetContractJson).vehicle,
)

describe('TricycleController suspension and straight-line drive', () => {
  it('keeps all three wheel rays grounded after settling', async () => {
    const fixture = await createTricyclePhysicsFixture('flat')

    fixture.step(180, ZERO_VEHICLE_INPUT)

    expect(fixture.telemetry.wheels.map((wheel) => wheel.grounded))
      .toEqual([true, true, true])
  })

  it('accelerates forward without lateral drift', async () => {
    const fixture = await createTricyclePhysicsFixture('flat')

    fixture.step(240, { throttle: 0.7, brake: 0, steer: 0 })

    expect(fixture.telemetry.speedMps).toBeGreaterThan(2)
    expect(Math.abs(fixture.body.translation().x)).toBeLessThan(0.25)
  })

  it('adds cargo mass and shifts the center of mass toward the cargo anchor', async () => {
    const fixture = await createTricyclePhysicsFixture('flat')

    fixture.controller.setCargoMass(120)

    expect(fixture.body.mass()).toBeCloseTo(540, 3)
    expect(fixture.body.localCom().x).toBeCloseTo(0, 6)
    expect(fixture.body.localCom().y).toBeCloseTo(0.5, 6)
    expect(fixture.body.localCom().z).toBeCloseTo(0.073333, 6)
  })

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid cargo mass %s',
    async (cargoKg) => {
      const fixture = await createTricyclePhysicsFixture('flat')

      expect(() => fixture.controller.setCargoMass(cargoKg))
        .toThrow(RangeError)
    },
  )

  it('reports signed forward speed after the final physics tick', async () => {
    const fixture = await createTricyclePhysicsFixture('flat')
    fixture.controller.setCargoMass(0)
    fixture.step(180, ZERO_VEHICLE_INPUT)
    fixture.step(47, { throttle: 0.7, brake: 0, steer: 0 })
    const beforeBrakeMps = fixture.telemetry.forwardSpeedMps

    fixture.step(1, { throttle: 0, brake: 1, steer: 0 })

    const rotation = fixture.body.rotation()
    const forward = worldForward(orientation, new Quaternion(
      rotation.x,
      rotation.y,
      rotation.z,
      rotation.w,
    ))
    const velocity = fixture.body.linvel()
    const postStepMps = forward.dot(new Vector3(
      velocity.x,
      velocity.y,
      velocity.z,
    ))
    expect(Math.abs(postStepMps - beforeBrakeMps)).toBeGreaterThan(0.01)
    expect(fixture.telemetry.forwardSpeedMps).toBeCloseTo(postStepMps, 6)
  })
})
