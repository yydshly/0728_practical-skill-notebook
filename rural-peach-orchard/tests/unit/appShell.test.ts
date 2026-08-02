import { beforeEach, describe, expect, it } from 'vitest'
import { JSDOM } from 'jsdom'
import { createAppShell } from '../../src/app/createAppShell'

describe('createAppShell', () => {
  beforeEach(() => {
    const dom = new JSDOM('<main id="app"></main>')
    globalThis.document = dom.window.document
  })

  it('creates the canvas, status region, and asset selector', () => {
    const root = document.querySelector<HTMLElement>('#app')!
    const shell = createAppShell(root)

    expect(shell.canvas.dataset.role).toBe('review-canvas')
    expect(shell.status.getAttribute('role')).toBe('status')
    expect(shell.status.textContent).toBe('正在读取资产清单')
    expect(shell.selector.getAttribute('aria-label')).toBe('选择 3D 资产')
    expect(root.querySelector('[data-role="orchard-hud"]')).toBeNull()
  })
})
