import { Quaternion, Vector3 } from 'three'
import type { VehicleTelemetrySample } from './VehicleTelemetry'
import type { TricycleWheelVisuals } from './types'

const LOCAL_UP = new Vector3(0, 1, 0)
const LOCAL_AXLE = new Vector3(1, 0, 0)

interface WheelPresentationState {
  readonly visual: TricycleWheelVisuals[keyof TricycleWheelVisuals]
  readonly bindQuaternion: Quaternion
  rollAngleRad: number
}

export interface TricycleVisualControllerDependencies {
  readonly wheels: TricycleWheelVisuals
}

/**
 * Applies physics telemetry to visual-only wheel nodes. Airborne wheels retain
 * their most recent roll angle because the physics controller emits no travel
 * while they are not grounded.
 */
export class TricycleVisualController {
  private readonly wheels: Readonly<Record<string, WheelPresentationState>>

  constructor(dependencies: TricycleVisualControllerDependencies) {
    this.wheels = {
      front: this.createWheelState(dependencies.wheels.front),
      'rear-left': this.createWheelState(dependencies.wheels.rearLeft),
      'rear-right': this.createWheelState(dependencies.wheels.rearRight),
    }
  }

  update(sample: VehicleTelemetrySample): void {
    this.consume(sample)
  }

  /** Consumes one fixed-step physics sample exactly once. */
  consume(sample: VehicleTelemetrySample): void {
    for (const wheel of sample.wheels) {
      const state = this.wheels[wheel.id]
      if (!state) continue
      if (wheel.grounded) state.rollAngleRad += wheel.angularDeltaRad
    }
    this.applyWheel('front', sample.steerAngleRad)
    this.applyWheel('rear-left', 0)
    this.applyWheel('rear-right', 0)
  }

  private createWheelState(
    visual: TricycleWheelVisuals[keyof TricycleWheelVisuals],
  ): WheelPresentationState {
    return {
      visual,
      bindQuaternion: visual.quaternion.clone(),
      rollAngleRad: 0,
    }
  }

  private applyWheel(id: string, steerAngleRad: number): void {
    const state = this.wheels[id]
    if (!state) return
    const steer = new Quaternion().setFromAxisAngle(LOCAL_UP, steerAngleRad)
    const roll = new Quaternion().setFromAxisAngle(LOCAL_AXLE, state.rollAngleRad)
    state.visual.quaternion.copy(state.bindQuaternion).multiply(steer).multiply(roll)
  }
}
