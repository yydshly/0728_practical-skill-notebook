import * as THREE from 'three';

function makeMesh(geometry, material, castShadow = true) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  return mesh;
}

function namedMesh(name, geometry, material, castShadow = true) {
  const mesh = makeMesh(geometry, material, castShadow);
  mesh.name = name;
  return mesh;
}

function addRoof(
  group,
  width,
  depth,
  materials,
  roofHeight = 1.45,
  baseY = 3.05,
) {
  const roofs = [];
  const slopeLength = Math.hypot(depth / 2 + 0.5, roofHeight);
  for (const side of [-1, 1]) {
    const roof = makeMesh(
      new THREE.BoxGeometry(width + 0.7, 0.18, slopeLength),
      materials.roof,
    );
    roof.position.set(0, baseY, side * depth * 0.22);
    roof.rotation.x = side * Math.atan2(roofHeight, depth / 2 + 0.5);
    group.add(roof);
    roofs.push(roof);
  }

  const ridge = makeMesh(
    new THREE.BoxGeometry(width + 0.9, 0.22, 0.24),
    materials.roofEdge,
  );
  ridge.position.y = baseY + roofHeight * 0.46;
  group.add(ridge);
  return roofs;
}

function addFrontFrame(group, width, depth, materials) {
  for (const x of [-width * 0.4, width * 0.4]) {
    const post = makeMesh(new THREE.BoxGeometry(0.16, 2.45, 0.18), materials.wood);
    post.position.set(x, 1.4, depth / 2 + 0.12);
    group.add(post);
  }
  const beam = makeMesh(new THREE.BoxGeometry(width * 0.88, 0.18, 0.18), materials.wood);
  beam.position.set(0, 2.55, depth / 2 + 0.12);
  group.add(beam);
}

export function buildVillageGate(scene, definition, materials) {
  const root = new THREE.Group();
  root.name = definition.id;
  root.position.set(definition.x, 0, definition.z);
  root.rotation.y = definition.rotation;

  const occluders = [];
  const pillarOffset = definition.width * 0.32;
  for (const [side, x] of [['left', -pillarOffset], ['right', pillarOffset]]) {
    const plinth = namedMesh(
      `gate_${side}_plinth`,
      new THREE.BoxGeometry(0.78, 0.34, definition.depth + 0.42),
      materials.plasterDark,
      false,
    );
    plinth.position.set(x, 0.17, 0);

    const pillar = namedMesh(
      `gate_${side}_pillar`,
      new THREE.BoxGeometry(0.5, 3.05, 0.62),
      materials.plaster,
    );
    pillar.position.set(x, 1.7, 0);

    const shortWall = namedMesh(
      `gate_${side}_short_wall`,
      new THREE.BoxGeometry(definition.width * 0.2, 1.4, 0.46),
      materials.plasterDark,
    );
    shortWall.position.set(
      x + (side === 'left' ? -definition.width * 0.13 : definition.width * 0.13),
      0.82,
      0,
    );

    root.add(plinth, pillar, shortWall);
    occluders.push(pillar, shortWall);
  }

  const beam = namedMesh(
    'gate_beam',
    new THREE.BoxGeometry(definition.width * 0.72, 0.44, 0.64),
    materials.wood,
  );
  beam.position.set(0, 2.72, 0);
  root.add(beam);
  occluders.push(beam);

  const roofHeight = 0.72;
  const slopeLength = Math.hypot(definition.depth / 2 + 0.35, roofHeight);
  for (const [side, direction] of [['left', -1], ['right', 1]]) {
    const roof = namedMesh(
      `gate_roof_${side}`,
      new THREE.BoxGeometry(definition.width * 0.84, 0.16, slopeLength),
      materials.roof,
    );
    roof.position.set(0, 3.23, direction * definition.depth * 0.2);
    roof.rotation.x = direction * Math.atan2(roofHeight, definition.depth / 2 + 0.35);
    root.add(roof);
    occluders.push(roof);
  }

  const ridge = namedMesh(
    'gate_roof_ridge',
    new THREE.BoxGeometry(definition.width * 0.9, 0.2, 0.22),
    materials.roofEdge,
  );
  ridge.position.set(0, 3.58, 0);
  root.add(ridge);

  for (const [side, direction] of [['left', -1], ['right', 1]]) {
    const door = namedMesh(
      `gate_${side}_door`,
      new THREE.BoxGeometry(2.35, 1.92, 0.12),
      materials.metal,
    );
    door.position.set(direction * 1.55, 1.12, 0.18);
    door.rotation.y = direction * 0.62;
    root.add(door);
  }

  scene.add(root);
  return { root, occluders };
}

function structureRoot(definition) {
  const root = new THREE.Group();
  root.name = definition.id;
  root.position.set(definition.x, 0, definition.z);
  root.rotation.y = definition.rotation;
  return root;
}

function addFoundation(root, definition, materials) {
  const foundation = makeMesh(
    new THREE.BoxGeometry(definition.width + 0.35, 0.36, definition.depth + 0.35),
    materials.plasterDark,
    false,
  );
  foundation.name = 'structure_foundation';
  foundation.position.y = 0.18;
  root.add(foundation);
  return foundation;
}

export function buildHall(scene, definition, materials) {
  const root = structureRoot(definition);
  const wallHeight = 3.75;
  const walls = namedMesh(
    'structure_solid_wall',
    new THREE.BoxGeometry(definition.width, wallHeight, definition.depth),
    materials.plaster,
  );
  walls.position.y = wallHeight / 2 + 0.18;
  root.add(walls);
  addFoundation(root, definition, materials);

  for (const x of [-definition.width * 0.38, definition.width * 0.38]) {
    const post = makeMesh(new THREE.BoxGeometry(0.2, 2.9, 0.22), materials.wood);
    post.position.set(x, 1.62, definition.depth / 2 + 0.14);
    root.add(post);
  }

  const lowerEave = namedMesh(
    'hall_lower_eave',
    new THREE.BoxGeometry(definition.width + 1.35, 0.2, 1.15),
    materials.roof,
  );
  lowerEave.position.set(0, 2.92, definition.depth / 2 + 0.28);
  lowerEave.rotation.x = -0.12;
  root.add(lowerEave);

  const upperEave = namedMesh(
    'hall_upper_eave',
    new THREE.BoxGeometry(definition.width + 0.8, 0.22, 0.5),
    materials.roofEdge,
  );
  upperEave.position.set(0, 3.72, definition.depth / 2 + 0.12);
  root.add(upperEave);

  for (const [side, x] of [['left', -1.22], ['right', 1.22]]) {
    const door = namedMesh(
      `hall_door_${side}`,
      new THREE.BoxGeometry(2.36, 2.45, 0.18),
      materials.wood,
    );
    door.position.set(x, 1.42, definition.depth / 2 + 0.12);
    root.add(door);
  }

  const lantern = namedMesh(
    'hall_lantern_mesh',
    new THREE.BoxGeometry(0.34, 0.48, 0.3),
    materials.hallGlow,
    false,
  );
  lantern.position.set(0, 2.35, definition.depth / 2 + 0.25);
  root.add(lantern);

  const roofs = addRoof(root, definition.width + 0.4, definition.depth, materials, 1.85, 3.8);
  scene.add(root);
  return { root, occluders: [walls, lowerEave, upperEave, ...roofs] };
}

export function buildBarn(scene, definition, materials) {
  const root = structureRoot(definition);
  const plinth = namedMesh(
    'barn_raised_plinth',
    new THREE.BoxGeometry(definition.width + 0.5, 0.7, definition.depth + 0.5),
    materials.plasterDark,
    false,
  );
  plinth.position.y = 0.35;
  root.add(plinth);

  const walls = namedMesh(
    'structure_solid_wall',
    new THREE.BoxGeometry(definition.width, 3.55, definition.depth),
    materials.plasterDark,
  );
  walls.position.y = 2.43;
  root.add(walls);

  for (const [side, x] of [['left', -1.65], ['right', 1.65]]) {
    const door = namedMesh(
      `barn_door_${side}`,
      new THREE.BoxGeometry(3.18, 2.8, 0.2),
      materials.wood,
    );
    door.position.set(x, 2.03, definition.depth / 2 + 0.12);
    root.add(door);
  }

  const ventBoard = namedMesh(
    'barn_vent_board',
    new THREE.BoxGeometry(4.2, 0.82, 0.18),
    materials.wood,
  );
  ventBoard.position.set(0, 3.75, definition.depth / 2 + 0.13);
  root.add(ventBoard);
  for (const x of [-1.4, -0.7, 0, 0.7, 1.4]) {
    const slit = makeMesh(new THREE.BoxGeometry(0.12, 0.62, 0.07), materials.metal, false);
    slit.position.set(x, 3.75, definition.depth / 2 + 0.24);
    root.add(slit);
  }

  const rack = new THREE.Group();
  rack.name = 'barn_timber_rack';
  rack.position.set(definition.width * 0.34, 0, definition.depth / 2 + 0.75);
  for (const x of [-0.9, 0.9]) {
    const post = makeMesh(new THREE.BoxGeometry(0.14, 1.8, 0.14), materials.wood);
    post.position.set(x, 0.9, 0);
    rack.add(post);
  }
  for (const y of [0.45, 1.05, 1.65]) {
    const beam = makeMesh(new THREE.BoxGeometry(2.1, 0.12, 0.16), materials.wood);
    beam.position.set(0, y, 0);
    rack.add(beam);
  }
  root.add(rack);

  const flashlight = namedMesh(
    'barn_flashlight_mesh',
    new THREE.BoxGeometry(0.42, 0.16, 0.18),
    materials.coldGlow,
    false,
  );
  flashlight.position.set(-1.8, 1.05, 5.4);
  flashlight.rotation.x = -0.18;
  root.add(flashlight);

  const roofs = addRoof(
    root,
    definition.width,
    definition.depth,
    materials,
    1.25,
    4.15,
  );
  scene.add(root);
  return { root, occluders: [walls, ...roofs] };
}

function buildHouse(scene, definition, materials) {
  const root = structureRoot(definition);
  const wallHeight = 3;
  const walls = namedMesh(
    'structure_solid_wall',
    new THREE.BoxGeometry(definition.width, wallHeight, definition.depth),
    materials.plaster,
  );
  walls.position.y = wallHeight / 2 + 0.18;
  root.add(walls);
  addFoundation(root, definition, materials);
  addFrontFrame(root, definition.width, definition.depth, materials);

  const door = namedMesh(
    'structure_door',
    new THREE.BoxGeometry(1.1, 1.95, 0.16),
    materials.wood,
  );
  door.position.set(0, 1.16, definition.depth / 2 + 0.09);
  root.add(door);

  for (const [side, x] of [
    ['left', -definition.width * 0.28],
    ['right', definition.width * 0.28],
  ]) {
    const windowName = definition.id === 'protagonist_home' && side === 'right'
      ? 'home_window_mesh'
      : `structure_window_${side}`;
    const window = namedMesh(
      windowName,
      new THREE.BoxGeometry(1.1, 0.82, 0.12),
      materials.windowGlow,
      false,
    );
    window.position.set(
      x,
      1.65,
      definition.depth / 2 + (windowName === 'home_window_mesh' ? 0.2 : 0.11),
    );
    root.add(window);
  }

  const roofs = addRoof(root, definition.width, definition.depth, materials, 1.35);
  scene.add(root);
  return { root, occluders: [walls, ...roofs] };
}

export function buildStructure(scene, definition, materials) {
  if (definition.kind === 'gate') return buildVillageGate(scene, definition, materials);
  if (definition.kind === 'hall') return buildHall(scene, definition, materials);
  if (definition.kind === 'barn') return buildBarn(scene, definition, materials);
  return buildHouse(scene, definition, materials);
}
