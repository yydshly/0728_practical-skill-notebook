import {
  BufferGeometry,
  Float32BufferAttribute,
  Material,
  Mesh,
  MeshStandardMaterial,
  Uint16BufferAttribute,
} from 'three'
import { describe, expect, it } from 'vitest'
import {
  extractMeshMaterialGeometries,
} from '../../../src/feasibility/assets/extractMeshMaterialGeometries'

const ERROR = 'TEST_MATERIAL_GEOMETRY_INVALID'

function indexedGeometry(): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute([
    -1, 0, 0,
    1, 0, 0,
    1, 1, 0,
    -1, 1, 0,
  ], 3))
  geometry.setAttribute('normal', new Float32BufferAttribute([
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
  ], 3))
  geometry.setIndex([0, 1, 2, 0, 2, 3])
  return geometry
}

function nonIndexedGeometry(): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute([
    -1, 0, 0, 1, 0, 0, 1, 1, 0,
    -1, 0, 0, 1, 1, 0, -1, 1, 0,
  ], 3))
  geometry.setAttribute('normal', new Float32BufferAttribute([
    0, 0, 1, 0, 0, 1, 0, 0, 1,
    0, 0, 1, 0, 0, 1, 0, 0, 1,
  ], 3))
  return geometry
}

function materials(): [MeshStandardMaterial, MeshStandardMaterial] {
  return [new MeshStandardMaterial(), new MeshStandardMaterial()]
}

class TestMaterialSubclass extends Material {}

describe('extractMeshMaterialGeometries', () => {
  it('keeps a full-range single-material indexed mesh indexed and compact', () => {
    const geometry = indexedGeometry()
    const [slice] = extractMeshMaterialGeometries(
      new Mesh(geometry, new MeshStandardMaterial()),
      ERROR,
    )

    expect(slice!.geometry.index?.count).toBe(6)
    expect(slice!.geometry.getAttribute('position').count).toBe(4)
    expect(slice!.geometry.getAttribute('normal').count).toBe(4)
  })

  it.each([
    ['indexed', indexedGeometry],
    ['non-indexed', nonIndexedGeometry],
  ] as const)('extracts every compact %s material group', (_, createGeometry) => {
    const geometry = createGeometry()
    geometry.addGroup(0, 3, 0)
    geometry.addGroup(3, 3, 1)

    const slices = extractMeshMaterialGeometries(
      new Mesh(geometry, materials()),
      ERROR,
    )

    expect(slices).toHaveLength(2)
    expect(slices.map(({ geometry: slice }) => ({
      indexed: slice.index !== null,
      positions: slice.getAttribute('position').count,
      elements: slice.index?.count ?? slice.getAttribute('position').count,
    }))).toEqual([
      { indexed: geometry.index !== null, positions: 3, elements: 3 },
      { indexed: geometry.index !== null, positions: 3, elements: 3 },
    ])
  })

  it.each([
    ['indexed', indexedGeometry],
    ['non-indexed', nonIndexedGeometry],
  ] as const)('honors an aligned %s single-material draw range', (_, createGeometry) => {
    const geometry = createGeometry()
    geometry.setDrawRange(3, 3)

    const [slice] = extractMeshMaterialGeometries(
      new Mesh(geometry, new MeshStandardMaterial()),
      ERROR,
    )

    expect(slice!.geometry.index !== null).toBe(geometry.index !== null)
    expect(slice!.geometry.index?.count ?? slice!.geometry.getAttribute('position').count)
      .toBe(3)
    expect(slice!.geometry.getAttribute('position').count).toBe(3)
  })

  it('accepts groups that exactly cover a non-default active draw range', () => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute([
      9, 9, 9, 8, 8, 8, 7, 7, 7,
      -1, 0, 0, 1, 0, 0, 1, 1, 0,
      -1, 0, 0, 1, 1, 0, -1, 1, 0,
    ], 3))
    geometry.setDrawRange(3, 6)
    geometry.addGroup(3, 3, 0)
    geometry.addGroup(6, 3, 1)

    const slices = extractMeshMaterialGeometries(
      new Mesh(geometry, materials()),
      ERROR,
    )

    expect(slices.map(({ geometry: slice }) => (
      slice.getAttribute('position').count
    ))).toEqual([3, 3])
  })

  it.each([
    ['gap', [[0, 3, 0], [6, 3, 1]], undefined],
    ['draw-range-cut', [[0, 6, 0]], [3, 3]],
    ['fractional-start', [[0.5, 3, 0], [3, 3, 1]], undefined],
    ['infinite-count', [[0, Number.POSITIVE_INFINITY, 0]], undefined],
  ] as const)('fails closed on %s group coverage', (_, groups, drawRange) => {
    const geometry = indexedGeometry()
    if (drawRange) geometry.setDrawRange(drawRange[0], drawRange[1])
    for (const [start, count, materialIndex] of groups) {
      geometry.addGroup(start, count, materialIndex)
    }

    expect(() => extractMeshMaterialGeometries(
      new Mesh(geometry, materials()),
      ERROR,
    )).toThrow(ERROR)
  })

  it('fails closed on a sparse material array', () => {
    const geometry = indexedGeometry()
    geometry.addGroup(0, 3, 0)
    geometry.addGroup(3, 3, 1)
    const sparse = new Array<MeshStandardMaterial>(2)
    sparse[0] = new MeshStandardMaterial()

    expect(() => extractMeshMaterialGeometries(
      new Mesh(geometry, sparse),
      ERROR,
    )).toThrow(ERROR)
  })

  it.each([
    ['null', null],
    ['plain object', {}],
    ['forged isMaterial object', { isMaterial: true }],
  ] as const)('fails closed on a %s material entry', (_, invalidMaterial) => {
    const mesh = new Mesh<BufferGeometry, Material>(
      indexedGeometry(),
      new MeshStandardMaterial(),
    )
    mesh.material = invalidMaterial as unknown as Material

    expect(() => extractMeshMaterialGeometries(mesh, ERROR)).toThrow(ERROR)
  })

  it('fails closed on an object that deeply forges the Material surface', () => {
    const forgedMaterial = {
      isMaterial: true,
      uuid: 'forged-material',
      type: 'MeshStandardMaterial',
      version: 0,
      userData: {},
      setValues() {},
      toJSON() { return {} },
      clone() { return this },
      copy() { return this },
      dispose() {},
      addEventListener() {},
      hasEventListener() { return false },
      removeEventListener() {},
      dispatchEvent() {},
    }
    const mesh = new Mesh<BufferGeometry, Material>(
      indexedGeometry(),
      new MeshStandardMaterial(),
    )
    mesh.material = forgedMaterial as unknown as Material

    expect(() => extractMeshMaterialGeometries(mesh, ERROR)).toThrow(ERROR)
  })

  it('accepts a Material subclass from the active Three.js runtime', () => {
    const material = new TestMaterialSubclass()
    const [slice] = extractMeshMaterialGeometries(
      new Mesh(indexedGeometry(), material),
      ERROR,
    )

    expect(slice!.material).toBe(material)
  })

  it.each([
    ['out-of-range index', () => {
      const geometry = indexedGeometry()
      geometry.setIndex([0, 1, 4])
      return geometry
    }],
    ['non-finite index', () => {
      const geometry = indexedGeometry()
      geometry.setIndex(new Float32BufferAttribute([0, 1, Number.NaN], 1))
      return geometry
    }],
    ['floating-point index storage', () => {
      const geometry = indexedGeometry()
      geometry.setIndex(new Float32BufferAttribute([0, 1, 2], 1))
      return geometry
    }],
    ['non-scalar index items', () => {
      const geometry = indexedGeometry()
      geometry.setIndex(new Uint16BufferAttribute([0, 1, 2, 0, 2, 3], 2))
      return geometry
    }],
    ['normalized index storage', () => {
      const geometry = indexedGeometry()
      geometry.setIndex(new Uint16BufferAttribute([0, 1, 2], 1, true))
      return geometry
    }],
    ['short indexed attribute', () => {
      const geometry = indexedGeometry()
      geometry.setAttribute('color', new Float32BufferAttribute([
        1, 0, 0, 0, 1, 0,
      ], 3))
      return geometry
    }],
    ['short non-indexed attribute', () => {
      const geometry = nonIndexedGeometry()
      geometry.setAttribute('color', new Float32BufferAttribute([
        1, 0, 0, 0, 1, 0,
      ], 3))
      return geometry
    }],
    ['unsupported morph attribute', () => {
      const geometry = indexedGeometry()
      geometry.morphAttributes.position = [new Float32BufferAttribute([
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      ], 3)]
      return geometry
    }],
  ] as const)('fails closed on %s', (_, createGeometry) => {
    expect(() => extractMeshMaterialGeometries(
      new Mesh(createGeometry(), new MeshStandardMaterial()),
      ERROR,
    )).toThrow(ERROR)
  })
})
