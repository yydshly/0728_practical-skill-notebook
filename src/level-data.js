import { circleColliderPenetration } from './collision.js';

export const VILLAGE_LAYOUT = {
  bounds: { minX: -38, maxX: 38, minZ: -39, maxZ: 39 },
  anchors: {
    player_home: [-8, 0, 33],
    radio: [-11.2, 0, 32.8],
    courtyard: [8, 0, 17],
    neighbour: [10.4, 0, 24.4],
    sighting: [-1, 0, 3],
    granary: [11, 0, -10],
    flashlight: [13.2, 0, -4.6],
    south_gate: [0, 0, -35],
  },
  zones: {
    home: { center: [-8, 0, 26], radius: 5 },
    courtyard: { center: [8, 0, 17], radius: 5 },
    main_road: { center: [-1, 0, 3], radius: 8 },
    granary: { center: [11, 0, -10], radius: 6 },
    south_gate_exit: { center: [0, 0, -35], radius: 4.5 },
  },
  roadPolygon: [
    [-5.5, 39], [5.5, 39], [6.2, 25], [4.8, 14], [6.5, 2], [5.2, -10],
    [6, -39], [-6, -39], [-5.2, -12], [-6.4, 0], [-4.8, 15], [-6.2, 27],
  ],
  buildings: [
    { id: 'protagonist_home', kind: 'house', x: -12, z: 28, width: 10, depth: 8, rotation: 0.02 },
    { id: 'courtyard_house', kind: 'house', x: 13, z: 19, width: 10, depth: 9, rotation: -0.04 },
    { id: 'ancestral_hall', kind: 'hall', x: -13, z: 3, width: 12, depth: 8, rotation: 0.03 },
    { id: 'grain_barn', kind: 'barn', x: 15, z: -10, width: 10, depth: 9, rotation: -0.03 },
    { id: 'abandoned_home', kind: 'house', x: -14, z: -21, width: 9, depth: 8, rotation: 0.06 },
    { id: 'north_shed', kind: 'shed', x: 15, z: 32, width: 7, depth: 5, rotation: -0.08 },
    { id: 'south_gate', kind: 'gate', x: 0, z: -36, width: 9, depth: 2, rotation: 0 },
  ],
  colliders: [
    { id: 'home_body', shape: 'box', x: -12, z: 28, halfX: 5.2, halfZ: 4.2, blocksActors: true, blocksCamera: true },
    { id: 'courtyard_body', shape: 'box', x: 13, z: 19, halfX: 5.2, halfZ: 4.7, blocksActors: true, blocksCamera: true },
    { id: 'hall_body', shape: 'box', x: -13, z: 3, halfX: 6.2, halfZ: 4.2, blocksActors: true, blocksCamera: true },
    { id: 'barn_body', shape: 'box', x: 15, z: -10, halfX: 5.2, halfZ: 4.7, blocksActors: true, blocksCamera: true },
    { id: 'abandoned_body', shape: 'box', x: -14, z: -21, halfX: 4.7, halfZ: 4.2, blocksActors: true, blocksCamera: true },
    { id: 'north_shed_body', shape: 'box', x: 15, z: 32, halfX: 3.7, halfZ: 2.7, blocksActors: true, blocksCamera: true },
    { id: 'west_wall_north', shape: 'box', x: -20, z: 22, halfX: 0.3, halfZ: 8, blocksActors: true, blocksCamera: false },
    { id: 'east_wall_north', shape: 'box', x: 20, z: 11, halfX: 0.3, halfZ: 8, blocksActors: true, blocksCamera: false },
    { id: 'west_wall_south', shape: 'box', x: -21, z: -13, halfX: 0.3, halfZ: 7, blocksActors: true, blocksCamera: false },
    { id: 'east_wall_south', shape: 'box', x: 21, z: -25, halfX: 0.3, halfZ: 7, blocksActors: true, blocksCamera: false },
  ],
  propClusters: [
    {
      id: 'home_life',
      kind: 'home',
      x: -6.2,
      z: 33,
      rotation: Math.PI / 2,
      fenceLength: 6,
      gateWidth: 1.8,
    },
    { id: 'courtyard_crops', kind: 'crops', x: 18, z: 12 },
    { id: 'hall_forecourt', kind: 'well', x: -7, z: 8 },
    { id: 'barn_storage', kind: 'storage', x: 10, z: -14 },
    {
      id: 'gate_blockade',
      kind: 'blockade',
      x: -4,
      z: -32,
      collider: {
        id: 'gate_blockade',
        shape: 'box',
        halfX: 3.1,
        halfZ: 0.9,
        blocksActors: true,
        blocksCamera: false,
      },
    },
  ],
  lights: [
    {
      id: 'home_window',
      kind: 'home_window',
      sourceId: 'home_window_mesh',
      x: -9.12,
      y: 1.65,
      z: 32.14,
      color: 0xe1a461,
      intensity: 4.2,
      distance: 9,
    },
    {
      id: 'hall_lantern',
      kind: 'hall_lantern',
      sourceId: 'hall_lantern_mesh',
      x: -12.87,
      y: 2.35,
      z: 7.25,
      color: 0x8f2f24,
      intensity: 2.7,
      distance: 6,
    },
    {
      id: 'barn_flashlight',
      kind: 'barn_flashlight',
      sourceId: 'barn_flashlight_mesh',
      x: 13.04,
      y: 1.05,
      z: -4.66,
      color: 0x88c5c1,
      intensity: 3.5,
      distance: 7,
    },
    {
      id: 'road_lantern_a',
      kind: 'road_lantern',
      sourceId: 'road_lantern_a_mesh',
      x: -4.6,
      y: 2.4,
      z: 18,
      color: 0xd68b47,
      intensity: 4.2,
      distance: 9,
      collider: {
        id: 'road_lantern_a_body',
        shape: 'circle',
        radius: 0.16,
        blocksActors: true,
        blocksCamera: false,
      },
    },
    {
      id: 'road_lantern_b',
      kind: 'road_lantern',
      sourceId: 'road_lantern_b_mesh',
      x: 4.8,
      y: 2.4,
      z: -5,
      color: 0xd68b47,
      intensity: 4.2,
      distance: 9,
      collider: {
        id: 'road_lantern_b_body',
        shape: 'circle',
        radius: 0.16,
        blocksActors: true,
        blocksCamera: false,
      },
    },
  ],
  navNodes: [[5.5, 0, 17], [-1, 0, 3], [6.5, 0, -10], [0, 0, -28]],
};

export function collectActorColliders(layout) {
  return [
    ...layout.colliders.map((collider) => ({ ...collider })),
    ...layout.propClusters.flatMap((cluster) => (
      cluster.collider ? [{
        ...cluster.collider,
        x: cluster.x + (cluster.collider.offsetX ?? 0),
        z: cluster.z + (cluster.collider.offsetZ ?? 0),
      }] : []
    )),
    ...layout.lights.flatMap((light) => (
      light.collider ? [{
        ...light.collider,
        x: light.x + (light.collider.offsetX ?? 0),
        z: light.z + (light.collider.offsetZ ?? 0),
      }] : []
    )),
  ];
}

export function validateVillageLayout(layout) {
  const errors = [];
  const anchorIds = new Set(Object.keys(layout.anchors));
  for (const light of layout.lights) if (!light.sourceId) errors.push(`light:${light.id}:missing-source`);
  for (const id of ['player_home', 'courtyard', 'sighting', 'granary', 'south_gate']) {
    if (!anchorIds.has(id)) errors.push(`anchor:${id}:missing`);
  }

  const colliderIds = new Set();
  const validActorColliders = [];
  for (const collider of collectActorColliders(layout)) {
    const id = typeof collider.id === 'string' && collider.id.length > 0
      ? collider.id
      : 'missing-id';
    let valid = true;

    if (id === 'missing-id') {
      errors.push('collider:missing-id:invalid-id');
      valid = false;
    } else if (colliderIds.has(id)) {
      errors.push(`collider:${id}:duplicate-id`);
      valid = false;
    } else {
      colliderIds.add(id);
    }

    if (!['box', 'circle'].includes(collider.shape)) {
      errors.push(`collider:${id}:unknown-shape:${collider.shape}`);
      valid = false;
    }
    if (!Number.isFinite(collider.x) || !Number.isFinite(collider.z)) {
      errors.push(`collider:${id}:invalid-position`);
      valid = false;
    }
    if (collider.shape === 'box' && (
      !Number.isFinite(collider.halfX) || collider.halfX <= 0
      || !Number.isFinite(collider.halfZ) || collider.halfZ <= 0
    )) {
      errors.push(`collider:${id}:invalid-dimensions`);
      valid = false;
    }
    if (collider.shape === 'circle' && (
      !Number.isFinite(collider.radius) || collider.radius <= 0
    )) {
      errors.push(`collider:${id}:invalid-radius`);
      valid = false;
    }
    if (typeof collider.blocksActors !== 'boolean') {
      errors.push(`collider:${id}:invalid-blocksActors`);
      valid = false;
    }
    if (typeof collider.blocksCamera !== 'boolean') {
      errors.push(`collider:${id}:invalid-blocksCamera`);
      valid = false;
    }
    if (valid && collider.blocksActors) validActorColliders.push(collider);
  }

  for (const light of layout.lights.filter(({ kind }) => kind === 'road_lantern')) {
    if (!light.collider) {
      errors.push(`light:${light.id}:missing-actor-collider`);
      continue;
    }
    if (light.collider.shape !== 'circle') {
      errors.push(`light:${light.id}:collider-must-be-circle`);
    }
    if (light.collider.blocksActors !== true) {
      errors.push(`light:${light.id}:collider-must-block-actors`);
    }
    if (light.collider.blocksCamera !== false) {
      errors.push(`light:${light.id}:collider-must-not-block-camera`);
    }
  }

  layout.navNodes.forEach((node, index) => {
    const [x, , z] = node;
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      errors.push(`nav-node:${index}:invalid-position`);
      return;
    }
    for (const collider of validActorColliders) {
      if (circleColliderPenetration(x, z, 0.46, collider) > 0) {
        errors.push(`nav-node:${index}:overlaps:${collider.id}`);
      }
    }
  });
  return errors;
}
