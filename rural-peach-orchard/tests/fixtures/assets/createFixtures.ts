import { Document, NodeIO } from '@gltf-transform/core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const fixturesRoot = dirname(fileURLToPath(import.meta.url))
const io = new NodeIO()
const onePixelPng = Uint8Array.from(Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
))

function createVisual(nodeNames: string[]): Document {
  const document = new Document()
  const buffer = document.createBuffer('fixture-buffer')
  const material = document.createMaterial('orchard-material')
  const texture = document.createTexture('orchard-texture')
    .setImage(onePixelPng)
    .setMimeType('image/png')
  material.setBaseColorTexture(texture)

  const positions = document.createAccessor('positions', buffer)
    .setType('VEC3')
    .setArray(new Float32Array([
      0, 0, 0,
      1, 0, 0,
      0, 1, 0,
    ]))
  const indices = document.createAccessor('indices', buffer)
    .setType('SCALAR')
    .setArray(new Uint16Array([0, 1, 2]))
  const primitive = document.createPrimitive()
    .setAttribute('POSITION', positions)
    .setIndices(indices)
    .setMaterial(material)
  const mesh = document.createMesh('fixture-mesh').addPrimitive(primitive)

  const rootNode = document.createNode(nodeNames[0] ?? 'root').setMesh(mesh)
  const scene = document.createScene('fixture-scene').addChild(rootNode)
  for (const nodeName of nodeNames.slice(1)) {
    rootNode.addChild(document.createNode(nodeName))
  }

  const animationInput = document.createAccessor('idle-times', buffer)
    .setType('SCALAR')
    .setArray(new Float32Array([0, 1]))
  const animationOutput = document.createAccessor('idle-values', buffer)
    .setType('VEC3')
    .setArray(new Float32Array([
      0, 0, 0,
      0, 0, 0,
    ]))
  const animationSampler = document.createAnimationSampler('idle-sampler')
    .setInput(animationInput)
    .setOutput(animationOutput)
  const animationChannel = document.createAnimationChannel('idle-channel')
    .setTargetNode(rootNode)
    .setTargetPath('translation')
    .setSampler(animationSampler)
  document.createAnimation('idle')
    .setExtras({ events: ['ready', 'loop'] })
    .addSampler(animationSampler)
    .addChannel(animationChannel)

  document.getRoot().setDefaultScene(scene)
  return document
}

function createCollider(): Document {
  const document = new Document()
  const buffer = document.createBuffer('collider-buffer')
  const positions = new Float32Array(120 * 3 * 3)
  const indices = new Uint16Array(120 * 3)
  for (let triangle = 0; triangle < 120; triangle += 1) {
    const vertexOffset = triangle * 9
    const indexOffset = triangle * 3
    positions.set([0, 0, 0, 1, 0, 0, 0, 1, 0], vertexOffset)
    indices.set([indexOffset, indexOffset + 1, indexOffset + 2], indexOffset)
  }
  const positionAccessor = document.createAccessor('collider-positions', buffer)
    .setType('VEC3')
    .setArray(positions)
  const indexAccessor = document.createAccessor('collider-indices', buffer)
    .setType('SCALAR')
    .setArray(indices)
  const primitive = document.createPrimitive()
    .setAttribute('POSITION', positionAccessor)
    .setIndices(indexAccessor)
  const mesh = document.createMesh('collider-mesh').addPrimitive(primitive)
  const rootNode = document.createNode('root').setMesh(mesh)
  const scene = document.createScene('collider-scene').addChild(rootNode)
  document.getRoot().setDefaultScene(scene)
  return document
}

function createMultiLodVisual(
  unassignedTriangles = 0,
  lods = [
    { level: 0, triangles: 6 },
    { level: 1, triangles: 4 },
    { level: 2, triangles: 2 },
  ],
): Document {
  const document = new Document()
  const buffer = document.createBuffer('multi-lod-buffer')
  const material = document.createMaterial('orchard-material')
  const texture = document.createTexture('orchard-texture')
    .setImage(onePixelPng)
    .setMimeType('image/png')
  material.setBaseColorTexture(texture)

  const rootNode = document.createNode('root')
  const scene = document.createScene('multi-lod-scene').addChild(rootNode)

  for (const lod of lods) {
    const positions = new Float32Array(lod.triangles * 3 * 3)
    const indices = new Uint16Array(lod.triangles * 3)
    for (let triangle = 0; triangle < lod.triangles; triangle += 1) {
      const vertexOffset = triangle * 9
      const indexOffset = triangle * 3
      positions.set([0, 0, 0, 1, 0, 0, 0, 1, 0], vertexOffset)
      indices.set([indexOffset, indexOffset + 1, indexOffset + 2], indexOffset)
    }
    const positionAccessor = document.createAccessor(
      `lod${lod.level}-positions`,
      buffer,
    )
      .setType('VEC3')
      .setArray(positions)
    const indexAccessor = document.createAccessor(
      `lod${lod.level}-indices`,
      buffer,
    )
      .setType('SCALAR')
      .setArray(indices)
    const primitive = document.createPrimitive()
      .setAttribute('POSITION', positionAccessor)
      .setIndices(indexAccessor)
      .setMaterial(material)
    const mesh = document.createMesh(`lod${lod.level}-mesh`)
      .addPrimitive(primitive)
    const wrapper = document.createNode(`LOD${lod.level}`)
    wrapper.addChild(
      document.createNode(`lod${lod.level}-geometry`).setMesh(mesh),
    )
    rootNode.addChild(wrapper)
  }

  if (unassignedTriangles > 0) {
    const positions = new Float32Array(unassignedTriangles * 3 * 3)
    const indices = new Uint16Array(unassignedTriangles * 3)
    for (let triangle = 0; triangle < unassignedTriangles; triangle += 1) {
      const vertexOffset = triangle * 9
      const indexOffset = triangle * 3
      positions.set([0, 0, 0, 1, 0, 0, 0, 1, 0], vertexOffset)
      indices.set([indexOffset, indexOffset + 1, indexOffset + 2], indexOffset)
    }
    const positionAccessor = document.createAccessor(
      'unassigned-positions',
      buffer,
    )
      .setType('VEC3')
      .setArray(positions)
    const indexAccessor = document.createAccessor(
      'unassigned-indices',
      buffer,
    )
      .setType('SCALAR')
      .setArray(indices)
    const primitive = document.createPrimitive()
      .setAttribute('POSITION', positionAccessor)
      .setIndices(indexAccessor)
      .setMaterial(material)
    const mesh = document.createMesh('unassigned-visible-mesh')
      .addPrimitive(primitive)
    rootNode.addChild(
      document.createNode('unassigned-visible').setMesh(mesh),
    )
  }

  document.getRoot().setDefaultScene(scene)
  return document
}

const fixtures = [
  { directory: 'valid-minimal', nodes: ['root', 'interaction_anchor'] },
  { directory: 'missing-node', nodes: ['root'] },
  { directory: 'placeholder-name', nodes: ['root', 'Cube'] },
]

for (const fixture of fixtures) {
  await io.write(
    resolve(fixturesRoot, fixture.directory, 'visual.glb'),
    createVisual(fixture.nodes),
  )
  await io.write(
    resolve(fixturesRoot, fixture.directory, 'collider.glb'),
    createCollider(),
  )
}

await io.write(
  resolve(fixturesRoot, 'multi-lod', 'visual.glb'),
  createMultiLodVisual(),
)
await io.write(
  resolve(fixturesRoot, 'multi-lod', 'collider.glb'),
  createCollider(),
)
await io.write(
  resolve(fixturesRoot, 'multi-lod-unassigned', 'visual.glb'),
  createMultiLodVisual(5),
)
await io.write(
  resolve(fixturesRoot, 'multi-lod-unassigned', 'collider.glb'),
  createCollider(),
)
await io.write(
  resolve(fixturesRoot, 'single-lod-unassigned', 'visual.glb'),
  createMultiLodVisual(5, [{ level: 0, triangles: 6 }]),
)
await io.write(
  resolve(fixturesRoot, 'single-lod-unassigned', 'collider.glb'),
  createCollider(),
)
