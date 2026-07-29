import * as THREE from 'three';
import { createMutant } from './characters.js';
import { resolveCircleMove } from './collision.js';

export function createPursuer(
  scene,
  {
    navNodes,
    spawn,
    bounds,
    actorColliders = [],
  },
) {
  const actorRadius = 0.46;
  const rig = createMutant(scene, spawn);
  const object = rig.root;
  const direction = new THREE.Vector3();
  let state = 'patrol';
  let nodeIndex = 0;
  let elapsed = 0;
  const contactDistance = 2.4;
  const minimumSeparation = 2.2;
  const resumeChaseDistance = 3;
  const maximumCollisionStep = 0.2;

  function moveResolved(deltaX, deltaZ) {
    const requestedDistance = Math.hypot(deltaX, deltaZ);
    const stepCount = Math.max(
      1,
      Math.ceil(requestedDistance / maximumCollisionStep),
    );
    const stepX = deltaX / stepCount;
    const stepZ = deltaZ / stepCount;
    let actualAdvance = 0;

    for (let index = 0; index < stepCount; index += 1) {
      const next = resolveCircleMove(
        object.position,
        { x: stepX, z: stepZ },
        actorRadius,
        bounds,
        actorColliders,
      );
      const stepAdvance = Math.hypot(
        next.x - object.position.x,
        next.z - object.position.z,
      );
      object.position.x = next.x;
      object.position.z = next.z;
      actualAdvance += stepAdvance;
      if (stepAdvance <= 1e-9) break;
    }

    return actualAdvance;
  }

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
        const retreat = minimumSeparation - distance;
        moveResolved(-direction.x * retreat, -direction.z * retreat);
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
      const deltaX = direction.x * advance;
      const deltaZ = direction.z * advance;
      const actualAdvance = moveResolved(deltaX, deltaZ);
      object.rotation.y = Math.atan2(direction.x, direction.z);
      rig.setMotion(
        actualAdvance / Math.max(dt, Number.EPSILON),
        elapsed,
      );
      const resolvedDistance = object.position.distanceTo(player.position);
      if (
        state === 'chase'
        && resolvedDistance <= contactDistance + Number.EPSILON
      ) {
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
