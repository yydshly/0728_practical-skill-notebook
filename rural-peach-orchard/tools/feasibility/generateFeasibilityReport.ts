import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

const pointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite(),
}).strict()
const rotationSchema = pointSchema.extend({ w: z.number().finite() }).strict()
const stages = [
  'accept', 'drive', 'park/exit', 'pick', 'basket',
  'crate', 'load', 'return', 'deliver',
] as const
const loopSchema = z.object({
  loop: z.number().int().positive(),
  completedStages: z.array(z.enum(stages)),
  endPose: z.object({
    translation: pointSchema,
    rotation: rotationSchema,
  }).strict(),
  maximumRollDegrees: z.number().finite().nonnegative(),
  maximumPitchDegrees: z.number().finite().nonnegative(),
  backslideDistanceM: z.number().finite().nonnegative(),
  recoveryCount: z.number().int().nonnegative(),
  ownershipViolations: z.number().int().nonnegative(),
  physicsStepTimingsMs: z.array(z.number().finite().nonnegative()).min(1),
}).strict()
const worldSchema = z.object({
  worldAssetId: z.string().min(1),
  treeAssetId: z.string().min(1),
  treeInstanceCount: z.number().int().nonnegative(),
  crateInstanceCount: z.number().int().nonnegative(),
  vehicleDrawBatchCount: z.number().int().nonnegative(),
  visibleDebugPrimitiveCount: z.number().int().nonnegative(),
  omittedOptionalAssetIds: z.array(z.string().min(1)),
  stateVisibility: z.object({
    activeTreeFruit: z.boolean(),
    basketFull: z.boolean(),
    crateFull: z.boolean(),
    cargoLoaded: z.boolean(),
    deliveryComplete: z.boolean(),
  }).strict(),
  drawCalls: z.number().int().nonnegative(),
  triangles: z.number().int().nonnegative(),
}).strict()
const rawSchema = z.object({
  fixture: z.string().min(1),
  completedLoops: z.number().int().nonnegative(),
  loadedAssetIds: z.array(z.string()),
  fallbackCount: z.number().int().nonnegative(),
  recoveryCount: z.number().int().nonnegative(),
  jobState: z.string(),
  ownershipViolations: z.number().int().nonnegative(),
  stageViolationCount: z.number().int().nonnegative(),
  physicsStepP95Ms: z.number().finite().nonnegative(),
  consoleErrors: z.array(z.string()),
  loops: z.array(loopSchema),
  world: worldSchema,
}).strict()

export type RawFeasibilityEvidence = z.infer<typeof rawSchema>

export interface FeasibilityGate {
  readonly id: string
  readonly pass: boolean
  readonly measured: unknown
}

export interface FeasibilityReport extends RawFeasibilityEvidence {
  readonly status: 'pass' | 'fail'
  readonly manualHandling: 'pending'
  readonly computedPhysicsStepP95Ms: number
  readonly gates: readonly FeasibilityGate[]
}

export interface FailedFeasibilityReport {
  readonly status: 'fail'
  readonly manualHandling: 'pending'
  readonly error: string
}

const EXPECTED_ASSETS = Object.freeze([
  'vehicle.electric-tricycle-a',
  'character.farmer-a-base',
])
const EXPECTED_WORLD_ASSET_ID = 'environment.orchard-world-overall-v1'
const EXPECTED_TREE_ASSET_ID = 'environment.peach-tree-overall-v1'
const EXPECTED_STAGE_TRACE = stages.join('>')
const PHYSICS_SUMMARY_TOLERANCE_MS = 0.000_001

// Nearest-rank percentile: sort ascending and select ceil(N * 0.95) - 1.
function percentile95(samples: readonly number[]): number {
  if (samples.length === 0) return 0
  const sorted = [...samples].sort((left, right) => left - right)
  const index = Math.ceil(sorted.length * 0.95) - 1
  return sorted[Math.max(0, index)] ?? 0
}

export function evaluateFeasibility(rawValue: unknown): FeasibilityReport {
  const parsed = rawSchema.safeParse(rawValue)
  if (!parsed.success) {
    throw new Error(`RAW_E2E_INVALID: ${parsed.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    ).join('; ')}`)
  }
  const raw = parsed.data
  const loopEvidencePass = raw.loops.length === 10
    && raw.loops.every((loop, index) => (
      loop.loop === index + 1
      && loop.completedStages.join('>') === EXPECTED_STAGE_TRACE
      && loop.recoveryCount === 0
      && loop.ownershipViolations === 0
      && loop.physicsStepTimingsMs.length > 0
    ))
  const computedPhysicsStepP95Ms = percentile95(
    raw.loops.flatMap((loop) => loop.physicsStepTimingsMs),
  )
  const physicsSummaryMatches = Math.abs(
    raw.physicsStepP95Ms - computedPhysicsStepP95Ms,
  ) <= PHYSICS_SUMMARY_TOLERANCE_MS
  const worldContractPass = (
    raw.world.worldAssetId === EXPECTED_WORLD_ASSET_ID
    && raw.world.treeAssetId === EXPECTED_TREE_ASSET_ID
    && raw.world.treeInstanceCount === 30
    && raw.world.crateInstanceCount === 8
    && raw.world.vehicleDrawBatchCount <= 20
    && raw.world.visibleDebugPrimitiveCount === 0
    && raw.world.omittedOptionalAssetIds.length === 0
  )
  const gates: FeasibilityGate[] = [
    { id: 'fixture-marker', pass: raw.fixture === 'full-loop', measured: raw.fixture },
    { id: 'real-assets', pass: JSON.stringify(raw.loadedAssetIds) === JSON.stringify(EXPECTED_ASSETS), measured: raw.loadedAssetIds },
    { id: 'ten-complete-loops', pass: raw.completedLoops === 10 && loopEvidencePass, measured: raw.completedLoops },
    { id: 'delivered-final-state', pass: raw.jobState === 'delivered', measured: raw.jobState },
    { id: 'no-fallback', pass: raw.fallbackCount === 0, measured: raw.fallbackCount },
    { id: 'no-normal-route-recovery', pass: raw.recoveryCount === 0, measured: raw.recoveryCount },
    { id: 'ownership-invariant', pass: raw.ownershipViolations === 0, measured: raw.ownershipViolations },
    { id: 'stage-order-invariant', pass: raw.stageViolationCount === 0, measured: raw.stageViolationCount },
    { id: 'console-clean', pass: raw.consoleErrors.length === 0, measured: raw.consoleErrors },
    {
      id: 'world-contract',
      pass: worldContractPass,
      measured: {
        worldAssetId: raw.world.worldAssetId,
        treeAssetId: raw.world.treeAssetId,
        treeInstanceCount: raw.world.treeInstanceCount,
        crateInstanceCount: raw.world.crateInstanceCount,
        vehicleDrawBatchCount: raw.world.vehicleDrawBatchCount,
        visibleDebugPrimitiveCount: raw.world.visibleDebugPrimitiveCount,
        omittedOptionalAssetIds: raw.world.omittedOptionalAssetIds,
      },
    },
    {
      id: 'world-final-visibility',
      pass: raw.world.stateVisibility.deliveryComplete,
      measured: raw.world.stateVisibility,
    },
    {
      id: 'world-budgets',
      pass: raw.world.drawCalls <= 200 && raw.world.triangles <= 350_000,
      measured: {
        drawCalls: raw.world.drawCalls,
        triangles: raw.world.triangles,
      },
    },
    {
      id: 'physics-summary-match',
      pass: physicsSummaryMatches,
      measured: {
        reported: raw.physicsStepP95Ms,
        computed: computedPhysicsStepP95Ms,
      },
    },
    { id: 'physics-p95-ms', pass: computedPhysicsStepP95Ms <= 4, measured: computedPhysicsStepP95Ms },
  ]
  return {
    status: gates.every((gate) => gate.pass) ? 'pass' : 'fail',
    manualHandling: 'pending',
    computedPhysicsStepP95Ms,
    gates,
    ...raw,
  }
}

const inputPath = resolve('artifacts/feasibility/raw-e2e.json')
const outputPath = resolve('artifacts/feasibility/feasibility-report.json')

export async function generateFeasibilityReportFile(
  sourcePath: string,
  destinationPath: string,
): Promise<FeasibilityReport | FailedFeasibilityReport> {
  let report: FeasibilityReport | FailedFeasibilityReport
  try {
    const raw: unknown = JSON.parse(await readFile(sourcePath, 'utf8'))
    report = evaluateFeasibility(raw)
  } catch (error) {
    report = {
      status: 'fail',
      manualHandling: 'pending',
      error: error instanceof Error ? error.message : 'RAW_E2E_INVALID',
    }
  }
  await mkdir(dirname(destinationPath), { recursive: true })
  await writeFile(destinationPath, `${JSON.stringify(report, null, 2)}\n`)
  return report
}

async function main(): Promise<void> {
  const report = await generateFeasibilityReportFile(inputPath, outputPath)
  if (report.status !== 'pass') process.exitCode = 1
}

if (process.argv[1]
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  await main()
}
