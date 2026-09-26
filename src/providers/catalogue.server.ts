import "server-only";
import { createCatalogueClient } from "@/lib/supabase/server";
import { readSupabaseConfiguration } from "@/config/supabase";
import { loadCatalogueWithFallback } from "./charging-data";
import { createSupabaseDataProvider } from "./supabase/charging-data";

export async function getChargingCatalogue() {
  const configuration = readSupabaseConfiguration(process.env);
  if (configuration.status !== "configured")
    return loadCatalogueWithFallback(
      null,
      configuration.status === "invalid"
        ? "invalid_configuration"
        : "missing_configuration",
    );
  return loadCatalogueWithFallback(async () => {
    const client = createCatalogueClient();
    if (!client) throw new Error("Supabase is unavailable");
    return createSupabaseDataProvider(client).loadCatalogue();
  });
}
