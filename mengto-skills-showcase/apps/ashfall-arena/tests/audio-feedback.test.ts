import { describe, expect, it } from "vitest";
import { createAudioFeedback } from "../src/feedback/create-audio";
import { createInitialState } from "../src/simulation/create-initial-state";

class ListenerTarget {
  private readonly listeners = new Map<string, Set<(event: Event) => void>>();

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    const callback =
      typeof listener === "function"
        ? listener
        : listener.handleEvent.bind(listener);
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(callback);
    this.listeners.set(type, listeners);
  }

  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
  ) {
    if (typeof listener !== "function") return;
    this.listeners.get(type)?.delete(listener);
  }

  fire(type: string) {
    const event = { type, isTrusted: true } as Event;
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

class VisibilityTarget extends ListenerTarget {
  visibilityState: DocumentVisibilityState = "visible";
}

const audioParam = () => ({
  setValueAtTime() {},
  exponentialRampToValueAtTime() {},
  cancelScheduledValues() {},
});

class FakeGain {
  readonly gain = audioParam();
  connect() {
    return this;
  }
  disconnect() {}
}

class FakeOscillator {
  type: OscillatorType = "sine";
  readonly frequency = audioParam();
  onended: (() => void) | null = null;
  connect() {
    return this;
  }
  disconnect() {}
  start() {}
  stop() {}
}

class RecoveringAudioContext {
  state: AudioContextState = "suspended";
  currentTime = 0;
  readonly destination = {};
  resumeCalls = 0;
  suspendCalls = 0;
  closeCalls = 0;

  constructor(private readonly resumeOutcomes: boolean[]) {}

  createGain() {
    return new FakeGain();
  }

  createOscillator() {
    return new FakeOscillator();
  }

  async resume() {
    this.resumeCalls += 1;
    const succeeds = this.resumeOutcomes.shift() ?? true;
    if (!succeeds) throw new Error("gesture blocked");
    this.state = "running";
  }

  async suspend() {
    this.suspendCalls += 1;
    this.state = "suspended";
  }

  async close() {
    this.closeCalls += 1;
    this.state = "closed";
  }
}

const settlePromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("recoverable browser audio feedback", () => {
  it("rejects trusted guide gestures until gameplay owns the next gesture", () => {
    let guideGateOpen = true;
    const gestures = new ListenerTarget();
    const visibility = new VisibilityTarget();
    const context = new RecoveringAudioContext([true]);
    let factoryCalls = 0;
    const audio = createAudioFeedback({
      storage: null,
      gestureTarget: gestures as unknown as Window,
      visibilityDocument: visibility as unknown as Document,
      contextFactory: () => {
        factoryCalls += 1;
        return context as unknown as AudioContext;
      },
      canUnlock: () => !guideGateOpen,
    });

    gestures.fire("pointerdown");
    gestures.fire("keydown");
    expect(factoryCalls).toBe(0);

    guideGateOpen = false;
    gestures.fire("pointerdown");
    expect(factoryCalls).toBe(1);

    audio.dispose();
  });

  it("retries rejected resumes on the same context and closes it once", async () => {
    const gestures = new ListenerTarget();
    const visibility = new VisibilityTarget();
    const context = new RecoveringAudioContext([false, false, true]);
    let factoryCalls = 0;
    const audio = createAudioFeedback({
      storage: null,
      gestureTarget: gestures as unknown as Window,
      visibilityDocument: visibility as unknown as Document,
      contextFactory: () => {
        factoryCalls += 1;
        return context as unknown as AudioContext;
      },
    });

    gestures.fire("pointerdown");
    gestures.fire("keydown");
    gestures.fire("pointerdown");
    await settlePromises();
    expect(context.resumeCalls).toBe(1);
    expect(audio.getDiagnostics()).toMatchObject({
      blocked: true,
      unlocked: false,
      contextCreateCount: 1,
      closeCount: 0,
    });

    gestures.fire("keydown");
    await settlePromises();
    expect(context.resumeCalls).toBe(2);
    expect(audio.getDiagnostics()).toMatchObject({
      blocked: true,
      unlocked: false,
      contextCreateCount: 1,
    });

    gestures.fire("pointerdown");
    await settlePromises();
    expect(context.resumeCalls).toBe(3);
    expect(factoryCalls).toBe(1);
    expect(audio.getDiagnostics()).toMatchObject({
      blocked: false,
      unlocked: true,
      contextState: "running",
      contextCreateCount: 1,
      closeCount: 0,
    });

    audio.consume([
      {
        type: "attack-resolved",
        actorId: "player",
        actionId: "oathblade-light-1",
        attackId: "player:hit-before-cancel",
        result: "hit",
      },
    ], createInitialState(1));
    expect(audio.getDiagnostics()).toMatchObject({
      lastCue: "playerHit",
      cueCounts: {
        playerHit: 1,
        playerInterrupted: 0,
      },
    });

    audio.consume([
      {
        type: "attack-resolved",
        actorId: "player",
        actionId: "oathblade-light-1",
        attackId: "player:0:0",
        result: "interrupted",
        reason: "damage",
      },
    ], createInitialState(1));
    expect(audio.getDiagnostics()).toMatchObject({
      lastCue: "playerInterrupted",
      cueCounts: {
        playerHit: 1,
        playerInterrupted: 1,
      },
    });

    audio.dispose();
    audio.dispose();
    await settlePromises();
    expect(context.closeCalls).toBe(1);
    expect(audio.getDiagnostics()).toMatchObject({
      disposed: true,
      contextCreateCount: 1,
      closeCount: 1,
      voiceCount: 0,
    });
  });

  it("remains recoverable through mute and visibility suspension", async () => {
    const gestures = new ListenerTarget();
    const visibility = new VisibilityTarget();
    const context = new RecoveringAudioContext([true, true, true]);
    const audio = createAudioFeedback({
      storage: null,
      gestureTarget: gestures as unknown as Window,
      visibilityDocument: visibility as unknown as Document,
      contextFactory: () => context as unknown as AudioContext,
    });

    gestures.fire("pointerdown");
    await settlePromises();
    audio.setSettings({ muted: true });
    await settlePromises();
    expect(audio.getDiagnostics()).toMatchObject({
      muted: true,
      contextCreateCount: 1,
    });

    audio.setSettings({ muted: false });
    await settlePromises();
    visibility.visibilityState = "hidden";
    visibility.fire("visibilitychange");
    await settlePromises();
    expect(context.state).toBe("suspended");

    visibility.visibilityState = "visible";
    visibility.fire("visibilitychange");
    await settlePromises();
    expect(audio.getDiagnostics()).toMatchObject({
      blocked: false,
      unlocked: true,
      contextState: "running",
      contextCreateCount: 1,
      closeCount: 0,
    });

    audio.dispose();
    await settlePromises();
    expect(context.closeCalls).toBe(1);
  });
});
