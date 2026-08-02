import RAPIER, {
  type Collider,
  type KinematicCharacterController,
  type RigidBody,
  type Vector,
} from '@dimforge/rapier3d-compat'
import type { RuntimeAssetContract } from '../assets/runtimeAssetContract'
import type { PhysicsWorld } from '../physics/PhysicsWorld'

type RuntimeCharacterContract = RuntimeAssetContract['character']

export interface PlayerMoveIntent {
  readonly x: number
  readonly y: number
  readonly z: number
}

export interface PlayerControllerDependencies {
  readonly physics: PhysicsWorld
  readonly contract: RuntimeCharacterContract
  readonly initialTranslation: Readonly<Vector>
}

const CHARACTER_OFFSET_M = 0.01

export class PlayerController {
  readonly body: RigidBody
  readonly collider: Collider

  private readonly characterController: KinematicCharacterController
  private readonly physics: PhysicsWorld
  private disposed = false

  constructor(dependencies: PlayerControllerDependencies) {
    const { physics, contract, initialTranslation } = dependencies
    this.physics = physics
    this.body = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        initialTranslation.x,
        initialTranslation.y,
        initialTranslation.z,
      ),
    )
    this.collider = physics.world.createCollider(
      RAPIER.ColliderDesc.capsule(
        contract.capsuleHalfHeightM,
        contract.capsuleRadiusM,
      ),
      this.body,
    )
    this.characterController = physics.world.createCharacterController(
      CHARACTER_OFFSET_M,
    )
    this.characterController.enableAutostep(
      contract.stepHeightM,
      contract.capsuleRadiusM,
      false,
    )
    this.characterController.setMaxSlopeClimbAngle(
      contract.maxSlopeDeg * Math.PI / 180,
    )
  }

  move(intent: PlayerMoveIntent): void {
    this.characterController.computeColliderMovement(
      this.collider,
      intent,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
    )
    const corrected = this.characterController.computedMovement()
    const current = this.body.translation()
    this.body.setNextKinematicTranslation({
      x: current.x + corrected.x,
      y: current.y + corrected.y,
      z: current.z + corrected.z,
    })
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.physics.removeCharacterController(this.characterController)
    this.physics.removeRigidBody(this.body)
  }
}
