export type AssetKind =
  | 'vehicle'
  | 'character'
  | 'vegetation'
  | 'environment'
  | 'prop'

export interface AssetManifestEntry {
  assetId: string
  kind: AssetKind
  sourceId: string
  visual: string
  collider: string | null
  runtimeCollision?: {
    authority: 'runtime-authored-proxies'
    proxySetId: string
  }
  blenderSource: string
  units: 'meter'
  upAxis: 'Y'
  forwardAxis: '-Z'
  origin: 'ground-center' | 'root-bone'
  lods: Array<{ level: number; maxDistance: number; maxTriangles: number }>
  triangleBudgetScope?: 'asset-total' | 'required-node-subtree'
  textureBudget: { maxDimension: number; maxTextureCount: number }
  materialBudget: { maxMaterials: number }
  requiredNodes: string[]
  requiredAnimations: string[]
  requiredAnimationEvents: Record<string, string[]>
  maxInstances: number
  critical: boolean
}

export interface AssetManifest {
  version: 1
  assets: AssetManifestEntry[]
}

export interface AssetSourceRecord {
  sourceId: string
  acquisition: 'original' | 'licensed-base' | 'ai-base'
  author: string
  sourceUrl: string | null
  license: string
  licenseFile: string
  modifiedByProject: boolean
}
