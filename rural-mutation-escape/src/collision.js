const EPSILON = 1e-9;

function boxPenetration(x, z, actorRadius, collider) {
  const dx = Math.abs(x - collider.x) - collider.halfX;
  const dz = Math.abs(z - collider.z) - collider.halfZ;
  if (dx <= 0 && dz <= 0) {
    return actorRadius + Math.min(-dx, -dz);
  }
  const outsideDistance = Math.hypot(Math.max(dx, 0), Math.max(dz, 0));
  return actorRadius - outsideDistance;
}

function circlePenetration(x, z, actorRadius, collider) {
  return actorRadius + collider.radius - Math.hypot(
    x - collider.x,
    z - collider.z,
  );
}

export function circleColliderPenetration(x, z, actorRadius, collider) {
  if (collider.shape === 'box') {
    return boxPenetration(x, z, actorRadius, collider);
  }
  if (collider.shape === 'circle') {
    return circlePenetration(x, z, actorRadius, collider);
  }
  throw new Error(`Unknown collider shape: ${collider.shape}`);
}

function canOccupy(startX, startZ, endX, endZ, radius, colliders) {
  return colliders
    .filter(({ blocksActors }) => blocksActors)
    .every((collider) => {
      const before = circleColliderPenetration(
        startX,
        startZ,
        radius,
        collider,
      );
      const after = circleColliderPenetration(
        endX,
        endZ,
        radius,
        collider,
      );
      return after <= 0 || (before > 0 && after < before - EPSILON);
    });
}

export function resolveCircleMove(position, delta, radius, bounds, colliders) {
  const result = {
    x: Math.max(bounds.minX, Math.min(position.x + delta.x, bounds.maxX)),
    z: position.z,
  };
  if (!canOccupy(
    position.x,
    position.z,
    result.x,
    result.z,
    radius,
    colliders,
  )) {
    result.x = position.x;
  }

  const nextZ = Math.max(
    bounds.minZ,
    Math.min(position.z + delta.z, bounds.maxZ),
  );
  if (canOccupy(result.x, position.z, result.x, nextZ, radius, colliders)) {
    result.z = nextZ;
  }
  return result;
}
