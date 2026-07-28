import * as THREE from 'three';
import './style.css';
import { createVillage } from './level.js';
import { createPlayer } from './player.js';
import { createCameraController } from './camera.js';
import { createResident } from './characters.js';
import { createStoryDirector } from './story.js';
import { createPursuer } from './pursuer.js';
import { createAtmosphere } from './atmosphere.js';
import { createGameUi } from './ui.js';
import { nearestInteraction } from './interactions.js';

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
const ui = createGameUi({ shell, title, objective, subtitle, interaction });
const storyDirector = createStoryDirector({ ui });
const pursuer = createPursuer(scene, { navNodes: village.navNodes, spawn: village.anchors.sighting.clone() });

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
  ui.showInteraction(nearbyInteraction?.label ?? null);
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

addEventListener('keydown', (event) => {
  setKey(event, true);
  if (event.code === 'KeyC' && !event.repeat) setCameraMode(cameraController.mode === 'third-person' ? 'first-person' : 'third-person');
  if (event.code === 'KeyE' && !event.repeat && nearbyInteraction) {
    storyDirector.interact(nearbyInteraction.kind);
    updateInteraction();
  }
});
addEventListener('keyup', (event) => setKey(event, false));
canvas.addEventListener('click', () => canvas.requestPointerLock?.());
addEventListener('mousemove', (event) => {
  if (document.pointerLockElement === canvas) cameraController.rotate(event.movementX, event.movementY);
});
addEventListener('resize', resize);

function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  player.update(dt, input, village.bounds, cameraController.yaw);
  updateInteraction();
  if (!evidenceFixture?.pursuer?.frozen) pursuer.update(dt, player);
  storyDirector.update(player, village.zones.south_gate_exit);
  cameraController.update(dt);
  atmosphere.update((now - startTime) / 1000);
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
requestAnimationFrame(frame);

window.__RURAL_ESCAPE__ = {
  state,
  restart,
  setCameraMode,
  player,
  camera: cameraController,
  story: storyDirector.story,
  pursuer,
  rendererPixelRatio: renderer.getPixelRatio(),
  interactForTest: storyDirector.interact,
  setStoryStateForTest(flags, objectiveName) {
    Object.assign(storyDirector.story.flags, flags);
    storyDirector.story.objective = objectiveName;
    storyDirector.render();
  },
  completeIntroForTest() {
    ui.completeIntro();
  },
  moveForTest(x, z) {
    player.moveDirect(x, z, village.bounds);
    cameraController.update();
  },
  setPlayerForTest(x, z) {
    player.position.set(x, 0, z);
    cameraController.update();
    updateInteraction();
  },
  updatePursuerForTest(dt) { pursuer.update(dt, player); },
  updateStoryForTest() { storyDirector.update(player, village.zones.south_gate_exit); },
};
