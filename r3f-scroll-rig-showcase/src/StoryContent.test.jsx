import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StoryContent } from './StoryContent.jsx'

const stylesheet = readFileSync('src/styles.css', 'utf8')

afterEach(cleanup)

describe('StoryContent', () => {
  it('restores the original lighthouse, keeper, and signal story', () => {
    render(
      <StoryContent activePhase="establish" onNavigate={vi.fn()}>
        <section aria-label="航线档案测试" />
      </StoryContent>
    )

    expect(screen.getByRole('heading', { level: 1, name: '雾屿灯塔' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /每一次点亮/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /看不见岸时/ })).toBeInTheDocument()
    expect(screen.getByText('自 1912 年起，每晚亮起。')).toBeInTheDocument()
    expect(screen.getByText('可见距离 18 海里。')).toBeInTheDocument()
    expect(screen.getByLabelText('航线档案测试')).toBeInTheDocument()
  })

  it('anchors keeper copy in left negative space with soft responsive surfaces', () => {
    render(<StoryContent activePhase="open-coast" onNavigate={vi.fn()} />)

    const keeper = screen.getByRole('heading', { name: /每一次点亮/ }).closest('article')
    expect(keeper).toHaveClass('narrative-panel-left')
    expect(keeper).toHaveAttribute('data-copy-zone', 'left-negative-space')
    expect(document.querySelector('.intro-copy')).toHaveClass('copy-surface--soft')
    expect(document.querySelectorAll('.copy-surface--soft')).toHaveLength(3)
    expect(stylesheet).toContain('.narrative-panel-left { left: var(--edge); }')
    expect(stylesheet).toMatch(/\.archive-controls \{[\s\S]*?bottom: -0\.5rem;/)
    expect(stylesheet).toMatch(/@media \(min-width: 561px\) and \(max-width: 820px\) \{[\s\S]*?\.intro-copy\.copy-surface--soft \{[\s\S]*?width: min\(26rem,/)
  })

  it('maps navigation buttons to the approved progress points', () => {
    const onNavigate = vi.fn()
    render(<StoryContent activePhase="approach" onNavigate={onNavigate} />)

    fireEvent.click(screen.getByRole('button', { name: '信号' }))
    fireEvent.click(screen.getByRole('button', { name: '航线' }))

    expect(onNavigate).toHaveBeenNthCalledWith(1, 0.5)
    expect(onNavigate).toHaveBeenNthCalledWith(2, 1)
  })

  it('places the composition comparison in the persistent scene UI', () => {
    render(
      <StoryContent
        activePhase="establish"
        compositionMode="locked"
        reducedMotion={false}
        onCompositionModeChange={vi.fn()}
        onNavigate={vi.fn()}
      />
    )

    expect(
      screen.getByRole('group', { name: '滚动构图对照' })
    ).toHaveClass('composition-control')
  })
})
