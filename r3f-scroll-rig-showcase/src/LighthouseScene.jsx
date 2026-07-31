import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { StickyScrollScene } from '@14islands/r3f-scroll-rig/powerups'
import { Beacon } from './Beacon.jsx'
import { FogVeil } from './FogVeil.jsx'
import { LighthouseLayer } from './LighthouseLayer.jsx'
import { SceneErrorBoundary } from './SceneErrorBoundary.jsx'
import { SignalVeil } from './SignalVeil.jsx'
import { LEGACY_COMPOSITION } from './composition-mode.js'
import { coverDimensions, deriveSceneFrame } from './story.js'
import {
  createLayerSettlementTracker,
  layerToWorldTransform,
  SCENE_LAYERS,
} from './scene-layers.js'

function LayeredWorld({
  scale,
  scrollState,
  compositionMode,
  reducedMotion,
  routeIndex,
  viewportWidth,
  forceTextureFailure,
  onLoading,
  onReady,
}) {
  const sources = useMemo(
    () => SCENE_LAYERS.map((layer, index) => (
      forceTextureFailure && index === 4
        ? '/assets/scene/__missing-texture__.webp'
        : layer.source
    )),
    [forceTextureFailure]
  )
  const generation = sources.join('|')

  return (
    <LayeredWorldGeneration
      key={generation}
      scale={scale}
      scrollState={scrollState}
      compositionMode={compositionMode}
      reducedMotion={reducedMotion}
      routeIndex={routeIndex}
      viewportWidth={viewportWidth}
      sources={sources}
      onLoading={onLoading}
      onReady={onReady}
    />
  )
}

function LayeredWorldGeneration({
  scale,
  scrollState,
  compositionMode,
  reducedMotion,
  routeIndex,
  viewportWidth,
  sources,
  onLoading,
  onReady,
}) {
  const layerRefs = useRef([])
  const worldRef = useRef(null)
  const onLoadingRef = useRef(onLoading)
  const onReadyRef = useRef(onReady)
  const [settlement, setSettlement] = useState(null)
  onLoadingRef.current = onLoading
  onReadyRef.current = onReady
  const [markLayerSettled] = useState(
    () => createLayerSettlementTracker(
      SCENE_LAYERS.length,
      setSettlement
    )
  )
  const degraded = settlement?.degraded ?? false
  const [coveredWidth, coveredHeight] = useMemo(
    () => coverDimensions(scale.x, scale.y),
    [scale.x, scale.y]
  )
  const horizontalCrop = Math.max(0, coveredWidth - scale.x)
  const mobileShift = scale.x < 8.2 ? -horizontalCrop * 0.26 : 0
  const beaconPosition = [coveredWidth * 0.22, coveredHeight * 0.235, 0.68]

  useLayoutEffect(() => {
    onLoadingRef.current?.()
  }, [])

  useEffect(() => {
    if (settlement) onReadyRef.current?.(settlement)
  }, [settlement])

  useFrame(() => {
    const frame = deriveSceneFrame(scrollState.progress, {
      compositionMode,
      reducedMotion,
      routeIndex,
      viewportWidth,
    })
    if (worldRef.current) {
      worldRef.current.position.x = mobileShift + frame.routeSceneOffset * coveredWidth
    }

    SCENE_LAYERS.forEach((layer, index) => {
      const mesh = layerRefs.current[index]
      if (!mesh) return
      const transform = layerToWorldTransform(
        layer.name,
        frame,
        coveredWidth,
        coveredHeight,
        index
      )
      mesh.position.set(...transform.position)
      mesh.scale.set(...transform.scale)
    })
  })

  return (
    <group ref={worldRef}>
      {SCENE_LAYERS.map((layer, index) => {
        const source = sources[index]
        return (
          <SceneErrorBoundary
            key={`${layer.name}:${source}`}
            onError={(error) => markLayerSettled(index, error)}
          >
            <Suspense fallback={null}>
              <LighthouseLayer
                ref={(mesh) => {
                  layerRefs.current[index] = mesh
                }}
                source={source}
                index={index}
                initialScale={[coveredWidth, coveredHeight, 1]}
                degraded={degraded}
                onSettled={markLayerSettled}
              />
            </Suspense>
          </SceneErrorBoundary>
        )
      })}
      <Beacon
        position={beaconPosition}
        scrollState={scrollState}
        reducedMotion={reducedMotion}
        routeIndex={routeIndex}
        viewportWidth={viewportWidth}
      />
      <FogVeil
        scale={[coveredWidth * 1.03, coveredHeight * 1.03, 1]}
        scrollState={scrollState}
        reducedMotion={reducedMotion}
        routeIndex={routeIndex}
        viewportWidth={viewportWidth}
      />
      <SignalVeil
        scale={[coveredWidth, coveredHeight, 1]}
        scrollState={scrollState}
        reducedMotion={reducedMotion}
        routeIndex={routeIndex}
        viewportWidth={viewportWidth}
      />
    </group>
  )
}

export function LighthouseScene({
  track,
  compositionMode,
  reducedMotion,
  routeIndex,
  viewportWidth,
  forceTextureFailure,
  onLoading,
  onReady,
}) {
  return (
    <StickyScrollScene
      track={track}
      fillViewport
      hideOffscreen={false}
      stickyLerp={
        reducedMotion || compositionMode !== LEGACY_COMPOSITION ? 1 : 0.14
      }
    >
      {({ scale, scrollState }) => (
        <LayeredWorld
          scale={scale}
          scrollState={scrollState}
          compositionMode={compositionMode}
          reducedMotion={reducedMotion}
          routeIndex={routeIndex}
          viewportWidth={viewportWidth}
          forceTextureFailure={forceTextureFailure}
          onLoading={onLoading}
          onReady={onReady}
        />
      )}
    </StickyScrollScene>
  )
}
