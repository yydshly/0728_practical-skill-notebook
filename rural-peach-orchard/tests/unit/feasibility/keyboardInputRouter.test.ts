import { describe, expect, it } from 'vitest'
import { KeyboardInputRouter } from '../../../src/feasibility/input/KeyboardInputRouter'
import type {
  ActionPulse,
  VehicleCommand,
} from '../../../src/feasibility/input/RuntimeCommand'
import {
  ContextualActionResolver,
  type ContextualAction,
} from '../../../src/feasibility/interaction/ContextualActionResolver'

function keyEvent(
  type: 'keydown' | 'keyup',
  code: string,
  repeat = false,
): KeyboardEvent {
  const event = new Event(type, { cancelable: true }) as KeyboardEvent
  Object.defineProperties(event, {
    code: { value: code },
    repeat: { value: repeat },
  })
  return event
}

function createRouter(target: EventTarget, commands: VehicleCommand[]): KeyboardInputRouter {
  return new KeyboardInputRouter({
    target,
    getInputOwner: () => 'vehicle',
    drive: () => undefined,
    movePlayer: () => undefined,
    interact: () => undefined,
    recover: () => undefined,
    emitVehicleCommand: (command) => commands.push(command),
  })
}

describe('KeyboardInputRouter semantic commands', () => {
  it.each([
    ['KeyW', { longitudinal: 'forward', steering: 'center', serviceBrake: false }],
    ['KeyS', { longitudinal: 'reverse', steering: 'center', serviceBrake: false }],
    ['KeyA', { longitudinal: 'neutral', steering: 'left', serviceBrake: false }],
    ['KeyD', { longitudinal: 'neutral', steering: 'right', serviceBrake: false }],
    ['Space', { longitudinal: 'neutral', steering: 'center', serviceBrake: true }],
  ] as const)('emits %s as a semantic vehicle command', (code, expected) => {
    const target = new EventTarget()
    const commands: VehicleCommand[] = []
    const router = createRouter(target, commands)
    router.start()

    target.dispatchEvent(keyEvent('keydown', code))
    router.fixedStep(1 / 60)

    expect(commands).toEqual([expected])
  })

  it('turns simultaneous W and S into a neutral service-brake command', () => {
    const target = new EventTarget()
    const commands: VehicleCommand[] = []
    const router = createRouter(target, commands)
    router.start()

    target.dispatchEvent(keyEvent('keydown', 'KeyW'))
    target.dispatchEvent(keyEvent('keydown', 'KeyS'))
    router.fixedStep(1 / 60)

    expect(commands).toEqual([
      { longitudinal: 'neutral', steering: 'center', serviceBrake: true },
    ])
  })

  it('emits one monotonically increasing recovery pulse per non-repeat keydown', () => {
    const target = new EventTarget()
    const pulses: ActionPulse[] = []
    const router = new KeyboardInputRouter({
      target,
      getInputOwner: () => 'player',
      drive: () => undefined,
      movePlayer: () => undefined,
      interact: () => undefined,
      recover: () => undefined,
      emitActionPulse: (pulse) => { pulses.push(pulse) },
    })
    router.start()

    target.dispatchEvent(keyEvent('keydown', 'KeyR'))
    target.dispatchEvent(keyEvent('keydown', 'KeyR', true))
    target.dispatchEvent(keyEvent('keydown', 'KeyE'))
    router.fixedStep(1 / 60)

    expect(pulses).toEqual([
      { id: 1, kind: 'recover' },
      { id: 2, kind: 'interact' },
    ])
  })

  it('consumes a failed interaction pulse without retrying after context changes', () => {
    const target = new EventTarget()
    let contextIsEligible = false
    const actions: string[] = []
    const router = new KeyboardInputRouter({
      target,
      getInputOwner: () => 'player',
      drive: () => undefined,
      movePlayer: () => undefined,
      interact: () => {
        if (contextIsEligible) actions.push('interaction')
      },
      recover: () => undefined,
      emitActionPulse: () => false,
    })
    router.start()
    target.dispatchEvent(keyEvent('keydown', 'KeyE'))

    router.fixedStep(1 / 60)
    contextIsEligible = true
    for (let update = 0; update < 10; update += 1) {
      router.fixedStep(1 / 60)
    }

    expect(actions).toEqual([])
  })

  it('accepts only the job and does not reuse that press to enter later', () => {
    const target = new EventTarget()
    let jobState: 'idle' | 'accepted' | 'preparing' = 'idle'
    const trace: ContextualAction[] = []
    const resolver = new ContextualActionResolver({
      'accept-job': () => { jobState = 'accepted'; trace.push('accept-job') },
      'enter-vehicle': () => { trace.push('enter-vehicle') },
      'park-and-exit': () => { trace.push('park-and-exit') },
      'exit-vehicle': () => { trace.push('exit-vehicle') },
      pick: () => { trace.push('pick') },
      'place-in-basket': () => { trace.push('place-in-basket') },
      'pack-crate': () => { trace.push('pack-crate') },
      'load-crate': () => { trace.push('load-crate') },
      deliver: () => { trace.push('deliver') },
    })
    const interact = () => {
      const action = resolver.resolve({
        controlOwner: 'player',
        controlsLocked: false,
        jobState,
        fruitOwner: 'tree',
        nearJobBoard: true,
        nearVehicleSeat: true,
        inOrchardParkingZone: false,
        nearTree: false,
        nearBasket: false,
        nearCrate: false,
        nearCargo: false,
        nearDelivery: false,
      })
      if (!action) return false
      return resolver.execute(action)
    }
    const router = new KeyboardInputRouter({
      target,
      getInputOwner: () => 'player',
      drive: () => undefined,
      movePlayer: () => undefined,
      interact,
      recover: () => undefined,
    })
    router.start()
    target.dispatchEvent(keyEvent('keydown', 'KeyE'))

    router.fixedStep(1 / 60)
    jobState = 'preparing'
    for (let update = 0; update < 10; update += 1) {
      router.fixedStep(1 / 60)
    }

    expect(trace).toEqual(['accept-job'])
  })

  it('holding E across ten fixed updates emits one action trace entry', () => {
    const target = new EventTarget()
    const trace: string[] = []
    const router = new KeyboardInputRouter({
      target,
      getInputOwner: () => 'player',
      drive: () => undefined,
      movePlayer: () => undefined,
      interact: () => { trace.push('action') },
      recover: () => undefined,
    })
    router.start()
    target.dispatchEvent(keyEvent('keydown', 'KeyE'))
    target.dispatchEvent(keyEvent('keydown', 'KeyE', true))

    for (let update = 0; update < 10; update += 1) {
      router.fixedStep(1 / 60)
    }

    expect(trace).toEqual(['action'])
  })

  it('consumes a pulse suppressed by a transfer lock without queueing it', () => {
    const target = new EventTarget()
    let locked = true
    let interactions = 0
    const router = new KeyboardInputRouter({
      target,
      getInputOwner: () => 'player',
      controlsLocked: () => locked,
      drive: () => undefined,
      movePlayer: () => undefined,
      interact: () => { interactions += 1 },
      recover: () => undefined,
    })
    router.start()
    target.dispatchEvent(keyEvent('keydown', 'KeyE'))

    router.fixedStep(1 / 60)
    locked = false
    router.fixedStep(1 / 60)

    expect(interactions).toBe(0)
  })

  it('prevents defaults for every handled key and clears held keys on blur and stop', () => {
    const target = new EventTarget()
    const commands: VehicleCommand[] = []
    const router = createRouter(target, commands)
    router.start()
    const handled = ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'Space', 'KeyE', 'KeyR']

    for (const code of handled) {
      const down = keyEvent('keydown', code)
      const up = keyEvent('keyup', code)
      target.dispatchEvent(down)
      target.dispatchEvent(up)
      expect(down.defaultPrevented).toBe(true)
      expect(up.defaultPrevented).toBe(true)
    }

    target.dispatchEvent(keyEvent('keydown', 'KeyW'))
    target.dispatchEvent(new Event('blur'))
    router.fixedStep(1 / 60)
    router.stop()
    router.fixedStep(1 / 60)

    expect(commands).toEqual([
      { longitudinal: 'neutral', steering: 'center', serviceBrake: false },
      { longitudinal: 'neutral', steering: 'center', serviceBrake: false },
    ])
  })
})
