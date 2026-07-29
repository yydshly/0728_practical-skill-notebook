import { describe, expect, it } from "vitest";
import {
  createGuidePreferenceAccess,
  guidePreferenceKey,
} from "../src/storage";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

function failingPreferenceAccess(failure: "getter" | "read" | "write") {
  const storage = {
    getItem() {
      if (failure === "read") throw new DOMException("read blocked");
      return null;
    },
    setItem() {
      if (failure === "write") throw new DOMException("write blocked");
    },
  };
  return createGuidePreferenceAccess(() => {
    if (failure === "getter") throw new DOMException("getter blocked");
    return storage;
  });
}

describe("guide preferences", () => {
  it("builds the exact versioned product-scoped auto-hidden key", () => {
    expect(guidePreferenceKey("ashfall-arena", 1)).toBe(
      "mengto-showcase:guide:ashfall-arena:v1:auto-hidden",
    );
    expect(() => guidePreferenceKey("ashfall-arena", 0)).toThrow(RangeError);
    expect(() => guidePreferenceKey("ashfall-arena", 1.5)).toThrow(RangeError);
  });

  it("isolates products and guide versions", () => {
    const storage = memoryStorage();
    createGuidePreferenceAccess(() => storage).writeAutoHidden(
      guidePreferenceKey("monster-forge", 1),
    );
    expect(storage.getItem(guidePreferenceKey("monster-forge", 1))).toBe("true");
    expect(storage.getItem(guidePreferenceKey("monster-forge", 2))).toBeNull();
    expect(storage.getItem(guidePreferenceKey("mech-atelier", 1))).toBeNull();
  });

  it.each(["getter", "read", "write"] as const)(
    "keeps the guide usable when storage %s throws",
    (failure) => {
      const access = failingPreferenceAccess(failure);
      expect(access.readAutoHidden("any-key")).toBe(false);
      expect(() => access.writeAutoHidden("any-key")).not.toThrow();
    },
  );
});
