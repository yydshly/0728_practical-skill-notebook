import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
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
  uniform float uTime;
  uniform float uProgress;
  uniform float uStrength;

  float hash(vec2 point) {
    return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);
    float a = hash(cell);
    float b = hash(cell + vec2(1.0, 0.0));
    float c = hash(cell + vec2(0.0, 1.0));
    float d = hash(cell + vec2(1.0, 1.0));
    return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
  }

  void main() {
    vec2 drift = vec2(uTime * 0.018 + uProgress * 0.45, -uTime * 0.009);
    float broad = noise(vUv * vec2(3.2, 2.1) + drift);
    float detail = noise(vUv * vec2(8.6, 4.4) - drift * 1.7);
    float fog = smoothstep(0.28, 0.88, broad * 0.72 + detail * 0.28);
    float horizon = smoothstep(0.02, 0.78, 1.0 - vUv.y);
    float alpha = fog * horizon * 0.22 * uStrength;
    gl_FragColor = vec4(vec3(0.55, 0.66, 0.68), alpha);
  }
`

export function FogVeil({ scale, scrollState, reducedMotion, routeIndex, viewportWidth }) {
  const materialRef = useRef(null)
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uStrength: { value: 0 },
    }),
    []
  )

  useFrame(({ clock }) => {
    if (!materialRef.current) return
    const frame = deriveSceneFrame(scrollState.progress, { reducedMotion, routeIndex, viewportWidth })
    materialRef.current.uniforms.uTime.value = reducedMotion ? 0 : clock.elapsedTime
    materialRef.current.uniforms.uProgress.value = frame.progress
    materialRef.current.uniforms.uStrength.value = frame.fogStrength
  })

  return (
    <mesh position={[0, 0, 0.72]} scale={scale} renderOrder={20}>
      <planeGeometry />
      <shaderMaterial
        ref={materialRef}
        transparent
        depthTest={false}
        depthWrite={false}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  )
}
