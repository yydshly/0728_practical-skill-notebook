import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { AnimationClip, Group } from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  loadRuntimeAssetContract,
  parseRuntimeAssetContract,
} from '../../../src/feasibility/assets/runtimeAssetContract'
import { loadCriticalGlb } from '../../../src/feasibility/assets/loadCriticalGlb'

const expectedContract = {
  version: 2,
  vehicle: {
    assetId: 'vehicle.electric-tricycle-a',
    upAxis: 'Y',
    forwardAxis: '-Z',
    chassisColliderNodes: [
      'box_chassis',
      'box_driver_mass',
      'box_bed_floor',
      'box_bed_left_wall',
      'box_bed_right_wall',
      'box_bed_front_wall',
      'box_bed_rear_wall',
    ],
    wheelEnvelopeNodes: [
      'convex_front_wheel',
      'convex_rear_left',
      'convex_rear_right',
    ],
    anchors: {
      seat: 'driver_seat',
      exit: 'exit_left',
      frontWheel: 'wheel_front',
      rearLeftWheel: 'wheel_rear_left',
      rearRightWheel: 'wheel_rear_right',
      cargo: 'cargo_slot_01',
    },
    emptyMassKg: 420,
    centerOfMass: [0, 0.4, -0.12],
    frontRadiusM: 0.29,
    rearRadiusM: 0.275,
    suspensionRestM: 0.18,
    suspensionTravelM: 0.12,
    springNPerM: 26000,
    compressionDampingNsPerM: 3800,
    reboundDampingNsPerM: 4200,
    maxDriveForceN: 2600,
    maxBrakeForceN: 6000,
    maxSteerRad: 0.48,
    maxSpeedMps: 5,
    lateralGripCoefficient: 1.15,
  },
  character: {
    assetId: 'character.farmer-a-base',
    capsuleHalfHeightM: 0.62,
    capsuleRadiusM: 0.22,
    stepHeightM: 0.24,
    maxSlopeDeg: 42,
  },
  environment: {
    worldAssetId: 'environment.orchard-world-overall-v1',
    treeAssetId: 'environment.peach-tree-overall-v1',
    treeVariantNodes: {
      a: 'peach_tree_variant_a',
      b: 'peach_tree_variant_b',
      c: 'peach_tree_variant_c',
    },
  },
} as const

async function readRuntimeContract(): Promise<unknown> {
  return JSON.parse(await readFile(
    resolve('public/feasibility/runtime-assets.json'),
    'utf8',
  )) as unknown
}

function mutableContract(): Record<string, any> {
  return structuredClone(expectedContract)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('runtime asset contract', () => {
  it('requires exact environment asset ids and tree variants', () => {
    const expectedContractV2 = {
      vehicle: expectedContract.vehicle,
      character: expectedContract.character,
      version: 2,
      environment: {
        worldAssetId: 'environment.orchard-world-overall-v1',
        treeAssetId: 'environment.peach-tree-overall-v1',
        treeVariantNodes: {
          a: 'peach_tree_variant_a',
          b: 'peach_tree_variant_b',
          c: 'peach_tree_variant_c',
        },
      },
    } as const

    expect(parseRuntimeAssetContract(expectedContractV2))
      .toEqual(expectedContractV2)
  })

  it('parses the exact committed runtime contract', async () => {
    expect(parseRuntimeAssetContract(await readRuntimeContract())).toEqual(
      expectedContract,
    )
  })

  it('maps every collider node to one explicit role', async () => {
    const contract = parseRuntimeAssetContract(await readRuntimeContract())
    expect(new Set([
      ...contract.vehicle.chassisColliderNodes,
      ...contract.vehicle.wheelEnvelopeNodes,
    ]).size).toBe(10)
  })

  it('rejects unknown keys instead of silently accepting contract drift', () => {
    const input = mutableContract()
    input.vehicle.unregisteredField = true
    expect(() => parseRuntimeAssetContract(input)).toThrow()
  })

  it.each([
    ['upAxis', undefined],
    ['forwardAxis', undefined],
    ['upAxis', 'Z'],
    ['forwardAxis', 'Z'],
  ])('rejects an incompatible or missing vehicle %s', (field, value) => {
    const input = mutableContract()
    input.vehicle[field] = value
    expect(() => parseRuntimeAssetContract(input)).toThrow()
  })

  it('rejects a collider node assigned to duplicate roles', () => {
    const input = mutableContract()
    input.vehicle.wheelEnvelopeNodes[0] = 'box_chassis'
    expect(() => parseRuntimeAssetContract(input)).toThrow(/collider/i)
  })

  it.each([
    ['vehicle.emptyMassKg'],
    ['vehicle.frontRadiusM'],
    ['vehicle.rearRadiusM'],
    ['vehicle.suspensionRestM'],
    ['vehicle.suspensionTravelM'],
    ['vehicle.springNPerM'],
    ['vehicle.compressionDampingNsPerM'],
    ['vehicle.reboundDampingNsPerM'],
    ['vehicle.maxDriveForceN'],
    ['vehicle.maxBrakeForceN'],
    ['vehicle.maxSteerRad'],
    ['vehicle.maxSpeedMps'],
    ['vehicle.lateralGripCoefficient'],
    ['character.capsuleHalfHeightM'],
    ['character.capsuleRadiusM'],
    ['character.stepHeightM'],
    ['character.maxSlopeDeg'],
  ])('rejects non-positive physical value %s', (path) => {
    const input = mutableContract()
    const [section, field] = path.split('.')
    input[section!][field!] = 0
    expect(() => parseRuntimeAssetContract(input)).toThrow()
  })

  it.each([
    ['vehicle', 'vehicle.electric-tricycle-b'],
    ['character', 'character.farmer-b-base'],
  ])('rejects an unregistered %s asset ID', (section, assetId) => {
    const input = mutableContract()
    input[section].assetId = assetId
    expect(() => parseRuntimeAssetContract(input)).toThrow()
  })
})

describe('runtime contract loading', () => {
  it('rejects non-2xx responses before parsing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('missing', {
      status: 404,
    })))

    await expect(loadRuntimeAssetContract('/runtime-assets.json'))
      .rejects.toThrow(/404/)
  })

  it('fetches and parses a successful response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(expectedContract)))

    await expect(loadRuntimeAssetContract('/runtime-assets.json'))
      .resolves.toEqual(expectedContract)
  })
})

describe('critical GLB loading', () => {
  it('maps every required node and preserves animation clips', async () => {
    const scene = new Group()
    const seat = new Group()
    seat.name = 'driver_seat'
    const cargo = new Group()
    cargo.name = 'cargo_slot_01'
    scene.add(seat, cargo)
    const clips = [new AnimationClip('idle')]
    let loadedUrl: string | undefined
    const loader = {
      loadAsync: async (url: string) => {
        loadedUrl = url
        return { scene, animations: clips }
      },
    }

    const loaded = await loadCriticalGlb(loader, {
      assetId: 'vehicle.electric-tricycle-a',
      url: '/vehicle.glb',
      requiredNodes: ['driver_seat', 'cargo_slot_01'],
    })

    expect(loaded.scene).toBe(scene)
    expect(loadedUrl).toBe('/vehicle.glb')
    expect(loaded.anchors.get('driver_seat')).toBe(seat)
    expect(loaded.anchors.get('cargo_slot_01')).toBe(cargo)
    expect(loaded.clips).toBe(clips)
  })

  it('fails with asset ID and missing anchor without creating a fallback', async () => {
    const scene = new Group()
    const loader = {
      loadAsync: async () => ({ scene, animations: [] }),
    }

    await expect(loadCriticalGlb(loader, {
      assetId: 'vehicle.electric-tricycle-a',
      url: '/vehicle.glb',
      requiredNodes: ['driver_seat'],
    })).rejects.toThrow(
      'vehicle.electric-tricycle-a: missing node driver_seat',
    )
    expect(scene.children).toHaveLength(0)
  })
})
