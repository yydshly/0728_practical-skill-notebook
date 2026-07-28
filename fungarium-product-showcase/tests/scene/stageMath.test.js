import { shelfXFor, stagePosition } from "../../src/scene/stageMath";

test("centres three shelf entries around the display", () => {
  expect([0, 1, 2].map((index) => shelfXFor(index, 3))).toEqual([-0.78, 0, 0.78]);
});

test("moves a selected entry from shelf to stage on a visible arc", () => {
  expect(stagePosition(0, 0.78)).toEqual([0.78, 1.2, -1.5]);
  expect(stagePosition(1, 0.78)).toEqual([0, 0, -0.5]);
  expect(stagePosition(0.5, 0.78)[1]).toBeGreaterThan(0.6);
});
