export interface DisposableResource {
  dispose(): void
}

export interface StartableActorRuntime {
  start(): void
  stop(): void
}

export interface InitializedFeasibilityRuntime {
  stop(): void
}

export interface FeasibilityRuntimeFactories<
  VehicleBatch extends DisposableResource,
  WorldVisual extends DisposableResource,
  Lighting extends DisposableResource,
> {
  createVehicleBatch(): VehicleBatch
  createWorldVisual(vehicleBatch: VehicleBatch): WorldVisual
  createLighting(
    vehicleBatch: VehicleBatch,
    worldVisual: WorldVisual,
  ): Lighting
  createActorRuntime(resources: Readonly<{
    vehicleBatch: VehicleBatch
    worldVisual: WorldVisual
    lighting: Lighting
  }>): StartableActorRuntime
  disposeActors(): void
  disposeBase(): void
}

/**
 * Owns the whole synchronous runtime assembly boundary. Each successfully
 * created layer is unwound in strict reverse order on failure and on stop.
 */
export function initializeFeasibilityRuntime<
  VehicleBatch extends DisposableResource,
  WorldVisual extends DisposableResource,
  Lighting extends DisposableResource,
>(
  factories: FeasibilityRuntimeFactories<VehicleBatch, WorldVisual, Lighting>,
): InitializedFeasibilityRuntime {
  let vehicleBatch: VehicleBatch | undefined
  let worldVisual: WorldVisual | undefined
  let lighting: Lighting | undefined
  let actorRuntime: StartableActorRuntime | undefined
  let stopped = false

  const cleanup = (): unknown => {
    if (stopped) return undefined
    stopped = true
    let firstError: unknown
    const dispose = (operation: () => void): void => {
      try {
        operation()
      } catch (error) {
        firstError ??= error
      }
    }
    if (actorRuntime) dispose(() => actorRuntime!.stop())
    if (vehicleBatch) dispose(factories.disposeActors)
    if (lighting) dispose(() => lighting!.dispose())
    if (worldVisual) dispose(() => worldVisual!.dispose())
    if (vehicleBatch) dispose(() => vehicleBatch!.dispose())
    dispose(factories.disposeBase)
    return firstError
  }

  try {
    vehicleBatch = factories.createVehicleBatch()
    worldVisual = factories.createWorldVisual(vehicleBatch)
    lighting = factories.createLighting(vehicleBatch, worldVisual)
    actorRuntime = factories.createActorRuntime({
      vehicleBatch,
      worldVisual,
      lighting,
    })
    actorRuntime.start()
  } catch (error) {
    cleanup()
    throw error
  }

  return {
    stop() {
      const error = cleanup()
      if (error !== undefined) throw error
    },
  }
}
