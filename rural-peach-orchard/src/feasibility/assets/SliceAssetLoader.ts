import type { CriticalGlbLoader, LoadedCriticalAsset } from './loadCriticalGlb'
import { loadCriticalGlb } from './loadCriticalGlb'
import type { RuntimeAssetContract } from './runtimeAssetContract'

interface AssetManifestEntry {
  readonly assetId: string
  readonly visual: string
  readonly collider: string | null
  readonly requiredNodes: readonly string[]
}

export interface SliceAssetManifest {
  readonly assets: readonly AssetManifestEntry[]
}

export interface SliceAssets {
  readonly vehicleVisual: LoadedCriticalAsset
  readonly characterVisual: LoadedCriticalAsset
  readonly vehicleCollision: LoadedCriticalAsset
  readonly environmentWorldVisual: LoadedCriticalAsset
  readonly peachTreeFamilyVisual: LoadedCriticalAsset
}

type CriticalLoader = typeof loadCriticalGlb

export interface SliceAssetLoaderDependencies {
  readonly gltfLoader: CriticalGlbLoader
  readonly loadCritical?: CriticalLoader
}

function requireEntry(
  manifest: SliceAssetManifest,
  assetId: string,
): AssetManifestEntry {
  const entry = manifest.assets.find((candidate) => (
    candidate.assetId === assetId
  ))
  if (!entry) throw new Error(`CRITICAL_ASSET_NOT_REGISTERED: ${assetId}`)
  return entry
}

async function loadWithAssetContext(
  criticalLoader: CriticalLoader,
  dependencies: SliceAssetLoaderDependencies,
  request: Parameters<CriticalLoader>[1],
): Promise<LoadedCriticalAsset> {
  try {
    return await criticalLoader(dependencies.gltfLoader, request)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes(request.assetId)) throw error
    throw new Error(`${request.assetId}: ${message}`, { cause: error })
  }
}

export function createSliceAssetLoader(
  dependencies: SliceAssetLoaderDependencies,
): {
  load(
    contract: RuntimeAssetContract,
    manifest: SliceAssetManifest,
  ): Promise<SliceAssets>
} {
  const criticalLoader = dependencies.loadCritical ?? loadCriticalGlb
  return {
    async load(contract, manifest) {
      const vehicle = requireEntry(manifest, contract.vehicle.assetId)
      const character = requireEntry(manifest, contract.character.assetId)
      const environmentWorld = requireEntry(
        manifest,
        contract.environment.worldAssetId,
      )
      const peachTreeFamily = requireEntry(
        manifest,
        contract.environment.treeAssetId,
      )
      if (!vehicle.collider) {
        throw new Error(`${vehicle.assetId}: critical collider is not registered`)
      }
      const vehicleAnchorNodes = Object.values(contract.vehicle.anchors)
      const collisionNodes = [
        ...contract.vehicle.chassisColliderNodes,
        ...contract.vehicle.wheelEnvelopeNodes,
      ]
      const [
        vehicleVisual,
        characterVisual,
        vehicleCollision,
        environmentWorldVisual,
        peachTreeFamilyVisual,
      ] = (
        await Promise.all([
          criticalLoader(dependencies.gltfLoader, {
            assetId: `${vehicle.assetId}:visual`,
            url: vehicle.visual,
            requiredNodes: vehicleAnchorNodes,
          }),
          criticalLoader(dependencies.gltfLoader, {
            assetId: `${character.assetId}:visual`,
            url: character.visual,
            requiredNodes: character.requiredNodes,
          }),
          criticalLoader(dependencies.gltfLoader, {
            assetId: `${vehicle.assetId}:collider`,
            url: vehicle.collider,
            requiredNodes: collisionNodes,
          }),
          loadWithAssetContext(criticalLoader, dependencies, {
            assetId: `${environmentWorld.assetId}:visual`,
            url: environmentWorld.visual,
            requiredNodes: environmentWorld.requiredNodes,
          }),
          loadWithAssetContext(criticalLoader, dependencies, {
            assetId: `${peachTreeFamily.assetId}:visual`,
            url: peachTreeFamily.visual,
            requiredNodes: Object.values(contract.environment.treeVariantNodes),
          }),
        ])
      )
      return {
        vehicleVisual,
        characterVisual,
        vehicleCollision,
        environmentWorldVisual,
        peachTreeFamilyVisual,
      }
    },
  }
}
