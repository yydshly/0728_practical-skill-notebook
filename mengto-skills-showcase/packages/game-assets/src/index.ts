import type { AssetKind, AssetManifest } from "@showcase/content-schema";

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
