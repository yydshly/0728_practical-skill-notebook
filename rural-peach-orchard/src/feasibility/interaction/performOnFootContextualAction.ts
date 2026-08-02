import type { HarvestCommand } from '../domain/types'
import type { ContextualAction } from './ContextualActionResolver'
import type { InteractionResult } from './InteractionCoordinator'

export type OnFootHarvestAction = Extract<
  ContextualAction,
  'pick'
  | 'place-in-basket'
  | 'pack-crate'
  | 'load-crate'
  | 'deliver'
>

interface ContextualInteractionRequest {
  readonly candidateId: string
  readonly command: HarvestCommand
}

export interface OnFootContextualActionDependencies {
  readonly executeInteraction: (
    candidateId: string,
    command: HarvestCommand,
  ) => InteractionResult | undefined
}

const REQUESTS: Readonly<Record<
  OnFootHarvestAction,
  ContextualInteractionRequest
>> = Object.freeze({
  pick: {
    candidateId: 'tree-sensor',
    command: {
      kind: 'PickFruit',
      commandId: 'pick',
      fruitId: 'fruit-1',
    },
  },
  'place-in-basket': {
    candidateId: 'basket-sensor',
    command: {
      kind: 'MoveFruit',
      commandId: 'basket',
      fruitId: 'fruit-1',
      from: 'player',
      to: 'basket',
    },
  },
  'pack-crate': {
    candidateId: 'crate-sensor',
    command: {
      kind: 'MoveFruit',
      commandId: 'crate',
      fruitId: 'fruit-1',
      from: 'basket',
      to: 'crate',
    },
  },
  'load-crate': {
    candidateId: 'cargo-sensor',
    command: {
      kind: 'LoadVehicle',
      commandId: 'load',
      fruitId: 'fruit-1',
    },
  },
  deliver: {
    candidateId: 'delivery-sensor',
    command: {
      kind: 'DeliverCargo',
      commandId: 'deliver',
      fruitId: 'fruit-1',
    },
  },
})

export function performOnFootContextualAction(
  action: OnFootHarvestAction,
  dependencies: OnFootContextualActionDependencies,
): boolean {
  const request = REQUESTS[action]
  return dependencies.executeInteraction(
    request.candidateId,
    structuredClone(request.command),
  )?.ok === true
}
