import { chargers, vehicles } from "../data/demo";
import type { Charger, Vehicle } from "../domain/types";
import type { ChargingCatalogue, FallbackReason } from "../domain/catalogue";

export interface ChargingDataProvider {
  loadCatalogue(): Promise<ChargingCatalogue>;
  listChargers(): Promise<Charger[]>;
  listVehicles(): Promise<Vehicle[]>;
}

/** Replace this boundary with a licensed live source when integrations are ready. */
export const demoDataProvider: ChargingDataProvider = {
  async loadCatalogue() {
    return { chargers, vehicles, source: "seeded" };
  },
  async listChargers() {
    return chargers;
  },
  async listVehicles() {
    return vehicles;
  },
};

/** Fallback is only for public demo data. Never fake successful private writes. */
export async function loadCatalogueWithFallback(
  loader: (() => Promise<ChargingCatalogue>) | null,
  reason: FallbackReason = "missing_configuration",
): Promise<ChargingCatalogue> {
  if (loader) {
    try {
      const catalogue = await loader();
      if (catalogue.vehicles.length && catalogue.chargers.length)
        return catalogue;
      reason = "empty_catalogue";
    } catch {
      reason = "database_unavailable";
    }
  }
  return {
    ...(await demoDataProvider.loadCatalogue()),
    fallbackReason: reason,
  };
}
