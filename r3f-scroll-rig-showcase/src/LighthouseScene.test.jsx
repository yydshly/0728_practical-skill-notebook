import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const rig = vi.hoisted(() => ({ renderChildren: true, stickyProps: null }))

vi.mock('@react-three/fiber', () => ({
  useFrame: () => {},
}))

vi.mock('@14islands/r3f-scroll-rig/powerups', () => ({
  StickyScrollScene: ({ children, ...props }) => {
    rig.stickyProps = props
    if (!rig.renderChildren) return null
    return children({
      scale: { x: 12.8, y: 7.2 },
      scrollState: { progress: 0 },
    })
  },
}))

vi.mock('./Beacon.jsx', () => ({ Beacon: () => null }))
vi.mock('./FogVeil.jsx', () => ({ FogVeil: () => null }))
vi.mock('./SignalVeil.jsx', () => ({ SignalVeil: () => null }))

vi.mock('./LighthouseLayer.jsx', async () => {
  const React = await import('react')

  return {
    LighthouseLayer: React.forwardRef(function TestLayer(
      { source, index, degraded, onSettled },
      ref
    ) {
      React.useEffect(() => {
        onSettled(index)
      }, [index, onSettled, source])

      if (source.includes('__missing-texture__')) {
        throw new Error('forced texture failure')
      }

      return (
        <i
          ref={ref}
          data-testid={`layer-${index}`}
          data-degraded={degraded}
        />
      )
    }),
  }
})

import { LighthouseScene } from './LighthouseScene.jsx'

afterEach(() => {
  cleanup()
  rig.renderChildren = true
  rig.stickyProps = null
  vi.restoreAllMocks()
})

describe('LighthouseScene texture generations', () => {
  it('uses immediate sticky compensation for locked and reduced composition', () => {
    rig.renderChildren = false
    const props = {
      track: { current: null },
      routeIndex: 0,
      viewportWidth: 1280,
      forceTextureFailure: false,
      onLoading: vi.fn(),
      onReady: vi.fn(),
    }
    const view = render(
      <LighthouseScene
        {...props}
        compositionMode="locked"
        reducedMotion={false}
      />
    )

    expect(rig.stickyProps.stickyLerp).toBe(1)

    view.rerender(
      <LighthouseScene
        {...props}
        compositionMode="legacy"
        reducedMotion={false}
      />
    )
    expect(rig.stickyProps.stickyLerp).toBe(0.14)

    view.rerender(
      <LighthouseScene
        {...props}
        compositionMode="legacy"
        reducedMotion
      />
    )
    expect(rig.stickyProps.stickyLerp).toBe(1)
  })

  it('keeps the six successful layers rendered when one texture fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const onReady = vi.fn()

    render(
      <LighthouseScene
        track={{ current: null }}
        reducedMotion={false}
        routeIndex={0}
        forceTextureFailure
        onLoading={vi.fn()}
        onReady={onReady}
      />
    )

    await waitFor(() => {
      expect(onReady).toHaveBeenCalledWith({ degraded: true })
    })

    const renderedLayerIndices = screen
      .getAllByTestId(/^layer-/)
      .map((layer) => Number(layer.getAttribute('data-testid').replace('layer-', '')))
      .sort((left, right) => left - right)

    expect(renderedLayerIndices).toEqual([0, 1, 2, 3, 5, 6])
    expect(screen.queryByTestId('layer-4')).not.toBeInTheDocument()
    expect(onReady).toHaveBeenCalledTimes(1)
  })

  it('settles success, failure, and recovery generations exactly once', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const events = []
    const onLoading = vi.fn(() => events.push('loading'))
    const onReady = vi.fn(({ degraded }) => events.push(degraded ? 'degraded' : 'ready'))
    const baseProps = {
      track: { current: null },
      reducedMotion: false,
      routeIndex: 0,
      onLoading,
      onReady,
    }
    const view = render(
      <LighthouseScene {...baseProps} forceTextureFailure={false} />
    )

    await waitFor(() => {
      expect(events).toEqual(['loading', 'ready'])
    })
    expect(screen.getByTestId('layer-0')).toHaveAttribute('data-degraded', 'false')

    view.rerender(
      <LighthouseScene {...baseProps} forceTextureFailure />
    )

    await waitFor(() => {
      expect(events).toEqual(['loading', 'ready', 'loading', 'degraded'])
    })
    expect(screen.getByTestId('layer-0')).toHaveAttribute('data-degraded', 'true')

    view.rerender(
      <LighthouseScene {...baseProps} forceTextureFailure={false} />
    )

    await waitFor(() => {
      expect(events).toEqual([
        'loading',
        'ready',
        'loading',
        'degraded',
        'loading',
        'ready',
      ])
    })
    expect(screen.getByTestId('layer-0')).toHaveAttribute('data-degraded', 'false')
    expect(onLoading).toHaveBeenCalledTimes(3)
    expect(onReady).toHaveBeenCalledTimes(3)
  })
})
