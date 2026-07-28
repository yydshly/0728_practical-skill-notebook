export const VILLAGE_LAYOUT = {
  bounds: { minX: -38, maxX: 38, minZ: -39, maxZ: 39 },
  anchors: {
    player_home: [-8, 0, 26],
    radio: [-11.2, 0, 26.8],
    courtyard: [8, 0, 17],
    neighbour: [10.4, 0, 18.4],
    sighting: [-1, 0, 3],
    granary: [11, 0, -10],
    flashlight: [13.2, 0, -8.7],
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
    { id: 'home_body', x: -12, z: 28, halfX: 5.2, halfZ: 4.2 },
    { id: 'courtyard_body', x: 13, z: 19, halfX: 5.2, halfZ: 4.7 },
    { id: 'hall_body', x: -13, z: 3, halfX: 6.2, halfZ: 4.2 },
    { id: 'barn_body', x: 15, z: -10, halfX: 5.2, halfZ: 4.7 },
    { id: 'abandoned_body', x: -14, z: -21, halfX: 4.7, halfZ: 4.2 },
    { id: 'north_shed_body', x: 15, z: 32, halfX: 3.7, halfZ: 2.7 },
    { id: 'west_wall_north', x: -20, z: 22, halfX: 0.3, halfZ: 8 },
    { id: 'east_wall_north', x: 20, z: 11, halfX: 0.3, halfZ: 8 },
    { id: 'west_wall_south', x: -21, z: -13, halfX: 0.3, halfZ: 7 },
    { id: 'east_wall_south', x: 21, z: -25, halfX: 0.3, halfZ: 7 },
  ],
  propClusters: [
    { id: 'home_life', kind: 'home', x: -7, z: 29 },
    { id: 'courtyard_crops', kind: 'crops', x: 18, z: 12 },
    { id: 'hall_forecourt', kind: 'well', x: -7, z: 8 },
    { id: 'barn_storage', kind: 'storage', x: 10, z: -14 },
    { id: 'gate_blockade', kind: 'blockade', x: -4, z: -32 },
  ],
  lights: [
    { id: 'home_window', sourceId: 'home_window_mesh', x: -7.3, y: 1.6, z: 28, color: 0xe1a461 },
    { id: 'road_lantern_a', sourceId: 'road_lantern_a_mesh', x: -4.6, y: 2.4, z: 18, color: 0xd68b47 },
    { id: 'road_lantern_b', sourceId: 'road_lantern_b_mesh', x: 4.8, y: 2.4, z: -5, color: 0xd68b47 },
  ],
  navNodes: [[8, 0, 17], [-1, 0, 3], [11, 0, -10], [0, 0, -35]],
};

export function validateVillageLayout(layout) {
  const errors = [];
  const anchorIds = new Set(Object.keys(layout.anchors));
  for (const light of layout.lights) if (!light.sourceId) errors.push(`light:${light.id}:missing-source`);
  for (const id of ['player_home', 'courtyard', 'sighting', 'granary', 'south_gate']) {
    if (!anchorIds.has(id)) errors.push(`anchor:${id}:missing`);
  }
  return errors;
}
