import { Quaternion, Vector3 } from 'three'

export interface CameraTarget {
  readonly position: Readonly<Vector3>
  readonly heading: Readonly<Quaternion>
}

export type CameraTargetOwner = 'player' | 'vehicle'

export interface CameraTargetTransitionDependencies {
  readonly initialOwner: CameraTargetOwner
  readonly transitionSeconds: number
  readonly readTarget: (owner: CameraTargetOwner, output: CameraTarget) => void
  readonly onOwnerChanged: (owner: CameraTargetOwner) => void
}

export function blendCameraTargets(
  from: CameraTarget,
  to: CameraTarget,
  blend: number,
  output: CameraTarget,
): CameraTarget {
  const boundedBlend = Math.min(Math.max(blend, 0), 1)
  output.position.lerpVectors(from.position, to.position, boundedBlend)
  output.heading.slerpQuaternions(from.heading, to.heading, boundedBlend)
  return output
}

export class CameraTargetTransition {
  private readonly transitionFromTarget = createCameraTarget()
  private readonly currentTarget = createCameraTarget()
  readonly target = createCameraTarget()
  private elapsedSeconds: number
  private currentOwner: CameraTargetOwner
  private readonly transitionSeconds: number

  constructor(
    private readonly dependencies: CameraTargetTransitionDependencies,
  ) {
    this.currentOwner = dependencies.initialOwner
    this.transitionSeconds = Math.max(
      Number.EPSILON,
      Number.isFinite(dependencies.transitionSeconds)
        ? dependencies.transitionSeconds
        : Number.EPSILON,
    )
    this.elapsedSeconds = this.transitionSeconds
    this.dependencies.readTarget(this.currentOwner, this.currentTarget)
    copyCameraTarget(this.currentTarget, this.transitionFromTarget)
    copyCameraTarget(this.currentTarget, this.target)
  }

  get owner(): CameraTargetOwner {
    return this.currentOwner
  }

  update(owner: CameraTargetOwner, deltaSeconds: number): boolean {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return false

    if (owner !== this.currentOwner) {
      this.evaluateCurrentTarget()
      copyCameraTarget(this.target, this.transitionFromTarget)
      this.currentOwner = owner
      this.elapsedSeconds = 0
      this.dependencies.onOwnerChanged(owner)
    }
    this.elapsedSeconds = Math.min(
      this.transitionSeconds,
      this.elapsedSeconds + deltaSeconds,
    )
    this.evaluateCurrentTarget()
    return true
  }

  private evaluateCurrentTarget(): void {
    this.dependencies.readTarget(this.currentOwner, this.currentTarget)
    blendCameraTargets(
      this.transitionFromTarget,
      this.currentTarget,
      this.elapsedSeconds / this.transitionSeconds,
      this.target,
    )
  }
}

function createCameraTarget(): CameraTarget {
  return {
    position: new Vector3(),
    heading: new Quaternion(),
  }
}

function copyCameraTarget(source: CameraTarget, destination: CameraTarget): void {
  destination.position.copy(source.position)
  destination.heading.copy(source.heading)
}
