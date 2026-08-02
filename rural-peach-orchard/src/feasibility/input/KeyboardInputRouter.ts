import type { ControlInputOwner } from '../control/ControlAuthority'
import type { PlayerMoveIntent } from '../player/PlayerController'
import type { VehicleInput } from '../vehicle/TricycleController'
import {
  SERVICE_BRAKE_COMMAND,
  vehicleCommandToInput,
  type ActionPulse,
  type VehicleCommand,
} from './RuntimeCommand'

export interface KeyboardInputRouterDependencies {
  readonly target: EventTarget
  readonly getInputOwner: () => ControlInputOwner
  readonly controlsLocked?: () => boolean
  readonly drive: (input: VehicleInput) => void
  readonly movePlayer: (intent: PlayerMoveIntent) => void
  readonly interact: () => void
  readonly recover: () => void
  readonly emitVehicleCommand?: (command: VehicleCommand) => void
  readonly emitActionPulse?: (pulse: ActionPulse) => void
}

const PLAYER_SPEED_MPS = 2.5
const MOVEMENT_CODES = new Set(['KeyW', 'KeyS', 'KeyA', 'KeyD'])
const ACTION_CODES = new Set(['KeyE', 'KeyR'])
const SERVICE_BRAKE_CODE = 'Space'
export const ZERO_VEHICLE_INPUT: VehicleInput = vehicleCommandToInput(
  SERVICE_BRAKE_COMMAND,
)

export class KeyboardInputRouter {
  private readonly pressed = new Set<string>()
  private readonly actionPulses: ActionPulse[] = []
  private nextActionPulseId = 1
  private started = false

  private readonly onKeyDown = (untypedEvent: Event): void => {
    const event = untypedEvent as KeyboardEvent
    if (
      !MOVEMENT_CODES.has(event.code)
      && !ACTION_CODES.has(event.code)
      && event.code !== SERVICE_BRAKE_CODE
    ) {
      return
    }
    event.preventDefault()
    if (
      MOVEMENT_CODES.has(event.code)
      || event.code === SERVICE_BRAKE_CODE
    ) this.pressed.add(event.code)
    if (!event.repeat && event.code === 'KeyE') this.queueActionPulse('interact')
    if (!event.repeat && event.code === 'KeyR') this.queueActionPulse('recover')
  }

  private readonly onKeyUp = (untypedEvent: Event): void => {
    const event = untypedEvent as KeyboardEvent
    if (
      !MOVEMENT_CODES.has(event.code)
      && !ACTION_CODES.has(event.code)
      && event.code !== SERVICE_BRAKE_CODE
    ) return
    event.preventDefault()
    this.pressed.delete(event.code)
  }

  private readonly onBlur = (): void => {
    this.pressed.clear()
  }

  constructor(
    private readonly dependencies: KeyboardInputRouterDependencies,
  ) {}

  start(): void {
    if (this.started) return
    this.started = true
    this.dependencies.target.addEventListener('keydown', this.onKeyDown)
    this.dependencies.target.addEventListener('keyup', this.onKeyUp)
    this.dependencies.target.addEventListener('blur', this.onBlur)
  }

  stop(): void {
    if (!this.started) return
    this.started = false
    this.dependencies.target.removeEventListener('keydown', this.onKeyDown)
    this.dependencies.target.removeEventListener('keyup', this.onKeyUp)
    this.dependencies.target.removeEventListener('blur', this.onBlur)
    this.pressed.clear()
    this.actionPulses.length = 0
  }

  fixedStep(fixedSeconds: number): void {
    for (const pulse of this.actionPulses.splice(0)) {
      if (
        pulse.kind === 'interact'
        && this.dependencies.controlsLocked?.() === true
      ) continue
      if (this.dependencies.emitActionPulse) {
        this.dependencies.emitActionPulse(pulse)
      } else if (pulse.kind === 'interact') {
        this.dependencies.interact()
      } else {
        this.dependencies.recover()
      }
    }

    const command = this.currentVehicleCommand()
    const horizontal = command.steering === 'left' ? -1
      : command.steering === 'right' ? 1 : 0
    const vertical = command.longitudinal === 'forward' ? 1
      : command.longitudinal === 'reverse' ? -1 : 0
    const inputOwner = this.dependencies.getInputOwner()
    const controlsLocked = this.dependencies.controlsLocked?.() === true
    const vehicleCommand = inputOwner === 'vehicle' && !controlsLocked
      ? command
      : SERVICE_BRAKE_COMMAND
    this.dependencies.emitVehicleCommand?.(vehicleCommand)
    this.dependencies.drive(vehicleCommandToInput(vehicleCommand))
    if (inputOwner === 'player' && !controlsLocked) {
      this.dependencies.movePlayer({
        x: horizontal * PLAYER_SPEED_MPS * fixedSeconds,
        y: 0,
        z: vertical * PLAYER_SPEED_MPS * fixedSeconds,
      })
    }

  }

  private queueActionPulse(kind: ActionPulse['kind']): void {
    this.actionPulses.push({ id: this.nextActionPulseId, kind })
    this.nextActionPulseId += 1
  }

  private currentVehicleCommand(): VehicleCommand {
    const forward = this.pressed.has('KeyW')
    const reverse = this.pressed.has('KeyS')
    const driverLeft = this.pressed.has('KeyA')
    const driverRight = this.pressed.has('KeyD')
    const conflictingDrive = forward && reverse
    return {
      longitudinal: conflictingDrive
        ? 'neutral'
        : forward ? 'forward' : reverse ? 'reverse' : 'neutral',
      steering: driverLeft === driverRight
        ? 'center'
        : driverLeft ? 'left' : 'right',
      serviceBrake: this.pressed.has(SERVICE_BRAKE_CODE) || conflictingDrive,
    }
  }
}
