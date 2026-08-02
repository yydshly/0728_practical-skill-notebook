import {
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  SkinnedMesh,
  type Material,
  type Object3D,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { extractMeshMaterialGeometries } from '../assets/extractMeshMaterialGeometries'
import type { LoadedCriticalAsset } from '../assets/loadCriticalGlb'

const MAX_DRAW_BATCHES = 20
const REQUIRED_ANCHORS = [
  'driver_seat',
  'exit_left',
  'cargo_slot_01',
  'wheel_front',
  'wheel_rear_left',
  'wheel_rear_right',
] as const
const WHEEL_NAMES = [
  'wheel_front',
  'wheel_rear_left',
  'wheel_rear_right',
] as const

export interface BatchedTricycleVisual {
  readonly root: Object3D
  readonly drawBatchCount: number
  dispose(): void
}

interface OwnershipPartition {
  readonly name: 'chassis' | typeof WHEEL_NAMES[number]
  readonly owner: Object3D
  readonly geometriesByMaterial: Map<Material, BatchGeometrySource[]>
}

interface BatchGeometrySource {
  readonly geometry: BufferGeometry
  readonly sourceMesh: Mesh
}

interface SourceMeshState {
  readonly mesh: Mesh
  readonly parent: Object3D | null
  readonly childIndex: number
  readonly geometry: BufferGeometry
  readonly material: Material | Material[]
  readonly protectedHierarchyNode: boolean
  placeholder?: BufferGeometry
}

function requireAnchor(asset: LoadedCriticalAsset, name: string): Object3D {
  const anchor = asset.anchors.get(name)
  if (!anchor || asset.scene.getObjectByName(name) !== anchor) {
    throw new Error(`VEHICLE_BATCH_ANCHOR_MISSING: ${name}`)
  }
  return anchor
}

function isDescendantOf(object: Object3D, ancestor: Object3D): boolean {
  for (let parent = object.parent; parent; parent = parent.parent) {
    if (parent === ancestor) return true
  }
  return false
}

function isRootOrDescendantOf(object: Object3D, root: Object3D): boolean {
  return object === root || isDescendantOf(object, root)
}

function rejectUnsupportedMesh(mesh: Mesh): void {
  if (mesh instanceof SkinnedMesh) {
    throw new Error('VEHICLE_BATCH_REQUIRES_RIGID_MESHES: skinned mesh')
  }
  const hasMorphTargets = Object.values(mesh.geometry.morphAttributes)
    .some((attributes) => attributes.length > 0)
  if (hasMorphTargets || mesh.morphTargetInfluences !== undefined) {
    throw new Error('VEHICLE_BATCH_REQUIRES_RIGID_MESHES: morph targets')
  }
}

function ownerForMesh(
  mesh: Mesh,
  wheels: ReadonlyMap<string, Object3D>,
): Object3D | undefined {
  for (const wheelName of WHEEL_NAMES) {
    const wheel = wheels.get(wheelName)!
    if (
      mesh === wheel
      || isDescendantOf(mesh, wheel)
      || mesh.name.startsWith(`${wheelName}_`)
    ) {
      return wheel
    }
  }
  return undefined
}

function disposeGeometries(geometries: readonly BufferGeometry[]): void {
  for (const geometry of geometries) geometry.dispose()
}

function emptyPlaceholderGeometry(): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute([], 3))
  return geometry
}

function restoreChildAt(
  child: Object3D,
  parent: Object3D | null,
  childIndex: number,
): void {
  if (!parent) {
    child.removeFromParent()
    return
  }
  if (child.parent !== parent) parent.add(child)
  const currentIndex = parent.children.indexOf(child)
  if (currentIndex < 0) return
  parent.children.splice(currentIndex, 1)
  parent.children.splice(
    Math.min(Math.max(childIndex, 0), parent.children.length),
    0,
    child,
  )
}

export function createBatchedTricycleVisual(
  asset: LoadedCriticalAsset,
): BatchedTricycleVisual {
  const root = asset.scene
  const anchors = new Map(REQUIRED_ANCHORS.map((name) => [
    name,
    requireAnchor(asset, name),
  ]))
  const wheels = new Map(WHEEL_NAMES.map((name) => [name, anchors.get(name)!]))
  const protectedHierarchyNodes = new Set<Object3D>([root])
  for (const anchor of anchors.values()) {
    for (let object: Object3D | null = anchor; object; object = object.parent) {
      protectedHierarchyNodes.add(object)
      if (object === root) break
    }
  }
  const originalRootParent = root.parent
  const originalRootChildIndex = originalRootParent?.children.indexOf(root) ?? -1
  root.updateMatrixWorld(true)

  const partitions = new Map<Object3D, OwnershipPartition>()
  partitions.set(root, {
    name: 'chassis',
    owner: root,
    geometriesByMaterial: new Map(),
  })
  for (const wheelName of WHEEL_NAMES) {
    const owner = wheels.get(wheelName)!
    partitions.set(owner, {
      name: wheelName,
      owner,
      geometriesByMaterial: new Map(),
    })
  }

  const sourceMeshes: Mesh[] = []
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    rejectUnsupportedMesh(object)
    sourceMeshes.push(object)
  })
  const sourceMeshStates: SourceMeshState[] = sourceMeshes.map((mesh) => ({
    mesh,
    parent: mesh.parent,
    childIndex: mesh.parent?.children.indexOf(mesh) ?? -1,
    geometry: mesh.geometry,
    material: mesh.material,
    protectedHierarchyNode: protectedHierarchyNodes.has(mesh),
  }))

  const batches: Mesh[] = []
  const mergedGeometries: BufferGeometry[] = []
  const extractedGeometries: BufferGeometry[] = []
  try {
    for (const sourceMesh of sourceMeshes) {
      const owner = ownerForMesh(sourceMesh, wheels) ?? root
      const partition = partitions.get(owner)!
      const ownerInverse = owner.matrixWorld.clone().invert()
      const slices = extractMeshMaterialGeometries(
        sourceMesh,
        'VEHICLE_MATERIAL_GROUP_INVALID',
      )
      for (const slice of slices) {
        slice.geometry.applyMatrix4(
          ownerInverse.clone().multiply(sourceMesh.matrixWorld),
        )
        extractedGeometries.push(slice.geometry)
        const sources = partition.geometriesByMaterial.get(slice.material) ?? []
        sources.push({ geometry: slice.geometry, sourceMesh })
        partition.geometriesByMaterial.set(slice.material, sources)
      }
    }
    for (const partition of partitions.values()) {
      let materialIndex = 0
      for (const [material, sources] of partition.geometriesByMaterial) {
        const merged = mergeGeometries(
          sources.map(({ geometry }) => geometry),
          false,
        )
        if (!merged) {
          throw new Error(
            `VEHICLE_BATCH_GEOMETRY_MERGE_FAILED: ${partition.name}`,
          )
        }
        const batch = new Mesh(merged, material)
        batch.name = `vehicle-batch-${partition.name}-${materialIndex}`
        batch.matrixAutoUpdate = false
        batch.castShadow = sources.some(({ sourceMesh }) => sourceMesh.castShadow)
        batch.receiveShadow = sources.some(({ sourceMesh }) => (
          sourceMesh.receiveShadow
        ))
        batches.push(batch)
        mergedGeometries.push(merged)
        materialIndex += 1
      }
    }
    if (batches.length > MAX_DRAW_BATCHES) {
      throw new Error(
        `VEHICLE_DRAW_BATCH_LIMIT_EXCEEDED: ${batches.length} > ${MAX_DRAW_BATCHES}`,
      )
    }
  } catch (error) {
    disposeGeometries(mergedGeometries)
    throw error
  } finally {
    disposeGeometries(extractedGeometries)
  }

  let sourceRestored = false
  const restoreSources = (): void => {
    if (sourceRestored) return
    sourceRestored = true
    for (const batch of batches) batch.removeFromParent()
    for (const state of sourceMeshStates) {
      if (state.protectedHierarchyNode) {
        state.mesh.geometry = state.geometry
        state.mesh.material = state.material
      } else {
        restoreChildAt(state.mesh, state.parent, state.childIndex)
      }
    }
    for (const state of sourceMeshStates) state.placeholder?.dispose()
    root.updateMatrixWorld(true)
  }

  try {
    for (const state of sourceMeshStates) {
      if (state.protectedHierarchyNode) {
        state.placeholder = emptyPlaceholderGeometry()
        state.mesh.geometry = state.placeholder
      } else {
        state.mesh.removeFromParent()
      }
    }
    for (const batch of batches) {
      const partition = [...partitions.values()].find(({ name }) => (
        batch.name.startsWith(`vehicle-batch-${name}-`)
      ))!
      partition.owner.add(batch)
    }
    root.updateMatrixWorld(true)
    for (const [name, anchor] of anchors) {
      if (
        root.getObjectByName(name) !== anchor
        || !isRootOrDescendantOf(anchor, root)
      ) {
        throw new Error(`VEHICLE_BATCH_ANCHOR_MUTATED: ${name}`)
      }
    }
  } catch (error) {
    restoreSources()
    disposeGeometries(mergedGeometries)
    throw error
  }

  let disposed = false
  return {
    root,
    drawBatchCount: batches.length,
    dispose() {
      if (disposed) return
      disposed = true
      restoreSources()
      restoreChildAt(root, originalRootParent, originalRootChildIndex)
      disposeGeometries(mergedGeometries)
    },
  }
}
