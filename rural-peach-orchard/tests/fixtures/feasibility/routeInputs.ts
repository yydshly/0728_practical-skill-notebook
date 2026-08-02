import type { VehicleInput } from '../../../src/feasibility/vehicle/TricycleController'
import { ORCHARD_WORLD_DEFINITION } from '../../../src/feasibility/world/orchardWorldDefinition'

export const ORCHARD_ROUTE_WAYPOINTS = Object.freeze({
  outbound: ORCHARD_WORLD_DEFINITION.route.outbound,
  returning: ORCHARD_WORLD_DEFINITION.route.returning,
})

export type RouteMarker = 'acceptance-start' | 'hold-start'

export interface RecordedVehicleInput {
  readonly input: VehicleInput
  readonly marker?: RouteMarker
}

function repeat(
  count: number,
  input: VehicleInput,
  marker?: RouteMarker,
): RecordedVehicleInput[] {
  return Array.from({ length: count }, (_, index) => ({
    input,
    marker: index === 0 ? marker : undefined,
  }))
}

const ZERO_INPUT: VehicleInput = Object.freeze({
  throttle: 0,
  brake: 0,
  steer: 0,
})

export const FLAT_BRAKE_INPUTS: readonly RecordedVehicleInput[] = Object.freeze([
  ...repeat(180, ZERO_INPUT),
  ...repeat(47, { throttle: 0.7, brake: 0, steer: 0 }),
  ...repeat(180, { throttle: 0, brake: 1, steer: 0 }, 'acceptance-start'),
])

export const TURN_INPUTS: readonly RecordedVehicleInput[] = Object.freeze([
  ...repeat(180, ZERO_INPUT),
  ...repeat(30, { throttle: 0.4, brake: 0, steer: 0 }),
  ...repeat(140, { throttle: 0.45, brake: 0, steer: 0.65 }, 'acceptance-start'),
  ...repeat(120, { throttle: 0, brake: 1, steer: 0 }),
])

export const SLOPE_RESTART_INPUTS: readonly RecordedVehicleInput[] = Object.freeze([
  ...repeat(180, { throttle: 0, brake: 1, steer: 0 }),
  ...repeat(90, { throttle: 0.6, brake: 0, steer: 0 }),
  ...repeat(240, { throttle: 0, brake: 1, steer: 0 }, 'hold-start'),
  ...repeat(120, { throttle: 0.7, brake: 0, steer: 0 }),
])
