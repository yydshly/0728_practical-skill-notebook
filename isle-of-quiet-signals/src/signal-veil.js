const DEFAULT_RANGE = Object.freeze({
  start: 0.5,
  peakStart: 0.54,
  peakEnd: 0.64,
  end: 0.69,
});

const GRAVITY = 0.11;
const DAMPING = 0.982;

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function smoothstep(start, end, value) {
  const t = clamp((value - start) / (end - start || 1));
  return t * t * (3 - 2 * t);
}

function distanceToSegment(pointX, pointY, fromX, fromY, toX, toY) {
  const deltaX = toX - fromX;
  const deltaY = toY - fromY;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  const t = lengthSquared === 0 ? 0 : clamp(((pointX - fromX) * deltaX + (pointY - fromY) * deltaY) / lengthSquared);
  const nearestX = fromX + deltaX * t;
  const nearestY = fromY + deltaY * t;
  return {
    distance: Math.hypot(pointX - nearestX, pointY - nearestY),
    offsetX: pointX - nearestX,
  };
}

export function createSignalVeil({
  canvas,
  lines,
  range = DEFAULT_RANGE,
  reducedMotion = false,
  windowRef = window,
}) {
  const context = canvas.getContext("2d");
  const prefersCoarsePointer = windowRef.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  const interactive = Boolean(context) && !reducedMotion && !prefersCoarsePointer;
  const requestFrame = windowRef.requestAnimationFrame?.bind(windowRef)
    ?? ((callback) => windowRef.setTimeout(() => callback(Date.now()), 16));
  const cancelFrame = windowRef.cancelAnimationFrame?.bind(windowRef) ?? windowRef.clearTimeout?.bind(windowRef);

  let cssWidth = 0;
  let cssHeight = 0;
  let opacity = 0;
  let animationFrame = null;
  let strings = [];
  let pointer = null;
  let active = false;

  function buildStrings() {
    if (!cssWidth || !cssHeight) return;
    const count = clamp(Math.round(cssWidth / 12), 30, 58);
    const nodeCount = 18;
    const left = cssWidth * 0.04;
    const right = cssWidth * 0.96;
    const anchorY = cssHeight * 0.12;
    const length = cssHeight * 0.67;
    const segmentLength = length / nodeCount;

    strings = Array.from({ length: count }, (_, column) => {
      const anchorX = left + (right - left) * (column / Math.max(1, count - 1));
      const nodes = [{ x: anchorX, y: anchorY, oldX: anchorX, oldY: anchorY, pinned: true, char: "" }];

      for (let row = 1; row <= nodeCount; row += 1) {
        const source = lines[(column + row * 3) % lines.length];
        const character = source[(column * 2 + row) % source.length] ?? "·";
        const initialSway = Math.sin(column * 0.61 + row * 0.29) * 0.35;
        nodes.push({
          x: anchorX + initialSway,
          y: anchorY + row * segmentLength,
          oldX: anchorX + initialSway * 0.4,
          oldY: anchorY + row * segmentLength,
          pinned: false,
          char: character,
        });
      }

      return { nodes, segmentLength, phase: column * 0.37 };
    });
  }

  function resize() {
    if (!context) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(windowRef.devicePixelRatio || 1, 2);
    cssWidth = rect.width;
    cssHeight = rect.height;
    canvas.width = Math.max(1, Math.round(cssWidth * dpr));
    canvas.height = Math.max(1, Math.round(cssHeight * dpr));
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildStrings();
  }

  function updateStrings(time) {
    for (const string of strings) {
      for (let index = 1; index < string.nodes.length; index += 1) {
        const node = string.nodes[index];
        const velocityX = (node.x - node.oldX) * DAMPING;
        const velocityY = (node.y - node.oldY) * DAMPING;
        node.oldX = node.x;
        node.oldY = node.y;
        node.x += velocityX + Math.sin(time * 0.0007 + string.phase + index * 0.18) * 0.004;
        node.y += velocityY + GRAVITY;
      }
    }

    for (let iteration = 0; iteration < 3; iteration += 1) {
      for (const string of strings) {
        const anchor = string.nodes[0];
        anchor.x = anchor.oldX;
        anchor.y = anchor.oldY;
        for (let index = 0; index < string.nodes.length - 1; index += 1) {
          const first = string.nodes[index];
          const second = string.nodes[index + 1];
          const deltaX = second.x - first.x;
          const deltaY = second.y - first.y;
          const distance = Math.hypot(deltaX, deltaY) || 1;
          const difference = (distance - string.segmentLength) / distance;
          const correctionX = deltaX * difference * 0.5;
          const correctionY = deltaY * difference * 0.5;
          if (first.pinned) {
            second.x -= correctionX * 2;
            second.y -= correctionY * 2;
          } else {
            first.x += correctionX;
            first.y += correctionY;
            second.x -= correctionX;
            second.y -= correctionY;
          }
        }
      }
    }
  }

  function draw() {
    if (!context) return;
    context.clearRect(0, 0, cssWidth, cssHeight);
    context.strokeStyle = "rgba(233, 215, 165, .78)";
    context.lineWidth = 0.7;
    context.globalAlpha = opacity * 0.48;
    context.beginPath();
    for (const string of strings) {
      context.moveTo(string.nodes[0].x, string.nodes[0].y);
      for (let index = 1; index < string.nodes.length; index += 1) {
        const node = string.nodes[index];
        context.lineTo(node.x, node.y);
      }
    }
    context.stroke();

    context.fillStyle = "#ffe6af";
    context.globalAlpha = opacity * 0.96;
    context.font = "600 12px DM Mono, monospace";
    context.textAlign = "center";
    context.textBaseline = "middle";
    for (const string of strings) {
      for (let index = 1; index < string.nodes.length; index += 1) {
        const node = string.nodes[index];
        context.fillText(node.char, node.x, node.y);
      }
    }
    context.globalAlpha = 1;
  }

  function render(time) {
    animationFrame = null;
    if (!active || !interactive) return;
    updateStrings(time);
    draw();
    animationFrame = requestFrame(render);
  }

  function start() {
    if (!interactive || animationFrame !== null) return;
    resize();
    draw();
    animationFrame = requestFrame(render);
  }

  function stop() {
    if (animationFrame !== null) cancelFrame?.(animationFrame);
    animationFrame = null;
  }

  function updateOpacity(progress) {
    if (progress <= range.start || progress >= range.end) return 0;
    if (progress < range.peakStart) return smoothstep(range.start, range.peakStart, progress);
    if (progress > range.peakEnd) return 1 - smoothstep(range.peakEnd, range.end, progress);
    return 1;
  }

  function brush(from, to) {
    const movementX = to.x - from.x;
    const movementY = to.y - from.y;
    const distance = Math.hypot(movementX, movementY);
    if (distance < 0.3) return;
    const speed = Math.min(22, distance);
    const radius = 46;
    for (const string of strings) {
      for (let index = 1; index < string.nodes.length; index += 1) {
        const node = string.nodes[index];
        const hit = distanceToSegment(node.x, node.y, from.x, from.y, to.x, to.y);
        if (hit.distance >= radius) continue;
        const influence = (1 - hit.distance / radius) ** 2;
        node.x += (movementX / distance) * speed * influence * 0.56 + hit.offsetX * influence * 0.1;
        node.oldX -= (movementX / distance) * speed * influence * 0.18;
        node.y += (movementY / distance) * speed * influence * 0.08;
      }
    }
  }

  function onPointerMove(event) {
    const rect = canvas.getBoundingClientRect();
    const next = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    if (pointer) brush(pointer, next);
    pointer = next;
  }

  function onPointerLeave() {
    pointer = null;
  }

  function setProgress(progress) {
    opacity = reducedMotion ? 0 : updateOpacity(progress);
    active = opacity > 0;
    canvas.style.opacity = String(opacity);
    canvas.style.pointerEvents = active && interactive ? "auto" : "none";
    canvas.dataset.active = String(active);

    if (active) {
      start();
    } else {
      stop();
      pointer = null;
    }
  }

  function destroy() {
    stop();
    windowRef.removeEventListener?.("resize", resize);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerleave", onPointerLeave);
    canvas.style.opacity = "0";
    canvas.style.pointerEvents = "none";
  }

  canvas.style.opacity = "0";
  canvas.style.pointerEvents = "none";
  windowRef.addEventListener?.("resize", resize, { passive: true });
  if (interactive) {
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);
  }

  return { setProgress, destroy, getOpacity: () => opacity };
}
