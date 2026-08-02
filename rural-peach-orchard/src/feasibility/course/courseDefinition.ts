import type { OrchardSensorId } from '../world/orchardWorldDefinition'

export interface CourseVector {
  readonly x: number
  readonly y: number
  readonly z: number
}

export interface CourseQuaternion extends CourseVector {
  readonly w: number
}

export interface CoursePose {
  readonly translation: CourseVector
  readonly rotation: CourseQuaternion
}

export interface CourseCuboidDefinition {
  readonly id: string
  readonly translation: CourseVector
  readonly halfExtents: CourseVector
  readonly rotation: CourseQuaternion
}

export type CourseSensorId = OrchardSensorId

export interface CourseSensorDefinition extends CourseCuboidDefinition {
  readonly id: CourseSensorId
}

export type CourseSafePointId =
  | 'spawn'
  | 'before-slope'
  | 'orchard-parking'
  | 'delivery'

export interface CourseSafePoint extends CoursePose {
  readonly id: CourseSafePointId
}

export interface CourseDefinition {
  readonly flatLengthM: number
  readonly turnDegrees: number
  readonly jointHeightM: number
  readonly slopeDegrees: number
  readonly slopeLengthM: number
  readonly slopeRiseM: number
  readonly roadThicknessM: number
  readonly recoveryFloorY: number
  readonly surfaces: readonly CourseCuboidDefinition[]
  readonly sensors: readonly CourseSensorDefinition[]
  readonly spawnPoses: Readonly<{
    vehicle: CoursePose
    player: CoursePose
  }>
  readonly safePoints: readonly CourseSafePoint[]
}

const FLAT_LENGTH_M = 20
const TURN_DEGREES = 90
const JOINT_HEIGHT_M = 0.06
const SLOPE_DEGREES = 8
const SLOPE_LENGTH_M = 12
const ROAD_THICKNESS_M = 0.2
const ROAD_HALF_WIDTH_M = 2
const TURN_RADIANS = TURN_DEGREES * Math.PI / 180
const SLOPE_RADIANS = SLOPE_DEGREES * Math.PI / 180
const SLOPE_RISE_M = Math.sin(SLOPE_RADIANS) * SLOPE_LENGTH_M
const SLOPE_RUN_M = Math.cos(SLOPE_RADIANS) * SLOPE_LENGTH_M
const SLOPE_START_X = 8.3
const SLOPE_END_X = SLOPE_START_X + SLOPE_RUN_M
const SLOPE_CENTER_X = SLOPE_START_X
  + SLOPE_RUN_M / 2
  + Math.sin(SLOPE_RADIANS) * ROAD_THICKNESS_M / 2
const SLOPE_CENTER_Y = JOINT_HEIGHT_M
  + SLOPE_RISE_M / 2
  - Math.cos(SLOPE_RADIANS) * ROAD_THICKNESS_M / 2
const PARKING_TOP_Y = JOINT_HEIGHT_M + SLOPE_RISE_M

const IDENTITY_ROTATION = Object.freeze({ x: 0, y: 0, z: 0, w: 1 })
const VEHICLE_FORWARD_Z_ROTATION = Object.freeze({ x: 0, y: 1, z: 0, w: 0 })
const VEHICLE_FORWARD_X_ROTATION = Object.freeze({
  x: 0,
  y: Math.sin(-TURN_RADIANS / 2),
  z: 0,
  w: Math.cos(-TURN_RADIANS / 2),
})
const SLOPE_ROTATION = Object.freeze({
  x: 0,
  y: 0,
  z: Math.sin(SLOPE_RADIANS / 2),
  w: Math.cos(SLOPE_RADIANS / 2),
})

const surfaces = Object.freeze([
  Object.freeze({
    id: 'flat-road',
    translation: Object.freeze({ x: 0, y: -0.1, z: 0 }),
    halfExtents: Object.freeze({
      x: ROAD_HALF_WIDTH_M,
      y: ROAD_THICKNESS_M / 2,
      z: FLAT_LENGTH_M / 2,
    }),
    rotation: IDENTITY_ROTATION,
  }),
  Object.freeze({
    id: 'turn-platform',
    translation: Object.freeze({ x: 3, y: -0.1, z: 13 }),
    halfExtents: Object.freeze({ x: 5, y: 0.1, z: 3 }),
    rotation: IDENTITY_ROTATION,
  }),
  Object.freeze({
    id: 'joint',
    translation: Object.freeze({ x: 8.15, y: JOINT_HEIGHT_M / 2, z: 13 }),
    halfExtents: Object.freeze({ x: 0.15, y: JOINT_HEIGHT_M / 2, z: ROAD_HALF_WIDTH_M }),
    rotation: IDENTITY_ROTATION,
  }),
  Object.freeze({
    id: 'slope',
    translation: Object.freeze({ x: SLOPE_CENTER_X, y: SLOPE_CENTER_Y, z: 13 }),
    halfExtents: Object.freeze({ x: SLOPE_LENGTH_M / 2, y: ROAD_THICKNESS_M / 2, z: ROAD_HALF_WIDTH_M }),
    rotation: SLOPE_ROTATION,
  }),
  Object.freeze({
    id: 'parking-platform',
    translation: Object.freeze({ x: SLOPE_END_X + 3, y: PARKING_TOP_Y - ROAD_THICKNESS_M / 2, z: 13 }),
    halfExtents: Object.freeze({ x: 3, y: ROAD_THICKNESS_M / 2, z: ROAD_HALF_WIDTH_M }),
    rotation: IDENTITY_ROTATION,
  }),
] satisfies CourseCuboidDefinition[])

// The lowest lower face of the controlled road collision cuboids. Once the
// chassis center is below this plane it has left the course surface volume.
const RECOVERY_FLOOR_Y = Math.min(...surfaces.map((surface) => (
  surface.translation.y - surface.halfExtents.y
)))

const sensors = Object.freeze([
  Object.freeze({
    id: 'parking',
    translation: Object.freeze({ x: SLOPE_END_X + 2, y: PARKING_TOP_Y + 0.5, z: 13 }),
    halfExtents: Object.freeze({ x: 1.5, y: 0.5, z: 1.5 }),
    rotation: IDENTITY_ROTATION,
  }),
  Object.freeze({
    id: 'tree-inventory',
    translation: Object.freeze({ x: SLOPE_END_X + 1, y: PARKING_TOP_Y + 1, z: 16 }),
    halfExtents: Object.freeze({ x: 1, y: 1, z: 1 }),
    rotation: IDENTITY_ROTATION,
  }),
  Object.freeze({
    id: 'basket',
    translation: Object.freeze({ x: SLOPE_END_X + 2, y: PARKING_TOP_Y + 0.75, z: 15.5 }),
    halfExtents: Object.freeze({ x: 0.75, y: 0.75, z: 0.75 }),
    rotation: IDENTITY_ROTATION,
  }),
  Object.freeze({
    id: 'crate',
    translation: Object.freeze({ x: SLOPE_END_X + 3.5, y: PARKING_TOP_Y + 0.75, z: 15.5 }),
    halfExtents: Object.freeze({ x: 0.75, y: 0.75, z: 0.75 }),
    rotation: IDENTITY_ROTATION,
  }),
  Object.freeze({
    id: 'cargo-slot',
    translation: Object.freeze({ x: SLOPE_END_X + 3.5, y: PARKING_TOP_Y + 0.75, z: 13 }),
    halfExtents: Object.freeze({ x: 1, y: 0.75, z: 1 }),
    rotation: IDENTITY_ROTATION,
  }),
  Object.freeze({
    id: 'delivery',
    translation: Object.freeze({ x: 0, y: 0.75, z: -7 }),
    halfExtents: Object.freeze({ x: 1.5, y: 0.75, z: 1.5 }),
    rotation: IDENTITY_ROTATION,
  }),
] satisfies CourseSensorDefinition[])

const vehicleSpawn = Object.freeze({
  translation: Object.freeze({ x: 0, y: 0, z: -8 }),
  rotation: VEHICLE_FORWARD_Z_ROTATION,
})

const spawnPoses = Object.freeze({
  vehicle: vehicleSpawn,
  player: Object.freeze({
    translation: Object.freeze({ x: 1.2, y: 0.9, z: -8 }),
    rotation: IDENTITY_ROTATION,
  }),
})

const safePoints = Object.freeze([
  Object.freeze({ id: 'spawn', ...vehicleSpawn }),
  Object.freeze({
    id: 'before-slope',
    translation: Object.freeze({ x: 7.3, y: 0, z: 13 }),
    rotation: VEHICLE_FORWARD_X_ROTATION,
  }),
  Object.freeze({
    id: 'orchard-parking',
    translation: Object.freeze({ x: SLOPE_END_X + 2, y: PARKING_TOP_Y, z: 13 }),
    rotation: VEHICLE_FORWARD_X_ROTATION,
  }),
  Object.freeze({
    id: 'delivery',
    translation: Object.freeze({ x: 0, y: 0, z: -7 }),
    rotation: VEHICLE_FORWARD_Z_ROTATION,
  }),
] satisfies CourseSafePoint[])

export const COURSE_DEFINITION: CourseDefinition = Object.freeze({
  flatLengthM: FLAT_LENGTH_M,
  turnDegrees: TURN_DEGREES,
  jointHeightM: JOINT_HEIGHT_M,
  slopeDegrees: SLOPE_DEGREES,
  slopeLengthM: SLOPE_LENGTH_M,
  slopeRiseM: SLOPE_RISE_M,
  roadThicknessM: ROAD_THICKNESS_M,
  recoveryFloorY: RECOVERY_FLOOR_Y,
  surfaces,
  sensors,
  spawnPoses,
  safePoints,
})
