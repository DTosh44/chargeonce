import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/supabase/database.types";
import type { ChargingCatalogue } from "../../domain/catalogue";
import type { ChargingCatalogueProvider } from "../charging-data";
import { projectDemoCatalogue } from "./catalogue";

export function createSupabaseDataProvider(
  client: SupabaseClient<Database>,
): ChargingCatalogueProvider {
  let pending: Promise<ChargingCatalogue> | undefined;
  async function load(): Promise<ChargingCatalogue> {
    const signal = AbortSignal.timeout(5000);
    const [vehicles, locations, operators] = await Promise.all([
      client
        .from("vehicles")
        .select("*")
        .eq("is_demo", true)
        .order("id")
        .abortSignal(signal),
      client
        .from("charging_locations")
        .select("*")
        .eq("is_demo", true)
        .order("external_id")
        .abortSignal(signal),
      client.from("operators").select("*").abortSignal(signal),
    ]);
    if (vehicles.error || locations.error || operators.error)
      throw new Error("Catalogue query failed");
    const locationIds = (locations.data ?? []).map((location) => location.id);
    if (!locationIds.length)
      return { vehicles: [], chargers: [], source: "supabase-demo" };
    const [evses, tariffs] = await Promise.all([
      client
        .from("evses")
        .select("*")
        .in("location_id", locationIds)
        .abortSignal(signal),
      client
        .from("tariffs")
        .select("*")
        .in("location_id", locationIds)
        .eq("is_demo", true)
        .abortSignal(signal),
    ]);
    if (evses.error || tariffs.error) throw new Error("Charger query failed");
    const evseIds = (evses.data ?? []).map((evse) => evse.id);
    const connectors = evseIds.length
      ? await client
          .from("connectors")
          .select("*")
          .in("evse_id", evseIds)
          .abortSignal(signal)
      : { data: [], error: null };
    if (connectors.error) throw new Error("Connector query failed");
    return {
      ...projectDemoCatalogue({
        vehicles: vehicles.data ?? [],
        locations: locations.data ?? [],
        operators: operators.data ?? [],
        evses: evses.data ?? [],
        tariffs: tariffs.data ?? [],
        connectors: connectors.data ?? [],
      }),
      source: "supabase-demo",
    };
  }
  const loadCatalogue = () => (pending ??= load());
  return {
    loadCatalogue,
    async listChargers() {
      return (await loadCatalogue()).chargers;
    },
    async listVehicles() {
      return (await loadCatalogue()).vehicles;
    },
  };
}
