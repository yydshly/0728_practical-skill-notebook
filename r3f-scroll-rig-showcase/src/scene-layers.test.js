import { describe, expect, it } from 'vitest'
import { MeshBasicMaterial } from 'three'
import { LEGACY_COMPOSITION } from './composition-mode.js'
import { deriveSceneFrame } from './story.js'
import {
  SCENE_LAYERS,
  createLayerSettlementTracker,
  deriveLayerMaterialState,
  invalidateMaterialTransparency,
  layerToWorldTransform,
} from './scene-layers.js'

describe('scene layer transforms', () => {
  it('keeps the approved seven-layer order', () => {
    expect(SCENE_LAYERS.map(({ name }) => name)).toEqual([
      'sky', 'distant', 'midground', 'lighthouse',
      'foreground-left', 'foreground-right', 'frame',
    ])
  })

  it('converts normalized approach values into covered world dimensions', () => {
    const frame = deriveSceneFrame(0.72, {
      compositionMode: LEGACY_COMPOSITION,
    })
    const transform = layerToWorldTransform('lighthouse', frame, 12.8, 7.2, 3)
    expect(transform.position).toEqual([-1.28, 0.252, 0.105])
    expect(transform.scale).toEqual([19.2, 10.8, 1])
  })

  it('moves left and right foreground in opposite directions', () => {
    const frame = deriveSceneFrame(0.42)
    const left = layerToWorldTransform('foreground-left', frame, 12.8, 7.2, 4)
    const right = layerToWorldTransform('foreground-right', frame, 12.8, 7.2, 5)
    expect(left.position[0]).toBeLessThan(-0.5)
    expect(right.position[0]).toBeGreaterThan(0.5)
  })

  it('settles seven isolated layers once and reports a degraded texture', () => {
    const readyStates = []
    const settle = createLayerSettlementTracker(
      SCENE_LAYERS.length,
      (state) => readyStates.push(state)
    )

    settle(0)
    settle(0, new Error('duplicate must not replace the first result'))
    for (let index = 1; index < SCENE_LAYERS.length; index += 1) {
      settle(index, index === 4 ? new Error('missing texture') : null)
    }

    expect(readyStates).toEqual([{ degraded: true }])
  })

  it('reports a fully settled scene as ready when every texture succeeds', () => {
    const readyStates = []
    const settle = createLayerSettlementTracker(
      SCENE_LAYERS.length,
      (state) => readyStates.push(state)
    )

    SCENE_LAYERS.forEach((_, index) => settle(index))

    expect(readyStates).toEqual([{ degraded: false }])
  })

  it('reveals the static composite through only the degraded WebGL background', () => {
    expect(deriveLayerMaterialState(0, false)).toEqual({
      transparent: false,
      opacity: 1,
      alphaTest: 0,
    })
    expect(deriveLayerMaterialState(0, true)).toEqual({
      transparent: true,
      opacity: 0.32,
      alphaTest: 0,
    })
    expect(deriveLayerMaterialState(3, true)).toEqual({
      transparent: true,
      opacity: 1,
      alphaTest: 0.003,
    })
  })

  it('invalidates the compiled material when background transparency changes', () => {
    const material = new MeshBasicMaterial({ transparent: false })
    const opaqueVersion = material.version
    material.transparent = true

    invalidateMaterialTransparency(material, false, true)

    expect(material.version).toBe(opaqueVersion + 1)
    const transparentVersion = material.version
    invalidateMaterialTransparency(material, true, true)
    expect(material.version).toBe(transparentVersion)
    material.dispose()
  })
})
