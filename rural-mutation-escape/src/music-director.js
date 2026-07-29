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
  let latestDangerSnapshot = { mode: 'safe', intensity: 0 };
  let lastScheduledMode = null;
  let lastScheduledIntensity = null;
  let recoveryEndsAt = null;
  let terminalComplete = false;

  const playedStoryStingers = new Set();
  const startingStoryStingers = new Set();
  const activeStingers = new Set();
  const pendingStoryStingers = new Set();

  const warnedFailures = new Set();

  function readSnapshot() {
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

  function notifyStateChange(snapshot) {
    try {
      onStateChange(snapshot);
    } catch (error) {
      warnOnce('state-listener', error);
    }
  }

  function getSnapshot() {
    const recoverySettled = settleCompletedRecovery();
    const snapshot = readSnapshot();
    if (recoverySettled) notifyStateChange(snapshot);
    return snapshot;
  }

  function publish() {
    settleCompletedRecovery();
    notifyStateChange(readSnapshot());
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
      if (disposed) return null;
      warnOnce('ogg-fetch', error);
      if (disposed) return null;
    }

    if (disposed) return null;
    try {
      return { codec: 'mp3', buffers: await fetchCodecSet('mp3') };
    } catch (error) {
      if (disposed) return null;
      enterFailure('mp3-fetch', error);
      return null;
    }
  }

  async function loadAndStorePreferredSet() {
    if (disposed) return false;
    const loaded = await loadPreferredCodecSet();
    if (!loaded || disposed) return false;
    selectedCodec = loaded.codec;
    fetchedSet = loaded.buffers;
    decodedSet = null;
    assetState = 'prefetched';
    if (playback === 'error') playback = 'locked';
    publish();
    return !disposed;
  }

  function prefetch() {
    if (disposed) return Promise.resolve(false);
    if (unlockPromise && playback === 'loading') return unlockPromise;
    if (prefetchPromise) return prefetchPromise;
    if (
      fetchedSet
      && (assetState === 'prefetched' || assetState === 'ready')
    ) {
      return Promise.resolve(true);
    }

    if (assetState === 'error') {
      clearLoadReferences();
      if (playback === 'error') playback = 'locked';
    }
    assetState = 'loading';

    let resolveOperation;
    const operation = new Promise((resolve) => {
      resolveOperation = resolve;
    });
    let trackedPromise;
    trackedPromise = operation.finally(() => {
      if (prefetchPromise === trackedPromise) prefetchPromise = null;
    });
    prefetchPromise = trackedPromise;
    publish();
    void loadAndStorePreferredSet()
      .catch((error) => enterFailure('prefetch', error))
      .then(resolveOperation);
    return trackedPromise;
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
    if (!fetchedSet) {
      const loaded = prefetchPromise
        ? await prefetchPromise
        : await loadAndStorePreferredSet();
      if (!loaded) return null;
    }
    if (disposed) return null;

    if (selectedCodec === 'ogg') {
      try {
        return await decodeCodecSet(fetchedSet, context);
      } catch (error) {
        if (disposed) return null;
        warnOnce('ogg-decode-or-spec', error);
        if (disposed) return null;
        clearLoadReferences();
        try {
          if (disposed) return null;
          fetchedSet = await fetchCodecSet('mp3');
          if (disposed) {
            clearLoadReferences();
            return null;
          }
          selectedCodec = 'mp3';
          assetState = 'prefetched';
          publish();
          if (disposed) return null;
        } catch (mp3FetchError) {
          if (disposed) return null;
          enterFailure('mp3-fetch', mp3FetchError);
          return null;
        }
      }
    }

    if (disposed) return null;
    try {
      return await decodeCodecSet(fetchedSet, context);
    } catch (error) {
      if (disposed) return null;
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
      cleanupResult(() => {
        source.buffer = null;
      }, 'loop-buffer-clear');
    }
    for (const gain of layerGains) {
      cleanupResult(() => gain.disconnect(), 'layer-disconnect');
    }
    loopSources = [];
    layerGains = [];
  }

  function holdAndRamp(param, target, durationSeconds) {
    const now = contextRef.currentTime;
    if (typeof param.cancelAndHoldAtTime === 'function') {
      param.cancelAndHoldAtTime(now);
    } else {
      const currentValue = param.value;
      param.cancelScheduledValues(now);
      param.setValueAtTime(currentValue, now);
    }
    param.linearRampToValueAtTime(target, now + durationSeconds);
  }

  function clamp(value, minimum, maximum) {
    const finiteValue = Number.isFinite(value) ? value : minimum;
    return Math.max(minimum, Math.min(maximum, finiteValue));
  }

  function normalizeDangerSnapshot(snapshot = {}) {
    const supportedModes = new Set(['safe', 'chase', 'threaten', 'recover']);
    const normalizedMode = supportedModes.has(snapshot.mode) ? snapshot.mode : 'safe';
    if (normalizedMode === 'chase') {
      return {
        mode: normalizedMode,
        intensity: clamp(snapshot.intensity, 0.3, 0.68),
      };
    }
    if (normalizedMode === 'threaten') {
      return {
        mode: normalizedMode,
        intensity: clamp(snapshot.intensity, 0.72, 1),
      };
    }
    return {
      mode: normalizedMode,
      intensity: clamp(snapshot.intensity, 0, 1),
    };
  }

  function mixForSnapshot(snapshot) {
    if (snapshot.mode === 'chase') {
      return {
        exploration: 0.794328,
        danger: 0.35 + (((snapshot.intensity - 0.3) / 0.38) * 0.37),
        duration: 2,
      };
    }
    if (snapshot.mode === 'threaten') {
      return {
        exploration: 0.707946,
        danger: 0.75 + (((snapshot.intensity - 0.72) / 0.28) * 0.25),
        duration: 0.8,
      };
    }
    if (snapshot.mode === 'recover') {
      return { exploration: 1, danger: 0, duration: 4 };
    }
    return { exploration: 1, danger: 0, duration: 2 };
  }

  function settleCompletedRecovery() {
    if (
      disposed
      || terminalComplete
      || mode !== 'recover'
      || recoveryEndsAt === null
      || !contextRef
      || contextRef.currentTime < recoveryEndsAt
    ) {
      return false;
    }
    mode = 'safe';
    dangerMix = 0;
    recoveryEndsAt = null;
    lastScheduledMode = 'safe';
    lastScheduledIntensity = 0;
    return true;
  }

  function scheduleMix(snapshot, {
    initial = false,
    initialStartTime = null,
    publishChange = true,
  } = {}) {
    if (terminalComplete || layerGains.length !== 2 || !contextRef) return false;
    settleCompletedRecovery();

    if (
      snapshot.mode === 'safe'
      && mode === 'recover'
      && recoveryEndsAt !== null
      && contextRef.currentTime < recoveryEndsAt
    ) {
      return false;
    }

    const mix = mixForSnapshot(snapshot);
    const sameDangerMode = (
      snapshot.mode === lastScheduledMode
      && (snapshot.mode === 'chase' || snapshot.mode === 'threaten')
    );
    if (sameDangerMode) {
      const intensityDelta = Math.abs(snapshot.intensity - lastScheduledIntensity);
      if (intensityDelta < intensityThreshold) return false;
      try {
        holdAndRamp(layerGains[1].gain, mix.danger, mix.duration);
      } catch (error) {
        warnOnce('mix-automation', error);
        return false;
      }
      lastScheduledIntensity = snapshot.intensity;
      dangerMix = mix.danger;
      if (publishChange) publish();
      return true;
    }

    if (snapshot.mode === 'recover' && lastScheduledMode === 'recover') {
      return false;
    }
    if (snapshot.mode === 'safe' && lastScheduledMode === 'safe' && !initial) {
      return false;
    }

    try {
      if (
        initial
        && initialStartTime !== null
        && (snapshot.mode === 'chase' || snapshot.mode === 'threaten')
      ) {
        layerGains[0].gain.setValueAtTime(mix.exploration, initialStartTime);
        layerGains[1].gain.setValueAtTime(mix.danger, initialStartTime);
      } else {
        holdAndRamp(layerGains[0].gain, mix.exploration, mix.duration);
        holdAndRamp(layerGains[1].gain, mix.danger, mix.duration);
      }
    } catch (error) {
      warnOnce('mix-automation', error);
      return false;
    }

    mode = snapshot.mode;
    dangerMix = mix.danger;
    lastScheduledMode = snapshot.mode;
    lastScheduledIntensity = snapshot.intensity;
    recoveryEndsAt = snapshot.mode === 'recover'
      ? contextRef.currentTime + 4
      : null;
    if (publishChange) publish();
    return true;
  }

  function scheduleCompleteMix({ publishChange = true } = {}) {
    terminalComplete = true;
    mode = 'complete';
    dangerMix = 0;
    recoveryEndsAt = null;
    if (layerGains.length === 2 && contextRef) {
      try {
        holdAndRamp(layerGains[0].gain, 0, 5);
        holdAndRamp(layerGains[1].gain, 0, 5);
        lastScheduledMode = 'complete';
        lastScheduledIntensity = 0;
      } catch (error) {
        warnOnce('mix-automation', error);
      }
    }
    if (publishChange) publish();
  }

  function cleanupStinger(record, { stop = false, publishChange = true } = {}) {
    if (!record || record.cleaned) return;
    record.cleaned = true;
    activeStingers.delete(record);
    activeVoices = activeStingers.size;

    if (stop && record.source) {
      cleanupResult(() => record.source.stop(), 'stinger-stop');
    }
    if (record.source) {
      cleanupResult(
        () => record.source.disconnect(),
        'stinger-source-disconnect',
      );
      cleanupResult(() => {
        record.source.buffer = null;
      }, 'stinger-buffer-clear');
    }
    if (record.gain) {
      cleanupResult(() => record.gain.disconnect(), 'stinger-gain-disconnect');
    }
    if (publishChange) publish();
  }

  function stopActiveStingers(role = null, { publishChange = true } = {}) {
    for (const record of [...activeStingers]) {
      if (role && record.role !== role) continue;
      cleanupStinger(record, { stop: true, publishChange });
    }
  }

  function playStoryStinger(role) {
    if (
      disposed
      || transientsSuspended
      || playedStoryStingers.has(role)
      || startingStoryStingers.has(role)
      || !decodedSet
      || playback !== 'playing'
      || !contextRef
      || !stingerOutputRef
    ) {
      return false;
    }
    if (role === 'reveal' && terminalComplete) return false;
    if (
      role === 'reveal'
      && [...activeStingers].some((record) => record.role === 'escape')
    ) {
      return false;
    }
    startingStoryStingers.add(role);
    try {
      if (role === 'escape') stopActiveStingers('reveal');
      if (
        disposed
        || transientsSuspended
        || !decodedSet
        || playback !== 'playing'
        || !contextRef
        || !stingerOutputRef
      ) {
        return false;
      }

      let source = null;
      let voiceGain = null;
      let record = null;
      try {
        source = contextRef.createBufferSource();
        voiceGain = contextRef.createGain();
        record = {
          role,
          source,
          gain: voiceGain,
          cleaned: false,
        };
        source.buffer = decodedSet[role];
        voiceGain.gain.setValueAtTime(1, contextRef.currentTime);
        source.connect(voiceGain);
        voiceGain.connect(stingerOutputRef);
        source.onended = () => cleanupStinger(record);
        activeStingers.add(record);
        activeVoices = activeStingers.size;
        source.start(contextRef.currentTime);
        playedStoryStingers.add(role);
        publish();
        return true;
      } catch (error) {
        if (!record) {
          record = {
            role,
            source,
            gain: voiceGain,
            cleaned: false,
          };
        }
        cleanupStinger(record, { stop: Boolean(source) });
        warnOnce('stinger-start', error);
        return false;
      }
    } finally {
      startingStoryStingers.delete(role);
    }
  }

  function flushPendingStoryStingers() {
    if (disposed || transientsSuspended || playback !== 'playing') return;
    for (const role of ['escape', 'reveal']) {
      if (!pendingStoryStingers.delete(role)) continue;
      playStoryStinger(role);
    }
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
      if (terminalComplete) {
        scheduleCompleteMix({ publishChange: false });
      } else {
        scheduleMix(latestDangerSnapshot, {
          initial: true,
          initialStartTime: synchronizedStart,
          publishChange: false,
        });
      }
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
    if (unlockPromise) return unlockPromise;
    if (playback === 'playing' && loopGeneration === 1) {
      return Promise.resolve(true);
    }

    contextRef = context ?? contextRef;
    musicOutputRef = musicOutput ?? musicOutputRef;
    stingerOutputRef = stingerOutput ?? stingerOutputRef;

    if (assetState === 'error' || playback === 'error') {
      clearLoadReferences();
    }
    if (!fetchedSet) assetState = 'loading';
    playback = 'loading';

    const runUnlock = async () => {
      if (disposed) return false;
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
      flushPendingStoryStingers();
      publish();
      return !disposed;
    };

    let resolveOperation;
    const operation = new Promise((resolve) => {
      resolveOperation = resolve;
    });
    let trackedPromise;
    trackedPromise = operation.finally(() => {
      if (unlockPromise === trackedPromise) unlockPromise = null;
    });
    unlockPromise = trackedPromise;
    publish();
    void runUnlock()
      .catch((error) => enterFailure('unlock', error))
      .then(resolveOperation);
    return trackedPromise;
  }

  function handleStoryEvent(event = {}) {
    if (disposed) return;
    let role = null;
    if (
      event.type === 'objective-started'
      && event.objectiveId === 'escape_south_gate'
    ) {
      role = 'reveal';
    } else if (
      event.type === 'chapter-completed'
      && event.objectiveId === 'complete'
    ) {
      role = 'escape';
      if (!terminalComplete) scheduleCompleteMix();
    }
    if (!role || playedStoryStingers.has(role)) return;
    if (role === 'reveal' && terminalComplete) return;
    if (transientsSuspended) return;

    if (!playStoryStinger(role)) {
      if (
        !disposed
        && !transientsSuspended
        && (!decodedSet || playback !== 'playing')
      ) {
        pendingStoryStingers.add(role);
      }
    }
  }

  function updateDanger(snapshot = {}) {
    if (disposed || terminalComplete) return;
    const normalizedSnapshot = normalizeDangerSnapshot(snapshot);
    latestDangerSnapshot = normalizedSnapshot;
    const recoverySettled = settleCompletedRecovery();

    if (layerGains.length !== 2 || playback !== 'playing') {
      if (
        !(
          normalizedSnapshot.mode === 'safe'
          && mode === 'recover'
          && recoveryEndsAt !== null
          && contextRef
          && contextRef.currentTime < recoveryEndsAt
        )
      ) {
        mode = normalizedSnapshot.mode;
        dangerMix = mixForSnapshot(normalizedSnapshot).danger;
      }
      publish();
      return;
    }
    const scheduled = scheduleMix(normalizedSnapshot);
    if (recoverySettled && !scheduled) publish();
  }

  async function suspendTransientVoices() {
    if (disposed) return false;
    transientsSuspended = true;
    pendingStoryStingers.clear();
    stopActiveStingers();
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
    pendingStoryStingers.clear();
    stopActiveStingers(null, { publishChange: false });
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
