import type { AssetManifest } from "@showcase/content-schema";

export type MonsterActionName = "Idle" | "Walk" | "Attack" | "Hit" | "Death";

export interface MonsterDefinition extends AssetManifest {
  readonly kind: "monster";
  readonly factoryId: "biped" | "crawler" | "armored" | "quadruped";
  readonly actions: readonly MonsterActionName[];
  readonly collider: Readonly<{ radius: number; height: number }>;
  readonly palette: Readonly<{ primary: number; secondary: number; emissive: number }>;
  readonly review: Readonly<{ contactPoints: readonly string[]; notes: string }>;
}

export interface InspectorState {
  readonly selectedId: string;
  readonly action: MonsterActionName;
  readonly paused: boolean;
  readonly overlays: Readonly<{ skeleton: boolean; colliders: boolean; sockets: boolean }>;
}

export type InspectorOverlayName = keyof InspectorState["overlays"];
