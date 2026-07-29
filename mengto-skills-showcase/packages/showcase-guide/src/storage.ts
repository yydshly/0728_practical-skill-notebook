import type { ProductId } from "./types";

export interface GuidePreferenceAccess {
  readAutoHidden(key: string): boolean;
  writeAutoHidden(key: string): void;
}

export function guidePreferenceKey(
  productId: ProductId,
  guideVersion: number,
): string {
  if (!Number.isInteger(guideVersion) || guideVersion < 1) {
    throw new RangeError("guideVersion must be a positive integer");
  }
  return `mengto-showcase:guide:${productId}:v${guideVersion}:auto-hidden`;
}

export function createGuidePreferenceAccess(
  acquireStorage: () => Pick<Storage, "getItem" | "setItem"> =
    () => window.localStorage,
): GuidePreferenceAccess {
  const storage = (): Pick<Storage, "getItem" | "setItem"> | null => {
    try {
      return acquireStorage();
    } catch {
      return null;
    }
  };

  return {
    readAutoHidden(key) {
      try {
        return storage()?.getItem(key) === "true";
      } catch {
        return false;
      }
    },
    writeAutoHidden(key) {
      try {
        storage()?.setItem(key, "true");
      } catch {
        // Persistence failure only affects a future refresh.
      }
    },
  };
}
