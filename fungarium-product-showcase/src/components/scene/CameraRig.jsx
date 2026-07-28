import { useRef } from "react";
import { OrbitControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { MathUtils } from "three";
import { SHOWCASE_CAMERAS } from "../../config/showcaseConfig";
import { useShowcaseStore } from "../../state/useShowcaseStore";

export function CameraRig({ enabled }) {
  const controlsRef = useRef();
  const cameraView = useShowcaseStore((state) => state.cameraView);

  useFrame(({ camera }, delta) => {
    const controls = controlsRef.current;
    const pose = SHOWCASE_CAMERAS[cameraView] ?? SHOWCASE_CAMERAS.overview;

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
