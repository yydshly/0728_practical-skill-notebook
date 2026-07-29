export function createDangerController({ recoverySeconds = 1.2 } = {}) {
  let recoveryRemaining = 0;
  let wasDangerous = false;

  function update(dt, pursuerState, distance) {
    if (pursuerState === 'threaten') {
      wasDangerous = true;
      recoveryRemaining = recoverySeconds;
      const closeness = Math.max(0, Math.min(1, (4 - distance) / 2));
      return {
        mode: 'threaten',
        label: '近身威胁',
        intensity: 0.72 + closeness * 0.28,
        heartbeatBpm: 108 + closeness * 24,
      };
    }
    if (pursuerState === 'chase') {
      wasDangerous = true;
      recoveryRemaining = recoverySeconds;
      const closeness = Math.max(0, Math.min(1, (11 - distance) / 8));
      return {
        mode: 'chase',
        label: '已被发现',
        intensity: 0.3 + closeness * 0.38,
        heartbeatBpm: 72 + closeness * 28,
      };
    }
    if (wasDangerous && recoveryRemaining > 0) {
      recoveryRemaining = Math.max(0, recoveryRemaining - dt);
      const intensity = recoveryRemaining / recoverySeconds;
      if (recoveryRemaining === 0) wasDangerous = false;
      return {
        mode: recoveryRemaining > 0 ? 'recover' : 'safe',
        label: recoveryRemaining > 0 ? '正在脱离危险' : '',
        intensity: intensity * 0.25,
        heartbeatBpm: 0,
      };
    }
    return { mode: 'safe', label: '', intensity: 0, heartbeatBpm: 0 };
  }

  return {
    update,
    reset() {
      recoveryRemaining = 0;
      wasDangerous = false;
    },
  };
}
