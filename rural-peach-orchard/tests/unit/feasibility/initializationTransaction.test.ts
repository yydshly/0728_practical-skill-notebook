import { describe, expect, it, vi } from 'vitest'
import {
  initializeFeasibilityRuntime,
  type DisposableResource,
  type StartableActorRuntime,
} from '../../../src/feasibility/runtime/initializeFeasibilityRuntime'

type FailureStage = 'batching' | 'world' | 'lighting' | 'actor'

function disposable(name: string, calls: string[]): DisposableResource {
  let disposed = false
  return {
    dispose() {
      if (disposed) return
      disposed = true
      calls.push(`dispose:${name}`)
    },
  }
}

describe('initializeFeasibilityRuntime', () => {
  it.each([
    ['batching', ['create:batching', 'dispose:base']],
    ['world', [
      'create:batching', 'create:world',
      'dispose:actors', 'dispose:batching', 'dispose:base',
    ]],
    ['lighting', [
      'create:batching', 'create:world', 'create:lighting',
      'dispose:actors', 'dispose:world', 'dispose:batching', 'dispose:base',
    ]],
    ['actor', [
      'create:batching', 'create:world', 'create:lighting', 'create:actor',
      'dispose:actors', 'dispose:lighting', 'dispose:world',
      'dispose:batching', 'dispose:base',
    ]],
  ] as const)(
    'rolls back a %s initialization failure in strict reverse order',
    (failureStage, expectedCalls) => {
      const calls: string[] = []
      const create = <T extends FailureStage>(stage: T): DisposableResource => {
        calls.push(`create:${stage}`)
        if (failureStage === stage) throw new Error(`injected ${stage}`)
        return disposable(stage, calls)
      }

      expect(() => initializeFeasibilityRuntime({
        createVehicleBatch: () => create('batching'),
        createWorldVisual: () => create('world'),
        createLighting: () => create('lighting'),
        createActorRuntime: () => {
          calls.push('create:actor')
          if (failureStage === 'actor') throw new Error('injected actor')
          return {
            start: vi.fn(),
            stop: () => calls.push('dispose:actor'),
          }
        },
        disposeActors: () => calls.push('dispose:actors'),
        disposeBase: () => calls.push('dispose:base'),
      })).toThrow(`injected ${failureStage}`)

      expect(calls).toEqual(expectedCalls)
    },
  )

  it('unwinds a failed actor start and makes successful stop idempotent', () => {
    const calls: string[] = []
    const actor = (startFails: boolean): StartableActorRuntime => ({
      start() {
        calls.push('start:actor')
        if (startFails) throw new Error('injected start')
      },
      stop: vi.fn(() => calls.push('dispose:actor')),
    })
    const factories = (startFails: boolean) => ({
      createVehicleBatch: () => disposable('batching', calls),
      createWorldVisual: () => disposable('world', calls),
      createLighting: () => disposable('lighting', calls),
      createActorRuntime: () => actor(startFails),
      disposeActors: () => calls.push('dispose:actors'),
      disposeBase: () => calls.push('dispose:base'),
    })

    expect(() => initializeFeasibilityRuntime(factories(true)))
      .toThrow('injected start')
    expect(calls).toEqual([
      'start:actor', 'dispose:actor', 'dispose:actors', 'dispose:lighting',
      'dispose:world', 'dispose:batching', 'dispose:base',
    ])

    calls.length = 0
    const runtime = initializeFeasibilityRuntime(factories(false))
    runtime.stop()
    runtime.stop()
    expect(calls).toEqual([
      'start:actor', 'dispose:actor', 'dispose:actors', 'dispose:lighting',
      'dispose:world', 'dispose:batching', 'dispose:base',
    ])
  })
})
