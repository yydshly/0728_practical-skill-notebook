import type { ControlInputOwner } from '../control/ControlAuthority'
import type { HarvestDomain } from '../domain/HarvestDomain'
import type { DomainResult, HarvestCommand } from '../domain/types'

export type SpatialCandidateKind =
  | 'tree'
  | 'basket'
  | 'crate'
  | 'cargo'
  | 'delivery'

export interface SpatialCandidate {
  readonly id: string
  readonly kind: SpatialCandidateKind
  readonly inside: boolean
  readonly distanceM: number
  readonly facingDegrees: number
}

const interactionTokenBrand: unique symbol = Symbol('InteractionToken')

export type InteractionToken = Readonly<{
  readonly id: number
  readonly [interactionTokenBrand]: true
}>

export type InteractionFailureCode =
  | 'CONTROL_OWNER_INVALID'
  | 'CANDIDATE_COMMAND_MISMATCH'
  | 'CONTEXT_INVALID'
  | 'TOKEN_INVALID'

export type BeginInteractionResult =
  | Readonly<{ ok: true; code: 'OK'; token: InteractionToken }>
  | Readonly<{
      ok: false
      code: Exclude<InteractionFailureCode, 'TOKEN_INVALID'>
    }>

export type InteractionResult =
  | DomainResult
  | Readonly<{
      ok: false
      code: InteractionFailureCode
    }>

export interface InteractionCoordinatorDependencies {
  readonly domain: HarvestDomain
  readonly getControlOwner: () => ControlInputOwner
  readonly getCandidate: (id: string) => SpatialCandidate | undefined
  readonly setCargoMass: (cargoKg: number) => void
}

interface PendingInteraction {
  readonly candidateId: string
  readonly candidateKind: SpatialCandidateKind
  readonly command: HarvestCommand
}

function countVehicleOwnedFruit(
  owners: Readonly<Record<string, string>>,
): number {
  return Object.values(owners).filter((owner) => owner === 'vehicle').length
}

function candidateMatchesCommand(
  candidate: SpatialCandidate,
  command: HarvestCommand,
): boolean {
  switch (command.kind) {
    case 'PickFruit':
      return candidate.kind === 'tree'
    case 'MoveFruit':
      return (command.to === 'basket' && candidate.kind === 'basket')
        || (command.to === 'crate' && candidate.kind === 'crate')
    case 'LoadVehicle':
      return candidate.kind === 'cargo'
    case 'DeliverCargo':
      return candidate.kind === 'delivery'
    default:
      return false
  }
}

function candidateIsUsable(candidate: SpatialCandidate): boolean {
  return candidate.inside
    && Number.isFinite(candidate.distanceM)
    && candidate.distanceM >= 0
    && candidate.distanceM <= 1.2
    && Number.isFinite(candidate.facingDegrees)
    && candidate.facingDegrees >= 0
    && candidate.facingDegrees <= 65
}

function candidateMatchesPending(
  candidate: SpatialCandidate | undefined,
  pending: Pick<PendingInteraction, 'candidateId' | 'candidateKind'>,
): candidate is SpatialCandidate {
  return candidate !== undefined
    && candidate.id === pending.candidateId
    && candidate.kind === pending.candidateKind
    && candidateIsUsable(candidate)
}

export class InteractionCoordinator {
  private readonly pending = new Map<InteractionToken, PendingInteraction>()
  private nextTokenId = 1

  constructor(
    private readonly dependencies: InteractionCoordinatorDependencies,
  ) {}

  execute(
    candidateId: string,
    command: HarvestCommand,
  ): InteractionResult | undefined {
    const candidate = this.dependencies.getCandidate(candidateId)
    if (!candidate) return undefined
    const begun = this.begin(candidate, command)
    return begun.ok ? this.commit(begun.token) : begun
  }

  begin(
    candidate: SpatialCandidate,
    command: HarvestCommand,
  ): BeginInteractionResult {
    if (this.dependencies.getControlOwner() !== 'player') {
      return { ok: false, code: 'CONTROL_OWNER_INVALID' }
    }
    if (!candidateMatchesCommand(candidate, command)) {
      return { ok: false, code: 'CANDIDATE_COMMAND_MISMATCH' }
    }
    if (!candidateIsUsable(candidate)) {
      return { ok: false, code: 'CONTEXT_INVALID' }
    }
    const liveCandidate = this.dependencies.getCandidate(candidate.id)
    if (!candidateMatchesPending(liveCandidate, {
      candidateId: candidate.id,
      candidateKind: candidate.kind,
    })) {
      return { ok: false, code: 'CONTEXT_INVALID' }
    }

    const token: InteractionToken = Object.freeze({
      id: this.nextTokenId,
      [interactionTokenBrand]: true as const,
    })
    this.nextTokenId += 1
    this.pending.set(token, {
      candidateId: candidate.id,
      candidateKind: candidate.kind,
      command: structuredClone(command),
    })
    return { ok: true, code: 'OK', token }
  }

  commit(token: InteractionToken): InteractionResult {
    const pending = this.pending.get(token)
    if (!pending) return { ok: false, code: 'TOKEN_INVALID' }
    this.pending.delete(token)
    if (this.dependencies.getControlOwner() !== 'player') {
      return { ok: false, code: 'CONTROL_OWNER_INVALID' }
    }
    const candidate = this.dependencies.getCandidate(pending.candidateId)
    if (!candidateMatchesPending(candidate, pending)) {
      return { ok: false, code: 'CONTEXT_INVALID' }
    }

    const beforeLoad = pending.command.kind === 'LoadVehicle'
      ? this.dependencies.domain.snapshot()
      : undefined
    const result = this.dependencies.domain.dispatch(pending.command)
    if (result.ok && beforeLoad) {
      const afterLoad = this.dependencies.domain.snapshot()
      const beforeVehicleCount = countVehicleOwnedFruit(beforeLoad.owners)
      const afterVehicleCount = countVehicleOwnedFruit(afterLoad.owners)
      if (afterVehicleCount > beforeVehicleCount) {
        this.dependencies.setCargoMass(afterVehicleCount * 20)
      }
    }
    return result
  }

  cancel(token: InteractionToken): void {
    this.pending.delete(token)
  }
}
