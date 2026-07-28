import { useShowcaseStore } from "../../src/state/useShowcaseStore";

test("changes selection without resetting the current camera", () => {
  useShowcaseStore.setState({ selectedIndex: 0, cameraView: "case", turnNonce: 0 });
  useShowcaseStore.getState().selectIndex(2);
  expect(useShowcaseStore.getState()).toMatchObject({ selectedIndex: 2, cameraView: "case", turnNonce: 1 });
});
