import { createMusicDirector } from './music-director.js';

const MASTER_GAIN = 0.28;
const MAX_OSCILLATOR_VOICES = 8;
const MUSIC_MODES = new Set(['safe', 'chase', 'threaten', 'recover', 'complete']);

const INITIAL_MUSIC_SNAPSHOT = Object.freeze({
  assetState: 'idle',
  playback: 'locked',
  mode: 'safe',
  loopGeneration: 0,
  startedAt: null,
  dangerMix: 0,
  activeVoices: 0,
});

async function readAssetWithFetch(url) {
  const response = await globalThis.fetch(url);
  if (!response.ok) {
    throw new Error(`audio asset request failed (${response.status}): ${url}`);
  }
  return response.arrayBuffer();
}

function createNoMusicDirector({ onStateChange }) {
  let snapshot = INITIAL_MUSIC_SNAPSHOT;
  let disposed = false;

  function publish(nextSnapshot) {
    snapshot = { ...snapshot, ...nextSnapshot };
    onStateChange(snapshot);
  }

  function reportUnavailable() {
    if (!disposed && snapshot.assetState !== 'error') {
      publish({ assetState: 'error', playback: 'error' });
    }
    return false;
  }

  return {
    prefetch() {
      return Promise.resolve(reportUnavailable());
    },
    unlock() {
      return Promise.resolve(reportUnavailable());
    },
    handleStoryEvent(event = {}) {
      if (
        !disposed
        && event.type === 'chapter-completed'
        && event.objectiveId === 'complete'
      ) {
        publish({ mode: 'complete', dangerMix: 0 });
      }
    },
    updateDanger(danger = {}) {
      if (disposed || snapshot.mode === 'complete') return;
      const mode = MUSIC_MODES.has(danger.mode) && danger.mode !== 'complete'
        ? danger.mode
        : 'safe';
      const dangerMix = mode === 'chase' || mode === 'threaten'
        ? Math.max(0, Math.min(1, Number.isFinite(danger.intensity) ? danger.intensity : 0))
        : 0;
      if (mode !== snapshot.mode || dangerMix !== snapshot.dangerMix) {
        publish({ mode, dangerMix });
      }
    },
    suspendTransientVoices() {
      return Promise.resolve(!disposed);
    },
    resume() {
      return Promise.resolve(!disposed);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      publish({
        assetState: 'disposed',
        playback: 'disposed',
        loopGeneration: 0,
        startedAt: null,
        dangerMix: 0,
        activeVoices: 0,
      });
    },
    getSnapshot() {
      return snapshot;
    },
  };
}

/**
 * @typedef {Object} AudioFeedbackSnapshot
 * @property {'unavailable'|'none'|'suspended'|'running'|'closed'} contextState
 * @property {'idle'|'loading'|'prefetched'|'ready'|'error'|'disposed'} assetState
 * @property {{
 *   playback: 'locked'|'loading'|'playing'|'error'|'disposed',
 *   mode: 'safe'|'chase'|'threaten'|'recover'|'complete',
 *   loopGeneration: number,
 *   startedAt: number|null
 * }} musicState
 * @property {number} dangerMix
 * @property {number} activeVoices
 * @property {boolean} muted
 */

export function createAudioFeedback({
  AudioContextCtor = globalThis.AudioContext ?? globalThis.webkitAudioContext ?? null,
  musicAssets,
  readAsset = readAssetWithFetch,
  storage,
  storageKey = 'rural-escape.audio-muted.v1',
  logger = console,
  musicDirectorFactory = createMusicDirector,
} = {}) {
  let context = null;
  let masterGain = null;
  let musicGain = null;
  let sfxGain = null;
  let director = null;
  let directorSnapshot = INITIAL_MUSIC_SNAPSHOT;
  let unlockPromise = null;
  let creatingDirector = false;
  let disposing = false;
  let disposed = false;
  let contextStateOverride = null;
  let heartbeatTimer = 0;
  let lastDangerMode = 'safe';
  let muted = false;

  const listeners = new Set();
  const pendingPublications = [];
  const oscillatorVoices = new Set();
  const warnedFailures = new Set();
  let deliveringPublications = false;

  function warnOnce(failureClass, error) {
    if (warnedFailures.has(failureClass)) return;
    warnedFailures.add(failureClass);
    try {
      logger?.warn?.(`[audio-feedback:${failureClass}]`, error);
    } catch {
      // Logging cannot become an audio failure.
    }
  }

  let storageRef = storage;
  if (storageRef === undefined) {
    try {
      storageRef = globalThis.localStorage ?? null;
    } catch (error) {
      storageRef = null;
      warnOnce('storage-read', error);
    }
  }
  if (storageRef) {
    try {
      muted = storageRef.getItem(storageKey) === 'true';
    } catch (error) {
      warnOnce('storage-read', error);
    }
  }

  function normalizeDirectorSnapshot(nextSnapshot = {}) {
    return {
      assetState: nextSnapshot.assetState ?? directorSnapshot.assetState,
      playback: nextSnapshot.playback ?? directorSnapshot.playback,
      mode: MUSIC_MODES.has(nextSnapshot.mode)
        ? nextSnapshot.mode
        : directorSnapshot.mode,
      loopGeneration: Number.isFinite(nextSnapshot.loopGeneration)
        ? nextSnapshot.loopGeneration
        : directorSnapshot.loopGeneration,
      startedAt: Number.isFinite(nextSnapshot.startedAt)
        ? nextSnapshot.startedAt
        : null,
      dangerMix: Number.isFinite(nextSnapshot.dangerMix)
        ? nextSnapshot.dangerMix
        : directorSnapshot.dangerMix,
      activeVoices: Number.isFinite(nextSnapshot.activeVoices)
        ? nextSnapshot.activeVoices
        : directorSnapshot.activeVoices,
    };
  }

  function readContextState() {
    if (contextStateOverride) return contextStateOverride;
    if (!AudioContextCtor) return 'unavailable';
    if (!context) return 'none';
    if (context.state === 'running') return 'running';
    if (context.state === 'suspended') return 'suspended';
    if (context.state === 'closed') return 'closed';
    return 'none';
  }

  function freezeSnapshot(snapshot) {
    Object.freeze(snapshot.musicState);
    return Object.freeze(snapshot);
  }

  function composeSnapshot() {
    return {
      contextState: readContextState(),
      assetState: directorSnapshot.assetState,
      musicState: {
        playback: directorSnapshot.playback,
        mode: directorSnapshot.mode,
        loopGeneration: directorSnapshot.loopGeneration,
        startedAt: directorSnapshot.startedAt,
      },
      dangerMix: directorSnapshot.dangerMix,
      activeVoices: directorSnapshot.activeVoices + oscillatorVoices.size,
      muted,
    };
  }

  function snapshotsEqual(left, right) {
    return (
      left.contextState === right.contextState
      && left.assetState === right.assetState
      && left.musicState.playback === right.musicState.playback
      && left.musicState.mode === right.musicState.mode
      && left.musicState.loopGeneration === right.musicState.loopGeneration
      && left.musicState.startedAt === right.musicState.startedAt
      && left.dangerMix === right.dangerMix
      && left.activeVoices === right.activeVoices
      && left.muted === right.muted
    );
  }

  let currentSnapshot = freezeSnapshot(composeSnapshot());

  function publish() {
    const nextSnapshot = composeSnapshot();
    if (snapshotsEqual(currentSnapshot, nextSnapshot)) return currentSnapshot;
    currentSnapshot = freezeSnapshot(nextSnapshot);
    pendingPublications.push({
      snapshot: currentSnapshot,
      recipients: [...listeners],
    });
    if (deliveringPublications) return currentSnapshot;

    deliveringPublications = true;
    try {
      while (pendingPublications.length > 0) {
        const publication = pendingPublications.shift();
        for (const listener of publication.recipients) {
          try {
            listener(publication.snapshot);
          } catch {
            // Subscriber failures cannot interrupt audio state publication.
          }
        }
      }
    } finally {
      deliveringPublications = false;
    }
    return currentSnapshot;
  }

  function onDirectorStateChange(nextSnapshot) {
    if (disposing || disposed) return;
    directorSnapshot = normalizeDirectorSnapshot(nextSnapshot);
    publish();
  }

  function ensureDirector() {
    if (director || disposed || creatingDirector) return director;
    creatingDirector = true;
    try {
      director = musicAssets
        ? musicDirectorFactory({
          musicAssets,
          readAsset,
          logger,
          onStateChange: onDirectorStateChange,
        })
        : createNoMusicDirector({ onStateChange: onDirectorStateChange });
      if (director?.getSnapshot) {
        directorSnapshot = normalizeDirectorSnapshot(director.getSnapshot());
      }
      publish();
      return director;
    } catch (error) {
      warnOnce('context', error);
      directorSnapshot = {
        ...directorSnapshot,
        assetState: 'error',
        playback: 'error',
      };
      publish();
      director = null;
      return null;
    } finally {
      creatingDirector = false;
    }
  }

  function cleanupNode(node) {
    try {
      node?.disconnect?.();
    } catch {
      // Cleanup is best effort.
    }
  }

  function ensureContextGraph() {
    if (disposed || !AudioContextCtor) return false;
    try {
      context ??= new AudioContextCtor();
      if (masterGain && musicGain && sfxGain) {
        publish();
        return true;
      }

      let nextMaster = null;
      let nextMusic = null;
      let nextSfx = null;
      try {
        nextMaster = context.createGain();
        nextMusic = context.createGain();
        nextSfx = context.createGain();
        nextMaster.gain.value = muted ? 0 : MASTER_GAIN;
        nextMusic.connect(nextMaster);
        nextSfx.connect(nextMaster);
        nextMaster.connect(context.destination);
      } catch (error) {
        cleanupNode(nextSfx);
        cleanupNode(nextMusic);
        cleanupNode(nextMaster);
        throw error;
      }
      masterGain = nextMaster;
      musicGain = nextMusic;
      sfxGain = nextSfx;
      publish();
      return true;
    } catch (error) {
      warnOnce('context', error);
      publish();
      return false;
    }
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    if (listeners.has(listener)) return () => {};
    listeners.add(listener);
    if (deliveringPublications) {
      pendingPublications.push({
        snapshot: currentSnapshot,
        recipients: [listener],
      });
    } else {
      try {
        listener(currentSnapshot);
      } catch {
        // Subscription remains valid even if its immediate callback fails.
      }
    }
    let subscribed = true;
    return () => {
      if (!subscribed) return;
      subscribed = false;
      listeners.delete(listener);
    };
  }

  function getSnapshot() {
    return currentSnapshot;
  }

  function prefetch() {
    if (disposed) return Promise.resolve(false);
    const musicDirector = ensureDirector();
    if (!musicDirector) return Promise.resolve(false);
    try {
      return Promise.resolve(musicDirector.prefetch()).then(Boolean, () => false);
    } catch {
      return Promise.resolve(false);
    }
  }

  function unlock() {
    if (disposed) return Promise.resolve(false);
    if (unlockPromise) return unlockPromise;

    let resolveOperation;
    const operation = new Promise((resolve) => {
      resolveOperation = resolve;
    });
    let trackedPromise;
    trackedPromise = operation.finally(() => {
      if (unlockPromise === trackedPromise) unlockPromise = null;
    });
    unlockPromise = trackedPromise;

    const runUnlock = async () => {
      if (!ensureContextGraph() || !context) return false;
      if (context.state === 'suspended') {
        try {
          await context.resume();
        } catch (error) {
          warnOnce('resume', error);
          publish();
          return false;
        }
        publish();
      }
      if (context.state !== 'running') {
        publish();
        return false;
      }

      const musicDirector = ensureDirector();
      if (musicDirector) {
        try {
          await musicDirector.unlock({
            context,
            musicOutput: musicGain,
            stingerOutput: sfxGain,
          });
        } catch {
          // The director owns and reports music-layer failures.
        }
      }
      publish();
      return !disposed && context?.state === 'running';
    };

    void runUnlock()
      .catch((error) => {
        warnOnce('context', error);
        return false;
      })
      .then(resolveOperation);
    return trackedPromise;
  }

  function cleanupOscillatorVoice(record, {
    stop = false,
    publishChange = true,
  } = {}) {
    if (!record || record.cleaned) return;
    record.cleaned = true;
    oscillatorVoices.delete(record);
    if (record.gain) cleanupNode(record.gain);
    if (record.oscillator) {
      if (stop) {
        try {
          record.oscillator.stop();
        } catch {
          // A naturally ended or partially started oscillator may reject stop.
        }
      }
      cleanupNode(record.oscillator);
    }
    if (publishChange) publish();
  }

  function stopOscillatorVoices({ publishChange = true } = {}) {
    for (const record of [...oscillatorVoices]) {
      cleanupOscillatorVoice(record, { stop: true, publishChange: false });
    }
    if (publishChange) publish();
  }

  function tone(frequency, duration, gain = 0.08, offset = 0) {
    if (
      disposed
      || muted
      || !context
      || context.state !== 'running'
      || !sfxGain
      || oscillatorVoices.size >= MAX_OSCILLATOR_VOICES
    ) {
      return;
    }

    let oscillator = null;
    let voiceGain = null;
    let record = null;
    try {
      const start = context.currentTime + offset;
      oscillator = context.createOscillator();
      voiceGain = context.createGain();
      record = {
        oscillator,
        gain: voiceGain,
        cleaned: false,
      };
      oscillator.frequency.value = frequency;
      voiceGain.gain.setValueAtTime(gain, start);
      voiceGain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(voiceGain);
      voiceGain.connect(sfxGain);
      oscillator.onended = () => cleanupOscillatorVoice(record);
      oscillatorVoices.add(record);
      oscillator.start(start);
      oscillator.stop(start + duration);
      publish();
    } catch (error) {
      if (record) {
        cleanupOscillatorVoice(record, { stop: true });
      } else {
        cleanupNode(voiceGain);
        if (oscillator) {
          try {
            oscillator.stop();
          } catch {
            // A partially allocated oscillator may not have started.
          }
          cleanupNode(oscillator);
        }
      }
      warnOnce('oscillator-node', error);
    }
  }

  function handleStoryEvent(event = {}) {
    if (disposed) return;
    const musicDirector = ensureDirector();
    try {
      musicDirector?.handleStoryEvent(event);
    } catch {
      // The director owns and reports music-layer failures.
    }

    if (event.type === 'objective-completed') {
      tone(440, 0.16, 0.06);
      tone(660, 0.2, 0.05, 0.12);
    } else if (event.type === 'chapter-completed') {
      tone(392, 0.2, 0.06);
      tone(523.25, 0.24, 0.05, 0.15);
      tone(659.25, 0.3, 0.04, 0.3);
    }
  }

  function updateDanger(danger = {}, elapsed = 0) {
    if (disposed) return;
    const musicDirector = ensureDirector();
    try {
      musicDirector?.updateDanger(danger);
    } catch {
      // The director owns and reports music-layer failures.
    }

    const enteringDanger = ['chase', 'threaten'].includes(danger.mode)
      && ['safe', 'recover'].includes(lastDangerMode);
    if (enteringDanger) tone(110, 0.35, 0.07);
    lastDangerMode = danger.mode;
    if (danger.mode === 'safe' || danger.mode === 'recover') {
      heartbeatTimer = 0;
      return;
    }
    const interval = 60 / Math.max(1, danger.heartbeatBpm);
    if (elapsed < heartbeatTimer) return;
    tone(62, 0.12, 0.075);
    tone(52, 0.11, 0.055, 0.14);
    heartbeatTimer = elapsed + interval;
  }

  function persistMuted() {
    if (!storageRef) return;
    try {
      storageRef.setItem(storageKey, String(muted));
    } catch (error) {
      warnOnce('storage-write', error);
    }
  }

  function setMuted(value) {
    muted = Boolean(value);
    persistMuted();
    if (masterGain && context) {
      try {
        masterGain.gain.setTargetAtTime(
          muted ? 0 : MASTER_GAIN,
          context.currentTime,
          0.03,
        );
      } catch (error) {
        warnOnce('context', error);
      }
    }
    publish();
    return muted;
  }

  function toggleMuted() {
    return setMuted(!muted);
  }

  async function suspend() {
    if (disposed || !context) return false;
    stopOscillatorVoices();
    const musicDirector = ensureDirector();
    try {
      await musicDirector?.suspendTransientVoices?.();
    } catch {
      // The director owns and reports music-layer failures.
    }
    if (context.state === 'running') {
      try {
        await context.suspend();
      } catch (error) {
        warnOnce('context', error);
        publish();
        return false;
      }
    }
    publish();
    return context.state === 'suspended';
  }

  async function resume() {
    if (disposed || muted || !context) return false;
    if (context.state === 'suspended') {
      try {
        await context.resume();
      } catch (error) {
        warnOnce('resume', error);
        publish();
        return false;
      }
    }
    if (context.state !== 'running') {
      publish();
      return false;
    }
    const musicDirector = ensureDirector();
    try {
      await musicDirector?.resume?.();
    } catch {
      // The director owns and reports music-layer failures.
    }
    publish();
    return !disposed && context?.state === 'running';
  }

  function dispose() {
    if (disposed) return;
    disposing = true;
    disposed = true;

    if (director) {
      try {
        const result = director.dispose();
        if (result && typeof result.then === 'function') {
          void Promise.resolve(result).catch(() => {});
        }
      } catch {
        // The director owns and reports music-layer failures.
      }
    }
    stopOscillatorVoices({ publishChange: false });
    cleanupNode(sfxGain);
    cleanupNode(musicGain);
    cleanupNode(masterGain);

    if (context?.close) {
      try {
        const closing = context.close();
        if (closing && typeof closing.then === 'function') {
          void Promise.resolve(closing).catch((error) => warnOnce('context', error));
        }
      } catch (error) {
        warnOnce('context', error);
      }
    }

    directorSnapshot = {
      ...directorSnapshot,
      assetState: 'disposed',
      playback: 'disposed',
      loopGeneration: 0,
      startedAt: null,
      dangerMix: 0,
      activeVoices: 0,
    };
    contextStateOverride = 'closed';
    disposing = false;
    publish();
    listeners.clear();

    director = null;
    context = null;
    masterGain = null;
    musicGain = null;
    sfxGain = null;
    unlockPromise = null;
  }

  return {
    subscribe,
    getSnapshot,
    prefetch,
    unlock,
    setMuted,
    toggleMuted,
    handleStoryEvent,
    updateDanger,
    suspend,
    resume,
    dispose,
  };
}
