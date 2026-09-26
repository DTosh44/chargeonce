import { describe, expect, it } from "vitest";
import { demoDataProvider, loadCatalogueWithFallback } from "./charging-data";
import { createUserDataRepository } from "./supabase/user-data";
import { PersistenceUnavailableError } from "../domain/user-data";
import { readSupabaseConfiguration } from "../config/supabase";

describe("optional persistence", () => {
  it("uses explicitly demo-marked seeds when credentials are missing", async () => {
    const catalogue = await loadCatalogueWithFallback(null);
    expect(catalogue.source).toBe("seeded");
    expect(catalogue.fallbackReason).toBe("missing_configuration");
    expect(catalogue.vehicles).toHaveLength(5);
    expect(
      catalogue.chargers.every(
        (charger) => charger.isDemo && charger.name.startsWith("DEMO"),
      ),
    ).toBe(true);
  });
  it("falls back for unreachable databases and empty catalogues", async () => {
    expect(
      (
        await loadCatalogueWithFallback(async () => {
          throw new Error("network unavailable");
        })
      ).fallbackReason,
    ).toBe("database_unavailable");
    expect(
      (
        await loadCatalogueWithFallback(async () => ({
          vehicles: [],
          chargers: [],
          source: "supabase-demo",
        }))
      ).fallbackReason,
    ).toBe("empty_catalogue");
  });
  it("uses a healthy persisted catalogue without mixing in local seeds", async () => {
    const loaded = {
      ...(await demoDataProvider.loadCatalogue()),
      source: "supabase-demo" as const,
    };
    expect(await loadCatalogueWithFallback(async () => loaded)).toBe(loaded);
  });
  it("never claims to save private records when persistence is unavailable", async () => {
    const repository = createUserDataRepository(null);
    await expect(repository.getProfile()).rejects.toBeInstanceOf(
      PersistenceUnavailableError,
    );
    await expect(repository.addFavourite("location-id")).rejects.toBeInstanceOf(
      PersistenceUnavailableError,
    );
  });
  it("rejects secret/service-role keys and invalid URLs", () => {
    const url = "https://example.supabase.co";
    const secret = `header.${btoa(JSON.stringify({ role: "service_role" }))}.signature`;
    expect(readSupabaseConfiguration({})).toEqual({ status: "unconfigured" });
    expect(
      readSupabaseConfiguration({
        NEXT_PUBLIC_SUPABASE_URL: url,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_do_not_expose",
      }),
    ).toEqual({ status: "invalid" });
    expect(
      readSupabaseConfiguration({
        NEXT_PUBLIC_SUPABASE_URL: url,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: secret,
      }),
    ).toEqual({ status: "invalid" });
    expect(
      readSupabaseConfiguration({
        NEXT_PUBLIC_SUPABASE_URL: "http://remote.example",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example_key",
      }),
    ).toEqual({ status: "invalid" });
    expect(
      readSupabaseConfiguration({
        NEXT_PUBLIC_SUPABASE_URL: url,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example_key",
      }).status,
    ).toBe("configured");
  });
});
