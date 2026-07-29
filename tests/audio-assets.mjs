import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  SCORE_ASSETS,
  SCORE_FORMAT,
  analyzePcm16,
  encodePcm16Wav,
  inspectPcm16Wav,
  renderScoreAsset,
  sha256,
} from '../scripts/rural-score-core.mjs';

const projectRoot = new URL('../', import.meta.url);
const manifest = JSON.parse(
  await readFile(new URL('audio-source/manifest.json', projectRoot), 'utf8'),
);

const EXPECTED_ASSETS = [
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

const renderPairs = SCORE_ASSETS.map((definition) => [
  renderScoreAsset(definition),
  renderScoreAsset(definition),
]);

test('score definitions preserve the authored format and asset contract', () => {
  assert.deepEqual(SCORE_FORMAT, {
    sampleRate: 48_000,
    channels: 2,
    bitDepth: 16,
    bpm: 60,
  });
  assert.deepEqual(SCORE_ASSETS, EXPECTED_ASSETS);
});

test('fixed seeds render byte-identical PCM and source hashes', () => {
  for (const [first, second] of renderPairs) {
    assert.equal(first.sourcePcmSha256, second.sourcePcmSha256, first.definition.id);
    assert.deepEqual(first.pcm, second.pcm, first.definition.id);
  }
});

test('definition property insertion order cannot affect a deterministic render', () => {
  const original = SCORE_ASSETS[0];
  const reordered = {
    loopEnd: original.loopEnd,
    loopStart: original.loopStart,
    seed: original.seed,
    targetLufs: original.targetLufs,
    sampleFrames: original.sampleFrames,
    durationSeconds: original.durationSeconds,
    kind: original.kind,
    role: original.role,
    id: original.id,
  };
  assert.equal(
    renderScoreAsset(reordered).sourcePcmSha256,
    renderPairs[0][0].sourcePcmSha256,
  );
});

test('rendered PCM has exact dimensions and safe normalized analysis', () => {
  for (const [rendered] of renderPairs) {
    const { definition, pcm, analysis } = rendered;
    assert.equal(pcm.length, definition.sampleFrames * SCORE_FORMAT.channels);
    assert.ok(Object.values(analysis).every(Number.isFinite), definition.id);
    assert.ok(analysis.peak >= 0 && analysis.peak <= 1, definition.id);
    assert.ok(Math.abs(analysis.dcOffset) <= 1, definition.id);
    assert.ok(analysis.rms >= 0 && analysis.rms <= 1, definition.id);
    assert.ok(analysis.seamDelta >= 0 && analysis.seamDelta <= 1, definition.id);
    assert.ok(analysis.rms > 0.001, definition.id);
    assert.ok(Math.abs(analysis.dcOffset) < 0.01, definition.id);
  }
});

test('source masters retain headroom after their authored loudness gain', () => {
  for (const [rendered] of renderPairs) {
    const { definition, analysis } = rendered;
    const samplePeakDbfs = 20 * Math.log10(analysis.peak);
    const requiredGainDb = definition.targetLufs - analysis.approximateLufs;
    const predictedNormalizedPeakDbfs = samplePeakDbfs + requiredGainDb;
    assert.ok(
      predictedNormalizedPeakDbfs <= -2,
      `${definition.id} predicted normalized peak ${predictedNormalizedPeakDbfs}`,
    );
  }
});

test('loops close cleanly and stingers release to digital zero', () => {
  const tailWindowFrames = Math.round(SCORE_FORMAT.sampleRate * 0.04);

  for (const [rendered] of renderPairs) {
    const { definition, pcm, analysis } = rendered;
    if (definition.kind === 'loop') {
      assert.ok(analysis.seamDelta <= 0.02, definition.id);
      continue;
    }

    const lastFrameOffset = (definition.sampleFrames - 1) * SCORE_FORMAT.channels;
    assert.equal(pcm[lastFrameOffset], 0, `${definition.id} left final sample`);
    assert.equal(pcm[lastFrameOffset + 1], 0, `${definition.id} right final sample`);

    const releaseFrames = Math.round(SCORE_FORMAT.sampleRate * 0.16);
    const releaseStart = definition.sampleFrames - releaseFrames;
    const earlyTailStart = releaseStart * SCORE_FORMAT.channels;
    const lateTailStart =
      (definition.sampleFrames - tailWindowFrames) * SCORE_FORMAT.channels;
    const earlyTail = pcm.subarray(
      earlyTailStart,
      earlyTailStart + tailWindowFrames * SCORE_FORMAT.channels,
    );
    const lateTail = pcm.subarray(lateTailStart);
    const earlyAnalysis = analyzePcm16({
      pcm: earlyTail,
      sampleRate: SCORE_FORMAT.sampleRate,
      channels: SCORE_FORMAT.channels,
      kind: definition.kind,
    });
    const lateAnalysis = analyzePcm16({
      pcm: lateTail,
      sampleRate: SCORE_FORMAT.sampleRate,
      channels: SCORE_FORMAT.channels,
      kind: definition.kind,
    });
    assert.ok(lateAnalysis.rms < earlyAnalysis.rms, definition.id);
  }
});

test('loop boundary crossfades preserve edge energy and sample continuity', () => {
  const boundaryFrames = Math.round(SCORE_FORMAT.sampleRate * 0.1);

  for (const [rendered] of renderPairs) {
    const { definition, pcm } = rendered;
    if (definition.kind !== 'loop') {
      continue;
    }

    let boundarySquareSum = 0;
    let referenceSquareSum = 0;
    for (let frame = 0; frame < boundaryFrames; frame += 1) {
      const headOffset = frame * SCORE_FORMAT.channels;
      const headReferenceOffset =
        (boundaryFrames + frame) * SCORE_FORMAT.channels;
      const tailOffset =
        (definition.sampleFrames - boundaryFrames + frame) *
        SCORE_FORMAT.channels;
      const tailReferenceOffset =
        (definition.sampleFrames - 2 * boundaryFrames + frame) *
        SCORE_FORMAT.channels;

      for (let channel = 0; channel < SCORE_FORMAT.channels; channel += 1) {
        boundarySquareSum +=
          pcm[headOffset + channel] ** 2 + pcm[tailOffset + channel] ** 2;
        referenceSquareSum +=
          pcm[headReferenceOffset + channel] ** 2 +
          pcm[tailReferenceOffset + channel] ** 2;
      }
    }

    const boundaryToReferenceRms = Math.sqrt(
      boundarySquareSum / referenceSquareSum,
    );
    assert.ok(
      boundaryToReferenceRms >= 0.85 && boundaryToReferenceRms <= 1.25,
      `${definition.id} boundary/reference RMS ${boundaryToReferenceRms}`,
    );

    for (let channel = 0; channel < SCORE_FORMAT.channels; channel += 1) {
      const first = pcm[channel];
      const last =
        pcm[(definition.sampleFrames - 1) * SCORE_FORMAT.channels + channel];
      const seamDelta = Math.abs(last - first) / 32_768;
      assert.ok(seamDelta <= 0.02, `${definition.id} seam delta ${seamDelta}`);
    }
  }
});

test('escape resolution widens stereo while its low opening stays centered', () => {
  const escape = renderPairs.find(
    ([{ definition }]) => definition.id === 'south-gate-escape-stinger',
  )[0];
  for (const attackTime of [0, 1.5, 3]) {
    const openingStart = Math.round((attackTime + 0.05) * SCORE_FORMAT.sampleRate);
    const openingEnd = Math.round((attackTime + 1.0) * SCORE_FORMAT.sampleRate);
    for (let frame = openingStart; frame < openingEnd; frame += 1) {
      const offset = frame * SCORE_FORMAT.channels;
      assert.equal(escape.pcm[offset], escape.pcm[offset + 1]);
    }
  }

  const resolutionStart = Math.round(4.55 * SCORE_FORMAT.sampleRate);
  const resolutionEnd = Math.round(5.5 * SCORE_FORMAT.sampleRate);
  let leftSquareSum = 0;
  let rightSquareSum = 0;
  let productSum = 0;
  for (let frame = resolutionStart; frame < resolutionEnd; frame += 1) {
    const offset = frame * SCORE_FORMAT.channels;
    const left = escape.pcm[offset];
    const right = escape.pcm[offset + 1];
    leftSquareSum += left * left;
    rightSquareSum += right * right;
    productSum += left * right;
  }
  const correlation = productSum / Math.sqrt(leftSquareSum * rightSquareSum);
  const rmsRatio = Math.sqrt(leftSquareSum / rightSquareSum);
  assert.ok(correlation < 0.995, `resolution correlation ${correlation}`);
  assert.ok(rmsRatio >= 0.9 && rmsRatio <= 1.1, `resolution RMS ratio ${rmsRatio}`);
});

test('rendered source hashes match the rendered-stage provenance manifest', () => {
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.pipelineStage, 'rendered');
  assert.equal(
    manifest.provenance.source,
    'original procedural composition for rural-mutation-escape',
  );

  for (const [rendered] of renderPairs) {
    const asset = manifest.assets.find(({ id }) => id === rendered.definition.id);
    assert.ok(asset, rendered.definition.id);
    assert.equal(asset.sourcePcmSha256, rendered.sourcePcmSha256, asset.id);
  }
});

test('committed WAV masters are exact PCM16 renders with stable file hashes', async () => {
  for (const [rendered] of renderPairs) {
    const asset = manifest.assets.find(({ id }) => id === rendered.definition.id);
    const wav = await readFile(new URL(asset.files.wav.path, projectRoot));
    const inspected = inspectPcm16Wav(wav);

    assert.equal(wav.toString('ascii', 0, 4), 'RIFF', asset.id);
    assert.equal(inspected.audioFormat, 1, asset.id);
    assert.equal(inspected.bitDepth, SCORE_FORMAT.bitDepth, asset.id);
    assert.equal(inspected.channels, SCORE_FORMAT.channels, asset.id);
    assert.equal(inspected.sampleRate, SCORE_FORMAT.sampleRate, asset.id);
    assert.equal(inspected.sampleFrames, asset.sampleFrames, asset.id);
    assert.equal(inspected.durationSeconds, asset.durationSeconds, asset.id);
    assert.equal(asset.files.wav.bytes, wav.byteLength, asset.id);
    assert.equal(sha256(wav), asset.files.wav.sha256, asset.id);
    assert.deepEqual(inspected.pcm, rendered.pcm, asset.id);
    assert.deepEqual(
      encodePcm16Wav({
        pcm: rendered.pcm,
        sampleRate: SCORE_FORMAT.sampleRate,
        channels: SCORE_FORMAT.channels,
      }),
      wav,
      asset.id,
    );
  }
});

test('decoded Web Audio PCM stays within the authored memory budget', () => {
  const decodedBytes = SCORE_ASSETS.reduce(
    (total, asset) => total + asset.sampleFrames * SCORE_FORMAT.channels * 4,
    0,
  );
  assert.ok(decodedBytes <= 42_000_000, `${decodedBytes} decoded bytes`);
});
