import { describe, expect, it } from "vitest";
import { createPerformanceSampler } from "../src/review/create-performance-sampler";

describe("review performance sampler", () => {
  it("keeps a bounded real frame window and reports deterministic percentiles", () => {
    const sampler = createPerformanceSampler(4);
    for (const frameMs of [5, 10, 20, 40, 80]) {
      sampler.recordFrame(frameMs);
    }

    expect(sampler.getFrameSnapshot()).toEqual({
      sampleCount: 4,
      averageMs: 37.5,
      medianMs: 30,
      p95Ms: 80,
      maxMs: 80,
    });
  });

  it("reset and invalid deltas never fabricate samples", () => {
    const sampler = createPerformanceSampler();
    sampler.recordFrame(16);
    sampler.reset();
    sampler.recordFrame(0);
    sampler.recordFrame(-1);
    sampler.recordFrame(Number.NaN);

    expect(sampler.getFrameSnapshot()).toEqual({
      sampleCount: 0,
      averageMs: 0,
      medianMs: 0,
      p95Ms: 0,
      maxMs: 0,
    });
  });
});
