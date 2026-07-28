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
import { createVillage } from '../src/level.js';
import { resolveCircleMove } from '../src/collision.js';
import { nearestInteraction } from '../src/interactions.js';

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

test('stand pose clears every transform controlled by hide', () => {
  const rig = createHumanoid(new THREE.Scene(), new THREE.Vector3(), { kind: 'player' });
  rig.setMotion(3.6, 0.25);
  rig.setPose('hide');
  rig.setPose('stand');

  assert.equal(rig.root.rotation.y, 0);
  assert.equal(rig.root.getObjectByName('torso').rotation.x, 0);
  assert.equal(rig.root.getObjectByName('torso').rotation.z, 0);
  assert.equal(rig.root.getObjectByName('head').rotation.y, 0);
  assert.equal(rig.root.getObjectByName('leftElbow').rotation.x, 0);
  assert.equal(rig.root.getObjectByName('rightElbow').rotation.x, 0);
  assert.equal(rig.root.getObjectByName('leftShoulder').rotation.z, 0.14);
  assert.equal(rig.root.getObjectByName('rightShoulder').rotation.z, -0.14);
});

test('mutant pose clears hide transforms before applying asymmetry', () => {
  const rig = createHumanoid(new THREE.Scene(), new THREE.Vector3(), {
    kind: 'mutant',
    pose: 'hide',
  });
  rig.setPose('mutant');

  assert.equal(rig.root.rotation.y, 0);
  assert.equal(rig.root.getObjectByName('torso').rotation.x, 0.34);
  assert.equal(rig.root.getObjectByName('torso').rotation.z, 0);
  assert.equal(rig.root.getObjectByName('head').rotation.y, 0);
  assert.equal(rig.root.getObjectByName('leftElbow').rotation.x, 0);
  assert.equal(rig.root.getObjectByName('rightElbow').rotation.x, 0);
  assert.equal(rig.root.getObjectByName('leftShoulder').rotation.z, 0.28);
  assert.equal(rig.root.getObjectByName('rightShoulder').rotation.z, -0.08);
});

test('circle movement stops outside a house collider', () => {
  const next = resolveCircleMove(
    { x: 0, z: 0 },
    { x: 1.3, z: 0 },
    0.4,
    { minX: -10, maxX: 10, minZ: -10, maxZ: 10 },
    [{ x: 2, z: 0, halfX: 0.5, halfZ: 2 }],
  );
  assert.equal(next.x, 0);
  assert.equal(next.z, 0);
});

test('interaction selects only a nearby candidate', () => {
  const candidates = [
    { id: 'radio', position: { x: 1, z: 1 } },
    { id: 'flashlight', position: { x: 8, z: 8 } },
  ];
  assert.equal(nearestInteraction({ x: 0, z: 0 }, candidates, 2)?.id, 'radio');
  assert.equal(nearestInteraction({ x: -6, z: -6 }, candidates, 2), null);
});

test('player movement uses village colliders', () => {
  const player = createPlayer(
    new THREE.Scene(),
    new THREE.Vector3(),
    [{ x: 2, z: 0, halfX: 0.5, halfZ: 2 }],
  );
  player.moveDirect(
    1.3,
    0,
    { minX: -10, maxX: 10, minZ: -10, maxZ: 10 },
  );
  assert.equal(player.position.x, 0);
  assert.equal(player.position.z, 0);
});

test('village interaction anchors expose stable flat metadata', () => {
  const village = createVillage(new THREE.Scene());
  assert.equal(Array.isArray(village.interactionAnchors), true);
  assert.deepEqual(
    village.interactionAnchors.map(({ id }) => id),
    ['radio', 'neighbour', 'flashlight'],
  );
  for (const anchor of village.interactionAnchors) {
    assert.equal(anchor.kind, anchor.id);
    assert.equal(typeof anchor.label, 'string');
    assert.ok(anchor.label.length > 0);
    assert.ok(anchor.position instanceof THREE.Vector3);
    assert.equal(anchor.position.y, 0);
  }
});

test('critical village route anchors have player-radius collider clearance', () => {
  const village = createVillage(new THREE.Scene());
  const routeAnchors = [
    { id: 'player_home', position: village.anchors.player_home },
    ...village.interactionAnchors,
  ];

  for (const anchor of routeAnchors) {
    const blocked = village.colliders.some((box) => {
      const closestX = Math.max(
        box.x - box.halfX,
        Math.min(anchor.position.x, box.x + box.halfX),
      );
      const closestZ = Math.max(
        box.z - box.halfZ,
        Math.min(anchor.position.z, box.z + box.halfZ),
      );
      return (anchor.position.x - closestX) ** 2
        + (anchor.position.z - closestZ) ** 2 < 0.42 ** 2;
    });
    assert.equal(blocked, false, `${anchor.id} must remain reachable`);
  }
});

test('critical building walls retain solid village collision', () => {
  const village = createVillage(new THREE.Scene());
  for (const id of ['home_body', 'courtyard_body', 'barn_body']) {
    assert.ok(village.colliders.some((collider) => collider.id === id), `missing ${id}`);
  }

  const home = village.colliders.find((collider) => collider.id === 'home_body');
  const startX = home.x + home.halfX + 0.5;
  const player = createPlayer(
    new THREE.Scene(),
    new THREE.Vector3(startX, 0, home.z),
    village.colliders,
  );
  player.moveDirect(-0.2, 0, village.bounds);
  assert.equal(player.position.x, startX);
});
