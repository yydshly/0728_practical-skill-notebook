import * as THREE from 'three';

export function createPlayer(scene, spawn) {
  const object = new THREE.Group();
  object.name = 'player';
  object.position.copy(spawn);

  const coat = new THREE.MeshStandardMaterial({ color: 0x5f7256, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xbf8767, roughness: 0.85 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x241a18, roughness: 1 });
  const limb = new THREE.CapsuleGeometry(0.18, 0.7, 4, 8);

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.95, 6, 12), coat);
  body.position.y = 1.08;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), skin);
  head.position.y = 2.06;
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.31, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), hair);
  hairCap.position.y = 2.16;
  const leftArm = new THREE.Mesh(limb, coat);
  leftArm.position.set(-0.45, 1.25, 0);
  leftArm.rotation.z = 0.14;
  const rightArm = leftArm.clone();
  rightArm.position.x = 0.45;
  rightArm.rotation.z = -0.14;
  object.add(body, head, hairCap, leftArm, rightArm);
  object.traverse((child) => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
  scene.add(object);

  const move = new THREE.Vector3();
  return {
    object,
    get position() { return object.position; },
    moveDirect(x, z, bounds) {
      object.position.x = THREE.MathUtils.clamp(object.position.x + x, bounds.minX, bounds.maxX);
      object.position.z = THREE.MathUtils.clamp(object.position.z + z, bounds.minZ, bounds.maxZ);
      if (Math.abs(x) + Math.abs(z) > 0.001) object.rotation.y = Math.atan2(x, z);
    },
    update(dt, input, bounds, yaw) {
      move.set(0, 0, 0);
      if (input.forward) move.z -= 1;
      if (input.back) move.z += 1;
      if (input.left) move.x -= 1;
      if (input.right) move.x += 1;
      if (move.lengthSq() === 0) return;
      move.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      const speed = input.sprint ? 6.2 : 3.6;
      this.moveDirect(move.x * speed * dt, move.z * speed * dt, bounds);
    },
  };
}
