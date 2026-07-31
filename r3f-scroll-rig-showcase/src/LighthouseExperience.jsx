import { Suspense, useEffect, useState } from 'react'
import { GlobalCanvas, SmoothScrollbar, UseCanvas } from '@14islands/r3f-scroll-rig'
import { LighthouseScene } from './LighthouseScene.jsx'
import { SceneErrorBoundary } from './SceneErrorBoundary.jsx'

export function LighthouseExperience({
  stageRef,
  routeIndex,
  compositionMode,
  reducedMotion,
  forceFallback,
  forceTextureFailure,
  onCanvasError,
  onLoading,
  onReady,
}) {
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth)

  useEffect(() => {
    const updateViewportWidth = () => setViewportWidth(window.innerWidth)
    addEventListener('resize', updateViewportWidth)
    return () => removeEventListener('resize', updateViewportWidth)
  }, [])

  if (forceFallback) return null

  const smoothScrollEnabled = !reducedMotion && viewportWidth > 820

  return (
    <>
      <GlobalCanvas
        orthographic
        scaleMultiplier={0.01}
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: true }}
        onError={onCanvasError}
        style={{ zIndex: 2, pointerEvents: 'none' }}
      />
      <SmoothScrollbar enabled={smoothScrollEnabled} />
      <UseCanvas
        id="lighthouse-stage"
        stageRef={stageRef}
        routeIndex={routeIndex}
        compositionMode={compositionMode}
        reducedMotion={reducedMotion}
        forceTextureFailure={forceTextureFailure}
        onCanvasError={onCanvasError}
        onLoading={onLoading}
        onReady={onReady}
      >
        {(sceneProps) => (
          <SceneErrorBoundary onError={sceneProps.onCanvasError}>
            <Suspense fallback={null}>
              <LighthouseScene
                track={sceneProps.stageRef}
                routeIndex={sceneProps.routeIndex}
                compositionMode={sceneProps.compositionMode}
                reducedMotion={sceneProps.reducedMotion}
                viewportWidth={viewportWidth}
                forceTextureFailure={sceneProps.forceTextureFailure}
                onLoading={sceneProps.onLoading}
                onReady={sceneProps.onReady}
              />
            </Suspense>
          </SceneErrorBoundary>
        )}
      </UseCanvas>
    </>
  )
}
