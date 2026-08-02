import type {
  VehicleCommand,
  VehicleCommandProfile,
} from '../input/RuntimeCommand'
import type { WorldPoint } from '../world/orchardWorldDefinition'

export interface ScriptedVehicleCommand {
  readonly command: VehicleCommand
  readonly profile?: VehicleCommandProfile
}

export interface WaypointVehicleState {
  readonly vehiclePosition: WorldPoint
  readonly vehicleRotation: Readonly<{
    x: number
    y: number
    z: number
    w: number
  }>
  readonly vehicleSpeedMps: number
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function normalizeRadians(value: number): number {
  let normalized = value
  while (normalized > Math.PI) normalized -= Math.PI * 2
  while (normalized < -Math.PI) normalized += Math.PI * 2
  if (normalized > Math.PI - 0.1) normalized -= Math.PI * 2
  return normalized
}

function horizontalDistance(left: WorldPoint, right: WorldPoint): number {
  return Math.hypot(left.x - right.x, left.z - right.z)
}

function yawFromRotation(
  rotation: WaypointVehicleState['vehicleRotation'],
): number {
  const forwardX = 2 * (rotation.x * rotation.z + rotation.w * rotation.y)
  const forwardZ = 1 - 2 * (rotation.x ** 2 + rotation.y ** 2)
  return Math.atan2(-forwardX, -forwardZ)
}

function scriptedCommand(input: Readonly<{
  longitudinal: VehicleCommand['longitudinal']
  steer: number
  throttleMagnitude: number
  brakeMagnitude: number
}>): ScriptedVehicleCommand {
  const steering = input.steer > 0 ? 'left'
    : input.steer < 0 ? 'right' : 'center'
  const profile: VehicleCommandProfile = {
    throttleMagnitude: input.throttleMagnitude,
    brakeMagnitude: input.brakeMagnitude,
    steeringMagnitude: Math.abs(input.steer),
  }
  return {
    command: {
      longitudinal: input.longitudinal,
      steering,
      serviceBrake: input.brakeMagnitude > 0,
    },
    profile,
  }
}

export class WaypointVehicleNavigator {
  private waypoints: readonly WorldPoint[]
  private waypointIndex = 0

  constructor(private readonly options: Readonly<{
    waypoints: readonly WorldPoint[]
    arrivalDistanceM: number
  }>) {
    this.waypoints = options.waypoints
    this.requireWaypoint()
  }

  reset(waypoints: readonly WorldPoint[]): void {
    this.waypoints = waypoints
    this.waypointIndex = 0
    this.requireWaypoint()
  }

  currentWaypoint(): WorldPoint {
    return this.requireWaypoint()
  }

  command(state: WaypointVehicleState): ScriptedVehicleCommand {
    let target = this.currentWaypoint()
    while (
      this.waypointIndex < this.waypoints.length - 1
      && horizontalDistance(state.vehiclePosition, target)
        <= this.options.arrivalDistanceM
    ) {
      this.waypointIndex += 1
      target = this.currentWaypoint()
    }

    const desiredYaw = Math.atan2(
      target.x - state.vehiclePosition.x,
      target.z - state.vehiclePosition.z,
    )
    const headingError = normalizeRadians(
      desiredYaw - yawFromRotation(state.vehicleRotation),
    )
    const steer = clamp(headingError / 0.55, -1, 1)
    if (state.vehicleSpeedMps > 2.2) {
      return scriptedCommand({
        longitudinal: 'neutral',
        steer,
        throttleMagnitude: 0,
        brakeMagnitude: 0.35,
      })
    }
    return scriptedCommand({
      longitudinal: 'forward',
      steer,
      throttleMagnitude: Math.abs(headingError) > 0.7 ? 0.25 : 0.45,
      brakeMagnitude: 0,
    })
  }

  private requireWaypoint(): WorldPoint {
    const waypoint = this.waypoints[this.waypointIndex]
    if (!waypoint) throw new Error('WAYPOINT_ROUTE_EMPTY')
    return waypoint
  }
}
