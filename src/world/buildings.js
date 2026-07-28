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

function addRoof(group, width, depth, materials, roofHeight = 1.45) {
  const roofs = [];
  const slopeLength = Math.hypot(depth / 2 + 0.5, roofHeight);
  for (const side of [-1, 1]) {
    const roof = makeMesh(
      new THREE.BoxGeometry(width + 0.7, 0.18, slopeLength),
      materials.roof,
    );
    roof.position.set(0, 3.05, side * depth * 0.22);
    roof.rotation.x = side * Math.atan2(roofHeight, depth / 2 + 0.5);
    group.add(roof);
    roofs.push(roof);
  }

  const ridge = makeMesh(
    new THREE.BoxGeometry(width + 0.9, 0.22, 0.24),
    materials.roofEdge,
  );
  ridge.position.y = 3.05 + roofHeight * 0.46;
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

export function buildStructure(scene, definition, materials) {
  if (definition.kind === 'gate') {
    return buildVillageGate(scene, definition, materials);
  }

  const root = new THREE.Group();
  root.name = definition.id;
  root.position.set(definition.x, 0, definition.z);
  root.rotation.y = definition.rotation;

  const wallHeight = definition.kind === 'hall' ? 3.5 : 3;
  const walls = makeMesh(
    new THREE.BoxGeometry(definition.width, wallHeight, definition.depth),
    definition.kind === 'barn' ? materials.plasterDark : materials.plaster,
  );
  walls.name = 'structure_solid_wall';
  walls.position.y = wallHeight / 2 + 0.18;
  root.add(walls);

  const foundation = makeMesh(
    new THREE.BoxGeometry(definition.width + 0.35, 0.36, definition.depth + 0.35),
    materials.plasterDark,
    false,
  );
  foundation.position.y = 0.18;
  root.add(foundation);

  addFrontFrame(root, definition.width, definition.depth, materials);

  const door = makeMesh(new THREE.BoxGeometry(1.1, 1.95, 0.16), materials.wood);
  door.name = 'structure_door';
  door.position.set(0, 1.16, definition.depth / 2 + 0.09);
  root.add(door);

  for (const [side, x] of [
    ['left', -definition.width * 0.28],
    ['right', definition.width * 0.28],
  ]) {
    const window = makeMesh(new THREE.BoxGeometry(1.1, 0.82, 0.12), materials.windowGlow, false);
    window.name = `structure_window_${side}`;
    window.position.set(x, 1.65, definition.depth / 2 + 0.11);
    root.add(window);
  }

  const roofs = addRoof(
    root,
    definition.width,
    definition.depth,
    materials,
    definition.kind === 'hall' ? 1.8 : 1.35,
  );
  scene.add(root);
  return { root, occluders: [walls, ...roofs] };
}
