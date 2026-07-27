import { NAV_POINTS, ROUTES, SCENE } from "./scene-config.js";

export async function initApp(documentRef = document) {
  documentRef.documentElement.style.setProperty("--scroll-length", `${SCENE.scrollLength}px`);

  return {
    navPoints: NAV_POINTS,
    routes: ROUTES,
  };
}

if (typeof document !== "undefined") {
  void initApp(document);
}
