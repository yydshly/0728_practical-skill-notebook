import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SkinnedMesh,
  Vector3,
} from 'three'
import { describe, expect, it, vi } from 'vitest'
import type { LoadedCriticalAsset } from '../../../src/feasibility/assets/loadCriticalGlb'
import {
  createBatchedTricycleVisual,
} from '../../../src/feasibility/vehicle/createBatchedTricycleVisual'

const REQUIRED_ANCHORS = [
  'driver_seat',
  'exit_left',
  'cargo_slot_01',
  'wheel_front',
  'wheel_rear_left',
  'wheel_rear_right',
] as const

interface SyntheticTricycleAsset extends LoadedCriticalAsset {
  anchors: Map<string, Object3D>
  sourceGeometries: BufferGeometry[]
  sourceMaterials: Material[]
}

function addMesh(
  root: Object3D,
  name: string,
  position: readonly [number, number, number],
  material: Material,
): BufferGeometry {
  const geometry = new BoxGeometry(0.2, 0.3, 0.4)
  const mesh = new Mesh(geometry, material)
  mesh.name = name
  mesh.position.fromArray(position)
  root.add(mesh)
  return geometry
}

export function createSyntheticTricycleAsset(): SyntheticTricycleAsset {
  const root = new Group()
  root.name = 'synthetic-tricycle'
  const anchors = new Map<string, Object3D>()
  for (const name of REQUIRED_ANCHORS) {
    const anchor = new Group()
    anchor.name = name
    root.add(anchor)
    anchors.set(name, anchor)
  }
  anchors.get('driver_seat')!.position.set(0.1, 0.9, -0.2)
  anchors.get('cargo_slot_01')!.position.set(-0.3, 1.1, 0.5)
  anchors.get('wheel_front')!.position.set(0, 0.3, -1.2)
  anchors.get('wheel_rear_left')!.position.set(0.7, 0.3, 0.9)
  anchors.get('wheel_rear_right')!.position.set(-0.7, 0.3, 0.9)

  const chassisMaterial = new MeshStandardMaterial({ color: 0x667788 })
  const wheelMaterial = new MeshStandardMaterial({ color: 0x222222 })
  const sourceGeometries = [
    addMesh(root, 'frame_left', [0.4, 0.5, 0], chassisMaterial),
    addMesh(root, 'frame_right', [-0.4, 0.5, 0], chassisMaterial),
    addMesh(root, 'wheel_front_tire', [0, 0.3, -1.2], wheelMaterial),
    addMesh(root, 'wheel_rear_left_tire', [0.7, 0.3, 0.9], wheelMaterial),
    addMesh(root, 'wheel_rear_right_tire', [-0.7, 0.3, 0.9], wheelMaterial),
  ]
  return {
    scene: root,
    anchors,
    clips: [],
    sourceGeometries,
    sourceMaterials: [chassisMaterial, wheelMaterial],
  }
}

function worldVertices(root: Object3D): string[] {
  root.updateMatrixWorld(true)
  const vertices: string[] = []
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const position = object.geometry.getAttribute('position')
    const geometryIndex = object.geometry.getIndex()
    const occurrenceCount = geometryIndex?.count ?? position.count
    for (let occurrence = 0; occurrence < occurrenceCount; occurrence += 1) {
      const index = geometryIndex?.getX(occurrence) ?? occurrence
      const vertex = new Vector3(
        position.getX(index),
        position.getY(index),
        position.getZ(index),
      ).applyMatrix4(object.matrixWorld)
      vertices.push(vertex.toArray().map((value) => value.toFixed(4)).join(','))
    }
  })
  return vertices.sort()
}

function groupedGeometry(indexed: boolean): BufferGeometry {
  const geometry = new BufferGeometry()
  if (indexed) {
    geometry.setAttribute('position', new Float32BufferAttribute([
      -0.2, 0, 0,
      0.2, 0, 0,
      0.2, 0.4, 0,
      -0.2, 0.4, 0,
    ], 3))
    geometry.setIndex([0, 1, 2, 0, 2, 3])
  } else {
    geometry.setAttribute('position', new Float32BufferAttribute([
      -0.2, 0, 0, 0.2, 0, 0, 0.2, 0.4, 0,
      -0.2, 0, 0, 0.2, 0.4, 0, -0.2, 0.4, 0,
    ], 3))
  }
  geometry.addGroup(0, 3, 0)
  geometry.addGroup(3, 3, 1)
  return geometry
}

function replaceAnchorWithMesh(
  asset: SyntheticTricycleAsset,
  name: typeof REQUIRED_ANCHORS[number],
  material: Material,
): Mesh {
  const previous = asset.anchors.get(name)!
  const parent = previous.parent!
  const mesh = new Mesh(new BoxGeometry(0.12, 0.16, 0.18), material)
  mesh.name = name
  mesh.position.copy(previous.position)
  mesh.quaternion.copy(previous.quaternion)
  mesh.scale.copy(previous.scale)
  for (const child of [...previous.children]) mesh.add(child)
  parent.add(mesh)
  previous.removeFromParent()
  asset.anchors.set(name, mesh)
  asset.sourceGeometries.push(mesh.geometry)
  return mesh
}

describe('createBatchedTricycleVisual', () => {
  it('batches the rigid tricycle while preserving anchors and wheel parents', () => {
    const asset = createSyntheticTricycleAsset()
    const before = worldVertices(asset.scene)
    const sourceVertexCount = asset.sourceGeometries.reduce(
      (total, geometry) => total + geometry.getAttribute('position').count,
      0,
    )
    const sourceIndexCount = asset.sourceGeometries.reduce(
      (total, geometry) => total + (geometry.index?.count ?? 0),
      0,
    )

    const batched = createBatchedTricycleVisual(asset)

    expect(batched.drawBatchCount).toBeLessThanOrEqual(20)
    expect(batched.drawBatchCount).toBe(4)
    expect(batched.root.getObjectByName('driver_seat')).toBeDefined()
    expect(batched.root.getObjectByName('cargo_slot_01')).toBeDefined()
    expect(batched.root.getObjectByName('wheel_front')).toBeDefined()
    expect(worldVertices(batched.root)).toEqual(before)
    const batchGeometries: BufferGeometry[] = []
    batched.root.traverse((object) => {
      if (object instanceof Mesh && object.name.startsWith('vehicle-batch-')) {
        batchGeometries.push(object.geometry)
      }
    })
    expect(batchGeometries.every(({ index }) => index !== null)).toBe(true)
    expect(batchGeometries.reduce((total, geometry) => (
      total + geometry.getAttribute('position').count
    ), 0)).toBe(sourceVertexCount)
    expect(batchGeometries.reduce((total, geometry) => (
      total + (geometry.index?.count ?? 0)
    ), 0)).toBe(sourceIndexCount)
    for (const name of [
      'wheel_front', 'wheel_rear_left', 'wheel_rear_right',
    ]) {
      const wheel = batched.root.getObjectByName(name)!
      expect(wheel.children.some((child) => child instanceof Mesh)).toBe(true)
      wheel.rotateX(0.25)
      expect(wheel.rotation.x).toBeCloseTo(0.25, 3)
    }
  })

  it('disposes only cloned merged geometries', () => {
    const asset = createSyntheticTricycleAsset()
    const sourceGeometryDisposals = asset.sourceGeometries.map(
      (geometry) => vi.spyOn(geometry, 'dispose'),
    )
    const sourceMaterialDisposals = asset.sourceMaterials.map(
      (material) => vi.spyOn(material, 'dispose'),
    )
    const batched = createBatchedTricycleVisual(asset)
    const batchGeometryDisposals: ReturnType<typeof vi.spyOn>[] = []
    batched.root.traverse((object) => {
      if (object instanceof Mesh) {
        batchGeometryDisposals.push(vi.spyOn(object.geometry, 'dispose'))
      }
    })

    batched.dispose()

    expect(batchGeometryDisposals.every((spy) => spy.mock.calls.length === 1))
      .toBe(true)
    expect(sourceGeometryDisposals.every((spy) => spy.mock.calls.length === 0))
      .toBe(true)
    expect(sourceMaterialDisposals.every((spy) => spy.mock.calls.length === 0))
      .toBe(true)
  })

  it('preserves mesh anchors, mesh ancestors, subtrees, and restores sources', () => {
    const asset = createSyntheticTricycleAsset()
    const detailMaterial = new MeshStandardMaterial({ color: 0x44aa88 })
    asset.sourceMaterials.push(detailMaterial)
    const driverSeat = replaceAnchorWithMesh(
      asset,
      'driver_seat',
      detailMaterial,
    )
    const driverControl = new Group()
    driverControl.name = 'driver-control-subtree'
    driverControl.position.set(0.03, 0.12, -0.02)
    driverSeat.add(driverControl)

    const cargoSlot = asset.anchors.get('cargo_slot_01')!
    const cargoParent = new Mesh(
      new BoxGeometry(0.2, 0.08, 0.3),
      detailMaterial,
    )
    cargoParent.name = 'cargo-slot-mesh-ancestor'
    cargoParent.position.set(0.15, 0.05, -0.1)
    asset.scene.add(cargoParent)
    cargoParent.attach(cargoSlot)
    asset.sourceGeometries.push(cargoParent.geometry)

    const wheelFront = replaceAnchorWithMesh(
      asset,
      'wheel_front',
      detailMaterial,
    )
    const frontTire = asset.scene.getObjectByName('wheel_front_tire')!
    wheelFront.attach(frontTire)
    const wheelDetail = new Group()
    wheelDetail.name = 'wheel-front-detail-subtree'
    wheelFront.add(wheelDetail)

    asset.scene.updateMatrixWorld(true)
    const anchors = new Map(REQUIRED_ANCHORS.map((name) => [
      name,
      asset.anchors.get(name)!,
    ]))
    const anchorMatrices = new Map([...anchors].map(([name, anchor]) => [
      name,
      anchor.matrixWorld.clone(),
    ]))
    const sourceMeshes: Mesh[] = []
    asset.scene.traverse((object) => {
      if (object instanceof Mesh) sourceMeshes.push(object)
    })
    const sourceState = new Map(sourceMeshes.map((mesh) => [mesh, {
      parent: mesh.parent,
      childIndex: mesh.parent!.children.indexOf(mesh),
      geometry: mesh.geometry,
      material: mesh.material,
    }]))
    const before = worldVertices(asset.scene)

    const batched = createBatchedTricycleVisual(asset)

    for (const [name, anchor] of anchors) {
      expect(batched.root.getObjectByName(name)).toBe(anchor)
      expect(anchor.matrixWorld.equals(anchorMatrices.get(name)!)).toBe(true)
    }
    expect(driverSeat.getObjectByName('driver-control-subtree'))
      .toBe(driverControl)
    expect(cargoSlot.parent).toBe(cargoParent)
    expect(wheelFront.getObjectByName('wheel-front-detail-subtree'))
      .toBe(wheelDetail)
    expect(worldVertices(batched.root)).toEqual(before)

    const wheelBatch = wheelFront.children.find((child) => (
      child instanceof Mesh && child.name.startsWith('vehicle-batch-wheel_front')
    ))!
    const beforeWheelBatch = wheelBatch.matrixWorld.clone()
    wheelFront.rotateX(0.25)
    batched.root.updateMatrixWorld(true)
    expect(wheelBatch.matrixWorld.equals(beforeWheelBatch)).toBe(false)
    wheelFront.rotateX(-0.25)
    batched.root.updateMatrixWorld(true)

    batched.dispose()

    for (const [mesh, state] of sourceState) {
      expect(mesh.parent).toBe(state.parent)
      expect(state.parent!.children.indexOf(mesh)).toBe(state.childIndex)
      expect(mesh.geometry).toBe(state.geometry)
      expect(mesh.material).toBe(state.material)
    }
    expect(worldVertices(asset.scene)).toEqual(before)
  })

  it('rolls back source mutations if post-mutation anchor validation fails', () => {
    const asset = createSyntheticTricycleAsset()
    const before = worldVertices(asset.scene)
    const driverSeat = asset.anchors.get('driver_seat')!
    const originalLookup = asset.scene.getObjectByName.bind(asset.scene)
    let driverLookupCount = 0
    vi.spyOn(asset.scene, 'getObjectByName').mockImplementation((name) => {
      if (name === 'driver_seat' && driverLookupCount++ > 0) return undefined
      return originalLookup(name)
    })

    expect(() => createBatchedTricycleVisual(asset))
      .toThrow(/VEHICLE_BATCH_ANCHOR_MUTATED/)
    expect(originalLookup('driver_seat')).toBe(driverSeat)
    expect(worldVertices(asset.scene)).toEqual(before)
  })

  it.each([true, false])(
    'preserves every %s multi-material group and shared mesh occurrence',
    (indexed) => {
      const asset = createSyntheticTricycleAsset()
      const geometry = groupedGeometry(indexed)
      const materials = [
        new MeshStandardMaterial({ color: 0xaa3300 }),
        new MeshStandardMaterial({ color: 0x0033aa }),
      ]
      for (const [name, x] of [['left', -0.5], ['right', 0.5]] as const) {
        const mesh = new Mesh(geometry, materials)
        mesh.name = `shared-grouped-${name}`
        mesh.position.set(x, 1.2, 0.25)
        asset.scene.add(mesh)
      }
      const before = worldVertices(asset.scene)

      const batched = createBatchedTricycleVisual(asset)

      expect(batched.drawBatchCount).toBe(6)
      expect(worldVertices(batched.root)).toEqual(before)
    },
  )

  it.each([
    ['overlapping', [[0, 4, 0], [3, 3, 1]]],
    ['out-of-range', [[0, 3, 0], [35, 3, 1]]],
    ['unknown-material', [[0, 3, 0], [3, 3, 2]]],
  ] as const)('fails closed on %s vehicle material groups', (_, groups) => {
    const asset = createSyntheticTricycleAsset()
    const mesh = asset.scene.getObjectByName('frame_left') as Mesh
    mesh.material = [new MeshStandardMaterial(), new MeshStandardMaterial()]
    mesh.geometry.clearGroups()
    for (const [start, count, materialIndex] of groups) {
      mesh.geometry.addGroup(start, count, materialIndex)
    }
    const before = worldVertices(asset.scene)

    expect(() => createBatchedTricycleVisual(asset)).toThrow(/GROUP_INVALID/)
    expect(worldVertices(asset.scene)).toEqual(before)
  })

  it('fails closed rather than exceeding the 20 batch budget', () => {
    const asset = createSyntheticTricycleAsset()
    for (let index = 0; index < 21; index += 1) {
      const material = new MeshStandardMaterial({ color: index })
      asset.sourceMaterials.push(material)
      asset.sourceGeometries.push(addMesh(
        asset.scene,
        `unique-material-${index}`,
        [index, 0, 0],
        material,
      ))
    }

    expect(() => createBatchedTricycleVisual(asset)).toThrow(/20/)
    expect(asset.scene.children.filter((child) => child instanceof Mesh))
      .toHaveLength(26)
  })

  it.each(['skinned', 'morph'] as const)(
    'rejects unsupported %s rendering instead of changing semantics',
    (kind) => {
      const asset = createSyntheticTricycleAsset()
      if (kind === 'skinned') {
        const mesh = new SkinnedMesh(
          new BoxGeometry(1, 1, 1),
          new MeshStandardMaterial(),
        )
        mesh.name = 'unsupported-skinned'
        asset.scene.add(mesh)
      } else {
        const mesh = asset.scene.getObjectByName('frame_left') as Mesh
        mesh.geometry.morphAttributes.position = [new Float32BufferAttribute(
          new Float32Array(mesh.geometry.getAttribute('position').count * 3),
          3,
        )]
      }

      expect(() => createBatchedTricycleVisual(asset)).toThrow(/rigid/i)
    },
  )
})
