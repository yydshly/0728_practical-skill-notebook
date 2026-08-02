import type { FeasibilityShell } from '../createFeasibilityShell'
import type { JobState, OwnerId } from '../domain/types'
import type { ContextualAction } from '../interaction/ContextualActionResolver'

const OBJECTIVE_COPY: Record<JobState, string> = {
  idle: '前往任务牌，接受桃园采收任务',
  accepted: '准备三轮车，前往桃园',
  preparing: '上车，前往桃园',
  'en-route-to-orchard': '驾驶三轮车前往桃园',
  'parked-at-orchard': '进入桃园，采摘成熟桃子',
  picking: '完成桃子装箱并装载',
  'vehicle-loaded': '上车，将桃子运回交付点',
  returning: '将桃子运回交付点',
  delivered: '本次桃园运输已完成',
}

const ACTION_COPY: Record<ContextualAction, string> = {
  'accept-job': 'E  接受桃园采收任务',
  'enter-vehicle': 'E  上车',
  'park-and-exit': 'E  停车并下车',
  'exit-vehicle': 'E  下车',
  pick: 'E  采摘',
  'place-in-basket': 'E  放入果篮',
  'pack-crate': 'E  装箱',
  'load-crate': 'E  装载到三轮车',
  deliver: 'E  交付',
}

const PROGRESS_COPY: Record<OwnerId, string> = {
  tree: '待采摘',
  player: '手持桃子',
  basket: '果篮',
  crate: '已装箱',
  vehicle: '运输中',
  delivered: '已交付',
}

export interface OrchardHudSnapshot {
  readonly jobState: JobState
  readonly fruitOwner: OwnerId
  readonly action: ContextualAction | null
  readonly debugEnabled: boolean
}

export class OrchardHudPresenter {
  constructor(private readonly shell: FeasibilityShell) {}

  update(snapshot: OrchardHudSnapshot): void {
    this.shell.objective.textContent = OBJECTIVE_COPY[snapshot.jobState]
    this.shell.progress.textContent = (
      `采收进度 · ${PROGRESS_COPY[snapshot.fruitOwner]}`
    )
    this.shell.interactionPrompt.textContent = snapshot.action
      ? ACTION_COPY[snapshot.action]
      : ''
    this.shell.interactionPrompt.hidden = snapshot.action === null
    this.shell.debugPanel.hidden = !snapshot.debugEnabled
  }
}
