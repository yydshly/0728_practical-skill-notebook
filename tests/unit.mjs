import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as cameraMath from '../src/camera-math.js';
import {
  collectActorColliders,
  VILLAGE_LAYOUT,
  validateVillageLayout,
} from '../src/level-data.js';
import { createMaterials } from '../src/world/materials.js';
import { getCharacterProfile, getGaitPose } from '../src/character-motion.js';
import { createHumanoid, createMutant, createResident } from '../src/characters.js';
import { createPlayer } from '../src/player.js';
import { createPursuer } from '../src/pursuer.js';
import { createVillage } from '../src/level.js';
import { createCameraController } from '../src/camera.js';
import { createCameraPointerInput } from '../src/camera-pointer-input.js';
import { createAtmosphere } from '../src/atmosphere.js';
import {
  circleColliderPenetration,
  resolveCircleMove,
} from '../src/collision.js';
import { nearestInteraction } from '../src/interactions.js';
import * as buildings from '../src/world/buildings.js';
import { addPropCluster, addUtilityPole } from '../src/world/props.js';
import {
  OBJECTIVE_DEFINITIONS,
  getObjectiveDefinition,
  resolveObjectiveTarget,
  validateObjectiveDefinitions,
} from '../src/objectives.js';
import { createStoryDirector } from '../src/story.js';
import {
  computeGuidanceSnapshot,
  formatObjectiveDistance,
  projectScreenMarker,
} from '../src/guidance.js';
import { createWorldObjectiveMarker } from '../src/world-marker.js';
import { createTutorialTracker } from '../src/tutorial.js';
import { createDangerController } from '../src/danger.js';
import { createAudioFeedback } from '../src/audio-feedback.js';
import { createGameUi } from '../src/ui.js';

const { computeThirdPersonPose } = cameraMath;
const { buildVillageGate } = buildings;

function createPointerEvent(type, properties) {
  const event = new Event(type);
  Object.defineProperties(event, Object.fromEntries(
    Object.entries(properties).map(([key, value]) => [
      key,
      { configurable: true, enumerable: true, value },
    ]),
  ));
  return event;
}

function createTrackedElement({ childSpan = null } = {}) {
  const writes = {
    attributes: 0,
    dataset: 0,
    hidden: 0,
    style: 0,
    textContent: 0,
  };
  const datasetValues = {};
  const styleValues = {};
  let hidden = false;
  let textContent = '';
  return {
    writes,
    dataset: new Proxy(datasetValues, {
      set(target, key, value) {
        writes.dataset += 1;
        target[key] = value;
        return true;
      },
    }),
    style: {
      getPropertyValue(name) {
        return styleValues[name] ?? '';
      },
      setProperty(name, value) {
        writes.style += 1;
        styleValues[name] = value;
      },
    },
    get hidden() { return hidden; },
    set hidden(value) {
      writes.hidden += 1;
      hidden = value;
    },
    get textContent() { return textContent; },
    set textContent(value) {
      writes.textContent += 1;
      textContent = value;
    },
    setAttribute() {
      writes.attributes += 1;
    },
    addEventListener() {},
    querySelector(selector) {
      return selector === 'span' ? childSpan : null;
    },
  };
}

function resetTrackedWrites(...elements) {
  for (const element of elements) {
    for (const key of Object.keys(element.writes)) element.writes[key] = 0;
  }
}

function totalTrackedWrites(...elements) {
  return elements.reduce(
    (total, element) => total
      + Object.values(element.writes).reduce((sum, count) => sum + count, 0),
    0,
  );
}

test('unlocked left-button drag rotates while ordinary hover stays inert', () => {
  const surface = new EventTarget();
  const eventTarget = new EventTarget();
  const documentRef = { pointerLockElement: null };
  const rotations = [];
  let pointerLockRequests = 0;
  surface.requestPointerLock = () => { pointerLockRequests += 1; };
  surface.setPointerCapture = () => {};
  surface.releasePointerCapture = () => {};

  const input = createCameraPointerInput({
    surface,
    eventTarget,
    documentRef,
    onRotate: (deltaX, deltaY) => rotations.push([deltaX, deltaY]),
  });

  eventTarget.dispatchEvent(createPointerEvent('pointermove', {
    clientX: 30,
    clientY: 40,
    movementX: 30,
    movementY: 40,
  }));
  surface.dispatchEvent(createPointerEvent('pointerdown', {
    button: 0,
    clientX: 10,
    clientY: 20,
    pointerId: 7,
  }));
  eventTarget.dispatchEvent(createPointerEvent('pointermove', {
    clientX: 16,
    clientY: 27,
    movementX: 0,
    movementY: 0,
  }));
  eventTarget.dispatchEvent(createPointerEvent('pointerup', {
    button: 0,
    pointerId: 7,
  }));
  eventTarget.dispatchEvent(createPointerEvent('pointermove', {
    clientX: 20,
    clientY: 30,
    movementX: 0,
    movementY: 0,
  }));

  assert.equal(pointerLockRequests, 1);
  assert.deepEqual(rotations, [[6, 7]]);
  input.dispose();
});

test('pointer-locked movement preserves browser relative deltas without a drag', () => {
  const surface = new EventTarget();
  const eventTarget = new EventTarget();
  const documentRef = { pointerLockElement: surface };
  const rotations = [];
  const input = createCameraPointerInput({
    surface,
    eventTarget,
    documentRef,
    onRotate: (deltaX, deltaY) => rotations.push([deltaX, deltaY]),
  });

  eventTarget.dispatchEvent(createPointerEvent('pointermove', {
    clientX: 0,
    clientY: 0,
    movementX: 9,
    movementY: -3,
  }));

  assert.deepEqual(rotations, [[9, -3]]);
  input.dispose();
});

test('pointer cancellation ends an unlocked fallback drag', () => {
  const surface = new EventTarget();
  const eventTarget = new EventTarget();
  const rotations = [];
  surface.requestPointerLock = () => {};
  surface.setPointerCapture = () => {};
  surface.releasePointerCapture = () => {};
  const input = createCameraPointerInput({
    surface,
    eventTarget,
    documentRef: { pointerLockElement: null },
    onRotate: (deltaX, deltaY) => rotations.push([deltaX, deltaY]),
  });

  surface.dispatchEvent(createPointerEvent('pointerdown', {
    button: 0,
    clientX: 10,
    clientY: 20,
    pointerId: 7,
  }));
  eventTarget.dispatchEvent(createPointerEvent('pointercancel', { pointerId: 7 }));
  eventTarget.dispatchEvent(createPointerEvent('pointermove', {
    clientX: 18,
    clientY: 29,
    movementX: 0,
    movementY: 0,
    pointerId: 7,
  }));

  assert.deepEqual(rotations, []);
  input.dispose();
});

test('danger controller distinguishes chase, close threat, recovery, and safety', () => {
  const danger = createDangerController({ recoverySeconds: 1.2 });
  assert.equal(danger.update(0.016, 'patrol', 20).mode, 'safe');
  const chase = danger.update(0.016, 'chase', 8);
  assert.deepEqual([chase.mode, chase.label], ['chase', '已被发现']);
  const threat = danger.update(0.016, 'threaten', 2.4);
  assert.deepEqual([threat.mode, threat.label], ['threaten', '近身威胁']);
  assert.ok(threat.heartbeatBpm > chase.heartbeatBpm);
  const recovery = danger.update(0.4, 'patrol', 18);
  assert.deepEqual([recovery.mode, recovery.label], ['recover', '正在脱离危险']);
  assert.equal(danger.update(0.81, 'patrol', 18).mode, 'safe');
});

test('audio feedback remains safe without an AudioContext implementation', async () => {
  const audio = createAudioFeedback({ AudioContextCtor: null });
  assert.equal(await audio.unlock(), false);
  assert.equal(audio.unlocked, false);
  assert.doesNotThrow(() => audio.handleStoryEvent({
    type: 'objective-completed',
    objectiveId: 'leave_home',
  }));
  assert.doesNotThrow(() => audio.updateDanger({
    mode: 'threaten',
    heartbeatBpm: 110,
    intensity: 1,
  }));
  audio.setMuted(true);
  assert.equal(audio.muted, true);
  audio.dispose();
});

test('audio feedback swallows node allocation errors after unlocking', async () => {
  const audio = createAudioFeedback({
    AudioContextCtor: class ThrowingAudioContext {
      constructor() {
        this.state = 'running';
        this.currentTime = 0;
        this.destination = {};
      }

      createGain() {
        return {
          gain: {
            value: 0,
            setValueAtTime() {},
            exponentialRampToValueAtTime() {},
            setTargetAtTime() {},
          },
          connect() {},
          disconnect() {},
        };
      }

      createOscillator() {
        throw new Error('audio node allocation failed');
      }
    },
  });
  assert.equal(await audio.unlock(), true);
  assert.doesNotThrow(() => audio.handleStoryEvent({ type: 'objective-completed' }));
  assert.doesNotThrow(() => audio.updateDanger({
    mode: 'threaten',
    heartbeatBpm: 110,
    intensity: 1,
  }, 0));
  audio.dispose();
});

test('audio feedback cleans up an oscillator when later node allocation fails', async () => {
  const oscillators = [];
  let gainAllocations = 0;
  const audio = createAudioFeedback({
    AudioContextCtor: class PartiallyThrowingAudioContext {
      constructor() {
        this.state = 'running';
        this.currentTime = 0;
        this.destination = {};
      }

      createGain() {
        gainAllocations += 1;
        if (gainAllocations > 1) throw new Error('voice gain allocation failed');
        return {
          gain: {
            value: 0,
            setTargetAtTime() {},
          },
          connect() {},
          disconnect() {},
        };
      }

      createOscillator() {
        const calls = { disconnect: 0, stop: 0 };
        oscillators.push(calls);
        return {
          frequency: { value: 0 },
          connect() {},
          disconnect() { calls.disconnect += 1; },
          stop() { calls.stop += 1; },
        };
      }
    },
  });

  assert.equal(await audio.unlock(), true);
  assert.doesNotThrow(() => audio.handleStoryEvent({ type: 'objective-completed' }));
  assert.equal(oscillators.length, 2);
  assert.deepEqual(
    oscillators.map(({ disconnect, stop }) => [disconnect, stop]),
    [[1, 1], [1, 1]],
  );
  audio.dispose();
});

test('identical mission guidance and danger frames do not rewrite rendered UI', () => {
  const elements = Object.fromEntries([
    'shell',
    'title',
    'missionHud',
    'missionStep',
    'missionTitle',
    'missionClue',
    'objective',
    'subtitle',
    'approachPrompt',
    'interactionSpan',
    'tutorialHint',
    'compass',
    'compassLabel',
    'compassDistance',
    'marker',
    'dangerState',
    'completionToast',
    'muteToggle',
  ].map((name) => [name, createTrackedElement()]));
  elements.interaction = createTrackedElement({ childSpan: elements.interactionSpan });
  const ui = createGameUi(elements);
  ui.completeIntro();

  const definition = {
    step: 4,
    total: 4,
    title: 'Escape',
    clue: 'South gate',
    objective: 'Reach the gate',
    actionLabel: null,
  };
  const guidance = {
    targetPosition: { x: 0, y: 0, z: -32 },
    distanceLabel: '7m',
    relativeAngle: 0.25,
    proximity: 'far',
  };
  const screenMarker = { x: 620, y: 180, edge: false };
  const danger = {
    mode: 'threaten',
    label: 'Close threat',
    intensity: 0.9,
  };

  ui.renderMission(definition);
  ui.renderGuidance(definition, guidance, screenMarker);
  ui.renderDanger(danger);
  const tracked = Object.values(elements);
  resetTrackedWrites(...tracked);

  ui.renderMission(definition);
  ui.renderGuidance(definition, guidance, screenMarker);
  ui.renderDanger(danger);

  assert.equal(totalTrackedWrites(...tracked), 0);

  ui.renderGuidance(definition, { ...guidance, distanceLabel: '6m' }, screenMarker);
  assert.equal(elements.compassDistance.textContent, '6m');
  assert.equal(elements.compassDistance.writes.textContent, 1);
  assert.equal(elements.dangerState.writes.textContent, 0);
});

test('tutorial tracker reveals each control once in authored order', () => {
  const changes = [];
  const tutorial = createTutorialTracker({ onChange: (value) => changes.push(value) });
  assert.equal(tutorial.current.id, 'move');
  assert.equal(tutorial.complete('move'), true);
  assert.equal(tutorial.current.id, 'sprint');
  assert.equal(tutorial.complete('move'), false);
  tutorial.complete('sprint');
  tutorial.complete('look');
  tutorial.complete('camera');
  tutorial.complete('interact');
  assert.equal(tutorial.current, null);
  assert.equal(changes.at(-1), null);
});

test('guidance reports distance, relative direction, and staged proximity', () => {
  const far = computeGuidanceSnapshot({
    playerPosition: new THREE.Vector3(0, 0, 0),
    targetPosition: new THREE.Vector3(10, 0, 0),
    cameraYaw: 0,
  });
  assert.equal(far.distance, 10);
  assert.ok(Math.abs(far.relativeAngle - Math.PI / 2) < 0.0001);
  assert.equal(far.showWorldMarker, true);
  assert.equal(far.proximity, 'far');

  const approach = computeGuidanceSnapshot({
    playerPosition: new THREE.Vector3(7, 0, 0),
    targetPosition: new THREE.Vector3(10, 0, 0),
    cameraYaw: 0,
  });
  assert.equal(approach.proximity, 'approach');
  assert.equal(formatObjectiveDistance(approach.distance), '就在附近');

  const interact = computeGuidanceSnapshot({
    playerPosition: new THREE.Vector3(8, 0, 0),
    targetPosition: new THREE.Vector3(10, 0, 0),
    cameraYaw: 0,
  });
  assert.equal(interact.proximity, 'interact');
});

test('screen marker clamps an off-camera target to a safe viewport edge', () => {
  const camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.1, 120);
  camera.position.set(0, 2, 0);
  camera.lookAt(0, 1, -1);
  camera.updateMatrixWorld(true);
  const marker = projectScreenMarker(
    new THREE.Vector3(20, 0, -1),
    camera,
    { width: 1280, height: 720 },
    48,
  );
  assert.ok(marker);
  assert.equal(marker.edge, true);
  assert.ok(marker.x >= 48 && marker.x <= 1232);
  assert.ok(marker.y >= 48 && marker.y <= 672);
});

test('screen marker fails closed when camera or viewport is absent', () => {
  const target = new THREE.Vector3(20, 0, -1);
  const camera = new THREE.PerspectiveCamera();
  assert.equal(projectScreenMarker(target, null, { width: 1280, height: 720 }), null);
  assert.equal(projectScreenMarker(target, camera, null), null);
});

test('world objective marker stays decorative and follows guidance visibility', () => {
  const scene = new THREE.Scene();
  const marker = createWorldObjectiveMarker(scene);
  marker.update({
    targetPosition: new THREE.Vector3(3, 0, 4),
    showWorldMarker: true,
    proximity: 'approach',
  }, 0.5);
  assert.equal(marker.object.parent, scene);
  assert.equal(marker.object.visible, true);
  assert.deepEqual(marker.object.position.toArray(), [3, 0.03, 4]);
  assert.equal(marker.object.userData.decorativeOnly, true);
  marker.update({ targetPosition: null, showWorldMarker: false, proximity: 'none' }, 1);
  assert.equal(marker.object.visible, false);
  marker.dispose();
  assert.equal(marker.object.parent, null);
});

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
    village.actorColliders,
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
      village.actorColliders,
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

test('road lantern visuals and actor colliders derive from one light definition', () => {
  const scene = new THREE.Scene();
  const village = createVillage(scene);
  const roadLights = VILLAGE_LAYOUT.lights.filter(
    ({ kind }) => kind === 'road_lantern',
  );

  assert.equal(roadLights.length, 2);
  for (const definition of roadLights) {
    const source = scene.getObjectByName(definition.sourceId);
    const root = scene.getObjectByName(definition.id);
    const collider = village.actorColliders.find(
      ({ id }) => id === definition.collider.id,
    );

    assert.ok(source, `missing visible source ${definition.sourceId}`);
    assert.ok(root, `missing visible root ${definition.id}`);
    const sourceWorldPosition = source.getWorldPosition(new THREE.Vector3());
    assert.ok(collider, `missing ${definition.collider.id}`);
    assert.deepEqual(
      [sourceWorldPosition.x, sourceWorldPosition.z],
      [definition.x, definition.z],
    );
    assert.equal(collider.shape, 'circle');
    assert.equal(collider.x, definition.x);
    assert.equal(collider.z, definition.z);
    assert.equal(collider.radius, 0.16);
    assert.equal(collider.blocksActors, true);
    assert.equal(collider.blocksCamera, false);
    assert.equal(
      village.cameraOccluders.some((occluder) => (
        occluder === root || Boolean(root.getObjectById(occluder.id))
      )),
      false,
    );
  }
  assert.deepEqual(village.actorColliders, collectActorColliders(VILLAGE_LAYOUT));
});

test('utility pole factory accepts the shared authored definition without instantiating a level pole', () => {
  const scene = new THREE.Scene();
  const definition = {
    id: 'future_utility_pole',
    kind: 'utility_pole',
    x: 2,
    z: -3,
    collider: {
      id: 'future_utility_pole_body',
      shape: 'circle',
      radius: 0.16,
      blocksActors: true,
      blocksCamera: false,
    },
  };
  const root = addUtilityPole(scene, definition, createMaterials());

  assert.equal(root.name, definition.id);
  assert.deepEqual([root.position.x, root.position.z], [definition.x, definition.z]);
  assert.equal(root.userData.actorColliderId, definition.collider.id);
  assert.equal(
    root.children.some(({ userData }) => Boolean(userData.actorColliderId)),
    false,
    'crossbar and insulators must not create actor colliders',
  );
  assert.equal(
    VILLAGE_LAYOUT.lights.some(({ id }) => id === definition.id),
    false,
  );
});

test('village validation rejects duplicate, malformed, and unknown colliders', () => {
  const malformed = structuredClone(VILLAGE_LAYOUT);
  const firstLamp = malformed.lights.find(({ id }) => id === 'road_lantern_a');
  const secondLamp = malformed.lights.find(({ id }) => id === 'road_lantern_b');
  firstLamp.collider.radius = 0;
  firstLamp.collider.blocksActors = false;
  firstLamp.collider.blocksCamera = true;
  secondLamp.collider.id = firstLamp.collider.id;
  malformed.colliders[0].shape = 'capsule';
  malformed.colliders[1].blocksActors = 'yes';

  const errors = validateVillageLayout(malformed);
  assert.ok(errors.includes('collider:home_body:unknown-shape:capsule'));
  assert.ok(errors.includes('collider:courtyard_body:invalid-blocksActors'));
  assert.ok(errors.includes('collider:road_lantern_a_body:invalid-radius'));
  assert.ok(errors.includes('collider:road_lantern_a_body:duplicate-id'));
  assert.ok(errors.includes('light:road_lantern_a:collider-must-block-actors'));
  assert.ok(errors.includes('light:road_lantern_a:collider-must-not-block-camera'));
});

test('village validation reports missing lamp collision and blocked patrol nodes', () => {
  const malformed = structuredClone(VILLAGE_LAYOUT);
  const lamp = malformed.lights.find(({ id }) => id === 'road_lantern_a');
  delete lamp.collider;
  malformed.navNodes[0] = [-12, 0, 28];

  const errors = validateVillageLayout(malformed);
  assert.ok(errors.includes('light:road_lantern_a:missing-actor-collider'));
  assert.ok(errors.includes('nav-node:0:overlaps:home_body'));
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
    [{
      shape: 'box',
      x: 2,
      z: 0,
      halfX: 0.5,
      halfZ: 2,
      blocksActors: true,
      blocksCamera: true,
    }],
  );
  assert.equal(next.x, 0);
  assert.equal(next.z, 0);
});

test('circle actor stops at a circle post and slides on the free axis', () => {
  const bounds = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
  const post = {
    id: 'test_post',
    shape: 'circle',
    x: 0,
    z: 0,
    radius: 0.16,
    blocksActors: true,
    blocksCamera: false,
  };

  const blocked = resolveCircleMove(
    { x: 0, z: 1 },
    { x: 0, z: -0.5 },
    0.42,
    bounds,
    [post],
  );
  assert.deepEqual(blocked, { x: 0, z: 1 });

  const sliding = resolveCircleMove(
    { x: 0, z: 1 },
    { x: 0.2, z: -0.5 },
    0.42,
    bounds,
    [post],
  );
  assert.equal(sliding.x, 0.2);
  assert.equal(sliding.z, 1);
});

test('actor starting in a post can move only when penetration decreases', () => {
  const bounds = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
  const post = {
    id: 'test_post',
    shape: 'circle',
    x: 0,
    z: 0,
    radius: 0.16,
    blocksActors: true,
    blocksCamera: false,
  };

  const escaping = resolveCircleMove(
    { x: 0, z: 0.5 },
    { x: 0, z: 0.04 },
    0.42,
    bounds,
    [post],
  );
  assert.equal(escaping.z, 0.54);

  const worsening = resolveCircleMove(
    { x: 0, z: 0.5 },
    { x: 0, z: -0.1 },
    0.42,
    bounds,
    [post],
  );
  assert.equal(worsening.z, 0.5);
});

test('collision math rejects an unknown collider shape', () => {
  assert.throws(
    () => circleColliderPenetration(0, 0, 0.42, {
      id: 'bad',
      shape: 'capsule',
      x: 0,
      z: 0,
    }),
    /Unknown collider shape: capsule/,
  );
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
    [{
      shape: 'box',
      x: 2,
      z: 0,
      halfX: 0.5,
      halfZ: 2,
      blocksActors: true,
      blocksCamera: true,
    }],
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
    const blocked = village.actorColliders
      .filter(({ blocksActors }) => blocksActors)
      .some((collider) => (
        circleColliderPenetration(
          sourcePosition[0],
          sourcePosition[2],
          0.42,
          collider,
        ) > 0
      ));
    assert.equal(blocked, false, `${id} must remain reachable`);
  }
});

test('critical building walls retain solid village collision', () => {
  const village = createVillage(new THREE.Scene());
  for (const id of ['home_body', 'courtyard_body', 'barn_body']) {
    assert.ok(village.actorColliders.some((collider) => collider.id === id), `missing ${id}`);
  }

  const home = village.actorColliders.find((collider) => collider.id === 'home_body');
  const startX = home.x + home.halfX + 0.5;
  const player = createPlayer(
    new THREE.Scene(),
    new THREE.Vector3(startX, 0, home.z),
    village.actorColliders,
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
    const collider = village.actorColliders.find(({ id }) => id === cluster.id);
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
  assert.equal(village.actorColliders.some(({ id }) => id === 'home_life'), false);

  const player = createPlayer(
    new THREE.Scene(),
    new THREE.Vector3(-7.4, 0, 33),
    village.actorColliders,
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
