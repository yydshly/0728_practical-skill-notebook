import { Vector3, type Object3D } from 'three'
import type { LoadedCriticalAsset } from '../assets/loadCriticalGlb'
import { createRuntimeOrientation } from '../assets/RuntimeOrientation'
import type { RuntimeAssetContract } from '../assets/runtimeAssetContract'
import type { WheelAnchor } from '../vehicle/TricycleController'
import type {
  TricycleColliderVector,
  TricycleWheelVisuals,
} from '../vehicle/types'
import { validateVehicleOrientation } from './validateVehicleOrientation'

export interface VehicleRig {
  readonly seatAnchor: Object3D
  readonly exitAnchor: Object3D
  readonly cargoAnchor: Object3D
  readonly cargoAnchorLocal: TricycleColliderVector
  readonly wheelAnchors: readonly WheelAnchor[]
  readonly wheelVisuals: TricycleWheelVisuals
}

function requireAnchor(
  asset: LoadedCriticalAsset,
  nodeName: string,
): Object3D {
  const anchor = asset.anchors.get(nodeName)
  if (!anchor) throw new Error(`VEHICLE_RUNTIME_ANCHOR_MISSING: ${nodeName}`)
  return anchor
}

function localPosition(root: Object3D, anchor: Object3D): TricycleColliderVector {
  root.updateWorldMatrix(true, true)
  const value = root.worldToLocal(anchor.getWorldPosition(new Vector3()))
  return { x: value.x, y: value.y, z: value.z }
}

function bindRenderableWheelMeshes(root: Object3D, pivot: Object3D): void {
  const prefix = `${pivot.name}_`
  const meshes: Object3D[] = []
  root.traverse((object) => {
    if (object !== pivot && object.type === 'Mesh' && object.name.startsWith(prefix)) {
      meshes.push(object)
    }
  })
  root.updateMatrixWorld(true)
  for (const mesh of meshes) pivot.attach(mesh)
  root.updateMatrixWorld(true)
}

export function readVehicleRig(
  asset: LoadedCriticalAsset,
  contract: RuntimeAssetContract['vehicle'],
): VehicleRig {
  const seatAnchor = requireAnchor(asset, contract.anchors.seat)
  const exitAnchor = requireAnchor(asset, contract.anchors.exit)
  const cargoAnchor = requireAnchor(asset, contract.anchors.cargo)
  const front = requireAnchor(asset, contract.anchors.frontWheel)
  const rearLeft = requireAnchor(asset, contract.anchors.rearLeftWheel)
  const rearRight = requireAnchor(asset, contract.anchors.rearRightWheel)
  bindRenderableWheelMeshes(asset.scene, front)
  bindRenderableWheelMeshes(asset.scene, rearLeft)
  bindRenderableWheelMeshes(asset.scene, rearRight)
  const rig: VehicleRig = {
    seatAnchor,
    exitAnchor,
    cargoAnchor,
    cargoAnchorLocal: localPosition(asset.scene, cargoAnchor),
    wheelAnchors: [
      {
        id: 'front',
        position: localPosition(asset.scene, front),
        radiusM: contract.frontRadiusM,
        driven: false,
      },
      {
        id: 'rear-left',
        position: localPosition(asset.scene, rearLeft),
        radiusM: contract.rearRadiusM,
        driven: true,
      },
      {
        id: 'rear-right',
        position: localPosition(asset.scene, rearRight),
        radiusM: contract.rearRadiusM,
        driven: true,
      },
    ],
    wheelVisuals: {
      front,
      rearLeft,
      rearRight,
    },
  }
  validateVehicleOrientation(rig, createRuntimeOrientation(contract))
  return rig
}
