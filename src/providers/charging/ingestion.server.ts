import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "../../lib/supabase/database.types";
import type { ChargingImportRepository } from "./ingestion";
import { readSupabaseConfiguration } from "../../config/supabase";
import { ChargingProviderError } from "./provider";

/** Admin credentials exist ONLY in this isolated ingestion path, never browser/session clients. */
export function chargingImportRepository(): ChargingImportRepository {
  const configuration = readSupabaseConfiguration(process.env);
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (configuration.status !== "configured" || !key)
    throw new ChargingProviderError("not_configured");
  const client = createClient<Database>(configuration.url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    db: { timeout: 15000, retry: false },
  });
  return {
    async importSites(provider, sites) {
      const { data, error } = await client
        .rpc("import_charging_sites", {
          p_provider: provider,
          p_sites: JSON.parse(JSON.stringify(sites)) as Json,
        })
        .abortSignal(AbortSignal.timeout(15000));
      if (error || typeof data !== "number")
        throw new ChargingProviderError("unavailable");
      return data;
    },
  };
}
