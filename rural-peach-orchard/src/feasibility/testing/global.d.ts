import type { ScriptedStage } from './ScriptedInput'

interface FeasibilityPoint {
  readonly x: number
  readonly y: number
  readonly z: number
}

interface FeasibilityLoopEvidence {
  readonly loop: number
  readonly completedStages: readonly ScriptedStage[]
  readonly endPose: Readonly<{
    readonly translation: FeasibilityPoint
    readonly rotation: FeasibilityPoint & Readonly<{ w: number }>
  }>
  readonly maximumRollDegrees: number
  readonly maximumPitchDegrees: number
  readonly backslideDistanceM: number
  readonly recoveryCount: number
  readonly ownershipViolations: number
  readonly physicsStepTimingsMs: readonly number[]
}

interface FeasibilityWorldEvidence {
  readonly worldAssetId: 'environment.orchard-world-overall-v1'
  readonly treeAssetId: 'environment.peach-tree-overall-v1'
  readonly treeInstanceCount: number
  readonly crateInstanceCount: number
  readonly vehicleDrawBatchCount: number
  readonly visibleDebugPrimitiveCount: number
  readonly omittedOptionalAssetIds: readonly string[]
  readonly stateVisibility: Readonly<{
    readonly activeTreeFruit: boolean
    readonly basketFull: boolean
    readonly crateFull: boolean
    readonly cargoLoaded: boolean
    readonly deliveryComplete: boolean
  }>
  readonly drawCalls: number
  readonly triangles: number
}

declare global {
  interface Window {
    readonly __FEASIBILITY__: Readonly<{
      snapshot(): Readonly<{
        fixture: 'full-loop'
        completedLoops: number
        loadedAssetIds: readonly string[]
        fallbackCount: number
        recoveryCount: number
        jobState: string
        ownershipViolations: number
        stageViolationCount: number
        physicsStepP95Ms: number
        consoleErrors: readonly string[]
        loops: readonly FeasibilityLoopEvidence[]
        world: Readonly<FeasibilityWorldEvidence>
      }>
    }>
  }
}

export {}
