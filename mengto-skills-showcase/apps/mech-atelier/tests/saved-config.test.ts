import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultConfiguration } from "../src/content/catalog";
import {
  SAVED_CONFIG_KEY,
  createSavedConfigurationController,
  loadConfiguration,
  saveConfiguration,
  type StorageLike,
} from "../src/persistence/saved-config";
import type { MechConfiguration } from "../src/configuration/types";

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();
  writes = 0;

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.writes += 1;
    this.values.set(key, value);
  }
}

describe("versioned local configuration", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("saves and loads a valid configuration under the exact versioned key", () => {
    const storage = new MemoryStorage();
    expect(saveConfiguration(defaultConfiguration, storage)).toEqual({
      ok: true,
    });
    expect([...storage.values.keys()]).toEqual(["mech-atelier:v1"]);
    expect(JSON.parse(storage.values.get(SAVED_CONFIG_KEY)!)).toEqual({
      version: 1,
      config: defaultConfiguration,
    });
    expect(loadConfiguration(storage)).toEqual({
      ok: true,
      config: defaultConfiguration,
      issues: [],
    });
  });

  it("never writes an invalid configuration", () => {
    const storage = new MemoryStorage();
    const invalid = {
      ...defaultConfiguration,
      leftWeaponId: "rail-lance",
    } as unknown as MechConfiguration;

    expect(saveConfiguration(invalid, storage)).toMatchObject({ ok: false });
    expect(storage.writes).toBe(0);
    expect(storage.values.size).toBe(0);
  });

  it("does not throw or mutate malformed and unsupported saved payloads", () => {
    for (const original of [
      "{broken",
      JSON.stringify({ version: 2, config: defaultConfiguration }),
      JSON.stringify({
        version: 1,
        config: { ...defaultConfiguration, chassisId: "unknown" },
      }),
    ]) {
      const storage = new MemoryStorage();
      storage.values.set(SAVED_CONFIG_KEY, original);

      expect(() => loadConfiguration(storage)).not.toThrow();
      expect(loadConfiguration(storage)).toMatchObject({
        ok: false,
        config: null,
      });
      expect(storage.values.get(SAVED_CONFIG_KEY)).toBe(original);
      expect(storage.writes).toBe(0);
    }
  });

  it("debounces for 250 ms and writes only the last valid configuration", () => {
    const storage = new MemoryStorage();
    const controller = createSavedConfigurationController({ storage });
    const oracle: MechConfiguration = {
      ...defaultConfiguration,
      chassisId: "oracle-frame",
    };

    expect(controller.schedule(defaultConfiguration)).toBe(true);
    vi.advanceTimersByTime(249);
    expect(storage.writes).toBe(0);
    expect(controller.schedule(oracle)).toBe(true);
    vi.advanceTimersByTime(249);
    expect(storage.writes).toBe(0);
    vi.advanceTimersByTime(1);

    expect(storage.writes).toBe(1);
    expect(loadConfiguration(storage)).toMatchObject({
      ok: true,
      config: oracle,
    });
  });

  it("flush writes once immediately, clears its timer and page cleanup cannot duplicate it", () => {
    const storage = new MemoryStorage();
    const controller = createSavedConfigurationController({ storage });
    controller.schedule(defaultConfiguration);

    expect(controller.flush()).toEqual({ ok: true });
    expect(storage.writes).toBe(1);
    vi.advanceTimersByTime(1_000);
    expect(storage.writes).toBe(1);
    expect(controller.flush()).toEqual({ ok: true });
    expect(storage.writes).toBe(1);
  });

  it("dispose clears pending timers without a write", () => {
    const storage = new MemoryStorage();
    const controller = createSavedConfigurationController({ storage });
    controller.schedule(defaultConfiguration);
    controller.dispose();
    vi.advanceTimersByTime(1_000);

    expect(storage.writes).toBe(0);
  });

  it("an invalid schedule never replaces the last valid pending value", () => {
    const storage = new MemoryStorage();
    const controller = createSavedConfigurationController({ storage });
    const invalid = {
      ...defaultConfiguration,
      finish: {
        ...defaultConfiguration.finish,
        primary: "red",
      },
    } as MechConfiguration;

    controller.schedule(defaultConfiguration);
    expect(controller.schedule(invalid)).toBe(false);
    vi.advanceTimersByTime(250);

    expect(storage.writes).toBe(1);
    expect(loadConfiguration(storage)).toMatchObject({
      ok: true,
      config: defaultConfiguration,
    });
  });
});
