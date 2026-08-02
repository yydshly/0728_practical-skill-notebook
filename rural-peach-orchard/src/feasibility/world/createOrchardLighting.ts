import {
  Color,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  Vector3,
  type Fog,
  type Scene,
  type WebGLRenderer,
} from 'three'
import type { OrchardWorldDefinition } from './orchardWorldDefinition'

export interface OrchardLighting {
  dispose(): void
}

export function createOrchardLighting(
  scene: Scene,
  renderer: WebGLRenderer,
  definition: OrchardWorldDefinition,
): OrchardLighting {
  const previousBackground = scene.background
  const previousFog = scene.fog
  const previousShadowsEnabled = renderer.shadowMap.enabled
  const background = new Color(definition.lighting.sky.color)
  const sky = new HemisphereLight(0xbfd8e8, 0x6a513b, 1.25)
  sky.name = 'orchard-sky'
  const sun = new DirectionalLight(0xffe0b2, 2.6)
  sun.name = 'orchard-sun'
  const sunDirection = new Vector3(
    definition.lighting.sun.direction.x,
    definition.lighting.sun.direction.y,
    definition.lighting.sun.direction.z,
  ).normalize()
  sun.position.copy(sunDirection).multiplyScalar(-40)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.left = -24
  sun.shadow.camera.right = 24
  sun.shadow.camera.top = 24
  sun.shadow.camera.bottom = -24
  sun.shadow.camera.near = 1
  sun.shadow.camera.far = 90
  const fog = new FogExp2(0xc9c1ad, 0.008)
  scene.background = background
  scene.fog = fog
  renderer.shadowMap.enabled = true
  scene.add(sky, sun)

  let disposed = false
  return {
    dispose() {
      if (disposed) return
      disposed = true
      sky.removeFromParent()
      sun.removeFromParent()
      sun.dispose()
      if (scene.background === background) {
        scene.background = previousBackground
      }
      if (scene.fog === fog) {
        scene.fog = previousFog as Fog | FogExp2 | null
      }
      renderer.shadowMap.enabled = previousShadowsEnabled
    },
  }
}
