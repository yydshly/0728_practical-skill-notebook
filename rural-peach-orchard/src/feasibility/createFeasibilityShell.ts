export interface FeasibilityShell {
  canvas: HTMLCanvasElement
  hud: HTMLElement
  objective: HTMLHeadingElement
  interactionPrompt: HTMLParagraphElement
  progress: HTMLParagraphElement
  controls: HTMLDetailsElement
  status: HTMLParagraphElement
  debugPanel: HTMLElement
}

export function createFeasibilityShell(root: HTMLElement): FeasibilityShell {
  const document = root.ownerDocument
  root.classList.add('feasibility-stage')
  const canvas = document.createElement('canvas')
  canvas.dataset.role = 'feasibility-canvas'

  const hud = document.createElement('div')
  hud.dataset.role = 'orchard-hud'

  const objectivePanel = document.createElement('section')
  objectivePanel.dataset.hudRegion = 'objective'
  objectivePanel.setAttribute('aria-label', '当前任务')
  const objectiveEyebrow = document.createElement('p')
  objectiveEyebrow.textContent = '当前任务'
  const objective = document.createElement('h1')
  objective.textContent = '桃园采收任务'
  objectivePanel.append(objectiveEyebrow, objective)

  const progressPanel = document.createElement('section')
  progressPanel.dataset.hudRegion = 'progress'
  progressPanel.setAttribute('aria-label', '采收进度')
  const progress = document.createElement('p')
  progress.textContent = '采收进度 · 待采摘'
  progressPanel.append(progress)

  const interactionPrompt = document.createElement('p')
  interactionPrompt.dataset.hudRegion = 'prompt'
  interactionPrompt.setAttribute('aria-live', 'polite')
  interactionPrompt.hidden = true

  const controls = document.createElement('details')
  controls.dataset.hudRegion = 'controls'
  const controlsSummary = document.createElement('summary')
  controlsSummary.textContent = '操作说明'
  const controlsList = document.createElement('ul')
  for (const copy of [
    'WASD 移动 / 驾驶',
    'Space 制动',
    'E 交互 / 上下车',
    'R 恢复',
  ]) {
    const item = document.createElement('li')
    item.textContent = copy
    controlsList.append(item)
  }
  controls.append(controlsSummary, controlsList)

  const bottomDock = document.createElement('div')
  bottomDock.dataset.hudRegion = 'bottom-dock'
  bottomDock.append(interactionPrompt, controls)

  const status = document.createElement('p')
  status.dataset.hudRegion = 'status'
  status.dataset.state = 'loading'
  status.setAttribute('role', 'status')
  status.setAttribute('aria-live', 'polite')
  status.textContent = '正在准备桃园场景…'

  const debugPanel = document.createElement('aside')
  debugPanel.dataset.debug = 'feasibility'
  debugPanel.textContent = 'DEBUG 技术验证场景'
  debugPanel.hidden = true

  hud.append(
    objectivePanel,
    progressPanel,
    bottomDock,
    status,
    debugPanel,
  )
  root.replaceChildren(canvas, hud)
  return {
    canvas,
    hud,
    objective,
    interactionPrompt,
    progress,
    controls,
    status,
    debugPanel,
  }
}
