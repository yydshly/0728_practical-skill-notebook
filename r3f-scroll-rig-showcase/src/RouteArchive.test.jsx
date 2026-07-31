import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RouteArchive } from './RouteArchive.jsx'

const stylesheet = readFileSync('src/styles.css', 'utf8')

afterEach(cleanup)

function renderArchive(activeIndex = 0, { interactive = true } = {}) {
  const onActiveIndexChange = vi.fn()
  const result = render(
    <RouteArchive
      activeIndex={activeIndex}
      interactive={interactive}
      onActiveIndexChange={onActiveIndexChange}
    />,
  )
  return { ...result, onActiveIndexChange }
}

describe('RouteArchive', () => {
  it('keeps the hidden archive inert and rejects control input', () => {
    const { container, onActiveIndexChange } = renderArchive(0, { interactive: false })
    const archive = container.querySelector('#route-archive')

    expect(archive).toHaveAttribute('aria-hidden', 'true')
    expect(archive).toHaveAttribute('inert')
    expect(archive).toHaveAttribute('data-interactive', 'false')
    const detail = container.querySelector('.route-card-copy button')
    fireEvent.click(detail)
    expect(detail).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(container.querySelector('.archive-controls button'))
    expect(onActiveIndexChange).not.toHaveBeenCalled()
  })

  it('enables the visible archive and only tabs to the active route detail', () => {
    const { container } = renderArchive(1)
    const archive = container.querySelector('#route-archive')
    const details = [...container.querySelectorAll('.route-card-copy button')]

    expect(archive).toHaveAttribute('aria-hidden', 'false')
    expect(archive).not.toHaveAttribute('inert')
    expect(archive).toHaveAttribute('data-interactive', 'true')
    expect(details.map((button) => button.tabIndex)).toEqual([-1, 0, -1, -1])
    expect(screen.getByRole('button', { name: '查看上一条航线' })).toBeInTheDocument()
  })

  it('gates pointer input and removes deterministic reduced route motion', () => {
    expect(stylesheet).toContain('.route-archive, .route-archive * { pointer-events: none; }')
    expect(stylesheet).toMatch(/\.route-archive\[data-interactive="true"\][\s\S]*?pointer-events: auto;/)
    expect(stylesheet).toMatch(/\.story\[data-reduced-motion="true"\] \.route-archive \{[\s\S]*?transition: none !important;[\s\S]*?transform: none;/)
    expect(stylesheet).toMatch(/\.story\[data-reduced-motion="true"\] \.route-track \{[\s\S]*?transition: none !important;/)
    expect(stylesheet).toMatch(/\.story\[data-reduced-motion="true"\] \.route-card[\s\S]*?transition: none !important;[\s\S]*?transform: none;/)
  })

  it('renders the four original routes', () => {
    renderArchive()
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
    expect(screen.getByRole('heading', { name: '潮汐花园' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '北侧风径' })).toBeInTheDocument()
  })

  it('wraps previous and next controls', () => {
    const first = renderArchive(0)
    fireEvent.click(screen.getByRole('button', { name: '查看上一条航线' }))
    expect(first.onActiveIndexChange).toHaveBeenCalledWith(3)

    first.unmount()
    const last = renderArchive(3)
    fireEvent.click(screen.getByRole('button', { name: '查看下一条航线' }))
    expect(last.onActiveIndexChange).toHaveBeenCalledWith(0)
  })

  it('supports Arrow, Home, and End keys', () => {
    const { onActiveIndexChange } = renderArchive(1)
    const archive = screen.getByRole('region', { name: '沿着光，认识这座岛。' })
    fireEvent.keyDown(archive, { key: 'ArrowRight' })
    fireEvent.keyDown(archive, { key: 'Home' })
    fireEvent.keyDown(archive, { key: 'End' })
    expect(onActiveIndexChange.mock.calls.map(([index]) => index)).toEqual([2, 0, 3])
  })

  it('opens only the selected route detail', () => {
    renderArchive()
    const button = screen.getByRole('button', { name: '了解「潮汐花园」' })
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/浅水石池收集着海藻/)).toBeVisible()
  })

  it('announces the controlled active route', () => {
    renderArchive(1)
    expect(screen.getByText(/路线 2，共 4 条：回声湾/)).toHaveAttribute('aria-live', 'polite')
  })
})
