export function hiddenAshfallGuideState(origin: string) {
  return {
    cookies: [],
    origins: [{
      origin,
      localStorage: [{
        name: "mengto-showcase:guide:ashfall-arena:v1:auto-hidden",
        value: "true",
      }],
    }],
  };
}
