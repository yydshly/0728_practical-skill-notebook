import { describe, expect, it } from "vitest";
import { waitForCriticalImages } from "../src/assets.js";
import { calculateLocalProgress, deriveSceneFrame } from "../src/stage.js";

describe("asset readiness", () => {
  it("settles immediately when the stage has no critical images", async () => {
    const root = document.createElement("div");

    await expect(waitForCriticalImages(root)).resolves.toEqual({ failed: [] });
  });

  it("marks a critical image as failed when it cannot be decoded", async () => {
    const root = document.createElement("div");
    const image = document.createElement("img");
    image.dataset.critical = "";
    Object.defineProperty(image, "complete", { value: false });
    root.append(image);

    const ready = waitForCriticalImages(root);
    image.dispatchEvent(new Event("error"));

    await expect(ready).resolves.toEqual({ failed: [image] });
    expect(image.dataset.failed).toBe("true");
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
    expect(first.archiveInteractive).toBe(false);
  });

  it("only exposes archive controls after the archive begins entering", () => {
    expect(deriveSceneFrame(0.75).archiveInteractive).toBe(false);
    expect(deriveSceneFrame(0.9).archiveInteractive).toBe(true);
  });
});
