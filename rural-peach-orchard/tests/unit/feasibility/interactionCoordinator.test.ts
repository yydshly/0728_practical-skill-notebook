import { Object3D } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { HarvestDomain } from '../../../src/feasibility/domain/HarvestDomain'
import {
  InteractionCoordinator,
  type InteractionToken,
  type SpatialCandidate,
} from '../../../src/feasibility/interaction/InteractionCoordinator'
import { CargoPresentation } from '../../../src/feasibility/presentation/CargoPresentation'

const treeCandidate: SpatialCandidate = {
  id: 'tree-sensor',
  kind: 'tree',
  inside: true,
  distanceM: 0.8,
  facingDegrees: 20,
}

function createDomainAtPicking(): HarvestDomain {
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
  return domain
}

function createDomainWithFruitInCrate(): HarvestDomain {
  const domain = createDomainAtPicking()
  domain.dispatch({
    kind: 'PickFruit',
    commandId: 'setup-pick',
    fruitId: 'fruit-1',
  })
  domain.dispatch({
    kind: 'MoveFruit',
    commandId: 'setup-basket',
    fruitId: 'fruit-1',
    from: 'player',
    to: 'basket',
  })
  domain.dispatch({
    kind: 'MoveFruit',
    commandId: 'setup-crate',
    fruitId: 'fruit-1',
    from: 'basket',
    to: 'crate',
  })
  return domain
}

function createDomainWithTwoFruitsInCrate(): HarvestDomain {
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
  domain.dispatch({ kind: 'AcceptJob', commandId: 'two-accept' })
  domain.dispatch({ kind: 'PrepareVehicle', commandId: 'two-prepare' })
  domain.dispatch({
    kind: 'DepartForOrchard',
    commandId: 'two-depart',
  })
  domain.dispatch({ kind: 'ParkAtOrchard', commandId: 'two-park' })
  for (const fruitId of ['fruit-1', 'fruit-2']) {
    domain.dispatch({
      kind: 'PickFruit',
      commandId: `two-pick-${fruitId}`,
      fruitId,
    })
    domain.dispatch({
      kind: 'MoveFruit',
      commandId: `two-basket-${fruitId}`,
      fruitId,
      from: 'player',
      to: 'basket',
    })
    domain.dispatch({
      kind: 'MoveFruit',
      commandId: `two-crate-${fruitId}`,
      fruitId,
      from: 'basket',
      to: 'crate',
    })
  }
  return domain
}

describe('InteractionCoordinator', () => {
  it('executes one resolved interaction through begin and commit', () => {
    const domain = createDomainAtPicking()
    const coordinator = new InteractionCoordinator({
      domain,
      getControlOwner: () => 'player',
      getCandidate: () => treeCandidate,
      setCargoMass: vi.fn(),
    })

    const result = coordinator.execute('tree-sensor', {
      kind: 'PickFruit',
      commandId: 'execute-pick',
      fruitId: 'fruit-1',
    })

    expect(result).toEqual({ ok: true, code: 'OK' })
    expect(domain.snapshot().owners['fruit-1']).toBe('player')
  })

  it('returns an unresolved result without dispatching after context changes', () => {
    const domain = createDomainAtPicking()
    const dispatch = vi.spyOn(domain, 'dispatch')
    let candidate: SpatialCandidate | undefined = treeCandidate
    const coordinator = new InteractionCoordinator({
      domain,
      getControlOwner: () => 'player',
      getCandidate: () => candidate,
      setCargoMass: vi.fn(),
    })
    candidate = undefined

    const result = coordinator.execute('tree-sensor', {
      kind: 'PickFruit',
      commandId: 'missing-context',
      fruitId: 'fruit-1',
    })

    expect(result).toBeUndefined()
    expect(dispatch).not.toHaveBeenCalled()
    expect(domain.snapshot().owners['fruit-1']).toBe('tree')
  })

  it('dispatches a matching PickFruit only after commit', () => {
    const domain = createDomainAtPicking()
    const dispatch = vi.spyOn(domain, 'dispatch')
    const coordinator = new InteractionCoordinator({
      domain,
      getControlOwner: () => 'player',
      getCandidate: () => treeCandidate,
      setCargoMass: vi.fn(),
    })

    const begun = coordinator.begin(treeCandidate, {
      kind: 'PickFruit',
      commandId: 'pick',
      fruitId: 'fruit-1',
    })

    expect(begun.ok).toBe(true)
    expect(dispatch).not.toHaveBeenCalled()
    if (!begun.ok) throw new Error('expected interaction token')
    expect(coordinator.commit(begun.token)).toEqual({ ok: true, code: 'OK' })
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(domain.snapshot().owners['fruit-1']).toBe('player')
  })

  it('does not begin PickFruit while driving', () => {
    const domain = createDomainAtPicking()
    const dispatch = vi.spyOn(domain, 'dispatch')
    const coordinator = new InteractionCoordinator({
      domain,
      getControlOwner: () => 'vehicle',
      getCandidate: () => treeCandidate,
      setCargoMass: vi.fn(),
    })

    const result = coordinator.begin(treeCandidate, {
      kind: 'PickFruit',
      commandId: 'pick',
      fruitId: 'fruit-1',
    })

    expect(result).toEqual({ ok: false, code: 'CONTROL_OWNER_INVALID' })
    expect(dispatch).not.toHaveBeenCalled()
    expect(domain.snapshot().owners['fruit-1']).toBe('tree')
  })

  it('rejects a command whose spatial kind does not match its interaction', () => {
    const domain = createDomainAtPicking()
    const dispatch = vi.spyOn(domain, 'dispatch')
    const cargoCandidate: SpatialCandidate = {
      ...treeCandidate,
      id: 'cargo-sensor',
      kind: 'cargo',
    }
    const coordinator = new InteractionCoordinator({
      domain,
      getControlOwner: () => 'player',
      getCandidate: () => cargoCandidate,
      setCargoMass: vi.fn(),
    })

    const result = coordinator.begin(cargoCandidate, {
      kind: 'PickFruit',
      commandId: 'pick',
      fruitId: 'fruit-1',
    })

    expect(result).toEqual({
      ok: false,
      code: 'CANDIDATE_COMMAND_MISMATCH',
    })
    expect(dispatch).not.toHaveBeenCalled()
  })

  it.each([
    ['outside the sensor', { inside: false }],
    ['beyond 1.2m', { distanceM: 1.200_001 }],
    ['facing beyond 65 degrees', { facingDegrees: 65.001 }],
    ['with negative distance', { distanceM: -0.001 }],
    ['with negative facing', { facingDegrees: -0.001 }],
    ['with non-finite distance', { distanceM: Number.NaN }],
    ['with non-finite facing', { facingDegrees: Number.POSITIVE_INFINITY }],
  ])('does not begin %s', (_name, patch) => {
    const domain = createDomainAtPicking()
    const candidate = { ...treeCandidate, ...patch }
    const dispatch = vi.spyOn(domain, 'dispatch')
    const coordinator = new InteractionCoordinator({
      domain,
      getControlOwner: () => 'player',
      getCandidate: () => candidate,
      setCargoMass: vi.fn(),
    })

    expect(coordinator.begin(candidate, {
      kind: 'PickFruit',
      commandId: 'pick',
      fruitId: 'fruit-1',
    })).toEqual({ ok: false, code: 'CONTEXT_INVALID' })
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('rejects a stale candidate at begin when the live sensor id changed', () => {
    const domain = createDomainAtPicking()
    const dispatch = vi.spyOn(domain, 'dispatch')
    const coordinator = new InteractionCoordinator({
      domain,
      getControlOwner: () => 'player',
      getCandidate: () => ({ ...treeCandidate, id: 'new-tree-sensor' }),
      setCargoMass: vi.fn(),
    })

    expect(coordinator.begin(treeCandidate, {
      kind: 'PickFruit',
      commandId: 'pick',
      fruitId: 'fruit-1',
    })).toEqual({ ok: false, code: 'CONTEXT_INVALID' })
    expect(dispatch).not.toHaveBeenCalled()
  })

  it.each([
    ['outside the sensor', { inside: false }],
    ['beyond 1.2m', { distanceM: 1.200_001 }],
    ['facing beyond 65 degrees', { facingDegrees: 65.001 }],
    ['with negative distance', { distanceM: -0.001 }],
    ['with negative facing', { facingDegrees: -0.001 }],
    ['with non-finite distance', { distanceM: Number.NaN }],
    ['with non-finite facing', { facingDegrees: Number.NEGATIVE_INFINITY }],
  ])('invalidates a token atomically when the live candidate is %s', (
    _name,
    patch,
  ) => {
    const domain = createDomainAtPicking()
    let candidate: SpatialCandidate = treeCandidate
    const dispatch = vi.spyOn(domain, 'dispatch')
    const coordinator = new InteractionCoordinator({
      domain,
      getControlOwner: () => 'player',
      getCandidate: () => candidate,
      setCargoMass: vi.fn(),
    })
    const begun = coordinator.begin(candidate, {
      kind: 'PickFruit',
      commandId: 'pick',
      fruitId: 'fruit-1',
    })
    if (!begun.ok) throw new Error('expected interaction token')
    candidate = { ...candidate, ...patch }

    expect(coordinator.commit(begun.token)).toEqual({
      ok: false,
      code: 'CONTEXT_INVALID',
    })
    candidate = treeCandidate
    expect(coordinator.commit(begun.token)).toEqual({
      ok: false,
      code: 'TOKEN_INVALID',
    })
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('invalidates a token when its live sensor kind is replaced', () => {
    const domain = createDomainAtPicking()
    let candidate: SpatialCandidate = treeCandidate
    const dispatch = vi.spyOn(domain, 'dispatch')
    const coordinator = new InteractionCoordinator({
      domain,
      getControlOwner: () => 'player',
      getCandidate: () => candidate,
      setCargoMass: vi.fn(),
    })
    const begun = coordinator.begin(candidate, {
      kind: 'PickFruit',
      commandId: 'pick',
      fruitId: 'fruit-1',
    })
    if (!begun.ok) throw new Error('expected interaction token')
    candidate = { ...candidate, kind: 'cargo' }

    expect(coordinator.commit(begun.token)).toEqual({
      ok: false,
      code: 'CONTEXT_INVALID',
    })
    candidate = treeCandidate
    expect(coordinator.commit(begun.token).code).toBe('TOKEN_INVALID')
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('revalidates on-foot ownership and consumes the token on interruption', () => {
    const domain = createDomainAtPicking()
    let owner: 'player' | 'vehicle' = 'player'
    const dispatch = vi.spyOn(domain, 'dispatch')
    const coordinator = new InteractionCoordinator({
      domain,
      getControlOwner: () => owner,
      getCandidate: () => treeCandidate,
      setCargoMass: vi.fn(),
    })
    const begun = coordinator.begin(treeCandidate, {
      kind: 'PickFruit',
      commandId: 'pick',
      fruitId: 'fruit-1',
    })
    if (!begun.ok) throw new Error('expected interaction token')
    owner = 'vehicle'

    expect(coordinator.commit(begun.token)).toEqual({
      ok: false,
      code: 'CONTROL_OWNER_INVALID',
    })
    owner = 'player'
    expect(coordinator.commit(begun.token).code).toBe('TOKEN_INVALID')
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('cancels a token without dispatch and keeps it single-use', () => {
    const domain = createDomainAtPicking()
    const dispatch = vi.spyOn(domain, 'dispatch')
    const coordinator = new InteractionCoordinator({
      domain,
      getControlOwner: () => 'player',
      getCandidate: () => treeCandidate,
      setCargoMass: vi.fn(),
    })
    const begun = coordinator.begin(treeCandidate, {
      kind: 'PickFruit',
      commandId: 'pick',
      fruitId: 'fruit-1',
    })
    if (!begun.ok) throw new Error('expected interaction token')

    coordinator.cancel(begun.token)
    coordinator.cancel(begun.token)

    expect(coordinator.commit(begun.token)).toEqual({
      ok: false,
      code: 'TOKEN_INVALID',
    })
    expect(dispatch).not.toHaveBeenCalled()
    expect(domain.snapshot().owners['fruit-1']).toBe('tree')
  })

  it('does not authorize guessed or structurally copied tokens', () => {
    const domain = createDomainAtPicking()
    const dispatch = vi.spyOn(domain, 'dispatch')
    const coordinator = new InteractionCoordinator({
      domain,
      getControlOwner: () => 'player',
      getCandidate: () => treeCandidate,
      setCargoMass: vi.fn(),
    })
    const first = coordinator.begin(treeCandidate, {
      kind: 'PickFruit',
      commandId: 'pick-first',
      fruitId: 'fruit-1',
    })
    const second = coordinator.begin(treeCandidate, {
      kind: 'PickFruit',
      commandId: 'pick-second',
      fruitId: 'fruit-1',
    })
    if (!first.ok || !second.ok) throw new Error('expected two tokens')
    const realId = (second.token as unknown as { id: number }).id
    const neighboringObject = Object.freeze({
      id: realId + 1,
    }) as unknown as InteractionToken
    const arbitraryObject = Object.freeze({
      id: 99_999,
    }) as unknown as InteractionToken
    const copiedObject = Object.freeze({
      id: realId,
    }) as unknown as InteractionToken
    const copiedCancelObject = Object.freeze({
      id: realId,
    }) as unknown as InteractionToken
    const guessedLegacyString = 'interaction-2' as unknown as InteractionToken

    expect(Object.isFrozen(second.token)).toBe(true)
    expect(coordinator.commit(guessedLegacyString)).toEqual({
      ok: false,
      code: 'TOKEN_INVALID',
    })
    expect(coordinator.commit(neighboringObject).code).toBe('TOKEN_INVALID')
    expect(coordinator.commit(arbitraryObject).code).toBe('TOKEN_INVALID')
    expect(coordinator.commit(copiedObject).code).toBe('TOKEN_INVALID')
    coordinator.cancel(copiedCancelObject)
    coordinator.cancel(neighboringObject)
    coordinator.cancel(arbitraryObject)
    coordinator.cancel(guessedLegacyString)
    expect(dispatch).not.toHaveBeenCalled()

    expect(coordinator.commit(second.token)).toEqual({ ok: true, code: 'OK' })
    expect(coordinator.commit(second.token).code).toBe('TOKEN_INVALID')
    expect(dispatch).toHaveBeenCalledTimes(1)
    coordinator.cancel(first.token)
  })

  it('consumes a successfully committed token', () => {
    const domain = createDomainAtPicking()
    const dispatch = vi.spyOn(domain, 'dispatch')
    const coordinator = new InteractionCoordinator({
      domain,
      getControlOwner: () => 'player',
      getCandidate: () => treeCandidate,
      setCargoMass: vi.fn(),
    })
    const begun = coordinator.begin(treeCandidate, {
      kind: 'PickFruit',
      commandId: 'pick',
      fruitId: 'fruit-1',
    })
    if (!begun.ok) throw new Error('expected interaction token')

    expect(coordinator.commit(begun.token)).toEqual({ ok: true, code: 'OK' })
    expect(coordinator.commit(begun.token)).toEqual({
      ok: false,
      code: 'TOKEN_INVALID',
    })
    expect(dispatch).toHaveBeenCalledTimes(1)
  })

  it('snapshots the validated command so later caller mutation cannot replace it', () => {
    const domain = createDomainAtPicking()
    const setCargoMass = vi.fn()
    const coordinator = new InteractionCoordinator({
      domain,
      getControlOwner: () => 'player',
      getCandidate: () => treeCandidate,
      setCargoMass,
    })
    const command = {
      kind: 'PickFruit' as const,
      commandId: 'pick',
      fruitId: 'fruit-1',
    }
    const begun = coordinator.begin(treeCandidate, command)
    if (!begun.ok) throw new Error('expected interaction token')
    const mutableCommand = command as {
      kind: string
      commandId: string
      fruitId: string
    }
    mutableCommand.kind = 'LoadVehicle'
    mutableCommand.commandId = 'mutated-load'

    expect(coordinator.commit(begun.token)).toEqual({ ok: true, code: 'OK' })
    expect(domain.snapshot().owners['fruit-1']).toBe('player')
    expect(setCargoMass).not.toHaveBeenCalled()
  })

  it.each([
    {
      candidateKind: 'tree' as const,
      command: {
        kind: 'PickFruit' as const,
        commandId: 'pick',
        fruitId: 'fruit-1',
      },
    },
    {
      candidateKind: 'basket' as const,
      command: {
        kind: 'MoveFruit' as const,
        commandId: 'basket',
        fruitId: 'fruit-1',
        from: 'player' as const,
        to: 'basket' as const,
      },
    },
    {
      candidateKind: 'crate' as const,
      command: {
        kind: 'MoveFruit' as const,
        commandId: 'crate',
        fruitId: 'fruit-1',
        from: 'basket' as const,
        to: 'crate' as const,
      },
    },
    {
      candidateKind: 'cargo' as const,
      command: {
        kind: 'LoadVehicle' as const,
        commandId: 'load',
        fruitId: 'fruit-1',
      },
    },
    {
      candidateKind: 'delivery' as const,
      command: {
        kind: 'DeliverCargo' as const,
        commandId: 'deliver',
        fruitId: 'fruit-1',
      },
    },
  ])('accepts the $candidateKind sensor for its matching command', ({
    candidateKind,
    command,
  }) => {
    const domain = createDomainAtPicking()
    const candidate: SpatialCandidate = {
      ...treeCandidate,
      id: `${candidateKind}-sensor`,
      kind: candidateKind,
    }
    const coordinator = new InteractionCoordinator({
      domain,
      getControlOwner: () => 'player',
      getCandidate: () => candidate,
      setCargoMass: vi.fn(),
    })

    const begun = coordinator.begin(candidate, command)

    expect(begun.ok).toBe(true)
    if (begun.ok) coordinator.cancel(begun.token)
  })

  it('does not translate a non-spatial workflow command', () => {
    const domain = createDomainAtPicking()
    const dispatch = vi.spyOn(domain, 'dispatch')
    const coordinator = new InteractionCoordinator({
      domain,
      getControlOwner: () => 'player',
      getCandidate: () => treeCandidate,
      setCargoMass: vi.fn(),
    })

    expect(coordinator.begin(treeCandidate, {
      kind: 'StartReturn',
      commandId: 'return',
    })).toEqual({
      ok: false,
      code: 'CANDIDATE_COMMAND_MISMATCH',
    })
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('does not update cargo mass when LoadVehicle fails in the domain', () => {
    const domain = createDomainAtPicking()
    const setCargoMass = vi.fn()
    const cargoCandidate: SpatialCandidate = {
      ...treeCandidate,
      id: 'cargo-sensor',
      kind: 'cargo',
    }
    const coordinator = new InteractionCoordinator({
      domain,
      getControlOwner: () => 'player',
      getCandidate: () => cargoCandidate,
      setCargoMass,
    })
    const begun = coordinator.begin(cargoCandidate, {
      kind: 'LoadVehicle',
      commandId: 'load',
      fruitId: 'fruit-1',
    })
    if (!begun.ok) throw new Error('expected interaction token')

    expect(coordinator.commit(begun.token)).toEqual({
      ok: false,
      code: 'INVALID_STATE',
    })
    expect(setCargoMass).not.toHaveBeenCalled()
    expect(domain.snapshot().owners['fruit-1']).toBe('tree')
  })

  it('sets the one-crate fixture mass only after successful LoadVehicle commit', () => {
    const domain = createDomainWithFruitInCrate()
    const setCargoMass = vi.fn()
    const cargoCandidate: SpatialCandidate = {
      ...treeCandidate,
      id: 'cargo-sensor',
      kind: 'cargo',
    }
    const coordinator = new InteractionCoordinator({
      domain,
      getControlOwner: () => 'player',
      getCandidate: () => cargoCandidate,
      setCargoMass,
    })
    const begun = coordinator.begin(cargoCandidate, {
      kind: 'LoadVehicle',
      commandId: 'load',
      fruitId: 'fruit-1',
    })
    if (!begun.ok) throw new Error('expected interaction token')

    expect(setCargoMass).not.toHaveBeenCalled()
    expect(coordinator.commit(begun.token)).toEqual({ ok: true, code: 'OK' })
    expect(setCargoMass).toHaveBeenCalledTimes(1)
    expect(setCargoMass).toHaveBeenCalledWith(20)
    expect(domain.snapshot().owners['fruit-1']).toBe('vehicle')
  })

  it('applies cargo mass once when duplicate tokens replay one commandId', () => {
    const domain = createDomainWithFruitInCrate()
    const setCargoMass = vi.fn()
    const cargoCandidate: SpatialCandidate = {
      ...treeCandidate,
      id: 'cargo-sensor',
      kind: 'cargo',
    }
    const coordinator = new InteractionCoordinator({
      domain,
      getControlOwner: () => 'player',
      getCandidate: () => cargoCandidate,
      setCargoMass,
    })
    const command = {
      kind: 'LoadVehicle' as const,
      commandId: 'load-once',
      fruitId: 'fruit-1',
    }
    const first = coordinator.begin(cargoCandidate, command)
    const duplicate = coordinator.begin(cargoCandidate, command)
    if (!first.ok || !duplicate.ok) throw new Error('expected two tokens')

    expect(coordinator.commit(first.token)).toEqual({ ok: true, code: 'OK' })
    expect(coordinator.commit(duplicate.token)).toEqual({
      ok: true,
      code: 'OK',
    })
    expect(setCargoMass).toHaveBeenCalledTimes(1)
    expect(setCargoMass).toHaveBeenCalledWith(20)
  })

  it('does not reapply mass when a new coordinator replays cached LoadVehicle success', () => {
    const domain = createDomainWithFruitInCrate()
    const firstSetCargoMass = vi.fn()
    const secondSetCargoMass = vi.fn()
    const cargoCandidate: SpatialCandidate = {
      ...treeCandidate,
      id: 'cargo-sensor',
      kind: 'cargo',
    }
    const command = {
      kind: 'LoadVehicle' as const,
      commandId: 'load-shared',
      fruitId: 'fruit-1',
    }
    const firstCoordinator = new InteractionCoordinator({
      domain,
      getControlOwner: () => 'player',
      getCandidate: () => cargoCandidate,
      setCargoMass: firstSetCargoMass,
    })
    const first = firstCoordinator.begin(cargoCandidate, command)
    if (!first.ok) throw new Error('expected first token')
    expect(firstCoordinator.commit(first.token)).toEqual({
      ok: true,
      code: 'OK',
    })
    expect(firstSetCargoMass).toHaveBeenCalledWith(20)

    const secondCoordinator = new InteractionCoordinator({
      domain,
      getControlOwner: () => 'player',
      getCandidate: () => cargoCandidate,
      setCargoMass: secondSetCargoMass,
    })
    const replay = secondCoordinator.begin(cargoCandidate, command)
    if (!replay.ok) throw new Error('expected replay token')

    expect(secondCoordinator.commit(replay.token)).toEqual({
      ok: true,
      code: 'OK',
    })
    expect(secondSetCargoMass).not.toHaveBeenCalled()
  })

  it('derives 20kg per loaded crate from total vehicle ownership', () => {
    const domain = createDomainWithTwoFruitsInCrate()
    const setCargoMass = vi.fn()
    const cargoCandidate: SpatialCandidate = {
      ...treeCandidate,
      id: 'cargo-sensor',
      kind: 'cargo',
    }
    const coordinator = new InteractionCoordinator({
      domain,
      getControlOwner: () => 'player',
      getCandidate: () => cargoCandidate,
      setCargoMass,
    })

    for (const [index, fruitId] of ['fruit-1', 'fruit-2'].entries()) {
      const begun = coordinator.begin(cargoCandidate, {
        kind: 'LoadVehicle',
        commandId: `load-${index + 1}`,
        fruitId,
      })
      if (!begun.ok) throw new Error('expected load token')
      expect(coordinator.commit(begun.token)).toEqual({ ok: true, code: 'OK' })
    }

    expect(setCargoMass.mock.calls).toEqual([[20], [40]])
    expect(domain.snapshot().owners).toEqual({
      'fruit-1': 'vehicle',
      'fruit-2': 'vehicle',
    })
  })
})

describe('CargoPresentation', () => {
  it('attaches committed debug cargo to the real cargo_slot_01 anchor', () => {
    const cargoAnchor = new Object3D()
    cargoAnchor.name = 'cargo_slot_01'
    const debugCargo = new Object3D()
    const presentation = new CargoPresentation(cargoAnchor)

    presentation.attachCommittedCargo(debugCargo)

    expect(debugCargo.parent).toBe(cargoAnchor)
    expect(debugCargo.userData.debugOnly).toBe(true)
    expect(debugCargo.userData.debugLabel).toContain('DEBUG')
  })

  it('refuses an anchor that is not cargo_slot_01', () => {
    const wrongAnchor = new Object3D()
    wrongAnchor.name = 'cargo_slot_02'

    expect(() => new CargoPresentation(wrongAnchor)).toThrow(/cargo_slot_01/)
  })
})
