import RAPIER from '@dimforge/rapier3d-compat'
import { JSDOM } from 'jsdom'
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Scene,
  type Object3D,
  type WebGLRenderer,
} from 'three'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { LoadedCriticalAsset } from '../../../src/feasibility/assets/loadCriticalGlb'
import type { SliceAssets } from '../../../src/feasibility/assets/SliceAssetLoader'
import runtimeAssetContractJson from '../../../public/feasibility/runtime-assets.json'
import { parseRuntimeAssetContract } from '../../../src/feasibility/assets/runtimeAssetContract'
import {
  composeSliceRuntime,
  type ActorAssemblyFailurePoint,
} from '../../../src/feasibility/createFeasibilityApp'
import { createFeasibilityShell } from '../../../src/feasibility/createFeasibilityShell'
import { createOrchardCourse } from '../../../src/feasibility/course/createOrchardCourse'
import { PhysicsWorld } from '../../../src/feasibility/physics/PhysicsWorld'
import type { OrchardWorldVisual } from '../../../src/feasibility/world/createOrchardWorldVisual'
import { ORCHARD_WORLD_DEFINITION } from '../../../src/feasibility/world/orchardWorldDefinition'

const contract = parseRuntimeAssetContract(runtimeAssetContractJson)
const FAILURE_POINTS: readonly ActorAssemblyFailurePoint[] = [
  'after-listeners',
  'after-colliders',
  'after-scene-attach',
  'before-loop-start',
]
const TRANSACTION_CASES = [
  ...FAILURE_POINTS,
  'successful-fixture-stop',
  'successful-normal-stop',
] as const

function loaded(
  scene: Object3D,
  anchors: Map<string, Object3D> = new Map(),
): LoadedCriticalAsset {
  return { scene, anchors, clips: [] }
}

function createVehicleVisual(): LoadedCriticalAsset {
  const root = new Group()
  root.name = 'source-vehicle'
  root.position.set(2, 3, 4)
  const anchors = new Map<string, Object3D>()
  for (const [name, position] of [
    ['driver_seat', [0, 1, 0]],
    ['exit_left', [-0.8, 0, 0]],
    ['cargo_slot_01', [0, 0.9, 0.5]],
    ['wheel_front', [0, 0.29, -1.1]],
    ['wheel_rear_left', [0.47, 0.275, 0.9]],
    ['wheel_rear_right', [-0.47, 0.275, 0.9]],
  ] as const) {
    const anchor = new Group()
    anchor.name = name
    anchor.position.fromArray(position)
    root.add(anchor)
    anchors.set(name, anchor)
  }
  return loaded(root, anchors)
}

function addBox(
  parent: Object3D,
  name: string,
  dimensions: readonly [number, number, number],
): void {
  const mesh = new Mesh(
    new BoxGeometry(...dimensions),
    new MeshBasicMaterial(),
  )
  mesh.name = name
  parent.add(mesh)
}

function createCollisionAsset(): LoadedCriticalAsset {
  const root = new Group()
  for (const name of contract.vehicle.chassisColliderNodes) {
    addBox(root, name, [0.8, 0.2, 1.4])
  }
  addBox(root, 'convex_front_wheel', [0.15, 0.58, 0.58])
  addBox(root, 'convex_rear_left', [0.14, 0.55, 0.55])
  addBox(root, 'convex_rear_right', [0.14, 0.55, 0.55])
  return loaded(root)
}

function trackWindowListeners(window: Window): Readonly<{
  errorCount(): number
  inputCount(): number
}> {
  const active = new Map<string, Set<EventListenerOrEventListenerObject>>()
  const originalAdd = window.addEventListener.bind(window)
  const originalRemove = window.removeEventListener.bind(window)
  vi.spyOn(window, 'addEventListener').mockImplementation((type, listener, options) => {
    const listeners = active.get(type) ?? new Set()
    listeners.add(listener)
    active.set(type, listeners)
    originalAdd(type, listener, options)
  })
  vi.spyOn(window, 'removeEventListener').mockImplementation((
    type,
    listener,
    options,
  ) => {
    active.get(type)?.delete(listener)
    originalRemove(type, listener, options)
  })
  const count = (types: readonly string[]) => types.reduce((total, type) => (
    total + (active.get(type)?.size ?? 0)
  ), 0)
  return {
    errorCount: () => count(['error', 'unhandledrejection']),
    inputCount: () => count(['keydown', 'keyup', 'blur']),
  }
}

beforeAll(async () => {
  await RAPIER.init()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('composeSliceRuntime transaction', () => {
  it.each(TRANSACTION_CASES)(
    'restores listeners, actors, and physics after %s',
    async (transactionCase) => {
      const dom = new JSDOM(
        '<main id="app"></main>',
        { pretendToBeVisual: true, url: 'http://localhost/' },
      )
      vi.stubGlobal('window', dom.window)
      vi.stubGlobal('document', dom.window.document)
      const shell = createFeasibilityShell(
        dom.window.document.querySelector<HTMLElement>('#app')!,
      )
      const activeListeners = trackWindowListeners(dom.window as unknown as Window)
      const scene = new Scene()
      const physics = await PhysicsWorld.create()
      const course = createOrchardCourse(
        scene,
        physics,
        ORCHARD_WORLD_DEFINITION,
        false,
      )
      const vehicleVisual = createVehicleVisual()
      const characterVisual = loaded(new Group())
      characterVisual.scene.name = 'source-character'
      characterVisual.scene.position.set(-2, 1, 5)
      const vehicleOwner = new Group()
      const characterOwner = new Group()
      vehicleOwner.add(vehicleVisual.scene)
      characterOwner.add(characterVisual.scene)
      const assets: SliceAssets = {
        vehicleVisual,
        characterVisual,
        vehicleCollision: createCollisionAsset(),
        environmentWorldVisual: loaded(new Group()),
        peachTreeFamilyVisual: loaded(new Group()),
      }
      const baseline = {
        bodies: physics.world.bodies.len(),
        colliders: physics.world.colliders.len(),
        controllers: physics.world.characterControllers.size,
        sceneChildren: [...scene.children],
        vehicleParent: vehicleVisual.scene.parent,
        vehicleName: vehicleVisual.scene.name,
        vehiclePosition: vehicleVisual.scene.position.clone(),
        characterParent: characterVisual.scene.parent,
        characterName: characterVisual.scene.name,
        characterPosition: characterVisual.scene.position.clone(),
        errorListeners: activeListeners.errorCount(),
      }
      const renderer = {
        setSize: vi.fn(),
        render: vi.fn(),
      } as unknown as WebGLRenderer
      const worldVisual = {
        applyFruitOwner: vi.fn(),
        dispose: vi.fn(),
      } as unknown as OrchardWorldVisual

      const compose = () => composeSliceRuntime({
        shell,
        contract,
        physics,
        renderer,
        scene,
        course,
        assets,
        worldVisual,
        batchedVehicle: { drawBatchCount: 16 },
        debugEnabled: false,
        fixtureMode: transactionCase !== 'successful-normal-stop',
        fixtureErrorMode: false,
        afterActorAssemblyStep: (step) => {
          if (step === transactionCase) throw new Error(`injected ${step}`)
        },
      })
      if (transactionCase.startsWith('successful-')) {
        const runtime = compose()
        const inputListenersBeforeStart = activeListeners.inputCount()
        runtime.start()
        runtime.stop()
        runtime.stop()
        expect(activeListeners.inputCount()).toBe(inputListenersBeforeStart)
      } else {
        expect(compose).toThrow(`injected ${transactionCase}`)
      }

      expect(activeListeners.errorCount()).toBe(baseline.errorListeners)
      expect(scene.children).toEqual(baseline.sceneChildren)
      expect(physics.world.bodies.len()).toBe(baseline.bodies)
      expect(physics.world.colliders.len()).toBe(baseline.colliders)
      expect(physics.world.characterControllers.size).toBe(baseline.controllers)
      expect(vehicleVisual.scene.parent).toBe(baseline.vehicleParent)
      expect(vehicleVisual.scene.name).toBe(baseline.vehicleName)
      expect(vehicleVisual.scene.position).toEqual(baseline.vehiclePosition)
      expect(characterVisual.scene.parent).toBe(baseline.characterParent)
      expect(characterVisual.scene.name).toBe(baseline.characterName)
      expect(characterVisual.scene.position).toEqual(baseline.characterPosition)
    },
  )
})
