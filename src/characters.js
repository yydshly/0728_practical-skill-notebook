import * as THREE from 'three';

function humanoid(scene, position, { coatColor, skinColor = 0xb88265, pose = 'stand', name }) {
  const root = new THREE.Group();
  root.name = name;
  root.position.copy(position);

  const coat = new THREE.MeshStandardMaterial({ color: coatColor, roughness: 0.92 });
  const skin = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.86 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x281c18, roughness: 1 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.85, 5, 10), coat);
  body.position.y = 0.98;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10), skin);
  head.position.y = 1.88;
  const armGeometry = new THREE.CapsuleGeometry(0.12, 0.52, 4, 8);
  const leftArm = new THREE.Mesh(armGeometry, coat);
  leftArm.position.set(-0.38, 1.16, 0);
  leftArm.rotation.z = pose === 'hide' ? 1.22 : 0.18;
  const rightArm = leftArm.clone();
  rightArm.position.x = 0.38;
  rightArm.rotation.z = pose === 'hide' ? -1.22 : -0.18;
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), hair);
  hairCap.position.y = 2.02;
  hairCap.scale.y = 0.42;
  root.add(body, head, hairCap, leftArm, rightArm);
  if (pose === 'hide') {
    root.rotation.y = Math.PI * 0.65;
    root.position.y = -0.25;
  }
  root.traverse((child) => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
  scene.add(root);
  return root;
}

export function createResident(scene, position, id, pose = 'hide') {
  return humanoid(scene, position, { coatColor: id === 'neighbour' ? 0x7a5752 : 0x6a7184, pose, name: id });
}

export function createMutant(scene, position) {
  const mutant = humanoid(scene, position, {
    coatColor: 0x5a4742,
    skinColor: 0x9b8c6a,
    pose: 'stand',
    name: 'mutated_villager',
  });
  mutant.scale.set(1.16, 1.1, 1.16);
  return mutant;
}
