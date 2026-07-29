export interface FixedStepDiagnostics {
  queuedSeconds: number;
  droppedSeconds: number;
}

export class FixedStepAccumulator {
  private queuedSeconds = 0;
  private droppedSeconds = 0;

  constructor(
    private readonly fixedDelta = 1 / 60,
    private readonly maximumSteps = 5,
    private readonly maximumFrameDelta = 0.25,
  ) {
    if (fixedDelta <= 0 || maximumSteps < 1 || maximumFrameDelta <= 0) {
      throw new RangeError("Fixed step options must be positive");
    }
  }

  advance(frameDelta: number, step: (fixedDelta: number) => void): number {
    const safeFrameDelta = Number.isFinite(frameDelta)
      ? Math.max(0, Math.min(this.maximumFrameDelta, frameDelta))
      : 0;
    this.queuedSeconds += safeFrameDelta;
    let count = 0;
    while (
      this.queuedSeconds + Number.EPSILON >= this.fixedDelta &&
      count < this.maximumSteps
    ) {
      step(this.fixedDelta);
      this.queuedSeconds -= this.fixedDelta;
      count += 1;
    }
    if (count === this.maximumSteps && this.queuedSeconds >= this.fixedDelta) {
      this.droppedSeconds += this.queuedSeconds;
      this.queuedSeconds = 0;
    }
    if (Math.abs(this.queuedSeconds) < 1e-10) this.queuedSeconds = 0;
    return count;
  }

  reset(): void {
    this.queuedSeconds = 0;
  }

  getDiagnostics(): FixedStepDiagnostics {
    return {
      queuedSeconds: this.queuedSeconds,
      droppedSeconds: this.droppedSeconds,
    };
  }
}
