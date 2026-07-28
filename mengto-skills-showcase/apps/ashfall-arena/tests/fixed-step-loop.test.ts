import { expect, it } from "vitest";
import { FixedStepAccumulator } from "../src/main-loop";

it("bounds catch-up work and drops hidden-tab time before resuming", () => {
  const accumulator = new FixedStepAccumulator(1 / 60, 5, 0.25);
  let steps = 0;

  expect(accumulator.advance(3, () => steps += 1)).toBe(5);
  expect(steps).toBe(5);
  const diagnostics = accumulator.getDiagnostics();
  expect(diagnostics.queuedSeconds).toBe(0);
  expect(diagnostics.droppedSeconds).toBeCloseTo(1 / 6, 12);

  accumulator.reset();
  expect(accumulator.advance(1 / 60, () => steps += 1)).toBe(1);
  expect(steps).toBe(6);
});
