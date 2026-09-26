import "server-only";
import { createCatalogueClient } from "@/lib/supabase/server";
import { readSupabaseConfiguration } from "@/config/supabase";
import { loadCatalogueWithFallback } from "./charging-data";
import { createSupabaseDataProvider } from "./supabase/charging-data";
import { configuredChargingProvider } from "./charging/factory.server";
import { locationsWithFallback } from "./charging/service";
import { DEFAULT_CHARGING_BOUNDS } from "./charging/provider";
import { presentChargingSites } from "./charging/presentation";
import { demoDataProvider } from "./charging-data";
import type { ChargingCatalogue } from "../domain/catalogue";
import type { DataProvenance } from "../domain/charging-data";

async function getDemoCatalogue() {
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

function markDemo(
  catalogue: ChargingCatalogue,
  reason?: "missing_configuration" | "provider_unavailable",
): ChargingCatalogue {
  const provenance: DataProvenance = {
    source: catalogue.source,
    kind: "demo",
    observedAt: null,
    fetchedAt: new Date().toISOString(),
    staleAfterSeconds: 86400,
    attribution: {
      name: "ChargeOnce development data",
      url: null,
      licence: null,
    },
  };
  return {
    ...catalogue,
    chargers: catalogue.chargers.map((charger) => ({
      ...charger,
      isDemo: true,
      provenance,
      availabilityProvenance: provenance,
      tariffProvenance: provenance,
    })),
    chargingData: {
      provider: "mock",
      mayBeTruncated: false,
      fallbackReason: reason,
    },
  };
}

export async function getChargingCatalogue(): Promise<ChargingCatalogue> {
  let provider;
  try {
    provider = configuredChargingProvider();
  } catch {
    return markDemo(await getDemoCatalogue(), "provider_unavailable");
  }
  if (!provider || provider.id === "mock")
    return markDemo(
      provider
        ? await demoDataProvider.loadCatalogue()
        : await getDemoCatalogue(),
      provider ? undefined : "missing_configuration",
    );
  // Only the displayed Marlow region is queried. Reads never invoke ingestion.
  const batch = await locationsWithFallback(provider, DEFAULT_CHARGING_BOUNDS);
  if (batch.fallbackReason)
    return markDemo(await getDemoCatalogue(), batch.fallbackReason);
  return {
    vehicles: (await demoDataProvider.loadCatalogue()).vehicles,
    chargers: presentChargingSites(batch.locations, DEFAULT_CHARGING_BOUNDS),
    source: provider.id === "database" ? "database" : "external",
    chargingData: {
      provider: provider.id,
      mayBeTruncated: batch.mayBeTruncated,
    },
  };
}
