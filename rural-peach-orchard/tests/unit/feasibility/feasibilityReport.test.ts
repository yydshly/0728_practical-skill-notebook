import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  evaluateFeasibility,
  generateFeasibilityReportFile,
  type RawFeasibilityEvidence,
} from '../../../tools/feasibility/generateFeasibilityReport'

const PASSING_WORLD_EVIDENCE = {
  worldAssetId: 'environment.orchard-world-overall-v1',
  treeAssetId: 'environment.peach-tree-overall-v1',
  treeInstanceCount: 30,
  crateInstanceCount: 8,
  vehicleDrawBatchCount: 16,
  visibleDebugPrimitiveCount: 0,
  omittedOptionalAssetIds: [],
  stateVisibility: {
    activeTreeFruit: false,
    basketFull: false,
    crateFull: false,
    cargoLoaded: false,
    deliveryComplete: true,
  },
  drawCalls: 48,
  triangles: 183_101,
}

function passingRaw(): RawFeasibilityEvidence {
  return {
    fixture: 'full-loop',
    completedLoops: 10,
    loadedAssetIds: [
      'vehicle.electric-tricycle-a',
      'character.farmer-a-base',
    ],
    fallbackCount: 0,
    recoveryCount: 0,
    jobState: 'delivered',
    ownershipViolations: 0,
    stageViolationCount: 0,
    physicsStepP95Ms: 0.3,
    consoleErrors: [],
    world: structuredClone(PASSING_WORLD_EVIDENCE),
    loops: Array.from({ length: 10 }, (_, index) => ({
      loop: index + 1,
      completedStages: [
        'accept', 'drive', 'park/exit', 'pick', 'basket',
        'crate', 'load', 'return', 'deliver',
      ],
      endPose: {
        translation: { x: 0, y: 0.6, z: -7 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
      },
      maximumRollDegrees: 12,
      maximumPitchDegrees: 8,
      backslideDistanceM: 0.1,
      recoveryCount: 0,
      ownershipViolations: 0,
      physicsStepTimingsMs: [0.2, 0.3],
    })),
  }
}

describe('feasibility report fail-closed gates', () => {
  it('passes only the complete measured ten-loop evidence', () => {
    const report = evaluateFeasibility(passingRaw())

    expect(report.status).toBe('pass')
    expect(report.manualHandling).toBe('pending')
    expect(report.gates.every((gate) => gate.pass)).toBe(true)
  })

  it('fails when the visible world exceeds its route-view budgets', () => {
    const raw = passingRaw()
    raw.world.drawCalls = 201
    raw.world.triangles = 350_001

    const report = evaluateFeasibility(raw)

    expect(report.status).toBe('fail')
    expect(report.gates.find((gate) => gate.id === 'world-budgets'))
      .toMatchObject({ pass: false })
  })

  it('fails when the overall scene contract is incomplete or debug leaks', () => {
    const raw = passingRaw()
    raw.world.treeInstanceCount = 29
    raw.world.visibleDebugPrimitiveCount = 1
    raw.world.stateVisibility.deliveryComplete = false

    const report = evaluateFeasibility(raw)

    expect(report.status).toBe('fail')
    expect(report.gates.find((gate) => gate.id === 'world-contract'))
      .toMatchObject({ pass: false })
    expect(report.gates.find((gate) => gate.id === 'world-final-visibility'))
      .toMatchObject({ pass: false })
  })

  it.each([
    ['nine loops', { completedLoops: 9 }],
    ['fallback asset', { fallbackCount: 1 }],
    ['normal-route recovery', { recoveryCount: 1 }],
    ['ownership violation', { ownershipViolations: 1 }],
    ['stage-order violation', { stageViolationCount: 1 }],
    ['console error', { consoleErrors: ['WebGL failure'] }],
    ['wrong final state', { jobState: 'returning' }],
    ['wrong fixture', { fixture: 'other' }],
    ['wrong assets', { loadedAssetIds: ['vehicle.electric-tricycle-a'] }],
  ])('fails on %s', (_name, mutation) => {
    expect(evaluateFeasibility({ ...passingRaw(), ...mutation }).status)
      .toBe('fail')
  })

  it('rejects missing telemetry instead of manufacturing defaults', () => {
    expect(() => evaluateFeasibility({ completedLoops: 10 }))
      .toThrow('RAW_E2E_INVALID')
  })

  it('fails when any per-loop trace or metric violates the route contract', () => {
    const raw = passingRaw()
    raw.loops[4] = {
      ...raw.loops[4]!,
      completedStages: ['accept', 'deliver'],
      recoveryCount: 1,
    }

    expect(evaluateFeasibility(raw).status).toBe('fail')
  })

  it('recomputes nearest-rank p95 from every loop sample', () => {
    const raw = passingRaw()
    raw.physicsStepP95Ms = 0.3
    raw.loops[9] = {
      ...raw.loops[9]!,
      physicsStepTimingsMs: [8, 8],
    }

    const report = evaluateFeasibility(raw)

    expect(report.status).toBe('fail')
    expect(report.computedPhysicsStepP95Ms).toBe(8)
    expect(report.gates.find((gate) => gate.id === 'physics-p95-ms'))
      .toMatchObject({ pass: false, measured: 8 })
    expect(report.gates.find((gate) => gate.id === 'physics-summary-match'))
      .toMatchObject({ pass: false })
  })

  it('fails closed and writes failure evidence when the raw file is absent', async () => {
    const nonce = `${process.pid}-${Date.now()}-${Math.random()}`
    const inputPath = join(tmpdir(), `missing-feasibility-${nonce}.json`)
    const outputPath = join(tmpdir(), `feasibility-report-${nonce}.json`)

    const report = await generateFeasibilityReportFile(inputPath, outputPath)
    const written: unknown = JSON.parse(await readFile(outputPath, 'utf8'))

    expect(report).toMatchObject({ status: 'fail', manualHandling: 'pending' })
    expect(written).toEqual(report)
    expect(report).toHaveProperty('error')
  })
})
