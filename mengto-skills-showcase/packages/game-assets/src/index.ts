import type { AssetKind, AssetManifest } from "@showcase/content-schema";

export { monsters } from "./monsters/definitions";
export { createProceduralMonster } from "./monsters/create-procedural-monster";
export { MONSTER_ACTION_DURATIONS } from "./monsters/types";
export type {
  InspectorOverlayName,
  InspectorState,
  MonsterActionName,
  MonsterDeliveryStatus,
  MonsterDefinition,
} from "./monsters/types";
export type {
  MonsterActionState,
  MonsterCollider,
  MonsterGroundContact,
  MonsterInstance,
} from "./monsters/create-procedural-monster";

export class AssetRegistry {
  constructor(private readonly assets: readonly AssetManifest[]) {}

  get(id: string): AssetManifest {
    const asset = this.assets.find((item) => item.id === id);
    if (!asset) throw new Error(`Unknown asset: ${id}`);
    return asset;
  }

  list(kind: AssetKind): AssetManifest[] {
    return this.assets.filter((asset) => asset.kind === kind);
  }
}
