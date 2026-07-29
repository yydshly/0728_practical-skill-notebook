import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as cameraMath from '../src/camera-math.js';
import { VILLAGE_LAYOUT, validateVillageLayout } from '../src/level-data.js';
import { createMaterials } from '../src/world/materials.js';
import { getCharacterProfile, getGaitPose } from '../src/character-motion.js';
import { createHumanoid, createMutant, createResident } from '../src/characters.js';
import { createPlayer } from '../src/player.js';
import { createPursuer } from '../src/pursuer.js';
import { createVillage } from '../src/level.js';
import { createCameraController } from '../src/camera.js';
import { createAtmosphere } from '../src/atmosphere.js';
import { resolveCircleMove } from '../src/collision.js';
import { nearestInteraction } from '../src/interactions.js';
import * as buildings from '../src/world/buildings.js';
import { addPropCluster } from '../src/world/props.js';
import {
  OBJECTIVE_DEFINITIONS,
  getObjectiveDefinition,
  resolveObjectiveTarget,
  validateObjectiveDefinitions,
} from '../src/objectives.js';
import { createStoryDirector } from '../src/story.js';

const { computeThirdPersonPose } = cameraMath;
const { buildVillageGate } = buildings;

test('objective definitions map the four story stages to stable village anchors', () => {
  assert.deepEqual(
    ['leave_home', 'visit_courtyard', 'reach_granary', 'escape_south_gate']
      .map((id) => {
        const objective = getObjectiveDefinition(id);
        return [objective.step, objective.total, objective.anchorId, objective.interactionKind];
      }),
    [
      [1, 4, 'radio', 'radio'],
      [2, 4, 'neighbour', 'neighbour'],
      [3, 4, 'flashlight', 'flashlight'],
      [4, 4, 'south_gate', null],
    ],
  );
  assert.deepEqual(
    validateObjectiveDefinitions(OBJECTIVE_DEFINITIONS, new Set([
      'radio', 'neighbour', 'flashlight', 'south_gate',
    ])),
    [],
  );
});

test('objective target resolution fails closed when an anchor is missing', () => {
  const radio = new THREE.Vector3(-11.2, 0, 32.8);
  assert.equal(resolveObjectiveTarget('leave_home', { radio }), radio);
  assert.equal(resolveObjectiveTarget('visit_courtyard', { radio }), null);
  assert.equal(resolveObjectiveTarget('complete', { radio }), null);
});

test('story transitions emit each completion and start event exactly once', () => {
  const events = [];
  const ui = {
    setObjective() {},
    showSubtitle() {},
  };
  const director = createStoryDirector({ ui, onEvent: (event) => events.push(event) });

  director.interact('radio');
  director.interact('radio');

  assert.deepEqual(events, [
    { type: 'objective-completed', objectiveId: 'leave_home', nextObjectiveId: 'visit_courtyard' },
    { type: 'objective-started', objectiveId: 'visit_courtyard' },
  ]);
});

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

test('first-person pose keeps the eye at head height and looks forward with pitch', () => {
  assert.equal(typeof cameraMath.computeFirstPersonPose, 'function');

  const pose = cameraMath.computeFirstPersonPose({
    player: [2, 0, 7],
    yaw: Math.PI,
    pitch: -0.25,
    groundY: 0,
  });

  assert.deepEqual(pose.position, [2, 1.82, 7]);
  assert.ok(pose.target[2] < pose.position[2] - 5);
  assert.ok(pose.target[1] < pose.position[1]);
  assert.ok(Math.hypot(
    pose.target[0] - pose.position[0],
    pose.target[1] - pose.position[1],
    pose.target[2] - pose.position[2],
  ) > 5);
});

test('third-person camera snap and update stay on the player side of a nearby home wall', () => {
  const scene = new THREE.Scene();
  const village = createVillage(scene);
  const player = createPlayer(
    scene,
    new THREE.Vector3(-6.2, 0, 28),
    village.colliders,
  );
  const camera = new THREE.PerspectiveCamera();
  const controller = createCameraController(camera, player, {
    occluders: village.cameraOccluders,
    groundY: 0,
  });
  controller.rotate((Math.PI - Math.PI / 2) / 0.0024, 0);

  const homeWall = scene
    .getObjectByName('protagonist_home')
    .getObjectByName('structure_solid_wall');
  const wallBounds = new THREE.Box3().setFromObject(homeWall);

  controller.snap();
  assert.equal(wallBounds.containsPoint(camera.position), false);
  assert.ok(camera.position.x > wallBounds.max.x);
  assert.ok(
    camera.position.distanceTo(
      new THREE.Vector3(player.position.x, player.position.y + 1.45, player.position.z),
    ) >= 0.05,
  );
  assert.ok(camera.position.toArray().every(Number.isFinite));
  assert.ok(controller.getPoseSnapshot().direction.every(Number.isFinite));

  camera.position.set(-30, 1, 28);
  controller.update(10);
  assert.equal(wallBounds.containsPoint(camera.position), false);
  assert.ok(camera.position.x > wallBounds.max.x);
  assert.ok(controller.getPoseSnapshot().direction.every(Number.isFinite));
});

test('third-person camera never sweeps through village walls during abrupt corner turns', () => {
  const turnCases = [
    [-Math.PI, Math.PI / 2],
    [Math.PI / 2, Math.PI],
    [Math.PI / 2, Math.PI * 0.75],
  ];

  for (const [startYaw, endYaw] of turnCases) {
    const scene = new THREE.Scene();
    const village = createVillage(scene);
    const player = createPlayer(
      scene,
      new THREE.Vector3(-6.38, 0, 23.4),
      village.colliders,
    );
    const camera = new THREE.PerspectiveCamera();
    const controller = createCameraController(camera, player, {
      occluders: village.cameraOccluders,
      groundY: 0,
    });
    const walls = [];
    scene.traverse((object) => {
      if (object.name === 'structure_solid_wall') {
        walls.push({
          id: object.parent.name,
          bounds: new THREE.Box3().setFromObject(object),
        });
      }
    });

    controller.rotate((Math.PI - startYaw) / 0.0024, 0);
    controller.snap();
    assert.equal(
      walls.some(({ bounds }) => bounds.containsPoint(camera.position)),
      false,
      `start camera must be safe at yaw ${startYaw}`,
    );

    controller.rotate((startYaw - endYaw) / 0.0024, 0);
    for (let frame = 0; frame < 40; frame += 1) {
      controller.update(1 / 60);
      const containingWall = walls.find(({ bounds }) => bounds.containsPoint(camera.position));
      assert.equal(
        containingWall,
        undefined,
        `frame ${frame + 1} crossed ${containingWall?.id} for ${startYaw} -> ${endYaw}`,
      );
      assert.ok(camera.position.toArray().every(Number.isFinite));
      assert.ok(controller.getPoseSnapshot().direction.every(Number.isFinite));
    }
  }
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

test('village camera occluders are live visible meshes attached to the scene', () => {
  const scene = new THREE.Scene();
  const village = createVillage(scene);

  assert.ok(village.cameraOccluders.length >= VILLAGE_LAYOUT.buildings.length);
  for (const mesh of village.cameraOccluders) {
    assert.equal(mesh.isMesh, true);
    assert.equal(mesh.visible, true);
    assert.ok(mesh.parent);
    assert.equal(scene.getObjectById(mesh.id), mesh);
    assert.ok(mesh.geometry.boundingBox || mesh.geometry.computeBoundingBox() === undefined);
  }
});

test('every village local light is colocated with a visible emitter outside solid walls', () => {
  const scene = new THREE.Scene();
  createVillage(scene);
  scene.updateMatrixWorld(true);
  const wallBounds = [];
  scene.traverse((object) => {
    if (object.name === 'structure_solid_wall') {
      wallBounds.push(new THREE.Box3().setFromObject(object));
    }
  });

  for (const definition of VILLAGE_LAYOUT.lights) {
    const source = scene.getObjectByName(definition.sourceId);
    const light = scene.getObjectByName(`${definition.id}_light`);
    assert.ok(source?.isMesh, `${definition.id} must resolve a source mesh`);
    assert.equal(source.visible, true, `${definition.id} source must be visible`);
    assert.ok(light?.isPointLight, `${definition.id} must resolve a PointLight`);

    const sourcePosition = source.getWorldPosition(new THREE.Vector3());
    const lightPosition = light.getWorldPosition(new THREE.Vector3());
    const authoredPosition = new THREE.Vector3(
      definition.x,
      definition.y,
      definition.z,
    );
    assert.ok(
      sourcePosition.distanceTo(authoredPosition) <= 0.2,
      `${definition.id} source must use its authored transform`,
    );
    assert.ok(
      sourcePosition.distanceTo(lightPosition) <= 0.3,
      `${definition.id} source and light must remain colocated`,
    );
    assert.equal(
      wallBounds.some((bounds) => bounds.containsPoint(sourcePosition)),
      false,
      `${definition.id} source must not be buried in a solid wall`,
    );
  }
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

test('W follows camera forward and D follows camera right at every cardinal yaw', () => {
  const bounds = { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const forwardPlayer = createPlayer(new THREE.Scene(), new THREE.Vector3());
    forwardPlayer.update(0.1, { forward: true }, bounds, yaw);
    const forwardDot = forwardPlayer.position.x * Math.sin(yaw)
      + forwardPlayer.position.z * Math.cos(yaw);
    assert.ok(forwardDot > 0.3, `W must follow camera forward at yaw ${yaw}`);

    const rightPlayer = createPlayer(new THREE.Scene(), new THREE.Vector3());
    rightPlayer.update(0.1, { right: true }, bounds, yaw);
    const rightDot = rightPlayer.position.x * Math.cos(yaw)
      - rightPlayer.position.z * Math.sin(yaw);
    assert.ok(rightDot > 0.3, `D must follow camera right at yaw ${yaw}`);
  }
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

test('pursuer holds readable spacing instead of crossing through the player', () => {
  const scene = new THREE.Scene();
  const spawn = new THREE.Vector3();
  const pursuer = createPursuer(scene, { navNodes: [spawn.clone()], spawn });
  const player = { position: new THREE.Vector3(0, 0, 5) };
  let minimumDistance = Infinity;

  for (let frame = 0; frame < 240; frame += 1) {
    pursuer.update(1 / 60, player);
    minimumDistance = Math.min(
      minimumDistance,
      pursuer.object.position.distanceTo(player.position),
    );
  }

  assert.equal(pursuer.state, 'threaten');
  assert.ok(minimumDistance >= 2.2, `pursuer crossed contact spacing: ${minimumDistance}`);
  assert.ok(
    pursuer.object.position.distanceTo(player.position) >= 2.35,
    'pursuer must settle outside the player silhouette',
  );

  player.position.copy(pursuer.object.position);
  pursuer.update(1 / 60, player);
  assert.ok(
    pursuer.object.position.distanceTo(player.position) >= 2.2,
    'pursuer must separate even when both characters start overlapped',
  );
});

test('pursuer reset restores the authored mutant pose and spawn orientation', () => {
  const scene = new THREE.Scene();
  const spawn = new THREE.Vector3(-1, 0, 3);
  const pursuer = createPursuer(scene, { navNodes: [spawn.clone()], spawn });

  pursuer.update(0.25, { position: new THREE.Vector3(4, 0, 8) });
  assert.notEqual(pursuer.object.rotation.y, 0);
  pursuer.reset();

  assert.deepEqual(pursuer.object.position.toArray(), spawn.toArray());
  assert.equal(pursuer.object.rotation.y, 0);
  assert.equal(
    pursuer.object.getObjectByName('torso').rotation.x,
    getCharacterProfile('mutant').lean,
  );
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

test('canonical route anchors drive runtime and have player-radius collider clearance', () => {
  const village = createVillage(new THREE.Scene());
  const routeAnchorIds = ['player_home', 'radio', 'neighbour', 'flashlight'];

  for (const id of routeAnchorIds) {
    const sourcePosition = VILLAGE_LAYOUT.anchors[id];
    const position = village.anchors[id];
    assert.deepEqual(position.toArray(), sourcePosition, `${id} must use canonical coordinates`);
    assert.equal(sourcePosition[1], 0, `${id} must stay on the gameplay plane`);
    const blocked = village.colliders.some((box) => {
      const closestX = Math.max(
        box.x - box.halfX,
        Math.min(sourcePosition[0], box.x + box.halfX),
      );
      const closestZ = Math.max(
        box.z - box.halfZ,
        Math.min(sourcePosition[2], box.z + box.halfZ),
      );
      return (sourcePosition[0] - closestX) ** 2
        + (sourcePosition[2] - closestZ) ** 2 < 0.42 ** 2;
    });
    assert.equal(blocked, false, `${id} must remain reachable`);
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

test('blocking prop visuals and colliders derive from one canonical cluster', () => {
  const scene = new THREE.Scene();
  const village = createVillage(scene);
  const blockingClusters = VILLAGE_LAYOUT.propClusters.filter(
    ({ collider }) => Boolean(collider),
  );

  for (const cluster of blockingClusters) {
    assert.ok(cluster.collider, `${cluster.id} must own collider metadata`);
    assert.equal(
      cluster.collider.id,
      cluster.id,
      `${cluster.id} collider must share the canonical prop ID`,
    );
    const visual = scene.getObjectByName(cluster.id);
    const collider = village.colliders.find(({ id }) => id === cluster.id);
    assert.ok(visual, `${cluster.id} visual must exist`);
    assert.ok(collider, `${cluster.id} collider must exist`);
    assert.deepEqual(
      [visual.position.x, visual.position.z],
      [cluster.x, cluster.z],
      `${cluster.id} visual must use the canonical transform`,
    );
    assert.deepEqual(
      [collider.x, collider.z, collider.halfX, collider.halfZ],
      [
        cluster.x + (cluster.collider.offsetX ?? 0),
        cluster.z + (cluster.collider.offsetZ ?? 0),
        cluster.collider.halfX,
        cluster.collider.halfZ,
      ],
      `${cluster.id} collider must use canonical metadata`,
    );
  }
});

test('south gate factory builds an open village gate instead of a generic house', () => {
  const scene = new THREE.Scene();
  const materials = createMaterials();
  const definition = VILLAGE_LAYOUT.buildings.find(({ id }) => id === 'south_gate');
  const { root, occluders } = buildVillageGate(scene, definition, materials);

  for (const name of [
    'gate_left_pillar',
    'gate_right_pillar',
    'gate_beam',
    'gate_roof_left',
    'gate_roof_right',
    'gate_roof_ridge',
    'gate_left_door',
    'gate_right_door',
  ]) {
    assert.ok(root.getObjectByName(name), `south gate must include ${name}`);
  }
  assert.equal(root.getObjectByName('structure_solid_wall'), undefined);
  assert.equal(root.getObjectByName('structure_window_left'), undefined);
  assert.equal(root.getObjectByName('structure_window_right'), undefined);
  assert.ok(occluders.length >= 5);
  assert.ok(occluders.every((mesh) => root.getObjectById(mesh.id)));

  const villageScene = new THREE.Scene();
  createVillage(villageScene);
  const worldGate = villageScene.getObjectByName('south_gate');
  assert.ok(worldGate?.getObjectByName('gate_beam'));
  assert.equal(worldGate?.getObjectByName('structure_solid_wall'), undefined);
});

test('ancestral hall and grain barn use dedicated readable structure contracts', () => {
  assert.equal(typeof buildings.buildHall, 'function');
  assert.equal(typeof buildings.buildBarn, 'function');
  const materials = createMaterials();
  const hallDefinition = VILLAGE_LAYOUT.buildings.find(({ kind }) => kind === 'hall');
  const barnDefinition = VILLAGE_LAYOUT.buildings.find(({ kind }) => kind === 'barn');
  const hall = buildings.buildHall(new THREE.Scene(), hallDefinition, materials);
  const barn = buildings.buildBarn(new THREE.Scene(), barnDefinition, materials);

  for (const name of [
    'hall_upper_eave',
    'hall_lower_eave',
    'hall_door_left',
    'hall_door_right',
    'hall_lantern_mesh',
  ]) {
    assert.ok(hall.root.getObjectByName(name), `hall must include ${name}`);
  }
  assert.equal(hall.root.getObjectByName('structure_window_left'), undefined);
  assert.equal(hall.root.getObjectByName('structure_window_right'), undefined);

  for (const name of [
    'barn_raised_plinth',
    'barn_door_left',
    'barn_door_right',
    'barn_vent_board',
    'barn_timber_rack',
    'barn_flashlight_mesh',
  ]) {
    assert.ok(barn.root.getObjectByName(name), `barn must include ${name}`);
  }
  assert.equal(barn.root.getObjectByName('structure_window_left'), undefined);
  assert.equal(barn.root.getObjectByName('structure_window_right'), undefined);
  assert.ok(hall.occluders.length >= 3);
  assert.ok(barn.occluders.length >= 3);

  const liveScene = new THREE.Scene();
  createVillage(liveScene);
  assert.ok(liveScene.getObjectByName('ancestral_hall')?.getObjectByName('hall_upper_eave'));
  assert.ok(liveScene.getObjectByName('grain_barn')?.getObjectByName('barn_vent_board'));
  assert.ok(VILLAGE_LAYOUT.lights.some(({ kind }) => kind === 'hall_lantern'));
  assert.ok(VILLAGE_LAYOUT.lights.some(({ kind }) => kind === 'barn_flashlight'));
});

test('birth courtyard fence has a player-clear opening with named gate parts', () => {
  const scene = new THREE.Scene();
  const village = createVillage(scene);
  const gate = scene.getObjectByName('home_life');
  const leftFence = gate.getObjectByName('home_fence_left');
  const rightFence = gate.getObjectByName('home_fence_right');

  for (const name of [
    'home_gate_left_post',
    'home_gate_right_post',
    'home_gate_door',
  ]) {
    assert.ok(gate.getObjectByName(name), `birth gate must include ${name}`);
  }
  assert.ok(leftFence && rightFence);
  const opening = rightFence.position.x - rightFence.geometry.parameters.width / 2
    - (leftFence.position.x + leftFence.geometry.parameters.width / 2);
  assert.ok(opening >= 1.6, `birth gate opening must be at least 1.6u, got ${opening}`);
  assert.equal(village.colliders.some(({ id }) => id === 'home_life'), false);

  const player = createPlayer(
    new THREE.Scene(),
    new THREE.Vector3(-7.4, 0, 33),
    village.colliders,
  );
  player.moveDirect(1.6, 0, village.bounds);
  assert.ok(player.position.x > -6, 'player radius must pass through the birth gate');
});

test('atmosphere dispose restores the renderer shadow configuration', () => {
  const scene = new THREE.Scene();
  const renderer = {
    shadowMap: {
      enabled: false,
      type: THREE.BasicShadowMap,
    },
  };
  const atmosphere = createAtmosphere(scene, renderer);
  assert.equal(renderer.shadowMap.enabled, true);
  assert.equal(renderer.shadowMap.type, THREE.PCFSoftShadowMap);

  atmosphere.dispose();
  assert.equal(renderer.shadowMap.enabled, false);
  assert.equal(renderer.shadowMap.type, THREE.BasicShadowMap);
});

test('gate blockade reads as an abandoned three-wheeler without changing its canonical root', () => {
  const scene = new THREE.Scene();
  const materials = createMaterials();
  const cluster = VILLAGE_LAYOUT.propClusters.find(({ id }) => id === 'gate_blockade');
  const children = addPropCluster(scene, cluster, materials);
  const root = scene.getObjectByName('gate_blockade');

  assert.equal(root.position.x, cluster.x);
  assert.equal(root.position.z, cluster.z);
  assert.equal(children.filter(({ name }) => name.includes('tricycle_')).length >= 7, true);
  for (const name of [
    'tricycle_front_wheel',
    'tricycle_left_rear_wheel',
    'tricycle_right_rear_wheel',
    'tricycle_cargo_bed',
    'tricycle_frame',
    'tricycle_handlebar',
  ]) {
    assert.ok(root.getObjectByName(name), `gate blockade must include ${name}`);
  }
});
