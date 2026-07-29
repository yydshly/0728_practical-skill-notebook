export function resolveServiceLaunch(
  service,
  npmExecPath = process.env.npm_execpath,
) {
  if (service.command && Array.isArray(service.args)) {
    return { command: service.command, args: service.args };
  }
  if (!service.npmScript || !npmExecPath) {
    throw new Error(
      `${service.name} requires npm_execpath; launch with npm run dev`,
    );
  }
  return {
    command: process.execPath,
    args: [npmExecPath, "run", service.npmScript],
  };
}

export const SHOWCASE_APPS = Object.freeze([
  Object.freeze({
    id: "showcase-hub",
    name: "产品能力展厅",
    port: 4172,
    url: "http://127.0.0.1:4172/",
    marker: '<meta name="showcase-app" content="showcase-hub">',
    npmScript: "dev:hub",
  }),
  Object.freeze({
    id: "monster-forge",
    name: "Monster Forge",
    port: 4173,
    url: "http://127.0.0.1:4173/",
    marker: '<meta name="showcase-app" content="monster-forge">',
    npmScript: "dev:forge",
  }),
  Object.freeze({
    id: "ashfall-arena",
    name: "Ashfall Arena",
    port: 4174,
    url: "http://127.0.0.1:4174/",
    marker: '<meta name="showcase-app" content="ashfall-arena">',
    npmScript: "dev:arena",
  }),
  Object.freeze({
    id: "mech-atelier",
    name: "Mech Atelier",
    port: 4175,
    url: "http://127.0.0.1:4175/",
    marker: '<meta name="showcase-app" content="mech-atelier">',
    npmScript: "dev:atelier",
  }),
]);
