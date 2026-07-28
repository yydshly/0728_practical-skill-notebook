import * as THREE from 'three';
import { createMutant } from './characters.js';

export function createPursuer(scene, { navNodes, spawn }) {
  const object = createMutant(scene, spawn);
  const direction = new THREE.Vector3();
  let state = 'patrol';
  let nodeIndex = 0;

  function update(dt, player) {
    const distance = object.position.distanceTo(player.position);
    if (distance < 11) state = 'chase';
    else if (state === 'chase' && distance > 17) state = 'lost';
    else if (state === 'lost') state = 'patrol';

    const target = state === 'chase' ? player.position : navNodes[nodeIndex];
    direction.subVectors(target, object.position);
    direction.y = 0;
    if (direction.lengthSq() < 0.5 && state !== 'chase') nodeIndex = (nodeIndex + 1) % navNodes.length;
    if (direction.lengthSq() > 0.01) {
      direction.normalize();
      const speed = state === 'chase' ? 3.45 : 1.15;
      object.position.addScaledVector(direction, speed * dt);
      object.rotation.y = Math.atan2(direction.x, direction.z);
    }
    return state;
  }

  return {
    object,
    get state() { return state; },
    update,
    reset() { object.position.copy(spawn); state = 'patrol'; nodeIndex = 0; },
  };
}
