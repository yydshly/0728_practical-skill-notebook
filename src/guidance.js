import * as THREE from 'three';

const projected = new THREE.Vector3();

export function formatObjectiveDistance(distance) {
  return distance <= 3 ? '就在附近' : `${Math.round(distance)}m`;
}

export function computeGuidanceSnapshot({
  playerPosition,
  targetPosition,
  cameraYaw,
  preApproachRadius = 5,
  interactionRadius = 2.2,
  worldMarkerRadius = 12,
}) {
  if (!targetPosition) {
    return {
      targetPosition: null,
      distance: Infinity,
      distanceLabel: '',
      relativeAngle: 0,
      proximity: 'none',
      showWorldMarker: false,
    };
  }
  const dx = targetPosition.x - playerPosition.x;
  const dz = targetPosition.z - playerPosition.z;
  const distance = Math.hypot(dx, dz);
  const targetYaw = Math.atan2(dx, dz);
  const relativeAngle = Math.atan2(
    Math.sin(targetYaw - cameraYaw),
    Math.cos(targetYaw - cameraYaw),
  );
  const proximity = distance <= interactionRadius
    ? 'interact'
    : distance <= preApproachRadius ? 'approach' : 'far';
  return {
    targetPosition,
    distance,
    distanceLabel: formatObjectiveDistance(distance),
    relativeAngle,
    proximity,
    showWorldMarker: distance <= worldMarkerRadius,
  };
}

export function projectScreenMarker(targetPosition, camera, viewport, margin = 48) {
  if (!targetPosition || !camera || !viewport || viewport.width <= 0 || viewport.height <= 0) {
    return null;
  }
  projected.copy(targetPosition);
  projected.y += 1.5;
  projected.project(camera);
  if (![projected.x, projected.y, projected.z].every(Number.isFinite)) return null;

  const behind = projected.z > 1;
  const rawX = ((behind ? -projected.x : projected.x) * 0.5 + 0.5) * viewport.width;
  const rawY = (-(behind ? -projected.y : projected.y) * 0.5 + 0.5) * viewport.height;
  const x = Math.min(viewport.width - margin, Math.max(margin, rawX));
  const y = Math.min(viewport.height - margin, Math.max(margin, rawY));
  const edge = behind || x !== rawX || y !== rawY;
  return { x, y, edge, behind };
}
