import { describe, expect, it, vi } from "vitest";
import { getFrameDelta, runFrameStep } from "../src/scene/create-inspector-scene";

describe("inspector scene frame lifecycle", () => {
  it("initializes from the first RAF timestamp and clamps later deltas", () => {
    expect(getFrameDelta(undefined, 95.964)).toEqual({ delta: 0, timestamp: 95.964 });
    expect(getFrameDelta(149.4, 95.964)).toEqual({ delta: 0, timestamp: 95.964 });
    expect(getFrameDelta(95.964, 500)).toEqual({ delta: 0.05, timestamp: 500 });
  });

  it("reports update and render failures through one fallback boundary", () => {
    const onFailure = vi.fn();
    const updateError = new Error("update failed");
    const renderError = new Error("render failed");

    expect(runFrameStep(() => { throw updateError; }, vi.fn(), onFailure)).toBe(false);
    expect(onFailure).toHaveBeenLastCalledWith(updateError);

    expect(runFrameStep(vi.fn(), () => { throw renderError; }, onFailure)).toBe(false);
    expect(onFailure).toHaveBeenLastCalledWith(renderError);
  });
});
