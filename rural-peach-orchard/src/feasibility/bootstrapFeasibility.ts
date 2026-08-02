import type { FeasibilityApp } from './createFeasibilityApp'
import {
  createFeasibilityShell,
  type FeasibilityShell,
} from './createFeasibilityShell'

export type FeasibilityAppFactory = (
  shell: FeasibilityShell,
) => Promise<FeasibilityApp>

export type FeasibilityAppFactoryLoader = () => Promise<
  FeasibilityAppFactory
>

const loadDefaultFactory: FeasibilityAppFactoryLoader = async () => (
  await import('./createFeasibilityApp')
).createFeasibilityApp

export async function bootstrapFeasibility(
  root: HTMLElement,
  createApp?: FeasibilityAppFactory,
  loadFactory: FeasibilityAppFactoryLoader = loadDefaultFactory,
): Promise<FeasibilityApp> {
  const shell = createFeasibilityShell(root)
  shell.status.dataset.state = 'loading'
  shell.status.textContent = '正在加载桃园场景…'
  let app: FeasibilityApp | undefined
  try {
    const factory = createApp ?? await loadFactory()
    app = await factory(shell)
    shell.status.dataset.state = 'success'
    shell.status.textContent = '桃园场景已准备好'
    return app
  } catch (error) {
    app?.stop()
    shell.status.dataset.state = 'error'
    shell.status.textContent = error instanceof Error
      ? `桃园场景加载失败：${error.message}`
      : '桃园场景加载失败：未知错误'
    throw error
  }
}
