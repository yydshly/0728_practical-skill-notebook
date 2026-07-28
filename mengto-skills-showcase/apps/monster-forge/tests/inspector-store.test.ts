import { describe, expect, it, vi } from "vitest";
import { createInspectorStore } from "../src/state/inspector-store";

describe("inspector store", () => {
  it("resets an unavailable action when selection changes", () => {
    const store = createInspectorStore("ash-warden");
    store.setAction("Attack");
    store.toggleOverlay("skeleton");
    store.setPaused(true);
    store.select("glass-crawler");

    expect(store.getState()).toMatchObject({
      selectedId: "glass-crawler",
      action: "Idle",
      paused: false,
      overlays: { skeleton: false, colliders: false, sockets: false },
    });
  });

  it("rejects unknown monsters and actions", () => {
    const store = createInspectorStore("ash-warden");

    expect(() => createInspectorStore("missing")).toThrow("Unknown monster: missing");
    expect(() => store.select("missing")).toThrow("Unknown monster: missing");
    expect(() => store.setAction("Dance" as never)).toThrow("Unknown action: Dance");
  });

  it("returns immutable snapshots", () => {
    const store = createInspectorStore("ash-warden");
    const snapshot = store.getState();

    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.overlays)).toBe(true);
    expect(() => {
      (snapshot.overlays as { skeleton: boolean }).skeleton = true;
    }).toThrow();
    expect(store.getState().overlays.skeleton).toBe(false);
  });

  it("notifies subscribers until they unsubscribe", () => {
    const store = createInspectorStore("ash-warden");
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.setPaused(true);
    unsubscribe();
    store.setAction("Walk");

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith({
      selectedId: "ash-warden",
      action: "Idle",
      paused: true,
      overlays: { skeleton: false, colliders: false, sockets: false },
    });
  });
});
