import { PerspectiveCamera, Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import {
  FollowCameraController,
  type FollowCameraProfile,
} from '../../../src/feasibility/camera/FollowCameraController'
import {
  blendCameraTargets,
  type CameraTarget,
} from '../../../src/feasibility/camera/CameraTarget'

const LOCAL_OFFSET = new Vector3(0, 4, 7)
const LOCAL_LOOK_AT_OFFSET = new Vector3(0, 1, 0)

function createTarget(
  position = new Vector3(),
  heading = new Quaternion(),
): CameraTarget {
  return { position, heading }
}

function createController(
  target: CameraTarget,
  overrides: Partial<{
    positionResponse: number
    lookAtResponse: number
    maxDisplacementPerFrameM: number
  }> = {},
): { readonly camera: PerspectiveCamera; readonly controller: FollowCameraController } {
  const camera = new PerspectiveCamera()
  return {
    camera,
    controller: new FollowCameraController({
      camera,
      readTarget: () => target,
      localOffset: LOCAL_OFFSET,
      localLookAtOffset: LOCAL_LOOK_AT_OFFSET,
      positionResponse: overrides.positionResponse ?? 1000,
      lookAtResponse: overrides.lookAtResponse ?? 1000,
      maxDisplacementPerFrameM: overrides.maxDisplacementPerFrameM ?? 1000,
    }),
  }
}

describe('FollowCameraController', () => {
  it('blends the target position and heading during an ownership transition', () => {
    const blended = createTarget()
    blendCameraTargets(
      createTarget(new Vector3(0, 0, 0), new Quaternion()),
      createTarget(
        new Vector3(8, 2, 4),
        new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2),
      ),
      0.5,
      blended,
    )

    expect(blended.position.toArray()).toEqual([4, 1, 2])
    expect(new Vector3(0, 0, -1).applyQuaternion(blended.heading).x)
      .toBeCloseTo(-Math.SQRT1_2)
    expect(new Vector3(0, 0, -1).applyQuaternion(blended.heading).z)
      .toBeCloseTo(-Math.SQRT1_2)
  })

  it('places the camera behind and above an identity-heading target', () => {
    const { camera, controller } = createController(createTarget())

    controller.update(1)

    expect(camera.position.toArray()).toEqual([0, 4, 7])
  })

  it('rotates the camera offsets with a 90-degree target heading', () => {
    const heading = new Quaternion().setFromAxisAngle(
      new Vector3(0, 1, 0),
      Math.PI / 2,
    )
    const { camera, controller } = createController(createTarget(
      new Vector3(10, 2, 3),
      heading,
    ))

    controller.update(1)

    expect(camera.position.x).toBeCloseTo(17)
    expect(camera.position.y).toBeCloseTo(6)
    expect(camera.position.z).toBeCloseTo(3)
  })

  it('keeps the camera behind a reversing target instead of moving to its nose', () => {
    const reverseHeading = new Quaternion().setFromAxisAngle(
      new Vector3(0, 1, 0),
      Math.PI,
    )
    const { camera, controller } = createController(createTarget(
      new Vector3(4, 0, 9),
      reverseHeading,
    ))

    controller.update(1)

    expect(camera.position.x).toBeCloseTo(4)
    expect(camera.position.z).toBeCloseTo(2)
  })

  it('smooths position and look-at independently', () => {
    const { camera, controller } = createController(createTarget(), {
      positionResponse: 0,
      lookAtResponse: 1000,
    })
    camera.position.set(0, 4, 7)

    controller.update(1)

    expect(camera.position.toArray()).toEqual([0, 4, 7])
    const direction = camera.getWorldDirection(new Vector3())
    expect(direction.x).toBeCloseTo(0)
    expect(direction.y).toBeCloseTo(-3 / Math.sqrt(58))
    expect(direction.z).toBeCloseTo(-7 / Math.sqrt(58))
  })

  it.each([0, Number.NaN, Number.POSITIVE_INFINITY])(
    'does not move position or look-at for invalid delta %s',
    (deltaSeconds) => {
      const { camera, controller } = createController(createTarget())
      camera.position.set(2, 3, 4)
      camera.quaternion.setFromAxisAngle(new Vector3(0, 1, 0), 0.6)
      const positionBefore = camera.position.clone()
      const rotationBefore = camera.quaternion.clone()

      controller.update(deltaSeconds)

      expect(camera.position).toEqual(positionBefore)
      expect(camera.quaternion.toArray()).toEqual(rotationBefore.toArray())
    },
  )

  it('caps every position update, including after a target and profile transition', () => {
    const target = createTarget(new Vector3(100, 0, 0))
    const { camera, controller } = createController(target, {
      maxDisplacementPerFrameM: 2,
    })
    const vehicleProfile: FollowCameraProfile = {
      localOffset: new Vector3(0, 6, 12),
      localLookAtOffset: new Vector3(0, 2, 0),
      positionResponse: 1000,
      lookAtResponse: 1000,
    }

    controller.update(1)
    const beforeTransition = camera.position.clone()
    target.position.set(-100, 0, 0)
    controller.setProfile(vehicleProfile)
    controller.update(1)

    expect(beforeTransition.length()).toBeCloseTo(2)
    expect(camera.position.distanceTo(beforeTransition)).toBeLessThanOrEqual(2)
  })
})
