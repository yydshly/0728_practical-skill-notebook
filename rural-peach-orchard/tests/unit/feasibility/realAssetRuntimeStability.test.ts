import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import RAPIER from '@dimforge/rapier3d-compat'
import { Box3, Euler, Group, Quaternion, Scene, Vector3 } from 'three'
import {
  GLTFLoader,
  type GLTF,
} from 'three/addons/loaders/GLTFLoader.js'
import { describe, expect, it } from 'vitest'
import runtimeAssetContractJson from '../../../public/feasibility/runtime-assets.json'
import { createRuntimeOrientation } from '../../../src/feasibility/assets/RuntimeOrientation'
import { parseRuntimeAssetContract } from '../../../src/feasibility/assets/runtimeAssetContract'
import { createTestCourse } from '../../../src/feasibility/course/createTestCourse'
import { createOrchardCourse } from '../../../src/feasibility/course/createOrchardCourse'
import { PhysicsWorld } from '../../../src/feasibility/physics/PhysicsWorld'
import { readVehicleRig } from '../../../src/feasibility/runtime/readVehicleRig'
import { buildTricycleColliders } from '../../../src/feasibility/vehicle/buildTricycleColliders'
import { TricycleController } from '../../../src/feasibility/vehicle/TricycleController'
import { ScriptedInput } from '../../../src/feasibility/testing/ScriptedInput'
import { PlayerController } from '../../../src/feasibility/player/PlayerController'
import { createRuntimeControlAdapter } from '../../../src/feasibility/control/createRuntimeControlAdapter'
import type { ControlInputOwner } from '../../../src/feasibility/control/ControlAuthority'
import type { JobState, OwnerId } from '../../../src/feasibility/domain/types'
import { ControlAuthority } from '../../../src/feasibility/control/ControlAuthority'
import { ORCHARD_WORLD_DEFINITION } from '../../../src/feasibility/world/orchardWorldDefinition'

const contract = parseRuntimeAssetContract(runtimeAssetContractJson)
const orientation = createRuntimeOrientation(contract.vehicle)
const ZERO_INPUT = Object.freeze({ throttle: 0, brake: 0, steer: 0 })

async function loadRealGlb(path: string): Promise<GLTF> {
  const bytes = await readFile(resolve(path))
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
  return new Promise((resolveGltf, reject) => {
    new GLTFLoader().parse(buffer, '', resolveGltf, reject)
  })
}

function rollDegrees(rotation: RAPIER.Rotation): number {
  return Math.abs(new Euler().setFromQuaternion(new Quaternion(
    rotation.x,
    rotation.y,
    rotation.z,
    rotation.w,
  ), 'YXZ').z * 180 / Math.PI)
}

describe('real GLB runtime physics composition', () => {
  it('binds each committed wheel mesh set beneath its semantic pivot on a local +X axle', async () => {
    const visual = await loadRealGlb(
      'public/assets/vehicle/electric-tricycle-a/visual.glb',
    )
    const anchors = new Map<string, typeof visual.scene>()
    visual.scene.traverse((object) => {
      if (object.name) anchors.set(object.name, object as typeof visual.scene)
    })
    visual.scene.updateMatrixWorld(true)
    const wheelMeshes = [
      ['front', 'wheel_front_tire_sidewall'],
      ['rearLeft', 'wheel_rear_left_tire_sidewall'],
      ['rearRight', 'wheel_rear_right_tire_sidewall'],
    ] as const
    const worldPositions = wheelMeshes.map(([, meshName]) => {
      const mesh = visual.scene.getObjectByName(meshName)
      if (!mesh) throw new Error(`missing committed wheel mesh ${meshName}`)
      return mesh.getWorldPosition(new Vector3())
    })

    const rig = readVehicleRig({ scene: visual.scene, anchors, clips: [] }, contract.vehicle)

    for (const [index, [wheelId, meshName]] of wheelMeshes.entries()) {
      const pivot = rig.wheelVisuals[wheelId]
      const mesh = visual.scene.getObjectByName(meshName)
      if (!mesh) throw new Error(`missing committed wheel mesh ${meshName}`)
      expect(pivot.getObjectByName(meshName)).toBe(mesh)
      expect(mesh.getWorldPosition(new Vector3()).distanceTo(worldPositions[index]!))
        .toBeLessThan(1e-6)
      const size = new Box3().setFromObject(pivot).getSize(new Vector3())
      expect(size.x).toBeLessThan(0.2)
      expect(size.y).toBeGreaterThan(0.55)
      expect(size.z).toBeGreaterThan(0.55)
    }
  })

  it('keeps the registered 420 kg vehicle upright for 180 neutral steps', async () => {
    const [visual, collision] = await Promise.all([
      loadRealGlb('public/assets/vehicle/electric-tricycle-a/visual.glb'),
      loadRealGlb('public/assets/vehicle/electric-tricycle-a/collision.glb'),
    ])
    expect(visual.scene.position.toArray()).toEqual([0, 0, 0])
    expect(visual.scene.scale.toArray()).toEqual([1, 1, 1])
    expect(collision.scene.position.toArray()).toEqual([0, 0, 0])
    expect(collision.scene.scale.toArray()).toEqual([1, 1, 1])

    const physics = await PhysicsWorld.create()
    const course = createOrchardCourse(
      new Scene(),
      physics,
      ORCHARD_WORLD_DEFINITION,
      false,
    )
    const spawn = course.spawnPoses.vehicle
    const body = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(spawn.translation.x, spawn.translation.y, spawn.translation.z)
        .setRotation({
          x: 0,
          y: Math.sin(spawn.yawRadians / 2),
          z: 0,
          w: Math.cos(spawn.yawRadians / 2),
        })
        .setCcdEnabled(true),
    )
    buildTricycleColliders(
      physics.world,
      body,
      collision.scene,
      contract.vehicle,
    )
    const anchors = new Map<string, typeof visual.scene>()
    visual.scene.traverse((object) => {
      if (object.name) anchors.set(object.name, object as typeof visual.scene)
    })
    const rig = readVehicleRig({ scene: visual.scene, anchors, clips: [] }, contract.vehicle)
    expect(rig.wheelAnchors.map(({ id, position, radiusM }) => ({
      id, position, radiusM,
    }))).toEqual([
      { id: 'front', position: { x: 0, y: expect.closeTo(0.29), z: expect.closeTo(-1.1) }, radiusM: 0.29 },
      { id: 'rear-left', position: { x: expect.closeTo(0.47), y: expect.closeTo(0.275), z: expect.closeTo(0.9) }, radiusM: 0.275 },
      { id: 'rear-right', position: { x: expect.closeTo(-0.47), y: expect.closeTo(0.275), z: expect.closeTo(0.9) }, radiusM: 0.275 },
    ])

    const controller = new TricycleController({
      physics,
      body,
      contract: contract.vehicle,
      orientation,
      wheelAnchors: rig.wheelAnchors,
      cargoAnchorLocal: rig.cargoAnchorLocal,
    })
    controller.setCargoMass(0)
    const inertia = body.principalInertia()
    let maximumRollDegrees = 0
    let lastTelemetry = controller.update(ZERO_INPUT)
    for (let step = 0; step < 180; step += 1) {
      lastTelemetry = controller.update(ZERO_INPUT)
      physics.step()
      maximumRollDegrees = Math.max(maximumRollDegrees, rollDegrees(body.rotation()))
    }
    expect(body.mass()).toBeCloseTo(420, 3)
    expect(inertia.x).toBeGreaterThan(50)
    expect(inertia.y).toBeGreaterThan(50)
    expect(inertia.z).toBeGreaterThan(20)
    expect(maximumRollDegrees).toBeLessThanOrEqual(15)
    expect(lastTelemetry.wheels).toHaveLength(3)
    expect(lastTelemetry.wheels.every((wheel) => wheel.grounded)).toBe(true)
  })

  it('drives the public scripted input route to the orchard and back without recovery', async () => {
    const [visual, collision] = await Promise.all([
      loadRealGlb('public/assets/vehicle/electric-tricycle-a/visual.glb'),
      loadRealGlb('public/assets/vehicle/electric-tricycle-a/collision.glb'),
    ])
    const anchors = new Map<string, typeof visual.scene>()
    visual.scene.traverse((object) => {
      if (object.name) anchors.set(object.name, object as typeof visual.scene)
    })
    const rig = readVehicleRig({ scene: visual.scene, anchors, clips: [] }, contract.vehicle)
    const physics = await PhysicsWorld.create()
    const course = createOrchardCourse(
      new Scene(),
      physics,
      ORCHARD_WORLD_DEFINITION,
      false,
    )
    const spawn = course.spawnPoses.vehicle
    const body = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(spawn.translation.x, spawn.translation.y, spawn.translation.z)
        .setRotation({
          x: 0,
          y: Math.sin(spawn.yawRadians / 2),
          z: 0,
          w: Math.cos(spawn.yawRadians / 2),
        })
        .setCcdEnabled(true),
    )
    buildTricycleColliders(physics.world, body, collision.scene, contract.vehicle)
    const controller = new TricycleController({
      physics,
      body,
      contract: contract.vehicle,
      orientation,
      wheelAnchors: rig.wheelAnchors,
      cargoAnchorLocal: rig.cargoAnchorLocal,
    })
    controller.setCargoMass(0)
    let telemetry = controller.update({ throttle: 0, brake: 1, steer: 0 })
    for (let step = 0; step < 180; step += 1) {
      telemetry = controller.update({ throttle: 0, brake: 1, steer: 0 })
      physics.step()
    }
    let parked = false
    let delivered = false
    let jobState: JobState = 'accepted'
    let fruitOwner: OwnerId = 'tree'
    let controlOwner: ControlInputOwner = 'player'
    let recoveryTriggers = 0
    let triggerActive = false
    let firstTrigger: unknown = null
    let maximumRoll = 0
    const input = new ScriptedInput({
      readState: () => ({
        controlOwner,
        jobState,
        fruitOwner,
        vehicleSpeedMps: telemetry.speedMps,
        groundedWheelCount: telemetry.wheels.filter((wheel) => wheel.grounded).length,
        vehiclePosition: { ...body.translation() },
        vehicleRotation: { ...body.rotation() },
        playerPosition: { x: 0, y: 0, z: 0 },
        targets: {
          seat: { x: 0, y: 0, z: 0 },
          parking: { ...course.parkingSensor.collider.translation() },
          tree: { ...course.harvestSensors.treeInventory.collider.translation() },
          basket: { ...course.harvestSensors.basket.collider.translation() },
          crate: { ...course.harvestSensors.crate.collider.translation() },
          cargo: { ...course.harvestSensors.cargoSlot.collider.translation() },
          delivery: { ...course.deliverySensor.collider.translation() },
          outboundWaypoints: ORCHARD_WORLD_DEFINITION.route.outbound,
          returnWaypoints: ORCHARD_WORLD_DEFINITION.route.returning,
        },
      }),
      drive: (vehicleInput) => { telemetry = controller.update(vehicleInput) },
      movePlayer: () => undefined,
      interact: () => {
        if (jobState === 'en-route-to-orchard') {
          parked = true
          jobState = 'parked-at-orchard'
        } else if (jobState === 'returning') {
          jobState = 'delivered'
          fruitOwner = 'delivered'
        }
      },
      recover: () => { throw new Error('scripted route may not recover') },
      resetCompleteLoop: () => undefined,
      completeLoop: () => { delivered = true },
    })
    input.start()
    input.fixedStep(1 / 60)
    jobState = 'preparing'
    input.fixedStep(1 / 60)
    jobState = 'en-route-to-orchard'
    controlOwner = 'vehicle'
    for (let step = 0; step < 3_600 && !parked; step += 1) {
      input.fixedStep(1 / 60)
      physics.step()
      const roll = rollDegrees(body.rotation())
      maximumRoll = Math.max(maximumRoll, roll)
      const triggered = body.translation().y
          < ORCHARD_WORLD_DEFINITION.gameplayPlaneY - 0.2
        || roll > 70
      if (triggered && !triggerActive) {
        recoveryTriggers += 1
        firstTrigger = { step, pose: { ...body.translation() }, roll, telemetry }
      }
      triggerActive = triggered
    }
    controlOwner = 'player'
    input.fixedStep(1 / 60)
    const harvestSequence: ReadonlyArray<readonly [JobState, OwnerId]> = [
      ['picking', 'player'],
      ['picking', 'basket'],
      ['picking', 'crate'],
      ['vehicle-loaded', 'vehicle'],
    ]
    for (const [nextState, nextOwner] of harvestSequence) {
      jobState = nextState
      fruitOwner = nextOwner
      input.fixedStep(1 / 60)
      physics.step()
    }
    jobState = 'returning'
    fruitOwner = 'vehicle'
    controlOwner = 'vehicle'
    controller.setCargoMass(20)
    for (let step = 0; step < 3_600 && !delivered; step += 1) {
      input.fixedStep(1 / 60)
      physics.step()
      const roll = rollDegrees(body.rotation())
      maximumRoll = Math.max(maximumRoll, roll)
      const triggered = body.translation().y
          < ORCHARD_WORLD_DEFINITION.gameplayPlaneY - 0.2
        || roll > 70
      if (triggered && !triggerActive) {
        recoveryTriggers += 1
        firstTrigger = { step, pose: { ...body.translation() }, roll, telemetry }
      }
      triggerActive = triggered
    }

    const delivery = course.deliverySensor.collider.translation()
    const position = body.translation()
    const diagnostic = {
      recoveryTriggers,
      maximumRoll,
      parked,
      delivered,
      x: position.x,
      z: position.z,
      firstTrigger,
    }
    expect(diagnostic, JSON.stringify(diagnostic))
      .toMatchObject({ recoveryTriggers: 0, parked: true, delivered: true })
    expect(maximumRoll).toBeLessThanOrEqual(22)
    expect(Math.hypot(position.x - delivery.x, position.z - delivery.z))
      .toBeLessThanOrEqual(0.6)
  })

  it('places the real character capsule outside the real vehicle and parking floor on exit', async () => {
    const [visual, collision] = await Promise.all([
      loadRealGlb('public/assets/vehicle/electric-tricycle-a/visual.glb'),
      loadRealGlb('public/assets/vehicle/electric-tricycle-a/collision.glb'),
    ])
    const anchors = new Map<string, typeof visual.scene>()
    visual.scene.traverse((object) => {
      if (object.name) anchors.set(object.name, object as typeof visual.scene)
    })
    const rig = readVehicleRig({ scene: visual.scene, anchors, clips: [] }, contract.vehicle)
    const physics = await PhysicsWorld.create()
    const scene = new Scene()
    const course = createTestCourse(scene, physics, false)
    const parking = course.safePoints.find((point) => point.id === 'orchard-parking')!
    const body = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(parking.translation.x, parking.translation.y, parking.translation.z)
        .setRotation(parking.rotation),
    )
    buildTricycleColliders(physics.world, body, collision.scene, contract.vehicle)
    visual.scene.position.set(
      parking.translation.x,
      parking.translation.y,
      parking.translation.z,
    )
    visual.scene.quaternion.set(
      parking.rotation.x,
      parking.rotation.y,
      parking.rotation.z,
      parking.rotation.w,
    )
    scene.add(visual.scene)
    const player = new PlayerController({
      physics,
      contract: contract.character,
      initialTranslation: { x: 0, y: 0.9, z: -8 },
    })
    const character = new Group()
    scene.add(character)
    physics.step()
    const adapter = createRuntimeControlAdapter({
      physics,
      scene,
      player,
      playerVisual: character,
      seatAnchor: rig.seatAnchor,
      exitAnchor: rig.exitAnchor,
      characterContract: contract.character,
    })
    const authority = new ControlAuthority(adapter)
    expect(authority.requestEnter({ vehicleSpeedMps: 0, seatDistanceM: 0.5 }).ok)
      .toBe(true)
    expect(authority.completeTransition('enter-started').ok).toBe(true)
    expect(authority.completeTransition('seated').ok).toBe(true)

    expect(adapter.exitIsBlocked()).toBe(false)
    expect(authority.requestExit().ok).toBe(true)
    expect(authority.completeTransition('exit-started').ok).toBe(true)
    expect(authority.completeTransition('exit-placed').ok).toBe(true)
    expect(authority.completeTransition('exit-complete').ok).toBe(true)
    expect(player.collider.isEnabled()).toBe(true)
  })
})
