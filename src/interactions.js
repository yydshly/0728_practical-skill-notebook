export function nearestInteraction(position, candidates, radius) {
  let nearest = null;
  let nearestDistance = radius;
  for (const candidate of candidates) {
    const distance = Math.hypot(
      position.x - candidate.position.x,
      position.z - candidate.position.z,
    );
    if (distance <= nearestDistance) {
      nearest = candidate;
      nearestDistance = distance;
    }
  }
  return nearest;
}
