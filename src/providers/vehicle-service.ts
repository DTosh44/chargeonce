import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { VehicleModel } from "@/domain/models";
import type { VehicleService } from "@/domain/vehicles";
import { vehicles } from "@/data/demo";
import { createUserDataRepository } from "@/providers/supabase/user-data";
import { mapVehicle } from "@/providers/supabase/mappers";

export const seededVehicleModels: VehicleModel[] = vehicles.map((vehicle) => ({
  id: vehicle.id,
  manufacturer: vehicle.make,
  model: vehicle.model,
  variant: vehicle.trim.split(" · ")[0],
  modelYear: Number(vehicle.trim.split(" · ")[1]) || null,
  usableBatteryKwh: vehicle.batteryKwh,
  grossBatteryKwh: null,
  maxAcKw: vehicle.maxAcKw,
  maxDcKw: vehicle.maxDcKw,
  connectorTypes: vehicle.connectors,
  efficiencyMilesPerKwh:
    vehicle.efficiencyMilesPerKwh ??
    vehicle.estimatedRangeMiles / vehicle.batteryKwh,
  estimatedRangeMiles: vehicle.estimatedRangeMiles,
  chargingCurve: vehicle.chargingCurve ?? [],
  source: "chargeonce_demo",
  isDemo: true,
  createdAt: "2026-09-26T00:00:00Z",
  updatedAt: "2026-09-26T00:00:00Z",
}));

export function createVehicleService(
  client: SupabaseClient<Database> | null,
): VehicleService {
  return {
    async listCatalogue() {
      if (client) {
        try {
          const { data, error } = await client
            .from("vehicles")
            .select("*")
            .order("manufacturer")
            .order("model")
            .order("variant")
            .abortSignal(AbortSignal.timeout(8000));
          if (!error && data?.length)
            return { vehicles: data.map(mapVehicle), source: "database" };
        } catch {
          /* Public catalogue is safe to fall back to illustrative seed records. */
        }
      }
      return { vehicles: seededVehicleModels, source: "seeded" };
    },
    async listGarage() {
      // Never fabricate private records, even if a public catalogue can fall back.
      const saved = await createUserDataRepository(client).listVehicles();
      if (!saved.length) return [];
      if (!client) throw new Error("Garage unavailable");
      const { data, error } = await client
        .from("vehicles")
        .select("*")
        .in("id", [...new Set(saved.map((car) => car.vehicleId))]);
      if (error || !data)
        throw new Error("Garage specifications could not be loaded");
      const models = data.map(mapVehicle);
      return saved.map((car) => {
        const specification = models.find(
          (model) => model.id === car.vehicleId,
        );
        if (!specification)
          throw new Error("A saved car's specification is unavailable");
        return { saved: car, specification };
      });
    },
  };
}
