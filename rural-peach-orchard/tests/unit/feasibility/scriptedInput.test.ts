import { describe, expect, it } from 'vitest'
import {
  ScriptedInput,
  type ScriptedFixtureState,
} from '../../../src/feasibility/testing/ScriptedInput'
import type { VehicleCommand } from '../../../src/feasibility/input/RuntimeCommand'
import {
  WaypointVehicleNavigator,
  type WaypointVehicleState,
} from '../../../src/feasibility/testing/WaypointVehicleNavigator'
import {
  ORCHARD_WORLD_DEFINITION,
} from '../../../src/feasibility/world/orchardWorldDefinition'
import { ORCHARD_ROUTE_WAYPOINTS } from '../../fixtures/feasibility/routeInputs'

function vehicleAt(z: number): WaypointVehicleState {
  return {
    vehiclePosition: { x: 0, y: 0, z },
    vehicleRotation: { x: 0, y: 0, z: 0, w: 1 },
    vehicleSpeedMps: 0,
  }
}

function idleState(): ScriptedFixtureState {
  return {
    controlOwner: 'player',
    jobState: 'idle',
    fruitOwner: 'tree',
    vehicleSpeedMps: 0,
    groundedWheelCount: 3,
    vehiclePosition: { x: 0, y: 0.6, z: -16.5 },
    vehicleRotation: { x: 0, y: 0, z: 0, w: 1 },
    playerPosition: { x: 0.5, y: 0.9, z: -16.5 },
    targets: {
      seat: { x: 0, y: 0.9, z: -16.5 },
      parking: { x: 0, y: 0, z: 10.5 },
      tree: { x: 4.5, y: 0, z: 12 },
      basket: { x: 2.6, y: 0, z: 12.5 },
      crate: { x: 1.4, y: 0, z: 12.5 },
      cargo: { x: 0.7, y: 0, z: 10.5 },
      delivery: { x: 0, y: 0, z: -18 },
      outboundWaypoints: ORCHARD_ROUTE_WAYPOINTS.outbound,
      returnWaypoints: ORCHARD_ROUTE_WAYPOINTS.returning,
    },
  }
}

describe('WaypointVehicleNavigator', () => {
  it('navigates outbound and return from supplied waypoints without slope phases', () => {
    const navigator = new WaypointVehicleNavigator({
      arrivalDistanceM: 0.8,
      waypoints: ORCHARD_WORLD_DEFINITION.route.outbound,
    })

    expect(navigator.command(vehicleAt(-16.5)).command.longitudinal).toBe('forward')
    navigator.reset(ORCHARD_WORLD_DEFINITION.route.returning)
    expect(navigator.currentWaypoint()).toEqual({ x: 0, y: 0, z: 10.5 })
    expect(navigator.command(vehicleAt(6)).command.longitudinal).toBe('forward')
  })

  it('advances only inside the arrival radius and brakes above 2.2 m/s', () => {
    const navigator = new WaypointVehicleNavigator({
      arrivalDistanceM: 0.8,
      waypoints: ORCHARD_WORLD_DEFINITION.route.outbound,
    })

    navigator.command(vehicleAt(-17.31))
    expect(navigator.currentWaypoint()).toEqual({ x: 0, y: 0, z: -16.5 })
    navigator.command(vehicleAt(-17.29))
    expect(navigator.currentWaypoint()).toEqual({ x: 0, y: 0, z: -5 })
    const command = navigator.command({
      ...vehicleAt(-10),
      vehicleSpeedMps: 2.21,
    })
    expect(command.command).toMatchObject({
      longitudinal: 'neutral',
      serviceBrake: true,
    })
  })

  it('clamps steering and reduces throttle for a heading error above 0.7', () => {
    const navigator = new WaypointVehicleNavigator({
      arrivalDistanceM: 0.8,
      waypoints: [{ x: 10, y: 0, z: 0 }],
    })

    const command = navigator.command(vehicleAt(0))

    expect(command.command).toEqual({
      longitudinal: 'forward',
      steering: 'right',
      serviceBrake: false,
    })
    expect(command.profile).toEqual({
      throttleMagnitude: 0.25,
      brakeMagnitude: 0,
      steeringMagnitude: 1,
    })
  })

  it('uses a deterministic right turn at the opposite-heading boundary', () => {
    const navigator = new WaypointVehicleNavigator({
      arrivalDistanceM: 0.8,
      waypoints: [{ x: 0, y: 0, z: 10 }],
    })

    const command = navigator.command(vehicleAt(0))

    expect(command.command).toMatchObject({
      longitudinal: 'forward',
      steering: 'right',
    })
    expect(command.profile?.steeringMagnitude).toBe(1)
  })
})

describe('ScriptedInput public-interface fixture', () => {
  it('emits semantic brake commands through the shared controller adapter', () => {
    const commands: VehicleCommand[] = []
    const driveCalls: unknown[] = []
    const input = new ScriptedInput({
      readState: () => ({
        ...idleState(),
        controlOwner: 'vehicle',
        jobState: 'parked-at-orchard',
        vehicleSpeedMps: 0.3,
      }),
      drive: (input) => driveCalls.push(input),
      movePlayer: () => undefined,
      interact: () => undefined,
      recover: () => undefined,
      emitVehicleCommand: (command) => commands.push(command),
      resetCompleteLoop: () => undefined,
      completeLoop: () => undefined,
    })
    input.start()

    input.fixedStep(1 / 60)

    expect(commands).toEqual([
      { longitudinal: 'neutral', steering: 'center', serviceBrake: true },
    ])
    expect(driveCalls).toEqual([{ throttle: 0, brake: 1, steer: 0 }])
  })

  it('preserves proportional scripted steering through the shared adapter', () => {
    let state: ScriptedFixtureState = {
      ...idleState(),
      jobState: 'accepted',
      targets: {
        ...idleState().targets,
        outboundWaypoints: [{ x: 1, y: 0, z: 10 }],
      },
    }
    const commands: VehicleCommand[] = []
    const driveCalls: Array<Readonly<{ throttle: number; brake: number; steer: number }>> = []
    const input = new ScriptedInput({
      readState: () => state,
      drive: (input) => driveCalls.push(input),
      movePlayer: () => undefined,
      interact: () => undefined,
      recover: () => undefined,
      emitVehicleCommand: (command) => commands.push(command),
      resetCompleteLoop: () => undefined,
      completeLoop: () => undefined,
    })
    input.start()

    input.fixedStep(1 / 60)
    state = { ...state, jobState: 'preparing' }
    input.fixedStep(1 / 60)
    state = {
      ...state,
      controlOwner: 'vehicle',
      jobState: 'en-route-to-orchard',
      vehiclePosition: { x: 0, y: 0.6, z: 0 },
      vehicleRotation: { x: 0, y: 1, z: 0, w: 0 },
    }
    input.fixedStep(1 / 60)

    expect(commands.at(-1)).toEqual({
      longitudinal: 'forward', steering: 'left', serviceBrake: false,
    })
    expect(driveCalls.at(-1)).toEqual({
      throttle: 0.45,
      brake: 0,
      steer: expect.closeTo(Math.atan2(1, 10) / 0.55, 5),
    })
  })

  it('emits service brake intent for proportional scripted braking', () => {
    let state: ScriptedFixtureState = { ...idleState(), jobState: 'accepted' }
    const commands: VehicleCommand[] = []
    const driveCalls: Array<Readonly<{ throttle: number; brake: number; steer: number }>> = []
    const input = new ScriptedInput({
      readState: () => state,
      drive: (input) => driveCalls.push(input),
      movePlayer: () => undefined,
      interact: () => undefined,
      recover: () => undefined,
      emitVehicleCommand: (command) => commands.push(command),
      resetCompleteLoop: () => undefined,
      completeLoop: () => undefined,
    })
    input.start()

    const stagedStates: ScriptedFixtureState[] = [
      { ...state, jobState: 'preparing' },
      { ...state, controlOwner: 'vehicle', jobState: 'en-route-to-orchard' },
      { ...state, controlOwner: 'player', jobState: 'parked-at-orchard' },
      { ...state, jobState: 'picking', fruitOwner: 'player' },
      { ...state, jobState: 'picking', fruitOwner: 'basket' },
      { ...state, jobState: 'picking', fruitOwner: 'crate' },
      { ...state, jobState: 'vehicle-loaded', fruitOwner: 'vehicle' },
      {
        ...state,
        controlOwner: 'vehicle',
        jobState: 'returning',
        fruitOwner: 'vehicle',
        vehicleSpeedMps: 2.21,
        vehiclePosition: { x: 0, y: 0.6, z: -9 },
      },
    ]
    input.fixedStep(1 / 60)
    for (const next of stagedStates) {
      state = next
      input.fixedStep(1 / 60)
    }

    expect(commands.at(-1)).toMatchObject({
      longitudinal: 'neutral', serviceBrake: true,
    })
    expect(driveCalls.at(-1)?.brake).toBe(0.35)
  })

  it('starts the job through contextual interact and never calls recovery', () => {
    const calls: string[] = []
    const input = new ScriptedInput({
      readState: idleState,
      drive: () => calls.push('drive'),
      movePlayer: () => calls.push('movePlayer'),
      interact: () => calls.push('interact'),
      recover: () => { throw new Error('recovery is not a normal-route input') },
      resetCompleteLoop: () => { throw new Error('idle is not complete') },
      completeLoop: () => { throw new Error('idle is not complete') },
    })

    input.start()
    input.fixedStep(1 / 60)

    expect(calls).toEqual(['interact', 'drive'])
  })

  it('observes accepted before same-step simulation advances it to preparing', () => {
    let state = idleState()
    const input = new ScriptedInput({
      readState: () => state,
      drive: () => undefined,
      movePlayer: () => undefined,
      interact: () => {
        if (state.jobState === 'idle') {
          state = { ...state, jobState: 'accepted' }
        } else if (state.jobState === 'preparing') {
          state = {
            ...state,
            controlOwner: 'vehicle',
            jobState: 'en-route-to-orchard',
          }
        }
      },
      recover: () => { throw new Error('recovery is forbidden') },
      resetCompleteLoop: () => undefined,
      completeLoop: () => undefined,
    })
    const simulate = () => {
      if (state.jobState === 'accepted') {
        state = { ...state, jobState: 'preparing' }
      }
    }
    input.start()

    input.fixedStep(1 / 60)
    simulate()
    input.fixedStep(1 / 60)

    expect(state.jobState).toBe('en-route-to-orchard')
    expect(input.stageViolationCount).toBe(0)
  })

  it('rejects starting at en-route instead of backfilling accept and preparing', () => {
    const calls: unknown[] = []
    const playerCalls: unknown[] = []
    const input = new ScriptedInput({
      readState: () => ({
        ...idleState(),
        controlOwner: 'vehicle',
        jobState: 'en-route-to-orchard',
      }),
      drive: (value) => calls.push(value),
      movePlayer: (value) => playerCalls.push(value),
      interact: () => undefined,
      recover: () => { throw new Error('recovery is forbidden') },
      resetCompleteLoop: () => undefined,
      completeLoop: () => undefined,
    })

    input.start()
    input.fixedStep(1 / 60)

    expect(input.stageViolationCount).toBe(1)
    expect(input.completedLoops).toBe(0)
    expect(calls).toEqual([{ throttle: 0, brake: 1, steer: 0 }])
    expect(playerCalls).toEqual([{ x: 0, y: 0, z: 0 }])
  })

  it('observes accepted, preparing, and en-route on separate updates', () => {
    let state: ScriptedFixtureState = {
      ...idleState(),
      jobState: 'accepted',
    }
    const driveCalls: unknown[] = []
    const input = new ScriptedInput({
      readState: () => state,
      drive: (value) => driveCalls.push(value),
      movePlayer: () => undefined,
      interact: () => undefined,
      recover: () => { throw new Error('recovery is forbidden') },
      resetCompleteLoop: () => undefined,
      completeLoop: () => undefined,
    })
    input.start()

    input.fixedStep(1 / 60)
    state = { ...state, jobState: 'preparing' }
    input.fixedStep(1 / 60)
    state = {
      ...state,
      controlOwner: 'vehicle',
      jobState: 'en-route-to-orchard',
    }
    input.fixedStep(1 / 60)

    expect(input.stageViolationCount).toBe(0)
    expect(driveCalls.at(-1)).toEqual(expect.objectContaining({
      throttle: expect.any(Number),
      brake: expect.any(Number),
      steer: expect.any(Number),
    }))
  })

  it('retries the public exit request after parking has committed', () => {
    let interactions = 0
    let state: ScriptedFixtureState = {
      ...idleState(),
      jobState: 'accepted',
    }
    const input = new ScriptedInput({
      readState: () => state,
      drive: () => undefined,
      movePlayer: () => undefined,
      interact: () => { interactions += 1 },
      recover: () => { throw new Error('recovery is forbidden') },
      resetCompleteLoop: () => undefined,
      completeLoop: () => undefined,
    })
    input.start()

    input.fixedStep(1 / 60)
    state = { ...state, jobState: 'preparing' }
    input.fixedStep(1 / 60)
    state = {
      ...state,
      controlOwner: 'vehicle',
      jobState: 'en-route-to-orchard',
    }
    input.fixedStep(1 / 60)
    interactions = 0
    state = {
      ...state,
      controlOwner: 'vehicle',
      jobState: 'parked-at-orchard',
    }
    input.fixedStep(1 / 60)

    expect(interactions).toBe(1)
  })

  it('does not attempt seat interaction while the vehicle is still settling', () => {
    let interactions = 0
    const movement: Array<Readonly<{ x: number; y: number; z: number }>> = []
    let state: ScriptedFixtureState = {
      ...idleState(),
      jobState: 'accepted',
      playerPosition: { x: 2, y: 0.9, z: -16.5 },
    }
    const input = new ScriptedInput({
      readState: () => state,
      drive: () => undefined,
      movePlayer: (intent) => movement.push(intent),
      interact: () => { interactions += 1 },
      recover: () => { throw new Error('recovery is forbidden') },
      resetCompleteLoop: () => undefined,
      completeLoop: () => undefined,
    })
    input.start()

    input.fixedStep(1 / 60)
    movement.length = 0
    state = { ...state, jobState: 'preparing', vehicleSpeedMps: 0.3 }
    input.fixedStep(1 / 60)

    expect(interactions).toBe(0)
    expect(movement).toHaveLength(1)
    expect(movement[0]!.x).toBeLessThan(0)
    expect(movement[0]!.z).toBeCloseTo(0)
  })

  it('waits for all three real suspension contacts before entering', () => {
    let interactions = 0
    const input = new ScriptedInput({
      readState: () => ({
        ...idleState(),
        groundedWheelCount: 0,
      }),
      drive: () => undefined,
      movePlayer: () => undefined,
      interact: () => { interactions += 1 },
      recover: () => { throw new Error('recovery is forbidden') },
      resetCompleteLoop: () => undefined,
      completeLoop: () => undefined,
    })
    input.start()

    input.fixedStep(1 / 60)

    expect(interactions).toBe(0)
  })

  it('rejects a jump to a later stage instead of backfilling a trace', () => {
    const state: ScriptedFixtureState = {
      ...idleState(),
      controlOwner: 'vehicle',
      jobState: 'delivered',
      fruitOwner: 'delivered',
    }
    let completions = 0
    const input = new ScriptedInput({
      readState: () => state,
      drive: () => undefined,
      movePlayer: () => undefined,
      interact: () => undefined,
      recover: () => { throw new Error('recovery is forbidden') },
      resetCompleteLoop: () => { throw new Error('invalid loop cannot reset') },
      completeLoop: () => { completions += 1 },
    })
    input.start()

    input.fixedStep(1 / 60)

    expect(completions).toBe(0)
    expect(input.completedLoops).toBe(0)
    expect(input.stageViolationCount).toBe(1)
  })

  it('records only the genuine ordered sequence and stops after loop ten', () => {
    let state: ScriptedFixtureState = idleState()
    let resets = 0
    const traces: string[] = []
    const input = new ScriptedInput({
      readState: () => state,
      drive: () => undefined,
      movePlayer: () => undefined,
      interact: () => undefined,
      recover: () => { throw new Error('recovery is forbidden') },
      resetCompleteLoop: () => { resets += 1 },
      completeLoop: (stages) => { traces.push(stages.join('>')) },
    })
    input.start()

    const genuineSequence: ScriptedFixtureState[] = [
      { ...idleState(), jobState: 'accepted' },
      { ...idleState(), jobState: 'preparing' },
      {
        ...idleState(),
        controlOwner: 'vehicle',
        jobState: 'en-route-to-orchard',
      },
      {
        ...idleState(),
        controlOwner: 'player',
        jobState: 'parked-at-orchard',
      },
      { ...idleState(), jobState: 'picking', fruitOwner: 'player' },
      { ...idleState(), jobState: 'picking', fruitOwner: 'basket' },
      { ...idleState(), jobState: 'picking', fruitOwner: 'crate' },
      { ...idleState(), jobState: 'vehicle-loaded', fruitOwner: 'vehicle' },
      {
        ...idleState(),
        controlOwner: 'vehicle',
        jobState: 'returning',
        fruitOwner: 'vehicle',
      },
      {
        ...idleState(),
        controlOwner: 'vehicle',
        jobState: 'delivered',
        fruitOwner: 'delivered',
      },
    ]
    for (let loop = 0; loop < 10; loop += 1) {
      for (const next of genuineSequence) {
        state = next
        input.fixedStep(1 / 60)
      }
    }

    expect(traces).toEqual(Array(10).fill(
      'accept>drive>park/exit>pick>basket>crate>load>return>deliver',
    ))
    expect(resets).toBe(9)
    expect(input.completedLoops).toBe(10)
    expect(input.done).toBe(true)
    expect(input.stageViolationCount).toBe(0)
  })
})
