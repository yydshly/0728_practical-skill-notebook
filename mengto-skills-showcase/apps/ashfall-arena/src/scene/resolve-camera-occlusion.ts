import type { Vector3 } from "three";
import type { ArenaCollisionData } from "../simulation/types";

export interface CameraOcclusionResult {
  distance: number;
  occluderId: string | null;
}

const entryTime = (
  start: Readonly<Vector3>,
  end: Readonly<Vector3>,
  box: ArenaCollisionData,
) => {
  let entry = 0;
  let exit = 1;
  for (const [origin, delta, min, max] of [
    [start.x, end.x - start.x, box.x - box.halfWidth, box.x + box.halfWidth],
    [start.y, end.y - start.y, box.y, box.y + box.height],
    [start.z, end.z - start.z, box.z - box.halfDepth, box.z + box.halfDepth],
  ] as const) {
    if (Math.abs(delta) < 1e-9) {
      if (origin < min || origin > max) return null;
      continue;
    }
    const first = (min - origin) / delta;
    const second = (max - origin) / delta;
    entry = Math.max(entry, Math.min(first, second));
    exit = Math.min(exit, Math.max(first, second));
    if (entry > exit) return null;
  }
  return entry > 1e-5 && entry <= 1 && exit >= 0 ? entry : null;
};

export function resolveCameraOcclusion(
  target: Readonly<Vector3>,
  desiredPosition: Readonly<Vector3>,
  collisions: readonly ArenaCollisionData[],
  gateOpen: boolean,
): CameraOcclusionResult {
  const desiredDistance = target.distanceTo(desiredPosition);
  let nearest = 1;
  let occluderId: string | null = null;
  for (const collision of collisions) {
    if (collision.kind === "gate" && gateOpen) continue;
    const entry = entryTime(target, desiredPosition, collision);
    if (entry !== null && entry < nearest) {
      nearest = entry;
      occluderId = collision.id;
    }
  }
  return {
    distance:
      occluderId === null
        ? desiredDistance
        : Math.max(0, desiredDistance * nearest - 0.3),
    occluderId,
  };
}
