export interface RecoveryVector {
  readonly x: number
  readonly y: number
  readonly z: number
}

export interface RecoveryQuaternion extends RecoveryVector {
  readonly w: number
}

export interface RecoveryPose {
  readonly translation: RecoveryVector
  readonly rotation: RecoveryQuaternion
}

export interface RecoveryObservation {
  readonly chassisY: number
  readonly floorY: number
  readonly rollDegrees: number
  readonly deltaSeconds: number
  readonly explicitReset: boolean
}

export interface RecoveryManagerDependencies {
  readonly getDomainSnapshot: () => unknown
  readonly setBodyPose: (pose: RecoveryPose) => void
  readonly zeroBodyVelocity: () => void
}

const MAX_UPRIGHT_ROLL_DEGREES = 70
const OVERTURN_SECONDS = 2

function clonePose(pose: RecoveryPose): RecoveryPose {
  return {
    translation: { ...pose.translation },
    rotation: { ...pose.rotation },
  }
}

export class RecoveryManager {
  private latestSafePose: RecoveryPose | undefined
  private overturnedSeconds = 0
  private recoveryCountValue = 0
  private normalRouteEligibleValue = true

  constructor(
    private readonly dependencies: RecoveryManagerDependencies,
  ) {}

  get recoveryCount(): number {
    return this.recoveryCountValue
  }

  get normalRouteEligible(): boolean {
    return this.normalRouteEligibleValue
  }

  recordSafePoint(_id: string, pose: RecoveryPose): void {
    this.latestSafePose = clonePose(pose)
  }

  needsRecovery(observation: RecoveryObservation): boolean {
    if (observation.explicitReset) return true
    if (observation.chassisY < observation.floorY) return true

    if (Math.abs(observation.rollDegrees) > MAX_UPRIGHT_ROLL_DEGREES) {
      this.overturnedSeconds += Number.isFinite(observation.deltaSeconds)
        ? Math.max(0, observation.deltaSeconds)
        : 0
    } else {
      this.overturnedSeconds = 0
    }
    return this.overturnedSeconds >= OVERTURN_SECONDS
  }

  currentDomainSnapshot(): unknown {
    return structuredClone(this.dependencies.getDomainSnapshot())
  }

  recoverPhysicsOnly(): void {
    if (!this.latestSafePose) {
      throw new Error('RECOVERY_SAFE_POINT_MISSING')
    }
    const beforeBytes = JSON.stringify(this.dependencies.getDomainSnapshot())
    this.dependencies.setBodyPose(clonePose(this.latestSafePose))
    this.dependencies.zeroBodyVelocity()
    this.recoveryCountValue += 1
    this.normalRouteEligibleValue = false
    this.overturnedSeconds = 0
    const afterBytes = JSON.stringify(this.dependencies.getDomainSnapshot())
    if (afterBytes !== beforeBytes) {
      throw new Error('RECOVERY_MUTATED_DOMAIN')
    }
  }
}
