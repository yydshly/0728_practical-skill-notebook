import { describe, expect, it } from 'vitest'
import {
  parseAssetManifest,
  parseAssetSources,
} from '../../src/assets/assetManifestSchema'

const validVehicle = {
  version: 1,
  assets: [{
    assetId: 'vehicle.electric-tricycle-a',
    kind: 'vehicle',
    sourceId: 'source.vehicle.electric-tricycle-a',
    visual: '/assets/vehicle/electric-tricycle-a/visual.glb',
    collider: '/assets/vehicle/electric-tricycle-a/collision.glb',
    blenderSource: 'resources/blender/vehicle/electric-tricycle-a.blend',
    units: 'meter',
    upAxis: 'Y',
    forwardAxis: '-Z',
    origin: 'ground-center',
    lods: [{ level: 0, maxDistance: 30, maxTriangles: 60000 }],
    textureBudget: { maxDimension: 2048, maxTextureCount: 6 },
    materialBudget: { maxMaterials: 4 },
    requiredNodes: [
      'driver_seat', 'exit_left', 'wheel_front',
      'wheel_rear_left', 'wheel_rear_right',
      'cargo_slot_01', 'cargo_slot_02', 'cargo_slot_03',
      'cargo_slot_04', 'cargo_slot_05', 'cargo_slot_06',
    ],
    requiredAnimations: [],
    requiredAnimationEvents: {},
    maxInstances: 2,
    critical: true,
  }],
}

const validSource = {
  sourceId: 'source.vehicle.electric-tricycle-a',
  acquisition: 'original',
  author: 'Orchard team',
  sourceUrl: null,
  license: 'All rights reserved',
  licenseFile: 'licenses/orchard-team.txt',
  modifiedByProject: true,
}

describe('parseAssetManifest', () => {
  it('accepts a complete vehicle contract', () => {
    expect(parseAssetManifest(validVehicle).assets[0]?.assetId)
      .toBe('vehicle.electric-tricycle-a')
  })

  it('rejects an entry without provenance', () => {
    const invalid = structuredClone(validVehicle)
    delete (invalid.assets[0] as { sourceId?: string }).sourceId

    expect(() => parseAssetManifest(invalid)).toThrow(/sourceId/)
  })

  it('rejects duplicate stable asset IDs', () => {
    const invalid = { ...validVehicle, assets: [
      validVehicle.assets[0], validVehicle.assets[0],
    ] }

    expect(() => parseAssetManifest(invalid))
      .toThrow('Duplicate assetId: vehicle.electric-tricycle-a')
  })

  it('accepts an empty versioned manifest before assets are approved', () => {
    expect(parseAssetManifest({ version: 1, assets: [] }).assets).toEqual([])
  })

  it('retains an explicit required-node-subtree triangle budget scope', () => {
    const scoped = structuredClone(validVehicle)
    Object.assign(scoped.assets[0]!, {
      triangleBudgetScope: 'required-node-subtree',
    })

    expect(parseAssetManifest(scoped).assets[0]?.triangleBudgetScope)
      .toBe('required-node-subtree')
  })

  it('rejects an unknown triangle budget scope', () => {
    const invalid = structuredClone(validVehicle)
    Object.assign(invalid.assets[0]!, {
      triangleBudgetScope: 'entire-orchard-row',
    })

    expect(() => parseAssetManifest(invalid)).toThrow(/triangleBudgetScope/)
  })

  it('rejects required-node-subtree scope with no required roots', () => {
    const invalid = structuredClone(validVehicle)
    invalid.assets[0]!.requiredNodes = []
    Object.assign(invalid.assets[0]!, {
      triangleBudgetScope: 'required-node-subtree',
    })

    expect(() => parseAssetManifest(invalid)).toThrow(/requiredNodes/)
  })

  it('rejects duplicate required roots in required-node-subtree scope', () => {
    const invalid = structuredClone(validVehicle)
    invalid.assets[0]!.requiredNodes = ['variant_a', 'variant_a']
    Object.assign(invalid.assets[0]!, {
      triangleBudgetScope: 'required-node-subtree',
    })

    expect(() => parseAssetManifest(invalid)).toThrow(/requiredNodes/)
  })

  it('rejects required-node-subtree scope without exactly one LOD0', () => {
    const invalid = structuredClone(validVehicle)
    invalid.assets[0]!.lods = [
      { level: 1, maxDistance: 60, maxTriangles: 3500 },
    ]
    Object.assign(invalid.assets[0]!, {
      triangleBudgetScope: 'required-node-subtree',
    })

    expect(() => parseAssetManifest(invalid)).toThrow(/LOD0/)
  })

  it('rejects duplicate LOD0 entries in required-node-subtree scope', () => {
    const invalid = structuredClone(validVehicle)
    invalid.assets[0]!.lods = [
      { level: 0, maxDistance: 30, maxTriangles: 3500 },
      { level: 0, maxDistance: 60, maxTriangles: 1800 },
    ]
    Object.assign(invalid.assets[0]!, {
      triangleBudgetScope: 'required-node-subtree',
    })

    expect(() => parseAssetManifest(invalid)).toThrow(/LOD0/)
  })

  it('retains an explicit runtime-authored collision proxy reference', () => {
    const explicit = structuredClone(validVehicle)
    explicit.assets[0]!.kind = 'vegetation'
    ;(explicit.assets[0] as { collider: string | null }).collider = null
    Object.assign(explicit.assets[0]!, {
      runtimeCollision: {
        authority: 'runtime-authored-proxies',
        proxySetId: 'orchard-tree-trunks-v1',
      },
    })

    expect(parseAssetManifest(explicit).assets[0]?.runtimeCollision).toEqual({
      authority: 'runtime-authored-proxies',
      proxySetId: 'orchard-tree-trunks-v1',
    })
  })

  it('rejects an empty runtime collision proxy set ID', () => {
    const invalid = structuredClone(validVehicle)
    Object.assign(invalid.assets[0]!, {
      runtimeCollision: {
        authority: 'runtime-authored-proxies',
        proxySetId: '',
      },
    })

    expect(() => parseAssetManifest(invalid)).toThrow(/proxySetId/)
  })

  it('rejects an unknown runtime collision authority', () => {
    const invalid = structuredClone(validVehicle)
    Object.assign(invalid.assets[0]!, {
      runtimeCollision: {
        authority: 'asset-kind-implies-collision',
        proxySetId: 'orchard-tree-trunks-v1',
      },
    })

    expect(() => parseAssetManifest(invalid)).toThrow(/authority/)
  })

  it('accepts a character contract with a runtime capsule instead of a GLB collider', () => {
    const character = structuredClone(validVehicle)
    character.assets[0]!.assetId = 'character.farmer-a-base'
    character.assets[0]!.kind = 'character'
    character.assets[0]!.origin = 'root-bone'
    ;(character.assets[0] as { collider: string | null }).collider = null

    expect(parseAssetManifest(character).assets[0]?.collider).toBeNull()
  })
})

describe('parseAssetSources', () => {
  it('accepts a complete provenance record', () => {
    expect(parseAssetSources([validSource])[0]?.sourceId)
      .toBe('source.vehicle.electric-tricycle-a')
  })

  it('rejects a provenance record with an empty license', () => {
    expect(() => parseAssetSources([{ ...validSource, license: '' }]))
      .toThrow(/license/)
  })

  it('rejects a provenance record with an empty license file', () => {
    expect(() => parseAssetSources([{ ...validSource, licenseFile: '' }]))
      .toThrow(/licenseFile/)
  })
})
