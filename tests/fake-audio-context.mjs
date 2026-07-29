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

  exponentialRampToValueAtTime(value, time) {
    this.value = value;
    this.addCall('exponentialRampToValueAtTime', arguments);
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
    this.disconnectPlan = null;
  }

  connect(target) {
    this.connections.push(target);
    this.context.events.push({ type: 'connect', node: this, target });
    return target;
  }

  disconnect(target) {
    this.disconnections.push(target ?? null);
    this.context.events.push({ type: 'disconnect', node: this, target: target ?? null });
    return this.disconnectPlan?.();
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
    this.stopPlan = null;
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
    return this.stopPlan?.();
  }

  emitEnded() {
    this.context.events.push({ type: 'source-ended', source: this });
    this.onended?.();
  }
}

export class FakeOscillatorNode extends FakeConnectableNode {
  constructor(context) {
    super(context);
    this.frequency = new FakeAudioParam(440, (event) => context.events.push(event));
    this.startCalls = [];
    this.stopCalls = [];
    this.stopPlan = null;
    this.onended = null;
  }

  start(...args) {
    this.startCalls.push(args);
    this.context.events.push({ type: 'oscillator-start', oscillator: this, args });
  }

  stop(...args) {
    this.stopCalls.push(args);
    this.context.events.push({ type: 'oscillator-stop', oscillator: this, args });
    return this.stopPlan?.();
  }

  emitEnded() {
    this.context.events.push({ type: 'oscillator-ended', oscillator: this });
    this.onended?.();
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
    createBufferSourcePlan = null,
    createGainPlan = null,
    createOscillatorPlan = null,
    resumePlan = null,
    suspendPlan = null,
    closePlan = null,
  } = {}) {
    this.state = state;
    this.currentTime = currentTime;
    this.sampleRate = sampleRate;
    this.decodePlan = decodePlan;
    this.createBufferSourcePlan = createBufferSourcePlan;
    this.createGainPlan = createGainPlan;
    this.createOscillatorPlan = createOscillatorPlan;
    this.resumePlan = resumePlan;
    this.suspendPlan = suspendPlan;
    this.closePlan = closePlan;
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
    this.createBufferSourcePlan?.(this);
    const source = new FakeBufferSourceNode(this);
    this.sources.push(source);
    this.events.push({ type: 'create-buffer-source', source });
    return source;
  }

  createGain() {
    this.createGainPlan?.(this);
    const gain = new FakeGainNode(this);
    this.gains.push(gain);
    this.events.push({ type: 'create-gain', gain });
    return gain;
  }

  createOscillator() {
    this.createOscillatorPlan?.(this);
    const oscillator = new FakeOscillatorNode(this);
    this.oscillators.push(oscillator);
    this.events.push({ type: 'create-oscillator', oscillator });
    return oscillator;
  }

  advanceTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) {
      throw new RangeError('fake audio time must advance by a finite non-negative amount');
    }
    this.currentTime += seconds;
    this.events.push({ type: 'advance-time', currentTime: this.currentTime });
    return this.currentTime;
  }

  async resume() {
    this.resumeCalls.push([]);
    this.events.push({ type: 'context-resume' });
    await this.resumePlan?.(this);
    this.state = 'running';
  }

  async suspend() {
    this.suspendCalls.push([]);
    this.events.push({ type: 'context-suspend' });
    await this.suspendPlan?.(this);
    this.state = 'suspended';
  }

  async close() {
    this.closeCalls.push([]);
    this.events.push({ type: 'context-close' });
    await this.closePlan?.(this);
    this.state = 'closed';
  }
}
