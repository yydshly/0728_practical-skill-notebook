import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { computeThirdPersonPose } from '../src/camera-math.js';
import { VILLAGE_LAYOUT, validateVillageLayout } from '../src/level-data.js';
import { createMaterials } from '../src/world/materials.js';
import { getCharacterProfile, getGaitPose } from '../src/character-motion.js';
import { createHumanoid, createMutant, createResident } from '../src/characters.js';
import { createPlayer } from '../src/player.js';
import { createPursuer } from '../src/pursuer.js';

test('third-person pose starts above ground and behind its target', () => {
  const pose = computeThirdPersonPose({
    player: [-8, 0, 25],
    yaw: Math.PI,
    pitch: -0.18,
    distance: 5.6,
    groundY: 0,
  });
  assert.ok(pose.position[1] >= 2.4);
  assert.ok(Math.hypot(
    pose.position[0] - pose.target[0],
    pose.position[2] - pose.target[2],
  ) >= 5);
  assert.deepEqual(pose.target, [-8, 1.45, 25]);
});

test('village layout defines readable zones and collision separately', () => {
  assert.deepEqual(
    Object.keys(VILLAGE_LAYOUT.zones),
    ['home', 'courtyard', 'main_road', 'granary', 'south_gate_exit'],
  );
  assert.equal(VILLAGE_LAYOUT.roadPolygon.length, 12);
  assert.ok(VILLAGE_LAYOUT.buildings.length >= 7);
  assert.ok(VILLAGE_LAYOUT.colliders.length >= 10);
  assert.deepEqual(validateVillageLayout(VILLAGE_LAYOUT), []);
});

test('every local light has a visible source id', () => {
  assert.ok(VILLAGE_LAYOUT.lights.every((light) => Boolean(light.sourceId)));
});

test('road material remains visible from above with authored orientation', () => {
  const materials = createMaterials();
  assert.equal(materials.road.side, THREE.DoubleSide);
});

test('mutant silhouette is asymmetric and more forward-leaning', () => {
  const human = getCharacterProfile('player');
  const mutant = getCharacterProfile('mutant');
  assert.ok(mutant.lean > human.lean);
  assert.notEqual(mutant.leftArmLength, mutant.rightArmLength);
});

test('walking gait moves opposite arms and legs', () => {
  const pose = getGaitPose(0.25, 3.6, 'player');
  assert.equal(Math.sign(pose.leftArm), -Math.sign(pose.rightArm));
  assert.equal(Math.sign(pose.leftLeg), -Math.sign(pose.rightLeg));
  assert.ok(Math.abs(pose.bob) <= 0.05);
});

test('humanoid factories expose a stable named joint hierarchy', () => {
  const scene = new THREE.Scene();
  const position = new THREE.Vector3(1, 0, 2);
  const rigs = [
    createHumanoid(scene, position, { kind: 'player', name: 'hero' }),
    createResident(scene, position, 'neighbour'),
    createMutant(scene, position),
  ];

  for (const rig of rigs) {
    assert.equal(rig.root.parent, scene);
    assert.equal(typeof rig.setMotion, 'function');
    assert.equal(typeof rig.setPose, 'function');
    for (const jointName of [
      'hips', 'torso', 'head', 'leftShoulder', 'rightShoulder', 'leftHip', 'rightHip',
    ]) {
      assert.ok(rig.root.getObjectByName(jointName), `missing ${jointName}`);
    }
  }
});

test('player movement drives the rig gait and settles while idle', () => {
  const scene = new THREE.Scene();
  const player = createPlayer(scene, new THREE.Vector3());
  const bounds = { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };

  player.update(0.25, { forward: true }, bounds, 0);
  assert.ok(Math.abs(player.object.getObjectByName('leftShoulder').rotation.x) > 0.1);

  player.update(0.25, {}, bounds, 0);
  assert.equal(Math.abs(player.object.getObjectByName('leftShoulder').rotation.x), 0);
});

test('pursuer movement drives the mutant rig and settles while idle', () => {
  const scene = new THREE.Scene();
  const spawn = new THREE.Vector3();
  const pursuer = createPursuer(scene, { navNodes: [spawn.clone()], spawn });

  assert.equal(pursuer.object.parent, scene);
  assert.equal(pursuer.update(0.25, { position: new THREE.Vector3(0, 0, 5) }), 'chase');
  assert.ok(Math.abs(pursuer.object.getObjectByName('leftShoulder').rotation.x) > 0.1);

  pursuer.reset();
  pursuer.update(0.25, { position: new THREE.Vector3(0, 0, 30) });
  assert.equal(Math.abs(pursuer.object.getObjectByName('leftShoulder').rotation.x), 0);
});
