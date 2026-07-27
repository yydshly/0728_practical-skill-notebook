import { describe, expect, it } from "vitest";
import { waitForCriticalImages } from "../src/assets.js";
import { calculateLocalProgress, deriveSceneFrame } from "../src/stage.js";

describe("asset readiness", () => {
  it("settles immediately when the stage has no critical images", async () => {
    const root = document.createElement("div");

    await expect(waitForCriticalImages(root)).resolves.toEqual({ failed: [] });
  });
});

describe("stage calculations", () => {
  it("calculates clamped local progress", () => {
    expect(calculateLocalProgress({ scrollY: 100, sectionTop: 100, travel: 1000 })).toBe(0);
    expect(calculateLocalProgress({ scrollY: 600, sectionTop: 100, travel: 1000 })).toBe(0.5);
    expect(calculateLocalProgress({ scrollY: 1500, sectionTop: 100, travel: 1000 })).toBe(1);
  });

  it("derives the same frame for the same progress and pointer", () => {
    const first = deriveSceneFrame(0.58, { x: 0.25, y: -0.5 });
    const second = deriveSceneFrame(0.58, { x: 0.25, y: -0.5 });

    expect(second).toEqual(first);
    expect(first.storyAOpacity).toBe(0);
    expect(first.storyBOpacity).toBeGreaterThan(0.9);
  });
});
