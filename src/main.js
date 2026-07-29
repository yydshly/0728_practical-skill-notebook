import * as THREE from 'three';
import './style.css';
import { createVillage } from './level.js';
import { createPlayer } from './player.js';
import { createCameraController } from './camera.js';
import { createCameraPointerInput } from './camera-pointer-input.js';
import { createResident } from './characters.js';
import { createStoryDirector } from './story.js';
import { createPursuer } from './pursuer.js';
import { createAtmosphere } from './atmosphere.js';
import { createGameUi } from './ui.js';
import { nearestInteraction } from './interactions.js';
import {
  OBJECTIVE_DEFINITIONS,
  getObjectiveDefinition,
  resolveObjectiveTarget,
  validateObjectiveDefinitions,
} from './objectives.js';
import {
  computeGuidanceSnapshot,
  projectScreenMarker,
} from './guidance.js';
import { createWorldObjectiveMarker } from './world-marker.js';
import { createTutorialTracker } from './tutorial.js';
import { createDangerController } from './danger.js';
import { createAudioFeedback } from './audio-feedback.js';

const canvas = document.querySelector('#game');
const shell = document.querySelector('.game-shell');
const title = document.querySelector('.title-lockup');
const objective = document.querySelector('#objective');
const subtitle = document.querySelector('#subtitle');
const interaction = document.querySelector('#interaction');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const atmosphere = createAtmosphere(scene, renderer);

const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 120);
const village = createVillage(scene);
const player = createPlayer(scene, village.anchors.player_home, village.colliders);
const cameraController = createCameraController(camera, player, { occluders: village.cameraOccluders, groundY: 0 });
createResident(scene, village.anchors.neighbour, 'neighbour');
createResident(scene, village.anchors.granary.clone().add(new THREE.Vector3(-1.5, 0, 1.4)), 'barn_resident');
const ui = createGameUi({
  shell,
  title,
  missionHud: document.querySelector('.mission-hud'),
  missionStep: document.querySelector('#mission-step'),
  missionTitle: document.querySelector('#mission-title'),
  missionClue: document.querySelector('#mission-clue'),
  objective,
  subtitle,
  approachPrompt: document.querySelector('#approach-prompt'),
  interaction,
  tutorialHint: document.querySelector('#tutorial-hint'),
  compass: document.querySelector('#objective-compass'),
  compassLabel: document.querySelector('#compass-label'),
  compassDistance: document.querySelector('#compass-distance'),
  marker: document.querySelector('#screen-marker'),
  dangerState: document.querySelector('#danger-state'),
  completionToast: document.querySelector('#completion-toast'),
  muteToggle: document.querySelector('#mute-toggle'),
});
const audio = createAudioFeedback();
const worldMarker = createWorldObjectiveMarker(scene);
const dangerController = createDangerController();
const pursuer = createPursuer(scene, {
  navNodes: village.navNodes,
  spawn: village.anchors.sighting.clone(),
});
const tutorial = createTutorialTracker({
  onChange: (value) => ui.showTutorial(value),
});
const objectiveErrors = validateObjectiveDefinitions(
  OBJECTIVE_DEFINITIONS,
  new Set(Object.keys(village.anchors)),
);
if (objectiveErrors.length) console.error(objectiveErrors.join('\n'));
const storyDirector = createStoryDirector({
  ui,
  onEvent(event) {
    if (event.type === 'objective-completed') {
      ui.showCompletion(getObjectiveDefinition(event.objectiveId));
    }
    audio.handleStoryEvent(event);
  },
});
let guidanceSnapshot = {
  objectiveId: storyDirector.story.objective,
  targetPosition: null,
  distance: Infinity,
  distanceLabel: '',
  relativeAngle: 0,
  proximity: 'none',
  showWorldMarker: false,
};
let dangerSnapshot = dangerController.update(0, pursuer.state, Infinity);

const input = { forward: false, back: false, left: false, right: false, sprint: false };
const startTime = performance.now();
let lastTime = startTime;

const state = {
  chapter: 'home',
  cameraMode: 'third-person',
};

const allowedKinds = {
  leave_home: ['radio'],
  visit_courtyard: ['neighbour'],
  reach_granary: ['flashlight'],
};
const searchParams = new URLSearchParams(window.location.search);
const hasEvidenceParam = searchParams.has('evidence');
const evidenceState = searchParams.get('evidence');
const evidenceFixtures = {
  birth: {
    position: village.anchors.player_home,
    flags: { radio: false, neighbour: false, flashlight: false },
    objective: 'leave_home',
  },
  sighting: {
    position: new THREE.Vector3(0, 0, 8),
    pursuer: {
      position: new THREE.Vector3(-1, 0, 3),
      yaw: Math.atan2(1, 5),
      frozen: true,
    },
    flags: { radio: true, neighbour: true, flashlight: true },
    objective: 'escape_south_gate',
  },
  contact: {
    position: new THREE.Vector3(0, 0, 8),
    pursuer: {
      position: new THREE.Vector3(0, 0, 5.6),
      yaw: 0,
      frozen: false,
    },
    flags: { radio: true, neighbour: true, flashlight: true },
    objective: 'escape_south_gate',
  },
  'south-gate': {
    position: new THREE.Vector3(0, 0, -32),
    flags: { radio: true, neighbour: true, flashlight: true },
    objective: 'complete',
  },
};
const evidenceFixture = evidenceFixtures[evidenceState] ?? null;
let nearbyInteraction = null;

function updateInteraction() {
  const allowed = new Set(allowedKinds[storyDirector.story.objective] ?? []);
  nearbyInteraction = nearestInteraction(
    player.position,
    village.interactionAnchors.filter(
      (candidate) => allowed.has(candidate.kind) && !storyDirector.story.flags[candidate.kind],
    ),
    2.2,
  );
}

function refreshFeedback(dt, elapsed) {
  const objectiveId = storyDirector.story.objective;
  const definition = getObjectiveDefinition(objectiveId);
  const targetPosition = resolveObjectiveTarget(objectiveId, village.anchors);
  guidanceSnapshot = {
    objectiveId,
    ...computeGuidanceSnapshot({
      playerPosition: player.position,
      targetPosition,
      cameraYaw: cameraController.yaw,
    }),
  };
  const screenMarker = projectScreenMarker(
    targetPosition,
    camera,
    { width: canvas.clientWidth, height: canvas.clientHeight },
  );
  dangerSnapshot = dangerController.update(
    dt,
    pursuer.state,
    pursuer.object.position.distanceTo(player.position),
  );
  ui.renderMission(definition);
  ui.renderGuidance(definition, guidanceSnapshot, screenMarker);
  ui.renderDanger(dangerSnapshot);
  worldMarker.update({
    ...guidanceSnapshot,
    showWorldMarker: guidanceSnapshot.showWorldMarker && !ui.transitionActive,
  }, elapsed);
  audio.updateDanger(dangerSnapshot, elapsed);
}

function setCameraMode(mode) {
  cameraController.setMode(mode);
  state.cameraMode = cameraController.mode;
  ui.showSubtitle(state.cameraMode === 'first-person'
    ? '你屏住呼吸，透过门缝观察逐渐安静下来的院落。'
    : '雾色压低了屋檐，远处传来一声急促的犬吠。');
}

function applyEvidenceFixture() {
  if (!hasEvidenceParam) return;
  shell.dataset.evidenceState = evidenceState;
  const fixture = evidenceFixture;
  if (!fixture) return;

  player.position.copy(fixture.position);
  if (fixture.pursuer) {
    pursuer.reset();
    pursuer.object.position.copy(fixture.pursuer.position);
    pursuer.object.rotation.y = fixture.pursuer.yaw;
  }
  cameraController.setMode('third-person');
  state.cameraMode = cameraController.mode;
  Object.assign(storyDirector.story.flags, fixture.flags);
  storyDirector.story.objective = fixture.objective;
  storyDirector.render();
  ui.completeIntro();
}

function restart() {
  state.chapter = 'home';
  ui.setObjective('目标：离开主角家，调查村里的异常。');
  setCameraMode('third-person');
}

function resize() {
  const { clientWidth: width, clientHeight: height } = canvas;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function setKey(event, pressed) {
  if (event.code === 'KeyW') input.forward = pressed;
  if (event.code === 'KeyS') input.back = pressed;
  if (event.code === 'KeyA') input.left = pressed;
  if (event.code === 'KeyD') input.right = pressed;
  if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') input.sprint = pressed;
}

function unlockAudio() {
  audio.unlock();
}

addEventListener('keydown', (event) => {
  unlockAudio();
  setKey(event, true);
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) tutorial.complete('move');
  if ((event.code === 'ShiftLeft' || event.code === 'ShiftRight') && !event.repeat) {
    tutorial.complete('sprint');
  }
  if (event.code === 'KeyC' && !event.repeat) {
    tutorial.complete('camera');
    setCameraMode(cameraController.mode === 'third-person' ? 'first-person' : 'third-person');
  }
  if (event.code === 'KeyE' && !event.repeat && nearbyInteraction) {
    tutorial.complete('interact');
    storyDirector.interact(nearbyInteraction.kind);
    updateInteraction();
  }
});
addEventListener('keyup', (event) => setKey(event, false));
canvas.addEventListener('pointerdown', unlockAudio);
createCameraPointerInput({
  surface: canvas,
  eventTarget: window,
  documentRef: document,
  onRotate(deltaX, deltaY) {
    tutorial.complete('look');
    cameraController.rotate(deltaX, deltaY);
  },
});
addEventListener('resize', resize);
ui.onMute(() => {
  ui.setMuted(audio.toggleMuted());
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) audio.suspend();
  else audio.resume();
});

function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  player.update(dt, input, village.bounds, cameraController.yaw);
  updateInteraction();
  if (!evidenceFixture?.pursuer?.frozen) pursuer.update(dt, player);
  const elapsed = (now - startTime) / 1000;
  storyDirector.update(player, village.zones.south_gate_exit);
  cameraController.update(dt);
  refreshFeedback(dt, elapsed);
  atmosphere.update(elapsed);
  renderer.render(scene, camera);
  if (hasEvidenceParam) {
    shell.dataset.renderCalls = String(renderer.info.render.calls);
    shell.dataset.renderTriangles = String(renderer.info.render.triangles);
    shell.dataset.pursuerState = pursuer.state;
    shell.dataset.pursuerDistance = String(
      pursuer.object.position.distanceTo(player.position),
    );
  }
  requestAnimationFrame(frame);
}

applyEvidenceFixture();
resize();
cameraController.snap();
refreshFeedback(0, 0);
requestAnimationFrame(frame);

window.__RURAL_ESCAPE__ = {
  state,
  restart,
  setCameraMode,
  player,
  camera: cameraController,
  story: storyDirector.story,
  pursuer,
  get guidance() { return { ...guidanceSnapshot }; },
  get danger() { return { ...dangerSnapshot }; },
  audio,
  rendererPixelRatio: renderer.getPixelRatio(),
  interactForTest: storyDirector.interact,
  setStoryStateForTest(flags, objectiveName) {
    Object.assign(storyDirector.story.flags, flags);
    storyDirector.story.objective = objectiveName;
    storyDirector.render();
    this.refreshFeedbackForTest();
  },
  completeIntroForTest() {
    ui.completeIntro();
  },
  completeTutorialForTest(action) {
    tutorial.complete(action);
  },
  refreshFeedbackForTest(dt = 1 / 60) {
    cameraController.update(dt);
    refreshFeedback(dt, (performance.now() - startTime) / 1000);
  },
  moveForTest(x, z) {
    player.moveDirect(x, z, village.bounds);
    cameraController.update();
  },
  setPlayerForTest(x, z) {
    player.position.set(x, 0, z);
    cameraController.update();
    updateInteraction();
    this.refreshFeedbackForTest();
  },
  updatePursuerForTest(dt) { pursuer.update(dt, player); },
  updateStoryForTest() { storyDirector.update(player, village.zones.south_gate_exit); },
};
