import { Quaternion, Vector3, type Object3D } from 'three'

export interface InterpolatedBodyPose {
  readonly translation: Readonly<{ x: number; y: number; z: number }>
  readonly rotation: Readonly<{
    x: number
    y: number
    z: number
    w: number
  }>
}

interface MutablePose {
  readonly translation: Vector3
  readonly rotation: Quaternion
}

function copyPose(target: MutablePose, source: InterpolatedBodyPose): void {
  target.translation.set(
    source.translation.x,
    source.translation.y,
    source.translation.z,
  )
  target.rotation.set(
    source.rotation.x,
    source.rotation.y,
    source.rotation.z,
    source.rotation.w,
  ).normalize()
}

export class BodyPoseInterpolator {
  private readonly previous: MutablePose = {
    translation: new Vector3(),
    rotation: new Quaternion(),
  }

  private readonly current: MutablePose = {
    translation: new Vector3(),
    rotation: new Quaternion(),
  }

  constructor(initialPose: InterpolatedBodyPose) {
    this.snap(initialPose)
  }

  beginFixedStep(): void {
    this.previous.translation.copy(this.current.translation)
    this.previous.rotation.copy(this.current.rotation)
  }

  capture(pose: InterpolatedBodyPose): void {
    copyPose(this.current, pose)
  }

  snap(pose: InterpolatedBodyPose): void {
    copyPose(this.previous, pose)
    copyPose(this.current, pose)
  }

  applyTo(visual: Object3D, alpha: number): void {
    const boundedAlpha = Math.min(Math.max(alpha, 0), 1)
    visual.position.lerpVectors(
      this.previous.translation,
      this.current.translation,
      boundedAlpha,
    )
    visual.quaternion.slerpQuaternions(
      this.previous.rotation,
      this.current.rotation,
      boundedAlpha,
    )
  }
}
