import { describe, expect, it, vi } from 'vitest'
import { ORCHARD_WORLD_DEFINITION } from '../../../src/feasibility/world/orchardWorldDefinition'
import {
  RecoveryManager,
  type RecoveryPose,
} from '../../../src/feasibility/recovery/RecoveryManager'
import { createCourseRecoveryObservation } from '../../../src/feasibility/recovery/createCourseRecoveryObservation'

const SPAWN_POSE: RecoveryPose = {
  translation: { x: 0, y: 0.6, z: -8 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
}

function createManager(snapshot: unknown = {
  jobState: 'vehicle-loaded',
  owners: { 'fruit-1': 'vehicle' },
}) {
  const setBodyPose = vi.fn()
  const zeroBodyVelocity = vi.fn()
  const manager = new RecoveryManager({
    getDomainSnapshot: () => snapshot,
    setBodyPose,
    zeroBodyVelocity,
  })
  manager.recordSafePoint('spawn', SPAWN_POSE)
  return { manager, setBodyPose, zeroBodyVelocity }
}

describe('RecoveryManager trigger policy', () => {
  it('uses 0.2 m below the authored gameplay plane with an exclusive boundary', () => {
    const { manager } = createManager()
    const atFloor = createCourseRecoveryObservation(ORCHARD_WORLD_DEFINITION, {
      chassisY: -0.2,
      rollDegrees: 0,
      deltaSeconds: 1 / 60,
      explicitReset: false,
    })
    expect(atFloor.floorY).toBe(-0.2)
    expect(manager.needsRecovery(atFloor)).toBe(false)

    const belowFloor = createCourseRecoveryObservation(ORCHARD_WORLD_DEFINITION, {
      chassisY: -0.200_001,
      rollDegrees: 0,
      deltaSeconds: 1 / 60,
      explicitReset: false,
    })
    expect(manager.needsRecovery(belowFloor)).toBe(true)
  })

  it('requests recovery immediately below the course floor', () => {
    const { manager } = createManager()

    expect(manager.needsRecovery({
      chassisY: -1.01,
      floorY: -1,
      rollDegrees: 0,
      deltaSeconds: 1 / 60,
      explicitReset: false,
    })).toBe(true)
  })

  it('requires roll above 70 degrees for two continuous seconds', () => {
    const { manager } = createManager()
    const observe = (rollDegrees: number, deltaSeconds: number) => (
      manager.needsRecovery({
        chassisY: 0.6,
        floorY: -1,
        rollDegrees,
        deltaSeconds,
        explicitReset: false,
      })
    )

    expect(observe(71, 1.25)).toBe(false)
    expect(observe(70, 0.01)).toBe(false)
    expect(observe(-71, 1.99)).toBe(false)
    expect(observe(-71, 0.01)).toBe(true)
  })

  it('requests recovery immediately for an explicit reset', () => {
    const { manager } = createManager()

    expect(manager.needsRecovery({
      chassisY: 0.6,
      floorY: -1,
      rollDegrees: 0,
      deltaSeconds: 0,
      explicitReset: true,
    })).toBe(true)
  })
})

describe('RecoveryManager physics-only recovery', () => {
  it('restores the latest safe pose and zeroes velocity without changing domain bytes', () => {
    const domainSnapshot = Object.freeze({
      jobState: 'vehicle-loaded',
      owners: { 'fruit-1': 'vehicle' },
    })
    const beforeBytes = JSON.stringify(domainSnapshot)
    const { manager, setBodyPose, zeroBodyVelocity } = createManager(
      domainSnapshot,
    )
    const latestPose: RecoveryPose = {
      translation: { x: 7.3, y: 0.6, z: 13 },
      rotation: { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 },
    }
    manager.recordSafePoint('before-slope', latestPose)

    manager.recoverPhysicsOnly()

    expect(setBodyPose).toHaveBeenCalledWith(latestPose)
    expect(zeroBodyVelocity).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(manager.currentDomainSnapshot())).toBe(beforeBytes)
  })

  it('keeps a monotonic count and permanently disqualifies the normal route', () => {
    const { manager } = createManager()

    manager.recoverPhysicsOnly()
    manager.recoverPhysicsOnly()

    expect(manager.recoveryCount).toBe(2)
    expect(manager.normalRouteEligible).toBe(false)
  })

  it('refuses recovery when no safe point has been recorded', () => {
    const manager = new RecoveryManager({
      getDomainSnapshot: () => ({ jobState: 'accepted', owners: {} }),
      setBodyPose: vi.fn(),
      zeroBodyVelocity: vi.fn(),
    })

    expect(() => manager.recoverPhysicsOnly()).toThrow(
      'RECOVERY_SAFE_POINT_MISSING',
    )
  })
})
