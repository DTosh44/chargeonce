import type { Charger, Vehicle } from "./types";

export type CatalogueSource =
  "seeded" | "supabase-demo" | "external" | "database";
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
  chargingData?: {
    provider: string;
    mayBeTruncated: boolean;
    fallbackReason?: "missing_configuration" | "provider_unavailable";
  };
}
