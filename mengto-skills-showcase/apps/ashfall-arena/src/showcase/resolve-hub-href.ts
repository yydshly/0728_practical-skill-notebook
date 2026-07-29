import { resolveProductHubHref } from "@showcase/showcase-guide";

export function resolveAshfallHubHref(
  env: { DEV: boolean; VITE_SHOWCASE_HUB_URL?: string },
  currentHref: string,
): string {
  const base = env.VITE_SHOWCASE_HUB_URL
    ?? (import.meta.env.DEV && env.DEV
      ? "http://127.0.0.1:4172/"
      : "/");
  return resolveProductHubHref(base, "ashfall-arena", currentHref);
}
