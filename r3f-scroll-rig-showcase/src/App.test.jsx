import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const experience = vi.hoisted(() => ({ props: null }))
vi.mock('./LighthouseExperience.jsx', () => ({
  LighthouseExperience: (props) => {
    experience.props = props
    return null
  },
}))

import { App } from './App.jsx'

const initialInnerHeight = window.innerHeight
const initialScrollY = window.scrollY

afterEach(() => {
  cleanup()
  experience.props = null
  document.documentElement.classList.remove('webgl-ready', 'webgl-degraded')
  vi.unstubAllGlobals()
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: initialInnerHeight })
  Object.defineProperty(window, 'scrollY', { configurable: true, value: initialScrollY })
})

describe('App', () => {
  it('defaults to locked composition and forwards it to WebGL', () => {
    window.history.replaceState({}, '', '/')
    render(<App />)

    expect(document.querySelector('main')).toHaveAttribute(
      'data-composition-mode',
      'locked'
    )
    expect(experience.props.compositionMode).toBe('locked')
    expect(screen.getByRole('button', { name: '稳定构图' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('switches comparison mode without losing other URL parameters', () => {
    window.history.replaceState({}, '', '/?fallback=1&texture-fail=1')
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '原始漂移' }))
    expect(window.location.search).toBe(
      '?fallback=1&texture-fail=1&composition=legacy'
    )
    expect(document.querySelector('main')).toHaveAttribute(
      'data-composition-mode',
      'legacy'
    )

    fireEvent.click(screen.getByRole('button', { name: '稳定构图' }))
    expect(window.location.search).toBe('?fallback=1&texture-fail=1')
  })

  it('forces locked composition and disables legacy in reduced motion', () => {
    window.history.replaceState({}, '', '/?reduced=1&composition=legacy')
    render(<App />)

    expect(document.querySelector('main')).toHaveAttribute(
      'data-composition-mode',
      'locked'
    )
    expect(experience.props.compositionMode).toBe('locked')
    expect(screen.getByRole('button', { name: '原始漂移' })).toBeDisabled()
  })

  it('composes the original story and four-route archive in fallback mode', () => {
    window.history.replaceState({}, '', '/?fallback=1')
    render(<App />)

    expect(screen.getByRole('heading', { name: '雾屿灯塔' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /每一次点亮/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /看不见岸时/ })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem', { hidden: true })).toHaveLength(4)
    expect(screen.getByRole('button', { name: '灯塔' })).toHaveAttribute('aria-current', 'location')
    expect(document.querySelector('main')).toHaveAttribute('data-scene-mode', 'fallback')
  })

  it('exposes the deterministic reduced-motion route', () => {
    window.history.replaceState({}, '', '/?reduced=1')
    render(<App />)
    expect(document.querySelector('main')).toHaveAttribute('data-reduced-motion', 'true')
  })

  it('keeps the four routes in reduced-motion mode', () => {
    window.history.replaceState({}, '', '/?reduced=1')
    render(<App />)

    expect(screen.getAllByRole('listitem', { hidden: true })).toHaveLength(4)
    expect(document.querySelector('main')).toHaveAttribute('data-reduced-motion', 'true')
  })

  it('disables the static beacon in reduced-motion fallback mode', () => {
    window.history.replaceState({}, '', '/?reduced=1&fallback=1')
    render(<App />)

    expect(document.querySelector('main')).toHaveAttribute('data-static-beacon-active', 'false')
  })

  it('freezes every fallback layer for the deterministic reduced-motion route', () => {
    window.history.replaceState({}, '', '/?reduced=1&fallback=1')
    render(<App />)

    const layers = document.querySelectorAll('.fallback-stack img')
    expect(layers).toHaveLength(7)
    layers.forEach((layer) => expect(layer).toHaveStyle({ transform: 'none' }))
  })

  it('keeps the complete route controls in fallback mode', () => {
    window.history.replaceState({}, '', '/?fallback=1')
    render(<App />)

    expect(screen.getByRole('button', { name: '查看上一条航线', hidden: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '查看下一条航线', hidden: true })).toBeInTheDocument()
  })

  it('skips to route progress and focuses the archive only after it becomes interactive', () => {
    window.history.replaceState({}, '', '/')
    const scrollTo = vi.fn()
    let nextAnimationFrame
    vi.stubGlobal('scrollTo', scrollTo)
    vi.stubGlobal('requestAnimationFrame', (callback) => {
      nextAnimationFrame = callback
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 })
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })

    render(<App />)
    const story = document.querySelector('main')
    const archive = document.querySelector('#route-archive')
    Object.defineProperty(story, 'offsetHeight', { configurable: true, value: 2000 })
    Object.defineProperty(story, 'offsetTop', { configurable: true, value: 0 })

    expect(archive).toHaveAttribute('aria-hidden', 'true')
    expect(archive).toHaveAttribute('inert')
    fireEvent.click(screen.getByRole('link', { name: '跳至航线档案' }))
    expect(scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'smooth' })
    expect(document.activeElement).not.toBe(archive)

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 1000 })
    act(() => window.dispatchEvent(new Event('scroll')))
    act(() => nextAnimationFrame())

    expect(archive).toHaveAttribute('aria-hidden', 'false')
    expect(archive).not.toHaveAttribute('inert')
    expect(document.activeElement).toBe(archive)
  })

  it('cancels a pending archive focus when normal navigation takes over', () => {
    window.history.replaceState({}, '', '/')
    const scrollTo = vi.fn()
    let nextAnimationFrame
    vi.stubGlobal('scrollTo', scrollTo)
    vi.stubGlobal('requestAnimationFrame', (callback) => {
      nextAnimationFrame = callback
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 })
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })

    render(<App />)
    const story = document.querySelector('main')
    const archive = document.querySelector('#route-archive')
    Object.defineProperty(story, 'offsetHeight', { configurable: true, value: 2000 })
    Object.defineProperty(story, 'offsetTop', { configurable: true, value: 0 })

    fireEvent.click(screen.getByRole('link', { name: '跳至航线档案' }))
    fireEvent.click(screen.getByRole('button', { name: '信号' }))
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 500, behavior: 'smooth' })

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 1000 })
    act(() => window.dispatchEvent(new Event('scroll')))
    act(() => nextAnimationFrame())

    expect(archive).toHaveAttribute('data-interactive', 'true')
    expect(document.activeElement).not.toBe(archive)
  })

  it('forwards the one-layer texture failure route to the WebGL experience', () => {
    window.history.replaceState({}, '', '/?texture-fail=1')
    render(<App />)

    expect(experience.props.forceTextureFailure).toBe(true)
    expect(experience.props.forceFallback).toBe(false)
  })

  it('keeps degraded texture recovery distinct from fatal canvas failure', () => {
    window.history.replaceState({}, '', '/')
    render(<App />)

    act(() => experience.props.onReady({ degraded: true }))
    expect(document.documentElement).not.toHaveClass('webgl-ready')
    expect(document.documentElement).toHaveClass('webgl-degraded')
    expect(document.querySelector('main')).toHaveAttribute('data-scene-mode', 'enhanced')

    act(() => experience.props.onCanvasError(new Error('canvas failed')))
    expect(document.documentElement).not.toHaveClass('webgl-ready', 'webgl-degraded')
    expect(document.querySelector('main')).toHaveAttribute('data-scene-mode', 'fallback')
  })

  it('clears stale ready and degraded classes while a texture generation loads', () => {
    window.history.replaceState({}, '', '/')
    render(<App />)

    act(() => experience.props.onReady({ degraded: true }))
    expect(document.documentElement).toHaveClass('webgl-degraded')
    act(() => experience.props.onLoading())
    expect(document.documentElement).not.toHaveClass('webgl-ready', 'webgl-degraded')

    act(() => experience.props.onReady({ degraded: false }))
    expect(document.documentElement).toHaveClass('webgl-ready')
    act(() => experience.props.onLoading())
    expect(document.documentElement).not.toHaveClass('webgl-ready', 'webgl-degraded')
  })

  it('removes both WebGL lifecycle classes when the app unmounts', () => {
    window.history.replaceState({}, '', '/')
    const view = render(<App />)

    act(() => experience.props.onReady({ degraded: true }))
    expect(document.documentElement).toHaveClass('webgl-degraded')

    view.unmount()
    expect(document.documentElement).not.toHaveClass('webgl-ready', 'webgl-degraded')
  })
})
