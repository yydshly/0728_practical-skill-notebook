import * as THREE from 'three';

export function createCameraController(camera, player) {
  const target = new THREE.Vector3();
  const desired = new THREE.Vector3();
  let yaw = Math.PI;
  let pitch = -0.2;
  let mode = 'third-person';

  function update() {
    target.copy(player.position).add(new THREE.Vector3(0, mode === 'first-person' ? 1.82 : 1.28, 0));
    if (mode === 'first-person') {
      desired.copy(target);
      desired.add(new THREE.Vector3(Math.sin(yaw) * 0.06, 0, Math.cos(yaw) * 0.06));
      camera.position.lerp(desired, 0.45);
    } else {
      const distance = 5.1;
      desired.set(
        target.x - Math.sin(yaw) * Math.cos(pitch) * distance,
        target.y - Math.sin(pitch) * distance + 1.1,
        target.z - Math.cos(yaw) * Math.cos(pitch) * distance,
      );
      camera.position.lerp(desired, 0.15);
    }
    camera.lookAt(target);
  }

  return {
    get mode() { return mode; },
    get yaw() { return yaw; },
    rotate(deltaX, deltaY) {
      yaw -= deltaX * 0.0024;
      pitch = THREE.MathUtils.clamp(pitch - deltaY * 0.002, -0.78, 0.42);
    },
    setMode(next) { mode = next === 'first-person' ? 'first-person' : 'third-person'; },
    toggle() { mode = mode === 'third-person' ? 'first-person' : 'third-person'; },
    update,
  };
}
