export function hiddenMechGuideState(origin: string) {
  return {
    cookies: [],
    origins: [{
      origin,
      localStorage: [{
        name: "mengto-showcase:guide:mech-atelier:v1:auto-hidden",
        value: "true",
      }],
    }],
  };
}
