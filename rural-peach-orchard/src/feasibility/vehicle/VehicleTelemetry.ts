export type TricycleWheelId = 'front' | 'rear-left' | 'rear-right'

export interface WheelTelemetrySample {
  readonly id: TricycleWheelId
  readonly grounded: boolean
  readonly hitDistanceM: number | null
  readonly compressionM: number
  readonly normalForceN: number
  /** Signed physical wheel travel for this fixed step, expressed as radians. */
  readonly angularDeltaRad: number
}

export interface VehicleTelemetrySample {
  readonly speedMps: number
  readonly forwardSpeedMps: number
  /** Signed front-wheel yaw in the vehicle's local Y-up frame. */
  readonly steerAngleRad: number
  readonly wheels: readonly WheelTelemetrySample[]
}
