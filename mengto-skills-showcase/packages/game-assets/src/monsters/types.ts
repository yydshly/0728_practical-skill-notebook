import type { AssetManifest } from "@showcase/content-schema";

export const MONSTER_ACTION_DURATIONS = Object.freeze({
  Idle: 2,
  Walk: 1,
  Attack: 0.8,
  Hit: 0.45,
  Death: 1.4,
});

export type MonsterActionName = keyof typeof MONSTER_ACTION_DURATIONS;
export type MonsterDeliveryStatus = "declared-not-shipped" | "shipped";

export interface MonsterDefinition extends AssetManifest {
  readonly kind: "monster";
  readonly deliveryStatus: MonsterDeliveryStatus;
  readonly factoryId: "biped" | "crawler" | "armored" | "quadruped";
  readonly actions: readonly MonsterActionName[];
  readonly collider: Readonly<{ radius: number; height: number }>;
  readonly palette: Readonly<{ primary: number; secondary: number; emissive: number }>;
  readonly review: Readonly<{ contactPoints: readonly string[]; notes: string }>;
}

export interface InspectorState {
  readonly selectedId: string;
  readonly action: MonsterActionName;
  /** Increments whenever the reviewer asks to replay the current action. */
  readonly actionRevision: number;
  readonly actionEvent: "selected" | "restarted";
  readonly paused: boolean;
  readonly overlays: Readonly<{ skeleton: boolean; colliders: boolean; sockets: boolean }>;
}

export type InspectorOverlayName = keyof InspectorState["overlays"];
