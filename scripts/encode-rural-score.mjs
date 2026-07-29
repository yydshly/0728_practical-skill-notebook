import { spawn } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  SCORE_ASSETS,
  SCORE_FORMAT,
  analyzePcm16,
  encodePcm16Wav,
  inspectPcm16Wav,
  renderScoreAsset,
  sha256,
} from './rural-score-core.mjs';

const MAX_DECODED_BYTES = 42_000_000;
const MAX_COMPRESSED_BYTES = 4_000_000;
const WAV_TRUE_PEAK_LIMIT_DBTP = -2;
const CODEC_TRUE_PEAK_LIMIT_DBTP = -1;
const RUNTIME_TRUE_PEAK_LIMIT_DBFS = -1;
const LOOP_SEAM_LIMIT = 0.02;
const RUNTIME_MIX_DEFINITION =
  'phase-independent sum of danger 1.0, exploration 0.707946, louder stinger, eight 0.08 oscillator peaks, then master 0.28';

const OGG_ARGV = [
  '-hide_banner',
  '-nostdin',
  '-y',
  '-loglevel',
  'error',
  '-i',
  '{input}',
  '-map',
  '0:a:0',
  '-ar',
  '48000',
  '-ac',
  '2',
  '-c:a',
  'libvorbis',
  '-q:a',
  '4',
  '-fflags',
  '+bitexact',
  '-flags:a',
  '+bitexact',
  '-map_metadata',
  '-1',
  '-serial_offset',
  '0',
  '{output}',
];

const MP3_ARGV = [
  '-hide_banner',
  '-nostdin',
  '-y',
  '-loglevel',
  'error',
  '-i',
  '{input}',
  '-map',
  '0:a:0',
  '-ar',
  '48000',
  '-ac',
  '2',
  '-c:a',
  'libmp3lame',
  '-b:a',
  '96k',
  '-fflags',
  '+bitexact',
  '-flags:a',
  '+bitexact',
  '-map_metadata',
  '-1',
  '-write_xing',
  '1',
  '-id3v2_version',
  '0',
  '-write_id3v1',
  '0',
  '{output}',
];

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function exact(actual, expected, label) {
  invariant(
    Object.is(actual, expected),
    `${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
  );
}

function round(value, fractionDigits = 6) {
  return Number(value.toFixed(fractionDigits));
}

function resolveProjectRoot(projectRoot) {
  return projectRoot instanceof URL
    ? fileURLToPath(projectRoot)
    : resolve(projectRoot);
}

function renderArgv(template, input, output) {
  return template.map((argument) => {
    if (argument === '{input}') {
      return input;
    }
    if (argument === '{output}') {
      return output;
    }
    return argument;
  });
}

async function runProcess(executable, argv) {
  return await new Promise((resolveProcess, rejectProcess) => {
    const child = spawn(executable, argv, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout = [];
    const stderr = [];

    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.once('error', rejectProcess);
    child.once('close', (code, signal) => {
      const stdoutBuffer = Buffer.concat(stdout);
      const stderrBuffer = Buffer.concat(stderr);
      if (code !== 0) {
        rejectProcess(
          new Error(
            `${executable} exited with ${signal ?? code}\n${stderrBuffer.toString('utf8')}`,
          ),
        );
        return;
      }
      resolveProcess({ stdout: stdoutBuffer, stderr: stderrBuffer });
    });
  });
}

async function toolVersion(executable) {
  const { stdout } = await runProcess(executable, ['-version']);
  return stdout.toString('utf8').split(/\r?\n/, 1)[0].trim();
}

function parseLoudnorm(stderr, label) {
  const jsonBlocks = stderr
    .toString('utf8')
    .match(/\{\s*"input_i"\s*:[\s\S]*?\}/g);
  invariant(jsonBlocks?.length > 0, `${label}: missing loudnorm JSON`);
  const measured = JSON.parse(jsonBlocks.at(-1));
  const integratedLufs = Number(measured.input_i);
  const truePeakDbtp = Number(measured.input_tp);
  invariant(
    Number.isFinite(integratedLufs) && Number.isFinite(truePeakDbtp),
    `${label}: non-finite loudness measurement`,
  );
  return {
    integratedLufs: round(integratedLufs, 2),
    truePeakDbtp: round(truePeakDbtp, 2),
  };
}

async function measureLoudness(ffmpegPath, inputPath, targetLufs, label) {
  const { stderr } = await runProcess(ffmpegPath, [
    '-hide_banner',
    '-nostdin',
    '-nostats',
    '-i',
    inputPath,
    '-af',
    `loudnorm=I=${targetLufs}:TP=-2:LRA=7:print_format=json`,
    '-f',
    'null',
    '-',
  ]);
  return parseLoudnorm(stderr, label);
}

async function probeStream(ffprobePath, inputPath, label) {
  const { stdout } = await runProcess(ffprobePath, [
    '-v',
    'error',
    '-select_streams',
    'a:0',
    '-show_entries',
    'stream=codec_name,sample_rate,channels,duration:format=duration',
    '-of',
    'json',
    inputPath,
  ]);
  const result = JSON.parse(stdout.toString('utf8'));
  const stream = result.streams?.[0];
  invariant(stream, `${label}: missing audio stream`);
  const streamDuration = Number(stream.duration);
  const formatDuration = Number(result.format?.duration);
  const durationSeconds = Number.isFinite(streamDuration)
    ? streamDuration
    : formatDuration;
  invariant(Number.isFinite(durationSeconds), `${label}: missing duration`);
  return {
    codec: stream.codec_name,
    sampleRate: Number(stream.sample_rate),
    channels: Number(stream.channels),
    durationSeconds,
  };
}

async function countDecodedFrames(ffmpegPath, inputPath, label) {
  const { stdout } = await runProcess(ffmpegPath, [
    '-hide_banner',
    '-nostdin',
    '-loglevel',
    'error',
    '-i',
    inputPath,
    '-map',
    '0:a:0',
    '-ar',
    '48000',
    '-ac',
    '2',
    '-c:a',
    'pcm_s16le',
    '-f',
    's16le',
    '-',
  ]);
  const bytesPerFrame = SCORE_FORMAT.channels * 2;
  invariant(
    stdout.byteLength % bytesPerFrame === 0,
    `${label}: decoded PCM is not aligned to complete frames`,
  );
  return stdout.byteLength / bytesPerFrame;
}

function validateDuration(asset, codec, durationSeconds) {
  const driftSamples =
    Math.abs(durationSeconds - asset.durationSeconds) * SCORE_FORMAT.sampleRate;
  const maximumDrift = codec === 'mp3' ? 1_152 : 1;
  invariant(
    driftSamples <= maximumDrift + 1e-9,
    `${asset.id} ${codec}: duration drift ${driftSamples} samples exceeds ${maximumDrift}`,
  );
}

function validateLoudness(asset, codec, measurement) {
  invariant(
    Math.abs(measurement.integratedLufs - asset.targetLufs) <= 1,
    `${asset.id} ${codec}: ${measurement.integratedLufs} LUFS misses target ${asset.targetLufs}`,
  );
  const peakLimit =
    codec === 'wav' ? WAV_TRUE_PEAK_LIMIT_DBTP : CODEC_TRUE_PEAK_LIMIT_DBTP;
  invariant(
    measurement.truePeakDbtp <= peakLimit,
    `${asset.id} ${codec}: ${measurement.truePeakDbtp} dBTP exceeds ${peakLimit}`,
  );
}

function validateDefinition(manifestAsset, definition) {
  for (const key of [
    'id',
    'role',
    'kind',
    'seed',
    'durationSeconds',
    'sampleFrames',
    'targetLufs',
  ]) {
    exact(manifestAsset[key], definition[key], `${definition.id} ${key}`);
  }
  if (definition.kind === 'loop') {
    exact(manifestAsset.loopStart, definition.loopStart, `${definition.id} loopStart`);
    exact(manifestAsset.loopEnd, definition.loopEnd, `${definition.id} loopEnd`);
  }
}

export function validateScoreManifestAssets(assets) {
  invariant(Array.isArray(assets), 'manifest assets must be an array');
  invariant(
    assets.length === SCORE_ASSETS.length,
    `manifest must contain exactly ${SCORE_ASSETS.length} assets`,
  );

  const ids = assets.map(({ id }) => id);
  const roles = assets.map(({ role }) => role);
  invariant(new Set(ids).size === ids.length, 'manifest requires unique asset IDs');
  invariant(
    new Set(roles).size === roles.length,
    'manifest requires unique asset roles',
  );
  exact(
    JSON.stringify([...ids].sort()),
    JSON.stringify(SCORE_ASSETS.map(({ id }) => id).sort()),
    'manifest asset IDs',
  );
  exact(
    JSON.stringify([...roles].sort()),
    JSON.stringify(SCORE_ASSETS.map(({ role }) => role).sort()),
    'manifest asset roles',
  );
  return assets;
}

export function validateNormalizationProvenance(asset, sourceMeasurement) {
  const gainDb = round(
    asset.targetLufs - sourceMeasurement.integratedLufs,
    2,
  );
  const predictedTruePeakDbtp = round(
    sourceMeasurement.truePeakDbtp + gainDb,
    2,
  );
  invariant(
    predictedTruePeakDbtp <= WAV_TRUE_PEAK_LIMIT_DBTP,
    `${asset.id}: required ${gainDb} dB gain predicts ${predictedTruePeakDbtp} dBTP`,
  );
  if (asset.files?.wav?.normalizationGainDb !== undefined) {
    exact(
      asset.files.wav.normalizationGainDb,
      gainDb,
      `${asset.id} normalization gain`,
    );
  }
  return { gainDb, predictedTruePeakDbtp };
}

function inspectWavBuffer(buffer, asset, measurement, normalizationGainDb) {
  const inspected = inspectPcm16Wav(buffer);
  exact(inspected.audioFormat, 1, `${asset.id} wav codec`);
  exact(inspected.bitDepth, SCORE_FORMAT.bitDepth, `${asset.id} wav bit depth`);
  exact(inspected.sampleRate, SCORE_FORMAT.sampleRate, `${asset.id} wav sample rate`);
  exact(inspected.channels, SCORE_FORMAT.channels, `${asset.id} wav channels`);
  exact(inspected.sampleFrames, asset.sampleFrames, `${asset.id} wav frames`);
  validateDuration(asset, 'wav', inspected.durationSeconds);
  validateLoudness(asset, 'wav', measurement);

  const analysis = analyzePcm16({
    pcm: inspected.pcm,
    sampleRate: inspected.sampleRate,
    channels: inspected.channels,
    kind: asset.kind,
  });
  if (asset.kind === 'loop') {
    invariant(
      analysis.seamDelta <= LOOP_SEAM_LIMIT,
      `${asset.id} wav: seam ${analysis.seamDelta} exceeds ${LOOP_SEAM_LIMIT}`,
    );
  }

  return {
    path: `audio-source/masters/${asset.id}.wav`,
    bytes: buffer.byteLength,
    sha256: sha256(buffer),
    sampleRate: inspected.sampleRate,
    channels: inspected.channels,
    sampleFrames: inspected.sampleFrames,
    durationSeconds: round(inspected.durationSeconds, 6),
    normalizationGainDb: round(normalizationGainDb, 2),
    integratedLufs: measurement.integratedLufs,
    truePeakDbtp: measurement.truePeakDbtp,
    seamDelta: analysis.seamDelta,
  };
}

async function inspectCompressedFile({
  asset,
  codec,
  expectedCodec,
  filePath,
  relativePath,
  ffmpegPath,
  ffprobePath,
}) {
  const buffer = await readFile(filePath);
  const stream = await probeStream(ffprobePath, filePath, `${asset.id} ${codec}`);
  exact(stream.codec, expectedCodec, `${asset.id} ${codec} codec`);
  exact(stream.sampleRate, SCORE_FORMAT.sampleRate, `${asset.id} ${codec} sample rate`);
  exact(stream.channels, SCORE_FORMAT.channels, `${asset.id} ${codec} channels`);
  validateDuration(asset, codec, stream.durationSeconds);

  const measurement = await measureLoudness(
    ffmpegPath,
    filePath,
    asset.targetLufs,
    `${asset.id} ${codec}`,
  );
  validateLoudness(asset, codec, measurement);
  const decodedSampleFrames = await countDecodedFrames(
    ffmpegPath,
    filePath,
    `${asset.id} ${codec}`,
  );
  exact(
    decodedSampleFrames,
    asset.sampleFrames,
    `${asset.id} ${codec} decoded frames`,
  );

  return {
    path: relativePath,
    bytes: buffer.byteLength,
    sha256: sha256(buffer),
    sampleRate: stream.sampleRate,
    channels: stream.channels,
    durationSeconds: round(stream.durationSeconds, 6),
    decodedSampleFrames,
    integratedLufs: measurement.integratedLufs,
    truePeakDbtp: measurement.truePeakDbtp,
  };
}

function calculateAggregateAnalysis(assets) {
  const decodedBytesByCodec = {};
  for (const codec of ['ogg', 'mp3']) {
    const loopFrames = assets
      .filter(({ kind }) => kind === 'loop')
      .map((asset) => asset.files[codec].decodedSampleFrames);
    invariant(
      loopFrames.length === 2 && loopFrames[0] === loopFrames[1],
      `${codec}: loop decoded frame counts differ`,
    );
    exact(loopFrames[0], 2_304_000, `${codec} loop decoded frames`);

    decodedBytesByCodec[codec] = assets.reduce(
      (total, asset) =>
        total +
        asset.files[codec].decodedSampleFrames *
          asset.files[codec].channels *
          4,
      0,
    );
    invariant(
      decodedBytesByCodec[codec] <= MAX_DECODED_BYTES,
      `${codec}: ${decodedBytesByCodec[codec]} decoded bytes exceeds ${MAX_DECODED_BYTES}`,
    );
  }

  const byRole = Object.fromEntries(assets.map((asset) => [asset.role, asset]));
  const upperBoundDbfsByCodec = {};
  for (const codec of ['ogg', 'mp3']) {
    const peak = (role) =>
      10 ** (byRole[role].files[codec].truePeakDbtp / 20);
    const upperBound =
      0.28 *
      (peak('danger') +
        peak('exploration') * 0.707946 +
        Math.max(peak('reveal'), peak('escape')) +
        8 * 0.08);
    upperBoundDbfsByCodec[codec] = round(20 * Math.log10(upperBound), 6);
    invariant(
      upperBoundDbfsByCodec[codec] <= RUNTIME_TRUE_PEAK_LIMIT_DBFS,
      `${codec}: runtime peak bound ${upperBoundDbfsByCodec[codec]} dBFS exceeds ${RUNTIME_TRUE_PEAK_LIMIT_DBFS}`,
    );
  }

  const compressedBytes = assets.reduce(
    (total, asset) => total + asset.files.ogg.bytes + asset.files.mp3.bytes,
    0,
  );
  invariant(
    compressedBytes <= MAX_COMPRESSED_BYTES,
    `${compressedBytes} compressed bytes exceeds ${MAX_COMPRESSED_BYTES}`,
  );

  return {
    decodedBytesByCodec,
    runtimeMixAnalysis: {
      definition: RUNTIME_MIX_DEFINITION,
      upperBoundDbfsByCodec,
    },
    compressedBytes,
  };
}

async function atomicWrite(destination, contents) {
  await mkdir(dirname(destination), { recursive: true });
  const temporary = `${destination}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, contents);
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function writeNormalizedWav({
  definition,
  sourcePath,
  outputPath,
  gainDb,
  ffmpegPath,
}) {
  await runProcess(ffmpegPath, [
    '-hide_banner',
    '-nostdin',
    '-y',
    '-loglevel',
    'error',
    '-i',
    sourcePath,
    '-map',
    '0:a:0',
    '-af',
    `volume=${round(gainDb, 8)}dB,atrim=end_sample=${definition.sampleFrames},asetpts=PTS-STARTPTS`,
    '-ar',
    '48000',
    '-ac',
    '2',
    '-c:a',
    'pcm_s16le',
    '-fflags',
    '+bitexact',
    '-flags:a',
    '+bitexact',
    '-map_metadata',
    '-1',
    '-write_bext',
    '0',
    outputPath,
  ]);
}

async function normalizeAndEncodeAsset({
  manifestAsset,
  definition,
  tempDirectory,
  ffmpegPath,
  ffprobePath,
}) {
  validateDefinition(manifestAsset, definition);
  const rendered = renderScoreAsset(definition);
  exact(
    rendered.sourcePcmSha256,
    manifestAsset.sourcePcmSha256,
    `${definition.id} source PCM hash`,
  );

  const renderedWav = encodePcm16Wav({
    pcm: rendered.pcm,
    sampleRate: SCORE_FORMAT.sampleRate,
    channels: SCORE_FORMAT.channels,
  });
  exact(
    sha256(renderedWav),
    manifestAsset.files.wav.sha256,
    `${definition.id} rendered WAV hash`,
  );

  const sourcePath = join(tempDirectory, `${definition.id}.source.wav`);
  const normalizedPath = join(tempDirectory, `${definition.id}.wav`);
  const oggPath = join(tempDirectory, `${definition.id}.ogg`);
  const mp3Path = join(tempDirectory, `${definition.id}.mp3`);
  await writeFile(sourcePath, renderedWav);

  const sourceMeasurement = await measureLoudness(
    ffmpegPath,
    sourcePath,
    definition.targetLufs,
    `${definition.id} source`,
  );
  const { gainDb } = validateNormalizationProvenance(
    definition,
    sourceMeasurement,
  );

  await writeNormalizedWav({
    definition,
    sourcePath,
    outputPath: normalizedPath,
    gainDb,
    ffmpegPath,
  });

  const wavBuffer = await readFile(normalizedPath);
  const wavMeasurement = await measureLoudness(
    ffmpegPath,
    normalizedPath,
    definition.targetLufs,
    `${definition.id} wav`,
  );
  const wavRecord = inspectWavBuffer(
    wavBuffer,
    definition,
    wavMeasurement,
    gainDb,
  );

  await runProcess(ffmpegPath, renderArgv(OGG_ARGV, normalizedPath, oggPath));
  await runProcess(ffmpegPath, renderArgv(MP3_ARGV, normalizedPath, mp3Path));

  const oggRecord = await inspectCompressedFile({
    asset: definition,
    codec: 'ogg',
    expectedCodec: 'vorbis',
    filePath: oggPath,
    relativePath: `src/assets/audio/${definition.id}.ogg`,
    ffmpegPath,
    ffprobePath,
  });
  const mp3Record = await inspectCompressedFile({
    asset: definition,
    codec: 'mp3',
    expectedCodec: 'mp3',
    filePath: mp3Path,
    relativePath: `src/assets/audio/${definition.id}.mp3`,
    ffmpegPath,
    ffprobePath,
  });

  return {
    manifestAsset: {
      id: definition.id,
      role: definition.role,
      kind: definition.kind,
      seed: definition.seed,
      durationSeconds: definition.durationSeconds,
      sampleFrames: definition.sampleFrames,
      targetLufs: definition.targetLufs,
      ...(definition.kind === 'loop'
        ? {
            loopStart: definition.loopStart,
            loopEnd: definition.loopEnd,
          }
        : {}),
      sourcePcmSha256: rendered.sourcePcmSha256,
      analysis: manifestAsset.analysis,
      files: {
        wav: wavRecord,
        ogg: oggRecord,
        mp3: mp3Record,
      },
    },
    outputs: {
      wav: { path: normalizedPath, buffer: wavBuffer },
      ogg: { path: oggPath, buffer: await readFile(oggPath) },
      mp3: { path: mp3Path, buffer: await readFile(mp3Path) },
    },
    sourceMeasurement,
  };
}

async function verifyRecordedFile(record, actual, label) {
  exact(record.path, actual.path, `${label} path`);
  exact(record.bytes, actual.bytes, `${label} bytes`);
  exact(record.sha256, actual.sha256, `${label} hash`);
  exact(record.sampleRate, actual.sampleRate, `${label} sample rate`);
  exact(record.channels, actual.channels, `${label} channels`);
  exact(record.durationSeconds, actual.durationSeconds, `${label} duration`);
  exact(record.integratedLufs, actual.integratedLufs, `${label} loudness`);
  exact(record.truePeakDbtp, actual.truePeakDbtp, `${label} true peak`);
}

async function verifyEncodedAsset({
  asset,
  definition,
  projectDirectory,
  tempDirectory,
  ffmpegPath,
  ffprobePath,
  encoder,
}) {
  validateDefinition(asset, definition);
  const rendered = renderScoreAsset(definition);
  exact(
    asset.sourcePcmSha256,
    rendered.sourcePcmSha256,
    `${asset.id} source PCM hash`,
  );

  const renderedWav = encodePcm16Wav({
    pcm: rendered.pcm,
    sampleRate: SCORE_FORMAT.sampleRate,
    channels: SCORE_FORMAT.channels,
  });
  const renderedSourcePath = join(tempDirectory, `${asset.id}.source.wav`);
  const reproducedWavPath = join(tempDirectory, `${asset.id}.normalized.wav`);
  await writeFile(renderedSourcePath, renderedWav);
  const sourceMeasurement = await measureLoudness(
    ffmpegPath,
    renderedSourcePath,
    asset.targetLufs,
    `${asset.id} source`,
  );
  const { gainDb } = validateNormalizationProvenance(asset, sourceMeasurement);
  await writeNormalizedWav({
    definition,
    sourcePath: renderedSourcePath,
    outputPath: reproducedWavPath,
    gainDb,
    ffmpegPath,
  });
  const reproducedWav = await readFile(reproducedWavPath);
  exact(
    sha256(reproducedWav),
    asset.files.wav.sha256,
    `${asset.id} deterministic normalized WAV hash`,
  );

  const wavPath = join(projectDirectory, ...asset.files.wav.path.split('/'));
  const wavBuffer = await readFile(wavPath);
  exact(wavBuffer.byteLength, asset.files.wav.bytes, `${asset.id} wav bytes`);
  exact(sha256(wavBuffer), asset.files.wav.sha256, `${asset.id} wav hash`);
  const wavMeasurement = await measureLoudness(
    ffmpegPath,
    wavPath,
    asset.targetLufs,
    `${asset.id} wav`,
  );
  const actualWav = inspectWavBuffer(
    wavBuffer,
    asset,
    wavMeasurement,
    asset.files.wav.normalizationGainDb,
  );
  await verifyRecordedFile(asset.files.wav, actualWav, `${asset.id} wav`);
  exact(
    asset.files.wav.sampleFrames,
    actualWav.sampleFrames,
    `${asset.id} wav frames`,
  );
  exact(
    gainDb,
    actualWav.normalizationGainDb,
    `${asset.id} normalization gain`,
  );
  exact(
    asset.files.wav.seamDelta,
    actualWav.seamDelta,
    `${asset.id} wav seam`,
  );

  for (const [codec, expectedCodec] of [
    ['ogg', 'vorbis'],
    ['mp3', 'mp3'],
  ]) {
    const record = asset.files[codec];
    const inputPath = join(projectDirectory, ...record.path.split('/'));
    const actual = await inspectCompressedFile({
      asset,
      codec,
      expectedCodec,
      filePath: inputPath,
      relativePath: record.path,
      ffmpegPath,
      ffprobePath,
    });
    await verifyRecordedFile(record, actual, `${asset.id} ${codec}`);
    exact(
      record.decodedSampleFrames,
      actual.decodedSampleFrames,
      `${asset.id} ${codec} decoded frames`,
    );

    const deterministicPath = join(tempDirectory, `${asset.id}.${codec}`);
    await runProcess(
      ffmpegPath,
      renderArgv(encoder[codec].argv, wavPath, deterministicPath),
    );
    const deterministicBuffer = await readFile(deterministicPath);
    exact(
      sha256(deterministicBuffer),
      record.sha256,
      `${asset.id} ${codec} deterministic hash`,
    );
  }
}

function buildEncoderManifest(ffmpegVersion, ffprobeVersion) {
  return {
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
      argv: OGG_ARGV,
    },
    mp3: {
      codec: 'libmp3lame',
      bitrate: '96k',
      bitExact: true,
      writeXing: true,
      id3v1: false,
      id3v2: false,
      metadata: 'stripped',
      argv: MP3_ARGV,
    },
  };
}

async function verifyOnly({
  manifest,
  projectDirectory,
  tempDirectory,
  ffmpegPath,
  ffprobePath,
  ffmpegVersion,
  ffprobeVersion,
}) {
  exact(manifest.pipelineStage, 'encoded', 'manifest pipeline stage');
  validateScoreManifestAssets(manifest.assets);
  exact(manifest.encoder.ffmpegVersion, ffmpegVersion, 'FFmpeg version');
  exact(manifest.encoder.ffprobeVersion, ffprobeVersion, 'FFprobe version');
  exact(
    JSON.stringify(manifest.encoder),
    JSON.stringify(buildEncoderManifest(ffmpegVersion, ffprobeVersion)),
    'encoder contract',
  );

  const verifiedAssets = [];
  for (const definition of SCORE_ASSETS) {
    const asset = manifest.assets.find(({ id }) => id === definition.id);
    invariant(asset, `${definition.id}: missing manifest asset`);
    await verifyEncodedAsset({
      asset,
      definition,
      projectDirectory,
      tempDirectory,
      ffmpegPath,
      ffprobePath,
      encoder: manifest.encoder,
    });
    verifiedAssets.push(asset);
  }

  const aggregate = calculateAggregateAnalysis(verifiedAssets);
  exact(
    manifest.decodedBytesByCodec.ogg,
    aggregate.decodedBytesByCodec.ogg,
    'OGG decoded bytes',
  );
  exact(
    manifest.decodedBytesByCodec.mp3,
    aggregate.decodedBytesByCodec.mp3,
    'MP3 decoded bytes',
  );
  exact(
    manifest.runtimeMixAnalysis.definition,
    aggregate.runtimeMixAnalysis.definition,
    'runtime mix definition',
  );
  exact(
    manifest.runtimeMixAnalysis.upperBoundDbfsByCodec.ogg,
    aggregate.runtimeMixAnalysis.upperBoundDbfsByCodec.ogg,
    'OGG runtime mix bound',
  );
  exact(
    manifest.runtimeMixAnalysis.upperBoundDbfsByCodec.mp3,
    aggregate.runtimeMixAnalysis.upperBoundDbfsByCodec.mp3,
    'MP3 runtime mix bound',
  );
  return manifest;
}

export async function buildEncodedScore({
  projectRoot = new URL('..', import.meta.url),
  ffmpegPath = process.env.RURAL_SCORE_FFMPEG ?? 'ffmpeg',
  ffprobePath = process.env.RURAL_SCORE_FFPROBE ?? 'ffprobe',
  verifyOnly: shouldVerifyOnly = false,
} = {}) {
  const projectDirectory = resolveProjectRoot(projectRoot);
  const manifestPath = join(projectDirectory, 'audio-source', 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const tempDirectory = await mkdtemp(join(tmpdir(), 'rural-score-'));

  try {
    const [ffmpegVersion, ffprobeVersion] = await Promise.all([
      toolVersion(ffmpegPath),
      toolVersion(ffprobePath),
    ]);

    if (shouldVerifyOnly) {
      return await verifyOnly({
        manifest,
        projectDirectory,
        tempDirectory,
        ffmpegPath,
        ffprobePath,
        ffmpegVersion,
        ffprobeVersion,
      });
    }

    exact(manifest.pipelineStage, 'rendered', 'manifest pipeline stage');
    validateScoreManifestAssets(manifest.assets);
    const generated = [];
    for (const definition of SCORE_ASSETS) {
      const manifestAsset = manifest.assets.find(({ id }) => id === definition.id);
      invariant(manifestAsset, `${definition.id}: missing rendered manifest asset`);
      const committedSource = await readFile(
        join(projectDirectory, ...manifestAsset.files.wav.path.split('/')),
      );
      exact(
        committedSource.byteLength,
        manifestAsset.files.wav.bytes,
        `${definition.id} rendered WAV bytes`,
      );
      exact(
        sha256(committedSource),
        manifestAsset.files.wav.sha256,
        `${definition.id} committed rendered WAV hash`,
      );
      generated.push(
        await normalizeAndEncodeAsset({
          manifestAsset,
          definition,
          tempDirectory,
          ffmpegPath,
          ffprobePath,
        }),
      );
    }

    const assets = generated.map(({ manifestAsset }) => manifestAsset);
    const aggregate = calculateAggregateAnalysis(assets);
    const encoder = buildEncoderManifest(ffmpegVersion, ffprobeVersion);
    const completedManifest = {
      schemaVersion: manifest.schemaVersion,
      pipelineStage: 'encoded',
      provenance: manifest.provenance,
      generator: manifest.generator,
      encoder,
      format: manifest.format,
      assets,
      decodedBytesByCodec: aggregate.decodedBytesByCodec,
      runtimeMixAnalysis: aggregate.runtimeMixAnalysis,
    };

    for (const generatedAsset of generated) {
      for (const codec of ['wav', 'ogg', 'mp3']) {
        const record = generatedAsset.manifestAsset.files[codec];
        await atomicWrite(
          join(projectDirectory, ...record.path.split('/')),
          generatedAsset.outputs[codec].buffer,
        );
      }
    }
    await atomicWrite(
      manifestPath,
      `${JSON.stringify(completedManifest, null, 2)}\n`,
    );
    return completedManifest;
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

const isCli =
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isCli) {
  const args = process.argv.slice(2);
  invariant(
    args.every((argument) => argument === '--verify-only') &&
      args.filter((argument) => argument === '--verify-only').length <= 1,
    `Unsupported arguments: ${args.join(' ')}`,
  );
  const result = await buildEncodedScore({
    verifyOnly: args.includes('--verify-only'),
  });
  const compressedBytes = result.assets.reduce(
    (total, asset) => total + asset.files.ogg.bytes + asset.files.mp3.bytes,
    0,
  );
  console.log(
    `${args.includes('--verify-only') ? 'Verified' : 'Encoded'} ${
      result.assets.length
    } rural score assets (${compressedBytes} compressed bytes).`,
  );
}
