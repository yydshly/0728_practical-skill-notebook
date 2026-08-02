import RAPIER, { type Collider } from '@dimforge/rapier3d-compat'
import { Quaternion, Vector3, type Object3D, type Scene } from 'three'
import type { RuntimeAssetContract } from '../assets/runtimeAssetContract'
import type { PhysicsWorld } from '../physics/PhysicsWorld'
import type { PlayerController } from '../player/PlayerController'
import type { ControlAuthorityAdapter } from './ControlAuthority'

export interface RuntimeControlAdapterDependencies {
  readonly physics: PhysicsWorld
  readonly scene: Scene
  readonly player: PlayerController
  readonly playerVisual: Object3D
  readonly seatAnchor: Object3D
  readonly exitAnchor: Object3D
  readonly characterContract: RuntimeAssetContract['character']
  readonly isExitSupportCollider?: (collider: Collider) => boolean
  readonly afterMutation?: (boundary: RuntimeControlMutationBoundary) => void
}

export type RuntimeControlMutationBoundary =
  | 'player-collider-enabled'
  | 'player-seat-parented'
  | 'player-seat-position-reset'
  | 'player-seat-rotation-reset'
  | 'player-seat-visibility-hidden'
  | 'player-exit-body-teleported'
  | 'player-exit-next-translation'
  | 'player-exit-scene-parented'
  | 'player-exit-positioned'
  | 'player-exit-rotated'
  | 'player-exit-visibility-restored'

export interface RuntimeControlAdapter extends ControlAuthorityAdapter {
  lastExitBlockerHandle(): number | null
}

const EXIT_OVERLAP_PROBE = Object.freeze({ x: 0, y: 0.000_001, z: 0 })
const EXIT_CLEARANCE_M = 0.15
const EXIT_GROUND_CLEARANCE_M = 0.01

export function createRuntimeControlAdapter(
  dependencies: RuntimeControlAdapterDependencies,
): RuntimeControlAdapter {
  const exitGroundPosition = new Vector3()
  const exitCapsulePosition = new Vector3()
  const capsuleCenterOffset = new Vector3()
  const exitClearanceOffset = new Vector3()
  const exitRotation = new Quaternion()
  const capsuleCenterHeightM = dependencies.characterContract.capsuleHalfHeightM
    + dependencies.characterContract.capsuleRadiusM
    + EXIT_GROUND_CLEARANCE_M
  const capsule = new RAPIER.Capsule(
    dependencies.characterContract.capsuleHalfHeightM,
    dependencies.characterContract.capsuleRadiusM,
  )
  let lastExitBlockerHandle: number | null = null
  const afterMutation = (boundary: RuntimeControlMutationBoundary): void => {
    dependencies.afterMutation?.(boundary)
  }
  const updateExitTransform = (): void => {
    dependencies.exitAnchor.getWorldPosition(exitGroundPosition)
    dependencies.exitAnchor.getWorldQuaternion(exitRotation)
    exitClearanceOffset
      .set(-(
        dependencies.characterContract.capsuleRadiusM
        + EXIT_CLEARANCE_M
      ), 0, 0)
      .applyQuaternion(exitRotation)
    exitGroundPosition.add(exitClearanceOffset)
    capsuleCenterOffset
      .set(0, capsuleCenterHeightM, 0)
      .applyQuaternion(exitRotation)
    exitCapsulePosition.copy(exitGroundPosition).add(capsuleCenterOffset)
  }
  return {
    setPlayerColliderEnabled(enabled) {
      const previousEnabled = dependencies.player.collider.isEnabled()
      try {
        dependencies.player.collider.setEnabled(enabled)
        afterMutation('player-collider-enabled')
      } catch (error) {
        dependencies.player.collider.setEnabled(previousEnabled)
        throw error
      }
    },
    attachPlayerToSeat() {
      const previousParent = dependencies.playerVisual.parent
      const previousPosition = dependencies.playerVisual.position.clone()
      const previousQuaternion = dependencies.playerVisual.quaternion.clone()
      const previousVisible = dependencies.playerVisual.visible
      try {
        dependencies.seatAnchor.add(dependencies.playerVisual)
        afterMutation('player-seat-parented')
        dependencies.playerVisual.position.set(0, 0, 0)
        afterMutation('player-seat-position-reset')
        dependencies.playerVisual.quaternion.identity()
        afterMutation('player-seat-rotation-reset')
        dependencies.playerVisual.visible = false
        afterMutation('player-seat-visibility-hidden')
      } catch (error) {
        if (previousParent) previousParent.add(dependencies.playerVisual)
        else dependencies.playerVisual.removeFromParent()
        dependencies.playerVisual.position.copy(previousPosition)
        dependencies.playerVisual.quaternion.copy(previousQuaternion)
        dependencies.playerVisual.visible = previousVisible
        throw error
      }
    },
    placePlayerAtExit() {
      updateExitTransform()
      const translation = {
        x: exitCapsulePosition.x,
        y: exitCapsulePosition.y,
        z: exitCapsulePosition.z,
      }
      const previousBodyTranslation = {
        ...dependencies.player.body.translation(),
      }
      const previousNextTranslation = {
        ...dependencies.player.body.nextTranslation(),
      }
      const previousParent = dependencies.playerVisual.parent
      const previousPosition = dependencies.playerVisual.position.clone()
      const previousQuaternion = dependencies.playerVisual.quaternion.clone()
      const previousVisible = dependencies.playerVisual.visible
      try {
        dependencies.player.body.setTranslation(translation, true)
        afterMutation('player-exit-body-teleported')
        dependencies.player.body.setNextKinematicTranslation(translation)
        afterMutation('player-exit-next-translation')
        dependencies.scene.add(dependencies.playerVisual)
        afterMutation('player-exit-scene-parented')
        dependencies.playerVisual.position.copy(exitGroundPosition)
        afterMutation('player-exit-positioned')
        dependencies.playerVisual.quaternion.copy(exitRotation)
        afterMutation('player-exit-rotated')
        dependencies.playerVisual.visible = true
        afterMutation('player-exit-visibility-restored')
      } catch (error) {
        dependencies.player.body.setTranslation(previousBodyTranslation, true)
        dependencies.player.body.setNextKinematicTranslation(
          previousNextTranslation,
        )
        if (previousParent) previousParent.add(dependencies.playerVisual)
        else dependencies.playerVisual.removeFromParent()
        dependencies.playerVisual.position.copy(previousPosition)
        dependencies.playerVisual.quaternion.copy(previousQuaternion)
        dependencies.playerVisual.visible = previousVisible
        throw error
      }
    },
    exitIsBlocked() {
      updateExitTransform()
      const hit = dependencies.physics.world.castShape(
        exitCapsulePosition,
        exitRotation,
        EXIT_OVERLAP_PROBE,
        capsule,
        0,
        1,
        true,
        RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
        undefined,
        dependencies.player.collider,
        dependencies.player.body,
        (collider) => !(
          dependencies.isExitSupportCollider?.(collider) ?? false
        ),
      )
      lastExitBlockerHandle = hit?.collider.handle ?? null
      return hit !== null
    },
    lastExitBlockerHandle: () => lastExitBlockerHandle,
  }
}
