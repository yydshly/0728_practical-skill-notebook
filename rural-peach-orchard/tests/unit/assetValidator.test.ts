import { spawnSync } from 'node:child_process'
import { Document, NodeIO } from '@gltf-transform/core'
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import type {
  AssetManifest,
  AssetSourceRecord,
} from '../../src/assets/types'
import type { RuntimeAssetContract } from '../../src/feasibility/assets/runtimeAssetContract'
import {
  collectAnimationEventNames,
  validateAssetSet,
} from '../../tools/assets/validateAssets'

const fixtureRoot = resolve('tests/fixtures/assets')
const temporaryDirectories: string[] = []

it('reads named object events from GLB animation extras while preserving string compatibility', () => {
  expect(collectAnimationEventNames([
    'legacy_event',
    { name: 'fruit_contact', normalizedTime: 0.58 },
    { name: '', normalizedTime: 0.2 },
    { normalizedTime: 0.4 },
  ])).toEqual(new Set(['legacy_event', 'fruit_contact']))
})

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T
}

async function validContracts(): Promise<{
  manifest: AssetManifest
  sources: AssetSourceRecord[]
}> {
  return {
    manifest: await readJson<AssetManifest>(
      join(fixtureRoot, 'valid-minimal/manifest.json'),
    ),
    sources: await readJson<AssetSourceRecord[]>(
      join(fixtureRoot, 'valid-minimal/sources.json'),
    ),
  }
}

async function multiLodContracts(): Promise<{
  manifest: AssetManifest
  sources: AssetSourceRecord[]
}> {
  return {
    manifest: await readJson<AssetManifest>(
      join(fixtureRoot, 'multi-lod/manifest.json'),
    ),
    sources: await readJson<AssetSourceRecord[]>(
      join(fixtureRoot, 'multi-lod/sources.json'),
    ),
  }
}

async function registeredTricycleContracts(): Promise<{
  manifest: AssetManifest
  sources: AssetSourceRecord[]
  runtimeContract: RuntimeAssetContract
}> {
  return {
    manifest: await readJson<AssetManifest>('public/assets/asset-manifest.json'),
    sources: await readJson<AssetSourceRecord[]>('public/assets/asset-sources.json'),
    runtimeContract: await readJson<RuntimeAssetContract>(
      'public/feasibility/runtime-assets.json',
    ),
  }
}

async function writeValidationCase(
  manifest: AssetManifest,
  sources: AssetSourceRecord[],
  sourcesFilename = 'sources.json',
): Promise<{ directory: string; manifestPath: string; sourcesPath: string }> {
  const directory = await mkdtemp(join(tmpdir(), 'orchard-asset-validator-'))
  temporaryDirectories.push(directory)
  const manifestPath = join(directory, 'manifest.json')
  const sourcesPath = join(directory, sourcesFilename)
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  await writeFile(sourcesPath, `${JSON.stringify(sources, null, 2)}\n`)
  return { directory, manifestPath, sourcesPath }
}

async function writeRuntimeContractCase(
  runtimeContract: RuntimeAssetContract,
): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'orchard-runtime-contract-'))
  temporaryDirectories.push(directory)
  const path = join(directory, 'runtime-assets.json')
  await writeFile(path, `${JSON.stringify(runtimeContract, null, 2)}\n`)
  return path
}

async function writeRequiredRootBudgetVisual(
  triangleCounts: readonly number[],
  options: {
    sharedMeshInstancesInFirstRoot?: number
    addUnownedSibling?: boolean
    nestSecondRootUnderFirst?: boolean
  } = {},
): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'orchard-required-roots-'))
  temporaryDirectories.push(directory)
  const visualPath = join(directory, 'visual.glb')
  const document = new Document()
  const buffer = document.createBuffer('required-root-buffer')
  const scene = document.createScene('required-root-scene')
  const roots: ReturnType<Document['createNode']>[] = []

  triangleCounts.forEach((triangleCount, rootIndex) => {
    const positions = new Float32Array(triangleCount * 9)
    const indices = new Uint16Array(triangleCount * 3)
    for (let triangle = 0; triangle < triangleCount; triangle += 1) {
      const vertexOffset = triangle * 9
      const indexOffset = triangle * 3
      positions.set([0, 0, 0, 1, 0, 0, 0, 1, 0], vertexOffset)
      indices.set([indexOffset, indexOffset + 1, indexOffset + 2], indexOffset)
    }
    const suffix = String.fromCharCode('a'.charCodeAt(0) + rootIndex)
    const rootName = `peach_tree_variant_${suffix}`
    const positionAccessor = document
      .createAccessor(`${rootName}-positions`, buffer)
      .setType('VEC3')
      .setArray(positions)
    const indexAccessor = document
      .createAccessor(`${rootName}-indices`, buffer)
      .setType('SCALAR')
      .setArray(indices)
    const primitive = document.createPrimitive()
      .setAttribute('POSITION', positionAccessor)
      .setIndices(indexAccessor)
    const mesh = document.createMesh(`${rootName}-mesh`).addPrimitive(primitive)
    const root = document.createNode(rootName)
    const instanceCount = rootIndex === 0
      ? options.sharedMeshInstancesInFirstRoot ?? 1
      : 1
    for (let instance = 0; instance < instanceCount; instance += 1) {
      root.addChild(
        document.createNode(`${rootName}-geometry-${instance + 1}`).setMesh(mesh),
      )
    }
    roots.push(root)
  })

  if (options.nestSecondRootUnderFirst && roots[0] && roots[1]) {
    roots[0].addChild(roots[1])
    scene.addChild(roots[0])
    for (const root of roots.slice(2)) scene.addChild(root)
  } else {
    for (const root of roots) scene.addChild(root)
  }

  if (options.addUnownedSibling) {
    const positions = document.createAccessor('unowned-positions', buffer)
      .setType('VEC3')
      .setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]))
    const indices = document.createAccessor('unowned-indices', buffer)
      .setType('SCALAR')
      .setArray(new Uint16Array([0, 1, 2]))
    const mesh = document.createMesh('unowned-mesh').addPrimitive(
      document.createPrimitive()
        .setAttribute('POSITION', positions)
        .setIndices(indices),
    )
    scene.addChild(document.createNode('unowned-visible-geometry').setMesh(mesh))
  }

  document.getRoot().setDefaultScene(scene)
  await new NodeIO().write(visualPath, document)
  return visualPath
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(
    (directory) => rm(directory, { recursive: true, force: true }),
  ))
})

describe('validateAssetSet', () => {
  it('accepts a complete, licensed asset inside all budgets', async () => {
    const result = await validateAssetSet({
      manifestPath: 'tests/fixtures/assets/valid-minimal/manifest.json',
      sourcesPath: 'tests/fixtures/assets/valid-minimal/sources.json',
      projectRoot: process.cwd(),
    })

    expect(result).toEqual({
      ok: true,
      issues: [],
      metrics: {
        'prop.valid-minimal': {
          triangles: 1,
          materials: 1,
          textures: 1,
          maxTextureDimension: 1,
        },
      },
    })
  })

  it('does not count collider geometry against the visual triangle budget', async () => {
    const { manifest, sources } = await validContracts()
    manifest.assets[0]!.lods[0]!.maxTriangles = 1
    const validationCase = await writeValidationCase(manifest, sources)

    const result = await validateAssetSet({
      manifestPath: validationCase.manifestPath,
      sourcesPath: validationCase.sourcesPath,
      projectRoot: process.cwd(),
    })

    expect(result.ok).toBe(true)
    expect(result.metrics['prop.valid-minimal']?.triangles).toBe(1)
  })

  it('accepts a colliderless character backed by the registered runtime capsule', async () => {
    const { manifest, sources, runtimeContract } = await registeredTricycleContracts()
    const asset = manifest.assets[0]!
    asset.assetId = runtimeContract.character.assetId
    asset.kind = 'character'
    asset.origin = 'root-bone'
    asset.collider = null
    asset.requiredNodes = []
    manifest.assets = [asset]
    const validationCase = await writeValidationCase(manifest, sources)
    const runtimeAssetContractPath = await writeRuntimeContractCase(runtimeContract)

    const result = await validateAssetSet({
      manifestPath: validationCase.manifestPath,
      sourcesPath: validationCase.sourcesPath,
      runtimeAssetContractPath,
      projectRoot: process.cwd(),
    })

    expect(result.issues.filter(
      (issue) => issue.code === 'COLLIDER_REQUIRED',
    )).toEqual([])
  })

  it.each(['vegetation', 'environment'] as const)(
    'rejects colliderless %s assets without explicit runtime collision authority',
    async (kind) => {
      const { manifest, sources } = await validContracts()
      const asset = manifest.assets[0]!
      asset.assetId = `${kind}.world-collision`
      asset.kind = kind
      asset.collider = null
      const validationCase = await writeValidationCase(manifest, sources)

      const result = await validateAssetSet({
        manifestPath: validationCase.manifestPath,
        sourcesPath: validationCase.sourcesPath,
        projectRoot: process.cwd(),
      })

      expect(result.issues).toContainEqual(expect.objectContaining({
        assetId: `${kind}.world-collision`,
        code: 'COLLIDER_REQUIRED',
      }))
    },
  )

  it.each([
    ['vehicle', 'vehicle.electric-tricycle-a'],
    ['prop', 'prop.colliderless'],
    ['character', 'character.unregistered'],
  ] as const)(
    'rejects a colliderless %s without the registered runtime capsule',
    async (kind, assetId) => {
      const { manifest, sources, runtimeContract } = await registeredTricycleContracts()
      const asset = manifest.assets[0]!
      asset.assetId = assetId
      asset.kind = kind
      asset.collider = null
      asset.requiredNodes = []
      manifest.assets = [asset]
      const validationCase = await writeValidationCase(manifest, sources)
      const runtimeAssetContractPath = await writeRuntimeContractCase(runtimeContract)

      const result = await validateAssetSet({
        manifestPath: validationCase.manifestPath,
        sourcesPath: validationCase.sourcesPath,
        runtimeAssetContractPath,
        projectRoot: process.cwd(),
      })

      expect(result.issues).toContainEqual(expect.objectContaining({
        assetId,
        code: 'COLLIDER_REQUIRED',
      }))
    },
  )

  it('reports unknown and missing registered tricycle collider roles with node names', async () => {
    const { manifest, sources, runtimeContract } = await registeredTricycleContracts()
    runtimeContract.vehicle.chassisColliderNodes[0] = 'box_missing_from_glb'
    const validationCase = await writeValidationCase(manifest, sources)
    const runtimeAssetContractPath = await writeRuntimeContractCase(runtimeContract)

    const result = await validateAssetSet({
      manifestPath: validationCase.manifestPath,
      sourcesPath: validationCase.sourcesPath,
      runtimeAssetContractPath,
      projectRoot: process.cwd(),
    })

    expect(result.issues).toContainEqual(expect.objectContaining({
      assetId: 'vehicle.electric-tricycle-a',
      code: 'COLLIDER_ROLE_UNKNOWN',
      nodeName: 'box_chassis',
      message: expect.stringContaining('box_chassis'),
    }))
    expect(result.issues).toContainEqual(expect.objectContaining({
      assetId: 'vehicle.electric-tricycle-a',
      code: 'COLLIDER_ROLE_MISSING',
      nodeName: 'box_missing_from_glb',
      message: expect.stringContaining('box_missing_from_glb'),
    }))
  })

  it('reports the registered wheel node whose measured radius exceeds tolerance', async () => {
    const { manifest, sources, runtimeContract } = await registeredTricycleContracts()
    runtimeContract.vehicle.frontRadiusM = 0.310002
    const validationCase = await writeValidationCase(manifest, sources)
    const runtimeAssetContractPath = await writeRuntimeContractCase(runtimeContract)

    const result = await validateAssetSet({
      manifestPath: validationCase.manifestPath,
      sourcesPath: validationCase.sourcesPath,
      runtimeAssetContractPath,
      projectRoot: process.cwd(),
    })

    expect(result.issues).toContainEqual(expect.objectContaining({
      assetId: 'vehicle.electric-tricycle-a',
      code: 'WHEEL_RADIUS_MISMATCH',
      nodeName: 'convex_front_wheel',
      message: expect.stringContaining('convex_front_wheel'),
    }))
  })

  it('accepts a registered wheel-radius difference exactly at the inclusive 0.02m tolerance', async () => {
    const { manifest, sources, runtimeContract } = await registeredTricycleContracts()
    runtimeContract.vehicle.frontRadiusM = 0.31
    const validationCase = await writeValidationCase(manifest, sources)
    const runtimeAssetContractPath = await writeRuntimeContractCase(runtimeContract)

    const result = await validateAssetSet({
      manifestPath: validationCase.manifestPath,
      sourcesPath: validationCase.sourcesPath,
      runtimeAssetContractPath,
      projectRoot: process.cwd(),
    })

    expect(result.issues.filter(
      (issue) => issue.code === 'WHEEL_RADIUS_MISMATCH',
    )).toEqual([])
  })

  it('reports an unknown named non-mesh collider node', async () => {
    const { manifest, sources, runtimeContract } = await registeredTricycleContracts()
    const document = await new NodeIO().read(
      resolve('public/assets/vehicle/electric-tricycle-a/collision.glb'),
    )
    document.getRoot().getDefaultScene()!.addChild(
      document.createNode('unexpected_non_mesh'),
    )
    const directory = await mkdtemp(join(tmpdir(), 'orchard-collider-node-'))
    temporaryDirectories.push(directory)
    const colliderPath = join(directory, 'collision.glb')
    await new NodeIO().write(colliderPath, document)
    manifest.assets.find(
      (asset) => asset.assetId === 'vehicle.electric-tricycle-a',
    )!.collider = colliderPath
    const validationCase = await writeValidationCase(manifest, sources)
    const runtimeAssetContractPath = await writeRuntimeContractCase(runtimeContract)

    const result = await validateAssetSet({
      manifestPath: validationCase.manifestPath,
      sourcesPath: validationCase.sourcesPath,
      runtimeAssetContractPath,
      projectRoot: process.cwd(),
    })

    expect(result.issues).toContainEqual(expect.objectContaining({
      assetId: 'vehicle.electric-tricycle-a',
      code: 'COLLIDER_ROLE_UNKNOWN',
      nodeName: 'unexpected_non_mesh',
    }))
  })

  it('validates wheel radii by registered node identity after contract reordering', async () => {
    const { manifest, sources, runtimeContract } = await registeredTricycleContracts()
    runtimeContract.vehicle.wheelEnvelopeNodes = [
      'convex_rear_left',
      'convex_front_wheel',
      'convex_rear_right',
    ]
    runtimeContract.vehicle.frontRadiusM = 0.305
    runtimeContract.vehicle.rearRadiusM = 0.265
    const validationCase = await writeValidationCase(manifest, sources)
    const runtimeAssetContractPath = await writeRuntimeContractCase(runtimeContract)

    const result = await validateAssetSet({
      manifestPath: validationCase.manifestPath,
      sourcesPath: validationCase.sourcesPath,
      runtimeAssetContractPath,
      projectRoot: process.cwd(),
    })

    expect(result.issues.filter(
      (issue) => issue.code === 'WHEEL_RADIUS_MISMATCH',
    )).toEqual([])
  })

  it('validates each LOD subtree against its own triangle budget', async () => {
    const result = await validateAssetSet({
      manifestPath: 'tests/fixtures/assets/multi-lod/manifest.json',
      sourcesPath: 'tests/fixtures/assets/multi-lod/sources.json',
      projectRoot: process.cwd(),
    })

    expect(result.ok).toBe(true)
    expect(result.metrics['prop.multi-lod']?.triangles).toBe(12)
  })

  it('budgets each required root independently when explicitly scoped', async () => {
    const { manifest, sources } = await validContracts()
    const visualPath = await writeRequiredRootBudgetVisual([2, 2, 2])
    const asset = manifest.assets[0]!
    asset.assetId = 'vegetation.peach-tree-family'
    asset.kind = 'vegetation'
    asset.visual = visualPath
    asset.collider = null
    asset.requiredNodes = [
      'peach_tree_variant_a',
      'peach_tree_variant_b',
      'peach_tree_variant_c',
    ]
    asset.requiredAnimations = []
    asset.requiredAnimationEvents = {}
    asset.lods = [{ level: 0, maxDistance: 60, maxTriangles: 2 }]
    Object.assign(asset, {
      triangleBudgetScope: 'required-node-subtree',
      runtimeCollision: {
        authority: 'runtime-authored-proxies',
        proxySetId: 'test-tree-proxies-v1',
      },
    })
    const validationCase = await writeValidationCase(manifest, sources)

    const result = await validateAssetSet({
      manifestPath: validationCase.manifestPath,
      sourcesPath: validationCase.sourcesPath,
      projectRoot: process.cwd(),
    })

    expect(result.metrics['vegetation.peach-tree-family']?.triangles).toBe(6)
    expect(result.issues.filter(
      (issue) => issue.code === 'TRIANGLE_BUDGET_EXCEEDED',
    )).toEqual([])
  })

  it('reports the exact required root whose subtree exceeds budget', async () => {
    const { manifest, sources } = await validContracts()
    const visualPath = await writeRequiredRootBudgetVisual([2, 3, 2])
    const asset = manifest.assets[0]!
    asset.assetId = 'vegetation.peach-tree-family'
    asset.kind = 'vegetation'
    asset.visual = visualPath
    asset.collider = null
    asset.requiredNodes = [
      'peach_tree_variant_a',
      'peach_tree_variant_b',
      'peach_tree_variant_c',
    ]
    asset.requiredAnimations = []
    asset.requiredAnimationEvents = {}
    asset.lods = [{ level: 0, maxDistance: 60, maxTriangles: 2 }]
    Object.assign(asset, {
      triangleBudgetScope: 'required-node-subtree',
      runtimeCollision: {
        authority: 'runtime-authored-proxies',
        proxySetId: 'test-tree-proxies-v1',
      },
    })
    const validationCase = await writeValidationCase(manifest, sources)

    const result = await validateAssetSet({
      manifestPath: validationCase.manifestPath,
      sourcesPath: validationCase.sourcesPath,
      projectRoot: process.cwd(),
    })

    expect(result.issues).toContainEqual(expect.objectContaining({
      assetId: 'vegetation.peach-tree-family',
      code: 'TRIANGLE_BUDGET_EXCEEDED',
      nodeName: 'peach_tree_variant_b',
      message: expect.stringContaining('peach_tree_variant_b'),
    }))
  })

  it('counts shared mesh node instances separately within a required root', async () => {
    const { manifest, sources } = await validContracts()
    const visualPath = await writeRequiredRootBudgetVisual([1], {
      sharedMeshInstancesInFirstRoot: 2,
    })
    const asset = manifest.assets[0]!
    asset.assetId = 'vegetation.shared-mesh-instances'
    asset.kind = 'vegetation'
    asset.visual = visualPath
    asset.collider = null
    asset.requiredNodes = ['peach_tree_variant_a']
    asset.requiredAnimations = []
    asset.requiredAnimationEvents = {}
    asset.lods = [{ level: 0, maxDistance: 60, maxTriangles: 1 }]
    Object.assign(asset, {
      triangleBudgetScope: 'required-node-subtree',
      runtimeCollision: {
        authority: 'runtime-authored-proxies',
        proxySetId: 'test-tree-proxies-v1',
      },
    })
    const validationCase = await writeValidationCase(manifest, sources)

    const result = await validateAssetSet({
      manifestPath: validationCase.manifestPath,
      sourcesPath: validationCase.sourcesPath,
      projectRoot: process.cwd(),
    })

    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'TRIANGLE_BUDGET_EXCEEDED',
      nodeName: 'peach_tree_variant_a',
      message: expect.stringContaining('2 triangles'),
    }))
  })

  it('rejects visible mesh nodes outside every required root', async () => {
    const { manifest, sources } = await validContracts()
    const visualPath = await writeRequiredRootBudgetVisual([1], {
      addUnownedSibling: true,
    })
    const asset = manifest.assets[0]!
    asset.assetId = 'vegetation.unowned-visible-mesh'
    asset.kind = 'vegetation'
    asset.visual = visualPath
    asset.collider = null
    asset.requiredNodes = ['peach_tree_variant_a']
    asset.requiredAnimations = []
    asset.requiredAnimationEvents = {}
    asset.lods = [{ level: 0, maxDistance: 60, maxTriangles: 100 }]
    Object.assign(asset, {
      triangleBudgetScope: 'required-node-subtree',
      runtimeCollision: {
        authority: 'runtime-authored-proxies',
        proxySetId: 'test-tree-proxies-v1',
      },
    })
    const validationCase = await writeValidationCase(manifest, sources)

    const result = await validateAssetSet({
      manifestPath: validationCase.manifestPath,
      sourcesPath: validationCase.sourcesPath,
      projectRoot: process.cwd(),
    })

    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'TRIANGLE_BUDGET_SCOPE_INVALID',
      nodeName: 'unowned-visible-geometry',
    }))
  })

  it('rejects visible mesh nodes owned by nested required roots', async () => {
    const { manifest, sources } = await validContracts()
    const visualPath = await writeRequiredRootBudgetVisual([1, 1], {
      nestSecondRootUnderFirst: true,
    })
    const asset = manifest.assets[0]!
    asset.assetId = 'vegetation.overlapping-required-roots'
    asset.kind = 'vegetation'
    asset.visual = visualPath
    asset.collider = null
    asset.requiredNodes = [
      'peach_tree_variant_a',
      'peach_tree_variant_b',
    ]
    asset.requiredAnimations = []
    asset.requiredAnimationEvents = {}
    asset.lods = [{ level: 0, maxDistance: 60, maxTriangles: 100 }]
    Object.assign(asset, {
      triangleBudgetScope: 'required-node-subtree',
      runtimeCollision: {
        authority: 'runtime-authored-proxies',
        proxySetId: 'test-tree-proxies-v1',
      },
    })
    const validationCase = await writeValidationCase(manifest, sources)

    const result = await validateAssetSet({
      manifestPath: validationCase.manifestPath,
      sourcesPath: validationCase.sourcesPath,
      projectRoot: process.cwd(),
    })

    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'TRIANGLE_BUDGET_SCOPE_INVALID',
      nodeName: 'peach_tree_variant_b-geometry-1',
    }))
  })

  it('reports an oversized LOD1 against the LOD1 budget', async () => {
    const { manifest, sources } = await multiLodContracts()
    manifest.assets[0]!.lods = [
      { level: 0, maxDistance: 20, maxTriangles: 100 },
      { level: 1, maxDistance: 50, maxTriangles: 3 },
      { level: 2, maxDistance: 100, maxTriangles: 100 },
    ]
    const validationCase = await writeValidationCase(manifest, sources)

    const result = await validateAssetSet({
      manifestPath: validationCase.manifestPath,
      sourcesPath: validationCase.sourcesPath,
      projectRoot: process.cwd(),
    })

    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'TRIANGLE_BUDGET_EXCEEDED',
      message: expect.stringContaining('LOD1'),
    }))
  })

  it('reports every declared LOD whose semantic wrapper is missing', async () => {
    const { manifest, sources } = await multiLodContracts()
    manifest.assets[0]!.lods.push({
      level: 3,
      maxDistance: 150,
      maxTriangles: 1,
    })
    const validationCase = await writeValidationCase(manifest, sources)

    const result = await validateAssetSet({
      manifestPath: validationCase.manifestPath,
      sourcesPath: validationCase.sourcesPath,
      projectRoot: process.cwd(),
    })

    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'NODE_MISSING',
      message: expect.stringContaining('LOD3'),
    }))
  })

  it('charges visual meshes outside declared LOD wrappers to LOD0', async () => {
    const result = await validateAssetSet({
      manifestPath: 'tests/fixtures/assets/multi-lod-unassigned/manifest.json',
      sourcesPath: 'tests/fixtures/assets/multi-lod-unassigned/sources.json',
      projectRoot: process.cwd(),
    })

    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'TRIANGLE_BUDGET_EXCEEDED',
      message: expect.stringContaining('LOD0'),
    }))
  })

  it('charges sibling geometry to a single declared LOD0 wrapper', async () => {
    const result = await validateAssetSet({
      manifestPath: 'tests/fixtures/assets/single-lod-unassigned/manifest.json',
      sourcesPath: 'tests/fixtures/assets/single-lod-unassigned/sources.json',
      projectRoot: process.cwd(),
    })

    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'TRIANGLE_BUDGET_EXCEEDED',
      message: expect.stringContaining('LOD0'),
    }))
  })

  it('reports a multi-LOD manifest that has no LOD0 budget entry', async () => {
    const { manifest, sources } = await multiLodContracts()
    manifest.assets[0]!.lods = manifest.assets[0]!.lods.filter(
      (lod) => lod.level !== 0,
    )
    const validationCase = await writeValidationCase(manifest, sources)

    const result = await validateAssetSet({
      manifestPath: validationCase.manifestPath,
      sourcesPath: validationCase.sourcesPath,
      projectRoot: process.cwd(),
    })

    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'NODE_MISSING',
      message: expect.stringContaining('LOD0'),
    }))
  })

  it('resolves public URL asset paths inside the project public directory', async () => {
    const { manifest, sources } = await validContracts()
    const projectRoot = await mkdtemp(join(tmpdir(), 'orchard-public-assets-'))
    temporaryDirectories.push(projectRoot)
    const publicAssets = join(projectRoot, 'public/assets')
    await mkdir(publicAssets, { recursive: true })
    await copyFile(
      join(fixtureRoot, 'valid-minimal/visual.glb'),
      join(publicAssets, 'visual.glb'),
    )
    await copyFile(
      join(fixtureRoot, 'valid-minimal/collider.glb'),
      join(publicAssets, 'collider.glb'),
    )
    manifest.assets[0]!.visual = '/assets/visual.glb'
    manifest.assets[0]!.collider = '/assets/collider.glb'
    sources[0]!.licenseFile = 'license.txt'
    await writeFile(join(projectRoot, 'license.txt'), 'test license\n')
    await writeFile(
      join(projectRoot, 'manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
    )
    await writeFile(
      join(projectRoot, 'sources.json'),
      `${JSON.stringify(sources, null, 2)}\n`,
    )

    const result = await validateAssetSet({
      manifestPath: 'manifest.json',
      sourcesPath: 'sources.json',
      projectRoot,
    })

    expect(result.ok).toBe(true)
    expect(result.metrics['prop.valid-minimal']?.triangles).toBe(1)
  })

  it('reports the exact missing semantic node', async () => {
    const result = await validateAssetSet({
      manifestPath: 'tests/fixtures/assets/missing-node/manifest.json',
      sourcesPath: 'tests/fixtures/assets/missing-node/sources.json',
      projectRoot: process.cwd(),
    })

    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'NODE_MISSING',
      message: expect.stringContaining('interaction_anchor'),
    }))
  })

  it('forbids placeholder asset IDs and GLB node names', async () => {
    const result = await validateAssetSet({
      manifestPath: 'tests/fixtures/assets/placeholder-name/manifest.json',
      sourcesPath: 'tests/fixtures/assets/placeholder-name/sources.json',
      projectRoot: process.cwd(),
    })

    expect(result.issues.filter(
      (issue) => issue.code === 'PLACEHOLDER_ASSET_FORBIDDEN',
    )).toHaveLength(2)
    expect(result.issues.some((issue) => issue.message.includes('Cube'))).toBe(true)
  })

  it('reports unresolved provenance records', async () => {
    const { manifest } = await validContracts()
    const validationCase = await writeValidationCase(manifest, [])

    const result = await validateAssetSet({
      manifestPath: validationCase.manifestPath,
      sourcesPath: validationCase.sourcesPath,
      projectRoot: process.cwd(),
    })

    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'SOURCE_MISSING',
      assetId: 'prop.valid-minimal',
    }))
  })

  it('reports a provenance record whose license file is absent', async () => {
    const { manifest, sources } = await validContracts()
    sources[0]!.licenseFile = 'tests/fixtures/assets/no-such-license.txt'
    const validationCase = await writeValidationCase(manifest, sources)

    const result = await validateAssetSet({
      manifestPath: validationCase.manifestPath,
      sourcesPath: validationCase.sourcesPath,
      projectRoot: process.cwd(),
    })

    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'LICENSE_MISSING',
      assetId: 'prop.valid-minimal',
    }))
  })

  it('reports a provenance license path that is a directory', async () => {
    const { manifest, sources } = await validContracts()
    sources[0]!.licenseFile = 'tests/fixtures/assets/valid-minimal'
    const validationCase = await writeValidationCase(manifest, sources)

    const result = await validateAssetSet({
      manifestPath: validationCase.manifestPath,
      sourcesPath: validationCase.sourcesPath,
      projectRoot: process.cwd(),
    })

    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'LICENSE_MISSING',
      assetId: 'prop.valid-minimal',
    }))
  })

  it('reports a missing GLB before attempting to parse it', async () => {
    const { manifest, sources } = await validContracts()
    manifest.assets[0]!.visual = 'tests/fixtures/assets/no-such-visual.glb'
    const validationCase = await writeValidationCase(manifest, sources)

    const result = await validateAssetSet({
      manifestPath: validationCase.manifestPath,
      sourcesPath: validationCase.sourcesPath,
      projectRoot: process.cwd(),
    })

    expect(result.issues.filter((issue) => issue.code === 'FILE_MISSING'))
      .toHaveLength(1)
    expect(result.issues.some((issue) => issue.code === 'GLB_PARSE_FAILED'))
      .toBe(false)
  })

  it('reports an existing malformed GLB', async () => {
    const { manifest, sources } = await validContracts()
    const validationCase = await writeValidationCase(manifest, sources)
    const malformedPath = join(validationCase.directory, 'malformed.glb')
    await writeFile(malformedPath, 'not a glb')
    manifest.assets[0]!.visual = malformedPath
    await writeFile(
      validationCase.manifestPath,
      `${JSON.stringify(manifest, null, 2)}\n`,
    )

    const result = await validateAssetSet({
      manifestPath: validationCase.manifestPath,
      sourcesPath: validationCase.sourcesPath,
      projectRoot: process.cwd(),
    })

    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'GLB_PARSE_FAILED',
      assetId: 'prop.valid-minimal',
    }))
  })

  it('reports missing animations and missing animation events independently', async () => {
    const { manifest, sources } = await validContracts()
    manifest.assets[0]!.requiredAnimations = ['idle', 'harvest']
    manifest.assets[0]!.requiredAnimationEvents = {
      idle: ['ready', 'contact'],
      harvest: ['release'],
    }
    const validationCase = await writeValidationCase(manifest, sources)

    const result = await validateAssetSet({
      manifestPath: validationCase.manifestPath,
      sourcesPath: validationCase.sourcesPath,
      projectRoot: process.cwd(),
    })

    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'ANIMATION_MISSING',
      message: expect.stringContaining('harvest'),
    }))
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'ANIMATION_EVENT_MISSING',
      message: expect.stringContaining('idle'),
    }))
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'ANIMATION_EVENT_MISSING',
      message: expect.stringContaining('release'),
    }))
  })

  it('reports each visual budget violation from measured GLB metrics', async () => {
    const { manifest, sources } = await validContracts()
    const asset = manifest.assets[0]!
    asset.lods[0]!.maxTriangles = 0
    asset.materialBudget.maxMaterials = 0
    asset.textureBudget.maxTextureCount = 0
    asset.textureBudget.maxDimension = 0
    const validationCase = await writeValidationCase(manifest, sources)

    const result = await validateAssetSet({
      manifestPath: validationCase.manifestPath,
      sourcesPath: validationCase.sourcesPath,
      projectRoot: process.cwd(),
    })

    expect(result.issues.map((issue) => issue.code)).toEqual([
      'MATERIAL_BUDGET_EXCEEDED',
      'TEXTURE_BUDGET_EXCEEDED',
      'TEXTURE_BUDGET_EXCEEDED',
      'TRIANGLE_BUDGET_EXCEEDED',
    ])
  })

  it('sorts issues by asset ID, code, and message', async () => {
    const { manifest } = await validContracts()
    const template = manifest.assets[0]!
    manifest.assets = [
      {
        ...structuredClone(template),
        assetId: 'z.asset',
        sourceId: 'missing.z',
        visual: 'missing-z-visual.glb',
        collider: 'missing-z-collider.glb',
      },
      {
        ...structuredClone(template),
        assetId: 'a.asset',
        sourceId: 'missing.a',
        visual: 'missing-a-visual.glb',
        collider: 'missing-a-collider.glb',
      },
    ]
    const validationCase = await writeValidationCase(manifest, [])

    const result = await validateAssetSet({
      manifestPath: validationCase.manifestPath,
      sourcesPath: validationCase.sourcesPath,
      projectRoot: process.cwd(),
    })

    expect(result.issues.map(({ assetId, code }) => `${assetId}:${code}`))
      .toEqual([
        'a.asset:FILE_MISSING',
        'a.asset:FILE_MISSING',
        'a.asset:SOURCE_MISSING',
        'z.asset:FILE_MISSING',
        'z.asset:FILE_MISSING',
        'z.asset:SOURCE_MISSING',
      ])
    expect(result.issues[0]?.message).toContain('collider')
    expect(result.issues[1]?.message).toContain('visual')
  })
})

describe('asset validator CLI', () => {
  const cliPath = resolve('node_modules/tsx/dist/cli.mjs')
  const validatorPath = resolve('tools/assets/validateAssets.ts')

  it('prints usage and exits 2 without a manifest argument', () => {
    const result = spawnSync(process.execPath, [cliPath, validatorPath], {
      cwd: process.cwd(),
      encoding: 'utf8',
    })

    expect(result.status).toBe(2)
    expect(result.stderr).toContain(
      'Usage: npm run assets:validate -- <manifest.json>',
    )
  })

  it('reads asset-sources.json beside the manifest and reports success', async () => {
    const { manifest, sources } = await validContracts()
    const validationCase = await writeValidationCase(
      manifest,
      sources,
      'asset-sources.json',
    )

    const result = spawnSync(
      process.execPath,
      [cliPath, validatorPath, validationCase.manifestPath],
      { cwd: process.cwd(), encoding: 'utf8' },
    )

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('1 assets, 0 errors')
  })

  it('exits 1 when validation reports an error', async () => {
    const { manifest, sources } = await validContracts()
    manifest.assets[0]!.requiredNodes.push('missing_from_delivery')
    const validationCase = await writeValidationCase(
      manifest,
      sources,
      'asset-sources.json',
    )

    const result = spawnSync(
      process.execPath,
      [cliPath, validatorPath, validationCase.manifestPath],
      { cwd: process.cwd(), encoding: 'utf8' },
    )

    expect(result.status).toBe(1)
    expect(result.stdout).toContain('NODE_MISSING')
    expect(result.stdout).toContain('1 assets, 1 errors')
  })
})
