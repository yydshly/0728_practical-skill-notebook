import type { GameEvent, GameState } from "../simulation/types";

export const AUDIO_SETTINGS_KEY = "ashfall-arena:audio-settings:v1";
const MAX_VOICES = 12;

export interface AudioSettings {
  readonly master: number;
  readonly effects: number;
  readonly ambience: number;
  readonly muted: boolean;
}

export interface AudioSettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = Object.freeze({
  master: 0.72,
  effects: 0.8,
  ambience: 0.35,
  muted: false,
});

export const AUDIO_CUES = Object.freeze({
  playerDamage: Object.freeze({
    priority: 1,
    visualEquivalent: "伤害闪光、生命数值和“受击”字幕",
  }),
  guardImpact: Object.freeze({
    priority: 1,
    visualEquivalent: "蓝色盾环、精力数值和“格挡”字幕",
  }),
  enemyTelegraph: Object.freeze({
    priority: 2,
    visualEquivalent: "敌人预警轮廓和攻击名称字幕",
  }),
  bossPhase: Object.freeze({
    priority: 2,
    visualEquivalent: "Boss 阶段标题与冲击环",
  }),
  playerAction: Object.freeze({
    priority: 3,
    visualEquivalent: "动作姿态、拖尾或接触星",
  }),
  ui: Object.freeze({
    priority: 4,
    visualEquivalent: "界面状态与中文提示",
  }),
} as const);

export interface AudioDiagnostics {
  readonly supported: boolean;
  readonly blocked: boolean;
  readonly unlocked: boolean;
  readonly contextState: AudioContextState | "not-created" | "unavailable";
  readonly voiceCount: number;
  readonly voiceCap: number;
  readonly playedCueCount: number;
  readonly muted: boolean;
  readonly paused: boolean;
  readonly settings: AudioSettings;
  readonly disposed: boolean;
}

export interface AudioFeedback {
  consume(events: readonly GameEvent[], state: Readonly<GameState>): void;
  sync(state: Readonly<GameState>): void;
  setPaused(paused: boolean): void;
  setSettings(settings: Partial<AudioSettings>): AudioSettings;
  getSettings(): AudioSettings;
  getDiagnostics(): AudioDiagnostics;
  dispose(): void;
}

interface Voice {
  readonly oscillator: OscillatorNode;
  readonly gain: GainNode;
  readonly priority: 1 | 2 | 3 | 4;
  ended: boolean;
}

const clampVolume = (value: number): number =>
  Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;

const normalizeSettings = (
  value: Partial<AudioSettings>,
): AudioSettings => ({
  master: clampVolume(value.master ?? DEFAULT_AUDIO_SETTINGS.master),
  effects: clampVolume(value.effects ?? DEFAULT_AUDIO_SETTINGS.effects),
  ambience: clampVolume(value.ambience ?? DEFAULT_AUDIO_SETTINGS.ambience),
  muted: value.muted ?? DEFAULT_AUDIO_SETTINGS.muted,
});

export function loadAudioSettings(
  storage: AudioSettingsStorage | null,
): AudioSettings {
  if (!storage) return { ...DEFAULT_AUDIO_SETTINGS };
  try {
    const raw = storage.getItem(AUDIO_SETTINGS_KEY);
    if (raw === null) return { ...DEFAULT_AUDIO_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AudioSettings>;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.master !== "number" ||
      typeof parsed.effects !== "number" ||
      typeof parsed.ambience !== "number" ||
      typeof parsed.muted !== "boolean"
    ) {
      return { ...DEFAULT_AUDIO_SETTINGS };
    }
    return normalizeSettings(parsed);
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

const persistAudioSettings = (
  storage: AudioSettingsStorage | null,
  settings: AudioSettings,
) => {
  if (!storage) return;
  try {
    storage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage failure must not interrupt visible gameplay feedback.
  }
};

const audioContextConstructor = (): typeof AudioContext | null => {
  if (typeof window === "undefined") return null;
  const candidate = (
    window as typeof window & {
      webkitAudioContext?: typeof AudioContext;
    }
  ).AudioContext ?? (
    window as typeof window & {
      webkitAudioContext?: typeof AudioContext;
    }
  ).webkitAudioContext;
  return candidate ?? null;
};

export function createAudioFeedback(options: {
  storage: AudioSettingsStorage | null;
  gestureTarget?: Window;
  visibilityDocument?: Document;
}): AudioFeedback {
  const gestureTarget =
    options.gestureTarget ??
    (typeof window === "undefined" ? null : window);
  const visibilityDocument =
    options.visibilityDocument ??
    (typeof document === "undefined" ? null : document);
  const Context = audioContextConstructor();
  let supported = Context !== null;
  let blocked = false;
  let unlocked = false;
  let paused = false;
  let disposed = false;
  let previousPlayerAction: GameState["player"]["action"] = "idle";
  let playedCueCount = 0;
  let settings = loadAudioSettings(options.storage);
  let context: AudioContext | null = null;
  let masterGain: GainNode | null = null;
  let effectsGain: GainNode | null = null;
  let ambienceGain: GainNode | null = null;
  const voices: Voice[] = [];

  const applyGainSettings = () => {
    if (!context || !masterGain || !effectsGain || !ambienceGain) return;
    const now = context.currentTime;
    masterGain.gain.setValueAtTime(settings.muted ? 0 : settings.master, now);
    effectsGain.gain.setValueAtTime(settings.effects, now);
    ambienceGain.gain.setValueAtTime(settings.ambience, now);
  };

  const releaseVoice = (voice: Voice) => {
    if (voice.ended) return;
    voice.ended = true;
    const index = voices.indexOf(voice);
    if (index >= 0) voices.splice(index, 1);
    voice.oscillator.disconnect();
    voice.gain.disconnect();
  };

  const stopVoice = (voice: Voice) => {
    if (voice.ended) return;
    try {
      voice.oscillator.stop();
      releaseVoice(voice);
    } catch {
      releaseVoice(voice);
    }
  };

  const stopAllVoices = () => {
    for (const voice of [...voices]) stopVoice(voice);
  };

  const resumeIfAllowed = () => {
    if (
      !context ||
      !unlocked ||
      paused ||
      settings.muted ||
      visibilityDocument?.visibilityState === "hidden"
    ) {
      return;
    }
    void context.resume().catch(() => {
      blocked = true;
    });
  };

  const unlockFromGesture = (event: Event) => {
    if (
      disposed ||
      unlocked ||
      !event.isTrusted ||
      Context === null
    ) {
      return;
    }
    try {
      context = new Context();
      masterGain = context.createGain();
      effectsGain = context.createGain();
      ambienceGain = context.createGain();
      effectsGain.connect(masterGain);
      ambienceGain.connect(masterGain);
      masterGain.connect(context.destination);
      applyGainSettings();
      void context.resume().then(() => {
        if (disposed) return;
        unlocked = true;
      }).catch(() => {
        blocked = true;
      });
    } catch {
      supported = false;
      blocked = true;
      context = null;
      masterGain = null;
      effectsGain = null;
      ambienceGain = null;
    }
  };

  gestureTarget?.addEventListener("pointerdown", unlockFromGesture, {
    capture: true,
  });
  gestureTarget?.addEventListener("keydown", unlockFromGesture, {
    capture: true,
  });

  const onVisibility = () => {
    if (!context) return;
    if (visibilityDocument?.visibilityState === "hidden") {
      void context.suspend();
    } else {
      resumeIfAllowed();
    }
  };
  visibilityDocument?.addEventListener("visibilitychange", onVisibility);

  const playCue = (
    priority: 1 | 2 | 3 | 4,
    frequency: number,
    duration: number,
    level: number,
  ) => {
    if (
      disposed ||
      !unlocked ||
      !context ||
      !effectsGain ||
      context.state !== "running" ||
      paused ||
      settings.muted ||
      settings.master === 0 ||
      settings.effects === 0
    ) {
      return;
    }
    if (voices.length >= MAX_VOICES) {
      let replace: Voice | null = null;
      for (const voice of voices) {
        if (
          voice.priority > priority &&
          (replace === null || voice.priority > replace.priority)
        ) {
          replace = voice;
        }
      }
      if (replace === null) return;
      stopVoice(replace);
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = priority <= 2 ? "sawtooth" : "triangle";
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(40, frequency * 0.74),
      now + duration,
    );
    gain.gain.setValueAtTime(level, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(effectsGain);
    const voice: Voice = {
      oscillator,
      gain,
      priority,
      ended: false,
    };
    oscillator.onended = () => releaseVoice(voice);
    voices.push(voice);
    playedCueCount += 1;
    oscillator.start(now);
    oscillator.stop(now + duration);
  };

  const consume = (
    events: readonly GameEvent[],
    state: Readonly<GameState>,
  ) => {
    for (const event of events) {
      if (event.type === "damage" && event.targetId === state.player.id) {
        playCue(
          AUDIO_CUES.playerDamage.priority,
          event.guardBroken ? 72 : event.guarded ? 190 : 115,
          event.guardBroken ? 0.28 : event.guarded ? 0.12 : 0.18,
          event.guardBroken ? 0.16 : event.guarded ? 0.1 : 0.14,
        );
      } else if (event.type === "damage") {
        playCue(AUDIO_CUES.playerAction.priority, 340, 0.1, 0.09);
      } else if (event.type === "enemy-telegraph") {
        playCue(AUDIO_CUES.enemyTelegraph.priority, 205, 0.22, 0.08);
      } else if (event.type === "boss-phase") {
        playCue(AUDIO_CUES.bossPhase.priority, 78, 0.45, 0.12);
      } else if (
        event.type === "drop" ||
        event.type === "upgrade-offered" ||
        event.type === "encounter-complete"
      ) {
        playCue(AUDIO_CUES.ui.priority, 520, 0.14, 0.06);
      }
    }
  };

  const setSettings = (
    next: Partial<AudioSettings>,
  ): AudioSettings => {
    settings = normalizeSettings({ ...settings, ...next });
    persistAudioSettings(options.storage, settings);
    applyGainSettings();
    if (settings.muted) {
      stopAllVoices();
      if (context) void context.suspend();
    } else {
      resumeIfAllowed();
    }
    return { ...settings };
  };

  return {
    consume,
    sync(currentState) {
      const action = currentState.player.action;
      if (
        action !== previousPlayerAction &&
        (action === "attack" || action === "dodge")
      ) {
        playCue(
          AUDIO_CUES.playerAction.priority,
          action === "attack" ? 285 : 430,
          action === "attack" ? 0.12 : 0.09,
          0.07,
        );
      }
      previousPlayerAction = action;
    },
    setPaused(nextPaused) {
      paused = nextPaused;
      if (!context) return;
      if (paused) {
        void context.suspend();
      } else {
        resumeIfAllowed();
      }
    },
    setSettings,
    getSettings: () => ({ ...settings }),
    getDiagnostics: () => ({
      supported,
      blocked,
      unlocked,
      contextState: context?.state ?? (supported ? "not-created" : "unavailable"),
      voiceCount: voices.length,
      voiceCap: MAX_VOICES,
      playedCueCount,
      muted: settings.muted,
      paused,
      settings: { ...settings },
      disposed,
    }),
    dispose() {
      if (disposed) return;
      disposed = true;
      gestureTarget?.removeEventListener("pointerdown", unlockFromGesture, {
        capture: true,
      });
      gestureTarget?.removeEventListener("keydown", unlockFromGesture, {
        capture: true,
      });
      visibilityDocument?.removeEventListener("visibilitychange", onVisibility);
      stopAllVoices();
      if (context) void context.close();
      context = null;
      masterGain = null;
      effectsGain = null;
      ambienceGain = null;
    },
  };
}
