import type { ProductId } from "@showcase/showcase-guide";

export interface ShowcaseUrlEnv {
  readonly DEV: boolean;
  readonly VITE_MONSTER_FORGE_URL?: string;
  readonly VITE_ASHFALL_ARENA_URL?: string;
  readonly VITE_MECH_ATELIER_URL?: string;
}

export function resolveShowcaseProductUrls(
  env: ShowcaseUrlEnv,
): Record<ProductId, string> {
  const defaults = env.DEV && !import.meta.env.PROD
    ? {
        "monster-forge": "http://127.0.0.1:4173/",
        "ashfall-arena": "http://127.0.0.1:4174/",
        "mech-atelier": "http://127.0.0.1:4175/",
      }
    : {
        "monster-forge": "/monster-forge/",
        "ashfall-arena": "/ashfall-arena/",
        "mech-atelier": "/mech-atelier/",
      };

  return {
    "monster-forge": env.VITE_MONSTER_FORGE_URL ?? defaults["monster-forge"],
    "ashfall-arena": env.VITE_ASHFALL_ARENA_URL ?? defaults["ashfall-arena"],
    "mech-atelier": env.VITE_MECH_ATELIER_URL ?? defaults["mech-atelier"],
  };
}

export function resolvePreviewHref(baseUrl: string, filename: string): string {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${base}previews/${filename}`;
}
