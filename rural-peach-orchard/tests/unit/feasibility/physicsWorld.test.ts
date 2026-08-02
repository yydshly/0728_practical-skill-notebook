import { describe, expect, it } from 'vitest'
import { PhysicsWorld } from '../../../src/feasibility/physics/PhysicsWorld'

describe('PhysicsWorld', () => {
  it('settles a dynamic body on a fixed floor', async () => {
    const physics = await PhysicsWorld.create()
    physics.createFixedCuboid(
      { x: 0, y: -0.05, z: 0 },
      { x: 5, y: 0.05, z: 5 },
    )
    const body = physics.createDynamicCuboid(
      { x: 0, y: 2, z: 0 },
      { x: 0.5, y: 0.5, z: 0.5 },
    )

    for (let i = 0; i < 180; i += 1) physics.step()

    expect(body.translation().y).toBeGreaterThan(0.45)
    expect(body.translation().y).toBeLessThan(0.55)
  })
})
