import {
  BoxGeometry,
  Color,
  Float32BufferAttribute,
  BufferGeometry,
  FogExp2,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Scene,
  Vector3,
  type Object3D,
  type WebGLRenderer,
} from 'three'
import { describe, expect, it, vi } from 'vitest'
import type { SliceAssets } from '../../../src/feasibility/assets/SliceAssetLoader'
import type { LoadedCriticalAsset } from '../../../src/feasibility/assets/loadCriticalGlb'
import {
  createOrchardLighting,
} from '../../../src/feasibility/world/createOrchardLighting'
import {
  createOrchardWorldVisual,
  ORCHARD_TREE_SHADOW_ROUTE_DISTANCE_M,
} from '../../../src/feasibility/world/createOrchardWorldVisual'
import {
  ORCHARD_WORLD_DEFINITION,
  type OrchardWorldDefinition,
} from '../../../src/feasibility/world/orchardWorldDefinition'

const WORLD_ANCHOR_NAMES = [
  'orchard_parking_anchor',
  'harvest_basket_anchor',
  'packing_crate_anchor',
  'farmhouse_delivery_anchor',
] as const
const STATE_GROUP_NAMES = [
  'harvest_basket_empty',
  'harvest_basket_full',
  'packing_crate_empty',
  'packing_crate_full',
  'delivery_complete',
] as const

function loaded(
  scene: Object3D,
  anchors: Map<string, Object3D> = new Map(),
): LoadedCriticalAsset {
  return { scene, anchors, clips: [] }
}

export function createSyntheticSliceAssets(): SliceAssets {
  const world = new Group()
  world.name = 'static-world'
  const worldAnchors = new Map<string, Object3D>()
  for (const name of [...WORLD_ANCHOR_NAMES, ...STATE_GROUP_NAMES]) {
    const group = new Group()
    group.name = name
    world.add(group)
    worldAnchors.set(name, group)
  }

  const crateInstances = new Group()
  crateInstances.name = 'crate_instances'
  world.add(crateInstances)
  for (let index = 1; index <= 8; index += 1) {
    const marker = new Group()
    marker.name = `crate_marker_${String(index).padStart(2, '0')}`
    marker.position.set(index, 0, index * -0.5)
    crateInstances.add(marker)
    worldAnchors.set(marker.name, marker)
    if (index === 1) {
      const source = new Mesh(
        new BoxGeometry(0.2, 0.2, 0.2),
        new MeshStandardMaterial(),
      )
      source.name = 'crate_source'
      source.position.set(0.25, 0.1, -0.15)
      marker.add(source)
      worldAnchors.set(source.name, source)
    }
  }

  const treeFamily = new Group()
  treeFamily.name = 'tree-family'
  const treeAnchors = new Map<string, Object3D>()
  for (const suffix of ['a', 'b', 'c'] as const) {
    const variant = new Group()
    variant.name = `peach_tree_variant_${suffix}`
    for (const [part, y] of [
      ['branch', 0.7],
      ['fruit', 1.4],
      ['leaf', 1.8],
    ] as const) {
      const mesh = new Mesh(
        new BufferGeometry(),
        new MeshStandardMaterial(),
      )
      const authoredPart = part === 'fruit' && suffix === 'a'
        ? 'fruit_leaf'
        : part === 'branch' && suffix === 'c'
          ? 'trunk'
          : part
      mesh.name = `${variant.name}_${authoredPart}`
      mesh.position.set(0.1, y, -0.2)
      variant.add(mesh)
    }
    treeFamily.add(variant)
    treeAnchors.set(variant.name, variant)
  }

  const vehicle = new Group()
  vehicle.name = 'vehicle'
  const cargo = new Group()
  cargo.name = 'cargo_slot_01'
  vehicle.add(cargo)

  return {
    vehicleVisual: loaded(vehicle, new Map([[cargo.name, cargo]])),
    characterVisual: loaded(new Group()),
    vehicleCollision: loaded(new Group()),
    environmentWorldVisual: loaded(world, worldAnchors),
    peachTreeFamilyVisual: loaded(treeFamily, treeAnchors),
  }
}

describe('createOrchardWorldVisual', () => {
  it('assembles exactly 30 trees without visible fallback geometry', () => {
    const scene = new Scene()
    const assembled = createOrchardWorldVisual({
      scene,
      assets: createSyntheticSliceAssets(),
      definition: ORCHARD_WORLD_DEFINITION,
    })

    expect(assembled.treeInstanceCount).toBe(30)
    expect([
      assembled.nearTreeInstanceCount,
      assembled.farTreeInstanceCount,
    ]).toEqual([14, 16])
    expect(assembled.treeRenderBatchCount).toBe(18)
    expect(assembled.crateInstanceCount).toBe(8)
    expect(assembled.boundSensorIds).toEqual([
      'parking', 'tree-inventory', 'basket',
      'crate', 'cargo-slot', 'delivery',
    ])
    assembled.applyFruitOwner('vehicle')
    expect(assembled.stateVisibility()).toEqual({
      activeTreeFruit: false,
      basketFull: false,
      crateFull: false,
      cargoLoaded: true,
      deliveryComplete: false,
    })
    expect(assembled.root.name).toBe('orchard-world')
    expect(assembled.root.getObjectByName('debug-course')).toBeUndefined()
  })

  it('maps each domain owner to authored state without hiding other trees', () => {
    const assembled = createOrchardWorldVisual({
      scene: new Scene(),
      assets: createSyntheticSliceAssets(),
      definition: ORCHARD_WORLD_DEFINITION,
    })
    const expected = {
      tree: [true, false, false, false, false],
      player: [false, false, false, false, false],
      basket: [false, true, false, false, false],
      crate: [false, false, true, false, false],
      vehicle: [false, false, false, true, false],
      delivered: [false, false, false, false, true],
    } as const

    for (const [owner, visibility] of Object.entries(expected)) {
      assembled.applyFruitOwner(owner as keyof typeof expected)
      expect(Object.values(assembled.stateVisibility())).toEqual(visibility)
    }

    assembled.applyFruitOwner('player')
    const fruitBatches = assembled.root.children.filter(
      (child): child is InstancedMesh => (
        child instanceof InstancedMesh && child.name.includes('fruit')
      ),
    )
    expect(fruitBatches).toHaveLength(6)
    const matrix = new Matrix4()
    const visibleScales = fruitBatches.flatMap((fruitBatch) => (
      Array.from({ length: fruitBatch.count }, (_, index) => {
        fruitBatch.getMatrixAt(index, matrix)
        return new Vector3().setFromMatrixScale(matrix).length()
      })
    ))
    expect(visibleScales.filter((scale) => scale === 0)).toHaveLength(1)
    expect(visibleScales.filter((scale) => scale > 0)).toHaveLength(29)
  })

  it('partitions shadow instances at the authored route-distance boundary', () => {
    const definition = structuredClone(
      ORCHARD_WORLD_DEFINITION,
    ) as OrchardWorldDefinition
    const exactBoundary = definition.treeInstances[28]!
    const outsideBoundary = definition.treeInstances[29]!
    exactBoundary.translation = {
      x: ORCHARD_TREE_SHADOW_ROUTE_DISTANCE_M,
      y: 0,
      z: 10.5,
    }
    outsideBoundary.translation = {
      x: -(ORCHARD_TREE_SHADOW_ROUTE_DISTANCE_M + 0.001),
      y: 0,
      z: 10.5,
    }

    const assembled = createOrchardWorldVisual({
      scene: new Scene(),
      assets: createSyntheticSliceAssets(),
      definition,
    })
    const treeBatches = assembled.root.children.filter(
      (child): child is InstancedMesh => (
        child instanceof InstancedMesh && child.name.startsWith('orchard-tree-')
      ),
    )
    const fruitBatches = treeBatches.filter(({ name }) => name.includes('fruit'))
    const farBatches = treeBatches.filter(({ name }) => name.endsWith('-far'))
    const nearShadowBatches = treeBatches.filter(({ name }) => (
      name.endsWith('-near')
      && (
        name.includes('-branch-')
        || name.includes('-leaf-')
        || name.includes('-trunk-')
        || name.includes('-crown-')
      )
    ))

    expect(ORCHARD_TREE_SHADOW_ROUTE_DISTANCE_M).toBe(14)
    expect(assembled.nearTreeInstanceCount).toBe(15)
    expect(assembled.farTreeInstanceCount).toBe(15)
    expect(fruitBatches.reduce((total, batch) => total + batch.count, 0)).toBe(30)
    expect(farBatches.every(({ castShadow }) => castShadow === false)).toBe(true)
    expect(fruitBatches.every(({ castShadow }) => castShadow === false)).toBe(true)
    expect(nearShadowBatches).toHaveLength(6)
    expect(nearShadowBatches.every(({ castShadow }) => castShadow === true)).toBe(true)
  })

  it('composes crate source-local transforms at all eight markers', () => {
    const assembled = createOrchardWorldVisual({
      scene: new Scene(),
      assets: createSyntheticSliceAssets(),
      definition: ORCHARD_WORLD_DEFINITION,
    })
    const batch = assembled.root.getObjectByName('orchard-crates')
    expect(batch).toBeInstanceOf(InstancedMesh)
    const instanceMatrix = new Matrix4()
    ;(batch as InstancedMesh).getMatrixAt(7, instanceMatrix)
    ;(batch as InstancedMesh).geometry.computeBoundingBox()
    const position = (batch as InstancedMesh).geometry.boundingBox!
      .getCenter(new Vector3())
      .applyMatrix4(instanceMatrix)
    expect(position.x).toBeCloseTo(8.25)
    expect(position.y).toBeCloseTo(0.1)
    expect(position.z).toBeCloseTo(-4.15)
    expect(assembled.root.getObjectByName('crate_source')).toBeUndefined()
  })

  it('creates one crate instance batch per source material', () => {
    const assets = createSyntheticSliceAssets()
    const marker = assets.environmentWorldVisual.scene
      .getObjectByName('crate_marker_01')!
    marker.getObjectByName('crate_source')!.removeFromParent()
    const source = new Group()
    source.name = 'crate_source'
    source.position.set(0.25, 0.1, -0.15)
    const green = new MeshStandardMaterial({ color: 0x334422 })
    const metal = new MeshStandardMaterial({ color: 0x777777 })
    for (const [name, x, material] of [
      ['left', -0.1, green],
      ['right', 0.1, green],
      ['fastener', 0, metal],
    ] as const) {
      const mesh = new Mesh(new BoxGeometry(0.1, 0.1, 0.1), material)
      mesh.name = name
      mesh.position.x = x
      source.add(mesh)
    }
    marker.add(source)

    const assembled = createOrchardWorldVisual({
      scene: new Scene(),
      assets,
      definition: ORCHARD_WORLD_DEFINITION,
    })
    const batches = assembled.root.children.filter(
      (child): child is InstancedMesh => (
        child instanceof InstancedMesh
        && child.name.startsWith('orchard-crates')
      ),
    )
    expect(batches).toHaveLength(2)
    expect(batches.map(({ count }) => count)).toEqual([8, 8])
  })

  it('instances every indexed multi-material crate group', () => {
    const assets = createSyntheticSliceAssets()
    const marker = assets.environmentWorldVisual.scene
      .getObjectByName('crate_marker_01')!
    marker.getObjectByName('crate_source')!.removeFromParent()
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute([
      -0.2, 0, 0,
      0.2, 0, 0,
      0.2, 0.4, 0,
      -0.2, 0.4, 0,
    ], 3))
    geometry.setIndex([0, 1, 2, 0, 2, 3])
    geometry.addGroup(0, 3, 0)
    geometry.addGroup(3, 3, 1)
    const source = new Mesh(geometry, [
      new MeshStandardMaterial({ color: 0x334422 }),
      new MeshStandardMaterial({ color: 0x777777 }),
    ])
    source.name = 'crate_source'
    source.position.set(0.25, 0.1, -0.15)
    marker.add(source)

    const assembled = createOrchardWorldVisual({
      scene: new Scene(),
      assets,
      definition: ORCHARD_WORLD_DEFINITION,
    })
    const batches = assembled.root.children.filter(
      (child): child is InstancedMesh => (
        child instanceof InstancedMesh
        && child.name.startsWith('orchard-crates')
      ),
    )
    expect(batches).toHaveLength(2)
    expect(batches.map(({ count }) => count)).toEqual([8, 8])
    expect(batches.map(({ geometry: batchGeometry }) => (
      batchGeometry.getAttribute('position').count
    ))).toEqual([3, 3])
  })

  it.each([
    ['overlapping', [[0, 4, 0], [3, 3, 1]]],
    ['out-of-range', [[0, 3, 0], [35, 3, 1]]],
    ['unknown-material', [[0, 3, 0], [3, 3, 2]]],
  ] as const)('fails closed on %s crate material groups', (_, groups) => {
    const scene = new Scene()
    const assets = createSyntheticSliceAssets()
    const source = assets.environmentWorldVisual.scene
      .getObjectByName('crate_source') as Mesh
    source.material = [new MeshStandardMaterial(), new MeshStandardMaterial()]
    source.geometry.clearGroups()
    for (const [start, count, materialIndex] of groups) {
      source.geometry.addGroup(start, count, materialIndex)
    }

    expect(() => createOrchardWorldVisual({
      scene,
      assets,
      definition: ORCHARD_WORLD_DEFINITION,
    })).toThrow('WORLD_CRATE_INSTANCE_LAYOUT_INVALID')
    expect(scene.children).toHaveLength(0)
  })

  it('fails before scene mutation when a sensor visual binding is absent', () => {
    const scene = new Scene()
    const assets = createSyntheticSliceAssets()
    ;(assets.environmentWorldVisual.anchors as Map<string, Object3D>)
      .delete('harvest_basket_anchor')

    expect(() => createOrchardWorldVisual({
      scene,
      assets,
      definition: ORCHARD_WORLD_DEFINITION,
    })).toThrow(
      'WORLD_VISUAL_BINDING_MISSING: basket:harvest_basket_anchor',
    )
    expect(scene.children).toHaveLength(0)
  })

  it.each([
    ['29 trees', (definition: OrchardWorldDefinition) => {
      definition.treeInstances.pop()
    }],
    ['duplicate tree id', (definition: OrchardWorldDefinition) => {
      definition.treeInstances[1]!.id = definition.treeInstances[0]!.id
    }],
    ['missing sensor', (definition: OrchardWorldDefinition) => {
      definition.sensors.pop()
    }],
    ['duplicate sensor', (definition: OrchardWorldDefinition) => {
      definition.sensors[5]!.id = definition.sensors[0]!.id
    }],
  ] as const)('fails closed before scene attachment for %s', (_, mutate) => {
    const scene = new Scene()
    const definition = structuredClone(
      ORCHARD_WORLD_DEFINITION,
    ) as OrchardWorldDefinition
    mutate(definition)

    expect(() => createOrchardWorldVisual({
      scene,
      assets: createSyntheticSliceAssets(),
      definition,
    })).toThrow(/WORLD_(TREE_INSTANCE|SENSOR)_LAYOUT_INVALID/)
    expect(scene.children).toHaveLength(0)
  })

  it('fails closed on a missing crate marker', () => {
    const scene = new Scene()
    const assets = createSyntheticSliceAssets()
    assets.environmentWorldVisual.scene
      .getObjectByName('crate_marker_08')!
      .removeFromParent()

    expect(() => createOrchardWorldVisual({
      scene,
      assets,
      definition: ORCHARD_WORLD_DEFINITION,
    })).toThrow('WORLD_CRATE_INSTANCE_LAYOUT_INVALID')
    expect(scene.children).toHaveLength(0)
  })

  it('does not dispose source geometry or materials it shares', () => {
    const assets = createSyntheticSliceAssets()
    const source = assets.peachTreeFamilyVisual.scene
      .getObjectByName('peach_tree_variant_a_fruit_leaf') as Mesh
    const disposeGeometry = vi.spyOn(source.geometry, 'dispose')
    const disposeMaterial = vi.spyOn(source.material as MeshStandardMaterial, 'dispose')
    const assembled = createOrchardWorldVisual({
      scene: new Scene(),
      assets,
      definition: ORCHARD_WORLD_DEFINITION,
    })

    assembled.dispose()

    expect(disposeGeometry).not.toHaveBeenCalled()
    expect(disposeMaterial).not.toHaveBeenCalled()
  })
})

describe('createOrchardLighting', () => {
  it('uses the authored sky contract as a non-black scene background', () => {
    const scene = new Scene()
    const previousBackground = new Color(0x112233)
    scene.background = previousBackground
    const renderer = {
      shadowMap: { enabled: false },
    } as unknown as WebGLRenderer

    const lighting = createOrchardLighting(
      scene,
      renderer,
      ORCHARD_WORLD_DEFINITION,
    )

    expect(scene.background).toBeInstanceOf(Color)
    expect((scene.background as Color).getHex())
      .toBe(ORCHARD_WORLD_DEFINITION.lighting.sky.color)
    expect((scene.background as Color).getHex()).not.toBe(0x000000)

    lighting.dispose()
    expect(scene.background).toBe(previousBackground)
  })

  it('adds only the motivated global sky, sun, and fog', () => {
    const scene = new Scene()
    const renderer = {
      shadowMap: { enabled: false },
    } as unknown as WebGLRenderer

    const lighting = createOrchardLighting(
      scene,
      renderer,
      ORCHARD_WORLD_DEFINITION,
    )

    expect(scene.children.map(({ name }) => name)).toEqual([
      'orchard-sky', 'orchard-sun',
    ])
    const sky = scene.getObjectByName('orchard-sky') as any
    const sun = scene.getObjectByName('orchard-sun') as any
    expect([sky.color.getHex(), sky.groundColor.getHex(), sky.intensity])
      .toEqual([0xbfd8e8, 0x6a513b, 1.25])
    expect([sun.color.getHex(), sun.intensity, sun.castShadow])
      .toEqual([0xffe0b2, 2.6, true])
    expect(sun.position.length()).toBeCloseTo(40)
    const expectedSunPosition = new Vector3(
      -ORCHARD_WORLD_DEFINITION.lighting.sun.direction.x,
      -ORCHARD_WORLD_DEFINITION.lighting.sun.direction.y,
      -ORCHARD_WORLD_DEFINITION.lighting.sun.direction.z,
    ).normalize().multiplyScalar(40)
    expect(sun.position.distanceTo(expectedSunPosition)).toBeLessThan(0.001)
    expect([sun.shadow.mapSize.width, sun.shadow.mapSize.height])
      .toEqual([2048, 2048])
    expect(renderer.shadowMap.enabled).toBe(true)
    expect(scene.fog).toMatchObject({ color: expect.anything(), density: 0.008 })
    expect((scene.fog as any).color.getHex()).toBe(0xc9c1ad)

    lighting.dispose()
    expect(scene.children).toHaveLength(0)
    expect(scene.fog).toBeNull()
  })

  it('disposes the sun and shadow once and restores prior render state', () => {
    const scene = new Scene()
    const previousFog = new FogExp2(0x112233, 0.031)
    scene.fog = previousFog
    const renderer = {
      shadowMap: { enabled: false },
    } as unknown as WebGLRenderer
    const lighting = createOrchardLighting(
      scene,
      renderer,
      ORCHARD_WORLD_DEFINITION,
    )
    const sun = scene.getObjectByName('orchard-sun') as any
    const disposeSun = vi.spyOn(sun, 'dispose')
    const disposeShadow = vi.spyOn(sun.shadow, 'dispose')

    lighting.dispose()
    lighting.dispose()

    expect(disposeSun).toHaveBeenCalledTimes(1)
    expect(disposeShadow).toHaveBeenCalledTimes(1)
    expect(scene.fog).toBe(previousFog)
    expect(renderer.shadowMap.enabled).toBe(false)
  })
})
