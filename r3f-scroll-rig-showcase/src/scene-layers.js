export const SCENE_LAYERS = [
  { name: 'sky', source: '/assets/scene/00-sky.webp' },
  { name: 'distant', source: '/assets/scene/10-distant-island.webp' },
  { name: 'midground', source: '/assets/scene/20-sea-midground.webp' },
  { name: 'lighthouse', source: '/assets/scene/30-lighthouse.webp' },
  { name: 'foreground-left', source: '/assets/scene/40-foreground-left.webp' },
  { name: 'foreground-right', source: '/assets/scene/41-foreground-right.webp' },
  { name: 'frame', source: '/assets/scene/50-edge-frame.webp' },
]

const round = (value) => Number(value.toFixed(4))

export function deriveLayerMaterialState(index, degraded = false) {
  const foreground = index > 0
  const revealStaticComposite = degraded && index === 0

  return {
    transparent: foreground || revealStaticComposite,
    opacity: revealStaticComposite ? 0.32 : 1,
    alphaTest: foreground ? 0.003 : 0,
  }
}

export function invalidateMaterialTransparency(
  material,
  previousTransparent,
  nextTransparent
) {
  if (material && previousTransparent !== nextTransparent) {
    material.needsUpdate = true
  }
}

export function createLayerSettlementTracker(layerCount, onReady) {
  const settledLayers = new Set()
  const failedLayers = new Set()

  return (index, error = null) => {
    if (settledLayers.has(index)) return
    settledLayers.add(index)
    if (error) failedLayers.add(index)
    if (settledLayers.size === layerCount) {
      onReady?.({ degraded: failedLayers.size > 0 })
    }
  }
}

export function layerToWorldTransform(name, frame, coveredWidth, coveredHeight, index) {
  const layer = frame.layers[name]
  return {
    position: [
      round(layer.x * coveredWidth),
      round(layer.y * coveredHeight),
      round(index * 0.035 + layer.z * 0.08),
    ],
    scale: [
      round(coveredWidth * layer.scale),
      round(coveredHeight * layer.scale),
      1,
    ],
  }
}
