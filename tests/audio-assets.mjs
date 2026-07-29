import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  SCORE_ASSETS,
  SCORE_FORMAT,
  analyzePcm16,
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
    const { definition, pcm } = rendered;
    let normalizedPeak = 0;
    let normalizedSquareSum = 0;
    for (const sample of pcm) {
      const normalized = sample / 32_768;
      normalizedPeak = Math.max(normalizedPeak, Math.abs(normalized));
      normalizedSquareSum += normalized * normalized;
    }
    const normalizedRms = Math.sqrt(normalizedSquareSum / pcm.length);
    const samplePeakDbfs = 20 * Math.log10(Math.max(normalizedPeak, 1e-12));
    const approximateLufs =
      -0.691 + 20 * Math.log10(Math.max(normalizedRms, 1e-12));
    const requiredGainDb = definition.targetLufs - approximateLufs;
    const predictedNormalizedPeakDbfs = samplePeakDbfs + requiredGainDb;
    assert.ok(
      predictedNormalizedPeakDbfs <= -2,
      `${definition.id} predicted normalized peak ${predictedNormalizedPeakDbfs} ` +
        `(sample peak ${samplePeakDbfs}, loudness proxy ${approximateLufs})`,
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

test('encoded manifest preserves deterministic rendered-source provenance', () => {
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.pipelineStage, 'encoded');
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

test('encoded manifest records the reproducible encoder contract', () => {
  assert.deepEqual(manifest.encoder.normalization, {
    mode: 'measured-constant-gain',
    measurement: 'loudnorm JSON, TP=-2, LRA=7',
    output: 'pcm_s16le, 48000 Hz, stereo, exact declared frames',
  });
  assert.equal(manifest.encoder.ogg.codec, 'libvorbis');
  assert.equal(manifest.encoder.ogg.quality, 4);
  assert.equal(manifest.encoder.ogg.bitExact, true);
  assert.equal(manifest.encoder.ogg.serialOffset, 0);
  assert.equal(manifest.encoder.ogg.metadata, 'stripped');
  assert.ok(Array.isArray(manifest.encoder.ogg.argv));
  assert.equal(manifest.encoder.mp3.codec, 'libmp3lame');
  assert.equal(manifest.encoder.mp3.bitrate, '96k');
  assert.equal(manifest.encoder.mp3.bitExact, true);
  assert.equal(manifest.encoder.mp3.writeXing, true);
  assert.equal(manifest.encoder.mp3.id3v1, false);
  assert.equal(manifest.encoder.mp3.id3v2, false);
  assert.equal(manifest.encoder.mp3.metadata, 'stripped');
  assert.ok(Array.isArray(manifest.encoder.mp3.argv));
});

test('encoded verification rejects phantom assets and false normalization provenance', async () => {
  const {
    validateNormalizationProvenance,
    validateScoreManifestAssets,
  } = await import('../scripts/encode-rural-score.mjs');

  assert.equal(typeof validateScoreManifestAssets, 'function');
  assert.doesNotThrow(() => validateScoreManifestAssets(manifest.assets));
  assert.throws(
    () =>
      validateScoreManifestAssets([
        ...manifest.assets,
        { ...manifest.assets[0] },
      ]),
    /exactly 4 assets/,
  );
  assert.throws(
    () =>
      validateScoreManifestAssets([
        ...manifest.assets.slice(0, 3),
        { ...manifest.assets[0], role: 'escape' },
      ]),
    /unique asset IDs/,
  );

  assert.equal(typeof validateNormalizationProvenance, 'function');
  const reveal = manifest.assets.find(
    ({ id }) => id === 'mutation-reveal-stinger',
  );
  assert.deepEqual(
    validateNormalizationProvenance(reveal, {
      integratedLufs: -25.44,
      truePeakDbtp: -11.78,
    }),
    {
      gainDb: 7.44,
      predictedTruePeakDbtp: -4.34,
    },
  );
  assert.throws(
    () =>
      validateNormalizationProvenance(
        {
          ...reveal,
          files: {
            ...reveal.files,
            wav: {
              ...reveal.files.wav,
              normalizationGainDb: 7.43,
            },
          },
        },
        {
          integratedLufs: -25.44,
          truePeakDbtp: -11.78,
        },
      ),
    /normalization gain/,
  );
});

test('committed encoded files match manifest hashes, sizes, format, duration, and mix limits', async () => {
  const compressedFiles = [];

  for (const [rendered] of renderPairs) {
    const asset = manifest.assets.find(({ id }) => id === rendered.definition.id);
    assert.ok(asset, rendered.definition.id);
    assert.equal(asset.sourcePcmSha256, rendered.sourcePcmSha256, asset.id);

    for (const codec of ['wav', 'ogg', 'mp3']) {
      const fileRecord = asset.files[codec];
      assert.ok(fileRecord, `${asset.id} ${codec}`);
      const file = await readFile(new URL(fileRecord.path, projectRoot));
      assert.equal(fileRecord.bytes, file.byteLength, `${asset.id} ${codec} bytes`);
      assert.equal(sha256(file), fileRecord.sha256, `${asset.id} ${codec} hash`);
      assert.equal(fileRecord.sampleRate, SCORE_FORMAT.sampleRate, `${asset.id} ${codec}`);
      assert.equal(fileRecord.channels, SCORE_FORMAT.channels, `${asset.id} ${codec}`);
      assert.ok(
        Math.abs(fileRecord.integratedLufs - asset.targetLufs) <= 1,
        `${asset.id} ${codec} loudness ${fileRecord.integratedLufs}`,
      );
      assert.ok(
        fileRecord.truePeakDbtp <= (codec === 'wav' ? -2 : -1),
        `${asset.id} ${codec} peak ${fileRecord.truePeakDbtp}`,
      );

      const durationDriftSamples =
        Math.abs(fileRecord.durationSeconds - asset.durationSeconds) *
        SCORE_FORMAT.sampleRate;
      assert.ok(
        durationDriftSamples <= (codec === 'mp3' ? 1_152 : 1) + 1e-9,
        `${asset.id} ${codec} duration drift ${durationDriftSamples} samples`,
      );

      if (codec !== 'wav') {
        compressedFiles.push(fileRecord);
      }
    }

    const wav = await readFile(new URL(asset.files.wav.path, projectRoot));
    const inspected = inspectPcm16Wav(wav);
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF', asset.id);
    assert.equal(inspected.audioFormat, 1, asset.id);
    assert.equal(inspected.bitDepth, SCORE_FORMAT.bitDepth, asset.id);
    assert.equal(inspected.channels, SCORE_FORMAT.channels, asset.id);
    assert.equal(inspected.sampleRate, SCORE_FORMAT.sampleRate, asset.id);
    assert.equal(inspected.sampleFrames, asset.sampleFrames, asset.id);
    assert.equal(asset.files.wav.sampleFrames, asset.sampleFrames, asset.id);
    assert.equal(inspected.durationSeconds, asset.durationSeconds, asset.id);
    if (asset.kind === 'loop') {
      assert.ok(asset.files.wav.seamDelta <= 0.02, asset.id);
    }
  }

  const compressedBytes = compressedFiles.reduce(
    (total, file) => total + file.bytes,
    0,
  );
  assert.ok(compressedBytes <= 4_000_000, `${compressedBytes} compressed bytes`);
});

test('decoded codec sets stay within their independent Web Audio memory budgets', () => {
  const loopAssets = manifest.assets.filter(({ kind }) => kind === 'loop');

  for (const codec of ['ogg', 'mp3']) {
    assert.equal(
      loopAssets[0].files[codec].decodedSampleFrames,
      loopAssets[1].files[codec].decodedSampleFrames,
      `${codec} loop decoded frames`,
    );
    assert.equal(
      loopAssets[0].files[codec].decodedSampleFrames,
      2_304_000,
      `${codec} loop length`,
    );

    const decodedBytes = manifest.assets.reduce(
      (total, asset) =>
        total +
        asset.files[codec].decodedSampleFrames *
          asset.files[codec].channels *
          4,
      0,
    );
    assert.equal(manifest.decodedBytesByCodec[codec], decodedBytes, codec);
    assert.ok(decodedBytes <= 42_000_000, `${codec} ${decodedBytes} decoded bytes`);
  }
});

test('codec peak measurements prove the phase-independent maximum-runtime mix bound', () => {
  const byRole = Object.fromEntries(
    manifest.assets.map((asset) => [asset.role, asset]),
  );

  for (const codec of ['ogg', 'mp3']) {
    const linearPeak = (role) =>
      10 ** (byRole[role].files[codec].truePeakDbtp / 20);
    const upperBound =
      0.28 *
      (linearPeak('danger') +
        linearPeak('exploration') * 0.707946 +
        Math.max(linearPeak('reveal'), linearPeak('escape')) +
        8 * 0.08);
    const upperBoundDbfs = 20 * Math.log10(upperBound);

    assert.ok(
      Math.abs(
        manifest.runtimeMixAnalysis.upperBoundDbfsByCodec[codec] -
          upperBoundDbfs,
      ) <= 0.000_001,
      `${codec} recorded runtime bound`,
    );
    assert.ok(upperBoundDbfs <= -1, `${codec} runtime bound ${upperBoundDbfs}`);
  }
});
