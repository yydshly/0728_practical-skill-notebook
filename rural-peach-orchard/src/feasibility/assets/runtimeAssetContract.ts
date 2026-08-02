import { z } from 'zod'

const nodeName = z.string().min(1)
const positiveNumber = z.number().finite().positive()

const vehicleSchema = z.object({
  assetId: z.literal('vehicle.electric-tricycle-a'),
  upAxis: z.literal('Y'),
  forwardAxis: z.literal('-Z'),
  chassisColliderNodes: z.array(nodeName),
  wheelEnvelopeNodes: z.array(nodeName),
  anchors: z.object({
    seat: nodeName,
    exit: nodeName,
    frontWheel: nodeName,
    rearLeftWheel: nodeName,
    rearRightWheel: nodeName,
    cargo: nodeName,
  }).strict(),
  emptyMassKg: positiveNumber,
  centerOfMass: z.tuple([
    z.number().finite(),
    z.number().finite(),
    z.number().finite(),
  ]),
  frontRadiusM: positiveNumber,
  rearRadiusM: positiveNumber,
  suspensionRestM: positiveNumber,
  suspensionTravelM: positiveNumber,
  springNPerM: positiveNumber,
  compressionDampingNsPerM: positiveNumber,
  reboundDampingNsPerM: positiveNumber,
  maxDriveForceN: positiveNumber,
  maxBrakeForceN: positiveNumber,
  maxSteerRad: positiveNumber,
  maxSpeedMps: positiveNumber,
  lateralGripCoefficient: positiveNumber,
}).strict().superRefine((vehicle, context) => {
  const colliderNodes = [
    ...vehicle.chassisColliderNodes,
    ...vehicle.wheelEnvelopeNodes,
  ]
  if (new Set(colliderNodes).size !== colliderNodes.length) {
    context.addIssue({
      code: 'custom',
      message: 'Collider nodes must map to exactly one role',
      path: ['chassisColliderNodes'],
    })
  }
})

const characterSchema = z.object({
  assetId: z.literal('character.farmer-a-base'),
  capsuleHalfHeightM: positiveNumber,
  capsuleRadiusM: positiveNumber,
  stepHeightM: positiveNumber,
  maxSlopeDeg: positiveNumber,
}).strict()

const environmentSchema = z.object({
  worldAssetId: z.literal('environment.orchard-world-overall-v1'),
  treeAssetId: z.literal('environment.peach-tree-overall-v1'),
  treeVariantNodes: z.object({
    a: z.literal('peach_tree_variant_a'),
    b: z.literal('peach_tree_variant_b'),
    c: z.literal('peach_tree_variant_c'),
  }).strict(),
}).strict()

const runtimeAssetContractSchema = z.object({
  version: z.literal(2),
  vehicle: vehicleSchema,
  character: characterSchema,
  environment: environmentSchema,
}).strict()

export type RuntimeAssetContract = z.infer<typeof runtimeAssetContractSchema>

export function parseRuntimeAssetContract(input: unknown): RuntimeAssetContract {
  return runtimeAssetContractSchema.parse(input)
}

export async function loadRuntimeAssetContract(
  url: string,
): Promise<RuntimeAssetContract> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(
      `Failed to load runtime asset contract ${url}: HTTP ${response.status}`,
    )
  }
  return parseRuntimeAssetContract(await response.json())
}
