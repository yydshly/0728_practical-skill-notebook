# Rural Mutation Escape Dynamic BGM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an original, local, continuously playing rural-mutation score whose exploration and danger layers remain sample-synchronized while story events, danger states, mute, backgrounding, and failures produce clear and reliable audio feedback.

**Architecture:** A deterministic offline score pipeline creates four WAV masters and committed OGG/MP3 runtime assets with a provenance manifest. At runtime, `audio-feedback.js` owns one `AudioContext` and the master/music/SFX buses, while a DOM-free `music-director.js` loads one complete codec set, starts the two 48-second loops on the same audio-clock instant, changes only gain automation, and plays one-shot story stingers. `main.js` supplies static asset URLs and trusted user gestures; `ui.js` renders the observable sound state.

**Tech Stack:** JavaScript ES modules, Web Audio API, deterministic PCM synthesis, FFmpeg/FFprobe 6.x for offline encoding and measurement, Three.js 0.180, Node 22 test runner, Playwright 1.61, Vite 7.

**Working directories:** Run `node`, `npm.cmd`, FFmpeg-backed asset commands, and browser tests from the `rural-mutation-escape` game directory. Run `git add` and `git commit` from the enclosing `claude-of-duty-research` repository root; staged paths therefore include the `rural-mutation-escape/` prefix.

**Approved design:** `docs/superpowers/specs/2026-07-29-rural-mutation-escape-dynamic-bgm-design.md`

## Global Constraints

- Compose original procedural material for this project; do not import, imitate, or derive from protected game music or a named artist.
- Keep both loop masters exactly 48.000 seconds, 48,000 Hz, stereo, PCM16, 60 BPM, and 2,304,000 sample frames.
- Keep the reveal stinger exactly 3.000 seconds and the escape stinger exactly 6.000 seconds at the same sample rate and channel count.
- Retain WAV masters and the provenance manifest in `audio-source/`; only OGG and MP3 files may be imported by Vite.
- Keep all eight compressed runtime files at or below 4,000,000 bytes in total.
- Keep the decoded four-asset codec set at or below 42 MB; never decode both codec sets successfully in one session.
- Measure exploration near `-22 LUFS`, danger near `-25 LUFS`, and each stinger near `-18 LUFS`, with a tolerance of 1 LU.
- Limit every encoded asset and the loudest intended runtime combination to `-1 dBTP` or lower.
- Start the exploration and danger sources once, at one shared `AudioContext` time, with `loopStart = 0` and `loopEnd = 48`; state changes must never recreate or reposition them.
- Preserve current story order, movement, camera, collision, pursuer, objectives, evidence fixtures, oscillator cues, and heartbeat behavior.
- Production music state may only consume story events and danger snapshots. The `evidence` query parameter must not directly select a music state.
- Persist only the master mute flag under `rural-escape.audio-muted.v1`.
- Do not derive mute from `prefers-reduced-motion`; only an explicit player sound action changes mute.
- Backgrounding suspends the existing context and stops transient voices; foregrounding reuses the same loop sources and does not replay missed stingers.
- Audio loading, decoding, node creation, resume, and storage failures must not block rendering, input, story progression, collision, or visual danger feedback.
- Log each audio failure class at most once per page session and never log from the frame loop.
- Add no runtime npm dependency.
- Ordinary `npm.cmd run build` and `npm.cmd test` must not require FFmpeg. Only `audio:encode`, `audio:build`, and `audio:verify` may require FFmpeg/FFprobe.
- Do not alter or stage `RESEARCH.md`, `artifacts/prologue-start.png`, or `artifacts/quality-audit-2026-07-29/`.

---

## File Structure

- Create `scripts/rural-score-core.mjs`: deterministic score definitions, PCM synthesis, WAV encoding/inspection, metrics, and hashing.
- Create `scripts/render-rural-score.mjs`: render the four WAV masters and write the source portion of the provenance manifest.
- Create `scripts/encode-rural-score.mjs`: normalize, encode, probe, verify, and add compressed-file metadata to the manifest.
- Create `audio-source/manifest.json`: record generator identity, source claim, technical measurements, file paths, byte sizes, and SHA-256 hashes.
- Create `audio-source/masters/*.wav`: retain the two loop masters and two stinger masters.
- Create `src/assets/audio/*.{ogg,mp3}`: ship two codecs for each of the four logical assets.
- Create `src/music-director.js`: own music loading, codec fallback, decoding, synchronized loop playback, gain automation, stingers, and music-resource cleanup.
- Create `tests/audio-assets.mjs`: verify deterministic PCM, master files, compressed files, manifest integrity, duration, seam quality, loudness, peak, and size limits.
- Create `tests/fake-audio-context.mjs`: provide observable Web Audio fakes for unit tests without a browser.
- Modify `src/audio-feedback.js`: own the shared audio context, buses, oscillator voices, mute persistence, public snapshots, subscriptions, and lifecycle.
- Modify `src/ui.js`: render accessible locked/loading/playing/muted/error sound states.
- Create `src/audio-lifecycle.js`: bind visibility, pagehide, HMR, unsubscribe, and idempotent audio disposal through injectable event targets.
- Modify `src/main.js`: import URLs, prefetch, unlock from trusted gestures, subscribe UI state, forward game state, and clean up.
- Modify `index.html`: give the existing sound button a truthful initial state and ARIA metadata.
- Modify `src/style.css`: add 44-pixel touch sizing, keyboard focus, loading, and error states.
- Modify `tests/unit.mjs`: cover music director, audio facade, persistence, lifecycle, UI state, and resource cleanup.
- Modify `tests/smoke.mjs`: prove real-browser playback, synchronized state changes, persistence, background recovery, mobile layout, and graceful asset failure.
- Modify `package.json`: add score render/encode/verify/test scripts and include asset checks in the normal test chain.
- Create `docs/superpowers/validation/2026-07-29-rural-mutation-escape-dynamic-bgm-listening.md`: record actual headphone, speaker, and mobile-device listening evidence after implementation.

---

### Task 1: Build the deterministic WAV master pipeline

**Files:**
- Create: `scripts/rural-score-core.mjs`
- Create: `scripts/render-rural-score.mjs`
- Create: `tests/audio-assets.mjs`
- Create: `audio-source/manifest.json`
- Create: `audio-source/masters/rural-dusk-bed.wav`
- Create: `audio-source/masters/mutation-danger-layer.wav`
- Create: `audio-source/masters/mutation-reveal-stinger.wav`
- Create: `audio-source/masters/south-gate-escape-stinger.wav`
- Modify: `package.json`

**Public script interfaces:**

```js
export const SCORE_FORMAT = {
  sampleRate: 48_000,
  channels: 2,
  bitDepth: 16,
  bpm: 60,
};

export const SCORE_ASSETS = [
  {
    id: 'rural-dusk-bed',
    role: 'exploration',
    kind: 'loop',
    durationSeconds: 48,
    sampleFrames: 2_304_000,
    targetLufs: -22,
    seed: 0x4d495354,
    loopStart: 0,
    loopEnd: 48,
  },
  {
    id: 'mutation-danger-layer',
    role: 'danger',
    kind: 'loop',
    durationSeconds: 48,
    sampleFrames: 2_304_000,
    targetLufs: -25,
    seed: 0x4d555441,
    loopStart: 0,
    loopEnd: 48,
  },
  {
    id: 'mutation-reveal-stinger',
    role: 'reveal',
    kind: 'stinger',
    durationSeconds: 3,
    sampleFrames: 144_000,
    targetLufs: -18,
    seed: 0x5245564c,
  },
  {
    id: 'south-gate-escape-stinger',
    role: 'escape',
    kind: 'stinger',
    durationSeconds: 6,
    sampleFrames: 288_000,
    targetLufs: -18,
    seed: 0x47415445,
  },
];

export function renderScoreAsset(definition) {
  // Returns { definition, pcm: Int16Array, sourcePcmSha256, analysis }.
}

export function encodePcm16Wav({ pcm, sampleRate, channels }) {
  // Returns a little-endian PCM16 WAV Buffer.
}

export function inspectPcm16Wav(buffer) {
  // Returns { audioFormat, bitDepth, channels, sampleRate, sampleFrames, durationSeconds, pcm }.
}

export function analyzePcm16({ pcm, sampleRate, channels, kind }) {
  // Returns { peak, dcOffset, rms, seamDelta, approximateLufs }.
}

export function sha256(buffer) {
  // Returns lowercase hexadecimal SHA-256.
}
```

- [ ] **Step 1: Add failing deterministic-source and master-file tests**

Add `tests/audio-assets.mjs` with Node's test runner. The first group must:

1. Assert the four definitions exactly match the IDs, roles, durations, sample-frame counts, targets, and seeds above.
2. Render each definition twice and assert equal `sourcePcmSha256` values and byte-identical `Int16Array` contents.
3. Assert every rendered buffer has exactly `sampleFrames * 2` interleaved samples, finite normalized analysis values, `rms > 0.001`, and `abs(dcOffset) < 0.01`.
4. Assert each loop has `seamDelta <= 0.02`, and each stinger's final 160 ms reaches zero without a nonzero last sample.
5. Require each rendered `sourcePcmSha256` to equal the corresponding manifest value.
6. Read every committed WAV and assert PCM16 little-endian, 48 kHz, stereo, exact sample count, and a file SHA-256 equal to `audio-source/manifest.json`.
7. Assert the manifest uses `schemaVersion: 1`, starts at `pipelineStage: 'rendered'`, and contains this exact source claim:

```text
original procedural composition for rural-mutation-escape
```

8. Calculate the four Web Audio PCM buffers as `sampleFrames * channels * 4` bytes and require the total to be at most 42,000,000 bytes.

Import the not-yet-created module as:

```js
import {
  SCORE_ASSETS,
  SCORE_FORMAT,
  analyzePcm16,
  encodePcm16Wav,
  inspectPcm16Wav,
  renderScoreAsset,
  sha256,
} from '../scripts/rural-score-core.mjs';
```

Add this script to `package.json` before running the RED check:

```json
{
  "test:audio": "node --test tests/audio-assets.mjs"
}
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```powershell
npm.cmd run test:audio
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/rural-score-core.mjs`.

- [ ] **Step 3: Implement deterministic PCM synthesis**

Implement `scripts/rural-score-core.mjs` with a fixed-seed integer PRNG such as Mulberry32. Do not call `Math.random()`, read the clock, inspect the machine, or depend on object iteration order.

Use these fixed musical and texture rules:

| Asset | Tonal material | Timed material | Stereo treatment |
|---|---|---|---|
| exploration | D2 `73.416 Hz`, A2 `110 Hz`, F3 `174.614 Hz`; slow 48-second periodic amplitude movement | muted wooden strikes at seconds `8`, `24`, `40`; sparse filtered insect/noise grains wrapped across the boundary | drone centered; grains and strikes use deterministic pan in `[-0.35, 0.35]` |
| danger | D1 `36.708 Hz`, Ab1 `51.913 Hz`, Eb2 `77.782 Hz`; low pulse every 4 seconds | friction bursts at seconds `6`, `14`, `22`, `30`, `38`, `46`; short high-tension partials at `185` and `196 Hz` | bass within `±0.08`; friction alternates `-0.28/+0.28` |
| reveal | falling partials from `146.832` to `73.416 Hz` plus a short low impact | impact at `0.05 s`; friction tail ends by `3.0 s` | impact centered; tail widens to `±0.32` |
| escape | D minor motive resolves to open D/A: `73.416`, `87.307`, `110`, then `146.832 Hz` | attacks at `0`, `1.5`, `3.0`, `4.5 s`; final decay reaches zero at `6.0 s` | low notes centered; upper resolution widens to `±0.25` |

All oscillators must use phase formulas derived only from sample index. Filtered noise must be generated once from the fixed PRNG and processed in a fixed sample order. Events within 100 ms of a loop edge must be rendered with wrapped copies. Apply a 100 ms equal-power boundary blend to loop assets, a minimum 160 ms terminal release to stingers, then reject non-finite samples before PCM16 quantization.

Compute `sourcePcmSha256` from bytes written explicitly in little-endian sample order. Do not hash the platform-native backing bytes of `Int16Array`.

- [ ] **Step 4: Implement WAV rendering and provenance output**

Implement `scripts/render-rural-score.mjs` with:

```js
export async function renderRuralScore({
  projectRoot = new URL('..', import.meta.url),
  writeFile,
} = {}) {
  // Render all SCORE_ASSETS, write masters, and return the source manifest.
}
```

The CLI must create directories if absent, write all four masters, and write a stable, two-space-indented `audio-source/manifest.json` containing:

```js
{
  schemaVersion: 1,
  pipelineStage: 'rendered',
  provenance: {
    source: 'original procedural composition for rural-mutation-escape',
    prohibitedDerivation: 'not modeled on a named artist or protected work',
  },
  generator: {
    id: 'rural-score-core',
    version: '1.0.0',
    script: 'scripts/rural-score-core.mjs',
  },
  format: SCORE_FORMAT,
  assets: [
    {
      id,
      role,
      kind,
      seed,
      durationSeconds,
      sampleFrames,
      targetLufs,
      loopStart,
      loopEnd,
      sourcePcmSha256,
      analysis,
      files: {
        wav: { path, bytes, sha256 },
      },
    },
  ],
}
```

Add this script to `package.json`:

```json
{
  "audio:render": "node scripts/render-rural-score.mjs"
}
```

Run:

```powershell
npm.cmd run audio:render
```

- [ ] **Step 5: Run the asset tests and confirm GREEN**

Run:

```powershell
npm.cmd run test:audio
npm.cmd run test:unit
```

Expected: all deterministic synthesis, WAV, manifest, and pre-existing unit tests pass.

- [ ] **Step 6: Commit the master pipeline**

From the repository root:

```powershell
git add rural-mutation-escape/scripts/rural-score-core.mjs rural-mutation-escape/scripts/render-rural-score.mjs rural-mutation-escape/tests/audio-assets.mjs rural-mutation-escape/audio-source rural-mutation-escape/package.json
git commit -m "feat: generate original rural score masters"
```

---

### Task 2: Encode, measure, and verify the runtime assets

**Files:**
- Create: `scripts/encode-rural-score.mjs`
- Create: `src/assets/audio/rural-dusk-bed.ogg`
- Create: `src/assets/audio/rural-dusk-bed.mp3`
- Create: `src/assets/audio/mutation-danger-layer.ogg`
- Create: `src/assets/audio/mutation-danger-layer.mp3`
- Create: `src/assets/audio/mutation-reveal-stinger.ogg`
- Create: `src/assets/audio/mutation-reveal-stinger.mp3`
- Create: `src/assets/audio/south-gate-escape-stinger.ogg`
- Create: `src/assets/audio/south-gate-escape-stinger.mp3`
- Modify: `audio-source/masters/rural-dusk-bed.wav`
- Modify: `audio-source/masters/mutation-danger-layer.wav`
- Modify: `audio-source/masters/mutation-reveal-stinger.wav`
- Modify: `audio-source/masters/south-gate-escape-stinger.wav`
- Modify: `audio-source/manifest.json`
- Modify: `tests/audio-assets.mjs`
- Modify: `package.json`

**Encoding interface:**

```js
export async function buildEncodedScore({
  projectRoot = new URL('..', import.meta.url),
  ffmpegPath = process.env.RURAL_SCORE_FFMPEG ?? 'ffmpeg',
  ffprobePath = process.env.RURAL_SCORE_FFPROBE ?? 'ffprobe',
  verifyOnly = false,
} = {}) {
  // Returns the completed manifest or throws on any failed invariant.
}
```

- [ ] **Step 1: Extend the asset tests before creating encoded files**

Add tests which, for every logical asset and codec:

- require `pipelineStage: 'encoded'` while preserving the Task 1 `sourcePcmSha256` comparison;
- require `files.ogg` and `files.mp3` manifest entries;
- recompute SHA-256 and byte size from the committed file;
- require 48 kHz stereo;
- require OGG duration within one 48 kHz sample of the declared duration;
- allow MP3 duration drift of at most 1,152 samples for encoder delay;
- require measured integrated loudness within 1 LU of `targetLufs`;
- require measured true peak at or below `-1 dBTP`;
- require each finalized WAV master to meet the same loudness and true-peak limits;
- require the two loop assets to report equal decoded sample counts;
- calculate `sum(decodedSampleFrames * channels * 4)` independently for the OGG set and MP3 set, and require each set to stay at or below 42,000,000 bytes;
- require both codec sets' phase-independent maximum-runtime peak bounds to remain at or below `-1 dB`;
- require all eight compressed file sizes to total no more than 4,000,000 bytes.

Keep these tests FFmpeg-free by checking the committed measurements and hashes in the manifest. `audio:verify` will independently regenerate the FFprobe/FFmpeg measurements.

- [ ] **Step 2: Run the asset tests and confirm RED**

Run:

```powershell
npm.cmd run test:audio
```

Expected: FAIL because the encoded files and their manifest entries do not exist.

- [ ] **Step 3: Implement two-pass normalization, encoding, and probing**

Implement `scripts/encode-rural-score.mjs` to:

1. In encode mode, require `pipelineStage: 'rendered'`, re-render each fixed seed, and refuse to run if `sourcePcmSha256` or the rendered WAV hash differs from the source manifest. This prevents accidental double normalization.
2. Use an OS temporary directory and delete it in `finally`.
3. Run a first-pass FFmpeg `loudnorm` measurement with the asset target, `TP=-2`, `LRA=7`, and JSON output.
4. Calculate one constant `gainDb = targetLufs - measuredIntegratedLufs`. Reject the source mix instead of normalizing when `measuredTruePeakDbtp + gainDb > -2`; this keeps at least 1 dB of codec headroom.
5. In the second pass, apply only that constant gain, force PCM16/48 kHz/stereo with bit-exact flags and stripped metadata, and use `atrim=end_sample=<declared frames>` plus a reset timestamp. Do not use dynamic loudness normalization or a look-ahead limiter on loop masters.
6. Verify the temporary WAV has the exact declared frame count, remains within 1 LU of target, has true peak at or below `-2 dBTP`, and still passes the original seam limit. Only then atomically replace the corresponding WAV master. Preserve `sourcePcmSha256` separately from the finalized WAV file hash.
7. Encode OGG from that finalized master with `libvorbis`, quality `4`, 48 kHz stereo, fixed OGG serial offset, bit-exact flags, and stripped metadata.
8. Encode MP3 from that finalized master with `libmp3lame`, `96k`, 48 kHz stereo, a deterministic Xing header, disabled ID3v1/ID3v2, bit-exact flags, and stripped metadata.
9. Probe stream sample rate, channels, duration, integrated loudness, and true peak. Reject either compressed result above `-1 dBTP`; do not hide codec overshoot by trusting the WAV measurement.
10. Decode each output through FFmpeg and count PCM frames; the loop codecs must report 2,304,000 decoded frames, allowing MP3's container/probe duration to differ by at most 1,152 source samples.
11. Calculate decoded memory separately for OGG and MP3 as `sum(decodedSampleFrames * channels * 4)` and reject either codec set above 42,000,000 bytes.
12. Prove a phase-independent runtime peak bound for each codec set:

```text
0.28 * (
  dangerPeak * 1.0
  + explorationPeak * 0.707946
  + max(revealPeak, escapePeak)
  + 8 * 0.08
)
```

Convert that bound to dBFS and require it at or below `-1 dB`. This covers one stinger, both loops, and the facade's full eight-oscillator cap at any relative phase.

13. Reject a wrong duration, codec, sample rate, channel count, loudness, peak, seam, decoded memory, total compressed byte size, or hash.
14. Set `pipelineStage: 'encoded'` and update the manifest atomically with stable key order only after the four finalized masters and all eight compressed outputs pass.

In `--verify-only` mode, require `pipelineStage: 'encoded'`, recompute source PCM hashes, file hashes, probes, decoded frame counts, loudness, peak, seam, phase-independent runtime peak, and byte totals. Re-encode into an OS temporary directory with the recorded arguments and require identical OGG/MP3 hashes, then delete the temporary directory without modifying repository files.

The completed manifest must add:

```js
{
  pipelineStage: 'encoded',
  encoder: {
    ffmpegVersion,
    ffprobeVersion,
    normalization: {
      mode: 'measured-constant-gain',
      measurement: 'loudnorm JSON, TP=-2, LRA=7',
      output: 'pcm_s16le, 48000 Hz, stereo, exact declared frames',
    },
    ogg: {
      codec: 'libvorbis',
      quality: 4,
      bitExact: true,
      serialOffset: 0,
      metadata: 'stripped',
      argv,
    },
    mp3: {
      codec: 'libmp3lame',
      bitrate: '96k',
      bitExact: true,
      writeXing: true,
      id3v1: false,
      id3v2: false,
      metadata: 'stripped',
      argv,
    },
  },
  files: {
    wav: {
      path,
      bytes,
      sha256,
      sampleRate,
      channels,
      sampleFrames,
      durationSeconds,
      normalizationGainDb,
      integratedLufs,
      truePeakDbtp,
      seamDelta,
    },
    ogg: {
      path,
      bytes,
      sha256,
      sampleRate,
      channels,
      durationSeconds,
      decodedSampleFrames,
      integratedLufs,
      truePeakDbtp,
    },
    mp3: {
      path,
      bytes,
      sha256,
      sampleRate,
      channels,
      durationSeconds,
      decodedSampleFrames,
      integratedLufs,
      truePeakDbtp,
    },
  },
  decodedBytesByCodec: {
    ogg,
    mp3,
  },
  runtimeMixAnalysis: {
    definition: 'phase-independent sum of danger 1.0, exploration 0.707946, louder stinger, eight 0.08 oscillator peaks, then master 0.28',
    upperBoundDbfsByCodec: { ogg, mp3 },
  },
}
```

Add scripts:

```json
{
  "audio:encode": "node scripts/encode-rural-score.mjs",
  "audio:build": "npm run audio:render && npm run audio:encode",
  "audio:verify": "node scripts/encode-rural-score.mjs --verify-only",
  "test": "npm run test:unit && npm run test:audio && node tests/smoke.mjs"
}
```

The CLI must accept `--verify-only` and must also honor `RURAL_SCORE_FFMPEG` and `RURAL_SCORE_FFPROBE`. On the current workstation, use:

```powershell
$env:RURAL_SCORE_FFMPEG='D:\26project\26audio_and_video_project\ffmpeg-n6.1.3-win64-gpl-shared-6.1\bin\ffmpeg.exe'
$env:RURAL_SCORE_FFPROBE='D:\26project\26audio_and_video_project\ffmpeg-n6.1.3-win64-gpl-shared-6.1\bin\ffprobe.exe'
npm.cmd run audio:build
```

- [ ] **Step 4: Verify committed measurements and normal builds**

Run:

```powershell
npm.cmd run audio:verify
npm.cmd run test:audio
npm.cmd run build
```

Expected: all asset invariants pass, the compressed total is at most 4 MB, and Vite builds without invoking FFmpeg itself.

- [ ] **Step 5: Commit the runtime assets**

From the repository root:

```powershell
git add rural-mutation-escape/scripts/encode-rural-score.mjs rural-mutation-escape/src/assets/audio rural-mutation-escape/audio-source/manifest.json rural-mutation-escape/audio-source/masters rural-mutation-escape/tests/audio-assets.mjs rural-mutation-escape/package.json
git commit -m "feat: encode verified rural score assets"
```

---

### Task 3: Load one codec set and start synchronized loops

**Files:**
- Create: `src/music-director.js`
- Create: `tests/fake-audio-context.mjs`
- Modify: `tests/unit.mjs`

**Asset shape used by every runtime module:**

```js
const musicAssets = {
  exploration: { ogg: explorationOggUrl, mp3: explorationMp3Url },
  danger: { ogg: dangerOggUrl, mp3: dangerMp3Url },
  reveal: { ogg: revealOggUrl, mp3: revealMp3Url },
  escape: { ogg: escapeOggUrl, mp3: escapeMp3Url },
};
```

**Director interface:**

```js
export function createMusicDirector({
  musicAssets,
  readAsset,
  leadTimeSeconds = 0.05,
  loopDurationSeconds = 48,
  intensityThreshold = 0.08,
  logger = console,
  onStateChange = () => {},
}) {
  return {
    prefetch,
    unlock, // unlock({ context, musicOutput, stingerOutput })
    handleStoryEvent,
    updateDanger,
    suspendTransientVoices,
    resume,
    dispose,
    getSnapshot,
  };
}
```

`prefetch()`, `unlock()`, `suspendTransientVoices()`, and `resume()` return non-rejecting `Promise<boolean>` values. `handleStoryEvent()` and `updateDanger()` return `void`. `dispose()` is synchronous and idempotent; it internally catches any asynchronous node cleanup failure.

`getSnapshot()` must return this JSDoc contract:

```js
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
```

- [ ] **Step 1: Build observable Web Audio fakes**

Create `tests/fake-audio-context.mjs` with:

- `FakeAudioParam`, recording `setValueAtTime`, `linearRampToValueAtTime`, `setTargetAtTime`, `cancelScheduledValues`, and `cancelAndHoldAtTime`;
- `FakeGainNode`, recording connections and disconnections;
- `FakeBufferSourceNode`, recording `buffer`, `loop`, `loopStart`, `loopEnd`, start/stop calls, and `onended`;
- `FakeOscillatorNode`, recording frequency, start/stop, and cleanup;
- `FakeAudioContext`, exposing `state`, `currentTime`, `sampleRate`, `destination`, `sources`, `oscillators`, `gains`, `decodeAudioData`, `createBufferSource`, `createGain`, `createOscillator`, `resume`, `suspend`, and `close`;
- a configurable decode plan that can return exact 48/48/3/6-second stereo buffers or reject selected codec inputs.

The fakes must never use timers; tests advance `currentTime` explicitly and invoke `onended` explicitly.

- [ ] **Step 2: Write failing loading, fallback, and synchronization tests**

In `tests/unit.mjs`, import `createMusicDirector` and the fakes. Cover:

1. Two concurrent `prefetch()` calls fetch each OGG URL once.
2. OGG network failure discards that set and fetches one complete MP3 set.
3. OGG decode/spec failure discards decoded OGG references and decodes one complete MP3 set.
4. A successful codec set is the only retained decoded set.
5. Concurrent `prefetch()` and `unlock()` coalesce in-flight work.
6. The two loop sources use the same `start(context.currentTime + 0.05)`, `loopStart = 0`, and `loopEnd = 48`.
7. Repeated `unlock()` keeps exactly two loop sources and `loopGeneration === 1`.
8. Wrong sample rate, channels, loop duration, or unequal loop sample counts moves playback to `error` without throwing to the caller.
9. The exploration and danger gains both equal zero before either source starts.
10. A first failed MP3 decode leaves no retained in-flight promise; the next `unlock()` retries, succeeds, and creates only one loop generation.

Encode fake URL identity into an `ArrayBuffer` so the fake decoder can choose the expected role and codec deterministically.

- [ ] **Step 3: Run focused tests and confirm RED**

Run:

```powershell
node --test --test-name-pattern="music director.*(prefetch|fallback|synchronized|unlock|rejects)" tests/unit.mjs
```

Expected: FAIL because `src/music-director.js` does not exist.

- [ ] **Step 4: Implement grouped codec loading and one-time loop startup**

Implement these rules in `src/music-director.js`:

- `prefetch()` fetches all four OGG files as one set. Any OGG fetch failure discards the partial set and tries all four MP3 files.
- `unlock()` decodes the prefetched set. Any OGG decode or technical validation failure discards every OGG fetch/decode reference, fetches MP3 if needed, and decodes the complete MP3 set once.
- Use `arrayBuffer.slice(0)` for every `decodeAudioData` call.
- Require two channels and the context sample rate. Require the exploration and danger loop buffers to have equal length and exactly `round(48 * sampleRate)` frames.
- Validate reveal and escape durations against 3 and 6 seconds with one-sample tolerance.
- Create exploration and danger gains under `musicOutput`.
- Set both layer gains to zero before connecting or starting either source, so the danger layer can never leak at its `GainNode` default of one.
- Create two loop sources only after all four buffers validate.
- Set both sources to loop over `[0, 48]`, start both at `context.currentTime + 0.05`, then set `loopGeneration` to `1` and preserve that generation until disposal.
- Coalesce each in-flight operation with a stored promise cleared in `finally`.
- Treat `error` as retryable: the next `prefetch()` or `unlock()` transitions back to `loading`, retries the codec sequence, and reuses the supplied context and output buses.
- Convert failures to snapshot state and one `logger.warn` call per failure class; do not throw into game code.

- [ ] **Step 5: Run focused and full unit tests**

Run:

```powershell
node --test --test-name-pattern="music director" tests/unit.mjs
npm.cmd run test:unit
```

Expected: all loading, fallback, synchronization, and legacy unit tests pass.

- [ ] **Step 6: Commit synchronized loading**

From the repository root:

```powershell
git add rural-mutation-escape/src/music-director.js rural-mutation-escape/tests/fake-audio-context.mjs rural-mutation-escape/tests/unit.mjs
git commit -m "feat: load and synchronize rural music layers"
```

---

### Task 4: Direct danger mixing and one-shot story stingers

**Files:**
- Modify: `src/music-director.js`
- Modify: `tests/fake-audio-context.mjs`
- Modify: `tests/unit.mjs`

**Mix targets:**

| Mode | Exploration gain | Danger gain | Transition |
|---|---:|---:|---:|
| `safe` | `1.0` | `0.0` | 2.0 seconds on initial playback |
| `chase` | `0.794328` | map intensity `0.30..0.68` to `0.35..0.72` | 2.0 seconds |
| `threaten` | `0.707946` | map intensity `0.72..1.00` to `0.75..1.00` | 0.8 seconds |
| `recover` | `1.0` | `0.0` | fixed 4.0 seconds |
| `complete` | `0.0` | `0.0` | fixed 5.0 seconds |

- [ ] **Step 1: Write failing mix-automation tests**

Add unit tests which:

- assert the exact target gains and automation durations in the table;
- assert intensity is clamped before mapping;
- assert an update in the same mode with intensity delta below `0.08` adds no automation event;
- assert a delta at or above `0.08` updates only the danger target and does not create sources;
- assert a `safe` snapshot arriving during the four-second recovery curve does not cancel or shorten that curve;
- assert the public mode remains `recover` during that four-second audio curve and changes to `safe` only after the audio clock reaches its end;
- assert `complete` cannot be replaced by later danger snapshots;
- assert `loopGeneration` remains `1` through all state changes.
- call `updateDanger()` before `unlock()`, then require the cached snapshot to produce the correct initial safe/chase mix after decoding without a full-volume danger frame.

- [ ] **Step 2: Write failing stinger and transient-lifecycle tests**

Cover:

- `{ type: 'objective-started', objectiveId: 'escape_south_gate' }` plays reveal exactly once;
- unrelated objective events do not play reveal;
- `{ type: 'chapter-completed', objectiveId: 'complete' }` plays escape exactly once and selects `complete`;
- escape stops an active reveal before starting; reveal never stops or replaces escape;
- a reveal or escape event received while foreground decoding is incomplete queues once and starts immediately after a successful unlock;
- `suspendTransientVoices()` clears queued stingers, and a story event received while suspended may update terminal `complete` state but is never queued or replayed;
- every buffer source removes itself and disconnects both its source and voice gain on `onended`;
- `suspendTransientVoices()` stops all stingers but leaves both loop sources untouched;
- `resume()` does not replay a missed or stopped stinger;
- `dispose()` stops and disconnects loops and stingers, clears buffers, and enters `disposed`.

- [ ] **Step 3: Run focused tests and confirm RED**

Run:

```powershell
node --test --test-name-pattern="music director.*(mix|recovery|stinger|transient|complete)" tests/unit.mjs
```

Expected: FAIL because the director does not yet schedule dynamic gains or story stingers.

- [ ] **Step 4: Implement stable automation and stinger priority**

Add a single automation helper that holds the current value using `cancelAndHoldAtTime` when available, otherwise cancels and sets the current value before a linear ramp. Do not create any node from `updateDanger()`.

Track:

- `lastScheduledMode`;
- `lastScheduledIntensity`;
- `recoveryEndsAt`;
- `playedStoryStingers` as a set of `reveal` and `escape`;
- active stinger sources and their gain nodes;
- pending foreground stinger flags;
- whether transient playback is suspended;
- a terminal `complete` flag.

Cache the latest danger snapshot even before unlock. Immediately after synchronized loop startup, apply that snapshot: safe begins the approved two-second exploration fade, while an already-active chase or threat starts at its corresponding automation target without exposing the danger node's default gain.

When `recover` starts, schedule its four-second curve once. Keep the public mode at `recover` and ignore the following `safe` mix update until `context.currentTime >= recoveryEndsAt`, then publish `safe` and settle exact values without restarting the loop. On chapter completion, start escape under `stingerOutput` and fade both loops over five seconds.

While foreground loading is incomplete, queue reveal or escape as one bit per type; flush in priority order after successful unlock. Suspending clears this queue and marks transient playback unavailable. Story events received while suspended update terminal state but do not queue audio; `resume()` only re-enables future stingers.

All natural and forced stop paths must call one idempotent cleanup routine immediately. It stops when necessary, disconnects source and gain, removes the record, updates `activeVoices`, and remains safe if `onended` fires afterward.

- [ ] **Step 5: Run unit regression**

Run:

```powershell
node --test --test-name-pattern="music director" tests/unit.mjs
npm.cmd run test:unit
```

Expected: all director and existing unit tests pass; fake source counts remain two for loops plus bounded transient stingers.

- [ ] **Step 6: Commit the dynamic director**

From the repository root:

```powershell
git add rural-mutation-escape/src/music-director.js rural-mutation-escape/tests/fake-audio-context.mjs rural-mutation-escape/tests/unit.mjs
git commit -m "feat: direct danger music and story stingers"
```

---

### Task 5: Integrate buses, oscillator feedback, persistence, and observable lifecycle

**Files:**
- Modify: `src/audio-feedback.js`
- Modify: `tests/fake-audio-context.mjs`
- Modify: `tests/unit.mjs`

**Facade interface:**

```js
createAudioFeedback({
  AudioContextCtor,
  musicAssets,
  readAsset, // Defaults to checked fetch(url) -> response.arrayBuffer().
  storage,
  storageKey = 'rural-escape.audio-muted.v1',
  logger = console,
  musicDirectorFactory = createMusicDirector,
});
```

Return only:

```js
{
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
}
```

`prefetch()`, `unlock()`, `suspend()`, and `resume()` return non-rejecting `Promise<boolean>` values. `setMuted()` and `toggleMuted()` synchronously return the resulting boolean. `handleStoryEvent()` and `updateDanger()` return `void`. `dispose()` is synchronous, idempotent, and cannot create an unhandled rejection.

The frozen snapshot uses this JSDoc contract:

```js
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
```

- [ ] **Step 1: Replace legacy audio tests with failing facade-contract tests**

Update the existing audio tests in `tests/unit.mjs` to assert:

1. `AudioContextCtor: null` produces `contextState: 'unavailable'`, returns `false` from `unlock()`, and keeps story/danger calls safe.
2. An omitted `musicAssets` map keeps the context and oscillator SFX usable without throwing; this is the intermediate compatibility path until Task 7 injects assets.
3. With a stub `musicDirectorFactory`, the first successful unlock creates exactly one context, `masterGain`, `musicGain`, and `sfxGain`; both child buses connect to master and master connects to destination. Exploration/danger child gains remain covered by the real-director tests.
4. Repeated and concurrent unlock calls reuse those buses and the director.
5. `subscribe(listener)` immediately receives a deeply frozen snapshot and returns an idempotent unsubscribe function.
6. Snapshot notifications occur only on observable changes.
7. Initial mute reads `'true'` from storage; `setMuted()` and `toggleMuted()` persist string booleans and set master to `0` or `0.28`.
8. Storage read/write exceptions are swallowed.
9. Music load failure leaves oscillator objective cues and heartbeat available under `sfxGain`.
10. Oscillator voices are capped at eight, and `onended` stops tracking and disconnects oscillator/gain nodes.
11. `suspend()` stops transient voices before suspending; `resume()` reuses the context; `dispose()` is idempotent, closes once, and publishes `closed/disposed`.
12. A stub director can call the injected `onStateChange`; the facade immediately recomposes `assetState`, `musicState`, `dangerMix`, and `activeVoices` and notifies subscribers once.
13. A failed first unlock followed by a successful second unlock reuses the same context and three facade buses while the real director creates only its first loop generation.
14. Injected logging proves each failure key is emitted once and is owned by exactly one layer.

- [ ] **Step 2: Run facade tests and confirm RED**

Run:

```powershell
node --test --test-name-pattern="audio feedback" tests/unit.mjs
```

Expected: FAIL because the old facade has mutable getters, no buses/director/persistence/subscription, and incomplete cleanup.

- [ ] **Step 3: Refactor `audio-feedback.js` around one context**

Implement this graph exactly:

```text
AudioContext.destination
└── masterGain (0.28 unmuted, 0 muted)
    ├── musicGain
    │   ├── explorationGain -> rural-dusk-bed loop
    │   └── dangerGain -> mutation-danger-layer loop
    └── sfxGain
        ├── existing objective, completion, danger, and heartbeat oscillators
        └── reveal / escape stingers
```

Requirements:

- When `readAsset` is absent, use `fetch`, reject non-2xx responses with a URL-specific error, and return `response.arrayBuffer()`.
- When `storage` is absent, attempt to resolve `globalThis.localStorage` inside `try/catch`; an unavailable getter means non-persistent sound, not a facade failure.
- When `musicAssets` is absent, install a no-music director adapter that reports unavailable music but leaves the context and oscillator SFX path operational; Task 7 removes this runtime condition by always injecting the complete map.
- Call `context.resume()` before awaiting asset decoding in `unlock()`.
- Coalesce unlock calls; a retry after an error may rerun failed loading but must not create another context or bus graph.
- Create the director with an `onStateChange` callback that composes and publishes a facade snapshot. This callback is the only path by which asynchronous fetch/decode completion and stinger cleanup update subscribers.
- Keep existing `objective-completed`, `chapter-completed`, entering-danger, and heartbeat oscillator patterns.
- Forward every story event and danger snapshot to the director even when oscillator feedback is muted or unavailable.
- Track oscillator source/gain pairs in a set, assign `onended`, and clean partially allocated nodes in reverse order. Natural and forced stops must immediately disconnect both source and gain, remove the record, publish `activeVoices`, and remain safe when `onended` later fires.
- Sum director transient voices and oscillator voices for `activeVoices`.
- Deep-freeze a fresh composed snapshot only when a value changes; never expose the director or mutable nodes.
- Read and write the mute key defensively.
- Give warning ownership to one layer only. The director owns `fetch`, `decode`, `validation`, and `stinger-node`; the facade owns `context`, `resume`, `oscillator-node`, `storage-read`, and `storage-write`. Neither layer may repeat or re-log the other's failure.
- On suspend, stop oscillator and stinger transients, then suspend the context. On resume, resume only when unmuted. On dispose, dispose the director, stop voices, disconnect buses, close the context, clear listeners, and release references.
- During disposal, publish the final `closed/disposed` snapshot before clearing listeners. Catch `context.close()` rejection internally so callers such as `pagehide` and HMR never receive an unhandled promise.

- [ ] **Step 4: Run full unit tests**

Run:

```powershell
node --test --test-name-pattern="audio feedback|music director" tests/unit.mjs
npm.cmd run test:unit
```

Expected: all audio and legacy unit tests pass without timers, leaked sources, or unhandled promises.

- [ ] **Step 5: Commit the audio facade**

From the repository root:

```powershell
git add rural-mutation-escape/src/audio-feedback.js rural-mutation-escape/tests/fake-audio-context.mjs rural-mutation-escape/tests/unit.mjs
git commit -m "feat: integrate persistent dynamic game audio"
```

---

### Task 6: Render accessible sound-control states

**Files:**
- Modify: `index.html`
- Modify: `src/ui.js`
- Modify: `src/style.css`
- Modify: `tests/unit.mjs`

**UI interface:**

```js
/**
 * @param {AudioFeedbackSnapshot} snapshot
 * @returns {'locked'|'loading'|'playing'|'muted'|'error'}
 */
export function deriveSoundState(snapshot) {
  if (snapshot.muted) return 'muted';
  if (
    snapshot.contextState === 'unavailable'
    || snapshot.assetState === 'error'
    || snapshot.musicState.playback === 'error'
  ) return 'error';
  if (snapshot.musicState.playback === 'loading') return 'loading';
  if (snapshot.musicState.playback === 'playing') return 'playing';
  return 'locked';
}

ui.renderSoundState(state);
ui.onSoundToggle(handler);
```

**Visible state map:**

| State | Icon | `aria-label` and `title` | `aria-pressed` | `aria-busy` | Disabled |
|---|---|---|---|---|---|
| `locked` | `🔈` | `开启声音` | `false` | `false` | no |
| `loading` | `…` | `正在加载声音` | `false` | `true` | yes |
| `playing` | `🔊` | `关闭声音` | `false` | `false` | no |
| `muted` | `🔇` | `开启声音` | `true` | `false` | no |
| `error` | `⚠` | `重试声音` | `false` | `false` | no |

- [ ] **Step 1: Expand the tracked DOM test helper**

In `tests/unit.mjs`, make `createTrackedElement()` store attribute values, implement `getAttribute(name)`, record event listeners by event type, expose a helper that dispatches a stored listener with the original event object, and expose a writable `disabled` property. Preserve its existing write-count behavior.

- [ ] **Step 2: Add failing UI state tests**

For each state in the table, call `ui.renderSoundState(state)` and assert:

```js
assert.equal(button.dataset.audioState, expected.state);
assert.equal(button.getAttribute('aria-label'), expected.label);
assert.equal(button.getAttribute('title'), expected.label);
assert.equal(button.getAttribute('aria-pressed'), expected.pressed);
assert.equal(button.getAttribute('aria-busy'), expected.busy);
assert.equal(button.disabled, expected.disabled);
assert.equal(button.textContent, expected.icon);
```

Also test `deriveSoundState()` in this exact priority:

1. `muted` when snapshot mute is true;
2. `error` for unavailable context, asset error, or playback error;
3. `loading` for playback loading;
4. `playing` for playback playing;
5. `locked` otherwise.

Register a handler through `ui.onSoundToggle(handler)`, dispatch a click carrying a sentinel `isTrusted` value, and assert that the exact original event object reaches the handler. The UI layer must not wrap, clone, or drop the trusted browser event.

- [ ] **Step 3: Run focused tests and confirm RED**

Run:

```powershell
node --test --test-name-pattern="sound control renders|derives sound state" tests/unit.mjs
```

Expected: FAIL because `renderSoundState`, `onSoundToggle`, and `deriveSoundState` do not exist.

- [ ] **Step 4: Implement the state table and button styling**

Add the new interface. Keep temporary compatibility aliases through this task:

```js
setMuted(muted) {
  renderSoundState(muted ? 'muted' : 'playing');
}

onMute(handler) {
  onSoundToggle(handler);
}
```

Task 7 removes these aliases immediately after `main.js` migrates; retaining them here keeps every intermediate commit runnable. Initialize `index.html` as:

```html
<button
  id="mute-toggle"
  class="mute-toggle"
  type="button"
  data-audio-state="locked"
  aria-pressed="false"
  aria-busy="false"
  aria-label="开启声音"
  title="开启声音"
>🔈</button>
```

Add:

```css
.mute-toggle {
  min-width: 44px;
  min-height: 44px;
  border-radius: 999px;
}

.mute-toggle:focus-visible {
  outline: 2px solid #f3c591;
  outline-offset: 3px;
}

.mute-toggle[data-audio-state="loading"] {
  cursor: progress;
}

.mute-toggle[data-audio-state="error"] {
  border-color: rgba(231, 160, 139, 0.72);
}
```

Keep its existing bottom-right visual placement at desktop and portrait sizes.

- [ ] **Step 5: Run unit regression**

Run:

```powershell
npm.cmd run test:unit
npm.cmd run build
```

Expected: all UI and existing unit tests pass, the compatibility aliases keep current `main.js` operational, and the production bundle builds. The legacy smoke assertion against `window.__RURAL_ESCAPE__.audio.muted` is intentionally migrated together with the read-only debug facade in Task 7.

- [ ] **Step 6: Commit the sound UI**

From the repository root:

```powershell
git add rural-mutation-escape/index.html rural-mutation-escape/src/ui.js rural-mutation-escape/src/style.css rural-mutation-escape/tests/unit.mjs
git commit -m "feat: expose accessible sound control states"
```

---

### Task 7: Wire trusted gestures and prove the real browser flow

**Files:**
- Create: `src/audio-lifecycle.js`
- Modify: `src/main.js`
- Modify: `src/ui.js`
- Modify: `tests/unit.mjs`
- Modify: `tests/smoke.mjs`

- [ ] **Step 1: Add failing injectable lifecycle tests**

In `tests/unit.mjs`, import:

```js
import { bindAudioLifecycle } from '../src/audio-lifecycle.js';
```

With injected fake `documentRef`, `windowRef`, `hot`, `audio`, and `unsubscribe`, prove:

- visible → hidden calls `suspend()` once;
- hidden → visible calls `resume()` once;
- `pagehide` unsubscribes and disposes;
- the registered HMR callback performs the same cleanup;
- pagehide, HMR, and the returned disposer can all fire, but unsubscribe/dispose execute exactly once;
- cleanup removes visibility/pagehide listeners and does not produce a rejecting promise.

- [ ] **Step 2: Add failing browser assertions for real playback**

Extend the existing Playwright smoke server, but create a fresh dedicated `BrowserContext` and page for audio acceptance so storage and request accounting start empty. Visit `/?evidence=birth` at `1280x720`, and assert:

- the button begins in `locked` with `aria-label="开启声音"`;
- `page.evaluate(() => document.querySelector('#mute-toggle').click())` remains locked because the synthetic event is not trusted;
- a real `page.click('#mute-toggle')` reaches `musicState.playback === 'playing'` and `contextState === 'running'`;
- each selected OGG URL is requested once with HTTP 200; MP3 is requested at most once per logical asset only if the browser rejects OGG;
- no successfully selected URL is fetched twice;
- `activeVoices` is finite and nonnegative.

Capture response URLs and console/page errors for one navigation segment only. Freeze that segment's counts after playback starts; clear or replace the request map before any reload so later persistence navigation cannot create a false duplicate-download failure.

Close this dedicated context after its persistence/lifecycle flow. Run portrait and missing-asset flows in their own fresh contexts so persisted mute, request counts, and console records cannot leak between scenarios.

- [ ] **Step 3: Add failing synchronized danger, persistence, and lifecycle assertions**

Using the real `contact` fixture and existing player test positioning:

1. Unlock audio and record `loopGeneration`.
2. Place the player 5–8 meters from the pursuer and wait for `chase`; record the mid-level `dangerMix`.
3. Place the player at contact distance and wait for `threaten`; require a larger `dangerMix`.
4. Place the player over 17 meters away and require audio mode `recover`; require it to remain `recover` during the four-second audio window and become `safe` only after that window. Exact gain automation remains a Task 4 unit assertion.
5. Require `loopGeneration` to remain unchanged throughout.
6. In the same document, mute then unmute and require `loopGeneration === 1` throughout.
7. Mute again, reload, and require persisted mute with the new document's `loopGeneration === 0`.
8. Unmute that new document with one real button click and require its first `loopGeneration === 1`. Never compare generation numbers across documents as proof of source reuse.
9. Freeze through Chromium CDP, reactivate before evaluating any page function, return with a real canvas click if the browser requires it, and require no loop restart or stinger replay within that document.

- [ ] **Step 4: Add failing portrait and deterministic-failure assertions**

At `390x844`, require the sound button:

- to be fully inside the viewport;
- to measure at least `44x44`;
- to have pointer events enabled and accept a real click;
- not to overlap `#tutorial-hint` or `#interaction`;
- to keep ARIA state consistent with the read-only audio snapshot.

Visit `/?evidence=birth&audio-fixture=missing`, activate sound, and require:

- `data-audio-state="error"` and `aria-label="重试声音"`;
- `assetState === 'error'`;
- no uncaught exception or `console.error`;
- at most one warning for each audio failure class;
- the normal radio → resident → flashlight → south-gate story route still reaches objective `complete`;
- renderer calls and triangles remain positive.

- [ ] **Step 5: Run focused lifecycle and smoke tests and confirm RED**

Run:

```powershell
node --test --test-name-pattern="audio lifecycle" tests/unit.mjs
node tests/smoke.mjs
```

Expected: the unit test first fails because `src/audio-lifecycle.js` does not exist; after that test is enabled, the browser assertion fails because runtime assets are not imported and the button never reaches `playing`.

- [ ] **Step 6: Import all static asset URLs and construct the facade**

In `src/main.js`, add:

```js
import { createGameUi, deriveSoundState } from './ui.js';
import { bindAudioLifecycle } from './audio-lifecycle.js';
import explorationOgg from './assets/audio/rural-dusk-bed.ogg?url';
import explorationMp3 from './assets/audio/rural-dusk-bed.mp3?url';
import dangerOgg from './assets/audio/mutation-danger-layer.ogg?url';
import dangerMp3 from './assets/audio/mutation-danger-layer.mp3?url';
import revealOgg from './assets/audio/mutation-reveal-stinger.ogg?url';
import revealMp3 from './assets/audio/mutation-reveal-stinger.mp3?url';
import escapeOgg from './assets/audio/south-gate-escape-stinger.ogg?url';
import escapeMp3 from './assets/audio/south-gate-escape-stinger.mp3?url';

const productionMusicAssets = {
  exploration: { ogg: explorationOgg, mp3: explorationMp3 },
  danger: { ogg: dangerOgg, mp3: dangerMp3 },
  reveal: { ogg: revealOgg, mp3: revealMp3 },
  escape: { ogg: escapeOgg, mp3: escapeMp3 },
};
```

Replace the existing `createGameUi` import instead of adding a duplicate.

Move construction of `new URLSearchParams(window.location.search)` above audio-facade creation so the audio fixture and the existing evidence fixture share one parsed, read-only query object; remove the later duplicate declaration.

Enable the missing fixture only in development:

```js
const forceMissingAudio =
  import.meta.env.DEV
  && searchParams.get('audio-fixture') === 'missing';
```

When `forceMissingAudio` is true, replace each URL with a distinct deterministic path under:

```text
/__audio-fixture__/missing/<role>.<codec>
```

Construct the selected object without mutating the imported production map:

```js
const musicAssets = forceMissingAudio
  ? Object.fromEntries(
      Object.keys(productionMusicAssets).map((role) => [
        role,
        {
          ogg: `/__audio-fixture__/missing/${role}.ogg`,
          mp3: `/__audio-fixture__/missing/${role}.mp3`,
        },
      ]),
    )
  : productionMusicAssets;
```

This fixture changes only audio resource resolution; it must not modify story, danger, pursuer, or evidence state, and production builds must ignore the query parameter.

Call:

```js
const audio = createAudioFeedback({ musicAssets });
const unsubscribeAudio = audio.subscribe((snapshot) => {
  ui.renderSoundState(deriveSoundState(snapshot));
});
void audio.prefetch();
```

- [ ] **Step 7: Wire trusted gestures and lifecycle cleanup**

Use this behavior:

```js
async function handleAudioGesture(event, { toggle = false } = {}) {
  if (!event.isTrusted) return false;

  const snapshot = audio.getSnapshot();
  if (toggle) {
    if (snapshot.muted || snapshot.musicState.playback !== 'playing') {
      audio.setMuted(false);
      return audio.unlock();
    }
    audio.setMuted(true);
    return true;
  }

  return audio.unlock();
}
```

Call it without awaiting from the existing `keydown` and canvas `pointerdown` listeners. Register `ui.onSoundToggle(event => void handleAudioGesture(event, { toggle: true }))`. This makes the first button click enable sound instead of muting it.

Keep current story-event and per-frame danger forwarding. Implement `src/audio-lifecycle.js` as:

```js
export function bindAudioLifecycle({
  audio,
  unsubscribe = () => {},
  documentRef = globalThis.document,
  windowRef = globalThis.window,
  hot = null,
}) {
  let disposed = false;

  function onVisibilityChange() {
    void (documentRef.hidden ? audio.suspend() : audio.resume());
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    documentRef.removeEventListener('visibilitychange', onVisibilityChange);
    windowRef.removeEventListener('pagehide', dispose);
    unsubscribe();
    audio.dispose();
  }

  documentRef.addEventListener('visibilitychange', onVisibilityChange);
  windowRef.addEventListener('pagehide', dispose, { once: true });
  hot?.dispose(dispose);
  return dispose;
}
```

Wire it from `main.js` with `document`, `window`, `import.meta.hot`, and `unsubscribeAudio`. The visibility handler must use `void (document.hidden ? audio.suspend() : audio.resume())`.

After `main.js` no longer calls them, remove the temporary `setMuted()` and `onMute()` aliases from `src/ui.js`.

Replace the mutable debug facade with a frozen, getter-only object exposing only:

```text
contextState
assetState
musicState
dangerMix
activeVoices
muted
```

Construct it as:

```js
const audioDebug = {};
for (const key of [
  'contextState',
  'assetState',
  'musicState',
  'dangerMix',
  'activeVoices',
  'muted',
]) {
  Object.defineProperty(audioDebug, key, {
    enumerable: true,
    get: () => audio.getSnapshot()[key],
  });
}
Object.freeze(audioDebug);
```

Assign `audio: audioDebug` in `window.__RURAL_ESCAPE__`. Every getter reads a current frozen snapshot; do not expose `unlock`, `setMuted`, Web Audio nodes, decoded buffers, or the director.

- [ ] **Step 8: Run browser and production regressions**

Run:

```powershell
node tests/smoke.mjs
npm.cmd test
npm.cmd run build
```

Expected: desktop, portrait, normal-audio, audio-failure, story, renderer, collision, camera, and all unit/asset tests pass. No audio-related page error or unhandled rejection occurs.

- [ ] **Step 9: Commit browser integration**

From the repository root:

```powershell
git add rural-mutation-escape/src/audio-lifecycle.js rural-mutation-escape/src/main.js rural-mutation-escape/src/ui.js rural-mutation-escape/tests/unit.mjs rural-mutation-escape/tests/smoke.mjs
git commit -m "feat: wire trusted dynamic audio lifecycle"
```

---

### Task 8: Complete technical verification and the human listening gate

**Files:**
- Create: `docs/superpowers/validation/2026-07-29-rural-mutation-escape-dynamic-bgm-listening.md`

- [ ] **Step 1: Run the complete reproducible verification**

From the game directory with `RURAL_SCORE_FFMPEG` and `RURAL_SCORE_FFPROBE` set as in Task 2:

```powershell
npm.cmd run audio:verify
npm.cmd test
npm.cmd run build
```

Record the exact command results, compressed byte total, measured LUFS/true peak values, loop frame count, and Git commit in the validation document.

- [ ] **Step 2: Perform the headphone gate**

Using the production game flow, listen through at least one complete 48-second loop boundary and record actual observations for:

- initial unlock delay and two-second exploration fade;
- inaudible or acceptable loop boundary;
- long-term exploration-bed clarity under UI cues;
- two-second chase fade;
- 0.8-second near-threat escalation;
- fixed four-second recovery;
- reveal once at `escape_south_gate`;
- escape once at chapter completion while loops fade over five seconds;
- rapid mute/unmute and background/foreground without stacking or replay.

Do not mark this step passed from waveform inspection alone.

- [ ] **Step 3: Perform speaker and mobile gates**

On ordinary speakers, verify no audible clipping and that oscillator cues remain clear above the music. On iPhone Safari and Android Chrome, verify first unlock, looping, mute persistence, background recovery, and the 44-pixel sound control. Record the actual browser/device names and results.

- [ ] **Step 4: Resolve any failed listening item before acceptance**

Before changing a score or gain parameter, add the smallest deterministic asset, director, facade, or browser test that reproduces the failed boundary and run it to record RED. Then change the smallest responsible parameter, rerun that focused test to GREEN, followed by `audio:build`, `audio:verify`, `npm.cmd test`, and `npm.cmd run build`, and repeat the failed listening item. Do not record a pass until the regenerated hashes and measurements match the checked files.

- [ ] **Step 5: Commit truthful listening evidence**

From the repository root, after every recorded gate passes:

```powershell
git add rural-mutation-escape/docs/superpowers/validation/2026-07-29-rural-mutation-escape-dynamic-bgm-listening.md
git commit -m "docs: record dynamic music listening acceptance"
```

---

## Completion Checklist

- [ ] Four original WAV masters, eight compressed runtime assets, and one complete provenance manifest are committed.
- [ ] Both 48-second loops are sample-synchronized and remain on one loop generation through danger changes.
- [ ] `safe`, `chase`, `threaten`, `recover`, and `complete` produce the approved gains and transition times.
- [ ] Reveal and escape stingers each play once from production story events.
- [ ] Mute persistence, backgrounding, foregrounding, retry, disposal, and HMR cleanup are bounded and tested.
- [ ] The sound button truthfully renders locked, loading, playing, muted, and error states at desktop and portrait sizes.
- [ ] Asset failure leaves the complete game route and renderer operational.
- [ ] Runtime audio stays under the 4 MB compressed and 42 MB decoded-memory targets.
- [ ] Asset tests, unit tests, browser smoke tests, FFmpeg verification, and Vite production build pass.
- [ ] Headphone, speaker, iPhone Safari, and Android Chrome results are recorded from actual listening.
