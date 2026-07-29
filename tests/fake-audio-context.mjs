const encoder = new TextEncoder();
const decoder = new TextDecoder();

const ROLE_DURATIONS = Object.freeze({
  exploration: 48,
  danger: 48,
  reveal: 3,
  escape: 6,
});

export function encodeAssetIdentity(identity) {
  const bytes = encoder.encode(identity);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

export function decodeAssetIdentity(arrayBuffer) {
  return decoder.decode(new Uint8Array(arrayBuffer));
}

function roleFromIdentity(identity) {
  return Object.keys(ROLE_DURATIONS).find((role) => identity.includes(role));
}

export class FakeAudioParam {
  constructor(value = 1, record = () => {}) {
    this.value = value;
    this.calls = [];
    this.record = record;
  }

  addCall(method, args) {
    const call = { method, args: [...args] };
    this.calls.push(call);
    this.record({ type: 'audio-param', param: this, ...call });
  }

  setValueAtTime(value, time) {
    this.value = value;
    this.addCall('setValueAtTime', arguments);
    return this;
  }

  linearRampToValueAtTime(value, time) {
    this.value = value;
    this.addCall('linearRampToValueAtTime', arguments);
    return this;
  }

  setTargetAtTime(value, time, timeConstant) {
    this.value = value;
    this.addCall('setTargetAtTime', arguments);
    return this;
  }

  cancelScheduledValues(time) {
    this.addCall('cancelScheduledValues', arguments);
    return this;
  }

  cancelAndHoldAtTime(time) {
    this.addCall('cancelAndHoldAtTime', arguments);
    return this;
  }
}

class FakeConnectableNode {
  constructor(context) {
    this.context = context;
    this.connections = [];
    this.disconnections = [];
  }

  connect(target) {
    this.connections.push(target);
    this.context.events.push({ type: 'connect', node: this, target });
    return target;
  }

  disconnect(target) {
    this.disconnections.push(target ?? null);
    this.context.events.push({ type: 'disconnect', node: this, target: target ?? null });
  }
}

export class FakeGainNode extends FakeConnectableNode {
  constructor(context) {
    super(context);
    this.gain = new FakeAudioParam(1, (event) => context.events.push(event));
  }
}

export class FakeBufferSourceNode extends FakeConnectableNode {
  constructor(context) {
    super(context);
    this.buffer = null;
    this.loop = false;
    this.loopStart = 0;
    this.loopEnd = 0;
    this.startCalls = [];
    this.stopCalls = [];
    this.onended = null;
  }

  start(...args) {
    this.startCalls.push(args);
    this.context.events.push({
      type: 'source-start',
      source: this,
      args,
      when: args[0] ?? 0,
    });
  }

  stop(...args) {
    this.stopCalls.push(args);
    this.context.events.push({ type: 'source-stop', source: this, args });
  }
}

export class FakeOscillatorNode extends FakeConnectableNode {
  constructor(context) {
    super(context);
    this.frequency = new FakeAudioParam(440, (event) => context.events.push(event));
    this.startCalls = [];
    this.stopCalls = [];
    this.onended = null;
  }

  start(...args) {
    this.startCalls.push(args);
    this.context.events.push({ type: 'oscillator-start', oscillator: this, args });
  }

  stop(...args) {
    this.stopCalls.push(args);
    this.context.events.push({ type: 'oscillator-stop', oscillator: this, args });
  }
}

export class FakeAudioBuffer {
  constructor({
    identity,
    sampleRate,
    numberOfChannels = 2,
    length,
    duration = length / sampleRate,
  }) {
    this.identity = identity;
    this.sampleRate = sampleRate;
    this.numberOfChannels = numberOfChannels;
    this.length = length;
    this.duration = duration;
  }
}

function readPlanValue(decodePlan, identity, attempt, context) {
  if (typeof decodePlan === 'function') {
    return decodePlan(identity, attempt, context);
  }
  if (decodePlan instanceof Map) return decodePlan.get(identity);
  return decodePlan?.[identity];
}

export class FakeAudioContext {
  constructor({
    state = 'suspended',
    currentTime = 0,
    sampleRate = 48_000,
    decodePlan = {},
  } = {}) {
    this.state = state;
    this.currentTime = currentTime;
    this.sampleRate = sampleRate;
    this.decodePlan = decodePlan;
    this.destination = { type: 'destination' };
    this.sources = [];
    this.oscillators = [];
    this.gains = [];
    this.decodeCalls = [];
    this.decodedBuffers = [];
    this.events = [];
    this.resumeCalls = [];
    this.suspendCalls = [];
    this.closeCalls = [];
    this.decodeAttempts = new Map();
  }

  async decodeAudioData(arrayBuffer) {
    const identity = decodeAssetIdentity(arrayBuffer);
    const attempt = (this.decodeAttempts.get(identity) ?? 0) + 1;
    this.decodeAttempts.set(identity, attempt);
    this.decodeCalls.push({ identity, arrayBuffer, attempt });

    const planned = await readPlanValue(this.decodePlan, identity, attempt, this);
    if (planned instanceof Error) throw planned;
    if (planned?.reject) {
      throw planned.error ?? new Error(`decode rejected for ${identity}`);
    }

    const role = roleFromIdentity(identity);
    if (!role) throw new Error(`unknown fake audio role: ${identity}`);
    const specification = planned ?? {};
    const bufferSampleRate = specification.sampleRate ?? this.sampleRate;
    const duration = specification.duration ?? ROLE_DURATIONS[role];
    const length = specification.length ?? Math.round(duration * bufferSampleRate);
    const buffer = new FakeAudioBuffer({
      identity,
      sampleRate: bufferSampleRate,
      numberOfChannels: specification.numberOfChannels ?? 2,
      length,
      duration: specification.reportedDuration ?? (length / bufferSampleRate),
    });
    this.decodedBuffers.push(buffer);
    return buffer;
  }

  createBufferSource() {
    const source = new FakeBufferSourceNode(this);
    this.sources.push(source);
    this.events.push({ type: 'create-buffer-source', source });
    return source;
  }

  createGain() {
    const gain = new FakeGainNode(this);
    this.gains.push(gain);
    this.events.push({ type: 'create-gain', gain });
    return gain;
  }

  createOscillator() {
    const oscillator = new FakeOscillatorNode(this);
    this.oscillators.push(oscillator);
    this.events.push({ type: 'create-oscillator', oscillator });
    return oscillator;
  }

  async resume() {
    this.resumeCalls.push([]);
    this.state = 'running';
  }

  async suspend() {
    this.suspendCalls.push([]);
    this.state = 'suspended';
  }

  async close() {
    this.closeCalls.push([]);
    this.state = 'closed';
  }
}
