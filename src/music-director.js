const MUSIC_ROLES = Object.freeze([
  'exploration',
  'danger',
  'reveal',
  'escape',
]);

async function readAssetWithFetch(url) {
  const response = await globalThis.fetch(url);
  if (!response.ok) {
    throw new Error(`music asset request failed (${response.status}): ${url}`);
  }
  return response.arrayBuffer();
}

/**
 * @typedef {Object} MusicDirectorSnapshot
 * @property {'idle'|'loading'|'prefetched'|'ready'|'error'|'disposed'} assetState
 * @property {'locked'|'loading'|'playing'|'error'|'disposed'} playback
 * @property {'safe'|'chase'|'threaten'|'recover'|'complete'} mode
 * @property {number} loopGeneration
 * @property {number|null} startedAt
 * @property {number} dangerMix
 * @property {number} activeVoices
 */

export function createMusicDirector({
  musicAssets,
  readAsset = readAssetWithFetch,
  leadTimeSeconds = 0.05,
  loopDurationSeconds = 48,
  intensityThreshold = 0.08,
  logger = console,
  onStateChange = () => {},
}) {
  let assetState = 'idle';
  let playback = 'locked';
  let mode = 'safe';
  let loopGeneration = 0;
  let startedAt = null;
  let dangerMix = 0;
  let activeVoices = 0;

  let disposed = false;
  let transientsSuspended = false;
  let prefetchPromise = null;
  let unlockPromise = null;
  let selectedCodec = null;
  let fetchedSet = null;
  let decodedSet = null;
  let contextRef = null;
  let musicOutputRef = null;
  let stingerOutputRef = null;
  let layerGains = [];
  let loopSources = [];

  const warnedFailures = new Set();

  function getSnapshot() {
    return {
      assetState,
      playback,
      mode,
      loopGeneration,
      startedAt,
      dangerMix,
      activeVoices,
    };
  }

  function publish() {
    try {
      onStateChange(getSnapshot());
    } catch (error) {
      warnOnce('state-listener', error);
    }
  }

  function warnOnce(failureClass, error) {
    if (warnedFailures.has(failureClass)) return;
    warnedFailures.add(failureClass);
    try {
      logger?.warn?.(`[music-director:${failureClass}]`, error);
    } catch {
      // Logging must never become an audio failure.
    }
  }

  function clearLoadReferences() {
    selectedCodec = null;
    fetchedSet = null;
    decodedSet = null;
  }

  function enterFailure(failureClass, error) {
    if (disposed) return false;
    clearLoadReferences();
    assetState = 'error';
    playback = 'error';
    warnOnce(failureClass, error);
    publish();
    return false;
  }

  async function fetchCodecSet(codec) {
    const entries = await Promise.all(MUSIC_ROLES.map(async (role) => {
      const url = musicAssets?.[role]?.[codec];
      if (!url) throw new Error(`missing ${codec} music asset for ${role}`);
      const arrayBuffer = await readAsset(url);
      if (!arrayBuffer || typeof arrayBuffer.slice !== 'function') {
        throw new TypeError(`music asset reader returned invalid data for ${url}`);
      }
      return [role, arrayBuffer];
    }));
    return Object.fromEntries(entries);
  }

  async function loadPreferredCodecSet() {
    try {
      return { codec: 'ogg', buffers: await fetchCodecSet('ogg') };
    } catch (error) {
      warnOnce('ogg-fetch', error);
    }

    try {
      return { codec: 'mp3', buffers: await fetchCodecSet('mp3') };
    } catch (error) {
      enterFailure('mp3-fetch', error);
      return null;
    }
  }

  function prefetch() {
    if (disposed) return Promise.resolve(false);
    if (unlockPromise && playback === 'loading') return unlockPromise;
    if (
      fetchedSet
      && (assetState === 'prefetched' || assetState === 'ready')
    ) {
      return Promise.resolve(true);
    }
    if (prefetchPromise) return prefetchPromise;

    if (assetState === 'error') {
      clearLoadReferences();
      if (playback === 'error') playback = 'locked';
    }
    assetState = 'loading';
    publish();

    const operation = (async () => {
      const loaded = await loadPreferredCodecSet();
      if (!loaded || disposed) return false;
      selectedCodec = loaded.codec;
      fetchedSet = loaded.buffers;
      decodedSet = null;
      assetState = 'prefetched';
      if (playback === 'error') playback = 'locked';
      publish();
      return true;
    })();

    prefetchPromise = operation.finally(() => {
      prefetchPromise = null;
    });
    return prefetchPromise;
  }

  async function decodeCodecSet(buffers, context) {
    const entries = await Promise.all(MUSIC_ROLES.map(async (role) => {
      const decoded = await context.decodeAudioData(buffers[role].slice(0));
      return [role, decoded];
    }));
    const candidate = Object.fromEntries(entries);
    validateDecodedSet(candidate, context);
    return candidate;
  }

  function validateDecodedSet(buffers, context) {
    const sampleRate = context.sampleRate;
    for (const role of MUSIC_ROLES) {
      const buffer = buffers[role];
      if (!buffer) throw new Error(`missing decoded ${role} buffer`);
      if (buffer.numberOfChannels !== 2) {
        throw new Error(`${role} must decode as stereo`);
      }
      if (buffer.sampleRate !== sampleRate) {
        throw new Error(`${role} sample rate does not match the audio context`);
      }
    }

    const loopFrames = Math.round(loopDurationSeconds * sampleRate);
    if (
      buffers.exploration.length !== loopFrames
      || buffers.danger.length !== loopFrames
      || buffers.exploration.length !== buffers.danger.length
    ) {
      throw new Error('exploration and danger loops must have equal exact frame counts');
    }

    validateStingerDuration(buffers.reveal, 3, sampleRate, 'reveal');
    validateStingerDuration(buffers.escape, 6, sampleRate, 'escape');
  }

  function validateStingerDuration(buffer, durationSeconds, sampleRate, role) {
    const expectedFrames = Math.round(durationSeconds * sampleRate);
    const frameTolerance = 1;
    const durationTolerance = (1 / sampleRate) + Number.EPSILON;
    if (
      Math.abs(buffer.length - expectedFrames) > frameTolerance
      || Math.abs(buffer.duration - durationSeconds) > durationTolerance
    ) {
      throw new Error(`${role} duration must be ${durationSeconds} seconds`);
    }
  }

  async function obtainValidatedSet(context) {
    if (!fetchedSet && !(await prefetch())) return null;
    if (disposed) return null;

    if (selectedCodec === 'ogg') {
      try {
        return await decodeCodecSet(fetchedSet, context);
      } catch (error) {
        warnOnce('ogg-decode-or-spec', error);
        clearLoadReferences();
        try {
          fetchedSet = await fetchCodecSet('mp3');
          if (disposed) {
            clearLoadReferences();
            return null;
          }
          selectedCodec = 'mp3';
          assetState = 'prefetched';
          publish();
        } catch (mp3FetchError) {
          enterFailure('mp3-fetch', mp3FetchError);
          return null;
        }
      }
    }

    try {
      return await decodeCodecSet(fetchedSet, context);
    } catch (error) {
      enterFailure('mp3-decode-or-spec', error);
      return null;
    }
  }

  function cleanupResult(action, failureClass) {
    try {
      const result = action();
      if (result && typeof result.then === 'function') {
        void Promise.resolve(result).catch((error) => warnOnce(failureClass, error));
      }
    } catch (error) {
      warnOnce(failureClass, error);
    }
  }

  function cleanupLoopNodes() {
    for (const source of loopSources) {
      cleanupResult(() => source.stop(), 'loop-stop');
      cleanupResult(() => source.disconnect(), 'loop-disconnect');
    }
    for (const gain of layerGains) {
      cleanupResult(() => gain.disconnect(), 'layer-disconnect');
    }
    loopSources = [];
    layerGains = [];
  }

  function startLoopGeneration(context, musicOutput, buffers) {
    let explorationGain;
    let dangerGain;
    let explorationSource;
    let dangerSource;
    try {
      explorationGain = context.createGain();
      dangerGain = context.createGain();
      explorationGain.gain.setValueAtTime(0, context.currentTime);
      dangerGain.gain.setValueAtTime(0, context.currentTime);
      explorationGain.connect(musicOutput);
      dangerGain.connect(musicOutput);

      explorationSource = context.createBufferSource();
      dangerSource = context.createBufferSource();
      explorationSource.buffer = buffers.exploration;
      dangerSource.buffer = buffers.danger;
      for (const source of [explorationSource, dangerSource]) {
        source.loop = true;
        source.loopStart = 0;
        source.loopEnd = loopDurationSeconds;
      }
      explorationSource.connect(explorationGain);
      dangerSource.connect(dangerGain);

      const synchronizedStart = context.currentTime + leadTimeSeconds;
      explorationSource.start(synchronizedStart);
      dangerSource.start(synchronizedStart);

      layerGains = [explorationGain, dangerGain];
      loopSources = [explorationSource, dangerSource];
      startedAt = synchronizedStart;
      loopGeneration = 1;
      return true;
    } catch (error) {
      for (const source of [explorationSource, dangerSource]) {
        if (!source) continue;
        cleanupResult(() => source.stop(), 'loop-stop');
        cleanupResult(() => source.disconnect(), 'loop-disconnect');
      }
      for (const gain of [explorationGain, dangerGain]) {
        if (!gain) continue;
        cleanupResult(() => gain.disconnect(), 'layer-disconnect');
      }
      return enterFailure('loop-start', error);
    }
  }

  function unlock({
    context,
    musicOutput,
    stingerOutput,
  } = {}) {
    if (disposed) return Promise.resolve(false);
    if (playback === 'playing' && loopGeneration === 1) {
      return Promise.resolve(true);
    }
    if (unlockPromise) return unlockPromise;

    contextRef = context ?? contextRef;
    musicOutputRef = musicOutput ?? musicOutputRef;
    stingerOutputRef = stingerOutput ?? stingerOutputRef;

    if (assetState === 'error' || playback === 'error') {
      clearLoadReferences();
    }
    playback = 'loading';
    publish();

    const operation = (async () => {
      if (!contextRef || !musicOutputRef || !stingerOutputRef) {
        return enterFailure(
          'unlock-input',
          new Error('unlock requires an audio context and both output buses'),
        );
      }

      const buffers = await obtainValidatedSet(contextRef);
      if (!buffers || disposed) return false;
      decodedSet = buffers;

      if (!startLoopGeneration(contextRef, musicOutputRef, decodedSet)) {
        decodedSet = null;
        return false;
      }

      assetState = 'ready';
      playback = 'playing';
      publish();
      return true;
    })().catch((error) => enterFailure('unlock', error));

    unlockPromise = operation.finally(() => {
      unlockPromise = null;
    });
    return unlockPromise;
  }

  function handleStoryEvent() {
    // Story-driven stingers are implemented by the next director task.
  }

  function updateDanger() {
    // Danger automation is implemented by the next director task.
  }

  async function suspendTransientVoices() {
    if (disposed) return false;
    transientsSuspended = true;
    return true;
  }

  async function resume() {
    if (disposed) return false;
    transientsSuspended = false;
    return true;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    transientsSuspended = true;
    cleanupLoopNodes();
    clearLoadReferences();
    contextRef = null;
    musicOutputRef = null;
    stingerOutputRef = null;
    assetState = 'disposed';
    playback = 'disposed';
    loopGeneration = 0;
    startedAt = null;
    dangerMix = 0;
    activeVoices = 0;
    publish();
  }

  // Kept in this task's signature for the complete director API; Task 4
  // consumes it when danger automation is introduced.
  void intensityThreshold;

  return {
    prefetch,
    unlock,
    handleStoryEvent,
    updateDanger,
    suspendTransientVoices,
    resume,
    dispose,
    getSnapshot,
  };
}
