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

  it("restarts the selected action without pretending a different action was chosen", () => {
    const store = createInspectorStore("ash-warden");
    store.setAction("Attack");
    const beforeRestart = store.getState();
    store.setPaused(true);
    store.restartAction();

    expect(store.getState()).toMatchObject({
      action: "Attack",
      actionRevision: beforeRestart.actionRevision + 1,
      actionEvent: "restarted",
      paused: false,
    });
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
      actionRevision: 0,
      actionEvent: "selected",
      paused: true,
      overlays: { skeleton: false, colliders: false, sockets: false },
    });
  });

  it("rejects inherited and unknown overlay names without publishing state", () => {
    const store = createInspectorStore("ash-warden");
    const listener = vi.fn();
    store.subscribe(listener);
    const initialState = store.getState();

    expect(() => store.toggleOverlay("constructor" as never)).toThrow("Unknown overlay: constructor");
    expect(() => store.toggleOverlay("outline" as never)).toThrow("Unknown overlay: outline");

    expect(listener).not.toHaveBeenCalled();
    expect(store.getState()).toBe(initialState);
  });
});
