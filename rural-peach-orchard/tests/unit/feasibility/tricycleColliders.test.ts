import RAPIER from '@dimforge/rapier3d-compat'
import { NodeIO } from '@gltf-transform/core'
import { resolve } from 'node:path'
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
  type Object3D,
} from 'three'
import { beforeAll, describe, expect, it } from 'vitest'
import { parseRuntimeAssetContract } from '../../../src/feasibility/assets/runtimeAssetContract'
import { buildTricycleColliders } from '../../../src/feasibility/vehicle/buildTricycleColliders'

const runtimeContract = parseRuntimeAssetContract({
  version: 2,
  vehicle: {
    assetId: 'vehicle.electric-tricycle-a',
    upAxis: 'Y',
    forwardAxis: '-Z',
    chassisColliderNodes: [
      'box_chassis',
      'box_driver_mass',
      'box_bed_floor',
      'box_bed_left_wall',
      'box_bed_right_wall',
      'box_bed_front_wall',
      'box_bed_rear_wall',
    ],
    wheelEnvelopeNodes: [
      'convex_front_wheel',
      'convex_rear_left',
      'convex_rear_right',
    ],
    anchors: {
      seat: 'driver_seat',
      exit: 'exit_left',
      frontWheel: 'wheel_front',
      rearLeftWheel: 'wheel_rear_left',
      rearRightWheel: 'wheel_rear_right',
      cargo: 'cargo_slot_01',
    },
    emptyMassKg: 420,
    centerOfMass: [0, 0.4, 0.12],
    frontRadiusM: 0.29,
    rearRadiusM: 0.275,
    suspensionRestM: 0.18,
    suspensionTravelM: 0.12,
    springNPerM: 26000,
    compressionDampingNsPerM: 3800,
    reboundDampingNsPerM: 4200,
    maxDriveForceN: 2600,
    maxBrakeForceN: 6000,
    maxSteerRad: 0.48,
    maxSpeedMps: 5,
    lateralGripCoefficient: 1.15,
  },
  character: {
    assetId: 'character.farmer-a-base',
    capsuleHalfHeightM: 0.62,
    capsuleRadiusM: 0.22,
    stepHeightM: 0.24,
    maxSlopeDeg: 42,
  },
  environment: {
    worldAssetId: 'environment.orchard-world-overall-v1',
    treeAssetId: 'environment.peach-tree-overall-v1',
    treeVariantNodes: {
      a: 'peach_tree_variant_a',
      b: 'peach_tree_variant_b',
      c: 'peach_tree_variant_c',
    },
  },
}).vehicle

async function inspectRegisteredTricycleCollisionGlb() {
  const document = await new NodeIO().read(resolve(
    'public/assets/vehicle/electric-tricycle-a/collision.glb',
  ))
  const names = document.getRoot().listNodes().map((node) => node.getName())
  return {
    chassisNames: names.filter((name) => name.startsWith('box_')).sort(),
    wheelEnvelopeNames: names.filter((name) => name.startsWith('convex_')).sort(),
    unmappedNames: names.filter(
      (name) => !name.startsWith('box_') && !name.startsWith('convex_'),
    ).sort(),
  }
}

function addBox(
  parent: Object3D,
  name: string,
  dimensions: readonly [number, number, number],
): Mesh {
  const mesh = new Mesh(
    new BoxGeometry(...dimensions),
    new MeshBasicMaterial(),
  )
  mesh.name = name
  parent.add(mesh)
  return mesh
}

function createCollisionScene(): Group {
  const scene = new Group()
  scene.position.set(4, 3, 2)
  scene.rotation.set(0, -Math.PI / 4, 0)

  for (const name of runtimeContract.chassisColliderNodes) {
    const mesh = addBox(scene, name, [0.8, 0.2, 1.4])
    if (name === 'box_chassis') {
      mesh.geometry.translate(0.1, 0, 0)
      mesh.position.set(0.25, 0.5, -0.75)
      mesh.rotation.set(0, Math.PI / 2, 0)
      mesh.scale.set(1.5, 1, 0.5)
    }
  }

  addBox(scene, 'convex_front_wheel', [0.15, 0.58, 0.58])
  addBox(scene, 'convex_rear_left', [0.14, 0.55, 0.55])
  addBox(scene, 'convex_rear_right', [0.14, 0.55, 0.55])
  return scene
}

beforeAll(async () => {
  await RAPIER.init()
})

describe('registered tricycle collision GLB', () => {
  it('uses all seven box nodes as chassis and all three convex nodes as wheel envelopes', async () => {
    const result = await inspectRegisteredTricycleCollisionGlb()
    expect(result.chassisNames).toEqual([
      'box_bed_floor',
      'box_bed_front_wall',
      'box_bed_left_wall',
      'box_bed_rear_wall',
      'box_bed_right_wall',
      'box_chassis',
      'box_driver_mass',
    ])
    expect(result.wheelEnvelopeNames).toEqual([
      'convex_front_wheel',
      'convex_rear_left',
      'convex_rear_right',
    ])
    expect(result.unmappedNames).toEqual([])
  })

  it('creates seven cuboids but no wheel colliders and measures three wheel envelopes', () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic())

    const built = buildTricycleColliders(
      world,
      body,
      createCollisionScene(),
      runtimeContract,
    )

    expect(built.chassisColliderHandles).toHaveLength(7)
    expect(world.colliders.len()).toBe(7)
    expect(built.chassisColliderHandles.map(
      (handle) => world.getCollider(handle).shapeType(),
    )).toEqual(Array(7).fill(RAPIER.ShapeType.Cuboid))
    expect(built.wheelEnvelopes.map(({ nodeName }) => nodeName)).toEqual([
      'convex_front_wheel',
      'convex_rear_left',
      'convex_rear_right',
    ])
    expect(built.wheelEnvelopes[0]!.radiusM).toBeCloseTo(0.29)
    expect(built.wheelEnvelopes[1]!.radiusM).toBeCloseTo(0.275)
    expect(built.wheelEnvelopes[2]!.radiusM).toBeCloseTo(0.275)

    const chassisCollider = world.getCollider(
      built.chassisColliderHandles[0]!,
    )
    expect(chassisCollider.halfExtents()).toEqual({
      x: expect.closeTo(0.6),
      y: expect.closeTo(0.1),
      z: expect.closeTo(0.35),
    })
    expect(chassisCollider.translationWrtParent()).toEqual({
      x: expect.closeTo(0.25),
      y: expect.closeTo(0.5),
      z: expect.closeTo(-0.9),
    })
    const actualRotation = chassisCollider.rotationWrtParent()!
    const expectedRotation = new Quaternion().setFromAxisAngle(
      new Vector3(0, 1, 0),
      Math.PI / 2,
    )
    const quaternionDot = Math.abs(
      actualRotation.x * expectedRotation.x
      + actualRotation.y * expectedRotation.y
      + actualRotation.z * expectedRotation.z
      + actualRotation.w * expectedRotation.w
    )
    expect(quaternionDot).toBeCloseTo(1, 6)
  })

  it('rejects non-positive mesh scale before mutating the physics world', () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic())
    const collisionScene = createCollisionScene()
    collisionScene.getObjectByName('box_bed_floor')!.scale.y = 0

    expect(() => buildTricycleColliders(
      world,
      body,
      collisionScene,
      runtimeContract,
    )).toThrow('box_bed_floor')
    expect(world.colliders.len()).toBe(0)
  })

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid mesh scale %s before mutating the physics world',
    (invalidScale) => {
      const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic())
      const collisionScene = createCollisionScene()
      collisionScene.getObjectByName('box_bed_floor')!.scale.y = invalidScale

      expect(() => buildTricycleColliders(
        world,
        body,
        collisionScene,
        runtimeContract,
      )).toThrow('box_bed_floor')
      expect(world.colliders.len()).toBe(0)
    },
  )

  it('rejects unconfigured collision meshes before mutating the physics world', () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic())
    const collisionScene = createCollisionScene()
    addBox(collisionScene, 'box_unregistered', [1, 1, 1])

    expect(() => buildTricycleColliders(
      world,
      body,
      collisionScene,
      runtimeContract,
    )).toThrow('box_unregistered')
    expect(world.colliders.len()).toBe(0)
  })

  it('rejects unconfigured non-mesh nodes before mutating the physics world', () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic())
    const collisionScene = createCollisionScene()
    const unexpectedNode = new Group()
    unexpectedNode.name = 'unexpected_group'
    collisionScene.add(unexpectedNode)

    expect(() => buildTricycleColliders(
      world,
      body,
      collisionScene,
      runtimeContract,
    )).toThrow('unexpected_group')
    expect(world.colliders.len()).toBe(0)
  })

  it('rejects a missing configured mesh before mutating the physics world', () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic())
    const collisionScene = createCollisionScene()
    collisionScene.remove(collisionScene.getObjectByName('box_bed_floor')!)

    expect(() => buildTricycleColliders(
      world,
      body,
      collisionScene,
      runtimeContract,
    )).toThrow('box_bed_floor')
    expect(world.colliders.len()).toBe(0)
  })

  it('rejects a wheel-radius mismatch before mutating the physics world', () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic())
    const mismatchedContract = structuredClone(runtimeContract)
    mismatchedContract.frontRadiusM = 0.310002

    expect(() => buildTricycleColliders(
      world,
      body,
      createCollisionScene(),
      mismatchedContract,
    )).toThrow('convex_front_wheel')
    expect(world.colliders.len()).toBe(0)
  })

  it('accepts a wheel-radius difference exactly at the inclusive 0.02m tolerance', () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic())
    const boundaryContract = structuredClone(runtimeContract)
    boundaryContract.frontRadiusM = 0.31

    expect(() => buildTricycleColliders(
      world,
      body,
      createCollisionScene(),
      boundaryContract,
    )).not.toThrow()
    expect(world.colliders.len()).toBe(7)
  })

  it('maps declared wheel radii by registered node identity, not array order', () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic())
    const reorderedContract = structuredClone(runtimeContract)
    reorderedContract.wheelEnvelopeNodes = [
      'convex_rear_left',
      'convex_front_wheel',
      'convex_rear_right',
    ]
    reorderedContract.frontRadiusM = 0.305
    reorderedContract.rearRadiusM = 0.265

    expect(() => buildTricycleColliders(
      world,
      body,
      createCollisionScene(),
      reorderedContract,
    )).not.toThrow()
    expect(world.colliders.len()).toBe(7)
  })
})
