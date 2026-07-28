import type { VesperKnight } from "@showcase/game-assets";
import type { GameState } from "../simulation/types";

export interface EntitySynchronizer {
  sync(state: Readonly<GameState>): void;
  dispose(): void;
}

export function syncEntities(
  knight: VesperKnight,
  state: Readonly<GameState>,
): void {
  knight.root.position.set(
    state.player.position.x,
    0,
    state.player.position.y,
  );
  knight.root.rotation.y = state.player.facingRadians;
  knight.equipWeapon(state.player.weaponId);
  knight.update(state.player.action, state.player.actionTime);
}

export function createEntitySynchronizer(
  knight: VesperKnight,
): EntitySynchronizer {
  let disposed = false;
  return {
    sync(state) {
      if (disposed) throw new Error("Entity synchronizer is disposed");
      syncEntities(knight, state);
    },
    dispose() {
      disposed = true;
    },
  };
}
