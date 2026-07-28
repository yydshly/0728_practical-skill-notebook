import * as THREE from 'three';
import { computeFirstPersonPose, computeThirdPersonPose } from './camera-math.js';

export function createCameraController(camera, player, { occluders = [], groundY = 0 } = {}) {
  const target = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const rayDirection = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  let yaw = Math.PI;
  let pitch = -0.2;
  let mode = 'third-person';
  let initialized = false;

  function calculateDesired() {
    if (mode === 'first-person') {
      const pose = computeFirstPersonPose({
        player: player.position.toArray(),
        yaw,
        pitch,
        groundY,
      });
      target.fromArray(pose.target);
      desired.fromArray(pose.position);
    } else {
      const pose = computeThirdPersonPose({
        player: player.position.toArray(),
        yaw,
        pitch,
        distance: 5.6,
        groundY,
      });
      target.fromArray(pose.target);
      desired.fromArray(pose.position);
    }
  }

  function snap() {
    calculateDesired();
    camera.position.copy(desired);
    camera.lookAt(target);
    initialized = true;
  }

  function applyOcclusion() {
    rayDirection.subVectors(desired, target);
    const desiredDistance = rayDirection.length();
    rayDirection.normalize();
    raycaster.set(target, rayDirection);
    raycaster.far = desiredDistance;
    const hit = raycaster.intersectObjects(occluders, false)[0];
    if (hit) desired.copy(target).addScaledVector(rayDirection, Math.max(0.75, hit.distance - 0.25));
    desired.y = Math.max(desired.y, groundY + 0.65);
  }

  function update(dt = 1 / 60) {
    if (!initialized) return snap();
    calculateDesired();
    if (mode === 'third-person') applyOcclusion();
    const alpha = 1 - Math.exp(-8 * dt);
    camera.position.lerp(desired, alpha);
    camera.lookAt(target);
  }

  function setMode(next) {
    const nextMode = next === 'first-person' ? 'first-person' : 'third-person';
    if (mode === nextMode) return;
    mode = nextMode;
    snap();
  }

  return {
    get mode() { return mode; },
    get yaw() { return yaw; },
    rotate(deltaX, deltaY) {
      yaw -= deltaX * 0.0024;
      pitch = THREE.MathUtils.clamp(pitch - deltaY * 0.002, -0.78, 0.42);
    },
    setMode,
    toggle() { setMode(mode === 'third-person' ? 'first-person' : 'third-person'); },
    getPoseSnapshot() {
      const direction = new THREE.Vector3();
      camera.getWorldDirection(direction);
      return {
        position: camera.position.toArray(),
        direction: direction.toArray(),
      };
    },
    snap,
    update,
  };
}
