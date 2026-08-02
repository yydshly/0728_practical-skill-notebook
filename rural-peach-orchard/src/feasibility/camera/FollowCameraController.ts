import { Vector3, type PerspectiveCamera } from 'three'
import type { CameraTarget } from './CameraTarget'

export interface FollowCameraControllerDependencies {
  readonly camera: PerspectiveCamera
  readonly readTarget: () => CameraTarget
  readonly localOffset: Readonly<Vector3>
  readonly localLookAtOffset: Readonly<Vector3>
  readonly positionResponse: number
  readonly lookAtResponse: number
  readonly maxDisplacementPerFrameM: number
}

export interface FollowCameraProfile {
  readonly localOffset: Readonly<Vector3>
  readonly localLookAtOffset: Readonly<Vector3>
  readonly positionResponse: number
  readonly lookAtResponse: number
}

export class FollowCameraController {
  private readonly desiredPosition = new Vector3()
  private readonly desiredLookAt = new Vector3()
  private readonly smoothedLookAt = new Vector3()
  private readonly positionDelta = new Vector3()
  private readonly localOffset = new Vector3()
  private readonly localLookAtOffset = new Vector3()
  private positionResponse: number
  private lookAtResponse: number

  constructor(
    private readonly dependencies: FollowCameraControllerDependencies,
  ) {
    this.localOffset.copy(dependencies.localOffset)
    this.localLookAtOffset.copy(dependencies.localLookAtOffset)
    this.positionResponse = dependencies.positionResponse
    this.lookAtResponse = dependencies.lookAtResponse
  }

  setProfile(profile: FollowCameraProfile): void {
    this.localOffset.copy(profile.localOffset)
    this.localLookAtOffset.copy(profile.localLookAtOffset)
    this.positionResponse = profile.positionResponse
    this.lookAtResponse = profile.lookAtResponse
  }

  update(deltaSeconds: number): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return

    const target = this.dependencies.readTarget()
    this.desiredPosition.copy(this.localOffset)
      .applyQuaternion(target.heading)
      .add(target.position)
    this.desiredLookAt.copy(this.localLookAtOffset)
      .applyQuaternion(target.heading)
      .add(target.position)

    const positionAlpha = responseAlpha(this.positionResponse, deltaSeconds)
    this.positionDelta.copy(this.desiredPosition)
      .sub(this.dependencies.camera.position)
      .multiplyScalar(positionAlpha)
    const maximumDisplacement = Math.max(
      0,
      Number.isFinite(this.dependencies.maxDisplacementPerFrameM)
        ? this.dependencies.maxDisplacementPerFrameM
        : 0,
    )
    if (this.positionDelta.length() > maximumDisplacement) {
      this.positionDelta.setLength(maximumDisplacement)
    }
    this.dependencies.camera.position.add(this.positionDelta)

    this.smoothedLookAt.lerp(
      this.desiredLookAt,
      responseAlpha(this.lookAtResponse, deltaSeconds),
    )
    this.dependencies.camera.lookAt(this.smoothedLookAt)
  }
}

function responseAlpha(response: number, deltaSeconds: number): number {
  if (!Number.isFinite(response) || response <= 0) return 0
  return 1 - Math.exp(-response * deltaSeconds)
}
