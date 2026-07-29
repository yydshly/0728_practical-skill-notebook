import * as THREE from 'three';

export function createWorldObjectiveMarker(scene) {
  const object = new THREE.Group();
  object.name = 'objective_marker';
  object.userData.decorativeOnly = true;
  object.visible = false;

  const material = new THREE.MeshBasicMaterial({
    color: 0xe3b56f,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.48, 0.66, 32), material);
  ring.name = 'objective_marker_ring';
  ring.rotation.x = -Math.PI / 2;
  object.add(ring);
  scene.add(object);

  function update(snapshot, elapsed) {
    object.visible = Boolean(snapshot.showWorldMarker && snapshot.targetPosition);
    if (!object.visible) return;
    object.position.set(snapshot.targetPosition.x, 0.03, snapshot.targetPosition.z);
    const pulse = snapshot.proximity === 'interact'
      ? 1
      : 1 + Math.sin(elapsed * 3.2) * 0.08;
    object.scale.setScalar(pulse);
    material.opacity = snapshot.proximity === 'interact' ? 0.26 : 0.42;
  }

  function dispose() {
    object.removeFromParent();
    ring.geometry.dispose();
    material.dispose();
  }

  return { object, update, dispose };
}
