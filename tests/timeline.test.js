import { describe, expect, it } from "vitest";
import { clamp, lerp, rangeProgress, segmentInOut, smoothstep } from "../src/timeline.js";

describe("timeline math", () => {
  it("clamps values and interpolates a numeric range", () => {
    expect(clamp(-1)).toBe(0);
    expect(clamp(2)).toBe(1);
    expect(lerp(10, 20, 0.25)).toBe(12.5);
  });

  it("normalizes a range with eased endpoints", () => {
    expect(rangeProgress(0.1, 0.2, 0.4)).toBe(0);
    expect(rangeProgress(0.3, 0.2, 0.4)).toBeCloseTo(0.5);
    expect(smoothstep(0.2, 0.4, 0.2)).toBe(0);
    expect(smoothstep(0.2, 0.4, 0.4)).toBe(1);
  });

  it("makes a reversible enter-hold-exit envelope", () => {
    expect(segmentInOut(0.1, 0.2, 0.3, 0.6, 0.7)).toBe(0);
    expect(segmentInOut(0.3, 0.2, 0.3, 0.6, 0.7)).toBe(1);
    expect(segmentInOut(0.5, 0.2, 0.3, 0.6, 0.7)).toBe(1);
    expect(segmentInOut(0.7, 0.2, 0.3, 0.6, 0.7)).toBe(0);
  });

  it("rejects zero-width and inverted ranges", () => {
    expect(() => rangeProgress(0.5, 0.5, 0.5)).toThrow(RangeError);
    expect(() => smoothstep(1, 0, 0.5)).toThrow(RangeError);
  });
});
