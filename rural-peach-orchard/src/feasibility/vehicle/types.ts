import type { ColliderHandle } from '@dimforge/rapier3d-compat'
import type { Object3D } from 'three'
import type { WheelTelemetrySample } from './VehicleTelemetry'

export interface TricycleColliderVector {
  x: number
  y: number
  z: number
}

export interface MeasuredWheelEnvelope {
  nodeName: string
  center: TricycleColliderVector
  halfExtents: TricycleColliderVector
  radiusM: number
}

export interface BuiltTricycleColliders {
  chassisColliderHandles: ColliderHandle[]
  wheelEnvelopes: MeasuredWheelEnvelope[]
}

export interface TricycleWheelVisuals {
  readonly front: Object3D
  readonly rearLeft: Object3D
  readonly rearRight: Object3D
}

export interface RoutePoint {
  readonly x: number
  readonly y: number
  readonly z: number
}

export interface RouteMarkerState {
  readonly position: RoutePoint
  readonly headingDeg: number
  readonly pitchDeg: number
  readonly rollDeg: number
  readonly forwardSpeedMps: number
  readonly groundedWheelCount: number
  readonly wheels: readonly WheelTelemetrySample[]
}

export interface RouteResult {
  readonly start: RoutePoint
  readonly end: RoutePoint
  readonly distanceM: number
  readonly horizontalDisplacementM: number
  readonly minimumForwardSpeedMps: number
  readonly maximumRollDeg: number
  readonly backslideM: number
  readonly recoveryCount: number
  readonly finalSpeedMps: number
  readonly headingChangeDeg: number
  readonly acceptanceStart: RouteMarkerState | null
  readonly holdStart: RouteMarkerState | null
}
