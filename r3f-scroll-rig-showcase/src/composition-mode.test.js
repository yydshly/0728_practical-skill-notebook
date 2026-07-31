import { describe, expect, it } from 'vitest'
import {
  LEGACY_COMPOSITION,
  LOCKED_COMPOSITION,
  readCompositionMode,
  withCompositionMode,
} from './composition-mode.js'

describe('composition mode URL policy', () => {
  it('defaults unknown and absent values to locked composition', () => {
    expect(readCompositionMode('')).toBe(LOCKED_COMPOSITION)
    expect(readCompositionMode('?composition=unknown')).toBe(LOCKED_COMPOSITION)
  })

  it('recognizes only the explicit legacy comparison value', () => {
    expect(readCompositionMode('?composition=legacy')).toBe(LEGACY_COMPOSITION)
  })

  it('adds and removes legacy without losing other URL state', () => {
    const base =
      'http://127.0.0.1:4174/?fallback=1&texture-fail=1#route-archive'

    expect(withCompositionMode(base, LEGACY_COMPOSITION)).toBe(
      '/?fallback=1&texture-fail=1&composition=legacy#route-archive'
    )
    expect(
      withCompositionMode(
        'http://127.0.0.1:4174/?fallback=1&composition=legacy#route-archive',
        LOCKED_COMPOSITION
      )
    ).toBe('/?fallback=1#route-archive')
  })
})
