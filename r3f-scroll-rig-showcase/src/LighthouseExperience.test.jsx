import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const tunnel = vi.hoisted(() => ({ child: null }))

vi.mock('@14islands/r3f-scroll-rig', () => ({
  GlobalCanvas: () => null,
  SmoothScrollbar: ({ enabled }) => <output aria-label="smooth-scroll-state" data-enabled={enabled} />,
  UseCanvas: ({ children, ...props }) => {
    tunnel.child = children
    return typeof children === 'function' ? children(props) : children
  },
}))

vi.mock('./LighthouseScene.jsx', () => ({
  LighthouseScene: ({
    routeIndex,
    compositionMode,
    reducedMotion,
    forceTextureFailure,
    onLoading,
    viewportWidth,
  }) => (
    <output
      aria-label="scene-state"
      data-route-index={routeIndex}
      data-composition-mode={compositionMode}
      data-reduced-motion={reducedMotion}
      data-texture-failure={forceTextureFailure}
      data-has-loading-handler={Boolean(onLoading)}
      data-viewport-width={viewportWidth}
    />
  ),
}))

import { LighthouseExperience } from './LighthouseExperience.jsx'

const initialViewportWidth = window.innerWidth

afterEach(() => {
  cleanup()
  tunnel.child = null
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: initialViewportWidth })
})

describe('LighthouseExperience', () => {
  it('tunnels route, motion, and texture state after the canvas child is registered', () => {
    const props = {
      stageRef: { current: null },
      forceFallback: false,
      onCanvasError: vi.fn(),
      onLoading: vi.fn(),
      onReady: vi.fn(),
    }
    const view = render(
      <LighthouseExperience
        {...props}
        routeIndex={0}
        compositionMode="locked"
        reducedMotion={false}
        forceTextureFailure={false}
      />
    )

    view.rerender(
      <LighthouseExperience
        {...props}
        routeIndex={3}
        compositionMode="legacy"
        reducedMotion
        forceTextureFailure
      />
    )

    expect(screen.getByLabelText('scene-state')).toHaveAttribute('data-route-index', '3')
    expect(screen.getByLabelText('scene-state')).toHaveAttribute('data-composition-mode', 'legacy')
    expect(screen.getByLabelText('scene-state')).toHaveAttribute('data-reduced-motion', 'true')
    expect(screen.getByLabelText('scene-state')).toHaveAttribute('data-texture-failure', 'true')
    expect(screen.getByLabelText('scene-state')).toHaveAttribute('data-has-loading-handler', 'true')
  })

  it('passes the current viewport width to the WebGL scene', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 768 })
    render(
      <LighthouseExperience
        stageRef={{ current: null }}
        routeIndex={0}
        reducedMotion={false}
        forceFallback={false}
        forceTextureFailure={false}
      />
    )

    expect(screen.getByLabelText('scene-state')).toHaveAttribute('data-viewport-width', '768')
  })

  it('updates WebGL and smooth-scroll policy after crossing the mobile breakpoint', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 })
    render(
      <LighthouseExperience
        stageRef={{ current: null }}
        routeIndex={0}
        reducedMotion={false}
        forceFallback={false}
        forceTextureFailure={false}
      />
    )

    expect(screen.getByLabelText('smooth-scroll-state')).toHaveAttribute('data-enabled', 'true')

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 768 })
    act(() => window.dispatchEvent(new Event('resize')))

    expect(screen.getByLabelText('scene-state')).toHaveAttribute('data-viewport-width', '768')
    expect(screen.getByLabelText('smooth-scroll-state')).toHaveAttribute('data-enabled', 'false')
  })
})
