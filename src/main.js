import { NAV_POINTS, ROUTES, SCENE } from "./scene-config.js";
import { waitForCriticalImages } from "./assets.js";
import { createStage } from "./stage.js";
import { createRouteArchive } from "./route-archive.js";

export async function initApp(documentRef = document) {
  documentRef.documentElement.style.setProperty("--scroll-length", `${SCENE.scrollLength}px`);

  const root = documentRef.querySelector("#cinematic-scroll");
  const stage = documentRef.querySelector("#cinematic-stage");
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  let stageController = null;
  const archiveRoot = documentRef.querySelector("#route-archive");
  const archiveController = archiveRoot ? createRouteArchive({ root: archiveRoot, routes: ROUTES }) : null;

  if (root && stage) {
    const { failed } = await waitForCriticalImages(root);
    documentRef.documentElement.classList.add("is-ready");
    if (failed.length) documentRef.documentElement.classList.add("has-asset-failures");
    stageController = createStage({ root, stage, reducedMotion });
    stageController.start();
  }

  return {
    navPoints: NAV_POINTS,
    routes: ROUTES,
    stage: stageController,
    archive: archiveController,
    destroy: () => {
      stageController?.destroy();
      archiveController?.destroy();
    },
  };
}

if (typeof document !== "undefined") {
  void initApp(document);
}
