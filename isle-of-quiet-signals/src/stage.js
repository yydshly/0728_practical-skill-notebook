import { clamp, lerp, segmentInOut, smoothstep } from "./timeline.js";

const FRAME_EPSILON = 0.0005;

export function calculateLocalProgress({ scrollY, sectionTop, travel }) {
  if (travel <= 0) return 0;
  return clamp((scrollY - sectionTop) / travel);
}

export function deriveSceneFrame(progress, pointer = { x: 0, y: 0 }) {
  const p = clamp(progress);
  const opening = smoothstep(0.15, 0.25, p);
  const storyAOpacity = segmentInOut(p, 0.22, 0.27, 0.35, 0.44);
  const storyBOpacity = segmentInOut(p, 0.48, 0.55, 0.69, 0.74);
  const archive = smoothstep(0.75, 0.96, p);

  return {
    p,
    worldScale: lerp(1.035, 1.13, smoothstep(0.03, 0.74, p)),
    backgroundX: pointer.x * -4,
    backgroundY: pointer.y * -3,
    midgroundX: pointer.x * 7,
    midgroundY: pointer.y * 5,
    foregroundLeftX: lerp(0, -28, opening),
    foregroundRightX: lerp(0, 28, opening),
    introOpacity: 1 - smoothstep(0.03, 0.18, p),
    storyAOpacity,
    storyBOpacity,
    focusAmount: storyAOpacity * 0.45 + storyBOpacity,
    archive,
    archiveInteractive: archive > 0.05,
    controlsOpacity: smoothstep(0.91, 1, p),
  };
}

function writeFrame(root, frame) {
  const variables = {
    "--p": frame.p,
    "--world-scale": frame.worldScale,
    "--bg-x": `${frame.backgroundX}px`,
    "--bg-y": `${frame.backgroundY}px`,
    "--mid-x": `${frame.midgroundX}px`,
    "--mid-y": `${frame.midgroundY}px`,
    "--fg-left-x": `${frame.foregroundLeftX}px`,
    "--fg-right-x": `${frame.foregroundRightX}px`,
    "--intro-opacity": frame.introOpacity,
    "--story-a-opacity": frame.storyAOpacity,
    "--story-b-opacity": frame.storyBOpacity,
    "--focus": frame.focusAmount,
    "--archive-progress": frame.archive,
    "--controls-opacity": frame.controlsOpacity,
  };

  for (const [name, value] of Object.entries(variables)) {
    root.style.setProperty(name, String(value));
  }

  root.classList.toggle("archive-active", frame.archiveInteractive);
}

export function createStage({
  root,
  stage,
  reducedMotion = false,
  onFrame = null,
  requestFrame = window.requestAnimationFrame.bind(window),
  cancelFrame = window.cancelAnimationFrame.bind(window),
}) {
  let sectionTop = 0;
  let travel = 1;
  let targetProgress = 0;
  let renderedProgress = 0;
  let pointerTarget = { x: 0, y: 0 };
  let renderedPointer = { x: 0, y: 0 };
  let frameId = null;
  let inViewport = true;
  let observer = null;

  const reducedQuery = window.matchMedia?.("(pointer: coarse)");
  const canUsePointer = !reducedMotion && !reducedQuery?.matches;

  function measure() {
    const rect = root.getBoundingClientRect();
    sectionTop = window.scrollY + rect.top;
    travel = Math.max(1, root.offsetHeight - stage.offsetHeight);
    targetProgress = calculateLocalProgress({ scrollY: window.scrollY, sectionTop, travel });
  }

  function requestRender() {
    if (frameId === null && inViewport) {
      frameId = requestFrame(render);
    }
  }

  function render() {
    frameId = null;
    targetProgress = calculateLocalProgress({ scrollY: window.scrollY, sectionTop, travel });
    renderedProgress = reducedMotion ? targetProgress : lerp(renderedProgress, targetProgress, 0.12);
    renderedPointer = {
      x: reducedMotion ? 0 : lerp(renderedPointer.x, pointerTarget.x, 0.09),
      y: reducedMotion ? 0 : lerp(renderedPointer.y, pointerTarget.y, 0.09),
    };

    const frame = deriveSceneFrame(renderedProgress, renderedPointer);
    writeFrame(root, frame);
    onFrame?.(frame);

    const progressDelta = Math.abs(targetProgress - renderedProgress);
    const pointerDelta = Math.max(
      Math.abs(pointerTarget.x - renderedPointer.x),
      Math.abs(pointerTarget.y - renderedPointer.y),
    );

    if (!reducedMotion && (progressDelta > FRAME_EPSILON || pointerDelta > FRAME_EPSILON)) {
      requestRender();
    }
  }

  function onScroll() {
    requestRender();
  }

  function onResize() {
    measure();
    requestRender();
  }

  function onPointerMove(event) {
    if (!canUsePointer) return;
    pointerTarget = {
      x: clamp((event.clientX / window.innerWidth - 0.5) * 2, -1, 1),
      y: clamp((event.clientY / window.innerHeight - 0.5) * 2, -1, 1),
    };
    requestRender();
  }

  function onVisibility(entries) {
    inViewport = entries[0]?.isIntersecting ?? true;
    if (inViewport) requestRender();
  }

  function start() {
    measure();
    renderedProgress = targetProgress;
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(onVisibility, { threshold: 0 });
      observer.observe(root);
    }

    requestRender();
  }

  function scrollToProgress(progress, behavior = "smooth") {
    window.scrollTo({ top: sectionTop + travel * clamp(progress), behavior });
    requestRender();
  }

  function destroy() {
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("pointermove", onPointerMove);
    observer?.disconnect();
    if (frameId !== null) cancelFrame(frameId);
    frameId = null;
  }

  return {
    start,
    destroy,
    scrollToProgress,
    getProgress: () => renderedProgress,
    measure,
  };
}
