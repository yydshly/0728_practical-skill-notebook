import type { MechAssembly } from "@showcase/game-assets";
import { MathUtils, Vector3, type Group } from "three";

export interface ExplodedViewOptions {
  readonly reducedMotion?: boolean;
}

export interface ExplodedViewSnapshot {
  readonly target: "assembled" | "exploded";
  readonly progress: number;
  readonly maxDisplacement: number;
  readonly parts: Record<string, [number, number, number]>;
}

export interface ExplodedViewController {
  setExploded(exploded: boolean): void;
  setReducedMotion(reducedMotion: boolean): void;
  rebind(): void;
  update(deltaSeconds: number): void;
  snapshot(): ExplodedViewSnapshot;
  dispose(): void;
}

export function createExplodedView(
  assembly: MechAssembly,
  options: ExplodedViewOptions = {},
): ExplodedViewController {
  const offsets = {
    head: new Vector3(0, 1.25, 0),
    armor: new Vector3(0, 0, 1.1),
    leftWeapon: new Vector3(-1.4, 0, 0),
    rightWeapon: new Vector3(1.4, 0, 0),
    rearModule: new Vector3(0, 0, -1.3),
  } as const;
  type ModuleSlot = keyof typeof offsets;
  interface Binding {
    readonly part: Group;
    readonly base: Vector3;
  }

  const bindings = new Map<ModuleSlot, Binding>();
  let reducedMotion = options.reducedMotion ?? false;
  let target = 0;
  let progress = 0;
  let disposed = false;
  const durationSeconds = 0.36;

  function apply(): void {
    for (const [slot, binding] of bindings) {
      binding.part.position
        .copy(binding.base)
        .addScaledVector(offsets[slot], progress);
    }
  }

  function rebind(): void {
    if (disposed) return;
    for (const slot of Object.keys(offsets) as ModuleSlot[]) {
      const part = assembly.parts.get(slot);
      if (!part) continue;
      const existing = bindings.get(slot);
      if (existing?.part === part) continue;
      bindings.set(slot, {
        part,
        base: part.position.clone(),
      });
    }
    apply();
  }

  rebind();

  return {
    setExploded(exploded) {
      if (disposed) return;
      target = exploded ? 1 : 0;
      if (reducedMotion) {
        progress = target;
        apply();
      }
    },
    setReducedMotion(next) {
      if (disposed) return;
      reducedMotion = next;
      if (reducedMotion) {
        progress = target;
        apply();
      }
    },
    rebind,
    update(deltaSeconds) {
      if (disposed || progress === target) return;
      const safeDelta =
        Number.isFinite(deltaSeconds) && deltaSeconds > 0
          ? deltaSeconds
          : 0;
      const direction = Math.sign(target - progress);
      progress = MathUtils.clamp(
        progress + direction * (safeDelta / durationSeconds),
        0,
        1,
      );
      if (
        (direction > 0 && progress > target) ||
        (direction < 0 && progress < target)
      ) {
        progress = target;
      }
      apply();
    },
    snapshot() {
      const parts = Object.fromEntries(
        [...bindings].map(([slot, binding]) => [
          slot,
          binding.part.position.clone().sub(binding.base).toArray(),
        ]),
      ) as Record<string, [number, number, number]>;
      const maxDisplacement = Math.max(
        0,
        ...Object.values(parts).map(([x, y, z]) => Math.hypot(x, y, z)),
      );
      return {
        target: target === 1 ? "exploded" : "assembled",
        progress,
        maxDisplacement,
        parts,
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      bindings.clear();
    },
  };
}
