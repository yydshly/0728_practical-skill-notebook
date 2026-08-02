import type { FixedStepRunner } from '../physics/FixedStepRunner'

interface RuntimeLoopInput {
  start(): void
  stop(): void
  fixedStep(fixedSeconds: number): void
}

export interface FixedStepRuntimeLoopDependencies {
  readonly runner: FixedStepRunner
  readonly fixedSeconds: number
  readonly input: RuntimeLoopInput
  readonly simulate: () => void
  readonly interpolate: (alpha: number) => void
  readonly updateCamera: (frameSeconds: number) => void
  readonly render: () => void
  readonly requestFrame: (callback: FrameRequestCallback) => number
  readonly cancelFrame: (handle: number) => void
}

export class FixedStepRuntimeLoop {
  private running = false
  private frameHandle: number | undefined
  private previousTimestampMs: number | undefined

  private readonly onFrame = (timestampMs: number): void => {
    if (!this.running) return
    const frameSeconds = this.previousTimestampMs === undefined
      ? 0
      : Math.max(0, (timestampMs - this.previousTimestampMs) / 1000)
    this.previousTimestampMs = timestampMs
    const result = this.dependencies.runner.advance(frameSeconds, () => {
      this.dependencies.input.fixedStep(this.dependencies.fixedSeconds)
      this.dependencies.simulate()
    })
    this.dependencies.interpolate(result.alpha)
    this.dependencies.updateCamera(frameSeconds)
    this.dependencies.render()
    if (this.running) {
      this.frameHandle = this.dependencies.requestFrame(this.onFrame)
    }
  }

  constructor(
    private readonly dependencies: FixedStepRuntimeLoopDependencies,
  ) {}

  start(): void {
    if (this.running) return
    this.running = true
    this.previousTimestampMs = undefined
    this.dependencies.input.start()
    this.frameHandle = this.dependencies.requestFrame(this.onFrame)
  }

  stop(): void {
    if (!this.running) return
    this.running = false
    this.previousTimestampMs = undefined
    if (this.frameHandle !== undefined) {
      this.dependencies.cancelFrame(this.frameHandle)
      this.frameHandle = undefined
    }
    this.dependencies.input.stop()
  }
}
