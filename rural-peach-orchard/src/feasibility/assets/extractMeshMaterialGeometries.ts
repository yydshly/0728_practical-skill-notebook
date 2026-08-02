import {
  BufferAttribute,
  BufferGeometry,
  InterleavedBufferAttribute,
  Material,
  type Mesh,
  type TypedArray,
  type TypedArrayConstructor,
} from 'three'

type ReadableAttribute = BufferAttribute | InterleavedBufferAttribute

export interface MeshMaterialGeometry {
  readonly geometry: BufferGeometry
  readonly material: Material
}

interface ActiveElementRange {
  readonly start: number
  readonly count: number
  readonly end: number
}

function invalid(message: string): never {
  throw new Error(message)
}

function sourceArray(attribute: ReadableAttribute): TypedArray {
  return attribute instanceof InterleavedBufferAttribute
    ? attribute.data.array
    : attribute.array
}

function cloneAttributeSelection(
  source: ReadableAttribute,
  vertexIndices: readonly number[],
): BufferAttribute {
  const ArrayType = sourceArray(source).constructor as TypedArrayConstructor
  const target = new BufferAttribute(
    new ArrayType(vertexIndices.length * source.itemSize) as TypedArray,
    source.itemSize,
    source.normalized,
  )
  for (let item = 0; item < vertexIndices.length; item += 1) {
    for (let component = 0; component < source.itemSize; component += 1) {
      target.setComponent(
        item,
        component,
        source.getComponent(vertexIndices[item]!, component),
      )
    }
  }
  target.name = source.name
  if (source instanceof BufferAttribute) {
    target.setUsage(source.usage)
    target.gpuType = source.gpuType
  }
  return target
}

function cloneNonIndexedRange(
  source: BufferGeometry,
  range: ActiveElementRange,
): BufferGeometry {
  const geometry = new BufferGeometry()
  const indices = Array.from(
    { length: range.count },
    (_, index) => range.start + index,
  )
  for (const [name, attribute] of Object.entries(source.attributes)) {
    geometry.setAttribute(
      name,
      cloneAttributeSelection(attribute as ReadableAttribute, indices),
    )
  }
  geometry.setDrawRange(0, Number.POSITIVE_INFINITY)
  return geometry
}

function cloneCompactIndexedRange(
  source: BufferGeometry,
  range: ActiveElementRange,
): BufferGeometry {
  const sourceIndex = source.index!
  const sourceVertices: number[] = []
  const compactIndex: number[] = []
  const remapped = new Map<number, number>()
  for (let element = range.start; element < range.end; element += 1) {
    const sourceVertex = sourceIndex.getX(element)
    let targetVertex = remapped.get(sourceVertex)
    if (targetVertex === undefined) {
      targetVertex = sourceVertices.length
      sourceVertices.push(sourceVertex)
      remapped.set(sourceVertex, targetVertex)
    }
    compactIndex.push(targetVertex)
  }
  const geometry = new BufferGeometry()
  for (const [name, attribute] of Object.entries(source.attributes)) {
    geometry.setAttribute(
      name,
      cloneAttributeSelection(
        attribute as ReadableAttribute,
        sourceVertices,
      ),
    )
  }
  geometry.setIndex(compactIndex)
  geometry.setDrawRange(0, Number.POSITIVE_INFINITY)
  return geometry
}

function cloneGeometryRange(
  source: BufferGeometry,
  range: ActiveElementRange,
  elementCount: number,
): BufferGeometry {
  if (source.index && range.start === 0 && range.count === elementCount) {
    const geometry = source.clone()
    geometry.clearGroups()
    geometry.setDrawRange(0, Number.POSITIVE_INFINITY)
    return geometry
  }
  return source.index
    ? cloneCompactIndexedRange(source, range)
    : cloneNonIndexedRange(source, range)
}

function activeElementRange(
  geometry: BufferGeometry,
  elementCount: number,
  errorMessage: string,
): ActiveElementRange {
  const start = geometry.drawRange.start
  const requestedCount = geometry.drawRange.count
  if (!Number.isFinite(start) || !Number.isInteger(start) || start < 0) {
    invalid(errorMessage)
  }
  const count = requestedCount === Number.POSITIVE_INFINITY
    ? elementCount - start
    : requestedCount
  if (
    !Number.isFinite(count)
    || !Number.isInteger(count)
    || count <= 0
    || start + count > elementCount
    || start % 3 !== 0
    || count % 3 !== 0
  ) {
    invalid(errorMessage)
  }
  return { start, count, end: start + count }
}

function validateAttributeCoverage(
  geometry: BufferGeometry,
  range: ActiveElementRange,
  errorMessage: string,
): void {
  if (Object.values(geometry.morphAttributes).some((items) => items.length > 0)) {
    invalid(errorMessage)
  }
  const attributes = Object.values(geometry.attributes) as ReadableAttribute[]
  if (geometry.index) {
    const indexArray = geometry.index.array
    if (
      geometry.index.itemSize !== 1
      || geometry.index.normalized
      || !(
        indexArray instanceof Uint8Array
        || indexArray instanceof Uint16Array
        || indexArray instanceof Uint32Array
      )
    ) {
      invalid(errorMessage)
    }
    let maximumIndex = -1
    for (let element = 0; element < geometry.index.count; element += 1) {
      const index = geometry.index.getX(element)
      if (!Number.isFinite(index) || !Number.isInteger(index) || index < 0) {
        invalid(errorMessage)
      }
      maximumIndex = Math.max(maximumIndex, index)
    }
    if (attributes.some(({ count }) => maximumIndex >= count)) {
      invalid(errorMessage)
    }
    return
  }
  if (attributes.some(({ count }) => range.end > count)) invalid(errorMessage)
}

function validateMaterials(
  materials: readonly Material[],
  errorMessage: string,
): void {
  if (materials.length === 0) invalid(errorMessage)
  for (let index = 0; index < materials.length; index += 1) {
    if (
      !Object.hasOwn(materials, index)
      || !(materials[index] instanceof Material)
    ) {
      invalid(errorMessage)
    }
  }
}

function activeGroups(
  geometry: BufferGeometry,
  range: ActiveElementRange,
  materials: readonly Material[],
  errorMessage: string,
): BufferGeometry['groups'] {
  const ordered = [...geometry.groups].sort((left, right) => (
    left.start - right.start
  ))
  if (ordered.length === 0) invalid(errorMessage)
  let cursor = range.start
  for (const group of ordered) {
    const materialIndex = group.materialIndex
    const end = group.start + group.count
    if (
      !Number.isFinite(group.start)
      || !Number.isInteger(group.start)
      || !Number.isFinite(group.count)
      || !Number.isInteger(group.count)
      || typeof materialIndex !== 'number'
      || !Number.isFinite(materialIndex)
      || !Number.isInteger(materialIndex)
      || group.start !== cursor
      || group.start < range.start
      || group.count <= 0
      || group.start % 3 !== 0
      || group.count % 3 !== 0
      || end > range.end
      || materialIndex < 0
      || materialIndex >= materials.length
      || materials[materialIndex] === undefined
    ) {
      invalid(errorMessage)
    }
    cursor = end
  }
  if (cursor !== range.end) invalid(errorMessage)
  return ordered
}

/**
 * Expands one Mesh occurrence into owned, single-material geometry slices.
 * Indexed input stays indexed, and all active ranges and material groups must
 * describe a complete, triangle-aligned, renderable interval.
 */
export function extractMeshMaterialGeometries(
  mesh: Mesh,
  errorMessage: string,
): MeshMaterialGeometry[] {
  const position = mesh.geometry.getAttribute('position') as
    | ReadableAttribute
    | undefined
  const elementCount = mesh.geometry.index?.count ?? position?.count ?? 0
  if (!position || elementCount <= 0) invalid(errorMessage)
  const range = activeElementRange(mesh.geometry, elementCount, errorMessage)
  validateAttributeCoverage(mesh.geometry, range, errorMessage)

  const materials = Array.isArray(mesh.material)
    ? mesh.material
    : [mesh.material]
  validateMaterials(materials, errorMessage)

  const groups = Array.isArray(mesh.material)
    ? activeGroups(mesh.geometry, range, materials, errorMessage)
    : [{ start: range.start, count: range.count, materialIndex: 0 }]

  const slices: MeshMaterialGeometry[] = []
  try {
    for (const group of groups) {
      const materialIndex = group.materialIndex
      if (materialIndex === undefined) invalid(errorMessage)
      slices.push({
        geometry: cloneGeometryRange(
          mesh.geometry,
          {
            start: group.start,
            count: group.count,
            end: group.start + group.count,
          },
          elementCount,
        ),
        material: materials[materialIndex]!,
      })
    }
    return slices
  } catch (error) {
    for (const slice of slices) slice.geometry.dispose()
    if (error instanceof Error && error.message === errorMessage) throw error
    invalid(errorMessage)
  }
}
