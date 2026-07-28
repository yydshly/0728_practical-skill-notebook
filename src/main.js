import * as THREE from 'three';
import './style.css';
import { createVillage } from './level.js';
import { createPlayer } from './player.js';
import { createCameraController } from './camera.js';
import { createResident } from './characters.js';
import { createStoryDirector } from './story.js';
import { createPursuer } from './pursuer.js';

const canvas = document.querySelector('#game');
const objective = document.querySelector('#objective');
const subtitle = document.querySelector('#subtitle');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9aa6a0);
scene.fog = new THREE.Fog(0x9aa6a0, 20, 72);

const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 120);
const village = createVillage(scene);
const player = createPlayer(scene, village.anchors.player_home);
const cameraController = createCameraController(camera, player, { occluders: village.cameraOccluders, groundY: 0 });
createResident(scene, village.anchors.courtyard.clone().add(new THREE.Vector3(1.3, 0, 1.8)), 'neighbour');
createResident(scene, village.anchors.granary.clone().add(new THREE.Vector3(-1.5, 0, 1.4)), 'barn_resident');
const storyDirector = createStoryDirector({ ui: { objective, subtitle } });
const pursuer = createPursuer(scene, { navNodes: village.navNodes, spawn: village.anchors.sighting.clone() });

const sun = new THREE.DirectionalLight(0xf4d3a0, 2.6);
sun.position.set(-18, 28, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
scene.add(new THREE.HemisphereLight(0x91a7aa, 0x29301f, 1.4), sun);

const input = { forward: false, back: false, left: false, right: false, sprint: false };
let lastTime = performance.now();

const state = {
  chapter: 'home',
  cameraMode: 'third-person',
};

function setCameraMode(mode) {
  cameraController.setMode(mode);
  state.cameraMode = cameraController.mode;
  subtitle.textContent = state.cameraMode === 'first-person'
    ? '你屏住呼吸，透过门缝观察逐渐安静下来的院落。'
    : '雾色压低了屋檐，远处传来一声急促的犬吠。';
}

function restart() {
  state.chapter = 'home';
  objective.textContent = '目标：离开主角家，调查村里的异常。';
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
  if (event.code === 'KeyE' && !event.repeat) {
    const interaction = storyDirector.story.objective === 'leave_home' ? 'radio'
      : storyDirector.story.objective === 'visit_courtyard' ? 'neighbour'
        : 'flashlight';
    storyDirector.interact(interaction);
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
  pursuer.update(dt, player);
  storyDirector.update(player, village.zones.south_gate_exit);
  cameraController.update(dt);
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
  moveForTest(x, z) {
    player.moveDirect(x, z, village.bounds);
    cameraController.update();
  },
  setPlayerForTest(x, z) {
    player.position.set(x, 0, z);
    cameraController.update();
  },
  updatePursuerForTest(dt) { pursuer.update(dt, player); },
  updateStoryForTest() { storyDirector.update(player, village.zones.south_gate_exit); },
};
