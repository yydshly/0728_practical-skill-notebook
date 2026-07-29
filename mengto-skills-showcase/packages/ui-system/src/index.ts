export const uiTokenNames = {
  colorCanvas: "--showcase-color-canvas",
  colorSurface: "--showcase-color-surface",
  colorText: "--showcase-color-text",
  colorAccent: "--showcase-color-accent",
  typeBody: "--showcase-font-body",
  typeDisplay: "--showcase-font-display",
  space1: "--showcase-space-1",
  space3: "--showcase-space-3",
  focusRing: "--showcase-focus-ring",
  motionFast: "--showcase-motion-fast",
  motionStandard: "--showcase-motion-standard",
} as const;

export type UiTokenName = (typeof uiTokenNames)[keyof typeof uiTokenNames];
