import { JSDOM } from 'jsdom'
import { readFileSync } from 'node:fs'
import { expect, it, vi } from 'vitest'
import { bootstrapFeasibility } from '../../../src/feasibility/bootstrapFeasibility'
import { createFeasibilityShell } from '../../../src/feasibility/createFeasibilityShell'

function findStyleRule(
  rules: CSSRuleList,
  selector: string,
): CSSStyleRule | undefined {
  for (const rule of Array.from(rules)) {
    if ('selectorText' in rule && rule.selectorText === selector) {
      return rule as CSSStyleRule
    }
    if ('cssRules' in rule) {
      const nested = findStyleRule((rule as CSSGroupingRule).cssRules, selector)
      if (nested) return nested
    }
  }
  return undefined
}

it('creates a canvas-first spatial stage with a single HUD overlay', () => {
  const dom = new JSDOM('<main id="app"></main>')
  const root = dom.window.document.querySelector<HTMLElement>('#app')!
  const shell = createFeasibilityShell(root)

  expect(shell.canvas.dataset.role).toBe('feasibility-canvas')
  expect(shell.hud.dataset.role).toBe('orchard-hud')
  expect(root.children).toHaveLength(2)
  expect(root.firstElementChild).toBe(shell.canvas)
  expect(root.lastElementChild).toBe(shell.hud)
  expect(shell.objective.textContent).toBe('桃园采收任务')
  expect(shell.interactionPrompt.getAttribute('aria-live')).toBe('polite')
  expect(shell.progress.textContent).toBe('采收进度 · 待采摘')
  expect(shell.controls).toBeInstanceOf(dom.window.HTMLDetailsElement)
  expect(shell.controls.open).toBe(false)
  expect(shell.controls.textContent).toContain('WASD 移动 / 驾驶')
  expect(shell.controls.textContent).toContain('Space 制动')
  expect(shell.controls.textContent).toContain('E 交互 / 上下车')
  expect(shell.controls.textContent).toContain('R 恢复')
  expect(shell.debugPanel.dataset.debug).toBe('feasibility')
  expect(shell.debugPanel.textContent).toBe('DEBUG 技术验证场景')
  expect(shell.debugPanel.hidden).toBe(true)
  expect(shell.status.getAttribute('role')).toBe('status')
  expect(shell.status.getAttribute('aria-live')).toBe('polite')
  expect(shell.status.dataset.state).toBe('loading')
  expect(shell.interactionPrompt.parentElement).toBe(shell.controls.parentElement)
  expect(shell.controls.parentElement?.dataset.hudRegion).toBe('bottom-dock')
})

it('presents concise Chinese loading and success status states', async () => {
  const dom = new JSDOM('<main id="app"></main>')
  const root = dom.window.document.querySelector<HTMLElement>('#app')!
  const app = { stop: vi.fn() }
  const createApp = vi.fn(async (shell) => {
    expect(shell.canvas.isConnected).toBe(true)
    expect(shell.hud.isConnected).toBe(true)
    expect(shell.debugPanel.isConnected).toBe(true)
    expect(shell.status.textContent).toBe('正在加载桃园场景…')
    expect(shell.status.dataset.state).toBe('loading')
    return app
  })

  await expect(bootstrapFeasibility(root, createApp)).resolves.toBe(app)
  expect(createApp).toHaveBeenCalledTimes(1)
  const status = root.querySelector<HTMLElement>('[role="status"]')!
  expect(status.textContent).toBe('桃园场景已准备好')
  expect(status.dataset.state).toBe('success')
})

it('presents a readable Chinese error state when the app chunk loader rejects', async () => {
  const dom = new JSDOM('<main id="app"></main>')
  const root = dom.window.document.querySelector<HTMLElement>('#app')!
  const loadFactory = vi.fn(async () => {
    throw new Error('chunk unavailable')
  })

  await expect(
    bootstrapFeasibility(root, undefined, loadFactory),
  ).rejects.toThrow('chunk unavailable')

  expect(loadFactory).toHaveBeenCalledTimes(1)
  const status = root.querySelector<HTMLElement>('[role="status"]')!
  expect(status.textContent).toBe(
    '桃园场景加载失败：chunk unavailable',
  )
  expect(status.dataset.state).toBe('error')
})

it('keeps error status readable and mobile bottom controls in layout flow', () => {
  const css = readFileSync(
    new URL('../../../src/style.css', import.meta.url),
    'utf8',
  )
  const dom = new JSDOM(`<style>${css}</style>`)
  const sheet = dom.window.document.styleSheets.item(0)!
  const success = findStyleRule(
    sheet.cssRules,
    "[data-hud-region='status'][data-state='success']",
  )
  const error = findStyleRule(
    sheet.cssRules,
    "[data-hud-region='status'][data-state='error']",
  )
  const mobile = Array.from(sheet.cssRules).find((rule) => (
    'conditionText' in rule && rule.conditionText === '(max-width: 719px)'
  )) as CSSMediaRule | undefined

  expect(success?.style.getPropertyValue('opacity')).toBe('0.62')
  expect(success?.style.getPropertyValue('font-size')).toBe('0.7rem')
  expect(error?.style.getPropertyValue('color')).toBe('rgb(255, 250, 241)')
  expect(error?.style.getPropertyValue('font-size')).toBe('0.9rem')
  expect(error?.style.getPropertyValue('background')).not.toBe('')
  expect(mobile).toBeDefined()

  const mobileDock = findStyleRule(
    mobile!.cssRules,
    "[data-hud-region='bottom-dock']",
  )
  const mobilePrompt = findStyleRule(
    mobile!.cssRules,
    "[data-hud-region='prompt']",
  )
  expect(mobileDock?.style.getPropertyValue('display')).toBe('flex')
  expect(mobileDock?.style.getPropertyValue('flex-direction')).toBe('column')
  expect(mobilePrompt?.style.getPropertyValue('position')).toBe('static')
})
