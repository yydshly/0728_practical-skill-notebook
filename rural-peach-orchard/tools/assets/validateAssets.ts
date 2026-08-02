import {
  NodeIO,
  Primitive,
  type Document,
  type Mesh,
  type Node,
} from '@gltf-transform/core'
import { readFile, stat } from 'node:fs/promises'
import {
  dirname,
  isAbsolute,
  join,
  resolve,
} from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  parseAssetManifest,
  parseAssetSources,
} from '../../src/assets/assetManifestSchema'
import type {
  AssetManifestEntry,
  AssetSourceRecord,
} from '../../src/assets/types'
import {
  parseRuntimeAssetContract,
  type RuntimeAssetContract,
} from '../../src/feasibility/assets/runtimeAssetContract'
import { isWheelRadiusWithinTolerance } from '../../src/feasibility/vehicle/wheelRadiusTolerance'

export interface ValidationOptions {
  manifestPath: string
  sourcesPath: string
  projectRoot: string
  runtimeAssetContractPath?: string
}

export interface AssetValidationIssue {
  severity: 'error' | 'warning'
  code:
    | 'FILE_MISSING'
    | 'SOURCE_MISSING'
    | 'LICENSE_MISSING'
    | 'GLB_PARSE_FAILED'
    | 'NODE_MISSING'
    | 'ANIMATION_MISSING'
    | 'ANIMATION_EVENT_MISSING'
    | 'TRIANGLE_BUDGET_EXCEEDED'
    | 'TRIANGLE_BUDGET_SCOPE_INVALID'
    | 'MATERIAL_BUDGET_EXCEEDED'
    | 'TEXTURE_BUDGET_EXCEEDED'
    | 'PLACEHOLDER_ASSET_FORBIDDEN'
    | 'COLLIDER_ROLE_UNKNOWN'
    | 'COLLIDER_ROLE_MISSING'
    | 'COLLIDER_REQUIRED'
    | 'WHEEL_RADIUS_MISMATCH'
  assetId: string
  nodeName?: string
  message: string
}

export interface AssetValidationResult {
  ok: boolean
  issues: AssetValidationIssue[]
  metrics: Record<string, {
    triangles: number
    materials: number
    textures: number
    maxTextureDimension: number
  }>
}

const PLACEHOLDER_PATTERN = /placeholder|temp|prototype|cube(\.\d+)?$/i
const io = new NodeIO()

export function collectAnimationEventNames(events: unknown): Set<string> {
  const names = new Set<string>()
  if (!Array.isArray(events)) return names
  for (const event of events) {
    if (typeof event === 'string' && event.length > 0) {
      names.add(event)
    } else if (
      typeof event === 'object'
      && event !== null
      && 'name' in event
      && typeof event.name === 'string'
      && event.name.length > 0
    ) {
      names.add(event.name)
    }
  }
  return names
}

function resolveInputPath(projectRoot: string, inputPath: string): string {
  return isAbsolute(inputPath) ? inputPath : resolve(projectRoot, inputPath)
}

function resolveAssetPath(projectRoot: string, assetPath: string): string {
  if (assetPath.startsWith('/')) {
    return resolve(projectRoot, 'public', assetPath.slice(1))
  }
  if (isAbsolute(assetPath)) {
    return assetPath
  }
  return resolve(projectRoot, assetPath)
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function sortIssues(issues: AssetValidationIssue[]): void {
  issues.sort((left, right) => (
    compareText(left.assetId, right.assetId)
    || compareText(left.code, right.code)
    || compareText(left.message, right.message)
  ))
}

function countPrimitiveTriangles(primitive: Primitive): number {
  const elementCount = primitive.getIndices()?.getCount()
    ?? primitive.getAttribute('POSITION')?.getCount()
    ?? 0

  if (primitive.getMode() === Primitive.Mode.TRIANGLES) {
    return Math.floor(elementCount / 3)
  }
  if (
    primitive.getMode() === Primitive.Mode.TRIANGLE_STRIP
    || primitive.getMode() === Primitive.Mode.TRIANGLE_FAN
  ) {
    return Math.max(0, elementCount - 2)
  }
  return 0
}

interface VisualMeasurement {
  metrics: {
    triangles: number
    materials: number
    textures: number
    maxTextureDimension: number
  }
  lods: Array<{
    level: number
    maxTriangles: number
    triangles: number | null
  }>
  missingLod0Entry: boolean
  requiredNodeSubtreeTriangles: Record<string, number | null>
  requiredNodeOwnershipIssues: Array<{
    nodeName: string
    ownerNames: string[]
  }>
}

function countMeshTriangles(meshes: Iterable<Mesh>): number {
  let triangles = 0
  for (const mesh of meshes) {
    for (const primitive of mesh.listPrimitives()) {
      triangles += countPrimitiveTriangles(primitive)
    }
  }
  return triangles
}

function collectLodSubtreeMeshes(wrapper: Node): Set<Mesh> {
  const meshes = new Set<Mesh>()
  wrapper.traverse((node) => {
    const mesh = node.getMesh()
    if (mesh) {
      meshes.add(mesh)
    }
  })
  return meshes
}

function measureVisual(
  document: Document,
  asset: AssetManifestEntry,
): VisualMeasurement {
  const root = document.getRoot()
  const allTriangles = countMeshTriangles(root.listMeshes())
  const nodes = root.listNodes()
  const legacySingleLod = asset.lods.length === 1
    && asset.lods[0]?.level === 0
  const assignedMeshes = new Set<Mesh>()
  const requiredNodeSubtreeTriangles: Record<string, number | null> = {}
  const requiredNodeOwners = new Map<Node, string[]>()
  for (const requiredNode of asset.requiredNodes) {
    const wrapper = nodes.find((node) => node.getName() === requiredNode)
    requiredNodeSubtreeTriangles[requiredNode] = wrapper ? 0 : null
    wrapper?.traverse((node) => {
      const owners = requiredNodeOwners.get(node) ?? []
      owners.push(requiredNode)
      requiredNodeOwners.set(node, owners)
    })
  }
  const requiredNodeOwnershipIssues: VisualMeasurement['requiredNodeOwnershipIssues'] = []
  root.getDefaultScene()?.traverse((node) => {
    const mesh = node.getMesh()
    if (!mesh) return
    const ownerNames = requiredNodeOwners.get(node) ?? []
    if (ownerNames.length !== 1) {
      requiredNodeOwnershipIssues.push({
        nodeName: node.getName(),
        ownerNames: [...ownerNames],
      })
      return
    }
    const ownerName = ownerNames[0]!
    const currentTriangles = requiredNodeSubtreeTriangles[ownerName]
    if (currentTriangles !== null && currentTriangles !== undefined) {
      requiredNodeSubtreeTriangles[ownerName] = currentTriangles
        + countMeshTriangles([mesh])
    }
  })

  const lods = asset.lods.map((lod) => {
    const wrapperName = `LOD${lod.level}`
    const wrapper = nodes.find((node) => node.getName() === wrapperName)
    const wrapperMeshes = wrapper
      ? collectLodSubtreeMeshes(wrapper)
      : null
    for (const mesh of wrapperMeshes ?? []) {
      assignedMeshes.add(mesh)
    }
    return {
      level: lod.level,
      maxTriangles: lod.maxTriangles,
      triangles: wrapperMeshes
        ? countMeshTriangles(wrapperMeshes)
        : legacySingleLod
          ? allTriangles
          : null,
    }
  })
  const missingLod0Entry = asset.lods.length > 1
    && !lods.some((lod) => lod.level === 0)
  const lod0 = lods.find((lod) => lod.level === 0)
  const hasLod0Wrapper = nodes.some((node) => node.getName() === 'LOD0')
  if (hasLod0Wrapper && lod0 && lod0.triangles !== null) {
    const unassignedMeshes = root.listMeshes().filter(
      (mesh) => !assignedMeshes.has(mesh),
    )
    lod0.triangles += countMeshTriangles(unassignedMeshes)
  }

  let maxTextureDimension = 0
  for (const texture of root.listTextures()) {
    const size = texture.getSize()
    if (size) {
      maxTextureDimension = Math.max(
        maxTextureDimension,
        size[0],
        size[1],
      )
    }
  }

  return {
    metrics: {
      triangles: allTriangles,
      materials: root.listMaterials().length,
      textures: root.listTextures().length,
      maxTextureDimension,
    },
    lods,
    missingLod0Entry,
    requiredNodeSubtreeTriangles,
    requiredNodeOwnershipIssues,
  }
}

function addIssue(
  issues: AssetValidationIssue[],
  assetId: string,
  code: AssetValidationIssue['code'],
  message: string,
  nodeName?: string,
): void {
  issues.push({
    severity: 'error',
    code,
    assetId,
    message,
    ...(nodeName === undefined ? {} : { nodeName }),
  })
}

function validatePlaceholderNodeNames(
  asset: AssetManifestEntry,
  role: 'visual' | 'collider',
  document: Document,
  issues: AssetValidationIssue[],
): void {
  for (const node of document.getRoot().listNodes()) {
    const nodeName = node.getName()
    if (PLACEHOLDER_PATTERN.test(nodeName)) {
      addIssue(
        issues,
        asset.assetId,
        'PLACEHOLDER_ASSET_FORBIDDEN',
        `${role} GLB node "${nodeName}" uses a forbidden placeholder name`,
      )
    }
  }
}

function measureWheelRadius(node: Node): number | null {
  const mesh = node.getMesh()
  if (!mesh) return null

  const minimum = [Infinity, Infinity, Infinity]
  const maximum = [-Infinity, -Infinity, -Infinity]
  let measured = false
  for (const primitive of mesh.listPrimitives()) {
    const position = primitive.getAttribute('POSITION')
    if (!position) continue
    const primitiveMinimum = position.getMin([])
    const primitiveMaximum = position.getMax([])
    for (let axis = 0; axis < 3; axis += 1) {
      minimum[axis] = Math.min(minimum[axis]!, primitiveMinimum[axis]!)
      maximum[axis] = Math.max(maximum[axis]!, primitiveMaximum[axis]!)
    }
    measured = true
  }
  if (!measured) return null

  const scale = node.getWorldScale()
  const diameterY = (maximum[1]! - minimum[1]!) * scale[1]
  const diameterZ = (maximum[2]! - minimum[2]!) * scale[2]
  const radius = Math.max(diameterY, diameterZ) / 2
  return Number.isFinite(radius) && radius > 0 ? radius : null
}

function validateRegisteredVehicleCollider(
  asset: AssetManifestEntry,
  document: Document,
  contract: RuntimeAssetContract['vehicle'],
  issues: AssetValidationIssue[],
): void {
  if (asset.assetId !== contract.assetId) return

  const nodes = document.getRoot().listNodes()
  const meshNodesByName = new Map(
    nodes
      .filter((node) => node.getMesh() !== null)
      .map((node) => [node.getName(), node]),
  )
  const configuredNames = new Set([
    ...contract.chassisColliderNodes,
    ...contract.wheelEnvelopeNodes,
  ])

  for (const node of nodes) {
    const nodeName = node.getName()
    if (!configuredNames.has(nodeName)) {
      addIssue(
        issues,
        asset.assetId,
        'COLLIDER_ROLE_UNKNOWN',
        `Collider node "${nodeName}" has no configured role`,
        nodeName,
      )
    }
  }
  for (const nodeName of configuredNames) {
    if (!meshNodesByName.has(nodeName)) {
      addIssue(
        issues,
        asset.assetId,
        'COLLIDER_ROLE_MISSING',
        `Configured collider node "${nodeName}" is missing`,
        nodeName,
      )
    }
  }

  for (const nodeName of contract.wheelEnvelopeNodes) {
    const node = meshNodesByName.get(nodeName)
    if (!node) continue
    const measuredRadiusM = measureWheelRadius(node)
    const declaredRadiusM = nodeName === 'convex_front_wheel'
      ? contract.frontRadiusM
      : contract.rearRadiusM
    if (
      measuredRadiusM === null
      || !isWheelRadiusWithinTolerance(measuredRadiusM, declaredRadiusM)
    ) {
      addIssue(
        issues,
        asset.assetId,
        'WHEEL_RADIUS_MISMATCH',
        measuredRadiusM === null
          ? `Wheel envelope "${nodeName}" has no finite positive radius`
          : `Wheel envelope "${nodeName}" measures ${measuredRadiusM}m; declared radius is ${declaredRadiusM}m`,
        nodeName,
      )
    }
  }
}

function validateVisualSemantics(
  asset: AssetManifestEntry,
  document: Document,
  issues: AssetValidationIssue[],
): void {
  const root = document.getRoot()
  const nodeNames = new Set(root.listNodes().map((node) => node.getName()))
  const animations = new Map<string, Set<string>>()

  for (const animation of root.listAnimations()) {
    const events = animation.getExtras().events
    const eventNames = animations.get(animation.getName()) ?? new Set<string>()
    for (const eventName of collectAnimationEventNames(events)) {
      eventNames.add(eventName)
    }
    animations.set(animation.getName(), eventNames)
  }

  for (const requiredNode of asset.requiredNodes) {
    if (!nodeNames.has(requiredNode)) {
      addIssue(
        issues,
        asset.assetId,
        'NODE_MISSING',
        `Required visual node "${requiredNode}" is missing`,
      )
    }
  }

  for (const requiredAnimation of asset.requiredAnimations) {
    if (!animations.has(requiredAnimation)) {
      addIssue(
        issues,
        asset.assetId,
        'ANIMATION_MISSING',
        `Required animation "${requiredAnimation}" is missing`,
      )
    }
  }

  for (const [animationName, requiredEvents] of Object.entries(
    asset.requiredAnimationEvents,
  )) {
    const availableEvents = animations.get(animationName)
    for (const requiredEvent of requiredEvents) {
      if (!availableEvents?.has(requiredEvent)) {
        addIssue(
          issues,
          asset.assetId,
          'ANIMATION_EVENT_MISSING',
          `Animation "${animationName}" is missing required event "${requiredEvent}"`,
        )
      }
    }
  }
}

function validateBudgets(
  asset: AssetManifestEntry,
  measurement: VisualMeasurement,
  issues: AssetValidationIssue[],
): void {
  const { metrics } = measurement
  if (measurement.missingLod0Entry) {
    addIssue(
      issues,
      asset.assetId,
      'NODE_MISSING',
      'Required LOD0 manifest entry is missing',
    )
  }
  if (asset.triangleBudgetScope === 'required-node-subtree') {
    const lod0 = asset.lods.find((lod) => lod.level === 0)
    for (const ownershipIssue of measurement.requiredNodeOwnershipIssues) {
      const ownership = ownershipIssue.ownerNames.length === 0
        ? 'no required root'
        : `multiple required roots: ${ownershipIssue.ownerNames.join(', ')}`
      addIssue(
        issues,
        asset.assetId,
        'TRIANGLE_BUDGET_SCOPE_INVALID',
        `Visible mesh node "${ownershipIssue.nodeName}" belongs to ${ownership}; exactly one is required`,
        ownershipIssue.nodeName,
      )
    }
    if (lod0) {
      for (const requiredNode of asset.requiredNodes) {
        const triangles = measurement.requiredNodeSubtreeTriangles[requiredNode]
        if (triangles !== null && triangles !== undefined
          && triangles > lod0.maxTriangles) {
          addIssue(
            issues,
            asset.assetId,
            'TRIANGLE_BUDGET_EXCEEDED',
            `Required root "${requiredNode}" has ${triangles} triangles; budget is ${lod0.maxTriangles}`,
            requiredNode,
          )
        }
      }
    }
  } else {
    for (const lod of measurement.lods) {
      const wrapperName = `LOD${lod.level}`
      if (lod.triangles === null) {
        addIssue(
          issues,
          asset.assetId,
          'NODE_MISSING',
          `Required LOD wrapper node "${wrapperName}" is missing`,
        )
      } else if (lod.triangles > lod.maxTriangles) {
        addIssue(
          issues,
          asset.assetId,
          'TRIANGLE_BUDGET_EXCEEDED',
          `Visual GLB ${wrapperName} has ${lod.triangles} triangles; budget is ${lod.maxTriangles}`,
        )
      }
    }
  }
  if (metrics.materials > asset.materialBudget.maxMaterials) {
    addIssue(
      issues,
      asset.assetId,
      'MATERIAL_BUDGET_EXCEEDED',
      `Visual GLB has ${metrics.materials} materials; budget is ${asset.materialBudget.maxMaterials}`,
    )
  }
  if (metrics.textures > asset.textureBudget.maxTextureCount) {
    addIssue(
      issues,
      asset.assetId,
      'TEXTURE_BUDGET_EXCEEDED',
      `Visual GLB has ${metrics.textures} textures; budget is ${asset.textureBudget.maxTextureCount}`,
    )
  }
  if (metrics.maxTextureDimension > asset.textureBudget.maxDimension) {
    addIssue(
      issues,
      asset.assetId,
      'TEXTURE_BUDGET_EXCEEDED',
      `Visual GLB maximum texture dimension is ${metrics.maxTextureDimension}; budget is ${asset.textureBudget.maxDimension}`,
    )
  }
}

async function parseGlb(
  asset: AssetManifestEntry,
  role: 'visual' | 'collider',
  manifestPath: string,
  projectRoot: string,
  issues: AssetValidationIssue[],
): Promise<Document | null> {
  const filePath = resolveAssetPath(projectRoot, manifestPath)
  if (!await isFile(filePath)) {
    addIssue(
      issues,
      asset.assetId,
      'FILE_MISSING',
      `${role} GLB file is missing: ${manifestPath}`,
    )
    return null
  }

  try {
    return await io.read(filePath)
  } catch {
    addIssue(
      issues,
      asset.assetId,
      'GLB_PARSE_FAILED',
      `${role} GLB could not be parsed: ${manifestPath}`,
    )
    return null
  }
}

async function validateProvenance(
  asset: AssetManifestEntry,
  sourcesById: Map<string, AssetSourceRecord>,
  projectRoot: string,
  issues: AssetValidationIssue[],
): Promise<void> {
  const source = sourcesById.get(asset.sourceId)
  if (!source) {
    addIssue(
      issues,
      asset.assetId,
      'SOURCE_MISSING',
      `Source record "${asset.sourceId}" is missing`,
    )
    return
  }

  const licensePath = resolveInputPath(projectRoot, source.licenseFile)
  if (!await isFile(licensePath)) {
    addIssue(
      issues,
      asset.assetId,
      'LICENSE_MISSING',
      `License file is missing: ${source.licenseFile}`,
    )
  }
}

function hasRegisteredRuntimeCapsule(
  asset: AssetManifestEntry,
  runtimeAssetContract: RuntimeAssetContract | null,
): boolean {
  return asset.kind === 'character'
    && runtimeAssetContract !== null
    && asset.assetId === runtimeAssetContract.character.assetId
}

function hasWorldAuthoredCollision(asset: AssetManifestEntry): boolean {
  return (
    asset.kind === 'vegetation' || asset.kind === 'environment'
  )
    && asset.runtimeCollision?.authority === 'runtime-authored-proxies'
    && asset.runtimeCollision.proxySetId.trim().length > 0
}

export async function validateAssetSet(
  options: ValidationOptions,
): Promise<AssetValidationResult> {
  const manifestPath = resolveInputPath(options.projectRoot, options.manifestPath)
  const sourcesPath = resolveInputPath(options.projectRoot, options.sourcesPath)
  const manifest = parseAssetManifest(
    JSON.parse(await readFile(manifestPath, 'utf8')) as unknown,
  )
  const sources = parseAssetSources(
    JSON.parse(await readFile(sourcesPath, 'utf8')) as unknown,
  )
  const sourcesById = new Map(sources.map((source) => [source.sourceId, source]))
  const runtimeAssetContractPath = resolveInputPath(
    options.projectRoot,
    options.runtimeAssetContractPath
      ?? 'public/feasibility/runtime-assets.json',
  )
  const runtimeAssetContract = await isFile(runtimeAssetContractPath)
    ? parseRuntimeAssetContract(
      JSON.parse(await readFile(runtimeAssetContractPath, 'utf8')) as unknown,
    )
    : null
  const issues: AssetValidationIssue[] = []
  const metrics: AssetValidationResult['metrics'] = {}

  for (const asset of manifest.assets) {
    await validateProvenance(asset, sourcesById, options.projectRoot, issues)

    if (PLACEHOLDER_PATTERN.test(asset.assetId)) {
      addIssue(
        issues,
        asset.assetId,
        'PLACEHOLDER_ASSET_FORBIDDEN',
        `Asset ID "${asset.assetId}" uses a forbidden placeholder name`,
      )
    }

    const visual = await parseGlb(
      asset,
      'visual',
      asset.visual,
      options.projectRoot,
      issues,
    )
    if (visual) {
      validatePlaceholderNodeNames(asset, 'visual', visual, issues)
      validateVisualSemantics(asset, visual, issues)
      const visualMeasurement = measureVisual(visual, asset)
      metrics[asset.assetId] = visualMeasurement.metrics
      validateBudgets(asset, visualMeasurement, issues)
    }

    if (asset.collider === null) {
      if (
        !hasRegisteredRuntimeCapsule(asset, runtimeAssetContract)
        && !hasWorldAuthoredCollision(asset)
      ) {
        addIssue(
          issues,
          asset.assetId,
          'COLLIDER_REQUIRED',
          'A null collider requires a registered runtime capsule or explicit runtime-authored proxy reference',
        )
      }
    } else {
      const collider = await parseGlb(
        asset,
        'collider',
        asset.collider,
        options.projectRoot,
        issues,
      )
      if (collider) {
        validatePlaceholderNodeNames(asset, 'collider', collider, issues)
        if (runtimeAssetContract) {
          validateRegisteredVehicleCollider(
            asset,
            collider,
            runtimeAssetContract.vehicle,
            issues,
          )
        }
      }
    }
  }

  sortIssues(issues)
  return {
    ok: !issues.some((issue) => issue.severity === 'error'),
    issues,
    metrics,
  }
}

function printIssues(issues: AssetValidationIssue[]): void {
  if (issues.length === 0) {
    return
  }
  console.log('assetId\tseverity\tcode\tmessage')
  for (const issue of issues) {
    console.log([
      issue.assetId,
      issue.severity,
      issue.code,
      issue.message.replaceAll('\t', ' ').replaceAll('\n', ' '),
    ].join('\t'))
  }
}

async function runCli(): Promise<void> {
  const manifestPath = process.argv[2]
  if (!manifestPath) {
    console.error('Usage: npm run assets:validate -- <manifest.json>')
    process.exit(2)
  }

  const absoluteManifestPath = resolve(process.cwd(), manifestPath)
  const sourcesPath = join(dirname(absoluteManifestPath), 'asset-sources.json')
  const manifest = parseAssetManifest(
    JSON.parse(await readFile(absoluteManifestPath, 'utf8')) as unknown,
  )
  const result = await validateAssetSet({
    manifestPath: absoluteManifestPath,
    sourcesPath,
    projectRoot: process.cwd(),
  })
  printIssues(result.issues)
  const errorCount = result.issues.filter(
    (issue) => issue.severity === 'error',
  ).length
  console.log(`${manifest.assets.length} assets, ${errorCount} errors`)
  process.exit(result.ok ? 0 : 1)
}

const invokedPath = process.argv[1]
if (
  invokedPath
  && import.meta.url === pathToFileURL(resolve(invokedPath)).href
) {
  await runCli()
}
