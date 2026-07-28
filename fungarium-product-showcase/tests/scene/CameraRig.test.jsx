import { act, render } from "@testing-library/react";
import { PerspectiveCamera, Vector3 } from "three";
import { SHOWCASE_CAMERAS } from "../../src/config/showcaseConfig";
import { CameraRig } from "../../src/components/scene/CameraRig";
import { useShowcaseStore } from "../../src/state/useShowcaseStore";

const frameHarness = vi.hoisted(() => ({
  callback: null,
  controls: null,
}));

vi.mock("@react-three/fiber", () => ({
  useFrame: (callback) => {
    frameHarness.callback = callback;
  },
}));

vi.mock("@react-three/drei", async () => {
  const React = await import("react");

  return {
    OrbitControls: React.forwardRef(function OrbitControlsMock(_, ref) {
      React.useImperativeHandle(ref, () => frameHarness.controls);
      return null;
    }),
  };
});

beforeEach(() => {
  useShowcaseStore.setState({ cameraView: "overview" });
  frameHarness.controls = {
    target: new Vector3(),
    update: vi.fn(),
  };
});

test("hands the camera back to orbit controls after the view transition", () => {
  render(<CameraRig enabled />);

  const camera = new PerspectiveCamera();
  camera.position.set(...SHOWCASE_CAMERAS.overview.position);

  for (let frame = 0; frame < 240; frame += 1) {
    frameHarness.callback({ camera }, 1 / 60);
  }

  camera.position.set(1.4, 1.7, 2.6);
  frameHarness.controls.target.set(0.25, 0.65, -0.2);
  const userPosition = camera.position.toArray();
  const userTarget = frameHarness.controls.target.toArray();

  frameHarness.callback({ camera }, 1 / 60);

  expect(camera.position.toArray()).toEqual(userPosition);
  expect(frameHarness.controls.target.toArray()).toEqual(userTarget);
});

test("starts a new damped transition when cameraView changes", () => {
  render(<CameraRig enabled />);

  const camera = new PerspectiveCamera();
  camera.position.set(...SHOWCASE_CAMERAS.overview.position);

  for (let frame = 0; frame < 240; frame += 1) {
    frameHarness.callback({ camera }, 1 / 60);
  }

  camera.position.set(1.4, 1.7, 2.6);
  frameHarness.controls.target.set(0.25, 0.65, -0.2);

  act(() => {
    useShowcaseStore.getState().setCameraView("interaction");
  });
  frameHarness.callback({ camera }, 1 / 60);

  expect(camera.position.toArray()).not.toEqual([1.4, 1.7, 2.6]);
  expect(frameHarness.controls.target.toArray()).not.toEqual([0.25, 0.65, -0.2]);
});
