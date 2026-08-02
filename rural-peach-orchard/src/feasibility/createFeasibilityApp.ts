import RAPIER, { type RigidBody } from '@dimforge/rapier3d-compat'
import {
  Euler,
  Matrix4,
  PerspectiveCamera,
  Quaternion,
  Scene,
  Vector3,
  WebGLRenderer,
  type Object3D,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import {
  createSliceAssetLoader,
  type SliceAssetManifest,
  type SliceAssets,
} from './assets/SliceAssetLoader'
import {
  loadRuntimeAssetContract,
  type RuntimeAssetContract,
} from './assets/runtimeAssetContract'
import { createRuntimeOrientation } from './assets/RuntimeOrientation'
import {
  FollowCameraController,
} from './camera/FollowCameraController'
import {
  CameraTargetTransition,
  type CameraTargetOwner,
} from './camera/CameraTarget'
import {
  ORCHARD_CAMERA_MAX_DISPLACEMENT_PER_FRAME_M,
  ORCHARD_CAMERA_PROFILES,
  ORCHARD_CAMERA_TARGET_TRANSITION_SECONDS,
} from './camera/orchardCameraProfiles'
import { ControlAuthority } from './control/ControlAuthority'
import { createRuntimeControlAdapter } from './control/createRuntimeControlAdapter'
import { DeterministicControlTransitionSequencer } from './control/DeterministicControlTransitionSequencer'
import {
  createOrchardCourse,
  type OrchardCourse,
} from './course/createOrchardCourse'
import type { FeasibilityShell } from './createFeasibilityShell'
import { DebugPanel } from './debug/DebugPanel'
import { HarvestDomain } from './domain/HarvestDomain'
import type { DomainResult, HarvestCommand } from './domain/types'
import {
  KeyboardInputRouter,
  ZERO_VEHICLE_INPUT,
} from './input/KeyboardInputRouter'
import type { ActionPulse } from './input/RuntimeCommand'
import {
  ContextualActionResolver,
  type ContextualActionContext,
} from './interaction/ContextualActionResolver'
import {
  InteractionCoordinator,
  type SpatialCandidate,
} from './interaction/InteractionCoordinator'
import { performOnFootContextualAction } from './interaction/performOnFootContextualAction'
import { FixedStepRunner } from './physics/FixedStepRunner'
import { PhysicsWorld } from './physics/PhysicsWorld'
import { PlayerController } from './player/PlayerController'
import { OrchardHudPresenter } from './presentation/OrchardHudPresenter'
import { RecoveryManager } from './recovery/RecoveryManager'
import { createCourseRecoveryObservation } from './recovery/createCourseRecoveryObservation'
import {
  BodyPoseInterpolator,
  type InterpolatedBodyPose,
} from './runtime/BodyPoseInterpolator'
import { FixedStepRuntimeLoop } from './runtime/FixedStepRuntimeLoop'
import { initializeFeasibilityRuntime } from './runtime/initializeFeasibilityRuntime'
import { readVehicleRig } from './runtime/readVehicleRig'
import {
  ScriptedInput,
  type ScriptedStage,
} from './testing/ScriptedInput'
import { buildTricycleColliders } from './vehicle/buildTricycleColliders'
import {
  TricycleController,
  type VehicleInput,
} from './vehicle/TricycleController'
import { TricycleVisualController } from './vehicle/TricycleVisualController'
import {
  createBatchedTricycleVisual,
  type BatchedTricycleVisual,
} from './vehicle/createBatchedTricycleVisual'
import type { VehicleTelemetrySample } from './vehicle/VehicleTelemetry'
import {
  createOrchardLighting,
} from './world/createOrchardLighting'
import {
  createOrchardWorldVisual,
  type OrchardWorldVisual,
} from './world/createOrchardWorldVisual'
import { ORCHARD_WORLD_DEFINITION } from './world/orchardWorldDefinition'
import type { WorldPose } from './world/orchardWorldDefinition'

const FIXED_SECONDS = 1 / 60
const MAX_FRAME_SECONDS = 0.1
const VEHICLE_VISUAL_ID = 'vehicle.electric-tricycle-a'
const CHARACTER_VISUAL_ID = 'character.farmer-a-base'
const ASSET_MANIFEST_URL = '/assets/asset-manifest.json'
const EMPTY_VEHICLE_TELEMETRY: VehicleTelemetrySample = Object.freeze({
  speedMps: 0,
  forwardSpeedMps: 0,
  steerAngleRad: 0,
  wheels: Object.freeze([]),
})
export interface FeasibilityApp {
  stop(): void
}

interface ActorSourceState {
  readonly object: Object3D
  readonly parent: Object3D | null
  readonly childIndex: number
  readonly name: string
  readonly position: Vector3
  readonly quaternion: Quaternion
  readonly scale: Vector3
  readonly matrix: Matrix4
  readonly matrixAutoUpdate: boolean
}

function captureActorSource(object: Object3D): ActorSourceState {
  return {
    object,
    parent: object.parent,
    childIndex: object.parent?.children.indexOf(object) ?? -1,
    name: object.name,
    position: object.position.clone(),
    quaternion: object.quaternion.clone(),
    scale: object.scale.clone(),
    matrix: object.matrix.clone(),
    matrixAutoUpdate: object.matrixAutoUpdate,
  }
}

function restoreActorSources(states: readonly ActorSourceState[]): void {
  for (const state of states) {
    const { object, parent } = state
    if (parent) {
      if (object.parent !== parent) parent.add(object)
      const currentIndex = parent.children.indexOf(object)
      parent.children.splice(currentIndex, 1)
      parent.children.splice(
        Math.min(Math.max(state.childIndex, 0), parent.children.length),
        0,
        object,
      )
    } else {
      object.removeFromParent()
    }
    object.name = state.name
    object.position.copy(state.position)
    object.quaternion.copy(state.quaternion)
    object.scale.copy(state.scale)
    object.matrix.copy(state.matrix)
    object.matrixAutoUpdate = state.matrixAutoUpdate
    object.updateMatrixWorld(true)
  }
}

export type ActorAssemblyFailurePoint =
  | 'after-listeners'
  | 'after-colliders'
  | 'after-scene-attach'
  | 'before-loop-start'

export interface SliceRuntimeDependencies {
  readonly shell: FeasibilityShell
  readonly contract: RuntimeAssetContract
  readonly physics: PhysicsWorld
  readonly renderer: WebGLRenderer
  readonly scene: Scene
  readonly course: OrchardCourse
  readonly assets: SliceAssets
  readonly worldVisual: OrchardWorldVisual
  readonly batchedVehicle: Pick<BatchedTricycleVisual, 'drawBatchCount'>
  readonly debugEnabled: boolean
  readonly fixtureMode: boolean
  readonly fixtureErrorMode: boolean
  readonly afterActorAssemblyStep?: (step: ActorAssemblyFailurePoint) => void
}

interface RuntimeAngles {
  readonly rollDegrees: number
  readonly pitchDegrees: number
}

interface LoopEvidence {
  readonly loop: number
  readonly completedStages: readonly ScriptedStage[]
  readonly endPose: InterpolatedBodyPose
  readonly maximumRollDegrees: number
  readonly maximumPitchDegrees: number
  readonly backslideDistanceM: number
  readonly recoveryCount: number
  readonly ownershipViolations: number
  readonly physicsStepTimingsMs: readonly number[]
}

async function loadAssetManifest(url: string): Promise<SliceAssetManifest> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to load asset manifest ${url}: HTTP ${response.status}`)
  }
  const manifest: unknown = await response.json()
  if (
    typeof manifest !== 'object'
    || manifest === null
    || !Array.isArray((manifest as { assets?: unknown }).assets)
  ) {
    throw new Error(`Invalid asset manifest ${url}`)
  }
  return manifest as SliceAssetManifest
}

async function loadSliceAssets(
  contract: RuntimeAssetContract,
): Promise<SliceAssets> {
  const manifest = await loadAssetManifest(ASSET_MANIFEST_URL)
  return createSliceAssetLoader({
    gltfLoader: new GLTFLoader(),
  }).load(contract, manifest)
}

function createVehicleBody(
  physics: PhysicsWorld,
  course: OrchardCourse,
): RigidBody {
  const pose = course.spawnPoses.vehicle
  return physics.world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(
        pose.translation.x,
        pose.translation.y,
        pose.translation.z,
      )
      .setRotation(yawQuaternion(pose.yawRadians))
      .setCcdEnabled(true),
  )
}

function yawQuaternion(yawRadians: number): Readonly<{
  x: number
  y: number
  z: number
  w: number
}> {
  return {
    x: 0,
    y: Math.sin(yawRadians / 2),
    z: 0,
    w: Math.cos(yawRadians / 2),
  }
}

function runtimePose(pose: WorldPose): InterpolatedBodyPose {
  return {
    translation: pose.translation,
    rotation: yawQuaternion(pose.yawRadians),
  }
}

function playerBodyTranslation(
  anchor: Readonly<{ x: number; y: number; z: number }>,
  character: RuntimeAssetContract['character'],
): Readonly<{ x: number; y: number; z: number }> {
  return {
    x: anchor.x,
    y: anchor.y + character.capsuleHalfHeightM + character.capsuleRadiusM,
    z: anchor.z,
  }
}

function bodyAngles(body: RigidBody): RuntimeAngles {
  const rotation = body.rotation()
  const euler = new Euler().setFromQuaternion(new Quaternion(
    rotation.x,
    rotation.y,
    rotation.z,
    rotation.w,
  ), 'YXZ')
  return {
    rollDegrees: euler.z * 180 / Math.PI,
    pitchDegrees: euler.x * 180 / Math.PI,
  }
}

function percentile95(samples: readonly number[]): number {
  if (samples.length === 0) return 0
  const sorted = [...samples].sort((left, right) => left - right)
  const index = Math.ceil(sorted.length * 0.95) - 1
  return sorted[Math.max(0, index)] ?? 0
}

function readBodyPose(body: RigidBody): InterpolatedBodyPose {
  return {
    translation: body.translation(),
    rotation: body.rotation(),
  }
}

function distanceBetween(
  left: Readonly<{ x: number; y: number; z: number }>,
  right: Readonly<{ x: number; y: number; z: number }>,
): number {
  return Math.hypot(
    left.x - right.x,
    left.y - right.y,
    left.z - right.z,
  )
}

export function composeSliceRuntime(
  dependencies: SliceRuntimeDependencies,
): FeasibilityApp & { start(): void } {
  const {
    shell,
    contract,
    physics,
    renderer,
    scene,
    course,
    assets,
    worldVisual,
    batchedVehicle,
    debugEnabled,
    fixtureMode,
    fixtureErrorMode,
    afterActorAssemblyStep = () => undefined,
  } = dependencies
  const actorSourceStates = [
    captureActorSource(assets.vehicleVisual.scene),
    captureActorSource(assets.characterVisual.scene),
  ]
  const cleanupSteps: Array<() => void> = []
  let cleaned = false
  const registerCleanup = (cleanup: () => void): void => {
    cleanupSteps.push(cleanup)
  }
  const cleanupActorRuntime = (): unknown => {
    if (cleaned) return undefined
    cleaned = true
    let firstError: unknown
    for (const cleanup of cleanupSteps.reverse()) {
      try {
        cleanup()
      } catch (error) {
        firstError ??= error
      }
    }
    return firstError
  }

  try {
  const runtimeErrors: string[] = []
  const recordRuntimeError = (value: unknown): void => {
    const message = value instanceof Error
      ? value.message
      : typeof value === 'string'
        ? value
        : String(value)
    if (!runtimeErrors.includes(message)) runtimeErrors.push(message)
  }
  const onRuntimeError = (event: ErrorEvent): void => {
    recordRuntimeError(event.error ?? event.message)
  }
  const onUnhandledRejection = (event: PromiseRejectionEvent): void => {
    recordRuntimeError(event.reason)
  }
  if (fixtureMode) {
    window.addEventListener('error', onRuntimeError)
    registerCleanup(() => window.removeEventListener('error', onRuntimeError))
    window.addEventListener('unhandledrejection', onUnhandledRejection)
    registerCleanup(() => (
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
    ))
  }
  afterActorAssemblyStep('after-listeners')
  const rig = readVehicleRig(assets.vehicleVisual, contract.vehicle)
  const orientation = createRuntimeOrientation(contract.vehicle)
  const vehicleBody = createVehicleBody(physics, course)
  registerCleanup(() => physics.removeRigidBody(vehicleBody))
  const builtVehicleColliders = buildTricycleColliders(
    physics.world,
    vehicleBody,
    assets.vehicleCollision.scene,
    contract.vehicle,
  )
  afterActorAssemblyStep('after-colliders')
  const vehicle = new TricycleController({
    physics,
    body: vehicleBody,
    contract: contract.vehicle,
    orientation,
    wheelAnchors: rig.wheelAnchors,
    cargoAnchorLocal: rig.cargoAnchorLocal,
  })
  const vehicleVisuals = new TricycleVisualController({
    wheels: rig.wheelVisuals,
  })
  vehicle.setCargoMass(0)

  const player = new PlayerController({
    physics,
    contract: contract.character,
    initialTranslation: playerBodyTranslation(
      course.spawnPoses.player.translation,
      contract.character,
    ),
  })
  registerCleanup(() => player.dispose())
  registerCleanup(() => restoreActorSources(actorSourceStates))
  assets.vehicleVisual.scene.name = VEHICLE_VISUAL_ID
  assets.characterVisual.scene.name = CHARACTER_VISUAL_ID
  scene.add(assets.vehicleVisual.scene, assets.characterVisual.scene)
  const vehiclePose = new BodyPoseInterpolator(readBodyPose(vehicleBody))
  const playerPose = new BodyPoseInterpolator(readBodyPose(player.body))
  vehiclePose.applyTo(assets.vehicleVisual.scene, 1)
  playerPose.applyTo(assets.characterVisual.scene, 1)
  assets.characterVisual.scene.translateY(-(
    contract.character.capsuleHalfHeightM
    + contract.character.capsuleRadiusM
  ))
  afterActorAssemblyStep('after-scene-attach')

  const authorityAdapter = createRuntimeControlAdapter({
    physics,
    scene,
    player,
    playerVisual: assets.characterVisual.scene,
    seatAnchor: rig.seatAnchor,
    exitAnchor: rig.exitAnchor,
    characterContract: contract.character,
    isExitSupportCollider: (collider) => course.floorColliders.some(
      ({ collider: surfaceCollider }) => surfaceCollider.handle === collider.handle,
    ),
  })
  const createAuthority = () => new ControlAuthority(authorityAdapter)
  const createDomain = () => HarvestDomain.create({
    fruitIds: ['fruit-1'],
    capacities: { player: 1, basket: 1, crate: 1, vehicle: 1, delivered: 1 },
  })
  let authority = createAuthority()
  const transitionSequencer = new DeterministicControlTransitionSequencer({
    getState: () => authority.state,
    completeTransition: (event) => authority.completeTransition(event),
  })
  let domain = createDomain()
  let lastDomainTransition = 'none'
  const dispatchDomain = (command: HarvestCommand): DomainResult => {
    const result = domain.dispatch(command)
    lastDomainTransition = `${command.kind}:${result.code}`
    return result
  }

  const candidateDefinitions = new Map([
    ['tree-sensor', {
      kind: 'tree' as const,
      collider: course.harvestSensors.treeInventory.collider,
    }],
    ['basket-sensor', {
      kind: 'basket' as const,
      collider: course.harvestSensors.basket.collider,
    }],
    ['crate-sensor', {
      kind: 'crate' as const,
      collider: course.harvestSensors.crate.collider,
    }],
    ['cargo-sensor', {
      kind: 'cargo' as const,
      collider: course.harvestSensors.cargoSlot.collider,
    }],
    ['delivery-sensor', {
      kind: 'delivery' as const,
      collider: course.deliverySensor.collider,
    }],
  ])
  const getCandidate = (id: string): SpatialCandidate | undefined => {
    const definition = candidateDefinitions.get(id)
    if (!definition) return undefined
    const distanceM = distanceBetween(
      player.body.translation(),
      definition.collider.translation(),
    )
    return {
      id,
      kind: definition.kind,
      inside: distanceM <= 1.2,
      distanceM,
      facingDegrees: 0,
    }
  }
  const createCoordinator = () => new InteractionCoordinator({
      domain,
      getControlOwner: () => authority.inputOwner,
      getCandidate,
      setCargoMass: (cargoKg) => vehicle.setCargoMass(cargoKg),
    })
  let coordinator = createCoordinator()
  const executeInteraction = (
    candidateId: string,
    command: HarvestCommand,
  ) => {
    const result = coordinator.execute(candidateId, command)
    if (!result) return undefined
    lastDomainTransition = `${command.kind}:${result.code}`
    return result
  }

  const createRecovery = () => {
    const manager = new RecoveryManager({
      getDomainSnapshot: () => domain.snapshot(),
      setBodyPose: (pose) => {
        vehicleBody.setTranslation(pose.translation, true)
        vehicleBody.setRotation(pose.rotation, true)
        vehiclePose.snap(pose)
      },
      zeroBodyVelocity: () => {
        vehicleBody.setLinvel({ x: 0, y: 0, z: 0 }, true)
        vehicleBody.setAngvel({ x: 0, y: 0, z: 0 }, true)
        vehicleBody.resetForces(true)
        vehicleBody.resetTorques(true)
      },
    })
    manager.recordSafePoint('vehicle-spawn-safe-point', runtimePose(
      course.spawnPoses.vehicle,
    ))
    return manager
  }
  let recovery = createRecovery()

  let vehicleTelemetry = EMPTY_VEHICLE_TELEMETRY
  const seatDistanceM = (): number => {
    rig.seatAnchor.updateWorldMatrix(true, false)
    return distanceBetween(
      player.body.translation(),
      rig.seatAnchor.getWorldPosition(new Vector3()),
    )
  }
  const contextualActions = new ContextualActionResolver({
    'accept-job': () => dispatchDomain({
      kind: 'AcceptJob',
      commandId: 'accept',
    }).ok,
    'enter-vehicle': () => {
      const entered = authority.requestEnter({
        vehicleSpeedMps: vehicleTelemetry.speedMps,
        seatDistanceM: seatDistanceM(),
      })
      const currentState = domain.snapshot().jobState
      if (entered.ok && currentState === 'preparing') {
        dispatchDomain({
          kind: 'DepartForOrchard',
          commandId: 'depart',
        })
      } else if (entered.ok && currentState === 'vehicle-loaded') {
        dispatchDomain({ kind: 'StartReturn', commandId: 'return' })
      }
      return entered.ok
    },
    'park-and-exit': () => {
      const parked = dispatchDomain({
        kind: 'ParkAtOrchard',
        commandId: 'park',
      })
      return parked.ok && authority.requestExit().ok
    },
    'exit-vehicle': () => authority.requestExit().ok,
    pick: () => performOnFootContextualAction('pick', {
      executeInteraction,
    }),
    'place-in-basket': () => performOnFootContextualAction(
      'place-in-basket',
      { executeInteraction },
    ),
    'pack-crate': () => performOnFootContextualAction('pack-crate', {
      executeInteraction,
    }),
    'load-crate': () => performOnFootContextualAction('load-crate', {
      executeInteraction,
    }),
    deliver: () => performOnFootContextualAction('deliver', {
      executeInteraction,
    }),
  })
  const readContextualActionContext = (): ContextualActionContext => {
    const snapshot = domain.snapshot()
    const currentSeatDistanceM = seatDistanceM()
    return {
      controlOwner: authority.inputOwner,
      controlsLocked: authority.controlsLocked,
      jobState: snapshot.jobState,
      fruitOwner: snapshot.owners['fruit-1'] ?? 'tree',
      nearJobBoard: currentSeatDistanceM <= 1.2,
      nearVehicleSeat: currentSeatDistanceM <= 1.2,
      inOrchardParkingZone: distanceBetween(
        vehicleBody.translation(),
        course.parkingSensor.collider.translation(),
      ) <= 1.5,
      nearTree: getCandidate('tree-sensor')?.inside === true,
      nearBasket: getCandidate('basket-sensor')?.inside === true,
      nearCrate: getCandidate('crate-sensor')?.inside === true,
      nearCargo: getCandidate('cargo-sensor')?.inside === true,
      nearDelivery: getCandidate('delivery-sensor')?.inside === true,
    }
  }
  const resolveContextualAction = (): Readonly<{
    context: ContextualActionContext
    action: ReturnType<ContextualActionResolver['resolve']>
  }> => {
    const context = readContextualActionContext()
    return {
      context,
      action: contextualActions.resolve(context),
    }
  }
  const performInteraction = (): void => {
    const { action } = resolveContextualAction()
    if (action) contextualActions.execute(action)
  }

  const loopEvidence: LoopEvidence[] = []
  const allPhysicsStepSamplesMs: number[] = []
  let loopPhysicsStepSamplesMs: number[] = []
  let loopMaximumRollDegrees = 0
  let loopMaximumPitchDegrees = 0
  let loopBackslideDistanceM = 0
  let loopOwnershipViolations = 0
  let previousOutboundZ = vehicleBody.translation().z
  let scriptedInput: ScriptedInput | undefined
  const resetCompleteLoop = (): void => {
    if (domain.snapshot().jobState !== 'delivered') {
      throw new Error('FIXTURE_RESET_BEFORE_DELIVERY')
    }
    const vehicleSpawn = course.spawnPoses.vehicle
    vehicleBody.setTranslation(vehicleSpawn.translation, true)
    vehicleBody.setRotation(yawQuaternion(vehicleSpawn.yawRadians), true)
    vehicleBody.setLinvel({ x: 0, y: 0, z: 0 }, true)
    vehicleBody.setAngvel({ x: 0, y: 0, z: 0 }, true)
    vehicleBody.resetForces(true)
    vehicleBody.resetTorques(true)
    vehicle.setCargoMass(0)
    vehiclePose.snap(runtimePose(vehicleSpawn))
    vehiclePose.applyTo(assets.vehicleVisual.scene, 1)

    const playerSpawn = playerBodyTranslation(
      course.spawnPoses.player.translation,
      contract.character,
    )
    player.body.setTranslation(playerSpawn, true)
    player.body.setNextKinematicTranslation(playerSpawn)
    player.collider.setEnabled(true)
    scene.add(assets.characterVisual.scene)
    playerPose.snap({
      translation: playerSpawn,
      rotation: yawQuaternion(course.spawnPoses.player.yawRadians),
    })
    playerPose.applyTo(assets.characterVisual.scene, 1)
    assets.characterVisual.scene.translateY(-(
      contract.character.capsuleHalfHeightM
      + contract.character.capsuleRadiusM
    ))

    authority = createAuthority()
    domain = createDomain()
    coordinator = createCoordinator()
    recovery = createRecovery()
    vehicleTelemetry = EMPTY_VEHICLE_TELEMETRY
    lastDomainTransition = 'none'
    loopPhysicsStepSamplesMs = []
    loopMaximumRollDegrees = 0
    loopMaximumPitchDegrees = 0
    loopBackslideDistanceM = 0
    loopOwnershipViolations = 0
    previousOutboundZ = vehicleSpawn.translation.z
  }
  const inputDependencies = {
    getInputOwner: () => authority.inputOwner,
    controlsLocked: () => authority.controlsLocked,
    drive: (vehicleInput: VehicleInput) => {
      vehicleTelemetry = vehicle.update(
        authority.controlsLocked ? ZERO_VEHICLE_INPUT : vehicleInput,
      )
      vehicleVisuals.consume(vehicleTelemetry)
    },
    movePlayer: (intent: Readonly<{ x: number; y: number; z: number }>) => {
      if (!authority.controlsLocked) player.move(intent)
    },
    interact: performInteraction,
    recover: () => recovery.recoverPhysicsOnly(),
    emitActionPulse: (pulse: ActionPulse) => {
      if (pulse.kind === 'interact') performInteraction()
      else recovery.recoverPhysicsOnly()
    },
  }
  const keyboardInput = new KeyboardInputRouter({
    target: window,
    ...inputDependencies,
  })
  if (fixtureMode) {
    scriptedInput = new ScriptedInput({
      readState: () => {
        rig.seatAnchor.updateWorldMatrix(true, false)
        const seat = rig.seatAnchor.getWorldPosition(new Vector3())
        const snapshot = domain.snapshot()
        return {
          controlOwner: authority.inputOwner,
          jobState: snapshot.jobState,
          fruitOwner: snapshot.owners['fruit-1'] ?? 'tree',
          vehicleSpeedMps: vehicleTelemetry.speedMps,
          groundedWheelCount: vehicleTelemetry.wheels.filter(
            (wheel) => wheel.grounded,
          ).length,
          vehiclePosition: { ...vehicleBody.translation() },
          vehicleRotation: { ...vehicleBody.rotation() },
          playerPosition: { ...player.body.translation() },
          targets: {
            seat: { x: seat.x, y: seat.y, z: seat.z },
            parking: { ...course.parkingSensor.collider.translation() },
            tree: { ...course.harvestSensors.treeInventory.collider.translation() },
            basket: { ...course.harvestSensors.basket.collider.translation() },
            crate: { ...course.harvestSensors.crate.collider.translation() },
            cargo: { ...course.harvestSensors.cargoSlot.collider.translation() },
            delivery: { ...course.deliverySensor.collider.translation() },
            outboundWaypoints: ORCHARD_WORLD_DEFINITION.route.outbound,
            returnWaypoints: ORCHARD_WORLD_DEFINITION.route.returning,
          },
        }
      },
      ...inputDependencies,
      resetCompleteLoop,
      completeLoop: (completedStages) => {
        loopEvidence.push(Object.freeze({
          loop: loopEvidence.length + 1,
          completedStages: Object.freeze([...completedStages]),
          endPose: readBodyPose(vehicleBody),
          maximumRollDegrees: loopMaximumRollDegrees,
          maximumPitchDegrees: loopMaximumPitchDegrees,
          backslideDistanceM: loopBackslideDistanceM,
          recoveryCount: recovery.recoveryCount,
          ownershipViolations: loopOwnershipViolations,
          physicsStepTimingsMs: Object.freeze([...loopPhysicsStepSamplesMs]),
        }))
        shell.status.textContent = `Fixture loop ${loopEvidence.length}/10 delivered`
        if (loopEvidence.length === 10) {
          const marker = document.createElement('span')
          marker.dataset.testid = 'fixture-complete'
          marker.textContent = 'Full-loop fixture complete'
          marker.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)'
          shell.status.after(marker)
        }
      },
    })
  }
  const input = scriptedInput ?? keyboardInput

  const camera = new PerspectiveCamera(55, 1, 0.1, 250)
  const readWorldTarget = (
    owner: CameraTargetOwner,
    target: CameraTargetTransition['target'],
  ): void => {
    const visual = owner === 'vehicle'
      ? assets.vehicleVisual.scene
      : assets.characterVisual.scene
    visual.getWorldPosition(target.position)
    visual.getWorldQuaternion(target.heading)
  }
  let setCameraProfile: (owner: CameraTargetOwner) => void = () => undefined
  const cameraTargetTransition = new CameraTargetTransition({
    initialOwner: authority.inputOwner,
    transitionSeconds: ORCHARD_CAMERA_TARGET_TRANSITION_SECONDS,
    readTarget: readWorldTarget,
    onOwnerChanged: (owner) => setCameraProfile(owner),
  })
  const followCamera = new FollowCameraController({
    camera,
    readTarget: () => cameraTargetTransition.target,
    ...ORCHARD_CAMERA_PROFILES.player,
    maxDisplacementPerFrameM:
      ORCHARD_CAMERA_MAX_DISPLACEMENT_PER_FRAME_M,
  })
  setCameraProfile = (owner) => {
    followCamera.setProfile(ORCHARD_CAMERA_PROFILES[owner])
  }
  const updateCamera = (frameSeconds: number): void => {
    if (!cameraTargetTransition.update(authority.inputOwner, frameSeconds)) return
    followCamera.update(frameSeconds)
  }
  const debugPanel = new DebugPanel(shell.debugPanel)
  const hud = new OrchardHudPresenter(shell)
  const physicsStepSamplesMs: number[] = []
  const simulate = (): void => {
    if (domain.snapshot().jobState === 'accepted') {
      dispatchDomain({ kind: 'PrepareVehicle', commandId: 'prepare' })
    }
    transitionSequencer.fixedStep()
    vehiclePose.beginFixedStep()
    playerPose.beginFixedStep()
    const startedAt = performance.now()
    physics.step()
    vehiclePose.capture(readBodyPose(vehicleBody))
    playerPose.capture(readBodyPose(player.body))
    const physicsStepMs = performance.now() - startedAt
    physicsStepSamplesMs.push(physicsStepMs)
    allPhysicsStepSamplesMs.push(physicsStepMs)
    loopPhysicsStepSamplesMs.push(physicsStepMs)
    if (physicsStepSamplesMs.length > 240) physicsStepSamplesMs.shift()

    const angles = bodyAngles(vehicleBody)
    loopMaximumRollDegrees = Math.max(
      loopMaximumRollDegrees,
      Math.abs(angles.rollDegrees),
    )
    loopMaximumPitchDegrees = Math.max(
      loopMaximumPitchDegrees,
      Math.abs(angles.pitchDegrees),
    )
    const domainSnapshot = domain.snapshot()
    const owner = domainSnapshot.owners['fruit-1']
    if (!owner || Object.keys(domainSnapshot.owners).length !== 1) {
      loopOwnershipViolations += 1
    }
    const currentZ = vehicleBody.translation().z
    if (domainSnapshot.jobState === 'en-route-to-orchard') {
      loopBackslideDistanceM += Math.max(0, previousOutboundZ - currentZ)
    }
    previousOutboundZ = currentZ
    if (recovery.needsRecovery(createCourseRecoveryObservation(
      ORCHARD_WORLD_DEFINITION,
      {
        chassisY: vehicleBody.translation().y,
        rollDegrees: angles.rollDegrees,
        deltaSeconds: FIXED_SECONDS,
        explicitReset: false,
      },
    ))) {
      recovery.recoverPhysicsOnly()
      return
    }
    if (
      Math.abs(angles.rollDegrees) <= 15
      && vehicleTelemetry.wheels.length === 3
      && vehicleTelemetry.wheels.every((wheel) => wheel.grounded)
    ) {
      const position = vehicleBody.translation()
      for (const safePoint of course.safePoints) {
        if (distanceBetween(position, safePoint.pose.translation) <= 1) {
          recovery.recordSafePoint(safePoint.id, runtimePose(safePoint.pose))
        }
      }
    }
  }

  const interpolate = (alpha: number): void => {
    vehiclePose.applyTo(assets.vehicleVisual.scene, alpha)
    if (authority.inputOwner === 'player') {
      playerPose.applyTo(assets.characterVisual.scene, alpha)
      assets.characterVisual.scene.translateY(-(
        contract.character.capsuleHalfHeightM
        + contract.character.capsuleRadiusM
      ))
    }
  }

  const render = (): void => {
    const width = Math.max(1, shell.canvas.clientWidth)
    const height = Math.max(1, shell.canvas.clientHeight)
    if (shell.canvas.width !== width || shell.canvas.height !== height) {
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    const angles = bodyAngles(vehicleBody)
    const snapshot = domain.snapshot()
    worldVisual.applyFruitOwner(snapshot.owners['fruit-1'] ?? 'tree')
    const contextualAction = resolveContextualAction()
    hud.update({
      jobState: contextualAction.context.jobState,
      fruitOwner: contextualAction.context.fruitOwner,
      action: contextualAction.action,
      debugEnabled,
    })
    if (debugEnabled) {
      debugPanel.update({
        speedMps: vehicleTelemetry.speedMps,
        rollDegrees: angles.rollDegrees,
        pitchDegrees: angles.pitchDegrees,
        wheels: vehicleTelemetry.wheels.map((wheel) => ({
          id: wheel.id,
          grounded: wheel.grounded,
          suspensionLengthM: contract.vehicle.suspensionRestM
            - wheel.compressionM,
        })),
        currentMassKg: vehicleBody.mass(),
        controlOwner: authority.inputOwner,
        jobState: snapshot.jobState,
        lastDomainTransition,
        physicsStepP95Ms: percentile95(physicsStepSamplesMs),
        recoveryCount: recovery.recoveryCount,
      })
    }
    if (fixtureMode && !scriptedInput?.done) {
      const position = vehicleBody.translation()
      rig.seatAnchor.updateWorldMatrix(true, false)
      const seatDistanceM = distanceBetween(
        player.body.translation(),
        rig.seatAnchor.getWorldPosition(new Vector3()),
      )
      const playerPosition = player.body.translation()
      const exitBlockerHandle = authorityAdapter.lastExitBlockerHandle()
      const exitBlockerKind = exitBlockerHandle === null
        ? 'none'
        : builtVehicleColliders.chassisColliderHandles.includes(exitBlockerHandle)
          ? 'vehicle'
          : [
              ...course.floorColliders,
              ...course.obstacleColliders,
              ...course.trunkColliders,
            ].some(
              ({ collider }) => collider.handle === exitBlockerHandle,
            )
            ? 'surface'
            : player.collider.handle === exitBlockerHandle
              ? 'player'
              : 'other'
      shell.status.textContent = [
        `Fixture loop ${(scriptedInput?.completedLoops ?? 0) + 1}/10`,
        snapshot.jobState,
        `owner:${authority.inputOwner}`,
        `x:${position.x.toFixed(2)}`,
        `z:${position.z.toFixed(2)}`,
        `seat:${seatDistanceM.toFixed(2)}m`,
        `player:${playerPosition.x.toFixed(2)},${playerPosition.z.toFixed(2)}`,
        `recoveries:${recovery.recoveryCount}`,
        `exitBlocker:${exitBlockerKind}`,
      ].join(' · ')
    }
    renderer.render(scene, camera)
  }

  const loop = new FixedStepRuntimeLoop({
    runner: new FixedStepRunner(FIXED_SECONDS, MAX_FRAME_SECONDS),
    fixedSeconds: FIXED_SECONDS,
    input,
    simulate,
    interpolate,
    updateCamera,
    render,
    requestFrame: (callback) => window.requestAnimationFrame(callback),
    cancelFrame: (handle) => window.cancelAnimationFrame(handle),
  })
  if (fixtureMode) {
    const previousTelemetry = Object.getOwnPropertyDescriptor(
      window,
      '__FEASIBILITY__',
    )
    registerCleanup(() => {
      if (previousTelemetry) {
        Object.defineProperty(window, '__FEASIBILITY__', previousTelemetry)
      } else {
        Reflect.deleteProperty(window, '__FEASIBILITY__')
      }
    })
    const telemetry = Object.freeze({
      snapshot: () => {
        const recordedRecoveryCount = loopEvidence.reduce(
          (total, evidence) => total + evidence.recoveryCount,
          0,
        )
        const recordedOwnershipViolations = loopEvidence.reduce(
          (total, evidence) => total + evidence.ownershipViolations,
          0,
        )
        const currentLoopAlreadyRecorded = scriptedInput?.done === true
        let visibleDebugPrimitiveCount = 0
        scene.traverse((object) => {
          if (object.visible && object.userData.debugOnly === true) {
            visibleDebugPrimitiveCount += 1
          }
        })
        return structuredClone({
          fixture: 'full-loop' as const,
          completedLoops: scriptedInput?.completedLoops ?? 0,
          loadedAssetIds: [contract.vehicle.assetId, contract.character.assetId],
          fallbackCount: 0,
          recoveryCount: recordedRecoveryCount + (
            currentLoopAlreadyRecorded ? 0 : recovery.recoveryCount
          ),
          jobState: domain.snapshot().jobState,
          ownershipViolations: recordedOwnershipViolations + (
            currentLoopAlreadyRecorded ? 0 : loopOwnershipViolations
          ),
          stageViolationCount: scriptedInput?.stageViolationCount ?? 0,
          physicsStepP95Ms: percentile95(allPhysicsStepSamplesMs),
          consoleErrors: [...runtimeErrors],
          loops: loopEvidence,
          world: {
            worldAssetId: contract.environment.worldAssetId,
            treeAssetId: contract.environment.treeAssetId,
            treeInstanceCount: worldVisual.treeInstanceCount,
            crateInstanceCount: worldVisual.crateInstanceCount,
            vehicleDrawBatchCount: batchedVehicle.drawBatchCount,
            visibleDebugPrimitiveCount,
            omittedOptionalAssetIds: [],
            stateVisibility: worldVisual.stateVisibility(),
            drawCalls: renderer.info.render.calls,
            triangles: renderer.info.render.triangles,
          },
        })
      },
    })
    Object.defineProperty(window, '__FEASIBILITY__', {
      value: telemetry,
      writable: false,
      configurable: true,
      enumerable: false,
    })
  }
  let stopped = false
  let started = false
  let fixtureFrameHandle: number | undefined
  let fixtureErrorHandle: number | undefined
  const runFixtureFrame = (): void => {
    const fixtureInput = scriptedInput
    if (!fixtureInput) throw new Error('FIXTURE_INPUT_MISSING')
    if (stopped || fixtureInput.done) {
      render()
      return
    }
    for (let step = 0; step < 180 && !fixtureInput.done; step += 1) {
      input.fixedStep(FIXED_SECONDS)
      simulate()
      interpolate(1)
    }
    updateCamera(FIXED_SECONDS * 180)
    render()
    if (!fixtureInput.done) {
      fixtureFrameHandle = window.requestAnimationFrame(runFixtureFrame)
    }
  }
  registerCleanup(() => {
    stopped = true
    if (fixtureMode) {
      if (fixtureErrorHandle !== undefined) {
        window.clearTimeout(fixtureErrorHandle)
      }
      if (fixtureFrameHandle !== undefined) {
        window.cancelAnimationFrame(fixtureFrameHandle)
      }
      input.stop()
    } else {
      loop.stop()
    }
  })
  afterActorAssemblyStep('before-loop-start')
  return {
    start() {
      if (started || stopped) return
      started = true
      if (fixtureMode) {
        input.start()
        if (fixtureErrorMode) {
          fixtureErrorHandle = window.setTimeout(() => {
            throw new Error('FIXTURE_NONFATAL_ERROR')
          }, 0)
        }
        fixtureFrameHandle = window.requestAnimationFrame(runFixtureFrame)
      } else {
        loop.start()
      }
    },
    stop() {
      const error = cleanupActorRuntime()
      if (error !== undefined) throw error
    },
  }
  } catch (error) {
    cleanupActorRuntime()
    throw error
  }
}

export async function createFeasibilityApp(
  shell: FeasibilityShell,
): Promise<FeasibilityApp> {
  const contract = await loadRuntimeAssetContract(
    '/feasibility/runtime-assets.json',
  )
  const physics = await PhysicsWorld.create()
  const renderer = new WebGLRenderer({
    canvas: shell.canvas,
    antialias: true,
  })
  const scene = new Scene()
  let runtimeOwnsRenderer = false
  try {
    const search = new URLSearchParams(window.location.search)
    const debugEnabled = search.has('debug')
    const fixtureMode = search.get('fixture') === 'full-loop'
    const fixtureErrorMode = fixtureMode
      && search.get('fixtureError') === 'nonfatal'
    const course = createOrchardCourse(
      scene,
      physics,
      ORCHARD_WORLD_DEFINITION,
      debugEnabled,
    )
    const assets = await loadSliceAssets(contract)
    const actorSourceStates = [
      captureActorSource(assets.vehicleVisual.scene),
      captureActorSource(assets.characterVisual.scene),
    ]
    runtimeOwnsRenderer = true
    return initializeFeasibilityRuntime({
      createVehicleBatch: () => (
        createBatchedTricycleVisual(assets.vehicleVisual)
      ),
      createWorldVisual: () => createOrchardWorldVisual({
        scene,
        assets,
        definition: ORCHARD_WORLD_DEFINITION,
      }),
      createLighting: () => createOrchardLighting(
        scene,
        renderer,
        ORCHARD_WORLD_DEFINITION,
      ),
      createActorRuntime: ({ vehicleBatch, worldVisual }) => composeSliceRuntime({
        shell,
        contract,
        physics,
        renderer,
        scene,
        course,
        assets,
        worldVisual,
        batchedVehicle: vehicleBatch,
        debugEnabled,
        fixtureMode,
        fixtureErrorMode,
      }),
      disposeActors: () => restoreActorSources(actorSourceStates),
      disposeBase: () => renderer.dispose(),
    })
  } catch (error) {
    if (!runtimeOwnsRenderer) renderer.dispose()
    throw error
  }
}
