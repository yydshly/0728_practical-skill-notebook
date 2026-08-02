import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Object3D, Vector3 } from 'three'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { describe, expect, it } from 'vitest'
import { createRuntimeOrientation } from '../../../src/feasibility/assets/RuntimeOrientation'
import type { VehicleRig } from '../../../src/feasibility/runtime/readVehicleRig'
import { validateVehicleOrientation } from '../../../src/feasibility/runtime/validateVehicleOrientation'

const orientation = createRuntimeOrientation({
  upAxis: 'Y',
  forwardAxis: '-Z',
})

async function loadRealGlb(path: string): Promise<GLTF> {
  const bytes = await readFile(resolve(path))
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
  return new Promise((resolveGltf, reject) => {
    new GLTFLoader().parse(buffer, '', resolveGltf, reject)
  })
}

function requireLocalPosition(gltf: GLTF, nodeName: string): Vector3 {
  const node = gltf.scene.getObjectByName(nodeName)
  if (!node) throw new Error(`missing real GLB node ${nodeName}`)
  gltf.scene.updateWorldMatrix(true, true)
  return gltf.scene.worldToLocal(node.getWorldPosition(new Vector3()))
}

function createRig(frontZ: number, rearZ: number): VehicleRig {
  const seatAnchor = new Object3D()
  const exitAnchor = new Object3D()
  const cargoAnchor = new Object3D()
  const frontWheel = new Object3D()
  const rearLeftWheel = new Object3D()
  const rearRightWheel = new Object3D()
  return {
    seatAnchor,
    exitAnchor,
    cargoAnchor,
    cargoAnchorLocal: { x: 0, y: 0, z: 0 },
    wheelAnchors: [
      {
        id: 'front',
        position: { x: 0, y: 0.3, z: frontZ },
        radiusM: 0.3,
        driven: false,
      },
      {
        id: 'rear-left',
        position: { x: -0.5, y: 0.3, z: rearZ },
        radiusM: 0.3,
        driven: true,
      },
      {
        id: 'rear-right',
        position: { x: 0.5, y: 0.3, z: rearZ },
        radiusM: 0.3,
        driven: true,
      },
    ],
    wheelVisuals: {
      front: frontWheel,
      rearLeft: rearLeftWheel,
      rearRight: rearRightWheel,
    },
  }
}

describe('vehicle visual orientation', () => {
  it('returns the normalized visual nose and its declared-forward alignment', () => {
    const result = validateVehicleOrientation(createRig(-1.1, 0.9), orientation)

    expect(result.visualNose.toArray()).toEqual([0, 0, -1])
    expect(result.alignment).toBe(1)
  })

  it('throws the stable mismatch code below the minimum alignment', () => {
    expect(() => validateVehicleOrientation(createRig(1.1, -0.9), orientation))
      .toThrow('VEHICLE_FORWARD_AXIS_MISMATCH')
  })

  it('aligns the real GLB nose from rear axle to front wheel with negative Z', async () => {
    const gltf = await loadRealGlb(
      'public/assets/vehicle/electric-tricycle-a/visual.glb',
    )
    const front = requireLocalPosition(gltf, 'wheel_front')
    const rearLeft = requireLocalPosition(gltf, 'wheel_rear_left')
    const rearRight = requireLocalPosition(gltf, 'wheel_rear_right')
    const rearMidpoint = rearLeft.clone().add(rearRight).multiplyScalar(0.5)
    const visualNose = front.clone().sub(rearMidpoint).normalize()
    const alignment = visualNose.dot(new Vector3(0, 0, -1))

    expect(alignment).toBeGreaterThanOrEqual(0.98)
  })
})
