function overlaps(x, z, radius, box) {
  const closestX = Math.max(box.x - box.halfX, Math.min(x, box.x + box.halfX));
  const closestZ = Math.max(box.z - box.halfZ, Math.min(z, box.z + box.halfZ));
  return (x - closestX) ** 2 + (z - closestZ) ** 2 < radius ** 2;
}

export function resolveCircleMove(position, delta, radius, bounds, colliders) {
  const result = {
    x: Math.max(bounds.minX, Math.min(position.x + delta.x, bounds.maxX)),
    z: position.z,
  };
  if (colliders.some((box) => overlaps(result.x, result.z, radius, box))) {
    result.x = position.x;
  }
  result.z = Math.max(bounds.minZ, Math.min(position.z + delta.z, bounds.maxZ));
  if (colliders.some((box) => overlaps(result.x, result.z, radius, box))) {
    result.z = position.z;
  }
  return result;
}
