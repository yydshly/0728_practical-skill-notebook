import * as THREE from 'three';

function makeMesh(geometry, material, castShadow = true) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
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

export function buildStructure(scene, definition, materials) {
  const root = new THREE.Group();
  root.name = definition.id;
  root.position.set(definition.x, 0, definition.z);
  root.rotation.y = definition.rotation;

  const wallHeight = definition.kind === 'hall' ? 3.5 : 3;
  const walls = makeMesh(
    new THREE.BoxGeometry(definition.width, wallHeight, definition.depth),
    definition.kind === 'barn' ? materials.plasterDark : materials.plaster,
  );
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
  door.position.set(0, 1.16, definition.depth / 2 + 0.09);
  root.add(door);

  for (const x of [-definition.width * 0.28, definition.width * 0.28]) {
    const window = makeMesh(new THREE.BoxGeometry(1.1, 0.82, 0.12), materials.windowGlow, false);
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
