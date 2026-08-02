import RAPIER from '@dimforge/rapier3d-compat'
import { JSDOM } from 'jsdom'
import {
  Group,
  Object3D,
  PerspectiveCamera,
  Quaternion,
  Scene,
  Vector3,
} from 'three'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import assetManifestJson from '../../../public/assets/asset-manifest.json'
import runtimeAssetContractJson from '../../../public/feasibility/runtime-assets.json'
import { createSliceAssetLoader } from '../../../src/feasibility/assets/SliceAssetLoader'
import { parseRuntimeAssetContract } from '../../../src/feasibility/assets/runtimeAssetContract'
import { FollowCameraController } from '../../../src/feasibility/camera/FollowCameraController'
import { CameraTargetTransition } from '../../../src/feasibility/camera/CameraTarget'
import { ControlAuthority } from '../../../src/feasibility/control/ControlAuthority'
import { createRuntimeControlAdapter } from '../../../src/feasibility/control/createRuntimeControlAdapter'
import { DebugPanel } from '../../../src/feasibility/debug/DebugPanel'
import { HarvestDomain } from '../../../src/feasibility/domain/HarvestDomain'
import { KeyboardInputRouter } from '../../../src/feasibility/input/KeyboardInputRouter'
import { performOnFootContextualAction } from '../../../src/feasibility/interaction/performOnFootContextualAction'
import { InteractionCoordinator } from '../../../src/feasibility/interaction/InteractionCoordinator'
import { FixedStepRunner } from '../../../src/feasibility/physics/FixedStepRunner'
import { PhysicsWorld } from '../../../src/feasibility/physics/PhysicsWorld'
import { PlayerController } from '../../../src/feasibility/player/PlayerController'
import { FixedStepRuntimeLoop } from '../../../src/feasibility/runtime/FixedStepRuntimeLoop'
import { BodyPoseInterpolator } from '../../../src/feasibility/runtime/BodyPoseInterpolator'
import { readVehicleRig } from '../../../src/feasibility/runtime/readVehicleRig'

const contract = parseRuntimeAssetContract(runtimeAssetContractJson)

function keyboardEvent(type: 'keydown' | 'keyup', code: string): Event {
  const event = new Event(type, { cancelable: true })
  Object.defineProperties(event, {
    code: { value: code },
    repeat: { value: false },
  })
  return event
}

function createAuthorityFixture(exitBlocked = false): ControlAuthority {
  return new ControlAuthority({
    setPlayerColliderEnabled: vi.fn(),
    attachPlayerToSeat: vi.fn(),
    placePlayerAtExit: vi.fn(),
    exitIsBlocked: () => exitBlocked,
  })
}

function createReturningDomain(): HarvestDomain {
  const domain = HarvestDomain.create({
    fruitIds: ['fruit-1'],
    capacities: {
      player: 1,
      basket: 1,
      crate: 1,
      vehicle: 1,
      delivered: 1,
    },
  })
  domain.dispatch({ kind: 'AcceptJob', commandId: 'accept' })
  domain.dispatch({ kind: 'PrepareVehicle', commandId: 'prepare' })
  domain.dispatch({ kind: 'DepartForOrchard', commandId: 'depart' })
  domain.dispatch({ kind: 'ParkAtOrchard', commandId: 'park' })
  domain.dispatch({
    kind: 'PickFruit',
    commandId: 'pick',
    fruitId: 'fruit-1',
  })
  domain.dispatch({
    kind: 'MoveFruit',
    commandId: 'basket',
    fruitId: 'fruit-1',
    from: 'player',
    to: 'basket',
  })
  domain.dispatch({
    kind: 'MoveFruit',
    commandId: 'crate',
    fruitId: 'fruit-1',
    from: 'basket',
    to: 'crate',
  })
  domain.dispatch({
    kind: 'LoadVehicle',
    commandId: 'load',
    fruitId: 'fruit-1',
  })
  domain.dispatch({ kind: 'StartReturn', commandId: 'return' })
  return domain
}

describe('KeyboardInputRouter', () => {
  it('maps vehicle S to reverse throttle', () => {
    const target = new EventTarget()
    const vehicleInputs: unknown[] = []
    const router = new KeyboardInputRouter({
      target,
      getInputOwner: () => 'vehicle',
      drive: (input) => vehicleInputs.push(input),
      movePlayer: () => undefined,
      interact: () => undefined,
      recover: () => undefined,
    })
    router.start()
    target.dispatchEvent(keyboardEvent('keydown', 'KeyS'))

    router.fixedStep(1 / 60)

    expect(vehicleInputs).toEqual([
      { throttle: -1, brake: 0, steer: 0 },
    ])
  })

  it('maps Space to service brake and clears it on keyup', () => {
    const target = new EventTarget()
    const vehicleInputs: unknown[] = []
    const router = new KeyboardInputRouter({
      target,
      getInputOwner: () => 'vehicle',
      drive: (input) => vehicleInputs.push(input),
      movePlayer: () => undefined,
      interact: () => undefined,
      recover: () => undefined,
    })
    router.start()
    const keydown = keyboardEvent('keydown', 'Space')
    const keyup = keyboardEvent('keyup', 'Space')

    target.dispatchEvent(keydown)
    router.fixedStep(1 / 60)
    target.dispatchEvent(keyup)
    router.fixedStep(1 / 60)

    expect(keydown.defaultPrevented).toBe(true)
    expect(keyup.defaultPrevented).toBe(true)
    expect(vehicleInputs).toEqual([
      { throttle: 0, brake: 1, steer: 0 },
      { throttle: 0, brake: 0, steer: 0 },
    ])
  })

  it('brakes safely instead of commanding W and S together', () => {
    const target = new EventTarget()
    const vehicleInputs: unknown[] = []
    const router = new KeyboardInputRouter({
      target,
      getInputOwner: () => 'vehicle',
      drive: (input) => vehicleInputs.push(input),
      movePlayer: () => undefined,
      interact: () => undefined,
      recover: () => undefined,
    })
    router.start()
    target.dispatchEvent(keyboardEvent('keydown', 'KeyW'))
    target.dispatchEvent(keyboardEvent('keydown', 'KeyS'))

    router.fixedStep(1 / 60)

    expect(vehicleInputs).toEqual([
      { throttle: 0, brake: 1, steer: 0 },
    ])
  })

  it('preserves player S movement while Space has no player action', () => {
    const target = new EventTarget()
    const vehicleInputs: unknown[] = []
    const playerIntents: unknown[] = []
    let interactions = 0
    let recoveries = 0
    const router = new KeyboardInputRouter({
      target,
      getInputOwner: () => 'player',
      drive: (input) => vehicleInputs.push(input),
      movePlayer: (intent) => playerIntents.push(intent),
      interact: () => { interactions += 1 },
      recover: () => { recoveries += 1 },
    })
    router.start()
    target.dispatchEvent(keyboardEvent('keydown', 'KeyS'))
    target.dispatchEvent(keyboardEvent('keydown', 'Space'))

    router.fixedStep(1 / 60)

    expect(vehicleInputs).toEqual([
      { throttle: 0, brake: 1, steer: 0 },
    ])
    expect(playerIntents).toEqual([
      { x: 0, y: 0, z: -2.5 / 60 },
    ])
    expect(interactions).toBe(0)
    expect(recoveries).toBe(0)
  })

  it('consumes a staged interaction result after one E press', () => {
    const target = new EventTarget()
    let interactions = 0
    const router = new KeyboardInputRouter({
      target,
      getInputOwner: () => 'player',
      drive: () => undefined,
      movePlayer: () => undefined,
      interact: () => {
        interactions += 1
        return interactions < 3
      },
      recover: () => undefined,
    })
    router.start()
    target.dispatchEvent(keyboardEvent('keydown', 'KeyE'))

    router.fixedStep(1 / 60)
    router.fixedStep(1 / 60)
    router.fixedStep(1 / 60)
    router.fixedStep(1 / 60)

    expect(interactions).toBe(1)
  })

  it('locks held movement in the same step that exit begins', () => {
    const target = new EventTarget()
    const authority = createAuthorityFixture()
    authority.requestEnter({ vehicleSpeedMps: 0, seatDistanceM: 0.5 })
    authority.completeTransition('enter-started')
    authority.completeTransition('seated')
    const vehicleInputs: unknown[] = []
    const playerIntents: unknown[] = []
    const order: string[] = []
    const router = new KeyboardInputRouter({
      target,
      getInputOwner: () => authority.inputOwner,
      controlsLocked: () => authority.controlsLocked,
      drive: (input) => {
        order.push('vehicle-update')
        vehicleInputs.push(input)
      },
      movePlayer: (intent) => {
        order.push('player-move')
        playerIntents.push(intent)
      },
      interact: () => {
        order.push('exit')
        authority.requestExit()
      },
      recover: vi.fn(),
    })
    router.start()
    target.dispatchEvent(keyboardEvent('keydown', 'KeyW'))
    target.dispatchEvent(keyboardEvent('keydown', 'KeyE'))

    router.fixedStep(1 / 60)
    order.push('physics-step')

    expect(authority.state).toBe('exiting')
    expect(authority.inputOwner).toBe('vehicle')
    expect(vehicleInputs).toEqual([
      { throttle: 0, brake: 1, steer: 0 },
    ])
    expect(playerIntents).toEqual([])
    expect(order).toEqual([
      'exit',
      'vehicle-update',
      'physics-step',
    ])
  })

  it('locks held movement in the same step that entry begins', () => {
    const target = new EventTarget()
    const authority = createAuthorityFixture()
    const vehicleInputs: unknown[] = []
    const playerIntents: unknown[] = []
    const router = new KeyboardInputRouter({
      target,
      getInputOwner: () => authority.inputOwner,
      controlsLocked: () => authority.controlsLocked,
      drive: (input) => vehicleInputs.push(input),
      movePlayer: (intent) => playerIntents.push(intent),
      interact: () => {
        authority.requestEnter({ vehicleSpeedMps: 0, seatDistanceM: 0.5 })
      },
      recover: vi.fn(),
    })
    router.start()
    target.dispatchEvent(keyboardEvent('keydown', 'KeyW'))
    target.dispatchEvent(keyboardEvent('keydown', 'KeyE'))

    router.fixedStep(1 / 60)

    expect(authority.state).toBe('entering')
    expect(authority.inputOwner).toBe('player')
    expect(vehicleInputs).toEqual([
      { throttle: 0, brake: 1, steer: 0 },
    ])
    expect(playerIntents).toEqual([])
  })

  it('drops a queued interaction retry while a transfer is locked', () => {
    const target = new EventTarget()
    const authority = createAuthorityFixture()
    let interactions = 0
    const router = new KeyboardInputRouter({
      target,
      getInputOwner: () => authority.inputOwner,
      controlsLocked: () => authority.controlsLocked,
      drive: () => undefined,
      movePlayer: () => undefined,
      interact: () => {
        interactions += 1
        authority.requestEnter({ vehicleSpeedMps: 0, seatDistanceM: 0.5 })
        return true
      },
      recover: () => undefined,
    })
    router.start()
    target.dispatchEvent(keyboardEvent('keydown', 'KeyE'))

    router.fixedStep(1 / 60)
    router.fixedStep(1 / 60)

    expect(authority.state).toBe('entering')
    expect(interactions).toBe(1)
  })

  it('keeps driving input when the same-step exit is blocked', () => {
    const target = new EventTarget()
    const authority = createAuthorityFixture(true)
    authority.requestEnter({ vehicleSpeedMps: 0, seatDistanceM: 0.5 })
    authority.completeTransition('enter-started')
    authority.completeTransition('seated')
    const vehicleInputs: unknown[] = []
    const playerIntents: unknown[] = []
    const router = new KeyboardInputRouter({
      target,
      getInputOwner: () => authority.inputOwner,
      controlsLocked: () => authority.controlsLocked,
      drive: (input) => vehicleInputs.push(input),
      movePlayer: (intent) => playerIntents.push(intent),
      interact: () => { authority.requestExit() },
      recover: vi.fn(),
    })
    router.start()
    target.dispatchEvent(keyboardEvent('keydown', 'KeyW'))
    target.dispatchEvent(keyboardEvent('keydown', 'KeyE'))

    router.fixedStep(1 / 60)

    expect(authority.inputOwner).toBe('vehicle')
    expect(vehicleInputs).toEqual([
      { throttle: 1, brake: 0, steer: 0 },
    ])
    expect(playerIntents).toEqual([])
  })

  it('keeps player input after contextual delivery in the same step', () => {
    const target = new EventTarget()
    const authority = createAuthorityFixture()
    const domain = createReturningDomain()
    const deliveryCandidate = {
      id: 'delivery-sensor',
      kind: 'delivery' as const,
      inside: true,
      distanceM: 0.4,
      facingDegrees: 10,
    }
    const coordinator = new InteractionCoordinator({
      domain,
      getControlOwner: () => authority.inputOwner,
      getCandidate: () => deliveryCandidate,
      setCargoMass: vi.fn(),
    })
    const vehicleInputs: unknown[] = []
    const playerIntents: unknown[] = []
    const router = new KeyboardInputRouter({
      target,
      getInputOwner: () => authority.inputOwner,
      drive: (input) => vehicleInputs.push(input),
      movePlayer: (intent) => playerIntents.push(intent),
      interact: () => {
        performOnFootContextualAction('deliver', {
          executeInteraction: (candidateId, command) => (
            coordinator.execute(candidateId, command)
          ),
        })
      },
      recover: vi.fn(),
    })
    router.start()
    target.dispatchEvent(keyboardEvent('keydown', 'KeyW'))
    target.dispatchEvent(keyboardEvent('keydown', 'KeyE'))

    router.fixedStep(1 / 60)

    expect(domain.snapshot().jobState).toBe('delivered')
    expect(authority.inputOwner).toBe('player')
    expect(vehicleInputs).toEqual([
      { throttle: 0, brake: 1, steer: 0 },
    ])
    expect(playerIntents).toEqual([
      { x: 0, y: 0, z: 2.5 / 60 },
    ])
  })

  it('updates the vehicle with neutral input before entry', () => {
    const drive = vi.fn()
    const movePlayer = vi.fn()
    const router = new KeyboardInputRouter({
      target: new EventTarget(),
      getInputOwner: () => 'player',
      drive,
      movePlayer,
      interact: vi.fn(),
      recover: vi.fn(),
    })

    router.fixedStep(1 / 60)

    expect(drive).toHaveBeenCalledWith({
      throttle: 0,
      brake: 1,
      steer: 0,
    })
    expect(movePlayer).toHaveBeenCalledWith({ x: 0, y: 0, z: 0 })
  })

  it('consults the live control owner and routes movement to one controller only', () => {
    const target = new EventTarget()
    let owner: 'player' | 'vehicle' = 'vehicle'
    const drive = vi.fn()
    const movePlayer = vi.fn()
    const router = new KeyboardInputRouter({
      target,
      getInputOwner: () => owner,
      drive,
      movePlayer,
      interact: vi.fn(),
      recover: vi.fn(),
    })
    router.start()
    target.dispatchEvent(keyboardEvent('keydown', 'KeyW'))
    target.dispatchEvent(keyboardEvent('keydown', 'KeyA'))

    router.fixedStep(1 / 60)
    expect(drive).toHaveBeenLastCalledWith({
      throttle: 1,
      brake: 0,
      steer: 1,
    })
    expect(movePlayer).not.toHaveBeenCalled()

    owner = 'player'
    router.fixedStep(1 / 60)
    expect(movePlayer).toHaveBeenLastCalledWith({
      x: -2.5 / 60,
      y: 0,
      z: 2.5 / 60,
    })
    expect(drive).toHaveBeenLastCalledWith({
      throttle: 0,
      brake: 1,
      steer: 0,
    })
    expect(drive).toHaveBeenCalledTimes(2)
    expect(drive.mock.calls[1]![0]).toEqual({
      throttle: 0,
      brake: 1,
      steer: 0,
    })
  })

  it('clears held drive input on the first step after exit', () => {
    const target = new EventTarget()
    let owner: 'player' | 'vehicle' = 'vehicle'
    const drive = vi.fn()
    const movePlayer = vi.fn()
    const router = new KeyboardInputRouter({
      target,
      getInputOwner: () => owner,
      drive,
      movePlayer,
      interact: vi.fn(),
      recover: vi.fn(),
    })
    router.start()
    target.dispatchEvent(keyboardEvent('keydown', 'KeyW'))

    router.fixedStep(1 / 60)
    owner = 'player'
    router.fixedStep(1 / 60)

    expect(drive.mock.calls).toEqual([
      [{ throttle: 1, brake: 0, steer: 0 }],
      [{ throttle: 0, brake: 1, steer: 0 }],
    ])
    expect(movePlayer).toHaveBeenCalledTimes(1)
    expect(movePlayer).toHaveBeenCalledWith({
      x: 0,
      y: 0,
      z: 2.5 / 60,
    })
  })

  it('defers E and R actions to the fixed-step lifecycle', () => {
    const target = new EventTarget()
    const interact = vi.fn()
    const recover = vi.fn()
    const router = new KeyboardInputRouter({
      target,
      getInputOwner: () => 'player',
      drive: vi.fn(),
      movePlayer: vi.fn(),
      interact,
      recover,
    })
    router.start()

    target.dispatchEvent(keyboardEvent('keydown', 'KeyE'))
    target.dispatchEvent(keyboardEvent('keydown', 'KeyR'))
    expect(interact).not.toHaveBeenCalled()
    expect(recover).not.toHaveBeenCalled()

    router.fixedStep(1 / 60)
    expect(interact).toHaveBeenCalledTimes(1)
    expect(recover).toHaveBeenCalledTimes(1)
    router.fixedStep(1 / 60)
    expect(interact).toHaveBeenCalledTimes(1)
    expect(recover).toHaveBeenCalledTimes(1)
  })
})

describe('contextual E action', () => {
  it('executes an explicitly resolved delivery with no seat fallback', () => {
    const domain = createReturningDomain()
    const deliveryCandidate = {
      id: 'delivery-sensor',
      kind: 'delivery' as const,
      inside: true,
      distanceM: 0.4,
      facingDegrees: 10,
    }
    const coordinator = new InteractionCoordinator({
      domain,
      getControlOwner: () => 'player',
      getCandidate: () => deliveryCandidate,
      setCargoMass: vi.fn(),
    })
    const succeeded = performOnFootContextualAction('deliver', {
      executeInteraction: (candidateId, command) => (
        coordinator.execute(candidateId, command)
      ),
    })

    expect(succeeded).toBe(true)
    expect(domain.snapshot().jobState).toBe('delivered')
  })
})

describe('FixedStepRuntimeLoop lifecycle and ordering', () => {
  it('applies vehicle input before every physics simulation step', () => {
    const callbacks = new Map<number, FrameRequestCallback>()
    const order: string[] = []
    let nextId = 1
    const router = new KeyboardInputRouter({
      target: new EventTarget(),
      getInputOwner: () => 'player',
      drive: () => order.push('vehicle-update'),
      movePlayer: () => order.push('player-move'),
      interact: vi.fn(),
      recover: vi.fn(),
    })
    const loop = new FixedStepRuntimeLoop({
      runner: new FixedStepRunner(1 / 60, 0.1),
      fixedSeconds: 1 / 60,
      input: router,
      simulate: () => order.push('physics-step'),
      interpolate: vi.fn(),
      updateCamera: vi.fn(),
      render: vi.fn(),
      requestFrame: (callback) => {
        const id = nextId++
        callbacks.set(id, callback)
        return id
      },
      cancelFrame: vi.fn(),
    })
    loop.start()
    callbacks.get(1)!(1000)
    callbacks.get(2)!(1017)

    expect(order.slice(-3)).toEqual([
      'vehicle-update',
      'player-move',
      'physics-step',
    ])
  })

  it('starts once, simulates only in fixed steps, and cancels cleanly', () => {
    const callbacks = new Map<number, FrameRequestCallback>()
    const cancelled: number[] = []
    let nextId = 1
    const order: string[] = []
    const runFrame = (id: number, timestampMs: number) => {
      const callback = callbacks.get(id)!
      callbacks.delete(id)
      callback(timestampMs)
    }
    const input = {
      start: vi.fn(() => order.push('input-start')),
      stop: vi.fn(() => order.push('input-stop')),
      fixedStep: vi.fn(() => order.push('input-step')),
    }
    const loop = new FixedStepRuntimeLoop({
      runner: new FixedStepRunner(1 / 60, 0.1),
      fixedSeconds: 1 / 60,
      input,
      simulate: () => order.push('simulate'),
      interpolate: () => order.push('interpolate'),
      updateCamera: () => order.push('camera'),
      render: () => order.push('render'),
      requestFrame: (callback) => {
        const id = nextId++
        callbacks.set(id, callback)
        return id
      },
      cancelFrame: (id) => {
        cancelled.push(id)
        callbacks.delete(id)
      },
    })

    loop.start()
    loop.start()
    expect(input.start).toHaveBeenCalledTimes(1)
    expect(callbacks.size).toBe(1)
    runFrame(1, 1000)
    runFrame(2, 1017)
    expect(order.slice(-5)).toEqual([
      'input-step',
      'simulate',
      'interpolate',
      'camera',
      'render',
    ])

    loop.stop()
    loop.stop()
    expect(input.stop).toHaveBeenCalledTimes(1)
    expect(cancelled).toEqual([3])
    expect(callbacks.size).toBe(0)
  })
})

describe('BodyPoseInterpolator', () => {
  it('renders between fixed-step poses without changing either physics pose', () => {
    const visual = new Object3D()
    const start = {
      translation: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
    }
    const end = {
      translation: { x: 8, y: 4, z: -2 },
      rotation: { x: 0, y: 1, z: 0, w: 0 },
    }
    const interpolator = new BodyPoseInterpolator(start)
    interpolator.beginFixedStep()
    interpolator.capture(end)

    interpolator.applyTo(visual, 0.25)

    expect(visual.position.toArray()).toEqual([2, 1, -0.5])
    expect(start.translation).toEqual({ x: 0, y: 0, z: 0 })
    expect(end.translation).toEqual({ x: 8, y: 4, z: -2 })
  })
})

describe('FollowCameraController', () => {
  it('reads one authoritative target, smooths position, and never steps physics', () => {
    const camera = new PerspectiveCamera()
    const readTarget = vi.fn(() => ({
      position: new Vector3(10, 0, 0),
      heading: new Quaternion(),
    }))
    const physicsStep = vi.fn()
    const controller = new FollowCameraController({
      camera,
      readTarget,
      localOffset: new Vector3(0, 4, 7),
      localLookAtOffset: new Vector3(0, 1, 0),
      positionResponse: 8,
      lookAtResponse: 12,
      maxDisplacementPerFrameM: 1.5,
    })

    controller.update(0.1)

    expect(readTarget).toHaveBeenCalledTimes(1)
    expect(camera.position.x).toBeGreaterThan(0)
    expect(camera.position.x).toBeLessThan(10)
    expect(camera.position.y).toBeGreaterThan(0)
    expect(physicsStep).not.toHaveBeenCalled()
  })
})

describe('runtime follow-camera ownership transition', () => {
  it.each([0, Number.NaN, Number.POSITIVE_INFINITY])(
    'does not change target ownership or profile for invalid frame delta %s',
    (deltaSeconds) => {
      const camera = new PerspectiveCamera()
      const targets = {
        player: { position: new Vector3(0, 0, 0), heading: new Quaternion() },
        vehicle: { position: new Vector3(20, 0, 0), heading: new Quaternion() },
      }
      let owner: 'player' | 'vehicle' = 'player'
      let activeProfile: 'player' | 'vehicle' = 'player'
      let controller: FollowCameraController | undefined
      const transition = new CameraTargetTransition({
        initialOwner: owner,
        transitionSeconds: 0.25,
        readTarget: (targetOwner, output) => {
          output.position.copy(targets[targetOwner].position)
          output.heading.copy(targets[targetOwner].heading)
        },
        onOwnerChanged: (targetOwner) => {
          activeProfile = targetOwner
          controller?.setProfile({
            localOffset: new Vector3(0, 4, targetOwner === 'vehicle' ? 9 : 6),
            localLookAtOffset: new Vector3(0, 1, 0),
            positionResponse: 1000,
            lookAtResponse: 1000,
          })
        },
      })
      controller = new FollowCameraController({
        camera,
        readTarget: () => transition.target,
        localOffset: new Vector3(0, 4, 6),
        localLookAtOffset: new Vector3(0, 1, 0),
        positionResponse: 1000,
        lookAtResponse: 1000,
        maxDisplacementPerFrameM: 1000,
      })
      const update = (frameSeconds: number): void => {
        if (transition.update(owner, frameSeconds)) controller?.update(frameSeconds)
      }
      update(0.1)
      const positionBefore = camera.position.clone()
      const headingBefore = camera.quaternion.clone()
      owner = 'vehicle'

      update(deltaSeconds)

      expect(transition.owner).toBe('player')
      expect(activeProfile).toBe('player')
      expect(transition.target.position.toArray()).toEqual([0, 0, 0])
      expect(camera.position.toArray()).toEqual(positionBefore.toArray())
      expect(camera.quaternion.toArray()).toEqual(headingBefore.toArray())
    },
  )

  it('continues a rapid A-to-B-to-A handoff from the current blended target', () => {
    const targets = {
      player: { position: new Vector3(0, 0, 0), heading: new Quaternion() },
      vehicle: {
        position: new Vector3(10, 0, 0),
        heading: new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2),
      },
    }
    let owner: 'player' | 'vehicle' = 'player'
    const transition = new CameraTargetTransition({
      initialOwner: owner,
      transitionSeconds: 0.25,
      readTarget: (targetOwner, output) => {
        output.position.copy(targets[targetOwner].position)
        output.heading.copy(targets[targetOwner].heading)
      },
      onOwnerChanged: () => undefined,
    })

    owner = 'vehicle'
    transition.update(owner, 0.1)
    owner = 'player'
    transition.update(owner, 0.1)

    expect(transition.target.position.x).toBeCloseTo(2.4)
    expect(new Vector3(0, 0, -1).applyQuaternion(transition.target.heading).x)
      .toBeCloseTo(-Math.sin(Math.PI * 0.12))
    expect(new Vector3(0, 0, -1).applyQuaternion(transition.target.heading).z)
      .toBeCloseTo(-Math.cos(Math.PI * 0.12))
  })
})

describe('critical real-asset composition', () => {
  it('loads both environment GLBs as critical assets', async () => {
    const loadCritical = vi.fn(async (_loader, request) => ({
      scene: Object.assign(new Group(), { name: request.assetId }),
      anchors: new Map(),
      clips: [],
    }))
    const loader = createSliceAssetLoader({
      gltfLoader: { loadAsync: vi.fn() },
      loadCritical,
    })

    const assets = await loader.load(contract, assetManifestJson)

    expect(Object.keys(assets).sort()).toEqual([
      'characterVisual',
      'environmentWorldVisual',
      'peachTreeFamilyVisual',
      'vehicleCollision',
      'vehicleVisual',
    ])
    expect(loadCritical.mock.calls.map((call) => call[1].assetId)).toEqual([
      'vehicle.electric-tricycle-a:visual',
      'character.farmer-a-base:visual',
      'vehicle.electric-tricycle-a:collider',
      'environment.orchard-world-overall-v1:visual',
      'environment.peach-tree-overall-v1:visual',
    ])
  })

  it.each([
    'environment.orchard-world-overall-v1:visual',
    'environment.peach-tree-overall-v1:visual',
  ])('keeps the exact environment asset id on critical failure: %s', async (
    failedAssetId,
  ) => {
    const loadCritical = vi.fn(async (_loader, request) => {
      if (request.assetId === failedAssetId) throw new Error('parse failed')
      return {
        scene: Object.assign(new Group(), { name: request.assetId }),
        anchors: new Map(),
        clips: [],
      }
    })
    const loader = createSliceAssetLoader({
      gltfLoader: { loadAsync: vi.fn() },
      loadCritical,
    })

    await expect(loader.load(contract, assetManifestJson))
      .rejects.toThrow(failedAssetId)
  })

  it('fails closed with the exact missing environment manifest id', async () => {
    const missingWorldManifest = {
      ...assetManifestJson,
      assets: assetManifestJson.assets.filter(({ assetId }) => (
        assetId !== 'environment.orchard-world-overall-v1'
      )),
    }
    const loader = createSliceAssetLoader({
      gltfLoader: { loadAsync: vi.fn() },
      loadCritical: vi.fn(),
    })

    await expect(loader.load(contract, missingWorldManifest))
      .rejects.toThrow(
        'CRITICAL_ASSET_NOT_REGISTERED: environment.orchard-world-overall-v1',
      )
  })

  it('reads cargo_slot_01 and wheel positions from the loaded vehicle hierarchy', () => {
    const scene = new Group()
    scene.position.set(10, 0, -3)
    const anchors = new Map<string, Object3D>()
    for (const [name, position] of [
      ['driver_seat', [0, 1, 0]],
      ['exit_left', [-1, 0, 0]],
      ['wheel_front', [0, 0, -2]],
      ['wheel_rear_left', [1, 0, 1]],
      ['wheel_rear_right', [-1, 0, 1]],
      ['cargo_slot_01', [-0.25, 1.1, 0.4]],
    ] as const) {
      const anchor = new Object3D()
      anchor.name = name
      anchor.position.set(position[0], position[1], position[2])
      scene.add(anchor)
      anchors.set(name, anchor)
    }

    const rig = readVehicleRig({ scene, anchors, clips: [] }, contract.vehicle)

    expect(rig.cargoAnchorLocal.x).toBeCloseTo(-0.25)
    expect(rig.cargoAnchorLocal.y).toBeCloseTo(1.1)
    expect(rig.cargoAnchorLocal.z).toBeCloseTo(0.4)
    expect(rig.wheelAnchors.map((wheel) => wheel.position)).toEqual([
      { x: 0, y: 0, z: -2 },
      { x: 1, y: 0, z: 1 },
      { x: -1, y: 0, z: 1 },
    ])
  })
})

beforeAll(async () => {
  await RAPIER.init()
})

describe('real-node ControlAuthority adapter', () => {
  it('hides the character visual after a successful seat attach', async () => {
    const physics = await PhysicsWorld.create()
    const player = new PlayerController({
      physics,
      contract: contract.character,
      initialTranslation: { x: 0, y: 0.84, z: 0 },
    })
    const scene = new Scene()
    const characterVisual = new Group()
    const seat = new Object3D()
    const exit = new Object3D()
    scene.add(characterVisual, seat, exit)
    const adapter = createRuntimeControlAdapter({
      physics,
      scene,
      player,
      playerVisual: characterVisual,
      seatAnchor: seat,
      exitAnchor: exit,
      characterContract: contract.character,
    })

    adapter.attachPlayerToSeat()

    expect(characterVisual.parent).toBe(seat)
    expect(characterVisual.visible).toBe(false)
  })

  it('restores the hidden character visual on successful exit placement', async () => {
    const physics = await PhysicsWorld.create()
    const player = new PlayerController({
      physics,
      contract: contract.character,
      initialTranslation: { x: 0, y: 0.84, z: 0 },
    })
    const scene = new Scene()
    const characterVisual = new Group()
    characterVisual.visible = false
    const seat = new Object3D()
    const exit = new Object3D()
    exit.position.set(-4, 0, 0)
    seat.add(characterVisual)
    scene.add(seat, exit)
    const adapter = createRuntimeControlAdapter({
      physics,
      scene,
      player,
      playerVisual: characterVisual,
      seatAnchor: seat,
      exitAnchor: exit,
      characterContract: contract.character,
    })

    adapter.placePlayerAtExit()

    expect(characterVisual.parent).toBe(scene)
    expect(characterVisual.visible).toBe(true)
  })

  it('uses the actual exit_left capsule cast and repositions before enabling', async () => {
    const physics = await PhysicsWorld.create()
    const player = new PlayerController({
      physics,
      contract: contract.character,
      initialTranslation: { x: 0, y: 0.84, z: 0 },
    })
    const scene = new Scene()
    const vehicleVisual = new Group()
    const characterVisual = new Group()
    scene.add(vehicleVisual, characterVisual)
    const seat = new Object3D()
    seat.name = 'driver_seat'
    seat.position.set(0, 1, 0)
    const exit = new Object3D()
    exit.name = 'exit_left'
    exit.position.set(-2, 0, 0)
    vehicleVisual.add(seat, exit)
    physics.createFixedCuboid(
      { x: -2, y: 1.5, z: 0 },
      { x: 0.3, y: 0.1, z: 0.3 },
    )
    const support = physics.createFixedCuboid(
      { x: -4, y: 0, z: 0 },
      { x: 1, y: 0.1, z: 1 },
    )
    physics.step()
    const adapter = createRuntimeControlAdapter({
      physics,
      scene,
      player,
      playerVisual: characterVisual,
      seatAnchor: seat,
      exitAnchor: exit,
      characterContract: contract.character,
      isExitSupportCollider: (collider) => (
        collider.handle === support.collider(0).handle
      ),
    })
    const authority = new ControlAuthority(adapter)

    expect(adapter.exitIsBlocked()).toBe(true)
    exit.position.set(-4, 0, 0)
    vehicleVisual.updateMatrixWorld(true)
    expect(adapter.exitIsBlocked()).toBe(false)
    expect(authority.requestEnter({
      vehicleSpeedMps: 0,
      seatDistanceM: 0.5,
    }).ok).toBe(true)
    expect(authority.completeTransition('enter-started').ok).toBe(true)
    expect(authority.completeTransition('seated').ok).toBe(true)
    expect(player.collider.isEnabled()).toBe(false)
    expect(characterVisual.parent).toBe(seat)
    expect(authority.requestExit().ok).toBe(true)
    expect(authority.completeTransition('exit-started').ok).toBe(true)
    expect(authority.completeTransition('exit-placed').ok).toBe(true)
    expect(authority.completeTransition('exit-complete').ok).toBe(true)
    expect(player.collider.isEnabled()).toBe(true)
    expect(player.body.translation().x).toBeCloseTo(
      -4 - contract.character.capsuleRadiusM - 0.15,
    )
    expect(player.body.translation().y).toBeCloseTo(0.85)
    expect(player.body.translation().z).toBeCloseTo(0)
    expect(characterVisual.parent).toBe(scene)
    expect(characterVisual.position.y).toBeCloseTo(0)
  })

  it.each([
    { boundary: 'player-collider-enabled', event: 'enter-started' as const },
    { boundary: 'player-seat-parented', event: 'seated' as const },
    { boundary: 'player-seat-position-reset', event: 'seated' as const },
    { boundary: 'player-seat-rotation-reset', event: 'seated' as const },
    { boundary: 'player-seat-visibility-hidden', event: 'seated' as const },
    { boundary: 'player-exit-body-teleported', event: 'exit-placed' as const },
    { boundary: 'player-exit-next-translation', event: 'exit-placed' as const },
    { boundary: 'player-exit-scene-parented', event: 'exit-placed' as const },
    { boundary: 'player-exit-positioned', event: 'exit-placed' as const },
    { boundary: 'player-exit-rotated', event: 'exit-placed' as const },
    { boundary: 'player-exit-visibility-restored', event: 'exit-placed' as const },
    { boundary: 'player-collider-enabled', event: 'exit-complete' as const },
  ])('compensates $boundary when $event fails after mutation', async ({
    boundary,
    event,
  }) => {
    const physics = await PhysicsWorld.create()
    const player = new PlayerController({
      physics,
      contract: contract.character,
      initialTranslation: { x: 1, y: 0.84, z: 2 },
    })
    const scene = new Scene()
    const vehicleVisual = new Group()
    const characterVisual = new Group()
    characterVisual.position.set(3, 4, 5)
    characterVisual.quaternion.setFromAxisAngle(
      new Vector3(0, 1, 0),
      Math.PI / 4,
    )
    scene.add(vehicleVisual, characterVisual)
    const seat = new Object3D()
    seat.position.set(0, 1, 0)
    const exit = new Object3D()
    exit.position.set(-4, 0, 0)
    vehicleVisual.add(seat, exit)
    physics.step()
    let armed = false
    const adapter = createRuntimeControlAdapter({
      physics,
      scene,
      player,
      playerVisual: characterVisual,
      seatAnchor: seat,
      exitAnchor: exit,
      characterContract: contract.character,
      afterMutation: (appliedBoundary) => {
        if (armed && appliedBoundary === boundary) {
          throw new Error(`injected failure after ${boundary}`)
        }
      },
    })
    const authority = new ControlAuthority(adapter)
    authority.requestEnter({ vehicleSpeedMps: 0, seatDistanceM: 0.5 })
    if (event !== 'enter-started') {
      authority.completeTransition('enter-started')
    }
    if (event === 'exit-placed' || event === 'exit-complete') {
      authority.completeTransition('seated')
      authority.requestExit()
      authority.completeTransition('exit-started')
    }
    if (event === 'exit-complete') {
      authority.completeTransition('exit-placed')
    }
    const capture = () => ({
      colliderEnabled: player.collider.isEnabled(),
      bodyTranslation: { ...player.body.translation() },
      nextTranslation: { ...player.body.nextTranslation() },
      visualParent: characterVisual.parent,
      visualPosition: characterVisual.position.toArray(),
      visualQuaternion: characterVisual.quaternion.toArray(),
      visualVisible: characterVisual.visible,
    })
    const before = capture()
    armed = true

    expect(authority.completeTransition(event)).toEqual({
      ok: false,
      code: 'TRANSITION_SIDE_EFFECT_FAILED',
    })

    const after = capture()
    expect(after.colliderEnabled).toBe(before.colliderEnabled)
    expect(after.bodyTranslation).toEqual(before.bodyTranslation)
    expect(after.nextTranslation).toEqual(before.nextTranslation)
    expect(after.visualParent).toBe(before.visualParent)
    expect(after.visualPosition).toEqual(before.visualPosition)
    expect(after.visualQuaternion).toEqual(before.visualQuaternion)
    expect(after.visualVisible).toBe(before.visualVisible)
    expect(authority.state).toBe(
      event === 'enter-started' || event === 'seated' ? 'entering' : 'exiting',
    )
    expect(authority.inputOwner).toBe(
      event === 'enter-started' || event === 'seated' ? 'player' : 'vehicle',
    )

    armed = false
    expect(authority.completeTransition(event)).toEqual({ ok: true, code: 'OK' })
  })
})

describe('DebugPanel', () => {
  it('renders every required diagnostic field', () => {
    const document = new JSDOM('<aside></aside>').window.document
    const element = document.querySelector('aside')!
    const panel = new DebugPanel(element)

    panel.update({
      speedMps: 3.25,
      rollDegrees: 4,
      pitchDegrees: 8,
      wheels: [
        { id: 'front', grounded: true, suspensionLengthM: 0.18 },
        { id: 'rear-left', grounded: true, suspensionLengthM: 0.17 },
        { id: 'rear-right', grounded: false, suspensionLengthM: 0.3 },
      ],
      currentMassKg: 440,
      controlOwner: 'vehicle',
      jobState: 'vehicle-loaded',
      lastDomainTransition: 'LoadVehicle:OK',
      physicsStepP95Ms: 1.75,
      recoveryCount: 2,
    })

    expect(element.textContent).toContain('Speed: 3.25 m/s')
    expect(element.textContent).toContain('Roll: 4.00°')
    expect(element.textContent).toContain('Pitch: 8.00°')
    expect(element.textContent).toContain('front: grounded, 0.180 m')
    expect(element.textContent).toContain('rear-left: grounded, 0.170 m')
    expect(element.textContent).toContain('rear-right: airborne, 0.300 m')
    expect(element.textContent).toContain('Mass: 440.00 kg')
    expect(element.textContent).toContain('Control owner: vehicle')
    expect(element.textContent).toContain('Job state: vehicle-loaded')
    expect(element.textContent).toContain('Last transition: LoadVehicle:OK')
    expect(element.textContent).toContain('Physics p95: 1.75 ms')
    expect(element.textContent).toContain('Recoveries: 2')
  })
})
