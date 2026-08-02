import RAPIER from '@dimforge/rapier3d-compat'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import runtimeAssetContractJson from '../../../public/feasibility/runtime-assets.json'
import { parseRuntimeAssetContract } from '../../../src/feasibility/assets/runtimeAssetContract'
import { ControlAuthority } from '../../../src/feasibility/control/ControlAuthority'
import { DeterministicControlTransitionSequencer } from '../../../src/feasibility/control/DeterministicControlTransitionSequencer'
import { PhysicsWorld } from '../../../src/feasibility/physics/PhysicsWorld'
import { PlayerController } from '../../../src/feasibility/player/PlayerController'

const characterContract = parseRuntimeAssetContract(
  runtimeAssetContractJson,
).character

beforeAll(async () => {
  await RAPIER.init()
})

describe('PlayerController Rapier capsule', () => {
  it('creates the registered runtime capsule on a kinematic body', async () => {
    const physics = await PhysicsWorld.create()
    const player = new PlayerController({
      physics,
      contract: characterContract,
      initialTranslation: { x: 0, y: 0.84, z: 0 },
    })

    expect(player.body.bodyType()).toBe(RAPIER.RigidBodyType.KinematicPositionBased)
    expect(player.collider.shapeType()).toBe(RAPIER.ShapeType.Capsule)
    expect(player.collider.halfHeight()).toBeCloseTo(0.62)
    expect(player.collider.radius()).toBeCloseTo(0.22)
  })

  it('applies Rapier-corrected movement instead of the desired movement through a wall', async () => {
    const physics = await PhysicsWorld.create()
    physics.createFixedCuboid(
      { x: 1, y: 0.84, z: 0 },
      { x: 0.1, y: 1.5, z: 1.5 },
    )
    const player = new PlayerController({
      physics,
      contract: characterContract,
      initialTranslation: { x: 0, y: 0.84, z: 0 },
    })
    physics.step()

    player.move({ x: 2, y: 0, z: 0 })

    const next = player.body.nextTranslation()
    expect(next.x).toBeGreaterThan(0.5)
    expect(next.x).toBeLessThan(0.7)
    expect(next.y).toBeCloseTo(0.84)
    expect(next.z).toBeCloseTo(0)
  })

  it('passes through course sensors while retaining solid collision checks', async () => {
    const physics = await PhysicsWorld.create()
    physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.5, 1, 1)
        .setTranslation(1, 0.84, 0)
        .setSensor(true),
    )
    const player = new PlayerController({
      physics,
      contract: characterContract,
      initialTranslation: { x: 0, y: 0.84, z: 0 },
    })
    physics.step()

    player.move({ x: 2, y: 0, z: 0 })

    expect(player.body.nextTranslation().x).toBeCloseTo(2)
  })
})

function createAuthorityFixture() {
  let blocked = false
  const adapter = {
    setPlayerColliderEnabled: vi.fn(),
    attachPlayerToSeat: vi.fn(),
    placePlayerAtExit: vi.fn(),
    exitIsBlocked: vi.fn(() => blocked),
  }
  return {
    authority: new ControlAuthority(adapter),
    adapter,
    setBlocked: (value: boolean) => { blocked = value },
  }
}

describe('ControlAuthority', () => {
  it('keeps enter observable until ordered events seat the player', () => {
    const { authority, adapter } = createAuthorityFixture()
    expect(authority.inputOwner).toBe('player')

    expect(authority.requestEnter({
      vehicleSpeedMps: 0,
      seatDistanceM: 0.8,
    })).toEqual({ ok: true, code: 'OK' })

    expect(authority.state).toBe('entering')
    expect(authority.inputOwner).toBe('player')
    expect(authority.controlsLocked).toBe(true)
    expect(adapter.setPlayerColliderEnabled).not.toHaveBeenCalled()
    expect(adapter.attachPlayerToSeat).not.toHaveBeenCalled()

    expect(authority.completeTransition('enter-started')).toEqual({
      ok: true,
      code: 'OK',
    })
    expect(authority.state).toBe('entering')
    expect(authority.inputOwner).toBe('player')
    expect(adapter.setPlayerColliderEnabled).toHaveBeenCalledOnce()
    expect(adapter.setPlayerColliderEnabled).toHaveBeenLastCalledWith(false)
    expect(adapter.attachPlayerToSeat).not.toHaveBeenCalled()

    expect(authority.completeTransition('seated')).toEqual({
      ok: true,
      code: 'OK',
    })
    expect(authority.state).toBe('driving')
    expect(authority.inputOwner).toBe('vehicle')
    expect(authority.controlsLocked).toBe(false)
    expect(adapter.attachPlayerToSeat).toHaveBeenCalledTimes(1)
  })

  it.each([
    {
      name: 'the vehicle is faster than the stopped threshold',
      context: { vehicleSpeedMps: 0.250_001, seatDistanceM: 0.8 },
      code: 'VEHICLE_MOVING',
    },
    {
      name: 'the seat is beyond interaction range',
      context: { vehicleSpeedMps: 0, seatDistanceM: 1.200_001 },
      code: 'SEAT_OUT_OF_RANGE',
    },
    {
      name: 'another driver already owns the vehicle',
      context: {
        vehicleSpeedMps: 0,
        seatDistanceM: 0.8,
        hasExistingDriver: true,
      },
      code: 'DRIVER_PRESENT',
    },
  ])('rejects entry when $name without changing state or side effects', ({
    context,
    code,
  }) => {
    const { authority, adapter } = createAuthorityFixture()

    expect(authority.requestEnter(context).code).toBe(code)
    expect(authority.state).toBe('on-foot')
    expect(authority.inputOwner).toBe('player')
    expect(adapter.setPlayerColliderEnabled).not.toHaveBeenCalled()
    expect(adapter.attachPlayerToSeat).not.toHaveBeenCalled()
  })

  it('accepts the inclusive speed and seat-distance boundaries', () => {
    const { authority } = createAuthorityFixture()

    expect(authority.requestEnter({
      vehicleSpeedMps: -0.25,
      seatDistanceM: 1.2,
      hasExistingDriver: false,
    })).toEqual({ ok: true, code: 'OK' })
    expect(authority.state).toBe('entering')
  })

  it('keeps all driving state and transfer side effects unchanged when exit is blocked', () => {
    const { authority, adapter, setBlocked } = createAuthorityFixture()
    authority.requestEnter({ vehicleSpeedMps: 0, seatDistanceM: 0.8 })
    authority.completeTransition('enter-started')
    authority.completeTransition('seated')
    const colliderCallsBefore = adapter.setPlayerColliderEnabled.mock.calls
      .map((call) => [...call])
    const attachCallsBefore = adapter.attachPlayerToSeat.mock.calls.length
    const detachCallsBefore = adapter.placePlayerAtExit.mock.calls.length
    setBlocked(true)

    expect(authority.requestExit()).toEqual({
      ok: false,
      code: 'EXIT_BLOCKED',
    })

    expect(authority.state).toBe('driving')
    expect(authority.inputOwner).toBe('vehicle')
    expect(adapter.setPlayerColliderEnabled.mock.calls).toEqual(
      colliderCallsBefore,
    )
    expect(adapter.attachPlayerToSeat).toHaveBeenCalledTimes(attachCallsBefore)
    expect(adapter.placePlayerAtExit).toHaveBeenCalledTimes(detachCallsBefore)
  })

  it('keeps exit observable until ordered events place and release the player', () => {
    const { authority, adapter } = createAuthorityFixture()
    authority.requestEnter({ vehicleSpeedMps: 0, seatDistanceM: 0.8 })
    authority.completeTransition('enter-started')
    authority.completeTransition('seated')

    expect(authority.requestExit()).toEqual({ ok: true, code: 'OK' })

    expect(authority.state).toBe('exiting')
    expect(authority.inputOwner).toBe('vehicle')
    expect(authority.controlsLocked).toBe(true)
    expect(adapter.placePlayerAtExit).not.toHaveBeenCalled()
    expect(adapter.setPlayerColliderEnabled).toHaveBeenCalledTimes(1)

    expect(authority.completeTransition('exit-started')).toEqual({
      ok: true,
      code: 'OK',
    })
    expect(authority.state).toBe('exiting')
    expect(authority.inputOwner).toBe('vehicle')
    expect(adapter.placePlayerAtExit).not.toHaveBeenCalled()

    expect(authority.completeTransition('exit-placed')).toEqual({
      ok: true,
      code: 'OK',
    })
    expect(authority.state).toBe('exiting')
    expect(authority.inputOwner).toBe('vehicle')
    expect(adapter.placePlayerAtExit).toHaveBeenCalledTimes(1)
    expect(adapter.setPlayerColliderEnabled).toHaveBeenCalledTimes(1)
    expect(adapter.setPlayerColliderEnabled).toHaveBeenLastCalledWith(false)

    expect(adapter.exitIsBlocked).toHaveBeenCalledTimes(1)
    expect(authority.completeTransition('exit-complete')).toEqual({
      ok: true,
      code: 'OK',
    })
    expect(adapter.setPlayerColliderEnabled).toHaveBeenCalledTimes(2)
    expect(adapter.setPlayerColliderEnabled).toHaveBeenLastCalledWith(true)
    expect(authority.state).toBe('on-foot')
    expect(authority.inputOwner).toBe('player')
    expect(authority.controlsLocked).toBe(false)
  })

  it.each([
    {
      name: 'skipping enter-started',
      arrange: (authority: ControlAuthority) => {
        authority.requestEnter({ vehicleSpeedMps: 0, seatDistanceM: 0.8 })
      },
      event: 'seated' as const,
      state: 'entering' as const,
      owner: 'player' as const,
    },
    {
      name: 'sending an exit event during entry',
      arrange: (authority: ControlAuthority) => {
        authority.requestEnter({ vehicleSpeedMps: 0, seatDistanceM: 0.8 })
      },
      event: 'exit-started' as const,
      state: 'entering' as const,
      owner: 'player' as const,
    },
    {
      name: 'skipping exit-started',
      arrange: (authority: ControlAuthority) => {
        authority.requestEnter({ vehicleSpeedMps: 0, seatDistanceM: 0.8 })
        authority.completeTransition('enter-started')
        authority.completeTransition('seated')
        authority.requestExit()
      },
      event: 'exit-placed' as const,
      state: 'exiting' as const,
      owner: 'vehicle' as const,
    },
    {
      name: 'skipping exit placement',
      arrange: (authority: ControlAuthority) => {
        authority.requestEnter({ vehicleSpeedMps: 0, seatDistanceM: 0.8 })
        authority.completeTransition('enter-started')
        authority.completeTransition('seated')
        authority.requestExit()
        authority.completeTransition('exit-started')
      },
      event: 'exit-complete' as const,
      state: 'exiting' as const,
      owner: 'vehicle' as const,
    },
  ])('rejects $name without partial side effects', ({
    arrange,
    event,
    state,
    owner,
  }) => {
    const { authority, adapter } = createAuthorityFixture()
    arrange(authority)
    const callsBefore = {
      collider: adapter.setPlayerColliderEnabled.mock.calls.map(
        (call) => [...call],
      ),
      attach: adapter.attachPlayerToSeat.mock.calls.length,
      detach: adapter.placePlayerAtExit.mock.calls.length,
      exitProbe: adapter.exitIsBlocked.mock.calls.length,
    }

    expect(authority.completeTransition(event)).toEqual({
      ok: false,
      code: 'INVALID_TRANSITION_EVENT',
    })

    expect(authority.state).toBe(state)
    expect(authority.inputOwner).toBe(owner)
    expect(adapter.setPlayerColliderEnabled.mock.calls).toEqual(
      callsBefore.collider,
    )
    expect(adapter.attachPlayerToSeat).toHaveBeenCalledTimes(callsBefore.attach)
    expect(adapter.placePlayerAtExit).toHaveBeenCalledTimes(callsBefore.detach)
    expect(adapter.exitIsBlocked).toHaveBeenCalledTimes(callsBefore.exitProbe)
  })

  it('rejects transfer requests from invalid states without side effects', () => {
    const { authority, adapter } = createAuthorityFixture()

    expect(authority.requestExit()).toEqual({
      ok: false,
      code: 'INVALID_STATE',
    })
    expect(adapter.exitIsBlocked).not.toHaveBeenCalled()

    authority.requestEnter({ vehicleSpeedMps: 0, seatDistanceM: 0.8 })
    const colliderCallsBefore = adapter.setPlayerColliderEnabled.mock.calls
      .length
    expect(authority.requestEnter({
      vehicleSpeedMps: 0,
      seatDistanceM: 0.8,
    })).toEqual({ ok: false, code: 'INVALID_STATE' })
    expect(adapter.setPlayerColliderEnabled).toHaveBeenCalledTimes(
      colliderCallsBefore,
    )
    expect(authority.state).toBe('entering')
    expect(authority.inputOwner).toBe('player')

    authority.completeTransition('enter-started')
    authority.completeTransition('seated')
    authority.requestExit()
    const detachCallsBefore = adapter.placePlayerAtExit.mock.calls.length
    expect(authority.requestExit()).toEqual({
      ok: false,
      code: 'INVALID_STATE',
    })
    expect(adapter.placePlayerAtExit).toHaveBeenCalledTimes(detachCallsBefore)
    expect(authority.state).toBe('exiting')
    expect(authority.inputOwner).toBe('vehicle')
  })

  it('surfaces adapter failure without advancing the logical event cursor', () => {
    const { authority, adapter } = createAuthorityFixture()
    adapter.setPlayerColliderEnabled.mockImplementationOnce(() => {
      throw new Error('injected collider failure')
    })
    authority.requestEnter({ vehicleSpeedMps: 0, seatDistanceM: 0.8 })

    expect(authority.completeTransition('enter-started')).toEqual({
      ok: false,
      code: 'TRANSITION_SIDE_EFFECT_FAILED',
    })
    expect(authority.state).toBe('entering')
    expect(authority.inputOwner).toBe('player')
    expect(authority.completeTransition('seated')).toEqual({
      ok: false,
      code: 'INVALID_TRANSITION_EVENT',
    })

    expect(authority.completeTransition('enter-started')).toEqual({
      ok: true,
      code: 'OK',
    })
    expect(authority.completeTransition('seated')).toEqual({
      ok: true,
      code: 'OK',
    })
    expect(authority.state).toBe('driving')
    expect(authority.inputOwner).toBe('vehicle')
  })
})

describe('DeterministicControlTransitionSequencer', () => {
  it('keeps entry observable for one fixed step before emitting ordered events', () => {
    const { authority, adapter } = createAuthorityFixture()
    const sequencer = new DeterministicControlTransitionSequencer({
      getState: () => authority.state,
      completeTransition: (event) => authority.completeTransition(event),
    })
    authority.requestEnter({ vehicleSpeedMps: 0, seatDistanceM: 0.8 })

    sequencer.fixedStep()
    expect(authority.state).toBe('entering')
    expect(adapter.setPlayerColliderEnabled).not.toHaveBeenCalled()

    sequencer.fixedStep()
    expect(authority.state).toBe('driving')
    expect(authority.inputOwner).toBe('vehicle')
    expect(adapter.setPlayerColliderEnabled).toHaveBeenLastCalledWith(false)
    expect(adapter.attachPlayerToSeat).toHaveBeenCalledOnce()
  })

  it('keeps exit observable and places the player before completion', () => {
    const { authority, adapter } = createAuthorityFixture()
    const sequencer = new DeterministicControlTransitionSequencer({
      getState: () => authority.state,
      completeTransition: (event) => authority.completeTransition(event),
    })
    authority.requestEnter({ vehicleSpeedMps: 0, seatDistanceM: 0.8 })
    authority.completeTransition('enter-started')
    authority.completeTransition('seated')
    authority.requestExit()

    sequencer.fixedStep()
    expect(authority.state).toBe('exiting')
    expect(adapter.placePlayerAtExit).not.toHaveBeenCalled()

    sequencer.fixedStep()
    expect(authority.state).toBe('on-foot')
    expect(authority.inputOwner).toBe('player')
    expect(adapter.placePlayerAtExit).toHaveBeenCalledOnce()
    expect(adapter.setPlayerColliderEnabled).toHaveBeenCalledTimes(2)
    expect(adapter.setPlayerColliderEnabled).toHaveBeenLastCalledWith(true)
  })

  it('surfaces one terminal error without replaying successful events', () => {
    const { authority, adapter } = createAuthorityFixture()
    const emittedEvents: string[] = []
    adapter.attachPlayerToSeat.mockImplementationOnce(() => {
      throw new Error('injected seat failure')
    })
    const sequencer = new DeterministicControlTransitionSequencer({
      getState: () => authority.state,
      completeTransition: (event) => {
        emittedEvents.push(event)
        return authority.completeTransition(event)
      },
    })
    authority.requestEnter({ vehicleSpeedMps: 0, seatDistanceM: 0.8 })
    sequencer.fixedStep()

    let firstError: unknown
    try {
      sequencer.fixedStep()
    } catch (error) {
      firstError = error
    }
    expect(firstError).toMatchObject({
      code: 'CONTROL_TRANSITION_SEQUENCE_FAILED',
      event: 'seated',
      transitionCode: 'TRANSITION_SIDE_EFFECT_FAILED',
    })
    expect(sequencer.terminalError).toBe(firstError)
    expect(emittedEvents).toEqual(['enter-started', 'seated'])
    expect(authority.state).toBe('entering')
    expect(authority.inputOwner).toBe('player')

    let repeatedError: unknown
    try {
      sequencer.fixedStep()
    } catch (error) {
      repeatedError = error
    }
    expect(repeatedError).toBe(firstError)
    expect(emittedEvents).toEqual(['enter-started', 'seated'])
  })
})
