import "../styles.css";
import { canopyImages, plasterImages, skyImages, wallImages } from "./canopies.js";
import { teams } from "./data.js";

const $ = (selector) => document.querySelector(selector);
const teamNav = $(".team-nav");
const canvas = $("#flag-canvas");
const context = canvas.getContext("2d", { alpha: true });
const experience = $(".experience");
const canopy = $(".canopy");
const countrySky = $(".country-sky");
const countryWall = $(".country-wall");
const rosterPanel = $(".roster-panel");
const rosterToggle = $(".roster-toggle");
const rosterClose = $(".roster-close");
const sceneModeButtons = [...document.querySelectorAll("[data-scene-mode]")];
const scrim = $(".panel-scrim");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

let activeIndex = 0;
let strands = [];
let glyphGroups = [];
let cssWidth = 0;
let cssHeight = 0;
let animationFrame = 0;
let transitionTimer = 0;
let resizeTimer = 0;
let currentAudio = null;
let currentAudioClips = [];
let currentClipIndex = -1;
let currentAudioTeamId = null;
let audioStartPending = false;
let audioRetryBlocked = false;
let audioRetryAfter = 0;
let audioFadeFrame = 0;
let pointerOnCurtain = false;
let curtainBounds = null;
let lastCommentaryAt = 0;
let brushEnergy = 0;
let previousFrameTime = 0;
let previousPhysicsScale = 1;
let sceneMode = "architecture";
let isSceneTransitioning = false;
let carouselGhost = null;
let carouselSnapTimer = 0;

const carouselGesture = {
  pointerId: null,
  startX: 0,
  startY: 0,
  lastX: 0,
  lastTime: 0,
  dragX: 0,
  velocityX: 0,
  dragging: false
};

try {
  const savedMode = localStorage.getItem("final-four-scene-mode");
  if (savedMode === "architecture" || savedMode === "plaster") sceneMode = savedMode;
} catch {
  // The mode still works when storage is unavailable.
}

const FIXED_STEP = 1000 / 60;
const THREAD_GRAVITY = 0.18;
const THREAD_DAMPING = 0.986;
const COMMENTARY_VOLUME = 0.88;
const AUDIO_FADE_IN_MS = 1000;
const AUDIO_FADE_OUT_MS = 2000;

const pointer = {
  x: -1000,
  y: -1000,
  previousX: -1000,
  previousY: -1000,
  active: false,
  lastMove: 0
};

function navMarkup() {
  teamNav.innerHTML = teams
    .map((team, index) => `
      <button type="button" data-team="${index}" aria-pressed="${index === 0}">
        <span>0${index + 1}</span>${team.name}
      </button>`)
    .join("");
}

function setTheme(team) {
  const root = document.documentElement;
  document.body.dataset.team = team.id;
  root.style.setProperty("--team-ink", team.ink);
  root.style.setProperty("--team-wash", team.wash);
  root.style.setProperty("--wall-opacity", team.wallOpacity);
  root.style.setProperty("--sky-opacity", team.skyOpacity);
  root.style.setProperty("--flag-a", team.colors[0]);
  root.style.setProperty("--flag-b", team.colors[1]);
  root.style.setProperty("--flag-c", team.colors[2]);
  root.style.setProperty("--plaster-image", `url("${plasterImages[team.id].src}")`);
}

function setSceneMode(nextMode) {
  sceneMode = nextMode === "plaster" ? "plaster" : "architecture";
  document.body.classList.toggle("mode-plaster", sceneMode === "plaster");
  document.body.dataset.sceneMode = sceneMode;
  sceneModeButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.sceneMode === sceneMode));
  });

  try {
    localStorage.setItem("final-four-scene-mode", sceneMode);
  } catch {
    // Ignore storage restrictions; the current selection still applies.
  }
}

function updateCopy(team) {
  $(".country-title").textContent = team.localName;
  $(".country-poem").textContent = team.poem;
  $(".country-code").textContent = team.code;
  $(".country-index").textContent = `0${activeIndex + 1} / 04`;
  $(".current-number").textContent = `0${activeIndex + 1}`;
  $(".roster-title").textContent = `${team.name} squad`;

  const grouped = team.players.reduce((groups, item) => {
    (groups[item.role] ??= []).push(item);
    return groups;
  }, {});

  $(".roster-groups").innerHTML = Object.entries(grouped)
    .map(([role, list]) => `
      <section class="roster-group">
        <h3>${role}<span>${String(list.length).padStart(2, "0")}</span></h3>
        <ol>${list.map(({ name }, index) => `<li><span>${String(index + 1).padStart(2, "0")}</span>${name}</li>`).join("")}</ol>
      </section>`)
    .join("");

  $(".roster-source").innerHTML = `Roster snapshot: <a href="${team.sourceUrl}" target="_blank" rel="noreferrer">${team.sourceLabel}</a>.`;
  canvas.setAttribute("aria-label", `${team.name} flag formed from hanging strands of player names. Brush across the strings to set them swinging.`);
}

function updateCanopy(team) {
  const asset = canopyImages[team.id];
  const image = new Image();
  image.src = asset.src;
  image.alt = asset.alt;
  image.decoding = "async";
  image.draggable = false;
  canopy.replaceChildren(image);

  const wallAsset = wallImages[team.id];
  const wallImage = new Image();
  wallImage.src = wallAsset.src;
  wallImage.alt = wallAsset.alt;
  wallImage.decoding = "async";
  wallImage.draggable = false;
  countryWall.replaceChildren(wallImage);

  const skyAsset = skyImages[team.id];
  const skyImage = new Image();
  skyImage.src = skyAsset.src;
  skyImage.alt = skyAsset.alt;
  skyImage.decoding = "async";
  skyImage.draggable = false;
  countrySky.replaceChildren(skyImage);

  const decode = (target) => typeof target.decode === "function"
    ? target.decode().catch(() => undefined)
    : Promise.resolve();
  return Promise.all([decode(image), decode(wallImage), decode(skyImage)]);
}

function createCarouselGhost(direction, releaseX = 0) {
  carouselGhost?.remove();

  const ghost = document.createElement("div");
  ghost.className = "carousel-ghost";
  ghost.dataset.direction = direction > 0 ? "forward" : "backward";
  ghost.style.setProperty("--carousel-release-x", `${releaseX}px`);
  ghost.setAttribute("aria-hidden", "true");

  const editorial = $(".editorial");
  const editorialClone = editorial.cloneNode(true);
  const editorialStyle = getComputedStyle(editorial);
  const titleClone = editorialClone.querySelector(".country-title");
  editorialClone.removeAttribute("aria-live");
  editorialClone.style.width = editorialStyle.width;
  titleClone.style.fontSize = getComputedStyle($(".country-title")).fontSize;

  const shellClone = $(".flag-shell").cloneNode(true);
  shellClone.removeAttribute("aria-label");
  shellClone.querySelector(".interaction-hint")?.remove();
  shellClone.querySelector(".audio-caption")?.remove();

  const cloneCanvas = shellClone.querySelector("canvas");
  cloneCanvas.removeAttribute("id");
  cloneCanvas.classList.add("flag-canvas-clone");
  cloneCanvas.width = canvas.width;
  cloneCanvas.height = canvas.height;
  cloneCanvas.getContext("2d").drawImage(canvas, 0, 0);
  cloneCanvas.style.filter = getComputedStyle(canvas).filter;

  const canopyImage = canopy.querySelector("img");
  const cloneCanopy = shellClone.querySelector(".canopy");
  const cloneCanopyImage = shellClone.querySelector(".canopy img");
  if (cloneCanopy) cloneCanopy.style.filter = getComputedStyle(canopy).filter;
  if (canopyImage && cloneCanopyImage) {
    const canopyStyle = getComputedStyle(canopyImage);
    cloneCanopyImage.style.transform = canopyStyle.transform;
    cloneCanopyImage.style.filter = canopyStyle.filter;
  }

  ghost.append(editorialClone, shellClone);
  experience.append(ghost);
  carouselGhost = ghost;
  return ghost;
}

function applySceneInertiaImpulse(direction) {
  if (reducedMotion) return;
  const compact = innerWidth < 680;
  const lateralVelocity = compact ? 1.05 : 1.7;

  strands.forEach((strand, strandIndex) => {
    const phase = Math.sin((strandIndex / Math.max(1, strands.length - 1)) * Math.PI);
    for (let index = 1; index < strand.nodes.length; index += 1) {
      const node = strand.nodes[index];
      const depth = index / (strand.nodes.length - 1);
      const flex = depth ** 1.12;
      const velocity = direction * lateralVelocity * flex * (0.9 + phase * 0.1);

      // A scene change gives the hanging threads lateral momentum only. Moving
      // their current positions first made the chain temporarily longer, so
      // the constraint solver reacted like a stretched elastic band.
      node.oldX = node.x + velocity;
      node.oldY = node.y;
    }
  });
}

function finishSceneTransition() {
  clearTimeout(transitionTimer);
  carouselGhost?.remove();
  carouselGhost = null;
  isSceneTransitioning = false;
  document.body.classList.remove("is-changing", "is-entering", "is-settling");
  experience.style.removeProperty("--carousel-enter-x");
}

function selectTeam(nextIndex, direction = 1, { releaseX = 0 } = {}) {
  const targetIndex = (nextIndex + teams.length) % teams.length;
  if (targetIndex === activeIndex || isSceneTransitioning) return;

  const team = teams[targetIndex];
  clearTimeout(transitionTimer);
  hideAudioCaption();
  stopCurrentAudio();
  isSceneTransitioning = true;
  document.body.dataset.direction = direction > 0 ? "forward" : "backward";
  experience.style.setProperty("--carousel-enter-x", direction > 0 ? "100vw" : "-100vw");

  if (!reducedMotion) {
    createCarouselGhost(direction, releaseX);
    document.body.classList.add("is-changing", "is-entering");
  }
  document.body.classList.remove("is-carousel-dragging", "is-carousel-snapping");
  experience.style.removeProperty("--carousel-drag-x");

  activeIndex = targetIndex;
  setTheme(team);
  updateCopy(team);
  const assetsReady = updateCanopy(team);
  buildStrands();
  void prepareTeamAudio(team);
  teamNav.querySelectorAll("button").forEach((button, index) => {
    button.setAttribute("aria-pressed", String(index === activeIndex));
  });

  if (reducedMotion) {
    finishSceneTransition();
    return;
  }

  const assetTimeout = new Promise((resolve) => window.setTimeout(resolve, 320));
  Promise.race([assetsReady, assetTimeout]).then(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        carouselGhost?.classList.add("is-leaving");
        applySceneInertiaImpulse(direction);
        document.body.classList.add("is-settling");
      });
    });
    transitionTimer = window.setTimeout(finishSceneTransition, 620);
  });
}

function spainCrestColor(x, y) {
  const crestCenterX = 1 / 3;
  const crownX = (x - crestCenterX) / 0.1;
  const crownY = (y - 0.315) / 0.085;
  const crownBase = Math.abs(crownX) < 1 && crownY > 0.15 && crownY < 0.72;
  const crownPoints = crownY >= -0.55 && crownY <= 0.22 && Math.abs(crownX) < 0.9
    && Math.cos(crownX * Math.PI * 3) > crownY * 1.25;
  if (crownBase || crownPoints) return crownY > 0.48 ? "#6f1427" : "#d5a719";

  const pillarLeft = Math.abs(x - (crestCenterX - 0.115)) < 0.018 && y > 0.38 && y < 0.68;
  const pillarRight = Math.abs(x - (crestCenterX + 0.115)) < 0.018 && y > 0.38 && y < 0.68;
  if (pillarLeft || pillarRight) {
    if (y < 0.43 || y > 0.63) return "#6f1427";
    return y > 0.55 ? "#173b78" : "#f3eee1";
  }

  const shieldX = (x - crestCenterX) / 0.105;
  const shieldY = (y - 0.52) / 0.185;
  const taper = shieldY > 0.35 ? (shieldY - 0.35) * 0.38 : 0;
  const insideShield = shieldY > -0.78 && shieldY < 0.98 && Math.abs(shieldX) < 0.92 - taper;
  if (!insideShield) return null;

  const border = Math.abs(shieldX) > 0.74 - taper || shieldY < -0.62 || shieldY > 0.81;
  if (border) return "#5b2b22";
  if (Math.hypot(shieldX / 0.34, (shieldY - 0.08) / 0.28) < 1) return "#173b78";
  if (shieldY < 0.08) return shieldX < 0 ? "#8f1730" : "#d5a719";
  return shieldX < 0 ? "#f3eee1" : "#8f1730";
}

function argentinaSunColor(x, y) {
  const dx = (x - 0.5) / 0.078;
  const dy = (y - 0.5) / 0.124;
  const radius = Math.hypot(dx, dy);
  if (radius < 0.45) return radius < 0.16 ? "#9f6d00" : "#f6b40e";

  const angle = Math.atan2(dy, dx);
  const rayIndex = Math.round((angle / (Math.PI * 2)) * 32);
  const rayAlignment = Math.abs(Math.sin(angle * 16));
  const rayLength = rayIndex % 2 === 0 ? 1.12 : 0.94;
  return rayAlignment < 0.5 && radius < rayLength ? "#f6b40e" : null;
}

function colorFor(team, x, y) {
  if (team.id === "spain") {
    const crest = spainCrestColor(x, y);
    if (crest) return crest;
    return y < 0.25 || y > 0.75 ? team.colors[0] : team.colors[1];
  }
  if (team.id === "france") return x < 0.333 ? team.colors[0] : x < 0.666 ? team.colors[1] : team.colors[2];
  if (team.id === "argentina") {
    const sun = argentinaSunColor(x, y);
    return sun ?? (y < 0.333 || y > 0.667 ? team.colors[0] : team.colors[1]);
  }

  const dx = Math.abs(x - 0.5);
  const dy = Math.abs(y - 0.5);
  return dx < 0.06 || dy < 0.1 ? team.colors[1] : team.colors[0];
}

function glyphStream(team) {
  return team.players
    .map(({ name }) => `${name.toLocaleUpperCase()}  •  `)
    .join("")
    .replaceAll(" ", "·");
}

function buildStrands() {
  if (!cssWidth || !cssHeight) return;
  const team = teams[activeIndex];
  const installationWidth = $(".flag-shell").getBoundingClientRect().width;
  const compact = innerWidth < 680;
  // Keep one physical curtain frame for every team. The colour construction
  // changes by country, but switching scenes or adding canvas overscan must
  // not resize the installation itself.
  const flagWidth = Math.min(
    installationWidth * (compact ? 0.84 : 0.63),
    compact ? 720 : installationWidth * 0.78,
  );
  const anchorY = cssHeight * (compact ? 0.425 : 0.36);
  const bottomGap = compact ? 164 : 42;
  const flagHeight = Math.max(170, Math.min(flagWidth / 1.5, cssHeight - anchorY - bottomGap));
  const targetStrandGap = compact ? 6.1 : 7.1;
  const targetNodeGap = compact ? 7.9 : 8.7;
  const rawStrandCount = Math.max(36, Math.round(flagWidth / targetStrandGap) + 1);
  const rawNodeCount = Math.max(24, Math.round(flagHeight / targetNodeGap));
  const strandCount = Math.max(36, Math.round(rawStrandCount / 6) * 6);
  const nodeCount = Math.max(24, Math.round(rawNodeCount / 12) * 12);
  const strandGap = flagWidth / Math.max(1, strandCount - 1);
  const nodeGap = flagHeight / nodeCount;
  const startX = (cssWidth - flagWidth) / 2;
  const stream = glyphStream(team);
  let streamIndex = 0;

  strands = Array.from({ length: strandCount }, (_, column) => {
    const normalizedX = column / Math.max(1, strandCount - 1);
    const anchorX = startX + column * strandGap;
    const attachmentY = anchorY;
    const nodes = [{
      x: anchorX,
      y: attachmentY,
      oldX: anchorX,
      oldY: attachmentY,
      baseX: anchorX,
      baseY: attachmentY,
      pinned: true,
      char: "",
      color: team.ink,
      size: 0
    }];

    for (let row = 1; row <= nodeCount; row += 1) {
      const normalizedY = (row - 1) / Math.max(1, nodeCount - 1);
      const baseY = attachmentY + row * nodeGap;
      const char = stream[streamIndex % stream.length];
      const separator = char === "·" || char === "•";
      const initialSway = reducedMotion ? 0 : Math.sin(column * 0.43 + row * 0.17) * 0.18;
      nodes.push({
        x: anchorX + initialSway,
        y: baseY,
        oldX: anchorX + initialSway * 0.5,
        // New strands start with no vertical velocity. Scene-change inertia is
        // applied only on X; seeding oldY above baseY made every rebuilt flag
        // drop and rebound as if the threads were elastic.
        oldY: baseY,
        baseX: anchorX,
        baseY,
        pinned: false,
        char,
        separator,
        color: colorFor(team, normalizedX, normalizedY),
        alpha: separator ? 0.18 : 1,
        size: nodeGap * (separator ? 0.4 : 0.92)
      });
      streamIndex += 1;
    }

    return { nodes, restLength: nodeGap, phase: column * 0.31 };
  });

  const groups = new Map();
  for (const strand of strands) {
    for (let index = 1; index < strand.nodes.length; index += 1) {
      const node = strand.nodes[index];
      const key = `${node.color}:${node.separator ? "separator" : "glyph"}`;
      if (!groups.has(key)) {
        groups.set(key, {
          color: node.color,
          alpha: node.alpha,
          font: `700 ${node.size}px "Playfair Display", Georgia, serif`,
          nodes: []
        });
      }
      groups.get(key).nodes.push(node);
    }
  }
  glyphGroups = [...groups.values()];
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  cssWidth = rect.width;
  cssHeight = rect.height;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  buildStrands();
}

function integrateStrands(time, timeScale = 1) {
  if (reducedMotion) return;

  const velocityRatio = Math.min(1.35, Math.max(0.75, timeScale / previousPhysicsScale));
  const accelerationScale = timeScale ** 2;

  for (const strand of strands) {
    const damping = THREAD_DAMPING ** timeScale;
    for (let index = 1; index < strand.nodes.length; index += 1) {
      const node = strand.nodes[index];
      const depth = index / (strand.nodes.length - 1);
      const velocityX = (node.x - node.oldX) * velocityRatio * damping;
      const velocityY = (node.y - node.oldY) * velocityRatio * damping;
      node.oldX = node.x;
      node.oldY = node.y;
      node.x += velocityX;
      node.y += velocityY + THREAD_GRAVITY * accelerationScale;
      node.x += Math.sin(time * 0.0007 + strand.phase + index * 0.07) * 0.0008 * depth * accelerationScale;
    }
  }

  // The original soft distance relaxation deliberately leaves a little length
  // error between frames. That stored error is what gives the curtain its
  // familiar springy recoil.
  for (let iteration = 0; iteration < 5; iteration += 1) {
    for (const strand of strands) {
      const anchor = strand.nodes[0];
      anchor.x = anchor.baseX;
      anchor.y = anchor.baseY;

      for (let index = 0; index < strand.nodes.length - 1; index += 1) {
        const first = strand.nodes[index];
        const second = strand.nodes[index + 1];
        const dx = second.x - first.x;
        const dy = second.y - first.y;
        const distance = Math.hypot(dx, dy) || 1;
        const difference = (distance - strand.restLength) / distance;
        const correctionX = dx * difference * 0.5;
        const correctionY = dy * difference * 0.5;

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

function isOrnamentStrand(index) {
  const lastIndex = strands.length - 1;
  const centerIndex = Math.round(lastIndex / 2);
  const stride = Math.max(6, Math.round(strands.length / 11));
  return index === 0
    || index === lastIndex
    || index === centerIndex
    || index % stride === Math.floor(stride / 2);
}

function drawMountingDetails(team) {
  context.save();
  context.lineWidth = 0.7;
  context.globalAlpha = pointerOnCurtain ? 0.9 : 0.72;

  for (let index = 0; index < strands.length; index += 1) {
    if (!isOrnamentStrand(index)) continue;
    const anchor = strands[index].nodes[0];
    const metal = team.id === "spain"
      ? "#b98624"
      : team.id === "england"
        ? "#8d8064"
        : team.id === "france"
          ? "#718d82"
          : "#a87823";
    context.fillStyle = metal;
    context.strokeStyle = "rgba(24, 20, 16, .52)";
    context.beginPath();
    context.arc(anchor.x, anchor.y, innerWidth < 680 ? 1.55 : 1.9, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }

  context.restore();
}

function drawSpainPendant(major) {
  context.fillStyle = "#d3a12b";
  context.strokeStyle = "#6f351d";
  context.beginPath();
  context.arc(0, 3.2, major ? 2.5 : 2.05, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = "#8f1730";
  context.beginPath();
  context.moveTo(-2.2, 6);
  context.lineTo(2.2, 6);
  context.lineTo(1.2, major ? 13.8 : 11.8);
  context.lineTo(0, major ? 15.2 : 13.1);
  context.lineTo(-1.2, major ? 13.8 : 11.8);
  context.closePath();
  context.fill();
  context.stroke();
  context.strokeStyle = "rgba(232, 188, 76, .78)";
  context.beginPath();
  context.moveTo(0, 6.8);
  context.lineTo(0, major ? 13.5 : 11.6);
  context.stroke();
}

function drawEnglandPendant(major) {
  context.fillStyle = "#aa9363";
  context.strokeStyle = "#293432";
  context.beginPath();
  context.ellipse(0, 3.2, major ? 2.5 : 2.05, 1.65, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = "#253230";
  context.beginPath();
  context.moveTo(-2.1, 5.5);
  context.quadraticCurveTo(-2.5, 9.8, 0, major ? 14.6 : 12.5);
  context.quadraticCurveTo(2.5, 9.8, 2.1, 5.5);
  context.closePath();
  context.fill();
  context.stroke();
  context.fillStyle = "#a81e32";
  context.beginPath();
  context.arc(0, major ? 9.2 : 8.2, major ? 1.35 : 1.05, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#e6dfd0";
  context.beginPath();
  context.arc(0, major ? 14.2 : 12.1, major ? 0.95 : 0.75, 0, Math.PI * 2);
  context.fill();
}

function drawFrancePendant(index, major) {
  const enamel = ["#173f78", "#eee9dd", "#d3293d"][Math.floor(index / 2) % 3];
  context.fillStyle = "#779287";
  context.strokeStyle = "#304d47";
  context.beginPath();
  context.arc(0, 3, major ? 2.35 : 1.95, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = enamel;
  context.beginPath();
  context.moveTo(0, 5.4);
  context.bezierCurveTo(major ? 3.1 : 2.5, 7.2, 2.25, 11.4, 0, major ? 14.5 : 12.5);
  context.bezierCurveTo(-2.25, 11.4, major ? -3.1 : -2.5, 7.2, 0, 5.4);
  context.closePath();
  context.fill();
  context.stroke();
  context.strokeStyle = "rgba(255, 255, 255, .52)";
  context.beginPath();
  context.moveTo(-0.55, 6.8);
  context.quadraticCurveTo(-1.1, 9.2, -0.35, 11.1);
  context.stroke();
}

function drawArgentinaPendant(major) {
  context.fillStyle = "#a97822";
  context.strokeStyle = "#315e75";
  context.beginPath();
  context.arc(0, 3, major ? 2.45 : 2, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  if (major) {
    context.strokeStyle = "#d89b16";
    for (let ray = 0; ray < 8; ray += 1) {
      const angle = ray * Math.PI / 4;
      context.beginPath();
      context.moveTo(Math.cos(angle) * 3.2, 9 + Math.sin(angle) * 3.2);
      context.lineTo(Math.cos(angle) * 4.6, 9 + Math.sin(angle) * 4.6);
      context.stroke();
    }
    context.fillStyle = "#e8a91d";
    context.beginPath();
    context.arc(0, 9, 3.25, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    return;
  }

  context.fillStyle = "#69b5e9";
  context.beginPath();
  context.moveTo(0, 5.2);
  context.bezierCurveTo(2.5, 7.2, 2.1, 10.7, 0, 13.2);
  context.bezierCurveTo(-2.1, 10.7, -2.5, 7.2, 0, 5.2);
  context.closePath();
  context.fill();
  context.stroke();
}

function drawCurtainOrnaments(team) {
  const lastIndex = strands.length - 1;
  const centerIndex = Math.round(lastIndex / 2);
  context.save();
  context.lineWidth = innerWidth < 680 ? 0.65 : 0.8;
  context.lineJoin = "round";
  context.globalAlpha = pointerOnCurtain ? 0.96 : 0.84;
  context.shadowColor = "rgba(22, 18, 14, .2)";
  context.shadowBlur = innerWidth < 680 ? 1.5 : 2.5;
  context.shadowOffsetX = 1.5;
  context.shadowOffsetY = 2;

  for (let index = 0; index < strands.length; index += 1) {
    if (!isOrnamentStrand(index)) continue;
    const nodes = strands[index].nodes;
    const end = nodes[nodes.length - 1];
    const previous = nodes[nodes.length - 2];
    const angle = Math.atan2(end.y - previous.y, end.x - previous.x) - Math.PI / 2;
    const major = index === 0 || index === lastIndex || index === centerIndex;
    const inertialSwing = reducedMotion ? 0 : Math.max(-0.22, Math.min(0.22, (end.x - end.oldX) * 0.055));
    const ornamentScale = innerWidth < 680 ? 0.9 : major ? 1.25 : 1.1;

    context.save();
    context.translate(end.x, end.y + 1.5);
    context.rotate(angle + inertialSwing);
    context.scale(ornamentScale, ornamentScale);
    context.strokeStyle = "rgba(38, 29, 21, .56)";
    context.beginPath();
    context.moveTo(0, -1);
    context.lineTo(0, 2.2);
    context.stroke();

    if (team.id === "spain") drawSpainPendant(major);
    if (team.id === "england") drawEnglandPendant(major);
    if (team.id === "france") drawFrancePendant(index, major);
    if (team.id === "argentina") drawArgentinaPendant(major);
    context.restore();
  }

  context.restore();
}

function drawStrands() {
  const team = teams[activeIndex];
  const plasterMode = document.body.classList.contains("mode-plaster");
  const threadAlpha = pointerOnCurtain ? 0.38 : plasterMode ? 0.28 : 0.22;
  let minCurtainX = Infinity;
  let maxCurtainX = -Infinity;
  let minCurtainY = Infinity;
  let maxCurtainY = -Infinity;
  context.clearRect(0, 0, cssWidth, cssHeight);
  context.lineCap = "round";
  context.lineJoin = "round";

  context.save();
  context.translate(2.4, 4.2);
  context.globalAlpha = pointerOnCurtain ? 0.24 : plasterMode ? 0.2 : 0.16;
  context.strokeStyle = "#17130f";
  context.lineWidth = 0.9;
  context.beginPath();
  for (const strand of strands) {
    const anchor = strand.nodes[0];
    minCurtainX = Math.min(minCurtainX, anchor.x);
    maxCurtainX = Math.max(maxCurtainX, anchor.x);
    minCurtainY = Math.min(minCurtainY, anchor.y);
    maxCurtainY = Math.max(maxCurtainY, anchor.y);
    context.moveTo(anchor.x, anchor.y);
    for (let index = 1; index < strand.nodes.length; index += 1) {
      const node = strand.nodes[index];
      minCurtainX = Math.min(minCurtainX, node.x);
      maxCurtainX = Math.max(maxCurtainX, node.x);
      minCurtainY = Math.min(minCurtainY, node.y);
      maxCurtainY = Math.max(maxCurtainY, node.y);
      context.lineTo(node.x, node.y);
    }
  }
  context.stroke();
  context.restore();

  if (Number.isFinite(minCurtainX)) {
    const hoverPadding = innerWidth < 680 ? 16 : 20;
    curtainBounds = {
      left: minCurtainX - hoverPadding,
      right: maxCurtainX + hoverPadding,
      top: minCurtainY - hoverPadding,
      bottom: maxCurtainY + hoverPadding
    };
  }

  context.globalAlpha = threadAlpha;
  context.strokeStyle = team.ink;
  context.lineWidth = 0.72;
  context.beginPath();
  for (const strand of strands) {
    context.moveTo(strand.nodes[0].x, strand.nodes[0].y);
    for (let index = 1; index < strand.nodes.length; index += 1) {
      const node = strand.nodes[index];
      context.lineTo(node.x, node.y);
    }
  }
  context.stroke();

  if (strands.length) {
    const firstAnchor = strands[0].nodes[0];
    const lastAnchor = strands[strands.length - 1].nodes[0];
    context.globalAlpha = pointerOnCurtain ? 0.7 : 0.5;
    context.lineWidth = 0.75;
    context.beginPath();
    context.moveTo(firstAnchor.x, firstAnchor.y);
    context.lineTo(lastAnchor.x, lastAnchor.y);
    context.stroke();
  }

  context.fillStyle = team.ink;
  context.globalAlpha = pointerOnCurtain ? 0.9 : 0.72;
  context.beginPath();
  for (const strand of strands) {
    const anchor = strand.nodes[0];
    context.moveTo(anchor.x + 1, anchor.y);
    context.arc(anchor.x, anchor.y, 1.25, 0, Math.PI * 2);
  }
  context.fill();
  drawMountingDetails(team);

  context.textAlign = "center";
  context.textBaseline = "middle";
  for (const group of glyphGroups) {
    context.font = group.font;
    context.globalAlpha = group.alpha;
    context.fillStyle = group.color;
    for (const node of group.nodes) context.fillText(node.char, node.x, node.y);
  }
  drawCurtainOrnaments(team);
  context.globalAlpha = 1;
}

function tick(time = 0) {
  if (!previousFrameTime) previousFrameTime = time;
  const frameDelta = Math.min(32, Math.max(6, time - previousFrameTime || FIXED_STEP));
  previousFrameTime = time;
  const timeScale = Math.min(1.5, Math.max(0.45, frameDelta / FIXED_STEP));
  integrateStrands(time, timeScale);
  previousPhysicsScale = timeScale;
  drawStrands();
  if (pointer.active) setCurtainHover(isPointOnCurtain(pointer.x, pointer.y));
  brushEnergy *= 0.94;
  animationFrame = requestAnimationFrame(tick);
}

function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared));
  const nearestX = x1 + dx * t;
  const nearestY = y1 + dy * t;
  const offsetX = px - nearestX;
  const offsetY = py - nearestY;
  return { distance: Math.hypot(offsetX, offsetY), offsetX, offsetY, t };
}

function brushStrands(fromX, fromY, toX, toY, elapsedMs = 16.67) {
  const movementX = toX - fromX;
  const movementY = toY - fromY;
  const distance = Math.hypot(movementX, movementY);
  if (distance < 0.35) return;
  const speed = Math.min(36, distance * (FIXED_STEP / Math.max(8, elapsedMs)));
  const impulseX = (movementX / distance) * speed;
  const impulseY = (movementY / distance) * speed;

  const radius = innerWidth < 680 ? 44 : 62;
  const hitStrands = new Set();

  strands.forEach((strand, strandIndex) => {
    for (let nodeIndex = 1; nodeIndex < strand.nodes.length; nodeIndex += 1) {
      const node = strand.nodes[nodeIndex];
      const hit = distanceToSegment(node.x, node.y, fromX, fromY, toX, toY);
      if (hit.distance >= radius) continue;

      hitStrands.add(strandIndex);
      if (reducedMotion) continue;

      const depth = nodeIndex / (strand.nodes.length - 1);
      const influence = (1 - hit.distance / radius) ** 2 * (0.42 + depth * 0.58);
      const normalLength = hit.distance || 1;
      node.x += impulseX * influence * 0.62
        + (hit.offsetX / normalLength) * speed * influence * 0.13;
      node.y += impulseY * influence * 0.2
        + (hit.offsetY / normalLength) * speed * influence * 0.055;
      node.oldX -= impulseX * influence * 0.16;
      node.oldY -= impulseY * influence * 0.05;
    }
  });

  brushEnergy += speed * Math.min(12, hitStrands.size) * 0.16;
  if (hitStrands.size >= 2 && brushEnergy > 10) {
    const now = performance.now();
    const audioIsPlaying = audioStartPending || (currentAudio && !currentAudio.paused && !currentAudio.ended);
    if (pointerOnCurtain && !audioIsPlaying && now - lastCommentaryAt > 1200) {
      lastCommentaryAt = now;
      brushEnergy = 0;
      void triggerCommentary(teams[activeIndex]);
    }
  }
}

function isPointOnCurtain(x, y) {
  if (!curtainBounds) return false;
  return x >= curtainBounds.left
    && x <= curtainBounds.right
    && y >= curtainBounds.top
    && y <= curtainBounds.bottom;
}

function cancelAudioFade() {
  cancelAnimationFrame(audioFadeFrame);
  audioFadeFrame = 0;
}

function fadeCurrentAudio(targetVolume, duration, stopAfter = false) {
  const audio = currentAudio;
  if (!audio) return;
  cancelAudioFade();

  const initialVolume = audio.volume;
  const startedAt = performance.now();
  const step = (now) => {
    if (currentAudio !== audio) return;
    const progress = Math.min(1, (now - startedAt) / duration);
    const eased = 1 - (1 - progress) ** 3;
    audio.volume = initialVolume + (targetVolume - initialVolume) * eased;

    if (progress < 1) {
      audioFadeFrame = requestAnimationFrame(step);
      return;
    }

    audioFadeFrame = 0;
    if (stopAfter && !pointerOnCurtain) {
      audio.pause();
      audio.currentTime = 0;
      hideAudioCaption();
    }
  };

  audioFadeFrame = requestAnimationFrame(step);
}

function setCurtainHover(isHovering) {
  if (pointerOnCurtain === isHovering) {
    if (isHovering) ensureCurtainAudio();
    return;
  }
  pointerOnCurtain = isHovering;

  if (isHovering) {
    if (currentAudio && !currentAudio.paused && !currentAudio.ended) {
      fadeCurrentAudio(COMMENTARY_VOLUME, AUDIO_FADE_IN_MS);
    } else {
      ensureCurtainAudio();
    }
    return;
  }

  if (currentAudio && !currentAudio.paused) {
    fadeCurrentAudio(0, AUDIO_FADE_OUT_MS, true);
  }
}

function ensureCurtainAudio() {
  if (!pointerOnCurtain || audioStartPending) return;
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  if (audioRetryBlocked) audioRetryBlocked = false;
  if (performance.now() < audioRetryAfter) return;
  const audioIsPlaying = currentAudio && !currentAudio.paused && !currentAudio.ended;
  if (audioIsPlaying) return;
  lastCommentaryAt = performance.now();
  void triggerCommentary(teams[activeIndex]);
}

function registerAudioGesture() {
  audioRetryBlocked = false;
  audioRetryAfter = 0;
  if (pointerOnCurtain) ensureCurtainAudio();
}

function pointFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  const point = event.touches?.[0] ?? event;
  if (!point) return;

  const nextX = point.clientX - rect.left;
  const nextY = point.clientY - rect.top;
  if (navigator.userActivation?.hasBeenActive) audioRetryBlocked = false;
  setCurtainHover(isPointOnCurtain(nextX, nextY));
  if (!pointer.active) {
    pointer.previousX = nextX;
    pointer.previousY = nextY;
    pointer.x = nextX;
    pointer.y = nextY;
    pointer.active = true;
    pointer.lastMove = performance.now();
    return;
  }

  pointer.previousX = pointer.x;
  pointer.previousY = pointer.y;
  pointer.x = nextX;
  pointer.y = nextY;
  const now = performance.now();
  const elapsedMs = Math.min(40, Math.max(8, now - pointer.lastMove));
  pointer.lastMove = now;
  brushStrands(pointer.previousX, pointer.previousY, pointer.x, pointer.y, elapsedMs);
}

function showAudioCaption() {}

function hideAudioCaption() {}

function commentaryClips(team) {
  const clips = team.commentary.clips ?? [{ file: team.commentary.file, line: team.commentary.line }];
  return clips.map((clip) => ({
    ...clip,
    url: new URL(clip.file, window.location.href).href
  }));
}

function prepareTeamAudio(team) {
  stopCurrentAudio(true);
  const clips = commentaryClips(team);
  if (teams[activeIndex].id !== team.id) return;

  currentAudioClips = clips
    .map((clip) => {
      const audio = new Audio(clip.url);
      audio.preload = "auto";
      audio.playsInline = true;
      audio.volume = COMMENTARY_VOLUME;
      audio.addEventListener("ended", () => {
        if (currentAudio === audio && pointerOnCurtain && teams[activeIndex].id === team.id) {
          void triggerCommentary(team);
        }
      });
      audio.load();
      return { audio, clip };
    });
  currentAudioTeamId = team.id;
  currentClipIndex = -1;
  if (pointerOnCurtain) queueMicrotask(ensureCurtainAudio);
}

function stopCurrentAudio(discard = false) {
  cancelAudioFade();
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }
  if (discard) {
    currentAudio = null;
    currentAudioClips = [];
    currentClipIndex = -1;
    currentAudioTeamId = null;
  }
}

async function triggerCommentary(team) {
  if (audioStartPending || !pointerOnCurtain || performance.now() < audioRetryAfter) return;
  audioStartPending = true;
  if (currentAudioTeamId !== team.id) {
    prepareTeamAudio(team);
    audioStartPending = true;
  }

  if (!pointerOnCurtain || teams[activeIndex].id !== team.id) {
    audioStartPending = false;
    return;
  }

  if (currentAudioClips.length) {
    currentClipIndex = (currentClipIndex + 1) % currentAudioClips.length;
    const next = currentAudioClips[currentClipIndex];
    const audio = next.audio;
    currentAudio = audio;
    audio.currentTime = 0;
    audio.volume = 0;
    try {
      await audio.play();
      if (!pointerOnCurtain) {
        audio.pause();
        audio.currentTime = 0;
        audioStartPending = false;
        return;
      }
      audioRetryBlocked = false;
      audioRetryAfter = 0;
      fadeCurrentAudio(COMMENTARY_VOLUME, AUDIO_FADE_IN_MS);
      showAudioCaption(next.clip.line, "Original match commentary", team.commentary);
      audioStartPending = false;
      return;
    } catch (error) {
      if (currentAudio === audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      audioRetryAfter = performance.now() + 650;
      if (error?.name === "NotAllowedError") {
        audioRetryBlocked = !(navigator.userActivation?.hasBeenActive);
        currentClipIndex = (currentClipIndex - 1 + currentAudioClips.length) % currentAudioClips.length;
      }
      showAudioCaption(next.clip.line, "Click or drag once to allow match audio", team.commentary);
      audioStartPending = false;
      return;
    }
  }

  audioStartPending = false;
  showAudioCaption(team.commentary.line, "Audio file missing · open official highlight", team.commentary);
}

function openRoster() {
  rosterPanel.setAttribute("aria-hidden", "false");
  rosterToggle.setAttribute("aria-expanded", "true");
  document.body.classList.add("panel-open");
  rosterClose.focus();
}

function closeRoster() {
  rosterPanel.setAttribute("aria-hidden", "true");
  rosterToggle.setAttribute("aria-expanded", "false");
  document.body.classList.remove("panel-open");
  rosterToggle.focus();
}

function resetCarouselGesture() {
  carouselGesture.pointerId = null;
  carouselGesture.dragging = false;
  carouselGesture.dragX = 0;
  carouselGesture.velocityX = 0;
}

function snapCarouselBack() {
  clearTimeout(carouselSnapTimer);
  document.body.classList.add("is-carousel-snapping");
  experience.style.setProperty("--carousel-drag-x", "0px");
  carouselSnapTimer = window.setTimeout(() => {
    document.body.classList.remove("is-carousel-dragging", "is-carousel-snapping");
    experience.style.removeProperty("--carousel-drag-x");
  }, reducedMotion ? 0 : 280);
}

function beginCarouselGesture(event) {
  if (event.button !== undefined && event.button !== 0) return;
  if (isSceneTransitioning || document.body.classList.contains("panel-open")) return;
  if (event.target.closest("button, a, aside")) return;

  clearTimeout(carouselSnapTimer);
  document.body.classList.remove("is-carousel-dragging", "is-carousel-snapping");
  experience.style.removeProperty("--carousel-drag-x");
  carouselGesture.pointerId = event.pointerId;
  carouselGesture.startX = event.clientX;
  carouselGesture.startY = event.clientY;
  carouselGesture.lastX = event.clientX;
  carouselGesture.lastTime = event.timeStamp;
  carouselGesture.dragX = 0;
  carouselGesture.velocityX = 0;
  carouselGesture.dragging = false;
}

function moveCarouselGesture(event) {
  if (event.pointerId !== carouselGesture.pointerId || isSceneTransitioning) return;
  const deltaX = event.clientX - carouselGesture.startX;
  const deltaY = event.clientY - carouselGesture.startY;

  if (!carouselGesture.dragging) {
    if (Math.abs(deltaX) < 12) return;
    if (Math.abs(deltaX) < Math.abs(deltaY) * 1.25) {
      resetCarouselGesture();
      return;
    }
    carouselGesture.dragging = true;
    document.body.classList.add("is-carousel-dragging");
    experience.setPointerCapture?.(event.pointerId);
  }

  event.preventDefault();
  const elapsed = Math.max(8, event.timeStamp - carouselGesture.lastTime);
  const instantaneousVelocity = (event.clientX - carouselGesture.lastX) / elapsed;
  carouselGesture.velocityX = carouselGesture.velocityX * 0.68 + instantaneousVelocity * 0.32;
  carouselGesture.lastX = event.clientX;
  carouselGesture.lastTime = event.timeStamp;

  const travelLimit = innerWidth * 0.72;
  carouselGesture.dragX = travelLimit * Math.tanh(deltaX / travelLimit);
  experience.style.setProperty("--carousel-drag-x", `${carouselGesture.dragX}px`);
}

function endCarouselGesture(event) {
  if (event.pointerId !== carouselGesture.pointerId) return;
  if (!carouselGesture.dragging) {
    resetCarouselGesture();
    return;
  }

  const releaseX = carouselGesture.dragX;
  const velocityX = carouselGesture.velocityX;
  const commitDistance = Math.min(132, innerWidth * 0.18);
  const shouldAdvance = Math.abs(releaseX) > commitDistance || Math.abs(velocityX) > 0.52;
  const direction = releaseX < 0 ? 1 : -1;
  resetCarouselGesture();

  if (shouldAdvance) {
    selectTeam(activeIndex + direction, direction, { releaseX });
  } else {
    snapCarouselBack();
  }
}

function cancelCarouselGesture(event) {
  if (event.pointerId !== carouselGesture.pointerId) return;
  const wasDragging = carouselGesture.dragging;
  resetCarouselGesture();
  if (wasDragging) snapCarouselBack();
}

navMarkup();
setTheme(teams[0]);
updateCopy(teams[0]);
updateCanopy(teams[0]);
setSceneMode(sceneMode);

sceneModeButtons.forEach((button) => {
  button.addEventListener("click", () => setSceneMode(button.dataset.sceneMode));
});

teamNav.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-team]");
  if (!button) return;
  const next = Number(button.dataset.team);
  selectTeam(next, next >= activeIndex ? 1 : -1);
});

$(".previous").addEventListener("click", () => selectTeam(activeIndex - 1, -1));
$(".next").addEventListener("click", () => selectTeam(activeIndex + 1, 1));
rosterToggle.addEventListener("click", openRoster);
rosterClose.addEventListener("click", closeRoster);
scrim.addEventListener("click", closeRoster);

experience.addEventListener("pointerdown", beginCarouselGesture);
experience.addEventListener("pointermove", moveCarouselGesture);
experience.addEventListener("pointerup", endCarouselGesture);
experience.addEventListener("pointercancel", cancelCarouselGesture);

document.addEventListener("pointerdown", registerAudioGesture, { capture: true });
document.addEventListener("keydown", registerAudioGesture, { capture: true });
document.addEventListener("touchstart", registerAudioGesture, { capture: true, passive: true });

canvas.addEventListener("pointermove", pointFromEvent);
canvas.addEventListener("pointerenter", (event) => {
  pointFromEvent(event);
});
canvas.addEventListener("pointerdown", (event) => {
  pointFromEvent(event);
  if (pointerOnCurtain) {
    lastCommentaryAt = performance.now();
    void triggerCommentary(teams[activeIndex]);
  }
});
canvas.addEventListener("pointerleave", () => {
  pointer.active = false;
  setCurtainHover(false);
});
canvas.addEventListener("touchmove", pointFromEvent, { passive: true });
canvas.addEventListener("touchend", () => {
  pointer.active = false;
  setCurtainHover(false);
});

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") selectTeam(activeIndex - 1, -1);
  if (event.key === "ArrowRight") selectTeam(activeIndex + 1, 1);
  if (event.key === "Escape" && document.body.classList.contains("panel-open")) closeRoster();
});

const observer = new ResizeObserver(() => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(resizeCanvas, 60);
});
observer.observe(canvas);
resizeCanvas();
cancelAnimationFrame(animationFrame);
tick();
void prepareTeamAudio(teams[0]);
