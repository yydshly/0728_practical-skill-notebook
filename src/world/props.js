import * as THREE from 'three';

function box(group, size, position, material, castShadow = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addFence(group, materials, collider) {
  const length = collider.halfX * 2;
  for (const x of [-length / 2, 0, length / 2]) box(group, [0.14, 1.15, 0.14], [x, 0.58, 0], materials.wood);
  for (const y of [0.42, 0.9]) box(group, [length, 0.1, 0.12], [0, y, 0], materials.wood);
}

function addCropRows(group, materials) {
  for (let row = -2; row <= 2; row += 1) {
    for (let plant = -3; plant <= 3; plant += 1) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 1.2, 5), materials.straw);
      stem.position.set(row * 0.55, 0.6, plant * 0.62);
      group.add(stem);
    }
  }
}

function addWell(group, materials) {
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.08, 0.75, 12, 1, true), materials.plasterDark);
  ring.position.y = 0.38;
  ring.castShadow = true;
  group.add(ring);
  box(group, [2.5, 0.15, 0.18], [0, 2, 0], materials.wood);
  box(group, [0.14, 2.5, 0.14], [-1.05, 1.25, 0], materials.wood);
  box(group, [0.14, 2.5, 0.14], [1.05, 1.25, 0], materials.wood);
}

function addStorage(group, materials) {
  for (let index = 0; index < 7; index += 1) {
    box(group, [0.8, 0.4, 0.5], [(index % 3) * 0.7, 0.22 + Math.floor(index / 3) * 0.4, 0], materials.straw);
  }
}

function addBlockade(group, materials, collider) {
  const beamLength = collider.halfX * 2 - 0.7;
  const postOffset = collider.halfX - 1;
  box(group, [beamLength, 0.25, 0.35], [0, 0.55, 0], materials.wood);
  box(group, [0.25, 1.4, 0.25], [-postOffset, 0.7, 0], materials.wood);
  box(group, [0.25, 1.4, 0.25], [postOffset, 0.7, 0], materials.wood);

  const cargoBed = box(
    group,
    [1.75, 0.64, 1.18],
    [2.12, 0.66, -0.8],
    materials.metal,
  );
  cargoBed.name = 'tricycle_cargo_bed';

  const frame = box(group, [2.35, 0.12, 0.18], [2.72, 0.48, -0.8], materials.metal);
  frame.name = 'tricycle_frame';
  frame.rotation.z = -0.08;

  const handleStem = box(
    group,
    [0.12, 1.05, 0.12],
    [3.63, 0.92, -0.8],
    materials.metal,
  );
  handleStem.name = 'tricycle_handle_stem';
  handleStem.rotation.z = -0.24;

  const handlebar = box(
    group,
    [0.16, 0.12, 0.95],
    [3.74, 1.38, -0.8],
    materials.metal,
  );
  handlebar.name = 'tricycle_handlebar';

  const seat = box(group, [0.58, 0.16, 0.46], [3.12, 0.92, -0.8], materials.wood);
  seat.name = 'tricycle_seat';

  for (const [name, position] of [
    ['tricycle_front_wheel', [3.68, 0.4, -0.8]],
    ['tricycle_left_rear_wheel', [1.48, 0.4, -0.2]],
    ['tricycle_right_rear_wheel', [1.48, 0.4, -1.4]],
  ]) {
    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 0.12, 12),
      materials.metal,
    );
    wheel.name = name;
    wheel.position.set(...position);
    wheel.rotation.x = Math.PI / 2;
    wheel.castShadow = true;
    wheel.receiveShadow = true;
    group.add(wheel);
  }
}

export function addPropCluster(scene, cluster, materials) {
  const root = new THREE.Group();
  root.name = cluster.id;
  root.position.set(cluster.x, 0, cluster.z);
  if (cluster.kind === 'crops') addCropRows(root, materials);
  if (cluster.kind === 'well') addWell(root, materials);
  if (cluster.kind === 'storage' || cluster.kind === 'home') addStorage(root, materials);
  if (cluster.kind === 'blockade') addBlockade(root, materials, cluster.collider);
  if (cluster.kind === 'home') addFence(root, materials, cluster.collider);
  scene.add(root);
  return root.children;
}

export function addUtilityPole(scene, { x, z }, materials) {
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 4.8, 7), materials.wood);
  pole.position.y = 2.4;
  pole.castShadow = true;
  root.add(pole);
  box(root, [2.2, 0.13, 0.13], [0, 4.35, 0], materials.wood);
  for (const offset of [-0.78, 0.78]) {
    const insulator = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.22, 6), materials.metal);
    insulator.position.set(offset, 4.55, 0);
    root.add(insulator);
  }
  scene.add(root);
  return root;
}

export function addLantern(scene, lightDefinition, materials) {
  const root = new THREE.Group();
  root.position.set(lightDefinition.x, 0, lightDefinition.z);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.08, 2.6, 7), materials.wood);
  post.position.y = 1.3;
  const source = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.36, 0.28), materials.lanternGlass);
  source.name = lightDefinition.sourceId;
  source.position.y = lightDefinition.y;
  const light = new THREE.PointLight(lightDefinition.color, 4.2, 9, 2);
  light.position.y = lightDefinition.y;
  root.add(post, source, light);
  scene.add(root);
  return { root, source, light };
}
