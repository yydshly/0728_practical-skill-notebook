import * as THREE from 'three';
import { createMutant } from './characters.js';

export function createPursuer(scene, { navNodes, spawn }) {
  const rig = createMutant(scene, spawn);
  const object = rig.root;
  const direction = new THREE.Vector3();
  let state = 'patrol';
  let nodeIndex = 0;
  let elapsed = 0;
  const contactDistance = 2.4;
  const minimumSeparation = 2.2;
  const resumeChaseDistance = 3;

  function update(dt, player) {
    elapsed += dt;
    const distance = object.position.distanceTo(player.position);
    if (state === 'threaten') {
      if (distance > resumeChaseDistance) state = distance > 17 ? 'lost' : 'chase';
    } else if (distance <= contactDistance) {
      state = 'threaten';
    } else if (distance < 11) {
      state = 'chase';
    } else if (state === 'chase' && distance > 17) {
      state = 'lost';
    } else if (state === 'lost') {
      state = 'patrol';
    }

    if (state === 'threaten') {
      direction.subVectors(player.position, object.position);
      direction.y = 0;
      if (direction.lengthSq() <= Number.EPSILON) {
        direction.set(Math.sin(object.rotation.y), 0, Math.cos(object.rotation.y));
      } else {
        direction.normalize();
        object.rotation.y = Math.atan2(direction.x, direction.z);
      }
      if (distance < minimumSeparation) {
        object.position.addScaledVector(direction, -(minimumSeparation - distance));
      }
      rig.setMotion(0, elapsed);
      return state;
    }

    const target = state === 'chase' ? player.position : navNodes[nodeIndex];
    direction.subVectors(target, object.position);
    direction.y = 0;
    if (direction.lengthSq() < 0.5 && state !== 'chase') nodeIndex = (nodeIndex + 1) % navNodes.length;
    if (direction.lengthSq() > 0.01) {
      const targetDistance = direction.length();
      direction.normalize();
      const speed = state === 'chase' ? 3.45 : 1.15;
      const maximumAdvance = state === 'chase'
        ? Math.max(0, targetDistance - contactDistance)
        : targetDistance;
      const advance = Math.min(speed * dt, maximumAdvance);
      object.position.addScaledVector(direction, advance);
      object.rotation.y = Math.atan2(direction.x, direction.z);
      rig.setMotion(advance / Math.max(dt, Number.EPSILON), elapsed);
      if (state === 'chase' && advance >= maximumAdvance - Number.EPSILON) {
        state = 'threaten';
      }
    } else {
      rig.setMotion(0, elapsed);
    }
    return state;
  }

  return {
    object,
    get state() { return state; },
    update,
    reset() {
      object.position.copy(spawn);
      state = 'patrol';
      nodeIndex = 0;
      elapsed = 0;
      rig.setPose('mutant');
      rig.setMotion(0, elapsed);
    },
  };
}
