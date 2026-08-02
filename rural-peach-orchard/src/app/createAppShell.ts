export function createAppShell(root: HTMLElement) {
  const canvas = document.createElement('canvas')
  canvas.dataset.role = 'review-canvas'

  const status = document.createElement('p')
  status.setAttribute('role', 'status')
  status.textContent = '正在读取资产清单'

  const selector = document.createElement('select')
  selector.setAttribute('aria-label', '选择 3D 资产')

  root.replaceChildren(canvas, selector, status)
  return { canvas, status, selector }
}
