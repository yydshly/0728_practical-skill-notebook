import { describe, expect, it } from 'vitest'
import { FixedStepRunner } from '../../../src/feasibility/physics/FixedStepRunner'

describe('FixedStepRunner', () => {
  it('runs exactly sixty fixed steps for one accumulated second', () => {
    const runner = new FixedStepRunner(1 / 60, 0.25)
    let count = 0

    for (let frame = 0; frame < 60; frame += 1) {
      runner.advance(1 / 60, () => { count += 1 })
    }

    expect(count).toBe(60)
  })

  it('preserves a fractional step as interpolation alpha', () => {
    const runner = new FixedStepRunner(1 / 60, 0.25)

    const result = runner.advance(1 / 120, () => {
      throw new Error('a half-step must not advance the simulation')
    })

    expect(result).toEqual({ steps: 0, alpha: 0.5, droppedSeconds: 0 })
  })

  it('clamps a long frame and reports the rejected time', () => {
    const runner = new FixedStepRunner(1 / 60, 0.25)
    let count = 0

    const result = runner.advance(1, () => { count += 1 })

    expect(count).toBe(15)
    expect(result.steps).toBe(15)
    expect(result.alpha).toBeCloseTo(0)
    expect(result.droppedSeconds).toBe(0.75)
  })
})
