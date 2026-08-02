import type { VehicleInput } from '../vehicle/TricycleController'

export type LongitudinalIntent = 'forward' | 'reverse' | 'neutral'
export type SteeringIntent = 'left' | 'right' | 'center'

export interface VehicleCommand {
  readonly longitudinal: LongitudinalIntent
  readonly steering: SteeringIntent
  readonly serviceBrake: boolean
}

export interface ActionPulse {
  readonly id: number
  readonly kind: 'interact' | 'recover'
}

export interface VehicleCommandProfile {
  readonly throttleMagnitude?: number
  readonly brakeMagnitude?: number
  readonly steeringMagnitude?: number
}

export const SERVICE_BRAKE_COMMAND: VehicleCommand = Object.freeze({
  longitudinal: 'neutral',
  steering: 'center',
  serviceBrake: true,
})

function normalizedMagnitude(value: number | undefined, fallback: number): number {
  return Math.min(1, Math.max(0, value ?? fallback))
}

export function vehicleCommandToInput(
  command: VehicleCommand,
  profile: VehicleCommandProfile = {},
): VehicleInput {
  return {
    throttle: command.serviceBrake
      ? 0
      : command.longitudinal === 'forward'
        ? normalizedMagnitude(profile.throttleMagnitude, 1)
        : command.longitudinal === 'reverse'
          ? -normalizedMagnitude(profile.throttleMagnitude, 1)
          : 0,
    brake: command.serviceBrake
      ? normalizedMagnitude(profile.brakeMagnitude, 1)
      : 0,
    steer: command.steering === 'left'
      ? normalizedMagnitude(profile.steeringMagnitude, 1)
      : command.steering === 'right'
        ? -normalizedMagnitude(profile.steeringMagnitude, 1)
        : 0,
  }
}
