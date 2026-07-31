import {
  LEGACY_COMPOSITION,
  LOCKED_COMPOSITION,
} from './composition-mode.js'

export const STORY_PHASES = [
  { id: 'establish', label: '灯塔', start: 0, end: 0.18 },
  { id: 'open-coast', label: '守灯人', start: 0.18, end: 0.42 },
  { id: 'approach', label: '信号', start: 0.42, end: 0.72 },
  { id: 'routes', label: '航线', start: 0.72, end: 1 },
]

export const ARCHIVE_INTERACTIVE_THRESHOLD = 0.9

export const isArchiveFrameInteractive = (frame) =>
  frame.copy.routes >= ARCHIVE_INTERACTIVE_THRESHOLD

const clamp01 = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
const round = (value) => Number(value.toFixed(4))
const mix = (start, end, amount) => start + (end - start) * amount

function smoothstep(start, end, value) {
  const t = clamp01((value - start) / (end - start))
  return t * t * (3 - 2 * t)
}

function segmentInOut(value, enterStart, enterEnd, exitStart, exitEnd) {
  return Math.min(
    smoothstep(enterStart, enterEnd, value),
    1 - smoothstep(exitStart, exitEnd, value)
  )
}

const LAYER_TARGETS = {
  sky: { x: -0.015, y: -0.006, scale: 1.1, z: -0.5 },
  distant: { x: -0.03, y: 0, scale: 1.14, z: -0.32 },
  midground: { x: -0.065, y: 0.018, scale: 1.24, z: -0.1 },
  lighthouse: { x: -0.1, y: 0.035, scale: 1.5, z: 0 },
  'foreground-left': { x: -0.1, y: 0.018, scale: 1.27, z: 0.26 },
  'foreground-right': { x: 0.1, y: 0.018, scale: 1.29, z: 0.28 },
  frame: { x: 0, y: 0.01, scale: 1.22, z: 0.34 },
}

function phaseAt(progress) {
  if (progress < 0.18) return 'establish'
  if (progress < 0.42) return 'open-coast'
  if (progress < 0.72) return 'approach'
  return 'routes'
}

function deriveLayers(progress, reducedMotion, viewportWidth, compositionMode) {
  if (reducedMotion) {
    return Object.fromEntries(
      Object.keys(LAYER_TARGETS).map((name) => [name, { x: 0, y: 0, scale: 1, z: 0 }])
    )
  }

  const approach = smoothstep(0.18, 0.72, progress)
  const open = smoothstep(0.18, 0.42, progress)
  const motionScale = viewportWidth <= 820 ? 0.55 : 1
  const lockVerticalMotion = compositionMode !== LEGACY_COMPOSITION

  return Object.fromEntries(
    Object.entries(LAYER_TARGETS).map(([name, target]) => {
      const factor = name.startsWith('foreground') ? Math.max(open, approach) : approach
      return [
        name,
        {
          x: round(target.x * factor * motionScale),
          y: lockVerticalMotion ? 0 : round(target.y * approach * motionScale),
          scale: round(mix(1, target.scale, approach * motionScale)),
          z: round(target.z * approach * motionScale),
        },
      ]
    })
  )
}

export function deriveSceneFrame(
  progress,
  {
    reducedMotion = false,
    routeIndex = 1.5,
    viewportWidth = 1280,
    compositionMode = LOCKED_COMPOSITION,
  } = {}
) {
  const p = clamp01(progress)
  const signal = reducedMotion ? 0 : segmentInOut(p, 0.42, 0.5, 0.64, 0.72)
  const routeArchive = smoothstep(0.72, 0.94, p)
  const routeScale = reducedMotion ? 0 : viewportWidth <= 820 ? 0.003 : 0.006

  return {
    progress: p,
    phase: phaseAt(p),
    layers: deriveLayers(p, reducedMotion, viewportWidth, compositionMode),
    signal: round(signal),
    fogStrength: round(signal * 0.72),
    beamOpacity: round(signal * 0.24),
    beamAngle: round(mix(-0.09, 0.08, signal)),
    routeArchive: round(routeArchive),
    routeSceneOffset: round((routeIndex - 1.5) * routeScale * routeArchive),
    copy: {
      intro: round(1 - smoothstep(0.04, 0.18, p)),
      keeper: round(segmentInOut(p, 0.18, 0.24, 0.36, 0.44)),
      signal: round(segmentInOut(p, 0.42, 0.5, 0.64, 0.72)),
      routes: round(routeArchive),
    },
  }
}

export function progressToScrollTop(progress, sectionTop, travel) {
  return sectionTop + travel * clamp01(progress)
}

export function coverDimensions(width, height, ratio = 16 / 9) {
  return width / height > ratio ? [width, width / ratio] : [height * ratio, height]
}
