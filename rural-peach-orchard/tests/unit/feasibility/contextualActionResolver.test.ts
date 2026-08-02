import { describe, expect, it, vi } from 'vitest'
import {
  ContextualActionResolver,
  type ContextualAction,
  type ContextualActionContext,
} from '../../../src/feasibility/interaction/ContextualActionResolver'

const BASE_CONTEXT: ContextualActionContext = {
  controlOwner: 'player',
  controlsLocked: false,
  jobState: 'idle',
  fruitOwner: 'tree',
  nearJobBoard: false,
  nearVehicleSeat: false,
  inOrchardParkingZone: false,
  nearTree: false,
  nearBasket: false,
  nearCrate: false,
  nearCargo: false,
  nearDelivery: false,
}

function createResolver(trace: ContextualAction[] = []): ContextualActionResolver {
  return new ContextualActionResolver(Object.fromEntries([
    'accept-job',
    'enter-vehicle',
    'park-and-exit',
    'exit-vehicle',
    'pick',
    'place-in-basket',
    'pack-crate',
    'load-crate',
    'deliver',
  ].map((action) => [action, () => { trace.push(action as ContextualAction) }])) as {
    readonly [Action in ContextualAction]: () => void
  })
}

describe('ContextualActionResolver', () => {
  it.each([
    ['accept-job', { nearJobBoard: true }],
    ['enter-vehicle', { jobState: 'preparing', nearVehicleSeat: true }],
    ['park-and-exit', {
      controlOwner: 'vehicle',
      jobState: 'en-route-to-orchard',
      inOrchardParkingZone: true,
    }],
    ['exit-vehicle', { controlOwner: 'vehicle', jobState: 'preparing' }],
    ['pick', { jobState: 'parked-at-orchard', nearTree: true }],
    ['place-in-basket', { fruitOwner: 'player', nearBasket: true }],
    ['pack-crate', { fruitOwner: 'basket', nearCrate: true }],
    ['load-crate', { fruitOwner: 'crate', nearCargo: true }],
    ['deliver', {
      jobState: 'returning',
      fruitOwner: 'vehicle',
      nearDelivery: true,
    }],
  ] satisfies ReadonlyArray<readonly [ContextualAction, Partial<ContextualActionContext>]>) (
    'resolves %s from immutable context',
    (expected, override) => {
      const resolver = createResolver()
      const context = { ...BASE_CONTEXT, ...override }
      const before = structuredClone(context)

      expect(resolver.resolve(context)).toBe(expected)
      expect(context).toEqual(before)
    },
  )

  it('chooses job acceptance over an overlapping vehicle seat', () => {
    const resolver = createResolver()

    expect(resolver.resolve({
      ...BASE_CONTEXT,
      nearJobBoard: true,
      nearVehicleSeat: true,
    })).toBe('accept-job')
  })

  it('returns null while a Task 7 transfer lock is active', () => {
    const handlers = {
      'accept-job': vi.fn(),
      'enter-vehicle': vi.fn(),
      'park-and-exit': vi.fn(),
      'exit-vehicle': vi.fn(),
      pick: vi.fn(),
      'place-in-basket': vi.fn(),
      'pack-crate': vi.fn(),
      'load-crate': vi.fn(),
      deliver: vi.fn(),
    }
    const resolver = new ContextualActionResolver(handlers)

    const action = resolver.resolve({
      ...BASE_CONTEXT,
      controlsLocked: true,
      nearJobBoard: true,
      nearVehicleSeat: true,
    })

    expect(action).toBeNull()
    expect(Object.values(handlers).every((handler) => (
      handler.mock.calls.length === 0
    ))).toBe(true)
  })

  it('executes only the explicitly resolved action', () => {
    const trace: ContextualAction[] = []
    const resolver = createResolver(trace)

    resolver.execute('accept-job')

    expect(trace).toEqual(['accept-job'])
  })
})
