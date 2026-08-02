import { describe, expect, it } from 'vitest'
import { HarvestDomain } from '../../../src/feasibility/domain/HarvestDomain'

function createDomain() {
  return HarvestDomain.create({
    fruitIds: ['fruit-1', 'fruit-2'],
    capacities: {
      player: 1,
      basket: 1,
      crate: 1,
      vehicle: 1,
      delivered: 2,
    },
  })
}

function reachPicking(domain: HarvestDomain) {
  domain.dispatch({ kind: 'AcceptJob', commandId: 'accept' })
  domain.dispatch({ kind: 'PrepareVehicle', commandId: 'prepare' })
  domain.dispatch({ kind: 'DepartForOrchard', commandId: 'depart' })
  domain.dispatch({ kind: 'ParkAtOrchard', commandId: 'park' })
}

describe('HarvestDomain', () => {
  it('creates the same isolated initial fixture for the same inputs', () => {
    const fruitIds = ['fruit-1', 'fruit-2']
    const capacities = {
      player: 1,
      basket: 1,
      crate: 1,
      vehicle: 2,
      delivered: 2,
    }
    const first = HarvestDomain.create({ fruitIds, capacities })
    const second = HarvestDomain.create({ fruitIds, capacities })

    fruitIds[0] = 'changed-outside'
    capacities.player = 99

    expect(first.snapshot()).toEqual(second.snapshot())
    expect(first.snapshot()).toEqual({
      jobState: 'idle',
      owners: { 'fruit-1': 'tree', 'fruit-2': 'tree' },
      capacities: {
        player: 1,
        basket: 1,
        crate: 1,
        vehicle: 2,
        delivered: 2,
      },
    })
  })

  it('enforces the exact job order before picking starts', () => {
    const domain = createDomain()

    expect(domain.dispatch({
      kind: 'PrepareVehicle',
      commandId: 'prepare-too-soon',
    })).toEqual({ ok: false, code: 'INVALID_STATE' })
    expect(domain.dispatch({ kind: 'AcceptJob', commandId: 'accept' }))
      .toEqual({ ok: true, code: 'OK' })
    expect(domain.snapshot().jobState).toBe('accepted')
    expect(domain.dispatch({ kind: 'PrepareVehicle', commandId: 'prepare' }))
      .toEqual({ ok: true, code: 'OK' })
    expect(domain.snapshot().jobState).toBe('preparing')
    expect(domain.dispatch({
      kind: 'DepartForOrchard',
      commandId: 'depart',
    })).toEqual({ ok: true, code: 'OK' })
    expect(domain.snapshot().jobState).toBe('en-route-to-orchard')
    expect(domain.dispatch({ kind: 'ParkAtOrchard', commandId: 'park' }))
      .toEqual({ ok: true, code: 'OK' })
    expect(domain.snapshot().jobState).toBe('parked-at-orchard')
  })

  it('moves fruit tree -> player -> basket -> crate -> vehicle -> delivered once', () => {
    const domain = createDomain()
    reachPicking(domain)

    expect(domain.dispatch({
      kind: 'PickFruit',
      commandId: 'pick',
      fruitId: 'fruit-1',
    }).ok).toBe(true)
    expect(domain.snapshot().owners['fruit-1']).toBe('player')
    expect(domain.snapshot().jobState).toBe('picking')
    expect(domain.dispatch({
      kind: 'MoveFruit',
      commandId: 'basket',
      fruitId: 'fruit-1',
      from: 'player',
      to: 'basket',
    }).ok).toBe(true)
    expect(domain.dispatch({
      kind: 'MoveFruit',
      commandId: 'crate',
      fruitId: 'fruit-1',
      from: 'basket',
      to: 'crate',
    }).ok).toBe(true)
    expect(domain.dispatch({
      kind: 'LoadVehicle',
      commandId: 'load',
      fruitId: 'fruit-1',
    }).ok).toBe(true)
    expect(domain.snapshot().jobState).toBe('vehicle-loaded')
    expect(domain.dispatch({ kind: 'StartReturn', commandId: 'return' }).ok)
      .toBe(true)
    expect(domain.snapshot().jobState).toBe('returning')
    expect(domain.dispatch({
      kind: 'DeliverCargo',
      commandId: 'deliver',
      fruitId: 'fruit-1',
    }).ok).toBe(true)

    expect(domain.snapshot().owners['fruit-1']).toBe('delivered')
    expect(domain.snapshot().jobState).toBe('delivered')
  })

  it('keeps returning until every loaded fruit is delivered', () => {
    const domain = HarvestDomain.create({
      fruitIds: ['fruit-1', 'fruit-2'],
      capacities: {
        player: 1,
        basket: 1,
        crate: 2,
        vehicle: 2,
        delivered: 2,
      },
    })
    reachPicking(domain)

    for (const fruitId of ['fruit-1', 'fruit-2']) {
      domain.dispatch({
        kind: 'PickFruit',
        commandId: `pick-${fruitId}`,
        fruitId,
      })
      domain.dispatch({
        kind: 'MoveFruit',
        commandId: `basket-${fruitId}`,
        fruitId,
        from: 'player',
        to: 'basket',
      })
      domain.dispatch({
        kind: 'MoveFruit',
        commandId: `crate-${fruitId}`,
        fruitId,
        from: 'basket',
        to: 'crate',
      })
    }
    expect(domain.dispatch({
      kind: 'LoadVehicle',
      commandId: 'load-1',
      fruitId: 'fruit-1',
    }).ok).toBe(true)
    expect(domain.dispatch({
      kind: 'LoadVehicle',
      commandId: 'load-2',
      fruitId: 'fruit-2',
    }).ok).toBe(true)
    domain.dispatch({ kind: 'StartReturn', commandId: 'return' })

    expect(domain.dispatch({
      kind: 'DeliverCargo',
      commandId: 'deliver-1',
      fruitId: 'fruit-1',
    }).ok).toBe(true)
    expect(domain.snapshot().jobState).toBe('returning')
    expect(domain.dispatch({
      kind: 'DeliverCargo',
      commandId: 'deliver-2',
      fruitId: 'fruit-2',
    }).ok).toBe(true)
    expect(domain.snapshot().jobState).toBe('delivered')
  })

  it('rejects delivery before vehicle-loaded without mutation', () => {
    const domain = createDomain()
    const before = domain.snapshot()

    const result = domain.dispatch({
      kind: 'DeliverCargo',
      commandId: 'early',
      fruitId: 'fruit-1',
    })

    expect(result.code).toBe('INVALID_STATE')
    expect(domain.snapshot()).toEqual(before)
  })

  it('rejects a full target without removing fruit from its source', () => {
    const domain = createDomain()
    reachPicking(domain)
    domain.dispatch({
      kind: 'PickFruit',
      commandId: 'pick-1',
      fruitId: 'fruit-1',
    })

    const result = domain.dispatch({
      kind: 'PickFruit',
      commandId: 'pick-2',
      fruitId: 'fruit-2',
    })

    expect(result.code).toBe('CAPACITY_EXCEEDED')
    expect(domain.snapshot().owners['fruit-2']).toBe('tree')
    expect(domain.snapshot().owners['fruit-1']).toBe('player')
  })

  it('applies capacity checks to transfer targets atomically', () => {
    const domain = HarvestDomain.create({
      fruitIds: ['fruit-1'],
      capacities: {
        player: 1,
        basket: 0,
        crate: 1,
        vehicle: 1,
        delivered: 1,
      },
    })
    reachPicking(domain)
    domain.dispatch({
      kind: 'PickFruit',
      commandId: 'pick',
      fruitId: 'fruit-1',
    })
    const before = domain.snapshot()

    const result = domain.dispatch({
      kind: 'MoveFruit',
      commandId: 'move',
      fruitId: 'fruit-1',
      from: 'player',
      to: 'basket',
    })

    expect(result).toEqual({ ok: false, code: 'CAPACITY_EXCEEDED' })
    expect(domain.snapshot()).toEqual(before)
  })

  it('rejects unknown fruit without mutation', () => {
    const domain = createDomain()
    reachPicking(domain)
    const before = domain.snapshot()

    const result = domain.dispatch({
      kind: 'PickFruit',
      commandId: 'unknown',
      fruitId: 'fruit-missing',
    })

    expect(result).toEqual({ ok: false, code: 'UNKNOWN_FRUIT' })
    expect(domain.snapshot()).toEqual(before)
  })

  it('rejects a from-owner mismatch without mutation', () => {
    const domain = createDomain()
    reachPicking(domain)
    domain.dispatch({
      kind: 'PickFruit',
      commandId: 'pick',
      fruitId: 'fruit-1',
    })
    const before = domain.snapshot()

    const result = domain.dispatch({
      kind: 'MoveFruit',
      commandId: 'wrong-owner',
      fruitId: 'fruit-1',
      from: 'basket',
      to: 'crate',
    })

    expect(result).toEqual({ ok: false, code: 'OWNER_MISMATCH' })
    expect(domain.snapshot()).toEqual(before)
  })

  it('rejects transfers that skip the ownership chain', () => {
    const domain = createDomain()
    reachPicking(domain)
    domain.dispatch({
      kind: 'PickFruit',
      commandId: 'pick',
      fruitId: 'fruit-1',
    })
    const before = domain.snapshot()

    const result = domain.dispatch({
      kind: 'MoveFruit',
      commandId: 'skip-basket',
      fruitId: 'fruit-1',
      from: 'player',
      to: 'crate',
    })

    expect(result).toEqual({ ok: false, code: 'INVALID_TRANSFER' })
    expect(domain.snapshot()).toEqual(before)
  })

  it('returns the cached result for a repeated commandId and payload', () => {
    const domain = createDomain()
    const first = domain.dispatch({ kind: 'AcceptJob', commandId: 'same' })
    const snapshot = domain.snapshot()

    const repeated = domain.dispatch({ kind: 'AcceptJob', commandId: 'same' })

    expect(repeated).toEqual(first)
    expect(repeated).not.toBe(first)
    expect(domain.snapshot()).toEqual(snapshot)
  })

  it('rejects a reused commandId with a different payload without executing it', () => {
    const domain = createDomain()
    expect(domain.dispatch({ kind: 'AcceptJob', commandId: 'same' }).ok)
      .toBe(true)
    const before = domain.snapshot()

    const collision = domain.dispatch({
      kind: 'PrepareVehicle',
      commandId: 'same',
    })

    expect(collision).toEqual({ ok: false, code: 'COMMAND_ID_CONFLICT' })
    expect(domain.snapshot()).toEqual(before)
    expect(domain.dispatch({ kind: 'AcceptJob', commandId: 'same' }))
      .toEqual({ ok: true, code: 'OK' })
    expect(domain.dispatch({
      kind: 'PrepareVehicle',
      commandId: 'new-prepare',
    }).ok).toBe(true)
  })

  it('caches rejected commands so later state changes cannot make them execute', () => {
    const domain = createDomain()
    const rejected = domain.dispatch({
      kind: 'PrepareVehicle',
      commandId: 'prepare-once',
    })
    domain.dispatch({ kind: 'AcceptJob', commandId: 'accept' })
    const beforeReplay = domain.snapshot()

    const replayed = domain.dispatch({
      kind: 'PrepareVehicle',
      commandId: 'prepare-once',
    })

    expect(replayed).toEqual(rejected)
    expect(replayed).toEqual({ ok: false, code: 'INVALID_STATE' })
    expect(domain.snapshot()).toEqual(beforeReplay)
    expect(domain.dispatch({
      kind: 'PrepareVehicle',
      commandId: 'prepare-fresh',
    }).ok).toBe(true)
  })

  it('returns deeply frozen snapshots that cannot alias domain state', () => {
    const domain = createDomain()
    const snapshot = domain.snapshot()

    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.owners)).toBe(true)
    expect(Object.isFrozen(snapshot.capacities)).toBe(true)
    expect(() => {
      (snapshot.owners as Record<string, string>)['fruit-1'] = 'delivered'
    }).toThrow(TypeError)
    expect(() => {
      (snapshot.capacities as Record<string, number>).player = 99
    }).toThrow(TypeError)
    expect(domain.snapshot().owners['fruit-1']).toBe('tree')
    expect(domain.snapshot().capacities.player).toBe(1)
  })

  it('prevents mutation of a fresh success from blocking later commits or poisoning replay', () => {
    const domain = createDomain()
    const accepted = domain.dispatch({
      kind: 'AcceptJob',
      commandId: 'accept-immutable',
    })
    let mutationError: unknown

    try {
      (accepted as { ok: boolean }).ok = false
    } catch (error) {
      mutationError = error
    }
    const prepared = domain.dispatch({
      kind: 'PrepareVehicle',
      commandId: 'prepare-after-mutation',
    })

    // Restore the pre-fix shared object so a RED run cannot contaminate other
    // tests after it has captured the broken follow-up result and cache entry.
    if (!Object.isFrozen(accepted)) {
      (accepted as { ok: boolean }).ok = true
    }

    expect(mutationError).toBeInstanceOf(TypeError)
    expect(Object.isFrozen(accepted)).toBe(true)
    expect(prepared).toEqual({ ok: true, code: 'OK' })
    expect(domain.snapshot().jobState).toBe('preparing')
    expect(domain.dispatch({
      kind: 'PrepareVehicle',
      commandId: 'prepare-after-mutation',
    })).toEqual({ ok: true, code: 'OK' })
  })

  it('returns frozen isolated results for rejections, cache hits, and commandId conflicts', () => {
    const domain = createDomain()
    const rejection = domain.dispatch({
      kind: 'PrepareVehicle',
      commandId: 'rejected-immutable',
    })
    const cachedRejection = domain.dispatch({
      kind: 'PrepareVehicle',
      commandId: 'rejected-immutable',
    })
    const success = domain.dispatch({
      kind: 'AcceptJob',
      commandId: 'accepted-immutable',
    })
    const cachedSuccess = domain.dispatch({
      kind: 'AcceptJob',
      commandId: 'accepted-immutable',
    })
    const conflict = domain.dispatch({
      kind: 'PrepareVehicle',
      commandId: 'accepted-immutable',
    })
    const repeatedConflict = domain.dispatch({
      kind: 'PrepareVehicle',
      commandId: 'accepted-immutable',
    })

    for (const result of [
      rejection,
      cachedRejection,
      success,
      cachedSuccess,
      conflict,
      repeatedConflict,
    ]) {
      expect(Object.isFrozen(result)).toBe(true)
      expect(() => {
        (result as { code: string }).code = 'MUTATED'
      }).toThrow(TypeError)
    }
    expect(cachedRejection).not.toBe(rejection)
    expect(cachedSuccess).not.toBe(success)
    expect(repeatedConflict).not.toBe(conflict)
    expect(cachedRejection).toEqual({ ok: false, code: 'INVALID_STATE' })
    expect(cachedSuccess).toEqual({ ok: true, code: 'OK' })
    expect(conflict).toEqual({ ok: false, code: 'COMMAND_ID_CONFLICT' })
  })
})
