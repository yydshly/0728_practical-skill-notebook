import { forwardRef, useEffect, useLayoutEffect, useRef } from 'react'
import { useTexture } from '@react-three/drei'
import { SRGBColorSpace } from 'three'
import {
  deriveLayerMaterialState,
  invalidateMaterialTransparency,
} from './scene-layers.js'

export const LighthouseLayer = forwardRef(function LighthouseLayer(
  { source, index, initialScale, degraded, onSettled },
  ref
) {
  const texture = useTexture(source)
  const materialState = deriveLayerMaterialState(index, degraded)
  const materialRef = useRef(null)
  const previousTransparentRef = useRef(materialState.transparent)

  useEffect(() => {
    texture.colorSpace = SRGBColorSpace
    texture.needsUpdate = true
    onSettled(index)
  }, [index, onSettled, texture])

  useLayoutEffect(() => {
    invalidateMaterialTransparency(
      materialRef.current,
      previousTransparentRef.current,
      materialState.transparent
    )
    previousTransparentRef.current = materialState.transparent
  }, [materialState.transparent])

  return (
    <mesh ref={ref} scale={initialScale} renderOrder={index}>
      <planeGeometry />
      <meshBasicMaterial
        ref={materialRef}
        map={texture}
        transparent={materialState.transparent}
        opacity={materialState.opacity}
        alphaTest={materialState.alphaTest}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
})
