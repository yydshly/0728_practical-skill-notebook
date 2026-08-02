import type { ControlInputOwner } from '../control/ControlAuthority'
import type { TricycleWheelId } from '../vehicle/VehicleTelemetry'

export interface DebugWheelSnapshot {
  readonly id: TricycleWheelId
  readonly grounded: boolean
  readonly suspensionLengthM: number
}

export interface DebugSnapshot {
  readonly speedMps: number
  readonly rollDegrees: number
  readonly pitchDegrees: number
  readonly wheels: readonly DebugWheelSnapshot[]
  readonly currentMassKg: number
  readonly controlOwner: ControlInputOwner
  readonly jobState: string
  readonly lastDomainTransition: string
  readonly physicsStepP95Ms: number
  readonly recoveryCount: number
}

export class DebugPanel {
  constructor(private readonly element: HTMLElement) {}

  update(snapshot: DebugSnapshot): void {
    const wheelLines = snapshot.wheels.map((wheel) => (
      `${wheel.id}: ${wheel.grounded ? 'grounded' : 'airborne'}, `
      + `${wheel.suspensionLengthM.toFixed(3)} m`
    ))
    this.element.textContent = [
      `Speed: ${snapshot.speedMps.toFixed(2)} m/s`,
      `Roll: ${snapshot.rollDegrees.toFixed(2)}°`,
      `Pitch: ${snapshot.pitchDegrees.toFixed(2)}°`,
      ...wheelLines,
      `Mass: ${snapshot.currentMassKg.toFixed(2)} kg`,
      `Control owner: ${snapshot.controlOwner}`,
      `Job state: ${snapshot.jobState}`,
      `Last transition: ${snapshot.lastDomainTransition}`,
      `Physics p95: ${snapshot.physicsStepP95Ms.toFixed(2)} ms`,
      `Recoveries: ${snapshot.recoveryCount}`,
    ].join('\n')
  }
}
