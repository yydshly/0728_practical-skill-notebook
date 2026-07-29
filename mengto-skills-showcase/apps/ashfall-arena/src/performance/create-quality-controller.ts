export type QualityTier = "low" | "medium" | "high";
export type QualityMode = "auto" | QualityTier;

export interface QualityDiagnostics {
  mode: QualityMode;
  tier: QualityTier;
  reason: "initial" | "user-fixed" | "sustained-slow-frame";
  transitionCount: number;
  sampleCount: number;
  lastWindowMedianMs: number;
  lastWindowP95Ms: number;
  transitions: Array<{
    from: QualityTier;
    to: QualityTier;
    medianMs: number;
    p95Ms: number;
  }>;
}

export interface QualityController {
  recordFrame(frameMs: number): boolean;
  getDiagnostics(): QualityDiagnostics;
}

interface QualityControllerOptions {
  sampleWindow?: number;
  medianBudgetMs?: number;
  p95BudgetMs?: number;
}

const percentile = (
  sorted: readonly number[],
  ratio: number,
): number =>
  sorted[
    Math.min(
      sorted.length - 1,
      Math.max(0, Math.ceil(sorted.length * ratio) - 1),
    )
  ]!;

const median = (sorted: readonly number[]): number => {
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
};

export function createQualityController(
  mode: QualityMode,
  options: QualityControllerOptions = {},
): QualityController {
  const sampleWindow = options.sampleWindow ?? 45;
  const medianBudgetMs = options.medianBudgetMs ?? 24;
  const p95BudgetMs = options.p95BudgetMs ?? 34;
  if (!Number.isInteger(sampleWindow) || sampleWindow < 3) {
    throw new RangeError("quality sampleWindow must be an integer >= 3");
  }

  let tier: QualityTier = mode === "auto" ? "high" : mode;
  let reason: QualityDiagnostics["reason"] =
    mode === "auto" ? "initial" : "user-fixed";
  let transitionCount = 0;
  let lastWindowMedianMs = 0;
  let lastWindowP95Ms = 0;
  const frames: number[] = [];
  const transitions: QualityDiagnostics["transitions"] = [];

  return {
    recordFrame(frameMs) {
      if (
        mode !== "auto" ||
        tier === "low" ||
        !Number.isFinite(frameMs) ||
        frameMs <= 0 ||
        frameMs > 250
      ) {
        return false;
      }
      frames.push(frameMs);
      if (frames.length < sampleWindow) return false;

      const sorted = [...frames].sort((left, right) => left - right);
      frames.length = 0;
      lastWindowMedianMs = median(sorted);
      lastWindowP95Ms = percentile(sorted, 0.95);
      if (
        lastWindowMedianMs <= medianBudgetMs &&
        lastWindowP95Ms <= p95BudgetMs
      ) {
        return false;
      }

      const from = tier;
      tier = tier === "high" ? "medium" : "low";
      transitions.push({
        from,
        to: tier,
        medianMs: lastWindowMedianMs,
        p95Ms: lastWindowP95Ms,
      });
      reason = "sustained-slow-frame";
      transitionCount += 1;
      return true;
    },
    getDiagnostics() {
      return {
        mode,
        tier,
        reason,
        transitionCount,
        sampleCount: frames.length,
        lastWindowMedianMs,
        lastWindowP95Ms,
        transitions: transitions.map((transition) => ({
          ...transition,
        })),
      };
    },
  };
}
