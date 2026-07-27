export const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export const lerp = (start, end, amount) => start + (end - start) * amount;

function assertRange(start, end) {
  if (!(end > start)) {
    throw new RangeError("Timeline range end must be greater than start");
  }
}

export function rangeProgress(value, start, end) {
  assertRange(start, end);
  return clamp((value - start) / (end - start));
}

export function smoothstep(edge0, edge1, value) {
  const x = rangeProgress(value, edge0, edge1);
  return x * x * (3 - 2 * x);
}

export function segmentInOut(value, enterStart, enterEnd, exitStart, exitEnd) {
  if (exitStart < enterEnd) {
    throw new RangeError("Exit must not begin before enter completes");
  }

  const enter = smoothstep(enterStart, enterEnd, value);
  const exit = 1 - smoothstep(exitStart, exitEnd, value);
  return Math.min(enter, exit);
}
