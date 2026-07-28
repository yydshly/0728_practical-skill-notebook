import * as THREE from 'three';

const palette = {
  soil: new THREE.MeshStandardMaterial({ color: 0x303328, roughness: 1 }),
  road: new THREE.MeshStandardMaterial({ color: 0x615b4a, roughness: 0.95 }),
  plaster: new THREE.MeshStandardMaterial({ color: 0x9e9070, roughness: 0.92 }),
  roof: new THREE.MeshStandardMaterial({ color: 0x343b35, roughness: 0.8 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x4a3223, roughness: 0.85 }),
  foliage: new THREE.MeshStandardMaterial({ color: 0x273a27, roughness: 1 }),
  lantern: new THREE.MeshStandardMaterial({ color: 0xe0a85f, emissive: 0xb86720, emissiveIntensity: 1.3 }),
};

function mesh(geometry, material, position, rotation = [0, 0, 0]) {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(...position);
  item.rotation.set(...rotation);
  item.castShadow = true;
  item.receiveShadow = true;
  return item;
}

function addHouse(scene, x, z, width, depth, label) {
  const group = new THREE.Group();
  group.name = label;
  group.add(mesh(new THREE.BoxGeometry(width, 2.5, depth), palette.plaster, [x, 1.25, z]));
  group.add(mesh(new THREE.BoxGeometry(width + 0.45, 0.7, depth + 0.45), palette.roof, [x, 2.8, z], [0, 0.12, 0]));
  group.add(mesh(new THREE.BoxGeometry(0.82, 1.45, 0.12), palette.wood, [x, 0.73, z + depth / 2 + 0.07]));
  scene.add(group);
}

function addTree(scene, x, z, scale = 1) {
  const trunk = mesh(new THREE.CylinderGeometry(0.18 * scale, 0.26 * scale, 2 * scale, 7), palette.wood, [x, scale, z]);
  const crown = mesh(new THREE.ConeGeometry(1.15 * scale, 2.8 * scale, 8), palette.foliage, [x, 2.75 * scale, z]);
  scene.add(trunk, crown);
}

function addLantern(scene, x, z) {
  const post = mesh(new THREE.CylinderGeometry(0.06, 0.09, 2.4, 8), palette.wood, [x, 1.2, z]);
  const source = mesh(new THREE.SphereGeometry(0.15, 10, 8), palette.lantern, [x, 2.22, z]);
  const light = new THREE.PointLight(0xf2b968, 6, 10, 2);
  light.position.set(x, 2.22, z);
  light.castShadow = true;
  scene.add(post, source, light);
}

function addMarker(scene, x, z, color) {
  const marker = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.22, 0.65, 5),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35 }),
  );
  marker.position.set(x, 0.33, z);
  marker.castShadow = true;
  scene.add(marker);
}

export function createVillage(scene) {
  const ground = mesh(new THREE.PlaneGeometry(92, 92), palette.soil, [0, 0, 0], [-Math.PI / 2, 0, 0]);
  scene.add(ground);

  const road = mesh(new THREE.PlaneGeometry(13, 78), palette.road, [0, 0.012, 0], [-Math.PI / 2, 0, 0]);
  scene.add(road);

  addHouse(scene, -11, 26, 8, 7, 'protagonist_home');
  addHouse(scene, 11, 18, 9, 8, 'courtyard_house');
  addHouse(scene, -12, 2, 10, 7, 'ancestral_hall');
  addHouse(scene, 14, -8, 9, 8, 'grain_barn');
  addHouse(scene, -13, -21, 8, 7, 'abandoned_home');

  for (const [x, z, scale] of [[-27, 28, 1.3], [26, 24, 1.1], [-25, 6, 1.6], [25, -2, 1.25], [-25, -22, 1.45], [26, -29, 1.3]]) {
    addTree(scene, x, z, scale);
  }

  for (const [x, z] of [[-4.8, 23], [5.2, 8], [-4.7, -7], [5.2, -25]]) addLantern(scene, x, z);

  const anchors = {
    player_home: new THREE.Vector3(-8, 0, 25),
    courtyard: new THREE.Vector3(8, 0, 16),
    sighting: new THREE.Vector3(-1, 0, 3),
    granary: new THREE.Vector3(10, 0, -9),
    south_gate: new THREE.Vector3(0, 0, -34),
  };

  addMarker(scene, anchors.player_home.x, anchors.player_home.z, 0xe4b96b);
  addMarker(scene, anchors.courtyard.x, anchors.courtyard.z, 0x8fd6b6);
  addMarker(scene, anchors.granary.x, anchors.granary.z, 0x83b3e0);
  addMarker(scene, anchors.south_gate.x, anchors.south_gate.z, 0xe48a82);

  return {
    anchors,
    bounds: { minX: -37, maxX: 37, minZ: -37, maxZ: 37 },
    zones: {
      home: { id: 'home', center: anchors.player_home, radius: 5 },
      courtyard: { id: 'courtyard', center: anchors.courtyard, radius: 5 },
      main_road: { id: 'main_road', center: anchors.sighting, radius: 8 },
      granary: { id: 'granary', center: anchors.granary, radius: 6 },
      south_gate_exit: { id: 'south_gate_exit', center: anchors.south_gate, radius: 5 },
    },
    colliders: [],
    navNodes: [anchors.courtyard, anchors.sighting, anchors.granary, anchors.south_gate],
  };
}
