import { createHash } from 'node:crypto';

const TAU = Math.PI * 2;

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

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function panGains(pan) {
  const angle = ((Math.max(-1, Math.min(1, pan)) + 1) * Math.PI) / 4;
  return [Math.cos(angle), Math.sin(angle)];
}

function addPanned(pcm, frame, sample, pan) {
  const [leftGain, rightGain] = panGains(pan);
  const offset = frame * SCORE_FORMAT.channels;
  pcm[offset] += sample * leftGain;
  pcm[offset + 1] += sample * rightGain;
}

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function circularDistance(time, center, duration) {
  return positiveModulo(time - center + duration / 2, duration) - duration / 2;
}

function renderExploration(definition, pcm, random) {
  const { sampleRate } = SCORE_FORMAT;
  const strikeTimes = [8, 24, 40];
  const strikePans = strikeTimes.map(() => random() * 0.7 - 0.35);
  const grainTimes = [0.04, 10.75, 19.25, 33.5, 41.25, 47.96];
  const grainPans = grainTimes.map(() => random() * 0.7 - 0.35);
  let filteredNoise = 0;

  for (let frame = 0; frame < definition.sampleFrames; frame += 1) {
    const time = frame / sampleRate;
    const movement = 0.72 + 0.18 * Math.sin((TAU * frame) / definition.sampleFrames);
    const drone =
      movement *
      (0.17 * Math.sin((TAU * 73.416 * frame) / sampleRate) +
        0.075 * Math.sin((TAU * 110 * frame) / sampleRate) +
        0.04 * Math.sin((TAU * 174.614 * frame) / sampleRate));
    addPanned(pcm, frame, drone, 0);

    const whiteNoise = random() * 2 - 1;
    filteredNoise += 0.075 * (whiteNoise - filteredNoise);
    const insectNoise = whiteNoise - filteredNoise;

    for (let event = 0; event < grainTimes.length; event += 1) {
      const distance = circularDistance(
        time,
        grainTimes[event],
        definition.durationSeconds,
      );
      if (Math.abs(distance) >= 0.1) {
        continue;
      }
      const envelope = Math.cos((Math.abs(distance) / 0.1) * (Math.PI / 2)) ** 2;
      const chirp = Math.sin(TAU * (2_900 + 360 * distance) * time);
      addPanned(
        pcm,
        frame,
        envelope * (0.012 * insectNoise + 0.004 * chirp),
        grainPans[event],
      );
    }

    for (let event = 0; event < strikeTimes.length; event += 1) {
      const elapsed = positiveModulo(
        time - strikeTimes[event],
        definition.durationSeconds,
      );
      if (elapsed >= 0.34) {
        continue;
      }
      const envelope = Math.exp(-elapsed * 18) * Math.sin(Math.PI * elapsed / 0.34);
      const strike =
        envelope *
        (0.075 * Math.sin(TAU * 420 * elapsed) +
          0.045 * Math.sin(TAU * 263 * elapsed) +
          0.012 * filteredNoise);
      addPanned(pcm, frame, strike, strikePans[event]);
    }
  }
}

function renderDanger(definition, pcm, random) {
  const { sampleRate } = SCORE_FORMAT;
  const frictionTimes = [6, 14, 22, 30, 38, 46];
  let lowNoise = 0;

  for (let frame = 0; frame < definition.sampleFrames; frame += 1) {
    const time = frame / sampleRate;
    const bassPan = 0.06 * Math.sin((TAU * frame) / definition.sampleFrames);
    const drone =
      0.12 * Math.sin((TAU * 36.708 * frame) / sampleRate) +
      0.055 * Math.sin((TAU * 51.913 * frame) / sampleRate) +
      0.035 * Math.sin((TAU * 77.782 * frame) / sampleRate);
    addPanned(pcm, frame, drone, bassPan);

    const pulseElapsed = positiveModulo(time, 4);
    if (pulseElapsed < 0.9) {
      const pulseEnvelope = Math.exp(-pulseElapsed * 4.8);
      const pulse =
        pulseEnvelope *
        (0.13 * Math.sin(TAU * 36.708 * pulseElapsed) +
          0.035 * Math.sin(TAU * 73.416 * pulseElapsed));
      addPanned(pcm, frame, pulse, -bassPan);
    }

    const whiteNoise = random() * 2 - 1;
    lowNoise += 0.045 * (whiteNoise - lowNoise);
    const frictionNoise = whiteNoise - lowNoise;

    for (let event = 0; event < frictionTimes.length; event += 1) {
      const elapsed = positiveModulo(
        time - frictionTimes[event],
        definition.durationSeconds,
      );
      if (elapsed >= 0.62) {
        continue;
      }
      const envelope = Math.sin((Math.PI * elapsed) / 0.62) ** 2;
      const tension =
        0.026 * Math.sin(TAU * 185 * elapsed) +
        0.022 * Math.sin(TAU * 196 * elapsed);
      const friction = envelope * (0.052 * frictionNoise + tension);
      addPanned(pcm, frame, friction, event % 2 === 0 ? -0.28 : 0.28);
    }
  }
}

function renderReveal(definition, pcm, random) {
  const { sampleRate } = SCORE_FORMAT;
  let lowNoise = 0;

  for (let frame = 0; frame < definition.sampleFrames; frame += 1) {
    const time = frame / sampleRate;
    const progress = time / definition.durationSeconds;
    const fallingPhase =
      TAU *
      (146.832 * time +
        0.5 * (73.416 - 146.832) * time * progress);
    const partialEnvelope = Math.exp(-time * 0.72);
    const partials =
      partialEnvelope *
      (0.16 * Math.sin(fallingPhase) +
        0.07 * Math.sin(fallingPhase * 1.5) +
        0.035 * Math.sin(fallingPhase * 2.02));
    addPanned(pcm, frame, partials, 0.12 * progress);

    const impactElapsed = time - 0.05;
    if (impactElapsed >= 0 && impactElapsed < 0.75) {
      const impactEnvelope = Math.exp(-impactElapsed * 8.5);
      const impact =
        impactEnvelope *
        (0.29 * Math.sin(TAU * 46 * impactElapsed) +
          0.11 * Math.sin(TAU * 82 * impactElapsed));
      addPanned(pcm, frame, impact, 0);
    }

    const whiteNoise = random() * 2 - 1;
    lowNoise += 0.055 * (whiteNoise - lowNoise);
    const tailEnvelope = Math.max(0, 1 - progress) ** 1.4;
    const tailPan = 0.32 * progress;
    addPanned(
      pcm,
      frame,
      0.034 * tailEnvelope * (whiteNoise - lowNoise),
      frame % 2 === 0 ? -tailPan : tailPan,
    );
  }
}

function renderEscape(definition, pcm) {
  const { sampleRate } = SCORE_FORMAT;
  const attacks = [0, 1.5, 3, 4.5];
  const frequencies = [73.416, 87.307, 110, 146.832];

  for (let frame = 0; frame < definition.sampleFrames; frame += 1) {
    const time = frame / sampleRate;
    for (let event = 0; event < attacks.length; event += 1) {
      const elapsed = time - attacks[event];
      if (elapsed < 0 || elapsed >= 1.5) {
        continue;
      }
      const attack = Math.min(1, elapsed / 0.025);
      const decay = Math.exp(-elapsed * (event === 3 ? 1.5 : 2.15));
      const envelope = attack * decay;
      const frequency = frequencies[event];
      const phase = TAU * frequency * elapsed;
      if (event === 3) {
        const centeredResolution =
          envelope *
          (0.17 * Math.sin(phase) + 0.045 * Math.sin(phase * 2));
        addPanned(pcm, frame, centeredResolution, 0);
        addPanned(pcm, frame, 0.08 * envelope * Math.cos(phase), -0.25);
        addPanned(pcm, frame, -0.08 * envelope * Math.cos(phase), 0.25);
        continue;
      }
      const note =
        envelope *
        (0.2 * Math.sin(phase) +
          0.065 * Math.sin(phase * 2) +
          0.025 * Math.sin(phase * 3));
      addPanned(pcm, frame, note, 0);
    }
  }
}

function applyLoopBoundaryBlend(pcm, sampleFrames, channels, sampleRate) {
  const blendFrames = Math.round(sampleRate * 0.1);
  const boundary = new Float64Array(channels);
  for (let channel = 0; channel < channels; channel += 1) {
    boundary[channel] =
      (pcm[channel] + pcm[(sampleFrames - 1) * channels + channel]) / 2;
  }

  for (let frame = 0; frame < blendFrames; frame += 1) {
    const progress = frame / (blendFrames - 1);
    const boundaryGain = Math.cos(progress * (Math.PI / 2));
    const contentGain = Math.sin(progress * (Math.PI / 2));
    const endBoundaryGain = Math.sin(progress * (Math.PI / 2));
    const endContentGain = Math.cos(progress * (Math.PI / 2));
    const startOffset = frame * channels;
    const endOffset = (sampleFrames - blendFrames + frame) * channels;

    for (let channel = 0; channel < channels; channel += 1) {
      pcm[startOffset + channel] =
        boundary[channel] * boundaryGain + pcm[startOffset + channel] * contentGain;
      pcm[endOffset + channel] =
        pcm[endOffset + channel] * endContentGain +
        boundary[channel] * endBoundaryGain;
    }
  }
}

function applyTerminalRelease(pcm, sampleFrames, channels, sampleRate) {
  const releaseFrames = Math.max(Math.round(sampleRate * 0.2), 2);
  const releaseStart = sampleFrames - releaseFrames;
  for (let frame = releaseStart; frame < sampleFrames; frame += 1) {
    const progress = (frame - releaseStart) / (releaseFrames - 1);
    const gain = Math.cos(progress * (Math.PI / 2));
    const offset = frame * channels;
    for (let channel = 0; channel < channels; channel += 1) {
      pcm[offset + channel] *= gain;
    }
  }
}

function quantizePcm16(floatPcm) {
  let peak = 0;
  for (let index = 0; index < floatPcm.length; index += 1) {
    const sample = floatPcm[index];
    if (!Number.isFinite(sample)) {
      throw new TypeError(`Non-finite score sample at interleaved index ${index}`);
    }
    peak = Math.max(peak, Math.abs(sample));
  }

  const scale = peak > 0.95 ? 0.95 / peak : 1;
  const pcm = new Int16Array(floatPcm.length);
  for (let index = 0; index < floatPcm.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, floatPcm[index] * scale));
    pcm[index] = sample < 0 ? Math.round(sample * 32_768) : Math.round(sample * 32_767);
  }
  return pcm;
}

function pcm16ToLittleEndianBuffer(pcm) {
  if (!(pcm instanceof Int16Array)) {
    throw new TypeError('pcm must be an Int16Array');
  }
  const bytes = Buffer.allocUnsafe(pcm.length * 2);
  for (let index = 0; index < pcm.length; index += 1) {
    bytes.writeInt16LE(pcm[index], index * 2);
  }
  return bytes;
}

function scoreDefinitionsMatch(left, right) {
  return (
    left?.id === right.id &&
    left.role === right.role &&
    left.kind === right.kind &&
    left.durationSeconds === right.durationSeconds &&
    left.sampleFrames === right.sampleFrames &&
    left.targetLufs === right.targetLufs &&
    left.seed === right.seed &&
    left.loopStart === right.loopStart &&
    left.loopEnd === right.loopEnd
  );
}

export function renderScoreAsset(definition) {
  if (!SCORE_ASSETS.includes(definition)) {
    const known = SCORE_ASSETS.find(({ id }) => id === definition?.id);
    if (!known || !scoreDefinitionsMatch(definition, known)) {
      throw new TypeError(`Unknown score definition: ${definition?.id ?? '<missing>'}`);
    }
  }

  const floatPcm = new Float64Array(
    definition.sampleFrames * SCORE_FORMAT.channels,
  );
  const random = mulberry32(definition.seed);

  if (definition.role === 'exploration') {
    renderExploration(definition, floatPcm, random);
  } else if (definition.role === 'danger') {
    renderDanger(definition, floatPcm, random);
  } else if (definition.role === 'reveal') {
    renderReveal(definition, floatPcm, random);
  } else if (definition.role === 'escape') {
    renderEscape(definition, floatPcm);
  } else {
    throw new TypeError(`Unsupported score role: ${definition.role}`);
  }

  if (definition.kind === 'loop') {
    applyLoopBoundaryBlend(
      floatPcm,
      definition.sampleFrames,
      SCORE_FORMAT.channels,
      SCORE_FORMAT.sampleRate,
    );
  } else {
    applyTerminalRelease(
      floatPcm,
      definition.sampleFrames,
      SCORE_FORMAT.channels,
      SCORE_FORMAT.sampleRate,
    );
  }

  const pcm = quantizePcm16(floatPcm);
  return {
    definition,
    pcm,
    sourcePcmSha256: sha256(pcm16ToLittleEndianBuffer(pcm)),
    analysis: analyzePcm16({
      pcm,
      sampleRate: SCORE_FORMAT.sampleRate,
      channels: SCORE_FORMAT.channels,
      kind: definition.kind,
    }),
  };
}

export function encodePcm16Wav({ pcm, sampleRate, channels }) {
  if (!Number.isInteger(sampleRate) || sampleRate <= 0) {
    throw new RangeError('sampleRate must be a positive integer');
  }
  if (!Number.isInteger(channels) || channels <= 0) {
    throw new RangeError('channels must be a positive integer');
  }
  if (!(pcm instanceof Int16Array) || pcm.length % channels !== 0) {
    throw new TypeError('pcm must be an interleaved Int16Array aligned to channels');
  }

  const data = pcm16ToLittleEndianBuffer(pcm);
  const headerBytes = 44;
  const wav = Buffer.allocUnsafe(headerBytes + data.byteLength);
  wav.write('RIFF', 0, 4, 'ascii');
  wav.writeUInt32LE(wav.byteLength - 8, 4);
  wav.write('WAVE', 8, 4, 'ascii');
  wav.write('fmt ', 12, 4, 'ascii');
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(channels, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * channels * 2, 28);
  wav.writeUInt16LE(channels * 2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36, 4, 'ascii');
  wav.writeUInt32LE(data.byteLength, 40);
  data.copy(wav, headerBytes);
  return wav;
}

export function inspectPcm16Wav(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.byteLength < 44) {
    throw new TypeError('buffer must contain a PCM16 WAV file');
  }
  if (buffer.toString('ascii', 0, 4) !== 'RIFF') {
    throw new TypeError('WAV must use a little-endian RIFF container');
  }
  if (buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new TypeError('Missing WAVE signature');
  }

  let format;
  let dataOffset;
  let dataBytes;
  let offset = 12;
  while (offset + 8 <= buffer.byteLength) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkBytes = buffer.readUInt32LE(offset + 4);
    const chunkDataOffset = offset + 8;
    if (chunkDataOffset + chunkBytes > buffer.byteLength) {
      throw new RangeError(`Invalid ${chunkId} chunk length`);
    }

    if (chunkId === 'fmt ') {
      if (chunkBytes < 16) {
        throw new RangeError('Invalid fmt chunk length');
      }
      format = {
        audioFormat: buffer.readUInt16LE(chunkDataOffset),
        channels: buffer.readUInt16LE(chunkDataOffset + 2),
        sampleRate: buffer.readUInt32LE(chunkDataOffset + 4),
        bitDepth: buffer.readUInt16LE(chunkDataOffset + 14),
      };
    } else if (chunkId === 'data') {
      dataOffset = chunkDataOffset;
      dataBytes = chunkBytes;
      break;
    }

    offset = chunkDataOffset + chunkBytes + (chunkBytes % 2);
  }

  if (!format || dataOffset === undefined || dataBytes === undefined) {
    throw new TypeError('WAV requires fmt and data chunks');
  }
  if (format.audioFormat !== 1 || format.bitDepth !== 16 || format.channels <= 0) {
    throw new TypeError('WAV must contain interleaved PCM16 audio');
  }
  if (dataBytes % (format.channels * 2) !== 0) {
    throw new RangeError('PCM data is not aligned to complete sample frames');
  }

  const pcm = new Int16Array(dataBytes / 2);
  for (let index = 0; index < pcm.length; index += 1) {
    pcm[index] = buffer.readInt16LE(dataOffset + index * 2);
  }
  const sampleFrames = pcm.length / format.channels;
  return {
    audioFormat: format.audioFormat,
    bitDepth: format.bitDepth,
    channels: format.channels,
    sampleRate: format.sampleRate,
    sampleFrames,
    durationSeconds: sampleFrames / format.sampleRate,
    pcm,
  };
}

export function analyzePcm16({ pcm, sampleRate, channels, kind }) {
  if (!(pcm instanceof Int16Array) || pcm.length === 0) {
    throw new TypeError('pcm must be a non-empty Int16Array');
  }
  if (!Number.isInteger(sampleRate) || sampleRate <= 0) {
    throw new RangeError('sampleRate must be a positive integer');
  }
  if (!Number.isInteger(channels) || channels <= 0 || pcm.length % channels !== 0) {
    throw new RangeError('channels must align with interleaved PCM samples');
  }
  if (kind !== 'loop' && kind !== 'stinger') {
    throw new TypeError('kind must be loop or stinger');
  }

  let peak = 0;
  let sum = 0;
  let squareSum = 0;
  for (let index = 0; index < pcm.length; index += 1) {
    const normalized = pcm[index] / 32_768;
    peak = Math.max(peak, Math.abs(normalized));
    sum += normalized;
    squareSum += normalized * normalized;
  }

  const sampleFrames = pcm.length / channels;
  let seamDelta = 0;
  for (let channel = 0; channel < channels; channel += 1) {
    const first = pcm[channel] / 32_768;
    const last = pcm[(sampleFrames - 1) * channels + channel] / 32_768;
    seamDelta = Math.max(seamDelta, Math.abs(last - first));
  }

  const rms = Math.sqrt(squareSum / pcm.length);
  const approximateLufs = -0.691 + 20 * Math.log10(Math.max(rms, 1e-12));
  return {
    peak: Number(peak.toFixed(8)),
    dcOffset: Number((sum / pcm.length).toFixed(8)),
    rms: Number(rms.toFixed(8)),
    seamDelta: Number(seamDelta.toFixed(8)),
    approximateLufs: Number(approximateLufs.toFixed(3)),
  };
}

export function sha256(buffer) {
  if (!Buffer.isBuffer(buffer) && !ArrayBuffer.isView(buffer)) {
    throw new TypeError('sha256 expects a Buffer or typed-array view');
  }
  return createHash('sha256').update(buffer).digest('hex');
}
