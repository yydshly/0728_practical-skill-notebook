import { expect, it } from "vitest";
import { normalizeInput } from "../src/index";

it("clamps movement while preserving action edges", () => {
  expect(normalizeInput({
    moveX: 2,
    moveY: -2,
    attackPressed: true,
    guardHeld: false,
    dodgePressed: false,
    lockPressed: false,
  })).toMatchObject({ moveX: 1, moveY: -1, attackPressed: true });
});

it("keeps an in-range intent unchanged", () => {
  const snapshot = {
    moveX: 0.5,
    moveY: 0,
    attackPressed: false,
    guardHeld: true,
    dodgePressed: true,
    lockPressed: true,
  };
  expect(normalizeInput(snapshot)).toEqual(snapshot);
});
