import { Euler, Object3D, Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { FixedStepRunner } from '../../../src/feasibility/physics/FixedStepRunner'
import { FixedStepRuntimeLoop } from '../../../src/feasibility/runtime/FixedStepRuntimeLoop'
import { TricycleVisualController } from '../../../src/feasibility/vehicle/TricycleVisualController'
import type { VehicleTelemetrySample } from '../../../src/feasibility/vehicle/VehicleTelemetry'

function createFixture(): Readonly<{
  controller: TricycleVisualController
  front: Object3D
  rearLeft: Object3D
  rearRight: Object3D
}> {
  const front = new Object3D()
  front.name = 'wheel_front'
  front.quaternion.setFromEuler(new Euler(0.1, -0.2, 0.05))
  const rearLeft = new Object3D()
  rearLeft.name = 'wheel_rear_left'
  rearLeft.quaternion.setFromEuler(new Euler(-0.08, 0.03, -0.04))
  const rearRight = new Object3D()
  rearRight.name = 'wheel_rear_right'
  rearRight.quaternion.setFromEuler(new Euler(0.04, 0.06, 0.09))
  return {
    controller: new TricycleVisualController({
      wheels: { front, rearLeft, rearRight },
    }),
    front,
    rearLeft,
    rearRight,
  }
}

function sample(
  steerAngleRad: number,
  angularDeltas: readonly [number, number, number],
  grounded: readonly [boolean, boolean, boolean] = [true, true, true],
): VehicleTelemetrySample {
  return {
    speedMps: 0,
    forwardSpeedMps: 0,
    steerAngleRad,
    wheels: [
      {
        id: 'front', grounded: grounded[0], hitDistanceM: 0,
        compressionM: 0, normalForceN: 1, angularDeltaRad: angularDeltas[0],
      },
      {
        id: 'rear-left', grounded: grounded[1], hitDistanceM: 0,
        compressionM: 0, normalForceN: 1, angularDeltaRad: angularDeltas[1],
      },
      {
        id: 'rear-right', grounded: grounded[2], hitDistanceM: 0,
        compressionM: 0, normalForceN: 1, angularDeltaRad: angularDeltas[2],
      },
    ],
  }
}

function expectQuaternionClose(actual: Quaternion, expected: Quaternion): void {
  expect(Math.abs(actual.dot(expected))).toBeCloseTo(1, 8)
}

describe('TricycleVisualController', () => {
  it('yaws the front named wheel left for positive driver-view steering without bind-pose drift', () => {
    const { controller, front } = createFixture()
    const bind = front.quaternion.clone()

    controller.update(sample(0.3, [0, 0, 0]))
    controller.update(sample(0.3, [0, 0, 0]))

    const expected = bind.clone().multiply(
      new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.3),
    )
    expectQuaternionClose(front.quaternion, expected)
  })

  it('rolls every grounded named wheel by its signed angular telemetry', () => {
    const { controller, front, rearLeft, rearRight } = createFixture()
    const frontBind = front.quaternion.clone()
    const rearLeftBind = rearLeft.quaternion.clone()
    const rearRightBind = rearRight.quaternion.clone()

    controller.update(sample(0, [0.5, 0.7, 0.9]))

    const rollAxis = new Vector3(1, 0, 0)
    expectQuaternionClose(front.quaternion, frontBind.clone().multiply(
      new Quaternion().setFromAxisAngle(rollAxis, 0.5),
    ))
    expectQuaternionClose(rearLeft.quaternion, rearLeftBind.clone().multiply(
      new Quaternion().setFromAxisAngle(rollAxis, 0.7),
    ))
    expectQuaternionClose(rearRight.quaternion, rearRightBind.clone().multiply(
      new Quaternion().setFromAxisAngle(rollAxis, 0.9),
    ))
  })

  it('reverses roll for reverse telemetry and holds an airborne wheel at its last roll', () => {
    const { controller, front, rearLeft, rearRight } = createFixture()
    const frontBind = front.quaternion.clone()
    const rearLeftBind = rearLeft.quaternion.clone()
    const rearRightBind = rearRight.quaternion.clone()

    controller.update(sample(0, [0.4, 0.4, 0.4]))
    controller.update(sample(0, [-0.4, -0.4, -0.4], [true, false, true]))

    expectQuaternionClose(front.quaternion, frontBind)
    expectQuaternionClose(rearLeft.quaternion, rearLeftBind.clone().multiply(
      new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 0.4),
    ))
    expectQuaternionClose(rearRight.quaternion, rearRightBind)
  })

  it('consumes each fixed-step wheel delta once across zero-step and multi-step render frames', () => {
    const { controller, front } = createFixture()
    const frontBind = front.quaternion.clone()
    const callbacks = new Map<number, FrameRequestCallback>()
    const deltas = [0.2, 0.3, 0.4]
    let nextCallbackId = 1
    let fixedStepCount = 0
    const loop = new FixedStepRuntimeLoop({
      runner: new FixedStepRunner(1 / 60, 0.1),
      fixedSeconds: 1 / 60,
      input: {
        start: () => undefined,
        stop: () => undefined,
        fixedStep: () => {
          controller.consume(sample(0, [deltas[fixedStepCount++]!, 0, 0]))
        },
      },
      simulate: () => undefined,
      interpolate: () => undefined,
      updateCamera: () => undefined,
      render: () => undefined,
      requestFrame: (callback) => {
        const id = nextCallbackId++
        callbacks.set(id, callback)
        return id
      },
      cancelFrame: (id) => { callbacks.delete(id) },
    })

    loop.start()
    callbacks.get(1)!(1000)
    callbacks.get(2)!(1008)
    expectQuaternionClose(front.quaternion, frontBind)

    callbacks.get(3)!(1058)

    expect(fixedStepCount).toBe(3)
    expectQuaternionClose(front.quaternion, frontBind.clone().multiply(
      new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 0.9),
    ))
  })
})
