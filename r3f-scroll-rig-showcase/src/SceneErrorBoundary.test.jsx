import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SceneErrorBoundary } from './SceneErrorBoundary.jsx'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SceneErrorBoundary', () => {
  it('removes only the failed subtree and reports the rendering error', () => {
    const error = new Error('texture failed')
    const onError = vi.fn()
    vi.spyOn(console, 'error').mockImplementation(() => {})

    function BrokenLayer() {
      throw error
    }

    const { container } = render(
      <SceneErrorBoundary onError={onError}>
        <BrokenLayer />
      </SceneErrorBoundary>
    )

    expect(container).toBeEmptyDOMElement()
    expect(onError).toHaveBeenCalledOnce()
    expect(onError).toHaveBeenCalledWith(error)
  })
})
