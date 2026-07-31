import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending } from 'three'
import { deriveSceneFrame } from './story.js'

const vertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = `
  varying vec2 vUv;
  uniform float uOpacity;

  void main() {
    float center = 1.0 - smoothstep(0.0, 0.5, abs(vUv.y - 0.5));
    float taper = smoothstep(0.0, 0.12, vUv.x);
    float fade = 1.0 - smoothstep(0.15, 1.0, vUv.x);
    float alpha = center * taper * fade * uOpacity;
    gl_FragColor = vec4(vec3(0.92, 0.68, 0.32), alpha);
  }
`

export function Beacon({ position, scrollState, reducedMotion, routeIndex, viewportWidth }) {
  const beamRef = useRef(null)
  const lampRef = useRef(null)
  const uniforms = useMemo(() => ({ uOpacity: { value: 0 } }), [])

  useFrame(() => {
    const frame = deriveSceneFrame(scrollState.progress, { reducedMotion, routeIndex, viewportWidth })
    if (beamRef.current) {
      beamRef.current.rotation.z = frame.beamAngle
      beamRef.current.material.uniforms.uOpacity.value = frame.beamOpacity
    }
    if (lampRef.current) {
      lampRef.current.material.opacity = 0.72 + frame.signal * 0.2
    }
  })

  return (
    <group position={position} renderOrder={22}>
      <mesh ref={beamRef} position={[1.7, 0, 0]}>
        <planeGeometry args={[3.4, 0.7]} />
        <shaderMaterial
          transparent
          depthTest={false}
          depthWrite={false}
          blending={AdditiveBlending}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
        />
      </mesh>
      <mesh ref={lampRef}>
        <circleGeometry args={[0.04, 24]} />
        <meshBasicMaterial
          color="#f7cf86"
          transparent
          opacity={0.72}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
