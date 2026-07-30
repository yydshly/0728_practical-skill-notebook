import { mkdir, writeFile as writeFileToDisk } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

import {
  SCORE_ASSETS,
  SCORE_FORMAT,
  encodePcm16Wav,
  renderScoreAsset,
  sha256,
} from './rural-score-core.mjs';

export async function renderRuralScore({
  projectRoot = new URL('..', import.meta.url),
  writeFile = writeFileToDisk,
} = {}) {
  const mastersDirectory = new URL('audio-source/masters/', projectRoot);
  await mkdir(mastersDirectory, { recursive: true });

  const assets = [];
  for (const definition of SCORE_ASSETS) {
    const rendered = renderScoreAsset(definition);
    const wav = encodePcm16Wav({
      pcm: rendered.pcm,
      sampleRate: SCORE_FORMAT.sampleRate,
      channels: SCORE_FORMAT.channels,
    });
    const wavPath = `audio-source/masters/${definition.id}.wav`;
    await writeFile(new URL(wavPath, projectRoot), wav);

    assets.push({
      id: definition.id,
      role: definition.role,
      kind: definition.kind,
      seed: definition.seed,
      durationSeconds: definition.durationSeconds,
      sampleFrames: definition.sampleFrames,
      targetLufs: definition.targetLufs,
      ...(definition.loopStart === undefined
        ? {}
        : {
            loopStart: definition.loopStart,
            loopEnd: definition.loopEnd,
          }),
      sourcePcmSha256: rendered.sourcePcmSha256,
      analysis: rendered.analysis,
      files: {
        wav: {
          path: wavPath,
          bytes: wav.byteLength,
          sha256: sha256(wav),
        },
      },
    });
  }

  const manifest = {
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
    assets,
  };

  const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
  await writeFile(
    new URL('audio-source/manifest.json', projectRoot),
    manifestJson,
    'utf8',
  );
  return manifest;
}

const isCli =
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isCli) {
  await renderRuralScore();
}
