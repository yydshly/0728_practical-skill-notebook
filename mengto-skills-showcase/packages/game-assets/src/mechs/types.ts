import type { Group, Object3D } from "three";

export type MechChassisId =
  | "strider-scout"
  | "bastion-hauler"
  | "oracle-frame";
export type MechHeadId =
  | "surveyor-head"
  | "bulwark-head"
  | "halo-head";
export type MechArmorId =
  | "ceramic-shell"
  | "reactive-bastion"
  | "void-weave";
export type MechLeftWeaponId =
  | "arc-blade"
  | "aegis-shield"
  | "drone-rack";
export type MechRightWeaponId =
  | "arc-blade"
  | "rail-lance"
  | "drone-rack";
export type MechRearModuleId =
  | "jump-pack"
  | "siege-reactor"
  | "field-relay";

export type MechPartSlot =
  | "chassis"
  | "head"
  | "armor"
  | "leftWeapon"
  | "rightWeapon"
  | "rearModule";
export type MechModuleSlot = Exclude<MechPartSlot, "chassis">;
export type MechEnvironment = "foundry" | "hangar" | "dusk";

export interface MechFinish {
  readonly primary: string;
  readonly secondary: string;
  readonly metalness: 0 | 0.5 | 1;
  readonly roughness: 0.2 | 0.6 | 1;
}

export type MechFinishUpdate = MechFinish & {
  readonly environment?: MechEnvironment;
};

export interface MechVisualConfiguration {
  readonly chassisId: MechChassisId;
  readonly headId: MechHeadId;
  readonly armorId: MechArmorId;
  readonly leftWeaponId: MechLeftWeaponId;
  readonly rightWeaponId: MechRightWeaponId;
  readonly rearModuleId: MechRearModuleId;
  readonly finish: MechFinish;
}

export interface MechEnvironmentRequest {
  readonly type: "environment-change";
  readonly environment: MechEnvironment;
}

export interface MechAssembly {
  readonly root: Group;
  readonly parts: ReadonlyMap<MechPartSlot, Group>;
  readonly sockets: ReadonlyMap<MechModuleSlot, Object3D>;
  readonly hotspots: ReadonlyMap<MechModuleSlot, Object3D>;
  applyFinish(finish: MechFinishUpdate): MechEnvironmentRequest | null;
  updateConfiguration(next: MechVisualConfiguration): void;
  dispose(): void;
  isDisposed(): boolean;
}
