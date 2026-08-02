import type { ControlInputOwner } from '../control/ControlAuthority'
import type { JobState, OwnerId } from '../domain/types'

export type ContextualAction =
  | 'accept-job'
  | 'enter-vehicle'
  | 'park-and-exit'
  | 'exit-vehicle'
  | 'pick'
  | 'place-in-basket'
  | 'pack-crate'
  | 'load-crate'
  | 'deliver'

export interface ContextualActionContext {
  readonly controlOwner: ControlInputOwner
  readonly controlsLocked: boolean
  readonly jobState: JobState
  readonly fruitOwner: OwnerId
  readonly nearJobBoard: boolean
  readonly nearVehicleSeat: boolean
  readonly inOrchardParkingZone: boolean
  readonly nearTree: boolean
  readonly nearBasket: boolean
  readonly nearCrate: boolean
  readonly nearCargo: boolean
  readonly nearDelivery: boolean
}

export type ContextualActionHandlers = Readonly<{
  [Action in ContextualAction]: () => boolean | void
}>

export class ContextualActionResolver {
  constructor(private readonly handlers: ContextualActionHandlers) {}

  resolve(context: ContextualActionContext): ContextualAction | null {
    if (context.controlsLocked) return null
    if (context.controlOwner === 'vehicle') {
      return context.jobState === 'en-route-to-orchard'
        && context.inOrchardParkingZone
        ? 'park-and-exit'
        : 'exit-vehicle'
    }
    if (context.jobState === 'idle' && context.nearJobBoard) {
      return 'accept-job'
    }
    if (
      context.jobState === 'returning'
      && context.fruitOwner === 'vehicle'
      && context.nearDelivery
    ) return 'deliver'
    if (
      context.jobState === 'parked-at-orchard'
      && context.fruitOwner === 'tree'
      && context.nearTree
    ) return 'pick'
    if (context.fruitOwner === 'player' && context.nearBasket) {
      return 'place-in-basket'
    }
    if (context.fruitOwner === 'basket' && context.nearCrate) {
      return 'pack-crate'
    }
    if (context.fruitOwner === 'crate' && context.nearCargo) {
      return 'load-crate'
    }
    if (
      (context.jobState === 'preparing'
        || context.jobState === 'vehicle-loaded')
      && context.nearVehicleSeat
    ) return 'enter-vehicle'
    return null
  }

  execute(action: ContextualAction): boolean {
    return this.handlers[action]() !== false
  }
}
