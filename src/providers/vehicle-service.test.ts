import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type {
  Database,
  VehicleRow,
  UserVehicleRow,
} from "../lib/supabase/database.types";
import { createVehicleService } from "./vehicle-service";
const owner = "60000000-0000-4000-8000-000000000001";
const vehicle: VehicleRow = {
  id: "10000000-0000-4000-8000-000000000001",
  manufacturer: "Tesla",
  model: "Model 3",
  variant: "RWD",
  model_year: 2024,
  usable_battery_kwh: 60,
  gross_battery_kwh: 62,
  max_ac_kw: 11,
  max_dc_kw: 170,
  connector_types: ["CCS", "Type 2"],
  efficiency_miles_per_kwh: 4.5,
  estimated_range_miles: 270,
  charging_curve: [],
  source: "imported-test",
  is_demo: false,
  created_at: "2026-09-26T00:00:00Z",
  updated_at: "2026-09-26T00:00:00Z",
};
const saved: UserVehicleRow[] = [1, 2].map((number) => ({
  id: `70000000-0000-4000-8000-00000000000${number}`,
  user_id: owner,
  vehicle_id: vehicle.id,
  nickname: number === 1 ? "Work car" : "Family car",
  registration: null,
  is_default: number === 1,
  efficiency_override: number === 1 ? 3 : null,
  created_at: vehicle.created_at,
  updated_at: vehicle.updated_at,
}));
function fixture(fail = false) {
  const requested: URL[] = [];
  const client = createClient<Database>(
    "https://example.supabase.co",
    "sb_publishable_development_test",
    {
      auth: { persistSession: false, autoRefreshToken: false },
      db: { retry: false },
      global: {
        fetch: async (input) => {
          const url = new URL(
            typeof input === "string"
              ? input
              : input instanceof URL
                ? input.href
                : input.url,
          );
          requested.push(url);
          if (fail)
            return Response.json(
              { message: "database offline" },
              { status: 503 },
            );
          return Response.json(
            url.pathname.endsWith("user_vehicles") ? saved : [vehicle],
          );
        },
      },
    },
  );
  vi.spyOn(client.auth, "getUser").mockResolvedValue({
    data: {
      user: {
        id: owner,
        aud: "authenticated",
        app_metadata: {},
        user_metadata: {},
        created_at: vehicle.created_at,
      },
    },
    error: null,
  });
  return { client, requested };
}
describe("VehicleService Supabase adapter", () => {
  it("supports authoritative non-demo catalogue records rather than filtering them out", async () => {
    const { client, requested } = fixture();
    const catalogue = await createVehicleService(client).listCatalogue();
    expect(catalogue.source).toBe("database");
    expect(catalogue.vehicles[0].isDemo).toBe(false);
    expect(requested[0].searchParams.has("is_demo")).toBe(false);
  });
  it("keeps duplicate-model garage identities and personal overrides distinct", async () => {
    const { client, requested } = fixture();
    const cars = await createVehicleService(client).listGarage();
    expect(cars).toHaveLength(2);
    expect(cars[0].saved.nickname).toBe("Work car");
    expect(cars[1].saved.nickname).toBe("Family car");
    expect(cars[0].saved.id).not.toBe(cars[1].saved.id);
    expect(cars[0].saved.efficiencyOverride).toBe(3);
    expect(cars[1].saved.efficiencyOverride).toBeNull();
    expect(requested[0].searchParams.get("user_id")).toBe(`eq.${owner}`);
  });
  it("falls back for public catalogue outages but never fabricates a private garage", async () => {
    const { client } = fixture(true);
    const service = createVehicleService(client);
    expect((await service.listCatalogue()).source).toBe("seeded");
    await expect(service.listGarage()).rejects.toThrow();
  });
});
