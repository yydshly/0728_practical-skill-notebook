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
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
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
  pursuer.update(dt, player);
  storyDirector.update(player, village.zones.south_gate_exit);
  cameraController.update(dt);
  atmosphere.update((now - startTime) / 1000);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

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
  interactForTest: storyDirector.interact,
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
