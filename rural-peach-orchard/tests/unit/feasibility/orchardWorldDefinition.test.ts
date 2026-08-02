import { describe, expect, it } from 'vitest'
import {
  ORCHARD_WORLD_DEFINITION,
  type OrchardWorldDefinition,
} from '../../../src/feasibility/world/orchardWorldDefinition'
import { validateOrchardWorldDefinition } from '../../../src/feasibility/world/validateOrchardWorldDefinition'

describe('orchard world definition', () => {
  it('pins one flat 80 by 60 metre world and all semantic anchors', () => {
    expect(ORCHARD_WORLD_DEFINITION.bounds).toEqual({ widthM: 80, depthM: 60 })
    expect(ORCHARD_WORLD_DEFINITION.gameplayPlaneY).toBe(0)
    expect(ORCHARD_WORLD_DEFINITION.sensors.map(({ id }) => id)).toEqual([
      'parking', 'tree-inventory', 'basket', 'crate', 'cargo-slot', 'delivery',
    ])
    expect(ORCHARD_WORLD_DEFINITION.treeInstances).toHaveLength(30)
    expect(() => validateOrchardWorldDefinition(ORCHARD_WORLD_DEFINITION))
      .not.toThrow()
  })

  it('faces the vehicle local -Z axis into the first outbound route segment', () => {
    const route = ORCHARD_WORLD_DEFINITION.route.outbound
    const firstSegment = route.slice(1).map((to, index) => ({
      x: to.x - route[index]!.x,
      z: to.z - route[index]!.z,
    })).find(({ x, z }) => Math.hypot(x, z) > 0)!
    const segmentLength = Math.hypot(firstSegment.x, firstSegment.z)
    const yaw = ORCHARD_WORLD_DEFINITION.spawnPoses.vehicle.yawRadians
    const alignment = (
      -Math.sin(yaw) * firstSegment.x
      - Math.cos(yaw) * firstSegment.z
    ) / segmentLength

    expect(alignment).toBeGreaterThan(0)
  })

  it('starts the outbound route exactly at the vehicle spawn', () => {
    expect(ORCHARD_WORLD_DEFINITION.route.outbound[0]).toEqual(
      ORCHARD_WORLD_DEFINITION.spawnPoses.vehicle.translation,
    )
  })

  it('rejects an outbound start offset from the vehicle spawn', () => {
    const invalid = structuredClone(ORCHARD_WORLD_DEFINITION) as OrchardWorldDefinition
    invalid.route.outbound[0]!.z -= 0.5

    expect(() => validateOrchardWorldDefinition(invalid))
      .toThrow('WORLD_ROUTE_ENDPOINTS_INVALID')
  })

  it('rejects a vehicle spawn heading opposed to the outbound route', () => {
    const invalid = structuredClone(ORCHARD_WORLD_DEFINITION) as OrchardWorldDefinition
    invalid.spawnPoses.vehicle.yawRadians = 0

    expect(() => validateOrchardWorldDefinition(invalid))
      .toThrow('WORLD_VEHICLE_SPAWN_HEADING_INVALID')
  })

  it('rejects a spawn recovery point that changes the vehicle spawn pose', () => {
    const invalid = structuredClone(ORCHARD_WORLD_DEFINITION) as OrchardWorldDefinition
    const spawnSafePoint = invalid.safePoints.find(({ id }) => (
      id === 'vehicle-spawn-safe-point'
    ))!
    spawnSafePoint.pose.yawRadians = Math.PI / 2

    expect(() => validateOrchardWorldDefinition(invalid))
      .toThrow('WORLD_VEHICLE_SPAWN_SAFE_POINT_INVALID')
  })

  it('rejects gameplay anchors above the plane and duplicate stable ids', () => {
    const invalid = structuredClone(ORCHARD_WORLD_DEFINITION) as OrchardWorldDefinition
    invalid.sensors[0]!.translation.y = 0.1
    invalid.treeInstances[1]!.id = invalid.treeInstances[0]!.id
    expect(() => validateOrchardWorldDefinition(invalid))
      .toThrow(/WORLD_(OUT_OF_PLANE|DUPLICATE_ID)/)
  })

  it('keeps the vehicle corridor clear of farmhouse, walls, and tree trunks', () => {
    const invalid = structuredClone(ORCHARD_WORLD_DEFINITION) as OrchardWorldDefinition
    invalid.obstacles.push({
      id: 'blocked-road',
      kind: 'box',
      translation: { x: 0, y: 0, z: 0 },
      halfExtents: { x: 2.5, y: 1, z: 1 },
    })
    expect(() => validateOrchardWorldDefinition(invalid))
      .toThrow('WORLD_ROUTE_CLEARANCE_BLOCKED')
  })

  it('rejects a vehicle corridor width that can weaken route clearance', () => {
    const invalid = structuredClone(ORCHARD_WORLD_DEFINITION) as OrchardWorldDefinition
    ;(invalid as { vehicleCorridorHalfWidthM: number }).vehicleCorridorHalfWidthM = 0
    expect(() => validateOrchardWorldDefinition(invalid))
      .toThrow('WORLD_VEHICLE_CORRIDOR_WIDTH_INVALID')
  })

  it.each([
    ['NaN', Number.NaN],
    ['positive infinity', Number.POSITIVE_INFINITY],
    ['negative infinity', Number.NEGATIVE_INFINITY],
  ])('rejects a %s vehicle corridor width', (_label, width) => {
    const invalid = structuredClone(ORCHARD_WORLD_DEFINITION) as OrchardWorldDefinition
    ;(invalid as { vehicleCorridorHalfWidthM: number }).vehicleCorridorHalfWidthM = width
    expect(() => validateOrchardWorldDefinition(invalid))
      .toThrow('WORLD_VEHICLE_CORRIDOR_WIDTH_INVALID')
  })

  it('keeps the empty local-light inventory valid', () => {
    expect(ORCHARD_WORLD_DEFINITION.lighting.localLights).toEqual([])
    expect(() => validateOrchardWorldDefinition(ORCHARD_WORLD_DEFINITION))
      .not.toThrow()
  })

  it('rejects a local light whose emitter landmark and node are missing', () => {
    const invalid = structuredClone(ORCHARD_WORLD_DEFINITION) as OrchardWorldDefinition
    ;(invalid.lighting as { localLights: unknown[] }).localLights = [{
      id: 'missing-emitter-light',
      emitter: { landmarkId: 'missing-emitter-landmark', nodeName: 'missing_emitter_node' },
      attachment: { translation: { x: 0, y: 1, z: 0 }, yawRadians: 0 },
      type: 'point',
      rangeM: 5,
      color: 0xffe0b2,
      intensity: 1,
      castsShadow: true,
      occlusionIntent: 'casts-shadow',
      enabled: true,
      fallback: 'disable-when-emitter-unavailable',
    }]
    expect(() => validateOrchardWorldDefinition(invalid))
      .toThrow('WORLD_LOCAL_LIGHT_EMITTER_INVALID: missing-emitter-light')
  })

  it('rejects an interaction target enclosed by obstacle footprints', () => {
    const invalid = structuredClone(ORCHARD_WORLD_DEFINITION) as OrchardWorldDefinition
    const tree = invalid.sensors.find(({ id }) => id === 'tree-inventory')!
    invalid.obstacles.push(
      { id: 'tree-wall-n', kind: 'box', translation: { x: 4.5, y: 0, z: 13.3 }, halfExtents: { x: 1.4, y: 1, z: 0.1 } },
      { id: 'tree-wall-s', kind: 'box', translation: { x: 4.5, y: 0, z: 10.7 }, halfExtents: { x: 1.4, y: 1, z: 0.1 } },
      { id: 'tree-wall-e', kind: 'box', translation: { x: 5.8, y: 0, z: 12 }, halfExtents: { x: 0.1, y: 1, z: 1.4 } },
      { id: 'tree-wall-w', kind: 'box', translation: { x: 3.2, y: 0, z: 12 }, halfExtents: { x: 0.1, y: 1, z: 1.4 } },
    )
    expect(tree.translation).toEqual({ x: 4.5, y: 0, z: 12 })
    expect(() => validateOrchardWorldDefinition(invalid))
      .toThrow('WORLD_TARGET_UNREACHABLE: tree-inventory')
  })
})
