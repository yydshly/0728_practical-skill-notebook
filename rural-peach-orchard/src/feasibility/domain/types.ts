export type FruitId = string

export type OwnerId =
  | 'tree'
  | 'player'
  | 'basket'
  | 'crate'
  | 'vehicle'
  | 'delivered'

export type CapacityOwnerId = Exclude<OwnerId, 'tree'>

export type JobState =
  | 'idle'
  | 'accepted'
  | 'preparing'
  | 'en-route-to-orchard'
  | 'parked-at-orchard'
  | 'picking'
  | 'vehicle-loaded'
  | 'returning'
  | 'delivered'

export type HarvestCapacities = Readonly<Record<CapacityOwnerId, number>>

export interface HarvestSnapshot {
  readonly jobState: JobState
  readonly owners: Readonly<Record<FruitId, OwnerId>>
  readonly capacities: HarvestCapacities
}

interface CommandBase {
  readonly commandId: string
}

export interface AcceptJobCommand extends CommandBase {
  readonly kind: 'AcceptJob'
}

export interface PrepareVehicleCommand extends CommandBase {
  readonly kind: 'PrepareVehicle'
}

export interface DepartForOrchardCommand extends CommandBase {
  readonly kind: 'DepartForOrchard'
}

export interface ParkAtOrchardCommand extends CommandBase {
  readonly kind: 'ParkAtOrchard'
}

export interface PickFruitCommand extends CommandBase {
  readonly kind: 'PickFruit'
  readonly fruitId: FruitId
}

export interface MoveFruitCommand extends CommandBase {
  readonly kind: 'MoveFruit'
  readonly fruitId: FruitId
  readonly from: OwnerId
  readonly to: OwnerId
}

export interface LoadVehicleCommand extends CommandBase {
  readonly kind: 'LoadVehicle'
  readonly fruitId: FruitId
}

export interface StartReturnCommand extends CommandBase {
  readonly kind: 'StartReturn'
}

export interface DeliverCargoCommand extends CommandBase {
  readonly kind: 'DeliverCargo'
  readonly fruitId: FruitId
}

export type HarvestCommand =
  | AcceptJobCommand
  | PrepareVehicleCommand
  | DepartForOrchardCommand
  | ParkAtOrchardCommand
  | PickFruitCommand
  | MoveFruitCommand
  | LoadVehicleCommand
  | StartReturnCommand
  | DeliverCargoCommand

export type DomainResultCode =
  | 'OK'
  | 'INVALID_STATE'
  | 'UNKNOWN_FRUIT'
  | 'OWNER_MISMATCH'
  | 'INVALID_TRANSFER'
  | 'CAPACITY_EXCEEDED'
  | 'COMMAND_ID_CONFLICT'

export type DomainResult =
  | Readonly<{ ok: true; code: 'OK' }>
  | Readonly<{
      ok: false
      code: Exclude<DomainResultCode, 'OK'>
    }>

export interface HarvestDomainFixture {
  readonly fruitIds: readonly FruitId[]
  readonly capacities: HarvestCapacities
}
