import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CompositionControl } from './CompositionControl.jsx'

afterEach(cleanup)

describe('CompositionControl', () => {
  it('exposes locked and legacy as an accessible pressed-button group', () => {
    const onChange = vi.fn()

    render(
      <CompositionControl
        mode="locked"
        reducedMotion={false}
        onChange={onChange}
      />
    )

    expect(
      screen.getByRole('group', { name: '滚动构图对照' })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '稳定构图' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByRole('button', { name: '原始漂移' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )

    fireEvent.click(screen.getByRole('button', { name: '原始漂移' }))
    expect(onChange).toHaveBeenCalledWith('legacy')
  })

  it('disables legacy drift when reduced motion is active', () => {
    render(
      <CompositionControl
        mode="locked"
        reducedMotion
        onChange={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: '原始漂移' })).toBeDisabled()
  })
})
