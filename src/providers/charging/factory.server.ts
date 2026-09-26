import "server-only";
import { createCatalogueClient } from "../../lib/supabase/server";
import type { ChargingDataProvider } from "./provider";
import { ChargingProviderError } from "./provider";
import { MockChargingProvider } from "./mock";
import { OpenChargeMapProvider } from "./open-charge-map/provider.server";
import { StoredChargingProvider } from "./database.server";

let external: { key: string; provider: OpenChargeMapProvider } | undefined;
export function externalChargingProvider(): OpenChargeMapProvider | null {
  const key = process.env.OPEN_CHARGE_MAP_API_KEY?.trim();
  if (!key) return null;
  if (!external || external.key !== key)
    external = { key, provider: new OpenChargeMapProvider(key) };
  return external.provider;
}
export function configuredChargingProvider(): ChargingDataProvider | null {
  const mode = process.env.CHARGING_DATA_PROVIDER?.trim() || "auto";
  if (mode === "mock") return new MockChargingProvider();
  if (mode === "database") {
    const client = createCatalogueClient();
    return client ? new StoredChargingProvider(client) : null;
  }
  if (mode !== "auto" && mode !== "openchargemap")
    throw new ChargingProviderError("not_configured");
  return externalChargingProvider();
}
