export interface FramePerformanceSnapshot {
  sampleCount: number;
  averageMs: number;
  medianMs: number;
  p95Ms: number;
  maxMs: number;
}

export interface PerformanceSampler {
  recordFrame(frameMs: number): void;
  reset(): void;
  getFrameSnapshot(): FramePerformanceSnapshot;
}

const round = (value: number): number =>
  Math.round(value * 100) / 100;

const percentile = (
  sorted: readonly number[],
  ratio: number,
): number => {
  if (sorted.length === 0) return 0;
  const index = Math.max(
    0,
    Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1),
  );
  return sorted[index]!;
};

const median = (sorted: readonly number[]): number => {
  if (sorted.length === 0) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
};

export function createPerformanceSampler(
  maximumSamples = 240,
): PerformanceSampler {
  if (!Number.isInteger(maximumSamples) || maximumSamples <= 0) {
    throw new RangeError("maximumSamples must be a positive integer");
  }
  const frames: number[] = [];

  return {
    recordFrame(frameMs) {
      if (!Number.isFinite(frameMs) || frameMs <= 0) return;
      frames.push(frameMs);
      if (frames.length > maximumSamples) {
        frames.splice(0, frames.length - maximumSamples);
      }
    },
    reset() {
      frames.length = 0;
    },
    getFrameSnapshot() {
      if (frames.length === 0) {
        return {
          sampleCount: 0,
          averageMs: 0,
          medianMs: 0,
          p95Ms: 0,
          maxMs: 0,
        };
      }
      const sorted = [...frames].sort((left, right) => left - right);
      return {
        sampleCount: frames.length,
        averageMs: round(
          frames.reduce((total, value) => total + value, 0) /
            frames.length,
        ),
        medianMs: round(median(sorted)),
        p95Ms: round(percentile(sorted, 0.95)),
        maxMs: round(sorted[sorted.length - 1]!),
      };
    },
  };
}
