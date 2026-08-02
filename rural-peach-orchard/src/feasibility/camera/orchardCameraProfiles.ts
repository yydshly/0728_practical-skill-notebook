import { Vector3 } from 'three'
import type { CameraTargetOwner } from './CameraTarget'
import type { FollowCameraProfile } from './FollowCameraController'

function lockedVector3(x: number, y: number, z: number): Readonly<Vector3> {
  return Object.freeze(new Vector3(x, y, z))
}

export const ORCHARD_CAMERA_PROFILES: Readonly<
  Record<CameraTargetOwner, FollowCameraProfile>
> = Object.freeze({
  player: Object.freeze({
    localOffset: lockedVector3(0, 5.5, 9),
    localLookAtOffset: lockedVector3(0, 1, 0),
    positionResponse: 8,
    lookAtResponse: 12,
  }),
  vehicle: Object.freeze({
    localOffset: lockedVector3(0, 6, 11),
    localLookAtOffset: lockedVector3(0, 1.4, 0),
    positionResponse: 7,
    lookAtResponse: 10,
  }),
})

export const ORCHARD_CAMERA_TARGET_TRANSITION_SECONDS = 0.25
export const ORCHARD_CAMERA_MAX_DISPLACEMENT_PER_FRAME_M = 1.5
