import type { Object3D } from 'three'

const CARGO_ANCHOR_NAME = 'cargo_slot_01'

export class CargoPresentation {
  constructor(private readonly cargoAnchor: Object3D) {
    if (cargoAnchor.name !== CARGO_ANCHOR_NAME) {
      throw new Error(`cargo anchor must be ${CARGO_ANCHOR_NAME}`)
    }
  }

  attachCommittedCargo(debugCargo: Object3D): void {
    debugCargo.userData.debugOnly = true
    debugCargo.userData.debugLabel = 'DEBUG committed cargo'
    this.cargoAnchor.add(debugCargo)
  }
}
