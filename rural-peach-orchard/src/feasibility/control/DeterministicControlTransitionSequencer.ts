import type {
  ControlState,
  ControlTransition,
  ControlTransitionCode,
} from './ControlAuthority'
import type { ControlTransitionEvent } from './ControlTransitionEvent'

export interface DeterministicControlTransitionDependencies {
  readonly getState: () => ControlState
  readonly completeTransition: (
    event: ControlTransitionEvent,
  ) => ControlTransition
}

export class ControlTransitionSequenceError extends Error {
  readonly code = 'CONTROL_TRANSITION_SEQUENCE_FAILED' as const

  constructor(
    readonly event: ControlTransitionEvent,
    readonly transitionCode: ControlTransitionCode,
  ) {
    super(`CONTROL_TRANSITION_SEQUENCE_FAILED:${event}:${transitionCode}`)
    this.name = 'ControlTransitionSequenceError'
  }
}

function eventsForState(
  state: ControlState,
): readonly ControlTransitionEvent[] {
  return state === 'entering'
    ? ['enter-started', 'seated']
    : state === 'exiting'
      ? ['exit-started', 'exit-placed', 'exit-complete']
      : []
}

export class DeterministicControlTransitionSequencer {
  private observedState: ControlState
  private activeEvents: readonly ControlTransitionEvent[] = []
  private nextEventIndex = 0
  private terminalErrorValue: ControlTransitionSequenceError | null = null

  constructor(
    private readonly dependencies: DeterministicControlTransitionDependencies,
  ) {
    this.observedState = dependencies.getState()
  }

  get terminalError(): ControlTransitionSequenceError | null {
    return this.terminalErrorValue
  }

  fixedStep(): void {
    if (this.terminalErrorValue) throw this.terminalErrorValue
    const state = this.dependencies.getState()
    if (state !== this.observedState) {
      this.observedState = state
      this.activeEvents = eventsForState(state)
      this.nextEventIndex = 0
      return
    }

    if (this.activeEvents.length === 0) {
      this.activeEvents = eventsForState(state)
      this.nextEventIndex = 0
      if (this.activeEvents.length > 0) return
    }
    while (this.nextEventIndex < this.activeEvents.length) {
      const event = this.activeEvents[this.nextEventIndex]!
      const result = this.dependencies.completeTransition(event)
      if (!result.ok) {
        const error = new ControlTransitionSequenceError(event, result.code)
        this.terminalErrorValue = error
        throw error
      }
      this.nextEventIndex += 1
    }
  }
}
