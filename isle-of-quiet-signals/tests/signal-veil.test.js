import { describe, expect, it } from "vitest";
import { createSignalVeil } from "../src/signal-veil.js";

function createCanvas() {
  const canvas = document.createElement("canvas");
  canvas.getBoundingClientRect = () => ({ width: 640, height: 480, left: 0, top: 0 });
  canvas.getContext = () => ({
    clearRect() {},
    setTransform() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    fillText() {},
  });
  return canvas;
}

describe("signal veil", () => {
  it("only becomes visible inside its configured signal range", () => {
    const veil = createSignalVeil({
      canvas: createCanvas(),
      lines: ["... --- ...", "N 31 DEG"],
      range: { start: 0.5, peakStart: 0.54, peakEnd: 0.64, end: 0.69 },
      reducedMotion: false,
    });

    veil.setProgress(0.4);
    expect(veil.getOpacity()).toBe(0);

    veil.setProgress(0.58);
    expect(veil.getOpacity()).toBeGreaterThan(0.9);

    veil.setProgress(0.72);
    expect(veil.getOpacity()).toBe(0);
    veil.destroy();
  });

  it("stays hidden when reduced motion is requested", () => {
    const veil = createSignalVeil({
      canvas: createCanvas(),
      lines: ["... --- ..."],
      range: { start: 0.5, peakStart: 0.54, peakEnd: 0.64, end: 0.69 },
      reducedMotion: true,
    });

    veil.setProgress(0.58);
    expect(veil.getOpacity()).toBe(0);
    veil.destroy();
  });
});
