import RAPIER, {
  type KinematicCharacterController,
  type RigidBody,
  type Vector,
  type World,
} from '@dimforge/rapier3d-compat'

const FIXED_SECONDS = 1 / 60

export class PhysicsWorld {
  private constructor(private readonly rapierWorld: World) {}

  static async create(): Promise<PhysicsWorld> {
    await RAPIER.init()
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    world.timestep = FIXED_SECONDS
    return new PhysicsWorld(world)
  }

  get world(): World {
    return this.rapierWorld
  }

  createDynamicCuboid(translation: Vector, halfExtents: Vector): RigidBody {
    const body = this.rapierWorld.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(
        translation.x,
        translation.y,
        translation.z,
      ),
    )
    this.rapierWorld.createCollider(
      RAPIER.ColliderDesc.cuboid(
        halfExtents.x,
        halfExtents.y,
        halfExtents.z,
      ),
      body,
    )
    return body
  }

  createFixedCuboid(translation: Vector, halfExtents: Vector): RigidBody {
    const body = this.rapierWorld.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(
        translation.x,
        translation.y,
        translation.z,
      ),
    )
    this.rapierWorld.createCollider(
      RAPIER.ColliderDesc.cuboid(
        halfExtents.x,
        halfExtents.y,
        halfExtents.z,
      ),
      body,
    )
    return body
  }

  step(): void {
    this.rapierWorld.step()
  }

  removeRigidBody(body: RigidBody): void {
    if (this.rapierWorld.bodies.contains(body.handle)) {
      this.rapierWorld.removeRigidBody(body)
    }
  }

  removeCharacterController(controller: KinematicCharacterController): void {
    if (this.rapierWorld.characterControllers.has(controller)) {
      this.rapierWorld.removeCharacterController(controller)
    }
  }
}
