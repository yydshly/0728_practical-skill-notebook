import {
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
  Vector3,
  type Object3D,
  type Scene,
  type BufferGeometry,
  type Material,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { SliceAssets } from '../assets/SliceAssetLoader'
import { extractMeshMaterialGeometries } from '../assets/extractMeshMaterialGeometries'
import type { OwnerId } from '../domain/types'
import type {
  OrchardSensorId,
  OrchardTreeInstance,
  OrchardWorldDefinition,
} from './orchardWorldDefinition'
import { validateOrchardWorldDefinition } from './validateOrchardWorldDefinition'

const TREE_VARIANT_NODES = {
  a: 'peach_tree_variant_a',
  b: 'peach_tree_variant_b',
  c: 'peach_tree_variant_c',
} as const
const STATE_GROUP_NAMES = [
  'harvest_basket_empty',
  'harvest_basket_full',
  'packing_crate_empty',
  'packing_crate_full',
  'delivery_complete',
] as const
const Y_AXIS = new Vector3(0, 1, 0)
const ZERO_SCALE = new Vector3(0, 0, 0)
const REQUIRED_SENSOR_IDS: readonly OrchardSensorId[] = [
  'parking', 'tree-inventory', 'basket',
  'crate', 'cargo-slot', 'delivery',
]

export const ORCHARD_TREE_SHADOW_ROUTE_DISTANCE_M = 14

type TreeDistancePartition = 'near' | 'far'
type TreeMeshRole = 'fruit' | 'branch' | 'trunk' | 'crown' | 'leaf' | 'other'
const TREE_SHADOW_ROLES = new Set<TreeMeshRole>([
  'branch', 'trunk', 'crown', 'leaf',
])

interface TreeInstanceRecord {
  readonly variant: OrchardTreeInstance['variant']
  readonly partition: TreeDistancePartition
  readonly instanceIndex: number
}

interface FruitInstanceBinding {
  readonly batch: InstancedMesh
  readonly instanceIndex: number
  readonly authoredMatrix: Matrix4
}

interface StateGroups {
  readonly basketEmpty: Object3D
  readonly basketFull: Object3D
  readonly crateEmpty: Object3D
  readonly crateFull: Object3D
  readonly deliveryComplete: Object3D
}

export interface OrchardWorldVisual {
  readonly root: Group
  readonly treeInstanceCount: number
  readonly nearTreeInstanceCount: number
  readonly farTreeInstanceCount: number
  readonly treeRenderBatchCount: number
  readonly crateInstanceCount: number
  readonly boundSensorIds: readonly OrchardSensorId[]
  applyFruitOwner(owner: OwnerId): void
  stateVisibility(): Readonly<{
    activeTreeFruit: boolean
    basketFull: boolean
    crateFull: boolean
    cargoLoaded: boolean
    deliveryComplete: boolean
  }>
  dispose(): void
}

function uniqueNamed(root: Object3D, name: string): Object3D | undefined {
  const matches: Object3D[] = []
  root.traverse((object) => {
    if (object.name === name) matches.push(object)
  })
  return matches.length === 1 ? matches[0] : undefined
}

function requiredUnique(root: Object3D, name: string, error: string): Object3D {
  const object = uniqueNamed(root, name)
  if (!object) throw new Error(error)
  return object
}

function treePoseMatrix(tree: OrchardTreeInstance): Matrix4 {
  return new Matrix4().compose(
    new Vector3(tree.translation.x, tree.translation.y, tree.translation.z),
    new Quaternion().setFromAxisAngle(Y_AXIS, tree.yawRadians),
    new Vector3(tree.uniformScale, tree.uniformScale, tree.uniformScale),
  )
}

function relativeMatrix(root: Object3D, object: Object3D): Matrix4 {
  root.updateWorldMatrix(true, true)
  return root.matrixWorld.clone().invert().multiply(object.matrixWorld)
}

function stableTreeBatchName(
  variant: string,
  sourceName: string,
  partition: TreeDistancePartition,
): string {
  const sourcePrefix = `peach_tree_variant_${variant}_`
  const part = sourceName.startsWith(sourcePrefix)
    ? sourceName.slice(sourcePrefix.length)
    : sourceName
  return `orchard-tree-${variant}-${part.replace(/_mesh$/, '')}-${partition}`
}

function distanceToRouteSegment(
  point: Readonly<{ x: number; z: number }>,
  from: Readonly<{ x: number; z: number }>,
  to: Readonly<{ x: number; z: number }>,
): number {
  const dx = to.x - from.x
  const dz = to.z - from.z
  const lengthSquared = dx * dx + dz * dz
  const projection = lengthSquared === 0
    ? 0
    : ((point.x - from.x) * dx + (point.z - from.z) * dz) / lengthSquared
  const t = Math.max(0, Math.min(1, projection))
  return Math.hypot(
    point.x - (from.x + dx * t),
    point.z - (from.z + dz * t),
  )
}

function distanceToAuthoredRoute(
  tree: OrchardTreeInstance,
  definition: OrchardWorldDefinition,
): number {
  const distances = [definition.route.outbound, definition.route.returning]
    .flatMap((path) => path.slice(1).map((to, index) => (
      distanceToRouteSegment(tree.translation, path[index]!, to)
    )))
  return Math.min(...distances)
}

function treeDistancePartition(
  tree: OrchardTreeInstance,
  definition: OrchardWorldDefinition,
): TreeDistancePartition {
  return distanceToAuthoredRoute(tree, definition)
    <= ORCHARD_TREE_SHADOW_ROUTE_DISTANCE_M
    ? 'near'
    : 'far'
}

function validateTaskFourLayout(definition: OrchardWorldDefinition): void {
  const treeIds = definition.treeInstances.map(({ id }) => id)
  if (treeIds.length !== 30 || new Set(treeIds).size !== 30) {
    throw new Error('WORLD_TREE_INSTANCE_LAYOUT_INVALID')
  }
  const sensorIds = definition.sensors.map(({ id }) => id)
  const uniqueSensorIds = new Set(sensorIds)
  if (
    sensorIds.length !== REQUIRED_SENSOR_IDS.length
    || uniqueSensorIds.size !== REQUIRED_SENSOR_IDS.length
    || REQUIRED_SENSOR_IDS.some((id) => !uniqueSensorIds.has(id))
  ) {
    throw new Error('WORLD_SENSOR_LAYOUT_INVALID')
  }
  validateOrchardWorldDefinition(definition)
}

export function classifyTreeMeshRole(name: string): TreeMeshRole {
  const normalized = name.toLowerCase()
  if (normalized.includes('fruit')) return 'fruit'
  if (normalized.includes('branch')) return 'branch'
  if (normalized.includes('trunk')) return 'trunk'
  if (normalized.includes('crown')) return 'crown'
  if (normalized.includes('leaf')) return 'leaf'
  return 'other'
}

export function createOrchardWorldVisual(input: Readonly<{
  scene: Scene
  assets: SliceAssets
  definition: OrchardWorldDefinition
}>): OrchardWorldVisual {
  const { scene, assets, definition } = input
  validateTaskFourLayout(definition)
  const partitionedTrees = definition.treeInstances.map((tree) => ({
    tree,
    partition: treeDistancePartition(tree, definition),
  }))
  const nearTreeInstanceCount = partitionedTrees.filter(
    ({ partition }) => partition === 'near',
  ).length
  const farTreeInstanceCount = partitionedTrees.length - nearTreeInstanceCount
  const root = new Group()
  root.name = 'orchard-world'
  root.add(assets.environmentWorldVisual.scene.clone(true))
  const instanceBatches: InstancedMesh[] = []
  const ownedCrateGeometries: BufferGeometry[] = []
  const treeRecords = new Map<string, TreeInstanceRecord>()
  const fruitBatches = new Map<string, InstancedMesh[]>()
  let treeRenderBatchCount = 0

  try {
    for (const variant of ['a', 'b', 'c'] as const) {
      const variantRoot = assets.peachTreeFamilyVisual.anchors.get(
        TREE_VARIANT_NODES[variant],
      )
      if (!variantRoot) {
        throw new Error(`WORLD_TREE_VARIANT_MISSING: ${TREE_VARIANT_NODES[variant]}`)
      }
      const sourceMeshes: Mesh[] = []
      variantRoot.traverse((object) => {
        if (object instanceof Mesh) sourceMeshes.push(object)
      })
      if (sourceMeshes.length === 0) {
        throw new Error(`WORLD_TREE_VARIANT_EMPTY: ${TREE_VARIANT_NODES[variant]}`)
      }
      for (const partition of ['near', 'far'] as const) {
        const instances = partitionedTrees
          .filter(({ tree, partition: treePartition }) => (
            tree.variant === variant && treePartition === partition
          ))
          .map(({ tree }) => tree)
        instances.forEach((tree, instanceIndex) => {
          treeRecords.set(tree.id, { variant, partition, instanceIndex })
        })
        if (instances.length === 0) continue
        for (const sourceMesh of sourceMeshes) {
          const role = classifyTreeMeshRole(sourceMesh.name)
          const batch = new InstancedMesh(
            sourceMesh.geometry,
            sourceMesh.material,
            instances.length,
          )
          batch.name = stableTreeBatchName(variant, sourceMesh.name, partition)
          batch.matrixAutoUpdate = false
          batch.castShadow = partition === 'near' && TREE_SHADOW_ROLES.has(role)
          batch.receiveShadow = TREE_SHADOW_ROLES.has(role)
          const childMatrix = relativeMatrix(variantRoot, sourceMesh)
          instances.forEach((tree, instanceIndex) => {
            batch.setMatrixAt(
              instanceIndex,
              treePoseMatrix(tree).multiply(childMatrix),
            )
          })
          batch.instanceMatrix.needsUpdate = true
          root.add(batch)
          instanceBatches.push(batch)
          treeRenderBatchCount += 1
          if (role === 'fruit') {
            const key = `${variant}:${partition}`
            const batches = fruitBatches.get(key) ?? []
            batches.push(batch)
            fruitBatches.set(key, batches)
          }
        }
      }
    }

    const crateSourceObject = requiredUnique(
      root,
      'crate_source',
      'WORLD_CRATE_INSTANCE_LAYOUT_INVALID',
    )
    const crateMeshes: Mesh[] = []
    crateSourceObject.traverse((object) => {
      if (!(object instanceof Mesh)) return
      crateMeshes.push(object)
    })
    if (crateMeshes.length === 0) throw new Error('WORLD_CRATE_INSTANCE_LAYOUT_INVALID')
    const crateMarkers = Array.from({ length: 8 }, (_, index) => requiredUnique(
      root,
      `crate_marker_${String(index + 1).padStart(2, '0')}`,
      'WORLD_CRATE_INSTANCE_LAYOUT_INVALID',
    ))
    root.updateWorldMatrix(true, true)
    const rootInverse = root.matrixWorld.clone().invert()
    const markerOneInverse = crateMarkers[0]!.matrixWorld.clone().invert()
    const sourceRelativeToMarker = markerOneInverse.clone()
      .multiply(crateSourceObject.matrixWorld)
    const crateGeometriesByMaterial = new Map<Material, BufferGeometry[]>()
    const crateGeometrySlices: BufferGeometry[] = []
    try {
      for (const mesh of crateMeshes) {
        const slices = extractMeshMaterialGeometries(
          mesh,
          'WORLD_CRATE_INSTANCE_LAYOUT_INVALID',
        )
        for (const slice of slices) {
          slice.geometry.applyMatrix4(
            markerOneInverse.clone().multiply(mesh.matrixWorld),
          )
          crateGeometrySlices.push(slice.geometry)
          const geometries = crateGeometriesByMaterial.get(slice.material) ?? []
          geometries.push(slice.geometry)
          crateGeometriesByMaterial.set(slice.material, geometries)
        }
      }
      let crateBatchIndex = 0
      for (const [material, geometries] of crateGeometriesByMaterial) {
        const mergedGeometry = mergeGeometries(geometries, false)
        if (!mergedGeometry) {
          throw new Error('WORLD_CRATE_INSTANCE_LAYOUT_INVALID')
        }
        ownedCrateGeometries.push(mergedGeometry)
        const crateBatch = new InstancedMesh(
          mergedGeometry,
          material,
          crateMarkers.length,
        )
        crateBatch.name = crateBatchIndex === 0
          ? 'orchard-crates'
          : `orchard-crates-${crateBatchIndex}`
        crateBatch.matrixAutoUpdate = false
        crateBatch.castShadow = true
        crateBatch.receiveShadow = true
        crateMarkers.forEach((marker, index) => {
          crateBatch.setMatrixAt(
            index,
            rootInverse.clone().multiply(marker.matrixWorld),
          )
        })
        crateBatch.instanceMatrix.needsUpdate = true
        root.add(crateBatch)
        instanceBatches.push(crateBatch)
        crateBatchIndex += 1
      }
    } finally {
      for (const geometry of crateGeometrySlices) geometry.dispose()
    }
    const cargoClone = crateSourceObject.clone(true)
    cargoClone.name = 'orchard-cargo-crate'
    cargoClone.matrix.copy(sourceRelativeToMarker)
    cargoClone.matrixAutoUpdate = false
    cargoClone.visible = false
    crateSourceObject.removeFromParent()

    const stateNodes = new Map(STATE_GROUP_NAMES.map((name) => [
      name,
      requiredUnique(root, name, `WORLD_STATE_GROUP_MISSING: ${name}`),
    ]))
    const stateGroups: StateGroups = {
      basketEmpty: stateNodes.get('harvest_basket_empty')!,
      basketFull: stateNodes.get('harvest_basket_full')!,
      crateEmpty: stateNodes.get('packing_crate_empty')!,
      crateFull: stateNodes.get('packing_crate_full')!,
      deliveryComplete: stateNodes.get('delivery_complete')!,
    }

    let cargoAnchor: Object3D | undefined
    let activeTreeRecord: TreeInstanceRecord | undefined
    const boundSensorIds: OrchardSensorId[] = []
    for (const sensor of definition.sensors) {
      const binding = sensor.visualBinding
      const target = binding.kind === 'tree-instance'
        ? binding.instanceId
        : binding.nodeName
      let resolved = false
      if (binding.kind === 'world-node') {
        resolved = assets.environmentWorldVisual.anchors.has(binding.nodeName)
      } else if (binding.kind === 'tree-instance') {
        activeTreeRecord = treeRecords.get(binding.instanceId)
        resolved = activeTreeRecord !== undefined
      } else {
        cargoAnchor = assets.vehicleVisual.anchors.get(binding.nodeName)
        resolved = cargoAnchor !== undefined
      }
      if (!resolved) {
        throw new Error(`WORLD_VISUAL_BINDING_MISSING: ${sensor.id}:${target}`)
      }
      boundSensorIds.push(sensor.id)
    }
    if (!activeTreeRecord) {
      throw new Error('WORLD_VISUAL_BINDING_MISSING: tree-inventory:tree-instance')
    }
    const activeFruitBatches = fruitBatches.get(
      `${activeTreeRecord.variant}:${activeTreeRecord.partition}`,
    ) ?? []
    if (activeFruitBatches.length === 0) {
      throw new Error('WORLD_ACTIVE_TREE_FRUIT_MISSING')
    }
    const activeFruitBindings: FruitInstanceBinding[] = activeFruitBatches.map(
      (batch) => {
        const authoredMatrix = new Matrix4()
        batch.getMatrixAt(activeTreeRecord!.instanceIndex, authoredMatrix)
        return {
          batch,
          instanceIndex: activeTreeRecord!.instanceIndex,
          authoredMatrix,
        }
      },
    )

    cargoAnchor!.add(cargoClone)
    scene.add(root)
    let currentOwner: OwnerId | undefined
    const applyFruitOwner = (owner: OwnerId): void => {
      if (owner === currentOwner) return
      currentOwner = owner
      const fruitVisible = owner === 'tree'
      for (const binding of activeFruitBindings) {
        const matrix = fruitVisible
          ? binding.authoredMatrix
          : binding.authoredMatrix.clone().scale(ZERO_SCALE)
        binding.batch.setMatrixAt(binding.instanceIndex, matrix)
        binding.batch.instanceMatrix.needsUpdate = true
      }
      stateGroups.basketEmpty.visible = owner !== 'basket'
      stateGroups.basketFull.visible = owner === 'basket'
      stateGroups.crateEmpty.visible = owner !== 'crate'
      stateGroups.crateFull.visible = owner === 'crate'
      cargoClone.visible = owner === 'vehicle'
      stateGroups.deliveryComplete.visible = owner === 'delivered'
    }
    applyFruitOwner('tree')

    let disposed = false
    return {
      root,
      treeInstanceCount: definition.treeInstances.length,
      nearTreeInstanceCount,
      farTreeInstanceCount,
      treeRenderBatchCount,
      crateInstanceCount: crateMarkers.length,
      boundSensorIds: Object.freeze([...boundSensorIds]),
      applyFruitOwner,
      stateVisibility: () => Object.freeze({
        activeTreeFruit: currentOwner === 'tree',
        basketFull: stateGroups.basketFull.visible,
        crateFull: stateGroups.crateFull.visible,
        cargoLoaded: cargoClone.visible,
        deliveryComplete: stateGroups.deliveryComplete.visible,
      }),
      dispose() {
        if (disposed) return
        disposed = true
        root.removeFromParent()
        cargoClone.removeFromParent()
        for (const batch of instanceBatches) batch.dispose()
        for (const geometry of ownedCrateGeometries) geometry.dispose()
      },
    }
  } catch (error) {
    for (const batch of instanceBatches) batch.dispose()
    for (const geometry of ownedCrateGeometries) geometry.dispose()
    throw error
  }
}
