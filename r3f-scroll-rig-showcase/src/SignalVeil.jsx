import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, SRGBColorSpace } from 'three'
import { deriveSceneFrame } from './story.js'

const LINES = ['... --- ...', 'N 31 DEG', '1912', 'KEEPER LOG', 'NORTH WIND']

function createSignalTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const context = canvas.getContext('2d')
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = 'rgba(220, 232, 230, 0.78)'
  context.font = '28px monospace'
  LINES.forEach((line, index) => context.fillText(line, 60, 90 + index * 72))
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

export function SignalVeil({ scale, scrollState, reducedMotion, routeIndex, viewportWidth }) {
  const materialRef = useRef(null)
  const texture = useMemo(createSignalTexture, [])

  useEffect(() => () => texture.dispose(), [texture])

  useFrame(() => {
    if (!materialRef.current) return
    const frame = deriveSceneFrame(scrollState.progress, { reducedMotion, routeIndex, viewportWidth })
    materialRef.current.opacity = frame.signal * 0.44
  })

  return (
    <mesh
      position={[-scale[0] * 0.22, 0, 0.74]}
      scale={[scale[0] * 0.48, scale[1] * 0.56, 1]}
      renderOrder={21}
    >
      <planeGeometry />
      <meshBasicMaterial
        ref={materialRef}
        map={texture}
        transparent
        opacity={0}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}
