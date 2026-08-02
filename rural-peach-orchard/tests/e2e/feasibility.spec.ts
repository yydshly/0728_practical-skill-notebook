import { access, mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { evaluateFeasibility } from '../../tools/feasibility/generateFeasibilityReport'
import { ORCHARD_WORLD_DEFINITION } from '../../src/feasibility/world/orchardWorldDefinition'

const RAW_EVIDENCE_PATH = resolve(
  'artifacts/feasibility/raw-e2e.json',
)
const FULL_LOOP_COMPLETION_TIMEOUT_MS = 60_000

function uniqueErrors(errors: readonly string[]): string[] {
  return [...new Set(errors)]
}

test.beforeAll(async () => {
  await rm(RAW_EVIDENCE_PATH, { force: true })
})

test('keeps launch failures visible and captures nonfatal fixture errors', async ({ page }) => {
  await expect(access(RAW_EVIDENCE_PATH)).rejects.toThrow()
  await page.route('**/feasibility/runtime-assets.json', (route) => (
    route.fulfill({ status: 503, body: 'fixture asset outage' })
  ))

  await page.goto('/feasibility')

  await expect(page.getByRole('status')).toContainText('桃园场景加载失败：')

  await page.unroute('**/feasibility/runtime-assets.json')
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto('/feasibility?fixture=full-loop&fixtureError=nonfatal')
  await page.waitForFunction(() => (
    window.__FEASIBILITY__?.snapshot().consoleErrors.length > 0
  ))
  const snapshot = await page.evaluate(() => window.__FEASIBILITY__.snapshot())
  const errors = uniqueErrors([...snapshot.consoleErrors, ...pageErrors])
  const report = evaluateFeasibility({ ...snapshot, consoleErrors: errors })

  expect(errors).toContain('FIXTURE_NONFATAL_ERROR')
  expect(report.gates.find((gate) => gate.id === 'console-clean'))
    .toMatchObject({ pass: false })
})

test('fails closed when the critical orchard world GLB is unavailable', async ({ page }) => {
  await page.route(
    '**/assets/environment/orchard-world-overall-v1/visual.glb',
    (route) => route.fulfill({ status: 404 }),
  )

  await page.goto('/feasibility')

  await expect(page.getByRole('status')).toContainText(
    'environment.orchard-world-overall-v1:visual',
  )
  await expect(page.locator('canvas')).toHaveCount(1)
})

test('completes ten real-asset harvest loops without fallback or recovery', async ({ page }) => {
  test.setTimeout(120_000)
  await rm(RAW_EVIDENCE_PATH, { force: true })
  await expect(access(RAW_EVIDENCE_PATH)).rejects.toThrow()
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.goto('/feasibility?fixture=full-loop')
  await page.waitForFunction(() => window.__FEASIBILITY__ !== undefined)
  await expect.poll(
    () => page.evaluate(() => window.__FEASIBILITY__.snapshot()),
    { timeout: FULL_LOOP_COMPLETION_TIMEOUT_MS },
  ).toMatchObject({ completedLoops: 10 })
  await page.getByTestId('fixture-complete').waitFor()
  const snapshot = await page.evaluate(() => window.__FEASIBILITY__.snapshot())

  expect(snapshot.fixture).toBe('full-loop')
  expect(snapshot.completedLoops).toBe(10)
  expect(snapshot.loops).toHaveLength(10)
  expect(snapshot.loops.every((loop) => loop.completedStages.join('>') === (
    'accept>drive>park/exit>pick>basket>crate>load>return>deliver'
  ))).toBe(true)
  const delivery = ORCHARD_WORLD_DEFINITION.route.returning.at(-1)!
  expect(snapshot.loops.every((loop) => Math.hypot(
    loop.endPose.translation.x - delivery.x,
    loop.endPose.translation.z - delivery.z,
  ) <= 0.8)).toBe(true)
  expect(snapshot.loadedAssetIds).toEqual([
    'vehicle.electric-tricycle-a',
    'character.farmer-a-base',
  ])
  expect(snapshot.fallbackCount).toBe(0)
  expect(snapshot.recoveryCount).toBe(0)
  expect(snapshot.jobState).toBe('delivered')
  expect(snapshot.ownershipViolations).toBe(0)
  expect(snapshot.stageViolationCount).toBe(0)
  expect(snapshot.physicsStepP95Ms).toBeLessThanOrEqual(4)
  expect(snapshot.consoleErrors).toEqual([])
  expect(snapshot.world).toMatchObject({
    worldAssetId: 'environment.orchard-world-overall-v1',
    treeAssetId: 'environment.peach-tree-overall-v1',
    treeInstanceCount: 30,
    crateInstanceCount: 8,
    visibleDebugPrimitiveCount: 0,
    omittedOptionalAssetIds: [],
  })
  expect(snapshot.world.vehicleDrawBatchCount).toBeLessThanOrEqual(20)
  expect(snapshot.world.stateVisibility.deliveryComplete).toBe(true)
  expect(snapshot.world.drawCalls).toBeLessThanOrEqual(200)
  expect(snapshot.world.triangles).toBeLessThanOrEqual(350_000)
  const errors = uniqueErrors([
    ...snapshot.consoleErrors,
    ...consoleErrors,
    ...pageErrors,
  ])
  expect(errors).toEqual([])

  const before = await page.evaluate(() => window.__FEASIBILITY__.snapshot())
  await page.evaluate(() => {
    const exposed = window.__FEASIBILITY__.snapshot() as unknown as {
      completedLoops: number
      world: {
        omittedOptionalAssetIds: string[]
        stateVisibility: { deliveryComplete: boolean }
      }
    }
    exposed.completedLoops = 999
    exposed.world.omittedOptionalAssetIds.push('fabricated.optional-asset')
    exposed.world.stateVisibility.deliveryComplete = false
  })
  const after = await page.evaluate(() => window.__FEASIBILITY__.snapshot())
  expect(after).toEqual(before)

  await mkdir(dirname(RAW_EVIDENCE_PATH), { recursive: true })
  await writeFile(
    RAW_EVIDENCE_PATH,
    `${JSON.stringify({ ...snapshot, consoleErrors: errors }, null, 2)}\n`,
  )
})
