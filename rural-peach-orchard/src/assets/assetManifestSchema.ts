import { z } from 'zod'
import type {
  AssetManifest,
  AssetManifestEntry,
  AssetSourceRecord,
} from './types'

const assetManifestEntrySchema: z.ZodType<AssetManifestEntry> = z.object({
  assetId: z.string(),
  kind: z.enum(['vehicle', 'character', 'vegetation', 'environment', 'prop']),
  sourceId: z.string(),
  visual: z.string(),
  collider: z.string().nullable(),
  runtimeCollision: z.object({
    authority: z.literal('runtime-authored-proxies'),
    proxySetId: z.string().trim().min(1),
  }).optional(),
  blenderSource: z.string(),
  units: z.literal('meter'),
  upAxis: z.literal('Y'),
  forwardAxis: z.literal('-Z'),
  origin: z.enum(['ground-center', 'root-bone']),
  lods: z.array(z.object({
    level: z.number(),
    maxDistance: z.number(),
    maxTriangles: z.number(),
  })),
  triangleBudgetScope: z.enum([
    'asset-total',
    'required-node-subtree',
  ]).optional(),
  textureBudget: z.object({
    maxDimension: z.number(),
    maxTextureCount: z.number(),
  }),
  materialBudget: z.object({
    maxMaterials: z.number(),
  }),
  requiredNodes: z.array(z.string()),
  requiredAnimations: z.array(z.string()),
  requiredAnimationEvents: z.record(z.string(), z.array(z.string())),
  maxInstances: z.number(),
  critical: z.boolean(),
})

const assetManifestSchema: z.ZodType<AssetManifest> = z.object({
  version: z.literal(1),
  assets: z.array(assetManifestEntrySchema),
})

const assetSourceRecordSchema: z.ZodType<AssetSourceRecord> = z.object({
  sourceId: z.string(),
  acquisition: z.enum(['original', 'licensed-base', 'ai-base']),
  author: z.string(),
  sourceUrl: z.string().nullable(),
  license: z.string().min(1),
  licenseFile: z.string().min(1),
  modifiedByProject: z.boolean(),
})

const assetSourcesSchema = z.array(assetSourceRecordSchema)

export function parseAssetManifest(input: unknown): AssetManifest {
  const result = assetManifestSchema.safeParse(input)

  if (!result.success) {
    throw result.error
  }

  const assetIds = new Set<string>()
  for (const asset of result.data.assets) {
    if (assetIds.has(asset.assetId)) {
      throw new Error(`Duplicate assetId: ${asset.assetId}`)
    }
    assetIds.add(asset.assetId)

    if (asset.triangleBudgetScope === 'required-node-subtree') {
      if (asset.requiredNodes.length === 0) {
        throw new Error(
          `${asset.assetId}: requiredNodes must be non-empty for required-node-subtree`,
        )
      }
      if (new Set(asset.requiredNodes).size !== asset.requiredNodes.length) {
        throw new Error(
          `${asset.assetId}: requiredNodes must be unique for required-node-subtree`,
        )
      }
      if (asset.lods.filter((lod) => lod.level === 0).length !== 1) {
        throw new Error(
          `${asset.assetId}: required-node-subtree requires exactly one LOD0`,
        )
      }
    }
  }

  return result.data
}

export function parseAssetSources(input: unknown): AssetSourceRecord[] {
  const result = assetSourcesSchema.safeParse(input)

  if (!result.success) {
    throw result.error
  }

  return result.data
}
