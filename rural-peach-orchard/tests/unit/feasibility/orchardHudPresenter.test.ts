import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'
import type { JobState, OwnerId } from '../../../src/feasibility/domain/types'
import type { ContextualAction } from '../../../src/feasibility/interaction/ContextualActionResolver'
import { OrchardHudPresenter } from '../../../src/feasibility/presentation/OrchardHudPresenter'
import { createFeasibilityShell } from '../../../src/feasibility/createFeasibilityShell'

function createHud() {
  const dom = new JSDOM('<main id="app"></main>')
  const root = dom.window.document.querySelector<HTMLElement>('#app')!
  const shell = createFeasibilityShell(root)
  return { root, shell, hud: new OrchardHudPresenter(shell) }
}

describe('OrchardHudPresenter', () => {
  it('derives concise Chinese objective and prompt from runtime state', () => {
    const { shell, hud } = createHud()

    hud.update({
      jobState: 'parked-at-orchard',
      fruitOwner: 'tree',
      action: 'pick',
      debugEnabled: false,
    })

    expect(shell.objective.textContent).toBe('进入桃园，采摘成熟桃子')
    expect(shell.interactionPrompt.textContent).toBe('E  采摘')
    expect(shell.debugPanel.hidden).toBe(true)
  })

  it('shows delivery completion and keeps technical telemetry debug-only', () => {
    const { shell, hud } = createHud()

    hud.update({
      jobState: 'delivered',
      fruitOwner: 'delivered',
      action: null,
      debugEnabled: true,
    })

    expect(shell.objective.textContent).toBe('本次桃园运输已完成')
    expect(shell.progress.textContent).toContain('已交付')
    expect(shell.interactionPrompt.hidden).toBe(true)
    expect(shell.debugPanel.hidden).toBe(false)
  })

  it.each<[JobState, string]>([
    ['idle', '前往任务牌，接受桃园采收任务'],
    ['accepted', '准备三轮车，前往桃园'],
    ['preparing', '上车，前往桃园'],
    ['en-route-to-orchard', '驾驶三轮车前往桃园'],
    ['parked-at-orchard', '进入桃园，采摘成熟桃子'],
    ['picking', '完成桃子装箱并装载'],
    ['vehicle-loaded', '上车，将桃子运回交付点'],
    ['returning', '将桃子运回交付点'],
    ['delivered', '本次桃园运输已完成'],
  ])('maps the %s job state to its objective', (jobState, objective) => {
    const { shell, hud } = createHud()

    hud.update({
      jobState,
      fruitOwner: 'tree',
      action: null,
      debugEnabled: false,
    })

    expect(shell.objective.textContent).toBe(objective)
  })

  it.each<[ContextualAction, string]>([
    ['accept-job', 'E  接受桃园采收任务'],
    ['enter-vehicle', 'E  上车'],
    ['park-and-exit', 'E  停车并下车'],
    ['exit-vehicle', 'E  下车'],
    ['pick', 'E  采摘'],
    ['place-in-basket', 'E  放入果篮'],
    ['pack-crate', 'E  装箱'],
    ['load-crate', 'E  装载到三轮车'],
    ['deliver', 'E  交付'],
  ])('maps the %s action to its interaction prompt', (action, prompt) => {
    const { shell, hud } = createHud()

    hud.update({
      jobState: 'picking',
      fruitOwner: 'player',
      action,
      debugEnabled: false,
    })

    expect(shell.interactionPrompt.textContent).toBe(prompt)
    expect(shell.interactionPrompt.hidden).toBe(false)
  })

  it.each<[OwnerId, string]>([
    ['tree', '待采摘'],
    ['player', '手持桃子'],
    ['basket', '果篮'],
    ['crate', '已装箱'],
    ['vehicle', '运输中'],
    ['delivered', '已交付'],
  ])('derives %s cargo progress only from fruit ownership', (fruitOwner, progress) => {
    const { shell, hud } = createHud()

    hud.update({
      jobState: 'picking',
      fruitOwner,
      action: null,
      debugEnabled: false,
    })

    expect(shell.progress.textContent).toBe(`采收进度 · ${progress}`)
  })
})
