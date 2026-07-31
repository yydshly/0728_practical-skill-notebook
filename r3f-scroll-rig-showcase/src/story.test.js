import { describe, expect, it } from 'vitest'
import {
  LEGACY_COMPOSITION,
  LOCKED_COMPOSITION,
} from './composition-mode.js'
import {
  STORY_PHASES,
  coverDimensions,
  deriveSceneFrame,
  isArchiveFrameInteractive,
  progressToScrollTop,
} from './story.js'

describe('deriveSceneFrame', () => {
  it('preserves the original establishment frame at zero', () => {
    const frame = deriveSceneFrame(0)
    expect(frame.phase).toBe('establish')
    expect(frame.layers.sky.scale).toBe(1)
    expect(frame.layers.lighthouse.scale).toBe(1)
    expect(frame.signal).toBe(0)
    expect(frame.routeArchive).toBe(0)
  })

  it('opens the coast and makes the lighthouse approach faster by 42%', () => {
    const frame = deriveSceneFrame(0.42)
    expect(frame.phase).toBe('approach')
    expect(frame.layers['foreground-left'].x).toBeLessThanOrEqual(-0.04)
    expect(frame.layers['foreground-right'].x).toBeGreaterThanOrEqual(0.04)
    expect(frame.layers.lighthouse.scale).toBeGreaterThanOrEqual(1.18)
    expect(frame.layers.sky.scale).toBeLessThanOrEqual(1.06)
  })

  it('reaches a close signal view by 72%', () => {
    const frame = deriveSceneFrame(0.72)
    expect(frame.phase).toBe('routes')
    expect(frame.layers.lighthouse.scale).toBeGreaterThanOrEqual(1.35)
    expect(frame.layers.sky.scale).toBeLessThanOrEqual(1.1)
    expect(frame.signal).toBe(0)
    expect(frame.routeArchive).toBe(0)
  })

  it('bounds the signal event to the approach phase', () => {
    expect(deriveSceneFrame(0.41).signal).toBe(0)
    expect(deriveSceneFrame(0.56).signal).toBe(1)
    expect(deriveSceneFrame(0.73).signal).toBe(0)
  })

  it('keeps fog and beam absent outside the signal event', () => {
    expect(deriveSceneFrame(0.3)).toMatchObject({ fogStrength: 0, beamOpacity: 0 })
    expect(deriveSceneFrame(0.56)).toMatchObject({ fogStrength: 0.72, beamOpacity: 0.24 })
    expect(deriveSceneFrame(0.8)).toMatchObject({ fogStrength: 0, beamOpacity: 0 })
  })

  it('locks every layer vertically without removing the approach effects', () => {
    const frame = deriveSceneFrame(0.56, {
      compositionMode: LOCKED_COMPOSITION,
      viewportWidth: 1280,
    })

    Object.values(frame.layers).forEach((layer) => expect(layer.y).toBe(0))
    expect(frame.layers.lighthouse.scale).toBeGreaterThan(1)
    expect(frame.layers['foreground-left'].x).toBeLessThan(0)
    expect(frame.signal).toBe(1)
    expect(frame.fogStrength).toBe(0.72)
  })

  it('preserves vertical motion only in legacy comparison mode', () => {
    const frame = deriveSceneFrame(0.72, {
      compositionMode: LEGACY_COMPOSITION,
      viewportWidth: 1280,
    })

    expect(frame.layers.lighthouse.y).toBe(0.035)
    expect(frame.layers.midground.y).toBe(0.018)
  })

  it('keeps route feedback small and centered on the second route pair', () => {
    expect(deriveSceneFrame(1, { routeIndex: 0 }).routeSceneOffset).toBe(-0.009)
    expect(deriveSceneFrame(1, { routeIndex: 3 }).routeSceneOffset).toBe(0.009)
  })

  it('removes nonessential motion without removing timeline content', () => {
    const frame = deriveSceneFrame(1, { reducedMotion: true })
    expect(frame.layers.lighthouse).toMatchObject({ x: 0, y: 0, scale: 1 })
    expect(frame.layers['foreground-left'].x).toBe(0)
    expect(frame.signal).toBe(0)
    expect(frame.routeArchive).toBe(1)
    expect(frame.copy.routes).toBe(1)
  })

  it('returns deterministic frames at the 18% and 100% boundaries', () => {
    expect(deriveSceneFrame(0.18)).toMatchObject({
      phase: 'open-coast',
      routeArchive: 0,
    })
    expect(deriveSceneFrame(1)).toMatchObject({
      phase: 'routes',
      routeArchive: 1,
    })
  })

  it('keeps the 18% to 72% approach continuous and monotonic', () => {
    const samples = [0.18, 0.24, 0.3, 0.36, 0.42, 0.5, 0.6, 0.72]
      .map((progress) => deriveSceneFrame(progress))
    samples.slice(1).forEach((frame, index) => {
      expect(frame.layers.lighthouse.scale)
        .toBeGreaterThanOrEqual(samples[index].layers.lighthouse.scale)
      expect(frame.layers.sky.scale)
        .toBeGreaterThanOrEqual(samples[index].layers.sky.scale)
    })
  })

  it('uses 55% of desktop motion on tablet and mobile widths', () => {
    const desktop = deriveSceneFrame(0.42, { viewportWidth: 1280 })
    const mobile = deriveSceneFrame(0.42, { viewportWidth: 390 })
    expect(mobile.layers['foreground-left'].x / desktop.layers['foreground-left'].x)
      .toBeCloseTo(0.55, 2)
    expect(
      (mobile.layers.lighthouse.scale - 1) /
      (desktop.layers.lighthouse.scale - 1)
    ).toBeCloseTo(0.55, 2)
  })
})

describe('timeline utilities', () => {
  it('gates archive interaction at exactly 90% route visibility', () => {
    expect(isArchiveFrameInteractive({ copy: { routes: 0.8999 } })).toBe(false)
    expect(isArchiveFrameInteractive({ copy: { routes: 0.9 } })).toBe(true)
  })

  it('exports the approved phase boundaries', () => {
    expect(STORY_PHASES.map(({ id, start, end }) => [id, start, end])).toEqual([
      ['establish', 0, 0.18],
      ['open-coast', 0.18, 0.42],
      ['approach', 0.42, 0.72],
      ['routes', 0.72, 1],
    ])
  })

  it('exports the approved Chinese phase labels', () => {
    expect(STORY_PHASES.map(({ label }) => label)).toEqual([
      '灯塔',
      '守灯人',
      '信号',
      '航线',
    ])
  })

  it('converts normalized progress to a document scroll position', () => {
    expect(progressToScrollTop(0.5, 120, 3680)).toBe(1960)
  })

  it('covers portrait viewports without stretching imagery', () => {
    expect(coverDimensions(390, 844)).toEqual([1500.4444444444443, 844])
  })
})
