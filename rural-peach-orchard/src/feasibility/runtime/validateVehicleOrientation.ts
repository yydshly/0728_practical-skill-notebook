import { Vector3 } from 'three'
import type { RuntimeOrientation } from '../assets/RuntimeOrientation'
import type { VehicleRig } from './readVehicleRig'

const MINIMUM_FORWARD_ALIGNMENT = 0.98

export interface VehicleOrientationValidation {
  readonly visualNose: Vector3
  readonly alignment: number
}

export function validateVehicleOrientation(
  rig: VehicleRig,
  orientation: RuntimeOrientation,
): VehicleOrientationValidation {
  const front = rig.wheelAnchors.find((wheel) => wheel.id === 'front')!
  const rearLeft = rig.wheelAnchors.find((wheel) => wheel.id === 'rear-left')!
  const rearRight = rig.wheelAnchors.find((wheel) => wheel.id === 'rear-right')!
  const rearMidpoint = new Vector3(
    (rearLeft.position.x + rearRight.position.x) * 0.5,
    (rearLeft.position.y + rearRight.position.y) * 0.5,
    (rearLeft.position.z + rearRight.position.z) * 0.5,
  )
  const visualNose = new Vector3(
    front.position.x,
    front.position.y,
    front.position.z,
  ).sub(rearMidpoint).normalize()
  const alignment = visualNose.dot(orientation.localForward)

  if (alignment < MINIMUM_FORWARD_ALIGNMENT) {
    throw new Error(`VEHICLE_FORWARD_AXIS_MISMATCH: ${alignment}`)
  }

  return { visualNose, alignment }
}
