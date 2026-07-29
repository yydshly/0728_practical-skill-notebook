import { resolveProductHubHref } from "@showcase/showcase-guide";

export function resolveMechAtelierHubHref(
  env: { DEV: boolean; VITE_SHOWCASE_HUB_URL?: string },
  currentHref: string,
): string {
  const base = env.VITE_SHOWCASE_HUB_URL
    ?? (env.DEV ? "http://127.0.0.1:4172/" : "/");
  return resolveProductHubHref(base, "mech-atelier", currentHref);
}
