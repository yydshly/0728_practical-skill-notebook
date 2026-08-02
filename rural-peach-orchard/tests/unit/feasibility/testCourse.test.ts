import RAPIER from '@dimforge/rapier3d-compat'
import {
  Mesh,
  MeshBasicMaterial,
  Scene,
} from 'three'
import { describe, expect, it } from 'vitest'
import {
  createOrchardCourse,
} from '../../../src/feasibility/course/createOrchardCourse'
import { PhysicsWorld } from '../../../src/feasibility/physics/PhysicsWorld'
import {
  ORCHARD_WORLD_DEFINITION,
} from '../../../src/feasibility/world/orchardWorldDefinition'

describe('flat orchard runtime course', () => {
  it('creates one flat floor, hidden obstacles, tree trunks, and six sensors', async () => {
    const scene = new Scene()
    const physics = await PhysicsWorld.create()
    const course = createOrchardCourse(
      scene,
      physics,
      ORCHARD_WORLD_DEFINITION,
      false,
    )

    expect(course.floorColliders).toHaveLength(1)
    expect(course.obstacleColliders).toHaveLength(5)
    expect(course.trunkColliders).toHaveLength(30)
    expect(course.sensorIds).toEqual([
      'parking', 'tree-inventory', 'basket',
      'crate', 'cargo-slot', 'delivery',
    ])
    expect(course.debugRoot).toBeNull()
    expect(scene.children).toEqual([])
  })

  it('places every hidden collider above the y=0 gameplay anchor', async () => {
    const physics = await PhysicsWorld.create()
    const course = createOrchardCourse(
      new Scene(),
      physics,
      ORCHARD_WORLD_DEFINITION,
      false,
    )

    const floor = course.floorColliders[0]!.collider
    expect(floor.shapeType()).toBe(RAPIER.ShapeType.Cuboid)
    expect(floor.halfExtents().x).toBe(40)
    expect(floor.halfExtents().z).toBe(30)
    expect(floor.translation().y + floor.halfExtents().y).toBeCloseTo(0, 7)
    expect(floor.parent()?.isFixed()).toBe(true)

    const obstaclesById = new Map(course.obstacleColliders.map(
      (surface) => [surface.id, surface],
    ))
    for (const obstacle of ORCHARD_WORLD_DEFINITION.obstacles) {
      if (obstacle.kind !== 'box') continue
      const surface = obstaclesById.get(obstacle.id)!
      expect(surface.proxySetId).toBe('orchard-world-obstacles-v1')
      expect(surface.collider.translation()).toEqual({
        x: expect.closeTo(obstacle.translation.x, 5),
        y: expect.closeTo(obstacle.translation.y + obstacle.halfExtents.y, 5),
        z: expect.closeTo(obstacle.translation.z, 5),
      })
      expect(surface.collider.parent()?.isFixed()).toBe(true)
    }

    const trunksById = new Map(course.trunkColliders.map(
      (surface) => [surface.id, surface],
    ))
    for (const obstacle of ORCHARD_WORLD_DEFINITION.obstacles) {
      if (obstacle.kind !== 'trunk') continue
      const surface = trunksById.get(obstacle.id)!
      expect(surface.proxySetId).toBe('orchard-tree-trunks-v1')
      expect(surface.collider.shapeType()).toBe(RAPIER.ShapeType.Cylinder)
      expect(surface.collider.translation()).toEqual({
        x: expect.closeTo(obstacle.translation.x, 5),
        y: expect.closeTo(obstacle.translation.y + obstacle.halfHeightM, 5),
        z: expect.closeTo(obstacle.translation.z, 5),
      })
      expect(surface.collider.parent()?.isFixed()).toBe(true)
    }
  })

  it('keeps semantic sensor anchors at y=0 while raising collider centres', async () => {
    const physics = await PhysicsWorld.create()
    const course = createOrchardCourse(
      new Scene(),
      physics,
      ORCHARD_WORLD_DEFINITION,
      false,
    )
    const sensors = [
      course.parkingSensor,
      ...Object.values(course.harvestSensors),
      course.deliverySensor,
    ]
    const sensorsById = new Map(sensors.map((sensor) => [sensor.id, sensor]))

    for (const definition of ORCHARD_WORLD_DEFINITION.sensors) {
      expect(definition.translation.y).toBe(0)
      const collider = sensorsById.get(definition.id)!.collider
      expect(collider.isSensor()).toBe(true)
      expect(collider.translation()).toEqual({
        x: expect.closeTo(definition.translation.x, 5),
        y: expect.closeTo(definition.translation.y + definition.halfExtents.y, 5),
        z: expect.closeTo(definition.translation.z, 5),
      })
    }
    expect(course.spawnPoses).toBe(ORCHARD_WORLD_DEFINITION.spawnPoses)
    expect(course.safePoints).toBe(ORCHARD_WORLD_DEFINITION.safePoints)
    expect(physics.world.bodies.len()).toBe(36)
    expect(physics.world.colliders.len()).toBe(42)
  })

  it('adds only tagged wireframe proxies when debug rendering is explicit', async () => {
    const scene = new Scene()
    const physics = await PhysicsWorld.create()
    const course = createOrchardCourse(
      scene,
      physics,
      ORCHARD_WORLD_DEFINITION,
      true,
    )

    expect(course.debugRoot?.parent).toBe(scene)
    expect(course.debugRoot?.userData.debugOnly).toBe(true)
    const debugMeshes: Mesh[] = []
    course.debugRoot?.traverse((object) => {
      if (object instanceof Mesh) debugMeshes.push(object)
    })
    expect(debugMeshes).toHaveLength(42)
    for (const mesh of debugMeshes) {
      expect(mesh.userData.debugOnly).toBe(true)
      expect((mesh.material as MeshBasicMaterial).wireframe).toBe(true)
    }
  })
})
