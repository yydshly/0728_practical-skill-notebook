import type {
  CapacityOwnerId,
  DomainResult,
  FruitId,
  HarvestCommand,
  HarvestDomainFixture,
  HarvestSnapshot,
  JobState,
  OwnerId,
} from './types'

interface MutableHarvestSnapshot {
  jobState: JobState
  owners: Record<FruitId, OwnerId>
  capacities: Record<CapacityOwnerId, number>
}

interface CachedCommandResult {
  readonly fingerprint: string
  readonly result: DomainResult
}

function isolateResult(result: DomainResult): DomainResult {
  return Object.freeze(structuredClone(result))
}

function success(): DomainResult {
  return Object.freeze({ ok: true, code: 'OK' })
}

function failure(code: Exclude<DomainResult['code'], 'OK'>): DomainResult {
  return Object.freeze({ ok: false, code })
}

function commandFingerprint(command: HarvestCommand): string {
  switch (command.kind) {
    case 'PickFruit':
    case 'LoadVehicle':
    case 'DeliverCargo':
      return `${command.kind}\u0000${command.fruitId}`
    case 'MoveFruit':
      return `${command.kind}\u0000${command.fruitId}\u0000${command.from}\u0000${command.to}`
    default:
      return command.kind
  }
}

function hasFruit(
  snapshot: MutableHarvestSnapshot,
  fruitId: FruitId,
): boolean {
  return Object.hasOwn(snapshot.owners, fruitId)
}

function fruitCountAt(
  snapshot: MutableHarvestSnapshot,
  owner: OwnerId,
): number {
  return Object.values(snapshot.owners).filter(
    (candidate) => candidate === owner,
  ).length
}

function hasCapacity(
  snapshot: MutableHarvestSnapshot,
  owner: CapacityOwnerId,
): boolean {
  return fruitCountAt(snapshot, owner) < snapshot.capacities[owner]
}

function requireState(
  snapshot: MutableHarvestSnapshot,
  ...allowed: readonly JobState[]
): DomainResult | undefined {
  if (!allowed.includes(snapshot.jobState)) {
    return failure('INVALID_STATE')
  }
  return undefined
}

function requireFruitOwner(
  snapshot: MutableHarvestSnapshot,
  fruitId: FruitId,
  expected: OwnerId,
): DomainResult | undefined {
  if (!hasFruit(snapshot, fruitId)) return failure('UNKNOWN_FRUIT')
  if (snapshot.owners[fruitId] !== expected) return failure('OWNER_MISMATCH')
  return undefined
}

function transition(
  snapshot: MutableHarvestSnapshot,
  expected: JobState,
  next: JobState,
): DomainResult {
  const invalid = requireState(snapshot, expected)
  if (invalid) return invalid
  snapshot.jobState = next
  return success()
}

function pickFruit(
  snapshot: MutableHarvestSnapshot,
  fruitId: FruitId,
): DomainResult {
  const invalid = requireState(snapshot, 'parked-at-orchard', 'picking')
  if (invalid) return invalid
  const ownershipFailure = requireFruitOwner(snapshot, fruitId, 'tree')
  if (ownershipFailure) return ownershipFailure
  if (!hasCapacity(snapshot, 'player')) {
    return failure('CAPACITY_EXCEEDED')
  }

  snapshot.owners[fruitId] = 'player'
  snapshot.jobState = 'picking'
  return success()
}

function moveFruit(
  snapshot: MutableHarvestSnapshot,
  command: Extract<HarvestCommand, { kind: 'MoveFruit' }>,
): DomainResult {
  const invalid = requireState(snapshot, 'picking')
  if (invalid) return invalid
  const ownershipFailure = requireFruitOwner(
    snapshot,
    command.fruitId,
    command.from,
  )
  if (ownershipFailure) return ownershipFailure

  const isLegalTransfer =
    (command.from === 'player' && command.to === 'basket')
    || (command.from === 'basket' && command.to === 'crate')
  if (!isLegalTransfer) return failure('INVALID_TRANSFER')

  const target = command.to as CapacityOwnerId
  if (!hasCapacity(snapshot, target)) return failure('CAPACITY_EXCEEDED')

  snapshot.owners[command.fruitId] = command.to
  return success()
}

function loadVehicle(
  snapshot: MutableHarvestSnapshot,
  fruitId: FruitId,
): DomainResult {
  const invalid = requireState(snapshot, 'picking', 'vehicle-loaded')
  if (invalid) return invalid
  const ownershipFailure = requireFruitOwner(snapshot, fruitId, 'crate')
  if (ownershipFailure) return ownershipFailure
  if (!hasCapacity(snapshot, 'vehicle')) {
    return failure('CAPACITY_EXCEEDED')
  }

  snapshot.owners[fruitId] = 'vehicle'
  snapshot.jobState = 'vehicle-loaded'
  return success()
}

function deliverCargo(
  snapshot: MutableHarvestSnapshot,
  fruitId: FruitId,
): DomainResult {
  const invalid = requireState(snapshot, 'returning')
  if (invalid) return invalid
  const ownershipFailure = requireFruitOwner(snapshot, fruitId, 'vehicle')
  if (ownershipFailure) return ownershipFailure
  if (!hasCapacity(snapshot, 'delivered')) {
    return failure('CAPACITY_EXCEEDED')
  }

  snapshot.owners[fruitId] = 'delivered'
  if (fruitCountAt(snapshot, 'vehicle') === 0) {
    snapshot.jobState = 'delivered'
  }
  return success()
}

function applyHarvestCommand(
  snapshot: MutableHarvestSnapshot,
  command: HarvestCommand,
): DomainResult {
  switch (command.kind) {
    case 'AcceptJob':
      return transition(snapshot, 'idle', 'accepted')
    case 'PrepareVehicle':
      return transition(snapshot, 'accepted', 'preparing')
    case 'DepartForOrchard':
      return transition(snapshot, 'preparing', 'en-route-to-orchard')
    case 'ParkAtOrchard':
      return transition(
        snapshot,
        'en-route-to-orchard',
        'parked-at-orchard',
      )
    case 'PickFruit':
      return pickFruit(snapshot, command.fruitId)
    case 'MoveFruit':
      return moveFruit(snapshot, command)
    case 'LoadVehicle':
      return loadVehicle(snapshot, command.fruitId)
    case 'StartReturn':
      return transition(snapshot, 'vehicle-loaded', 'returning')
    case 'DeliverCargo':
      return deliverCargo(snapshot, command.fruitId)
  }
}

function validateFixture(fixture: HarvestDomainFixture): void {
  if (new Set(fixture.fruitIds).size !== fixture.fruitIds.length) {
    throw new Error('fruitIds must be unique')
  }
  for (const [owner, capacity] of Object.entries(fixture.capacities)) {
    if (!Number.isInteger(capacity) || capacity < 0) {
      throw new RangeError(`${owner} capacity must be a non-negative integer`)
    }
  }
}

function deepFreezeSnapshot(snapshot: HarvestSnapshot): HarvestSnapshot {
  Object.freeze(snapshot.owners)
  Object.freeze(snapshot.capacities)
  return Object.freeze(snapshot)
}

export class HarvestDomain {
  private readonly resultsByCommandId = new Map<
    string,
    CachedCommandResult
  >()

  private constructor(private current: MutableHarvestSnapshot) {}

  static create(fixture: HarvestDomainFixture): HarvestDomain {
    validateFixture(fixture)
    const owners = Object.fromEntries(
      fixture.fruitIds.map((fruitId) => [fruitId, 'tree'] as const),
    ) as Record<FruitId, OwnerId>

    return new HarvestDomain({
      jobState: 'idle',
      owners,
      capacities: structuredClone(fixture.capacities),
    })
  }

  dispatch(command: HarvestCommand): DomainResult {
    const fingerprint = commandFingerprint(command)
    const cached = this.resultsByCommandId.get(command.commandId)
    if (cached) {
      if (cached.fingerprint !== fingerprint) {
        return failure('COMMAND_ID_CONFLICT')
      }
      return isolateResult(cached.result)
    }

    const candidate = structuredClone(this.current)
    const result = applyHarvestCommand(candidate, command)
    if (result.ok) this.current = candidate
    this.resultsByCommandId.set(command.commandId, {
      fingerprint,
      result: isolateResult(result),
    })
    return isolateResult(result)
  }

  snapshot(): HarvestSnapshot {
    return deepFreezeSnapshot(structuredClone(this.current))
  }
}
