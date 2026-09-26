import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/supabase/database.types";
import { StoredChargingProvider } from "./database.server";
import { DEFAULT_CHARGING_BOUNDS } from "./provider";
import { normaliseOpenChargeMap } from "./open-charge-map/normalise";
import { examplePoint } from "./open-charge-map/fixtures";

const storedDate = "2026-09-25T12:00:00Z";
const site = normaliseOpenChargeMap(examplePoint, storedDate)!;
const uuid = "30000000-0000-4000-8000-000000000080";
const row = {
  location_id: uuid,
  provider: site.provider,
  external_id: site.externalId,
  latitude: site.latitude,
  longitude: site.longitude,
  snapshot: site,
  fetched_at: storedDate,
  updated_at: storedDate,
};
function fixtureClient(fetcher: typeof fetch) {
  return createClient<Database>(
    "https://example.supabase.co",
    "sb_publishable_test_key",
    { auth: { persistSession: false }, global: { fetch: fetcher } },
  );
}
describe("stored charging provider", () => {
  it("applies server-side region/limit filters, preserves old provenance and supplies real FK identity", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json([row]));
    const provider = new StoredChargingProvider(fixtureClient(fetcher));
    const batch = await provider.getLocations(DEFAULT_CHARGING_BOUNDS);
    expect(batch.locations[0]).toMatchObject({
      id: site.id,
      persistedLocationId: uuid,
      provenance: { fetchedAt: storedDate },
    });
    const query = String(fetcher.mock.calls[0][0]);
    expect(query).toContain("latitude=gte.");
    expect(query).toContain("latitude=lte.");
    expect(query).toContain("longitude=gte.");
    expect(query).toContain("limit=200");
    expect(query).not.toContain("openchargemap.io");
  });
  it("supports lookups, statuses, tariffs, operators and nearby filtering with no write queries", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) =>
      String(input).includes("/operators")
        ? Response.json([
            {
              id: uuid,
              name: "Test network",
              slug: "test-network",
              website: null,
              logo_url: null,
              created_at: storedDate,
              updated_at: storedDate,
            },
          ])
        : Response.json([row]),
    );
    const provider = new StoredChargingProvider(fixtureClient(fetcher));
    expect(await provider.getLocation(site.id)).toMatchObject({
      persistedLocationId: uuid,
    });
    expect(await provider.getStatuses([site.id])).toMatchObject([
      { status: "unknown" },
    ]);
    expect(await provider.getTariffs([site.id])).toMatchObject([
      { pricePerKwh: null },
    ]);
    expect(await provider.getOperators()).toMatchObject([
      { name: "Test network" },
    ]);
    expect(
      (await provider.getLocationsNear(site.latitude, site.longitude, 1))
        .locations,
    ).toHaveLength(1);
    expect(
      (await provider.getLocationsNear(site.latitude, site.longitude, 50))
        .locations,
    ).toHaveLength(1);
    expect(
      fetcher.mock.calls.every(
        ([, init]) => !init?.method || init.method === "GET",
      ),
    ).toBe(true);
    const count = fetcher.mock.calls.length;
    expect(await provider.getStatuses([])).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(count);
  });
  it("rejects database failures and malformed domain snapshots rather than inventing live data", async () => {
    const failed = new StoredChargingProvider(
      fixtureClient(async () =>
        Response.json(
          { message: "database secret should not leak" },
          { status: 500 },
        ),
      ),
    );
    await expect(
      failed.getLocations(DEFAULT_CHARGING_BOUNDS),
    ).rejects.toMatchObject({ code: "unavailable" });
    const corrupt = new StoredChargingProvider(
      fixtureClient(async () =>
        Response.json([{ ...row, snapshot: { id: "fake" } }]),
      ),
    );
    await expect(
      corrupt.getLocations(DEFAULT_CHARGING_BOUNDS),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });
});
