import type { ArenaCollisionData, GameContent, Vec2 } from "./types";

const intersects = (
  point: Vec2,
  radius: number,
  box: ArenaCollisionData,
) =>
  Math.abs(point.x - box.x) < box.halfWidth + radius &&
  Math.abs(point.y - box.z) < box.halfDepth + radius;

const crosses = (
  start: Vec2,
  target: Vec2,
  radius: number,
  box: ArenaCollisionData,
) => {
  const minX = box.x - box.halfWidth - radius;
  const maxX = box.x + box.halfWidth + radius;
  const minY = box.z - box.halfDepth - radius;
  const maxY = box.z + box.halfDepth + radius;
  const deltaX = target.x - start.x;
  const deltaY = target.y - start.y;
  let entry = 0;
  let exit = 1;
  for (const [origin, delta, min, max] of [
    [start.x, deltaX, minX, maxX],
    [start.y, deltaY, minY, maxY],
  ] as const) {
    if (Math.abs(delta) < 1e-9) {
      if (origin < min || origin > max) return false;
      continue;
    }
    const first = (min - origin) / delta;
    const second = (max - origin) / delta;
    entry = Math.max(entry, Math.min(first, second));
    exit = Math.min(exit, Math.max(first, second));
    if (entry > exit) return false;
  }
  return entry <= 1 && exit >= 0;
};

const isSolid = (collision: ArenaCollisionData, gateOpen: boolean) =>
  collision.kind === "interior" ||
  collision.kind === "portal-wall" ||
  (collision.kind === "gate" && !gateOpen);

export function resolveArenaMovement(
  start: Vec2,
  target: Vec2,
  actorRadius: number,
  gateOpen: boolean,
  arena: GameContent["arena"],
): Vec2 {
  const bounded = {
    x: Math.max(
      arena.min.x + actorRadius,
      Math.min(arena.max.x - actorRadius, target.x),
    ),
    y: Math.max(
      arena.min.y + actorRadius,
      Math.min(arena.max.y - actorRadius, target.y),
    ),
  };
  const solids = arena.collisions.filter((collision) =>
    isSolid(collision, gateOpen),
  );
  const blocked = (candidate: Vec2) =>
    solids.some(
      (box) =>
        intersects(candidate, actorRadius, box) ||
        crosses(start, candidate, actorRadius, box),
    );

  if (!blocked(bounded)) return bounded;
  const xOnly = { x: bounded.x, y: start.y };
  if (!blocked(xOnly)) return xOnly;
  const yOnly = { x: start.x, y: bounded.y };
  if (!blocked(yOnly)) return yOnly;
  return { ...start };
}
