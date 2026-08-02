import RAPIER, {
  type RigidBody,
  type World,
} from '@dimforge/rapier3d-compat'
import {
  Box3,
  BufferAttribute,
  Matrix4,
  Mesh,
  Quaternion,
  Vector3,
  type Object3D,
} from 'three'
import type { RuntimeAssetContract } from '../assets/runtimeAssetContract'
import type {
  BuiltTricycleColliders,
  MeasuredWheelEnvelope,
  TricycleColliderVector,
} from './types'
import { isWheelRadiusWithinTolerance } from './wheelRadiusTolerance'

type VehicleContract = RuntimeAssetContract['vehicle']

interface MeasuredBox {
  nodeName: string
  center: Vector3
  halfExtents: Vector3
  rotation: Quaternion
}

function copyVector(vector: Vector3): TricycleColliderVector {
  return { x: vector.x, y: vector.y, z: vector.z }
}

function requireFinitePositiveScale(nodeName: string, scale: Vector3): void {
  if (
    !Number.isFinite(scale.x)
    || !Number.isFinite(scale.y)
    || !Number.isFinite(scale.z)
    || scale.x <= 0
    || scale.y <= 0
    || scale.z <= 0
  ) {
    throw new Error(`${nodeName}: mesh scale must be finite and positive`)
  }
}

function collectCollisionMeshes(collisionScene: Object3D): Map<string, Mesh> {
  const meshes = new Map<string, Mesh>()
  collisionScene.traverse((object) => {
    if (object === collisionScene) return
    if (!object.name) {
      throw new Error('Collision mesh has no configured node name')
    }
    if (!(object instanceof Mesh)) {
      throw new Error(`${object.name}: collision node is not a mesh`)
    }
    if (meshes.has(object.name)) {
      throw new Error(`${object.name}: collision mesh node name is duplicated`)
    }
    meshes.set(object.name, object)
  })
  return meshes
}

function measureBox(
  mesh: Mesh,
  rootWorldInverse: Matrix4,
): MeasuredBox {
  const position = mesh.geometry.getAttribute('position')
  if (!(position instanceof BufferAttribute) || position.count === 0) {
    throw new Error(`${mesh.name}: POSITION geometry is required`)
  }

  requireFinitePositiveScale(mesh.name, mesh.scale)
  const relativeMatrix = new Matrix4().multiplyMatrices(
    rootWorldInverse,
    mesh.matrixWorld,
  )
  const translation = new Vector3()
  const rotation = new Quaternion()
  const scale = new Vector3()
  relativeMatrix.decompose(translation, rotation, scale)
  requireFinitePositiveScale(mesh.name, scale)

  const bounds = new Box3().setFromBufferAttribute(position)
  const size = bounds.getSize(new Vector3()).multiply(scale)
  if (
    !Number.isFinite(size.x)
    || !Number.isFinite(size.y)
    || !Number.isFinite(size.z)
    || size.x <= 0
    || size.y <= 0
    || size.z <= 0
  ) {
    throw new Error(`${mesh.name}: geometry bounds must be finite and positive`)
  }

  return {
    nodeName: mesh.name,
    center: bounds.getCenter(new Vector3()).applyMatrix4(relativeMatrix),
    halfExtents: size.multiplyScalar(0.5),
    rotation,
  }
}

function requireConfiguredMeshes(
  meshes: ReadonlyMap<string, Mesh>,
  contract: VehicleContract,
): void {
  const configured = new Set([
    ...contract.chassisColliderNodes,
    ...contract.wheelEnvelopeNodes,
  ])
  for (const nodeName of meshes.keys()) {
    if (!configured.has(nodeName)) {
      throw new Error(`${nodeName}: collision mesh has no configured role`)
    }
  }
  for (const nodeName of configured) {
    if (!meshes.has(nodeName)) {
      throw new Error(`${nodeName}: configured collision mesh is missing`)
    }
  }
}

function expectedWheelRadius(
  nodeName: string,
  contract: VehicleContract,
): number {
  return nodeName === 'convex_front_wheel'
    ? contract.frontRadiusM
    : contract.rearRadiusM
}

function measureWheelEnvelope(
  measured: MeasuredBox,
  contract: VehicleContract,
): MeasuredWheelEnvelope {
  const radiusM = Math.max(
    measured.halfExtents.y,
    measured.halfExtents.z,
  )
  const expectedRadiusM = expectedWheelRadius(measured.nodeName, contract)
  if (!isWheelRadiusWithinTolerance(radiusM, expectedRadiusM)) {
    throw new Error(
      `${measured.nodeName}: measured wheel radius ${radiusM}m does not match declared ${expectedRadiusM}m`,
    )
  }
  return {
    nodeName: measured.nodeName,
    center: copyVector(measured.center),
    halfExtents: copyVector(measured.halfExtents),
    radiusM,
  }
}

export function buildTricycleColliders(
  world: World,
  body: RigidBody,
  collisionScene: Object3D,
  contract: VehicleContract,
): BuiltTricycleColliders {
  collisionScene.updateMatrixWorld(true)
  const meshes = collectCollisionMeshes(collisionScene)
  requireConfiguredMeshes(meshes, contract)

  const rootWorldInverse = collisionScene.matrixWorld.clone().invert()
  const chassis = contract.chassisColliderNodes.map((nodeName) => (
    measureBox(meshes.get(nodeName)!, rootWorldInverse)
  ))
  const wheelEnvelopes = contract.wheelEnvelopeNodes.map((nodeName) => (
    measureWheelEnvelope(
      measureBox(meshes.get(nodeName)!, rootWorldInverse),
      contract,
    )
  ))

  const chassisColliderHandles = chassis.map((measured) => {
    const collider = world.createCollider(
      RAPIER.ColliderDesc.cuboid(
        measured.halfExtents.x,
        measured.halfExtents.y,
        measured.halfExtents.z,
      )
        .setTranslation(
          measured.center.x,
          measured.center.y,
          measured.center.z,
        )
        .setRotation(measured.rotation),
      body,
    )
    return collider.handle
  })

  return { chassisColliderHandles, wheelEnvelopes }
}
