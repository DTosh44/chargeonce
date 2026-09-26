import type { UserVehicle, VehicleModel } from "./models";
import type { Vehicle } from "./types";

export interface VehicleCatalogue {
  vehicles: VehicleModel[];
  source: "database" | "seeded";
}
/** Swap the catalogue adapter for an imported dataset without changing garage UI. */
export interface VehicleService {
  listCatalogue(): Promise<VehicleCatalogue>;
  listGarage(): Promise<GarageCar[]>;
}
export interface GarageCar {
  saved: UserVehicle;
  specification: VehicleModel;
}
export interface GarageState {
  cars: GarageCar[];
  error: string | null;
}

export function toCalculationVehicle(
  spec: VehicleModel,
  override?: number | null,
): Vehicle {
  const efficiency = override ?? spec.efficiencyMilesPerKwh;
  return {
    id: spec.id,
    make: spec.manufacturer,
    model: spec.model,
    trim: `${spec.variant}${spec.modelYear ? ` · ${spec.modelYear}` : ""}`,
    batteryKwh: spec.usableBatteryKwh,
    maxAcKw: spec.maxAcKw,
    maxDcKw: spec.maxDcKw,
    connectors: spec.connectorTypes,
    imageTone: "blue",
    isDemo: spec.isDemo,
    efficiencyMilesPerKwh: efficiency,
    estimatedRangeMiles:
      override == null
        ? spec.estimatedRangeMiles
        : Math.round(spec.usableBatteryKwh * efficiency * 10) / 10,
  };
}

export function parseCarDetails(form: FormData): {
  nickname: string | null;
  efficiencyOverride: number | null;
} {
  const nickname = String(form.get("nickname") ?? "").trim();
  const input = String(form.get("efficiency") ?? "").trim();
  const efficiencyOverride = input ? Number(input) : null;
  if (nickname.length > 100)
    throw new Error("Keep the nickname to 100 characters or fewer.");
  if (
    efficiencyOverride !== null &&
    (!Number.isFinite(efficiencyOverride) ||
      efficiencyOverride < 0.5 ||
      efficiencyOverride > 10)
  )
    throw new Error(
      "Enter an efficiency between 0.5 and 10 miles/kWh, or leave it blank.",
    );
  return { nickname: nickname || null, efficiencyOverride };
}

export function isUUID(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}
