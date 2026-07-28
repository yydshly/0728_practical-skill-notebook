export type ChassisId =
  | "strider-scout"
  | "bastion-hauler"
  | "oracle-frame";

export type HeadId = "surveyor-head" | "bulwark-head" | "halo-head";

export type ArmorId =
  | "ceramic-shell"
  | "reactive-bastion"
  | "void-weave";

export type LeftWeaponId = "arc-blade" | "aegis-shield" | "drone-rack";

export type RightWeaponId = "arc-blade" | "rail-lance" | "drone-rack";

export type RearModuleId = "jump-pack" | "siege-reactor" | "field-relay";

export type FinishEnvironment = "foundry" | "hangar" | "dusk";
export type FinishMetalness = 0 | 0.5 | 1;
export type FinishRoughness = 0.2 | 0.6 | 1;

export interface MechFinish {
  primary: string;
  secondary: string;
  metalness: FinishMetalness;
  roughness: FinishRoughness;
  environment: FinishEnvironment;
}

export interface MechConfiguration {
  version: 1;
  chassisId: ChassisId;
  headId: HeadId;
  armorId: ArmorId;
  leftWeaponId: LeftWeaponId;
  rightWeaponId: RightWeaponId;
  rearModuleId: RearModuleId;
  finish: MechFinish;
}

export type PartSlot =
  | "head"
  | "armor"
  | "leftWeapon"
  | "rightWeapon"
  | "rearModule";

export interface CatalogStatistics {
  priceCredits: number;
  weight: number;
  power: number;
  guard: number;
  mobility: number;
}

export interface ChassisDefinition extends CatalogStatistics {
  id: ChassisId;
  name: string;
  weightLimit: number;
}

export type PartId =
  | HeadId
  | ArmorId
  | LeftWeaponId
  | RightWeaponId
  | RearModuleId;

export interface PartDefinition extends CatalogStatistics {
  id: PartId;
  name: string;
  slots: readonly PartSlot[];
  incompatibleChassisIds?: readonly ChassisId[];
}

export interface Catalog {
  chassis: readonly ChassisDefinition[];
  heads: readonly PartDefinition[];
  armors: readonly PartDefinition[];
  weapons: readonly PartDefinition[];
  rearModules: readonly PartDefinition[];
}

export type ValidationField =
  | "version"
  | "chassisId"
  | "headId"
  | "armorId"
  | "leftWeaponId"
  | "rightWeaponId"
  | "rearModuleId"
  | "finish.primary"
  | "finish.secondary"
  | "finish.metalness"
  | "finish.roughness"
  | "finish.environment"
  | "weight";

export type ValidationIssueCode =
  | "unsupported-version"
  | "unknown-option"
  | "slot-incompatible"
  | "chassis-incompatible"
  | "invalid-finish"
  | "weight-limit";

export interface ValidationIssue {
  field: ValidationField;
  code: ValidationIssueCode;
  value: unknown;
}

export type ValidationResult =
  | { ok: true; issues: [] }
  | { ok: false; issues: ValidationIssue[] };

export interface NormalizationResult {
  config: MechConfiguration;
  issues: ValidationIssue[];
}

export interface MechSummary {
  priceCredits: number;
  weight: number;
  power: number;
  guard: number;
  mobility: number;
}
