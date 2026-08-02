import type { ControlTransitionEvent } from './ControlTransitionEvent'

export type ControlState = 'on-foot' | 'entering' | 'driving' | 'exiting'

export type ControlInputOwner = 'player' | 'vehicle'

export type ControlTransitionCode =
  | 'OK'
  | 'INVALID_STATE'
  | 'VEHICLE_MOVING'
  | 'SEAT_OUT_OF_RANGE'
  | 'DRIVER_PRESENT'
  | 'EXIT_BLOCKED'
  | 'INVALID_TRANSITION_EVENT'
  | 'TRANSITION_SIDE_EFFECT_FAILED'

export interface ControlTransition {
  readonly ok: boolean
  readonly code: ControlTransitionCode
}

export interface EnterVehicleContext {
  readonly vehicleSpeedMps: number
  readonly seatDistanceM: number
  readonly hasExistingDriver?: boolean
}

export interface ControlAuthorityAdapter {
  setPlayerColliderEnabled(enabled: boolean): void
  attachPlayerToSeat(): void
  placePlayerAtExit(): void
  exitIsBlocked(): boolean
}

const MAX_ENTER_SPEED_MPS = 0.25
const MAX_SEAT_DISTANCE_M = 1.2

export class ControlAuthority {
  private stateValue: ControlState = 'on-foot'
  private inputOwnerValue: ControlInputOwner = 'player'
  private expectedTransitionEvent: ControlTransitionEvent | null = null

  constructor(private readonly adapter: ControlAuthorityAdapter) {}

  get state(): ControlState {
    return this.stateValue
  }

  get inputOwner(): ControlInputOwner {
    return this.inputOwnerValue
  }

  get controlsLocked(): boolean {
    return this.stateValue === 'entering' || this.stateValue === 'exiting'
  }

  requestEnter(context: EnterVehicleContext): ControlTransition {
    if (this.stateValue !== 'on-foot') {
      return { ok: false, code: 'INVALID_STATE' }
    }
    if (Math.abs(context.vehicleSpeedMps) > MAX_ENTER_SPEED_MPS) {
      return { ok: false, code: 'VEHICLE_MOVING' }
    }
    if (context.seatDistanceM > MAX_SEAT_DISTANCE_M) {
      return { ok: false, code: 'SEAT_OUT_OF_RANGE' }
    }
    if (context.hasExistingDriver === true) {
      return { ok: false, code: 'DRIVER_PRESENT' }
    }

    this.stateValue = 'entering'
    this.expectedTransitionEvent = 'enter-started'
    return { ok: true, code: 'OK' }
  }

  requestExit(): ControlTransition {
    if (this.stateValue !== 'driving') {
      return { ok: false, code: 'INVALID_STATE' }
    }
    if (this.adapter.exitIsBlocked()) {
      return { ok: false, code: 'EXIT_BLOCKED' }
    }

    this.stateValue = 'exiting'
    this.expectedTransitionEvent = 'exit-started'
    return { ok: true, code: 'OK' }
  }

  completeTransition(event: ControlTransitionEvent): ControlTransition {
    if (event !== this.expectedTransitionEvent) {
      return { ok: false, code: 'INVALID_TRANSITION_EVENT' }
    }

    try {
      switch (event) {
        case 'enter-started':
          this.adapter.setPlayerColliderEnabled(false)
          this.expectedTransitionEvent = 'seated'
          break
        case 'seated':
          this.adapter.attachPlayerToSeat()
          this.stateValue = 'driving'
          this.inputOwnerValue = 'vehicle'
          this.expectedTransitionEvent = null
          break
        case 'exit-started':
          this.expectedTransitionEvent = 'exit-placed'
          break
        case 'exit-placed':
          this.adapter.placePlayerAtExit()
          this.expectedTransitionEvent = 'exit-complete'
          break
        case 'exit-complete':
          this.adapter.setPlayerColliderEnabled(true)
          this.stateValue = 'on-foot'
          this.inputOwnerValue = 'player'
          this.expectedTransitionEvent = null
          break
      }
    } catch {
      return { ok: false, code: 'TRANSITION_SIDE_EFFECT_FAILED' }
    }
    return { ok: true, code: 'OK' }
  }
}
