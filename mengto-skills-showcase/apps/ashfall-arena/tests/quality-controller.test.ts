import { describe, expect, it } from "vitest";
import { createQualityController } from "../src/performance/create-quality-controller";

describe("adaptive render quality", () => {
  it("degrades one tier only after a sustained slow window and never oscillates", () => {
    const quality = createQualityController("auto", {
      sampleWindow: 4,
      medianBudgetMs: 24,
      p95BudgetMs: 34,
    });

    for (const frameMs of [40, 41, 39]) {
      quality.recordFrame(frameMs);
    }
    expect(quality.getDiagnostics().tier).toBe("high");

    quality.recordFrame(42);
    expect(quality.getDiagnostics()).toMatchObject({
      mode: "auto",
      tier: "medium",
      transitionCount: 1,
      reason: "sustained-slow-frame",
      transitions: [
        {
          from: "high",
          to: "medium",
          medianMs: 40.5,
          p95Ms: 42,
        },
      ],
    });

    for (const frameMs of [16, 17, 16, 17, 16, 17, 16, 17]) {
      quality.recordFrame(frameMs);
    }
    expect(quality.getDiagnostics()).toMatchObject({
      tier: "medium",
      transitionCount: 1,
    });

    for (const frameMs of [45, 46, 44, 47]) {
      quality.recordFrame(frameMs);
    }
    expect(quality.getDiagnostics()).toMatchObject({
      tier: "low",
      transitionCount: 2,
      transitions: [
        { from: "high", to: "medium" },
        { from: "medium", to: "low" },
      ],
    });
  });

  it.each(["low", "medium", "high"] as const)(
    "keeps an explicit %s preference fixed",
    (tier) => {
      const quality = createQualityController(tier, {
        sampleWindow: 3,
      });
      for (let index = 0; index < 20; index += 1) {
        quality.recordFrame(60);
      }

      expect(quality.getDiagnostics()).toMatchObject({
        mode: tier,
        tier,
        transitionCount: 0,
        reason: "user-fixed",
      });
    },
  );

  it("ignores invalid and background-sized deltas", () => {
    const quality = createQualityController("auto", {
      sampleWindow: 3,
    });
    for (const frameMs of [0, -1, Number.NaN, 500, 600]) {
      quality.recordFrame(frameMs);
    }

    expect(quality.getDiagnostics()).toMatchObject({
      tier: "high",
      sampleCount: 0,
      transitionCount: 0,
    });
  });
});
