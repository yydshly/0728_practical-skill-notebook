import { create } from "zustand";
import { CAPABILITIES } from "../config/showcaseConfig";

export const useShowcaseStore = create((set, get) => ({
  selectedIndex: 0,
  previousIndex: 0,
  turnNonce: 0,
  cameraView: "overview",
  infoOpen: false,
  renderer: null,
  initialSceneReady: false,
  selectIndex: (index) => set((state) => index === state.selectedIndex ? {} : ({
    previousIndex: state.selectedIndex,
    selectedIndex: index,
    turnNonce: state.turnNonce + 1,
  })),
  selectNext: () => get().selectIndex((get().selectedIndex + 1) % CAPABILITIES.length),
  selectPrev: () => get().selectIndex((get().selectedIndex - 1 + CAPABILITIES.length) % CAPABILITIES.length),
  setCameraView: (cameraView) => set({ cameraView }),
  setRenderer: (renderer) => set({ renderer }),
  setInitialSceneReady: () => set({ initialSceneReady: true }),
  openInfo: () => set({ infoOpen: true }),
  closeInfo: () => set({ infoOpen: false }),
  capture: () => {
    const renderer = get().renderer;
    if (!renderer) return;
    const link = document.createElement("a");
    link.download = `product-showcase-${CAPABILITIES[get().selectedIndex].id}.png`;
    link.href = renderer.domElement.toDataURL("image/png");
    link.click();
  },
}));
