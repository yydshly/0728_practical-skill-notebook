import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { computeThirdPersonPose } from '../src/camera-math.js';
import { VILLAGE_LAYOUT, validateVillageLayout } from '../src/level-data.js';
import { createMaterials } from '../src/world/materials.js';

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
