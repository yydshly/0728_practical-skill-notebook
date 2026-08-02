import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import RAPIER, { type RigidBody } from '@dimforge/rapier3d-compat'
import { Vector3 } from 'three'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import runtimeAssetContractJson from '../../../public/feasibility/runtime-assets.json'
import { createRuntimeOrientation } from '../../../src/feasibility/assets/RuntimeOrientation'
import { parseRuntimeAssetContract } from '../../../src/feasibility/assets/runtimeAssetContract'
import { PhysicsWorld } from '../../../src/feasibility/physics/PhysicsWorld'
import { readVehicleRig } from '../../../src/feasibility/runtime/readVehicleRig'
import { buildTricycleColliders } from '../../../src/feasibility/vehicle/buildTricycleColliders'
import {
  TricycleController,
  type VehicleInput,
} from '../../../src/feasibility/vehicle/TricycleController'

const contract = parseRuntimeAssetContract(runtimeAssetContractJson)
const orientation = createRuntimeOrientation(contract.vehicle)

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

function localNodePosition(gltf: GLTF, nodeName: string): Vector3 {
  const node = gltf.scene.getObjectByName(nodeName)
  if (!node) throw new Error(`missing real GLB node ${nodeName}`)
  gltf.scene.updateWorldMatrix(true, true)
  return gltf.scene.worldToLocal(node.getWorldPosition(new Vector3()))
}

function deriveVisualNose(gltf: GLTF): Vector3 {
  const front = localNodePosition(gltf, 'wheel_front')
  const rearLeft = localNodePosition(gltf, 'wheel_rear_left')
  const rearRight = localNodePosition(gltf, 'wheel_rear_right')
  const rearMidpoint = rearLeft.add(rearRight).multiplyScalar(0.5)
  return front.sub(rearMidpoint).normalize()
}

export interface RealTricyclePhysicsFixture {
  readonly body: RigidBody
  readonly visualNose: Vector3
  step(count: number, input: VehicleInput): void
}

export async function createRealTricyclePhysicsFixture(): Promise<RealTricyclePhysicsFixture> {
  const [visual, collision] = await Promise.all([
    loadRealGlb('public/assets/vehicle/electric-tricycle-a/visual.glb'),
    loadRealGlb('public/assets/vehicle/electric-tricycle-a/collision.glb'),
  ])
  const visualNose = deriveVisualNose(visual)
  const anchors = new Map<string, typeof visual.scene>()
  visual.scene.traverse((object) => {
    if (object.name) anchors.set(object.name, object as typeof visual.scene)
  })
  const rig = readVehicleRig(
    { scene: visual.scene, anchors, clips: [] },
    contract.vehicle,
  )
  const physics = await PhysicsWorld.create()
  physics.world.createCollider(
    RAPIER.ColliderDesc.cuboid(50, 0.1, 50).setTranslation(0, -0.1, 0),
  )
  const body = physics.world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, 0, 0)
      .setRotation({ x: 0, y: 0, z: 0, w: 1 })
      .setCanSleep(false),
  )
  buildTricycleColliders(
    physics.world,
    body,
    collision.scene,
    contract.vehicle,
  )
  const controller = new TricycleController({
    physics,
    body,
    contract: contract.vehicle,
    orientation,
    wheelAnchors: rig.wheelAnchors,
    cargoAnchorLocal: rig.cargoAnchorLocal,
  })
  controller.setCargoMass(0)

  return {
    body,
    visualNose,
    step(count, input) {
      for (let index = 0; index < count; index += 1) {
        controller.update(input)
        physics.step()
      }
    },
  }
}
