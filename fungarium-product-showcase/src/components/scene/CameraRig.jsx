import { useRef } from "react";
import { OrbitControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { MathUtils } from "three";
import { SHOWCASE_CAMERAS } from "../../config/showcaseConfig";
import { useShowcaseStore } from "../../state/useShowcaseStore";

export function CameraRig({ enabled }) {
  const controlsRef = useRef();
  const transitionRef = useRef({ active: true, view: null });
  const cameraView = useShowcaseStore((state) => state.cameraView);

  useFrame(({ camera }, delta) => {
    const controls = controlsRef.current;
    const pose = SHOWCASE_CAMERAS[cameraView] ?? SHOWCASE_CAMERAS.overview;
    const transition = transitionRef.current;

    if (transition.view !== cameraView) {
      transition.view = cameraView;
      transition.active = true;
    }

    if (!transition.active) return;

    camera.position.set(
      MathUtils.damp(camera.position.x, pose.position[0], 4, delta),
      MathUtils.damp(camera.position.y, pose.position[1], 4, delta),
      MathUtils.damp(camera.position.z, pose.position[2], 4, delta),
    );

    if (controls) {
      controls.target.set(
        MathUtils.damp(controls.target.x, pose.target[0], 4, delta),
        MathUtils.damp(controls.target.y, pose.target[1], 4, delta),
        MathUtils.damp(controls.target.z, pose.target[2], 4, delta),
      );
      controls.update();
    } else {
      camera.lookAt(...pose.target);
    }

    const positionDistance =
      (camera.position.x - pose.position[0]) ** 2 +
      (camera.position.y - pose.position[1]) ** 2 +
      (camera.position.z - pose.position[2]) ** 2;
    const targetDistance = controls
      ? (controls.target.x - pose.target[0]) ** 2 +
        (controls.target.y - pose.target[1]) ** 2 +
        (controls.target.z - pose.target[2]) ** 2
      : Infinity;

    if (positionDistance < 0.000001 && targetDistance < 0.000001) {
      camera.position.set(...pose.position);
      controls.target.set(...pose.target);
      controls.update();
      transition.active = false;
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enabled={enabled}
      enableDamping
      dampingFactor={0.08}
      enablePan={false}
      minDistance={1.35}
      maxDistance={4.5}
      minPolarAngle={0.55}
      maxPolarAngle={1.45}
    />
  );
}
