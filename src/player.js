import * as THREE from 'three';
import { createHumanoid } from './characters.js';
import { resolveCircleMove } from './collision.js';

export function createPlayer(scene, spawn, colliders = []) {
  const rig = createHumanoid(scene, spawn, { kind: 'player', name: 'player' });
  const object = rig.root;
  const move = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  let elapsed = 0;

  return {
    object,
    get position() { return object.position; },
    moveDirect(x, z, bounds) {
      const next = resolveCircleMove(
        object.position,
        { x, z },
        0.42,
        bounds,
        colliders,
      );
      object.position.x = next.x;
      object.position.z = next.z;
      if (Math.abs(x) + Math.abs(z) > 0.001) object.rotation.y = Math.atan2(x, z);
    },
    update(dt, input, bounds, yaw) {
      move.set(0, 0, 0);
      if (input.forward) move.z += 1;
      if (input.back) move.z -= 1;
      if (input.left) move.x -= 1;
      if (input.right) move.x += 1;

      const speed = input.sprint ? 6.2 : 3.6;
      const distance = move.lengthSq() === 0 ? 0 : speed * dt;
      if (distance > 0) {
        move.normalize().applyAxisAngle(up, yaw);
        this.moveDirect(move.x * distance, move.z * distance, bounds);
      }

      elapsed += dt;
      rig.setMotion(distance / Math.max(dt, 0.0001), elapsed);
    },
  };
}
