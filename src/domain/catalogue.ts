import type { Charger, Vehicle } from "./types";

export type CatalogueSource = "seeded" | "supabase-demo";
export type FallbackReason =
  | "missing_configuration"
  | "invalid_configuration"
  | "database_unavailable"
  | "empty_catalogue";
export interface ChargingCatalogue {
  vehicles: Vehicle[];
  chargers: Charger[];
  source: CatalogueSource;
  fallbackReason?: FallbackReason;
}
