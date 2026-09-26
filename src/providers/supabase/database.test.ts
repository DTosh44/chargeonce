import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { projectDemoCatalogue } from "./catalogue";
import { createSupabaseDataProvider } from "./charging-data";
import type { Database, Row } from "../../lib/supabase/database.types";

// Runs the actual migrations in PostgreSQL/WASM. Minimal auth fixtures substitute for GoTrue.
const db = new PGlite();
const alice = "60000000-0000-4000-8000-000000000001";
const bob = "60000000-0000-4000-8000-000000000002";
const vehicle = "10000000-0000-4000-8000-000000000001";
const location = "30000000-0000-4000-8000-000000000001";
const privateLocation = "30000000-0000-4000-8000-000000000099";
const garageA = "70000000-0000-4000-8000-000000000001";
const garageB = "70000000-0000-4000-8000-000000000002";
const journey = "80000000-0000-4000-8000-000000000001";
const community = "90000000-0000-4000-8000-000000000001";
const seed = readFileSync(resolve("supabase/seed.sql"), "utf8");

async function asRole<T>(
  role: "anon" | "authenticated",
  userId: string | null,
  action: () => Promise<T>,
) {
  await db.exec(`set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
    userId ?? "",
  ]);
  try {
    return await action();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}
async function rows<Name extends keyof Database["public"]["Tables"]>(
  table: Name,
) {
  const result = await db.query<{ row: Row<Name> }>(
    `select to_jsonb(t) as row from public.${table} t order by 1::text`,
  );
  return result.rows.map((result) => result.row);
}

beforeAll(async () => {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb not null default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
  `);
  for (const file of readdirSync(resolve("supabase/migrations"))
    .filter((file) => file.endsWith(".sql"))
    .sort()) {
    await db.exec(readFileSync(resolve("supabase/migrations", file), "utf8"));
  }
  await db.exec(seed);
  await db.query(
    'insert into auth.users(id, raw_user_meta_data) values ($1, \'{"display_name":"Alice"}\'), ($2, \'{"display_name":"Bob"}\')',
    [alice, bob],
  );
  await db.query(
    "insert into public.user_vehicles(id, user_id, vehicle_id) values ($1, $2, $3), ($4, $2, $3)",
    [garageA, alice, vehicle, garageB],
  );
  await db.query(
    'insert into public.journeys(id, user_id, vehicle_id, origin, destination, starting_battery_percent) values ($1, $2, $3, \'{"label":"Marlow"}\', \'{"label":"Bristol"}\', 50)',
    [journey, alice, vehicle],
  );
  await db.query(
    "insert into public.charging_locations(id, external_id, provider, operator_id, name, address, postcode, latitude, longitude, is_public, is_community, access_type) values ($1, 'private', 'test', '20000000-0000-4000-8000-000000000001', 'Private home', 'Private address', 'TEST', 51, 0, false, true, 'private')",
    [privateLocation],
  );
  await db.query(
    "insert into public.evses(location_id, external_id, status) values ($1, 'private-evse', 'available')",
    [privateLocation],
  );
  await db.query(
    "insert into public.community_chargers(id, owner_id, location_id) values ($1, $2, $3)",
    [community, alice, privateLocation],
  );
  await db.query(
    "insert into public.community_availability(community_charger_id, starts_at, ends_at) values ($1, now(), now() + interval '1 hour')",
    [community],
  );
}, 30000);
afterAll(async () => {
  await db.close();
});

describe("Supabase migrations and data contract", () => {
  it("creates all 17 tables with RLS and seeds idempotently", async () => {
    const result = await db.query<{ count: number }>(
      "select count(*)::int as count from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity",
    );
    expect(result.rows[0].count).toBe(17);
    await db.exec(seed);
    expect(await rows("vehicles")).toHaveLength(13);
    expect(await rows("tariffs")).toHaveLength(5);
    expect(await rows("facilities")).toHaveLength(8);
    expect((await rows("tariffs")).every((row) => row.is_demo)).toBe(true);
  });
  it("projects persisted demo data, converts pounds to pence and counts EVSEs correctly", async () => {
    const catalogue = projectDemoCatalogue({
      vehicles: await rows("vehicles"),
      locations: await rows("charging_locations"),
      evses: await rows("evses"),
      connectors: await rows("connectors"),
      operators: await rows("operators"),
      tariffs: await rows("tariffs"),
    });
    expect(catalogue.vehicles).toHaveLength(13);
    expect(catalogue.chargers).toHaveLength(5);
    expect(
      catalogue.chargers.find((charger) => charger.id === "alpha"),
    ).toMatchObject({
      isDemo: true,
      network: "GRIDSERVE",
      pricePencePerKwh: 69,
      availableStalls: 3,
      stalls: 6,
    });
    expect(
      catalogue.chargers.find((charger) => charger.id === "echo")?.status,
    ).toBe("Unknown");
    const withoutTariff = projectDemoCatalogue({
      vehicles: await rows("vehicles"),
      locations: await rows("charging_locations"),
      evses: await rows("evses"),
      connectors: await rows("connectors"),
      operators: await rows("operators"),
      tariffs: [],
    });
    expect(withoutTariff.chargers).toHaveLength(0);
  });
  it("loads the persisted catalogue through the typed Supabase query adapter", async () => {
    const payloads: Record<string, unknown[]> = {
      vehicles: await rows("vehicles"),
      charging_locations: await rows("charging_locations"),
      operators: await rows("operators"),
      evses: await rows("evses"),
      connectors: await rows("connectors"),
      tariffs: await rows("tariffs"),
    };
    const requested: string[] = [];
    const client = createClient<Database>(
      "https://example.supabase.co",
      "sb_publishable_development_test",
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
          fetch: async (input) => {
            const url = new URL(
              typeof input === "string"
                ? input
                : input instanceof URL
                  ? input.href
                  : input.url,
            );
            const table = url.pathname.split("/").at(-1)!;
            requested.push(table);
            return Response.json(payloads[table] ?? [], { status: 200 });
          },
        },
      },
    );
    const catalogue = await createSupabaseDataProvider(client).loadCatalogue();
    expect(catalogue.source).toBe("supabase-demo");
    expect(catalogue.vehicles).toHaveLength(13);
    expect(catalogue.chargers).toHaveLength(5);
    expect(new Set(requested).size).toBe(6);
  });
  it("allows anonymous catalogue reads but hides private locations, EVSEs and all user data", async () => {
    await asRole("anon", null, async () => {
      expect(await rows("charging_locations")).toHaveLength(5);
      expect(
        (await rows("evses")).every(
          (evse) => evse.location_id !== privateLocation,
        ),
      ).toBe(true);
      await expect(rows("profiles")).rejects.toThrow();
      await expect(
        db.query("update public.vehicles set source='tampered'"),
      ).rejects.toThrow();
    });
  });
  it("creates profiles automatically and prevents cross-user reads/writes", async () => {
    await asRole("authenticated", bob, async () => {
      expect(await rows("profiles")).toMatchObject([
        { id: bob, display_name: "Bob" },
      ]);
      expect(await rows("user_vehicles")).toHaveLength(0);
      expect(await rows("journeys")).toHaveLength(0);
      const update = await db.query(
        "update public.profiles set display_name='attack' where id=$1 returning id",
        [alice],
      );
      expect(update.rows).toHaveLength(0);
      await expect(
        db.query(
          "insert into public.favourites(user_id, location_id) values ($1, $2)",
          [alice, location],
        ),
      ).rejects.toThrow();
      await expect(
        db.query("select public.set_default_user_vehicle($1)", [garageA]),
      ).rejects.toThrow();
    });
  });
  it("enforces one default and switches atomically without affecting another user", async () => {
    await asRole("authenticated", alice, async () => {
      await db.query("select public.set_default_user_vehicle($1)", [garageA]);
      await expect(
        db.query(
          "update public.user_vehicles set is_default=true where id=$1",
          [garageB],
        ),
      ).rejects.toThrow();
      await db.query("select public.set_default_user_vehicle($1)", [garageB]);
      expect(
        (await rows("user_vehicles"))
          .filter((row) => row.is_default)
          .map((row) => row.id),
      ).toEqual([garageB]);
    });
  });
  it("makes the first saved car current, supports duplicate models, and promotes a car on removal", async () => {
    const first = "70000000-0000-4000-8000-000000000003";
    const second = "70000000-0000-4000-8000-000000000004";
    await asRole("authenticated", bob, async () => {
      await db.query(
        "insert into public.user_vehicles(id,user_id,vehicle_id,nickname) values ($1,$2,$3,'Work car'),($4,$2,$3,'Family car')",
        [first, bob, vehicle, second],
      );
      expect(
        (await rows("user_vehicles")).find((car) => car.id === first)
          ?.is_default,
      ).toBe(true);
      expect(await rows("user_vehicles")).toHaveLength(2);
      await db.query(
        "update public.user_vehicles set nickname='Weekend car',efficiency_override=3.2 where id=$1",
        [second],
      );
      expect(
        (await rows("user_vehicles")).find((car) => car.id === second),
      ).toMatchObject({ nickname: "Weekend car", efficiency_override: 3.2 });
      await expect(
        db.query(
          "update public.user_vehicles set efficiency_override=11 where id=$1",
          [second],
        ),
      ).rejects.toThrow();
      await expect(
        db.query("select public.remove_user_vehicle($1)", [garageA]),
      ).rejects.toThrow();
      await db.query("select public.remove_user_vehicle($1)", [first]);
      expect(await rows("user_vehicles")).toMatchObject([
        { id: second, is_default: true },
      ]);
      await db.query("select public.remove_user_vehicle($1)", [second]);
      expect(await rows("user_vehicles")).toHaveLength(0);
      await expect(
        db.query("select public.remove_user_vehicle($1)", [second]),
      ).rejects.toThrow();
    });
    await asRole("anon", null, async () => {
      await expect(
        db.query("select public.remove_user_vehicle($1)", [garageA]),
      ).rejects.toThrow();
    });
  });
  it("keeps database and bundled starter vehicle identifiers/specifications aligned", async () => {
    const { seededVehicleModels } = await import("../vehicle-service");
    const persisted = await rows("vehicles");
    const { mapVehicle } = await import("./mappers");
    for (const model of seededVehicleModels) {
      const row = persisted.find((row) => row.id === model.id)!;
      expect(row.manufacturer).toBe(model.manufacturer);
      expect(row.model).toBe(model.model);
      expect(row.variant).toBe(model.variant);
      expect(mapVehicle(row).chargingCurve).toEqual(model.chargingCurve);
      expect(row.usable_battery_kwh).toBe(model.usableBatteryKwh);
      expect(row.max_dc_kw).toBe(model.maxDcKw);
      expect(row.max_ac_kw).toBe(model.maxAcKw);
      expect(row.estimated_range_miles).toBe(model.estimatedRangeMiles);
      expect(row.efficiency_miles_per_kwh).toBeCloseTo(
        model.efficiencyMilesPerKwh,
        2,
      );
    }
  });
  it("protects journey stops through the parent journey and blocks owner reassignment", async () => {
    await asRole("authenticated", bob, async () => {
      await expect(
        db.query(
          "insert into public.journey_stops(journey_id, location_id, sequence, arrival_battery_percent, departure_battery_percent, estimated_minutes, estimated_cost) values ($1, $2, 1, 20, 80, 20, 25)",
          [journey, location],
        ),
      ).rejects.toThrow();
    });
    await asRole("authenticated", alice, async () => {
      await expect(
        db.query("update public.journeys set user_id=$1 where id=$2", [
          bob,
          journey,
        ]),
      ).rejects.toThrow();
      await db.query(
        "insert into public.journey_stops(journey_id, location_id, sequence, arrival_battery_percent, departure_battery_percent, estimated_minutes, estimated_cost) values ($1, $2, 1, 20, 80, 20, 25)",
        [journey, location],
      );
    });
    await asRole("authenticated", bob, async () => {
      expect(await rows("journey_stops")).toHaveLength(0);
    });
  });
  it("rejects invalid numbers, report types and EVSE/location mismatches", async () => {
    await expect(
      db.query(
        "insert into public.connectors(evse_id, connector_type, max_power_kw) select id, 'CCS', -1 from public.evses limit 1",
      ),
    ).rejects.toThrow();
    await expect(
      db.query(
        "insert into public.journeys(user_id, vehicle_id, origin, destination, starting_battery_percent) values ($1, $2, '{}', '{}', 101)",
        [alice, vehicle],
      ),
    ).rejects.toThrow();
    const otherEvse = (
      await db.query<{ id: string }>(
        "select id from public.evses where location_id <> $1 limit 1",
        [location],
      )
    ).rows[0].id;
    await asRole("authenticated", alice, async () => {
      await expect(
        db.query(
          "insert into public.user_reports(user_id, location_id, evse_id, report_type) values ($1, $2, $3, 'working')",
          [alice, location, otherEvse],
        ),
      ).rejects.toThrow();
      await expect(
        db.query(
          "insert into public.user_reports(user_id, location_id, report_type) values ($1, $2, 'invented')",
          [alice, location],
        ),
      ).rejects.toThrow();
      await expect(
        db.query(
          "insert into public.user_reports(location_id, report_type) values ($1, 'working')",
          [location],
        ),
      ).rejects.toThrow();
    });
  });
  it("keeps community records owner-only and prevents client provisioning", async () => {
    await asRole("authenticated", bob, async () => {
      expect(await rows("community_chargers")).toHaveLength(0);
      expect(await rows("community_availability")).toHaveLength(0);
    });
    await asRole("authenticated", alice, async () => {
      expect(await rows("community_chargers")).toHaveLength(1);
      expect(await rows("community_availability")).toHaveLength(1);
      await expect(
        db.query(
          "update public.community_chargers set is_active=true where id=$1",
          [community],
        ),
      ).rejects.toThrow();
    });
  });
  it("automatically records status changes without exposing history writes", async () => {
    const evse = (await rows("evses")).find(
      (evse) => evse.location_id === location,
    )!;
    await db.query(
      "update public.evses set last_status_update='2020-01-01' where id=$1",
      [evse.id],
    );
    const before = await rows("charger_status_history");
    await db.query("update public.evses set status='faulted' where id=$1", [
      evse.id,
    ]);
    expect(await rows("charger_status_history")).toHaveLength(
      before.length + 1,
    );
    expect(
      Date.parse(
        (await rows("evses")).find((row) => row.id === evse.id)!
          .last_status_update,
      ),
    ).toBeGreaterThan(Date.parse("2020-01-01"));
    await asRole("authenticated", alice, async () => {
      await expect(
        db.query(
          "insert into public.charger_status_history(evse_id, status) values ($1, 'available')",
          [evse.id],
        ),
      ).rejects.toThrow();
    });
  });
  it("cascades private data on account deletion and anonymises reports", async () => {
    const userId = "60000000-0000-4000-8000-000000000003";
    await db.query("insert into auth.users(id) values ($1)", [userId]);
    await db.query(
      "insert into public.user_vehicles(user_id, vehicle_id) values ($1, $2)",
      [userId, vehicle],
    );
    await db.query(
      "insert into public.favourites(user_id, location_id) values ($1, $2)",
      [userId, location],
    );
    const report = await db.query<{ id: string }>(
      "insert into public.user_reports(user_id, location_id, report_type, comment) values ($1, $2, 'working', 'Personal identifying text') returning id",
      [userId, location],
    );
    const ownPrivateLocation = "30000000-0000-4000-8000-000000000098";
    await db.query(
      "insert into public.charging_locations(id, external_id, provider, operator_id, name, address, postcode, latitude, longitude, is_public, is_community, access_type) values ($1, 'deleted-home', 'test', '20000000-0000-4000-8000-000000000001', 'Home', 'Private address', 'TEST', 51, 0, false, true, 'private')",
      [ownPrivateLocation],
    );
    await db.query(
      "insert into public.community_chargers(owner_id, location_id) values ($1, $2)",
      [userId, ownPrivateLocation],
    );
    await db.query("delete from auth.users where id=$1", [userId]);
    expect(
      (await rows("charging_locations")).some(
        (item) => item.id === ownPrivateLocation,
      ),
    ).toBe(false);
    expect(
      (await rows("profiles")).some((profile) => profile.id === userId),
    ).toBe(false);
    expect(
      (await rows("user_vehicles")).some((car) => car.user_id === userId),
    ).toBe(false);
    expect(
      (await rows("favourites")).some(
        (favourite) => favourite.user_id === userId,
      ),
    ).toBe(false);
    expect(
      (await rows("user_reports")).find((item) => item.id === report.rows[0].id)
        ?.user_id,
    ).toBeNull();
    expect(
      (await rows("user_reports")).find((item) => item.id === report.rows[0].id)
        ?.comment,
    ).toBeNull();
  });
});
