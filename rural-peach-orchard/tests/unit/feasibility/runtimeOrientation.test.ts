import { Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import {
  createRuntimeOrientation,
  worldForward,
} from '../../../src/feasibility/assets/RuntimeOrientation'

describe('runtime orientation', () => {
  it('creates immutable Y-up and negative-Z-forward local vectors', () => {
    const orientation = createRuntimeOrientation({
      upAxis: 'Y',
      forwardAxis: '-Z',
    })

    expect(orientation.upAxis).toBe('Y')
    expect(orientation.forwardAxis).toBe('-Z')
    expect(orientation.localUp).toEqual(new Vector3(0, 1, 0))
    expect(orientation.localForward).toEqual(new Vector3(0, 0, -1))
    expect(Object.isFrozen(orientation.localUp)).toBe(true)
    expect(Object.isFrozen(orientation.localForward)).toBe(true)
  })

  it('rotates local negative-Z forward into world space', () => {
    const orientation = createRuntimeOrientation({
      upAxis: 'Y',
      forwardAxis: '-Z',
    })
    const rotation = new Quaternion().setFromAxisAngle(
      new Vector3(0, 1, 0),
      Math.PI / 2,
    )
    const target = new Vector3()

    expect(worldForward(orientation, rotation, target)).toBe(target)
    expect(target.x).toBeCloseTo(-1)
    expect(target.y).toBeCloseTo(0)
    expect(target.z).toBeCloseTo(0)
  })
})
