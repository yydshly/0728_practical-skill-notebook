export type AssetKind = "monster" | "character" | "weapon" | "mech" | "module";
export type SourceType = "imported" | "procedural" | "reconstruction";

export interface AnimationClipRef {
  name: string;
  durationSeconds: number;
}

export interface SocketRef {
  name: string;
  bone: string;
}

export interface MeasuredBounds {
  width: number;
  height: number;
  depth: number;
  groundOffset: number;
}

export interface AssetManifest {
  id: string;
  kind: AssetKind;
  displayName: string;
  previewPath: string;
  modelPath?: string;
  source: { type: SourceType; description: string; license?: string };
  readonly animations: readonly AnimationClipRef[];
  readonly sockets: readonly SocketRef[];
  readonly bounds: Readonly<MeasuredBounds>;
}

const assetKinds: readonly AssetKind[] = ["monster", "character", "weapon", "mech", "module"];
const sourceTypes: readonly SourceType[] = ["imported", "procedural", "reconstruction"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const requireText = (value: unknown, field: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(field);
  return value;
};

const requireNumber = (value: unknown, field: string, minimum?: number): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || (minimum !== undefined && value < minimum)) {
    throw new Error(field);
  }
  return value;
};

const parseAnimation = (value: unknown, index: number): AnimationClipRef => {
  if (!isRecord(value)) throw new Error(`animations[${index}]`);
  return {
    name: requireText(value.name, `animations[${index}].name`),
    durationSeconds: requireNumber(value.durationSeconds, `animations[${index}].durationSeconds`, 0),
  };
};

const parseSocket = (value: unknown, index: number): SocketRef => {
  if (!isRecord(value)) throw new Error(`sockets[${index}]`);
  return {
    name: requireText(value.name, `sockets[${index}].name`),
    bone: requireText(value.bone, `sockets[${index}].bone`),
  };
};

export function parseAssetManifest(value: unknown): AssetManifest {
  if (!isRecord(value)) throw new Error("asset manifest");

  const kind = requireText(value.kind, "kind");
  if (!assetKinds.includes(kind as AssetKind)) throw new Error("kind");

  if (!isRecord(value.source)) throw new Error("source");
  const sourceType = requireText(value.source.type, "source.type");
  if (!sourceTypes.includes(sourceType as SourceType)) throw new Error("source.type");

  if (!Array.isArray(value.animations)) throw new Error("animations");
  if (!Array.isArray(value.sockets)) throw new Error("sockets");
  if (!isRecord(value.bounds)) throw new Error("bounds");

  const asset: AssetManifest = {
    id: requireText(value.id, "id"),
    kind: kind as AssetKind,
    displayName: requireText(value.displayName, "displayName"),
    previewPath: requireText(value.previewPath, "previewPath"),
    source: {
      type: sourceType as SourceType,
      description: requireText(value.source.description, "source.description"),
    },
    animations: value.animations.map(parseAnimation),
    sockets: value.sockets.map(parseSocket),
    bounds: {
      width: requireNumber(value.bounds.width, "bounds.width", Number.EPSILON),
      height: requireNumber(value.bounds.height, "bounds.height", Number.EPSILON),
      depth: requireNumber(value.bounds.depth, "bounds.depth", Number.EPSILON),
      groundOffset: requireNumber(value.bounds.groundOffset, "bounds.groundOffset"),
    },
  };

  if (value.modelPath !== undefined) asset.modelPath = requireText(value.modelPath, "modelPath");
  if (value.source.license !== undefined) asset.source.license = requireText(value.source.license, "source.license");

  return asset;
}
