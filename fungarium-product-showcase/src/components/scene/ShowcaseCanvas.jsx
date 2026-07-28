import { useCallback, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { WebGLRenderer } from "three";
import { SHOWCASE_CAMERAS } from "../../config/showcaseConfig";
import { useShowcaseStore } from "../../state/useShowcaseStore";
import { CameraRig } from "./CameraRig";
import { CapabilityStage } from "./CapabilityStage";
import { ShelfCapabilities } from "./ShelfCapabilities";
import { ShowroomEnvironment } from "./ShowroomEnvironment";

const createRenderer = async (props) => {
  const options = {
    ...props,
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  };

  if (typeof navigator !== "undefined" && navigator.gpu) {
    try {
      const { WebGPURenderer } = await import("three/webgpu");
      const renderer = new WebGPURenderer(options);
      await renderer.init();
      if (renderer.backend?.isWebGPUBackend === true) {
        renderer.__showcaseRenderer = "webgpu";
        return renderer;
      }
      renderer.dispose();
    } catch {
      // Fall through to the capture-compatible WebGL renderer.
    }
  }

  const renderer = new WebGLRenderer(options);
  renderer.__showcaseRenderer = "webgl";
  return renderer;
};

export function ShowcaseCanvas() {
  const [artifactGrabbed, setArtifactGrabbed] = useState(false);
  const setRenderer = useShowcaseStore((state) => state.setRenderer);
  const setInitialSceneReady = useShowcaseStore(
    (state) => state.setInitialSceneReady,
  );
  const overview = SHOWCASE_CAMERAS.overview;
  const handleGrabChange = useCallback((grabbed) => {
    setArtifactGrabbed(grabbed);
  }, []);

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      gl={createRenderer}
      camera={{
        position: overview.position,
        fov: 38,
        near: 0.1,
        far: 30,
      }}
      onCreated={({ gl }) => {
        const rendererName =
          gl.__showcaseRenderer ??
          (gl.isWebGPURenderer ? "webgpu" : "webgl");
        document.documentElement.dataset.renderer = rendererName;
        setRenderer(gl);
        setInitialSceneReady();
      }}
      style={{ width: "100%", height: "100%" }}
    >
      <ShowroomEnvironment />
      <ShelfCapabilities />
      <CapabilityStage onGrabChange={handleGrabChange} />
      <CameraRig enabled={!artifactGrabbed} />
    </Canvas>
  );
}
