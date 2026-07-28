import * as THREE from 'three';
import { getCharacterProfile, getGaitPose } from './character-motion.js';

function createCapsule(length, radius, material, name) {
  const mesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(radius, Math.max(length - radius * 2, 0.08), 4, 8),
    material,
  );
  mesh.name = name;
  mesh.position.y = -length * 0.5;
  return mesh;
}

function createArm(side, length, material) {
  const shoulder = new THREE.Group();
  shoulder.name = `${side}Shoulder`;

  const upperLength = length * 0.52;
  const lowerLength = length - upperLength;
  const upperArm = createCapsule(upperLength, 0.105, material, `${side}UpperArm`);
  const elbow = new THREE.Group();
  elbow.name = `${side}Elbow`;
  elbow.position.y = -upperLength;
  const forearm = createCapsule(lowerLength, 0.09, material, `${side}Forearm`);

  shoulder.add(upperArm, elbow);
  elbow.add(forearm);
  return { shoulder, elbow };
}

function createLeg(side, material, shoeMaterial) {
  const hip = new THREE.Group();
  hip.name = `${side}Hip`;

  const upperLength = 0.42;
  const lowerLength = 0.37;
  const upperLeg = createCapsule(upperLength, 0.13, material, `${side}UpperLeg`);
  const knee = new THREE.Group();
  knee.name = `${side}Knee`;
  knee.position.y = -upperLength;
  const lowerLeg = createCapsule(lowerLength, 0.115, material, `${side}LowerLeg`);
  const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.13, 0.42), shoeMaterial);
  shoe.name = `${side}Shoe`;
  shoe.position.set(0, -lowerLength, 0.08);

  hip.add(upperLeg, knee);
  knee.add(lowerLeg, shoe);
  return hip;
}

export function createHumanoid(
  scene,
  position,
  { kind = 'resident', pose = 'stand', name = kind } = {},
) {
  const profile = getCharacterProfile(kind);
  const root = new THREE.Group();
  root.name = name;
  root.position.copy(position);
  root.scale.setScalar(profile.scale);
  root.userData.characterKind = kind;
  root.userData.assetProvenance = {
    type: 'procedural',
    source: 'original Three.js geometry',
  };

  const hips = new THREE.Group();
  hips.name = 'hips';
  hips.position.y = 0.92;
  const torso = new THREE.Group();
  torso.name = 'torso';
  torso.position.y = 0.28;
  const head = new THREE.Group();
  head.name = 'head';
  head.position.y = 0.9;

  const coatMaterial = new THREE.MeshStandardMaterial({
    color: profile.colors.coat,
    roughness: 0.92,
  });
  const trouserMaterial = new THREE.MeshStandardMaterial({
    color: profile.colors.trousers,
    roughness: 0.94,
  });
  const skinMaterial = new THREE.MeshStandardMaterial({
    color: profile.colors.skin,
    roughness: 0.86,
  });
  const hairMaterial = new THREE.MeshStandardMaterial({ color: 0x281c18, roughness: 1 });
  const shoeMaterial = new THREE.MeshStandardMaterial({ color: 0x211f1c, roughness: 0.96 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.48, 5, 10), coatMaterial);
  body.name = 'body';
  body.position.y = 0.28;
  const coatHem = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.28, 0.42), coatMaterial);
  coatHem.name = 'coatHem';
  coatHem.position.y = -0.04;
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10), skinMaterial);
  headMesh.name = 'headMesh';
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    hairMaterial,
  );
  hair.name = 'hair';
  hair.position.y = 0.1;
  hair.scale.y = 0.62;

  const leftArm = createArm('left', profile.leftArmLength, coatMaterial);
  const rightArm = createArm('right', profile.rightArmLength, coatMaterial);
  leftArm.shoulder.position.set(-0.38, 0.58, 0);
  rightArm.shoulder.position.set(0.38, 0.58, 0);
  const leftHip = createLeg('left', trouserMaterial, shoeMaterial);
  const rightHip = createLeg('right', trouserMaterial, shoeMaterial);
  leftHip.position.set(-0.2, -0.12, 0);
  rightHip.position.set(0.2, -0.12, 0);

  root.add(hips);
  hips.add(torso, leftHip, rightHip);
  torso.add(body, coatHem, head, leftArm.shoulder, rightArm.shoulder);
  head.add(headMesh, hair);

  const shadowCasters = new Set([
    'body', 'headMesh', 'coatHem',
    'leftUpperLeg', 'leftLowerLeg', 'rightUpperLeg', 'rightLowerLeg',
  ]);
  root.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = shadowCasters.has(child.name);
    child.receiveShadow = true;
  });

  function setMotion(speed, elapsed) {
    const gait = getGaitPose(elapsed, speed, kind);
    leftArm.shoulder.rotation.x = gait.leftArm;
    rightArm.shoulder.rotation.x = gait.rightArm;
    leftHip.rotation.x = gait.leftLeg;
    rightHip.rotation.x = gait.rightLeg;
    torso.rotation.x = gait.lean;
    hips.position.y = 0.92 + gait.bob;
  }

  function setPose(poseName) {
    const isHide = poseName === 'hide';
    const isMutant = poseName === 'mutant';
    torso.rotation.x = isMutant ? profile.lean : 0;
    torso.rotation.z = isHide ? -0.18 : 0;
    root.rotation.y = isHide ? Math.PI * 0.65 : 0;
    head.rotation.y = isHide ? -0.72 : 0;
    leftArm.elbow.rotation.x = isHide ? -1.22 : 0;
    rightArm.elbow.rotation.x = isHide ? -1.22 : 0;
    leftArm.shoulder.rotation.z = isMutant ? 0.28 : 0.14;
    rightArm.shoulder.rotation.z = isMutant ? -0.08 : -0.14;
  }

  scene.add(root);
  setPose(pose);
  return { root, setMotion, setPose };
}

export function createResident(scene, position, id, pose = 'hide') {
  return createHumanoid(scene, position, {
    kind: 'resident',
    pose,
    name: id,
  });
}

export function createMutant(scene, position) {
  return createHumanoid(scene, position, {
    kind: 'mutant',
    pose: 'mutant',
    name: 'mutated_villager',
  });
}
