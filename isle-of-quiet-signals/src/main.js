import { NAV_POINTS, ROUTES, SCENE, SIGNAL_VEIL } from "./scene-config.js";
import { waitForCriticalImages } from "./assets.js";
import { createStage } from "./stage.js";
import { createRouteArchive } from "./route-archive.js";
import { createTimelineNavigation } from "./navigation.js";
import { createSignalVeil } from "./signal-veil.js";

export async function initApp(documentRef = document) {
  documentRef.documentElement.style.setProperty("--scroll-length", `${SCENE.scrollLength}px`);

  const root = documentRef.querySelector("#cinematic-scroll");
  const stage = documentRef.querySelector("#cinematic-stage");
  const motionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  let stageController = null;
  let navigationController = null;
  let signalVeil = null;
  const archiveRoot = documentRef.querySelector("#route-archive");
  const archiveController = archiveRoot ? createRouteArchive({ root: archiveRoot, routes: ROUTES }) : null;
  const signalVeilCanvas = documentRef.querySelector("#signal-veil");

  function createControllers(reducedMotion) {
    stageController?.destroy();
    navigationController?.destroy();
    signalVeil?.destroy();
    signalVeil = signalVeilCanvas
      ? createSignalVeil({
        canvas: signalVeilCanvas,
        lines: SIGNAL_VEIL.lines,
        range: SIGNAL_VEIL,
        reducedMotion,
      })
      : null;
    stageController = createStage({
      root,
      stage,
      reducedMotion,
      onFrame: (frame) => signalVeil?.setProgress(frame.p),
    });
    stageController.start();
    navigationController = createTimelineNavigation({
      nav: documentRef.querySelector("#site-nav"),
      points: NAV_POINTS,
      stage: stageController,
      reducedMotion,
    });
  }

  function onMotionChange(event) {
    documentRef.documentElement.classList.toggle("reduced-motion", event.matches);
    createControllers(event.matches);
  }

  if (root && stage) {
    const { failed } = await waitForCriticalImages(root);
    documentRef.documentElement.classList.add("is-ready");
    if (failed.length) documentRef.documentElement.classList.add("has-asset-failures");
    documentRef.documentElement.classList.toggle("reduced-motion", motionQuery?.matches ?? false);
    createControllers(motionQuery?.matches ?? false);
    motionQuery?.addEventListener?.("change", onMotionChange);
  }

  return {
    navPoints: NAV_POINTS,
    routes: ROUTES,
    stage: stageController,
    archive: archiveController,
    destroy: () => {
      stageController?.destroy();
      navigationController?.destroy();
      signalVeil?.destroy();
      archiveController?.destroy();
      motionQuery?.removeEventListener?.("change", onMotionChange);
    },
  };
}

if (typeof document !== "undefined") {
  void initApp(document);
}
