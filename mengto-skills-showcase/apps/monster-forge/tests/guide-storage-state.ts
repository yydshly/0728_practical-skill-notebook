export function hiddenMonsterGuideState(origin: string) {
  return {
    cookies: [],
    origins: [{
      origin,
      localStorage: [{
        name: "mengto-showcase:guide:monster-forge:v1:auto-hidden",
        value: "true",
      }],
    }],
  };
}
