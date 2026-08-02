import type { ControlInputOwner } from '../control/ControlAuthority'
import type { JobState, OwnerId } from '../domain/types'
import type { PlayerMoveIntent } from '../player/PlayerController'
import type { VehicleInput } from '../vehicle/TricycleController'
import {
  SERVICE_BRAKE_COMMAND,
  vehicleCommandToInput,
  type VehicleCommand,
} from '../input/RuntimeCommand'
import {
  WaypointVehicleNavigator,
  type ScriptedVehicleCommand,
} from './WaypointVehicleNavigator'
import type { WorldPoint } from '../world/orchardWorldDefinition'

export type ScriptedStage =
  | 'accept'
  | 'drive'
  | 'park/exit'
  | 'pick'
  | 'basket'
  | 'crate'
  | 'load'
  | 'return'
  | 'deliver'

interface Point3 {
  readonly x: number
  readonly y: number
  readonly z: number
}

interface Rotation4 extends Point3 {
  readonly w: number
}

const SERVICE_BRAKE_SCRIPTED_COMMAND: ScriptedVehicleCommand = Object.freeze({
  command: SERVICE_BRAKE_COMMAND,
})

export interface ScriptedFixtureTargets {
  readonly seat: Point3
  readonly parking: Point3
  readonly tree: Point3
  readonly basket: Point3
  readonly crate: Point3
  readonly cargo: Point3
  readonly delivery: Point3
  readonly outboundWaypoints: readonly WorldPoint[]
  readonly returnWaypoints: readonly WorldPoint[]
}

export interface ScriptedFixtureState {
  readonly controlOwner: ControlInputOwner
  readonly jobState: JobState
  readonly fruitOwner: OwnerId
  readonly vehicleSpeedMps: number
  readonly groundedWheelCount: number
  readonly vehiclePosition: Point3
  readonly vehicleRotation: Rotation4
  readonly playerPosition: Point3
  readonly targets: ScriptedFixtureTargets
}

export interface ScriptedInputDependencies {
  readonly readState: () => ScriptedFixtureState
  readonly drive: (input: VehicleInput) => void
  readonly movePlayer: (intent: PlayerMoveIntent) => void
  readonly interact: () => void
  readonly recover: () => void
  readonly resetCompleteLoop: () => void
  readonly completeLoop: (stages: readonly ScriptedStage[]) => void
  readonly emitVehicleCommand?: (command: VehicleCommand) => void
}

const ZERO_MOVE: PlayerMoveIntent = Object.freeze({ x: 0, y: 0, z: 0 })
const PLAYER_SPEED_MPS = 2.5
const INTERACTION_DISTANCE_M = 0.9
const PARKING_DISTANCE_M = 0.5
function horizontalDistance(
  left: Readonly<{ x: number; z: number }>,
  right: Readonly<{ x: number; z: number }>,
): number {
  return Math.hypot(left.x - right.x, left.z - right.z)
}

interface ExpectedObservation {
  readonly stage?: ScriptedStage
  matches(state: ScriptedFixtureState): boolean
}

const EXPECTED_OBSERVATIONS: readonly ExpectedObservation[] = Object.freeze([
  Object.freeze({
    stage: 'accept',
    matches: (state: ScriptedFixtureState) => state.jobState === 'accepted',
  }),
  Object.freeze({
    matches: (state: ScriptedFixtureState) => state.jobState === 'preparing',
  }),
  Object.freeze({
    stage: 'drive',
    matches: (state: ScriptedFixtureState) => (
      state.jobState === 'en-route-to-orchard'
    ),
  }),
  Object.freeze({
    stage: 'park/exit',
    matches: (state: ScriptedFixtureState) => (
      state.jobState === 'parked-at-orchard'
      && state.controlOwner === 'player'
    ),
  }),
  Object.freeze({
    stage: 'pick',
    matches: (state: ScriptedFixtureState) => (
      state.jobState === 'picking' && state.fruitOwner === 'player'
    ),
  }),
  Object.freeze({
    stage: 'basket',
    matches: (state: ScriptedFixtureState) => state.fruitOwner === 'basket',
  }),
  Object.freeze({
    stage: 'crate',
    matches: (state: ScriptedFixtureState) => state.fruitOwner === 'crate',
  }),
  Object.freeze({
    stage: 'load',
    matches: (state: ScriptedFixtureState) => (
      state.jobState === 'vehicle-loaded' && state.fruitOwner === 'vehicle'
    ),
  }),
  Object.freeze({
    stage: 'return',
    matches: (state: ScriptedFixtureState) => state.jobState === 'returning',
  }),
  Object.freeze({
    stage: 'deliver',
    matches: (state: ScriptedFixtureState) => (
      state.jobState === 'delivered' && state.fruitOwner === 'delivered'
    ),
  }),
])

function observationIsLaterThanExpected(
  state: ScriptedFixtureState,
  expectedIndex: number,
): boolean {
  return EXPECTED_OBSERVATIONS
    .slice(expectedIndex + 1)
    .some((observation) => observation.matches(state))
}

export class ScriptedInput {
  private started = false
  private completedLoopsValue = 0
  private stages: ScriptedStage[] = []
  private readonly outboundNavigator: WaypointVehicleNavigator
  private readonly returnNavigator: WaypointVehicleNavigator
  private nextObservationIndex = 0
  private stageViolations = 0
  private fixtureFailed = false

  constructor(private readonly dependencies: ScriptedInputDependencies) {
    const { outboundWaypoints, returnWaypoints } = dependencies.readState().targets
    this.outboundNavigator = new WaypointVehicleNavigator({
      arrivalDistanceM: 0.8,
      waypoints: outboundWaypoints,
    })
    this.returnNavigator = new WaypointVehicleNavigator({
      arrivalDistanceM: 0.8,
      waypoints: returnWaypoints,
    })
  }

  get completedLoops(): number {
    return this.completedLoopsValue
  }

  get done(): boolean {
    return this.completedLoopsValue >= 10 || this.fixtureFailed
  }

  get stageViolationCount(): number {
    return this.stageViolations
  }

  start(): void {
    this.started = true
  }

  stop(): void {
    this.started = false
    this.driveCommand(SERVICE_BRAKE_SCRIPTED_COMMAND)
    this.dependencies.movePlayer(ZERO_MOVE)
  }

  fixedStep(fixedSeconds: number): void {
    if (!this.started || this.done) return
    const state = this.dependencies.readState()
    this.observeStages(state)

    if (this.fixtureFailed) {
      this.driveCommand(SERVICE_BRAKE_SCRIPTED_COMMAND)
      this.dependencies.movePlayer(ZERO_MOVE)
      return
    }

    if (state.jobState === 'delivered') {
      this.finishLoop()
      this.driveCommand(SERVICE_BRAKE_SCRIPTED_COMMAND)
      this.dependencies.movePlayer(ZERO_MOVE)
      return
    }

    if (state.controlOwner === 'vehicle') {
      this.driveCommand(this.vehicleCommand(state))
      return
    }

    this.onFootInput(state, fixedSeconds)
    this.driveCommand(SERVICE_BRAKE_SCRIPTED_COMMAND)
  }

  private observeStages(state: ScriptedFixtureState): void {
    const expected = EXPECTED_OBSERVATIONS[this.nextObservationIndex]
    if (!expected) return
    if (expected.matches(state)) {
      if (expected.stage) this.stages.push(expected.stage)
      this.nextObservationIndex += 1
      return
    }
    if (observationIsLaterThanExpected(state, this.nextObservationIndex)) {
      this.stageViolations += 1
      this.fixtureFailed = true
    }
  }

  private finishLoop(): void {
    if (this.nextObservationIndex !== EXPECTED_OBSERVATIONS.length) {
      this.stageViolations += 1
      this.fixtureFailed = true
      return
    }
    this.completedLoopsValue += 1
    this.dependencies.completeLoop(Object.freeze([...this.stages]))
    if (!this.done) this.dependencies.resetCompleteLoop()
    this.stages = []
    const { outboundWaypoints, returnWaypoints } = this.dependencies
      .readState().targets
    this.outboundNavigator.reset(outboundWaypoints)
    this.returnNavigator.reset(returnWaypoints)
    this.nextObservationIndex = 0
  }

  private onFootInput(
    state: ScriptedFixtureState,
    fixedSeconds: number,
  ): void {
    const target = this.onFootTarget(state)
    const distanceM = horizontalDistance(state.playerPosition, target)
    if (distanceM <= INTERACTION_DISTANCE_M) {
      if (
        (
          state.jobState === 'idle'
          || state.jobState === 'accepted'
          || state.jobState === 'preparing'
        )
        && (
          state.vehicleSpeedMps > 0.2
          || state.groundedWheelCount !== 3
        )
      ) return
      this.interactAndObserve()
      return
    }
    const distancePerStepM = PLAYER_SPEED_MPS * fixedSeconds
    this.dependencies.movePlayer({
      x: (target.x - state.playerPosition.x) / distanceM * distancePerStepM,
      y: 0,
      z: (target.z - state.playerPosition.z) / distanceM * distancePerStepM,
    })
  }

  private onFootTarget(state: ScriptedFixtureState): Point3 {
    if (state.jobState === 'returning') return state.targets.delivery
    if (
      state.jobState === 'idle'
      || state.jobState === 'accepted'
      || state.jobState === 'preparing'
    ) {
      return state.targets.seat
    }
    switch (state.fruitOwner) {
      case 'tree':
        return state.targets.tree
      case 'player': return state.targets.basket
      case 'basket': return state.targets.crate
      case 'crate': return state.targets.cargo
      case 'vehicle': return state.targets.seat
      case 'delivered': return state.targets.delivery
    }
  }

  private vehicleCommand(state: ScriptedFixtureState): ScriptedVehicleCommand {
    if (state.jobState === 'parked-at-orchard') {
      if (state.vehicleSpeedMps > 0.18) {
        return SERVICE_BRAKE_SCRIPTED_COMMAND
      }
      this.interactAndObserve()
      return SERVICE_BRAKE_SCRIPTED_COMMAND
    }
    if (state.jobState === 'en-route-to-orchard') {
      const distanceToParking = horizontalDistance(
        state.vehiclePosition,
        state.targets.parking,
      )
      if (distanceToParking <= PARKING_DISTANCE_M) {
        if (state.vehicleSpeedMps > 0.18) {
          return SERVICE_BRAKE_SCRIPTED_COMMAND
        }
        this.interactAndObserve()
        return SERVICE_BRAKE_SCRIPTED_COMMAND
      }
      return this.outboundNavigator.command(state)
    }
    if (state.jobState === 'returning') {
      const distanceToDelivery = horizontalDistance(
        state.vehiclePosition,
        state.targets.delivery,
      )
      if (distanceToDelivery <= PARKING_DISTANCE_M) {
        if (state.vehicleSpeedMps > 0.18) {
          return SERVICE_BRAKE_SCRIPTED_COMMAND
        }
        this.interactAndObserve()
        return SERVICE_BRAKE_SCRIPTED_COMMAND
      }
      return this.returnNavigator.command(state)
    }
    return SERVICE_BRAKE_SCRIPTED_COMMAND
  }

  private interactAndObserve(): void {
    this.dependencies.interact()
    this.observeStages(this.dependencies.readState())
  }

  private driveCommand(input: ScriptedVehicleCommand): void {
    this.dependencies.emitVehicleCommand?.(input.command)
    this.dependencies.drive(vehicleCommandToInput(input.command, input.profile))
  }
}
