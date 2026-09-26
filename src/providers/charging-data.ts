import { chargers, vehicles } from "@/data/demo";
import type { Charger, Vehicle } from "@/domain/types";

export interface ChargingDataProvider {
  listChargers(): Promise<Charger[]>;
  listVehicles(): Promise<Vehicle[]>;
}

/** Replace this boundary with a licensed live source when integrations are ready. */
export const demoDataProvider: ChargingDataProvider = {
  async listChargers() {
    return chargers;
  },
  async listVehicles() {
    return vehicles;
  },
};
