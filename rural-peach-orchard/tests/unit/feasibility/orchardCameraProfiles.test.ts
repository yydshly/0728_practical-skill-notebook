import { PerspectiveCamera, Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { FollowCameraController } from '../../../src/feasibility/camera/FollowCameraController'
import {
  ORCHARD_CAMERA_MAX_DISPLACEMENT_PER_FRAME_M,
  ORCHARD_CAMERA_PROFILES,
} from '../../../src/feasibility/camera/orchardCameraProfiles'

describe('orchard camera profiles', () => {
  it.each([
    {
      owner: 'player' as const,
      offset: [0, 5.5, 9],
      lookAt: [0, 1, 0],
      responses: [8, 12],
    },
    {
      owner: 'vehicle' as const,
      offset: [0, 6, 11],
      lookAt: [0, 1.4, 0],
      responses: [7, 10],
    },
  ])('applies the readable $owner gameplay envelope', ({
    owner,
    offset,
    lookAt,
    responses,
  }) => {
    const camera = new PerspectiveCamera()
    const profile = ORCHARD_CAMERA_PROFILES[owner]
    const controller = new FollowCameraController({
      camera,
      readTarget: () => ({
        position: new Vector3(),
        heading: new Quaternion(),
      }),
      ...profile,
      maxDisplacementPerFrameM: 100,
    })

    controller.update(10)

    expect(camera.position.toArray()).toEqual(offset)
    expect(profile.localLookAtOffset.toArray()).toEqual(lookAt)
    expect([profile.positionResponse, profile.lookAtResponse])
      .toEqual(responses)
  })

  it('keeps initial and ownership-profile movement within the frame bound', () => {
    const camera = new PerspectiveCamera()
    const target = {
      position: new Vector3(100, 0, 0),
      heading: new Quaternion(),
    }
    const controller = new FollowCameraController({
      camera,
      readTarget: () => target,
      ...ORCHARD_CAMERA_PROFILES.player,
      maxDisplacementPerFrameM:
        ORCHARD_CAMERA_MAX_DISPLACEMENT_PER_FRAME_M,
    })

    controller.update(1)
    const beforeTransition = camera.position.clone()
    target.position.set(-100, 0, 0)
    controller.setProfile(ORCHARD_CAMERA_PROFILES.vehicle)
    controller.update(1)

    const floatingPointToleranceM = 1e-9
    expect(beforeTransition.length()).toBeLessThanOrEqual(
      1.5 + floatingPointToleranceM,
    )
    expect(camera.position.distanceTo(beforeTransition)).toBeLessThanOrEqual(
      1.5 + floatingPointToleranceM,
    )
  })
})
