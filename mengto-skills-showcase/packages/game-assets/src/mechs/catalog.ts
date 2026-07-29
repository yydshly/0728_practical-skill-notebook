import type {
  MechArmorId,
  MechChassisId,
  MechFinish,
  MechHeadId,
  MechLeftWeaponId,
  MechRearModuleId,
  MechRightWeaponId,
} from "./types";

const chassis = Object.freeze([
  "strider-scout",
  "bastion-hauler",
  "oracle-frame",
] as const satisfies readonly MechChassisId[]);
const head = Object.freeze([
  "surveyor-head",
  "bulwark-head",
  "halo-head",
] as const satisfies readonly MechHeadId[]);
const armor = Object.freeze([
  "ceramic-shell",
  "reactive-bastion",
  "void-weave",
] as const satisfies readonly MechArmorId[]);
const leftWeapon = Object.freeze([
  "arc-blade",
  "aegis-shield",
  "drone-rack",
] as const satisfies readonly MechLeftWeaponId[]);
const rightWeapon = Object.freeze([
  "arc-blade",
  "rail-lance",
  "drone-rack",
] as const satisfies readonly MechRightWeaponId[]);
const rearModule = Object.freeze([
  "jump-pack",
  "siege-reactor",
  "field-relay",
] as const satisfies readonly MechRearModuleId[]);

/**
 * Renderer-facing identifiers only. Business facts such as weight, price,
 * compatibility, persistence, and URLs remain owned by the product catalog.
 */
export const MECH_VISUAL_CATALOG = Object.freeze({
  chassis,
  head,
  armor,
  leftWeapon,
  rightWeapon,
  rearModule,
});

export const defaultMechFinish: Readonly<MechFinish> = Object.freeze({
  primary: "#7a2f24",
  secondary: "#d8b36a",
  metalness: 0.5,
  roughness: 0.6,
});
