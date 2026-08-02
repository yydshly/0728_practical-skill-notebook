import { createHash } from 'node:crypto'
import { access, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { NodeIO, type Document } from '@gltf-transform/core'
import { expect, it } from 'vitest'
import type {
  AssetManifest,
  AssetManifestEntry,
  AssetSourceRecord,
} from '../../../src/assets/types'

interface LicensedBaseSourceRecord {
  sourceId: string
  assetId: string
  sourceUrl: string
  license: string
  licenseFile: string
  sourceSha256: string
  generatedBaseBlendSha256: string
  generatedBaseAudit: {
    evaluatedVisibleHeightMeters: number
    objectScales: { body: number; eyes: number; rig: number }
    boneCount: number
  }
}

interface FarmerBaseExportMetrics {
  assetId: string
  sourceBlendSha256: string
  runtimeGlbSha256: string
  runtimeEvaluatedVisibleHeightMeters: number
  boneCount: number
  animationCount: number
}

interface FarmerBaseContracts {
  asset: AssetManifestEntry
  source: AssetSourceRecord
  audit: LicensedBaseSourceRecord
  exportMetrics: FarmerBaseExportMetrics
}

const approvedBlendSha256 =
  'ea7fae26bdbd0b17565fdf2bc46b989c9338b06058231a9b27976bc0e070358d'
const sourceBlendPath =
  'resources/blender/vendor/farmer-a-base/farmer-a-base.blend'
const runtimeGlbPath = 'public/assets/character/farmer-a-base/visual.glb'

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(resolve(path), 'utf8')) as T
}

async function sha256(path: string): Promise<string> {
  return createHash('sha256')
    .update(await readFile(resolve(path)))
    .digest('hex')
}

async function readContracts(): Promise<FarmerBaseContracts> {
  const manifest = await readJson<AssetManifest>(
    'public/assets/asset-manifest.json',
  )
  const sources = await readJson<AssetSourceRecord[]>(
    'public/assets/asset-sources.json',
  )
  const asset = manifest.assets.find(
    (entry) => entry.assetId === 'character.farmer-a-base',
  )
  expect(asset).toBeDefined()
  const source = sources.find((entry) => entry.sourceId === asset!.sourceId)
  expect(source).toBeDefined()

  return {
    asset: asset!,
    source: source!,
    audit: await readJson<LicensedBaseSourceRecord>(
      'docs/assets/licenses/farmer-a-base/source-record.json',
    ),
    exportMetrics: await readJson<FarmerBaseExportMetrics>(
      'public/assets/character/farmer-a-base/export-metrics.json',
    ),
  }
}

async function readRuntimeGlb(): Promise<Document> {
  return new NodeIO().read(resolve(runtimeGlbPath))
}

it('binds the manifest, licensed provenance, approved Blend, and export hashes', async () => {
  const { asset, source, audit, exportMetrics } = await readContracts()
  const sourceBlendSha256 = await sha256(sourceBlendPath)
  const runtimeGlbSha256 = await sha256(runtimeGlbPath)

  expect(source.acquisition).toBe('licensed-base')
  expect(audit.assetId).toBe(asset.assetId)
  expect(audit.sourceId).toBe(asset.sourceId)
  expect(source.sourceUrl).toBe(audit.sourceUrl)
  expect(source.sourceUrl).toMatch(/^https:\/\//)
  expect(source.license).toBe(audit.license)
  expect(source.licenseFile).toBe(audit.licenseFile)
  await expect(access(resolve(audit.licenseFile))).resolves.toBeUndefined()
  expect(sourceBlendSha256).toBe(approvedBlendSha256)
  expect(audit.sourceSha256).toBe(sourceBlendSha256)
  expect(audit.generatedBaseBlendSha256).toBe(sourceBlendSha256)
  expect(exportMetrics.sourceBlendSha256).toBe(sourceBlendSha256)
  expect(exportMetrics.runtimeGlbSha256).toBe(runtimeGlbSha256)
  expect(exportMetrics.assetId).toBe(asset.assetId)
  expect(audit.generatedBaseAudit.evaluatedVisibleHeightMeters)
    .toBeCloseTo(1.68, 3)
  expect(audit.generatedBaseAudit.objectScales)
    .toEqual({ body: 1, eyes: 1, rig: 1 })
  expect(audit.generatedBaseAudit.boneCount).toBe(53)
})

it('delivers the required nodes, skinning attributes, textures, and no animations', async () => {
  const { exportMetrics } = await readContracts()
  const root = (await readRuntimeGlb()).getRoot()
  const nodeNames = root.listNodes().map((node) => node.getName())

  expect(nodeNames).toEqual(expect.arrayContaining(['root', 'pelvis', 'head']))
  expect(root.listAnimations()).toHaveLength(0)
  expect(exportMetrics.animationCount).toBe(0)
  expect(root.listSkins()).toHaveLength(1)
  expect(root.listSkins()[0]!.listJoints()).toHaveLength(53)
  expect(exportMetrics.boneCount).toBe(53)

  const skinnedPrimitives = root.listMeshes().flatMap(
    (mesh) => mesh.listPrimitives(),
  )
  expect(skinnedPrimitives.length).toBeGreaterThan(0)
  for (const primitive of skinnedPrimitives) {
    expect(primitive.getAttribute('JOINTS_0')).not.toBeNull()
    expect(primitive.getAttribute('WEIGHTS_0')).not.toBeNull()
  }
  for (const material of root.listMaterials()) {
    expect(material.getBaseColorTexture()).not.toBeNull()
  }
})

it('measures the approved visible height from the delivered runtime GLB', async () => {
  const { exportMetrics } = await readContracts()
  const root = (await readRuntimeGlb()).getRoot()
  const bodyNode = root.listNodes().find(
    (node) => node.getName() === 'farmer_a_base_body',
  )

  expect(bodyNode).toBeDefined()
  expect(bodyNode!.getTranslation()).toEqual([0, 0, 0])
  expect(bodyNode!.getRotation()).toEqual([0, 0, 0, 1])
  expect(bodyNode!.getScale()).toEqual([1, 1, 1])
  const bodyPositions = bodyNode!.getMesh()!.listPrimitives().map(
    (primitive) => primitive.getAttribute('POSITION')!,
  )
  const runtimeHeight = Math.max(
    ...bodyPositions.map((position) => position.getMax([])[1]!),
  ) - Math.min(
    ...bodyPositions.map((position) => position.getMin([])[1]!),
  )

  expect(Math.abs(runtimeHeight - 1.68)).toBeLessThanOrEqual(0.005)
  expect(exportMetrics.runtimeEvaluatedVisibleHeightMeters)
    .toBeCloseTo(runtimeHeight, 6)
})
