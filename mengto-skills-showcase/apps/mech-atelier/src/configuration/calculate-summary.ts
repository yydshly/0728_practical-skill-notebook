import type {
  Catalog,
  CatalogStatistics,
  ChassisDefinition,
  MechConfiguration,
  MechSummary,
  PartDefinition,
} from "./types";

function findRequired<T extends ChassisDefinition | PartDefinition>(
  values: readonly T[],
  id: string,
): T {
  const value = values.find((candidate) => candidate.id === id);
  if (!value) {
    throw new Error(`Catalog entry not found: ${id}`);
  }
  return value;
}

export function calculateSummary(
  config: MechConfiguration,
  catalog: Catalog,
): MechSummary {
  const selected: readonly CatalogStatistics[] = [
    findRequired(catalog.chassis, config.chassisId),
    findRequired(catalog.heads, config.headId),
    findRequired(catalog.armors, config.armorId),
    findRequired(catalog.weapons, config.leftWeaponId),
    findRequired(catalog.weapons, config.rightWeaponId),
    findRequired(catalog.rearModules, config.rearModuleId),
  ];

  return selected.reduce<MechSummary>(
    (summary, item) => ({
      priceCredits: summary.priceCredits + item.priceCredits,
      weight: summary.weight + item.weight,
      power: summary.power + item.power,
      guard: summary.guard + item.guard,
      mobility: summary.mobility + item.mobility,
    }),
    {
      priceCredits: 0,
      weight: 0,
      power: 0,
      guard: 0,
      mobility: 0,
    },
  );
}
