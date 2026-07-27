import { describe, expect, it, vi } from "vitest";
import { createTimelineNavigation } from "../src/navigation.js";

describe("timeline navigation", () => {
  it("maps a real navigation target to stage progress", () => {
    document.body.innerHTML = `<nav><button data-progress="0.5">信号</button></nav>`;
    const stage = { scrollToProgress: vi.fn() };

    createTimelineNavigation({
      nav: document.querySelector("nav"),
      points: [{ id: "signal", label: "信号", progress: 0.5 }],
      stage,
      reducedMotion: false,
    });
    document.querySelector("button").click();

    expect(stage.scrollToProgress).toHaveBeenCalledWith(0.5, "smooth");
  });

  it("uses immediate scrolling in reduced-motion mode", () => {
    document.body.innerHTML = `<nav><button data-progress="1">航线</button></nav>`;
    const stage = { scrollToProgress: vi.fn() };

    createTimelineNavigation({
      nav: document.querySelector("nav"),
      points: [{ id: "routes", label: "航线", progress: 1 }],
      stage,
      reducedMotion: true,
    });
    document.querySelector("button").click();

    expect(stage.scrollToProgress).toHaveBeenCalledWith(1, "auto");
  });
});
