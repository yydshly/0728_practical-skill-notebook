export interface StepResult {
  steps: number
  alpha: number
  droppedSeconds: number
}

export class FixedStepRunner {
  private accumulator = 0

  constructor(
    private readonly fixedSeconds: number,
    private readonly maxFrameSeconds: number,
  ) {}

  advance(frameSeconds: number, step: () => void): StepResult {
    const accepted = Math.min(
      Math.max(frameSeconds, 0),
      this.maxFrameSeconds,
    )
    const droppedSeconds = Math.max(0, frameSeconds - accepted)
    this.accumulator += accepted

    let steps = 0
    while (this.accumulator + Number.EPSILON >= this.fixedSeconds) {
      step()
      this.accumulator -= this.fixedSeconds
      steps += 1
    }

    return {
      steps,
      alpha: this.accumulator / this.fixedSeconds,
      droppedSeconds,
    }
  }
}
