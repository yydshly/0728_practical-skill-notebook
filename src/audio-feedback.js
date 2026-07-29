export function createAudioFeedback({
  AudioContextCtor = globalThis.AudioContext ?? globalThis.webkitAudioContext ?? null,
} = {}) {
  let context = null;
  let master = null;
  let muted = false;
  let unlocked = false;
  let heartbeatTimer = 0;
  let lastDangerMode = 'safe';

  function ensureContext() {
    if (!AudioContextCtor) return false;
    context ??= new AudioContextCtor();
    if (!master) {
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.28;
      master.connect(context.destination);
    }
    return true;
  }

  async function unlock() {
    try {
      if (!ensureContext()) return false;
      if (context.state === 'suspended') await context.resume();
      unlocked = context.state === 'running';
      return unlocked;
    } catch {
      unlocked = false;
      return false;
    }
  }

  function tone(frequency, duration, gain = 0.08, offset = 0) {
    if (!unlocked || muted || !context || !master) return;
    let oscillator = null;
    let voice = null;
    try {
      const start = context.currentTime + offset;
      oscillator = context.createOscillator();
      voice = context.createGain();
      oscillator.frequency.value = frequency;
      voice.gain.setValueAtTime(gain, start);
      voice.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(voice);
      voice.connect(master);
      oscillator.start(start);
      oscillator.stop(start + duration);
    } catch {
      try { oscillator?.stop?.(); } catch {}
      try { oscillator?.disconnect?.(); } catch {}
      try { voice?.disconnect?.(); } catch {}
    }
  }

  function handleStoryEvent(event) {
    if (event.type === 'objective-completed') {
      tone(440, 0.16, 0.06);
      tone(660, 0.2, 0.05, 0.12);
    } else if (event.type === 'chapter-completed') {
      tone(392, 0.2, 0.06);
      tone(523.25, 0.24, 0.05, 0.15);
      tone(659.25, 0.3, 0.04, 0.3);
    }
  }

  function updateDanger(snapshot, elapsed) {
    const enteringDanger = ['chase', 'threaten'].includes(snapshot.mode)
      && ['safe', 'recover'].includes(lastDangerMode);
    if (enteringDanger) tone(110, 0.35, 0.07);
    lastDangerMode = snapshot.mode;
    if (snapshot.mode === 'safe' || snapshot.mode === 'recover') {
      heartbeatTimer = 0;
      return;
    }
    const interval = 60 / Math.max(1, snapshot.heartbeatBpm);
    if (elapsed < heartbeatTimer) return;
    tone(62, 0.12, 0.075);
    tone(52, 0.11, 0.055, 0.14);
    heartbeatTimer = elapsed + interval;
  }

  function setMuted(value) {
    muted = Boolean(value);
    if (master && context) {
      master.gain.setTargetAtTime(muted ? 0 : 0.28, context.currentTime, 0.03);
    }
  }

  return {
    unlock,
    setMuted,
    toggleMuted() {
      setMuted(!muted);
      return muted;
    },
    handleStoryEvent,
    updateDanger,
    async suspend() {
      if (context?.state === 'running') await context.suspend().catch(() => {});
    },
    async resume() {
      if (!muted && context?.state === 'suspended') await context.resume().catch(() => {});
    },
    dispose() {
      master?.disconnect();
      const closing = context?.close?.();
      closing?.catch?.(() => {});
      context = null;
      master = null;
      unlocked = false;
    },
    get muted() { return muted; },
    get unlocked() { return unlocked; },
  };
}
