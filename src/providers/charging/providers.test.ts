import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { MockChargingProvider } from "./mock";
import { OpenChargeMapProvider } from "./open-charge-map/provider.server";
import {
  normaliseOpenChargeMap,
  normaliseLocationResponse,
} from "./open-charge-map/normalise";
import { examplePoint } from "./open-charge-map/fixtures";
import { dataState } from "../../domain/charging-data";
import { ChargingProviderError, DEFAULT_CHARGING_BOUNDS } from "./provider";
import { presentChargingSites } from "./presentation";
import { locationsWithFallback } from "./service";
import {
  hasUsableTariff,
  recommendedChargers,
  estimateCharge,
} from "../../lib/charging";
import { vehicles } from "../../data/demo";
import { importChargingRegion } from "./ingestion";
import { readChargingSnapshot } from "./snapshot";

const now = Date.parse("2026-09-26T12:00:00Z");
const fetchedAt = new Date(now).toISOString();
const external = () => normaliseOpenChargeMap(examplePoint, fetchedAt)!;
const fetchFixture = () =>
  vi.fn<typeof fetch>(async () => Response.json([examplePoint]));

describe("charging provider contract", () => {
  it("mock supports bounded, nearby and individual reads, operators, statuses and tariffs", async () => {
    const provider = new MockChargingProvider(() => now);
    const batch = await provider.getLocations(DEFAULT_CHARGING_BOUNDS);
    expect(batch.locations).toHaveLength(5);
    expect(
      batch.locations.every(
        (site) =>
          dataState(site.provenance, now) === "demo" &&
          dataState(site.status.provenance, now) === "demo" &&
          dataState(site.tariff.provenance, now) === "demo",
      ),
    ).toBe(true);
    const site = batch.locations[0];
    expect(await provider.getLocation(site.id)).toMatchObject({
      name: site.name,
    });
    expect(await provider.getLocation("missing")).toBeNull();
    expect(
      (await provider.getLocationsNear(site.latitude, site.longitude, 0.2))
        .locations,
    ).toHaveLength(1);
    expect(await provider.getOperators()).toHaveLength(5);
    expect(await provider.getStatuses([site.id])).toHaveLength(1);
    expect(await provider.getTariffs([site.id])).toHaveLength(1);
  });
  it("normalises only internal fields and does not treat operational as available or parse free-text prices", () => {
    const site = external();
    expect(site).toMatchObject({
      id: "openchargemap:12345",
      latitude: 51.57,
      isPublic: true,
      operator: { name: "Example network" },
      status: { status: "unknown", availableConnectors: null },
      tariff: {
        pricePerKwh: null,
        connectionFee: null,
        currency: null,
        description: examplePoint.UsageCost,
      },
    });
    expect(site.connectors.map((c) => c.type)).toEqual(["CCS", "Type 2"]);
    expect(dataState(site.provenance, now)).toBe("external");
    expect(dataState(site.status.provenance, now)).toBe("unknown");
    expect(dataState(site.tariff.provenance, now)).toBe("unknown");
    expect(JSON.stringify(site)).not.toContain('"AddressInfo"');
    expect(JSON.stringify(site)).not.toContain('"PowerKW"');
    expect(readChargingSnapshot(site)).toEqual(site);
  });
  it("retains unrecognised connectors and missing power without inventing a compatible connector", () => {
    const site = normaliseOpenChargeMap(
      { ...examplePoint, Connections: [{ ConnectionTypeID: 999, PowerKW: 0 }] },
      fetchedAt,
    )!;
    expect(site.connectors[0]).toMatchObject({
      type: null,
      maxPowerKw: null,
      quantity: null,
    });
    expect(presentChargingSites([site], DEFAULT_CHARGING_BOUNDS, now)).toEqual(
      [],
    );
  });
  it("does not mistake private or unknown access for public access", () => {
    expect(
      normaliseOpenChargeMap(
        { ...examplePoint, UsageType: { Title: "Private" } },
        fetchedAt,
      ),
    ).toMatchObject({ isPublic: false, accessType: "private" });
    expect(
      normaliseOpenChargeMap({ ...examplePoint, UsageType: null }, fetchedAt),
    ).toMatchObject({ isPublic: false, accessType: "restricted" });
  });
  it.each([
    null,
    {},
    { ...examplePoint, ID: 0 },
    {
      ...examplePoint,
      AddressInfo: { ...examplePoint.AddressInfo, Latitude: NaN },
    },
    {
      ...examplePoint,
      AddressInfo: { ...examplePoint.AddressInfo, Longitude: 200 },
    },
  ])("rejects invalid point %j", (value) =>
    expect(normaliseOpenChargeMap(value, fetchedAt)).toBeNull(),
  );
  it("rejects malformed envelopes, deduplicates IDs and permits an honest empty region", () => {
    expect(() =>
      normaliseLocationResponse({ error: "Secret upstream error" }, fetchedAt),
    ).toThrow(ChargingProviderError);
    expect(() => normaliseLocationResponse([{}], fetchedAt)).toThrow(
      ChargingProviderError,
    );
    expect(normaliseLocationResponse([], fetchedAt)).toEqual([]);
    expect(
      normaliseLocationResponse([examplePoint, examplePoint], fetchedAt),
    ).toHaveLength(1);
  });
  it("uses a header key, canonical bounding query, fixed host, bounded results and caches concurrent reads", async () => {
    const fetcher = fetchFixture();
    const provider = new OpenChargeMapProvider(
      "secret-test-key",
      fetcher,
      () => now,
    );
    const [a, b] = await Promise.all([
      provider.getLocations(DEFAULT_CHARGING_BOUNDS),
      provider.getLocations(DEFAULT_CHARGING_BOUNDS),
    ]);
    expect(a).toEqual(b);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).toContain("boundingbox=");
    expect(String(url)).not.toContain("secret-test-key");
    expect(String(url)).toContain("opendata=true");
    expect(String(url)).toContain("maxresults=200");
    expect(init?.headers).toMatchObject({ "X-API-Key": "secret-test-key" });
    expect(init?.redirect).toBe("error");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });
  it("preserves fetch timestamps on cached reads, retries failed queries and expires cache", async () => {
    let time = now;
    const fetcher = fetchFixture();
    const provider = new OpenChargeMapProvider("test", fetcher, () => time);
    const original = await provider.getLocations(DEFAULT_CHARGING_BOUNDS);
    time += 60000;
    const cached = await provider.getLocations(DEFAULT_CHARGING_BOUNDS);
    expect(cached.fetchedAt).toBe(original.fetchedAt);
    expect(fetcher).toHaveBeenCalledTimes(1);
    time += 900000;
    await provider.getLocations(DEFAULT_CHARGING_BOUNDS);
    expect(fetcher).toHaveBeenCalledTimes(2);
    const failing = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("secret-test-key"))
      .mockImplementation(async () => Response.json([examplePoint]));
    const retry = new OpenChargeMapProvider("test", failing, () => now);
    await expect(retry.getLocations(DEFAULT_CHARGING_BOUNDS)).rejects.toThrow(
      "Charging data unavailable",
    );
    await retry.getLocations(DEFAULT_CHARGING_BOUNDS);
    expect(failing).toHaveBeenCalledTimes(2);
  });
  it("nearby reads use km; individual, batched status/tariff and operator reads stay behind the boundary", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) =>
      String(input).includes("referencedata")
        ? Response.json({ Operators: [examplePoint.OperatorInfo] })
        : Response.json([examplePoint]),
    );
    const provider = new OpenChargeMapProvider("test", fetcher, () => now);
    await provider.getLocationsNear(51.57, -0.78, 10);
    expect(String(fetcher.mock.calls[0][0])).toContain("distanceunit=km");
    expect(await provider.getLocation("openchargemap:12345")).toMatchObject({
      name: "Example external hub",
    });
    expect(
      await provider.getLocation("arbitrary:https://bad.example"),
    ).toBeNull();
    expect(await provider.getStatuses(["openchargemap:12345"])).toMatchObject([
      { status: "unknown" },
    ]);
    expect(await provider.getTariffs(["openchargemap:12345"])).toMatchObject([
      { pricePerKwh: null },
    ]);
    expect(await provider.getOperators()).toMatchObject([
      { name: "Example network" },
    ]);
    const count = fetcher.mock.calls.length;
    expect(await provider.getStatuses([])).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(count);
  });
  it.each([401, 429, 500])(
    "safely handles HTTP %i without leaking body/key",
    async (status) => {
      const provider = new OpenChargeMapProvider(
        "secret-test-key",
        async () => new Response("secret-test-key", { status }),
        () => now,
      );
      await expect(
        provider.getLocations(DEFAULT_CHARGING_BOUNDS),
      ).rejects.toThrow("Charging data unavailable.");
    },
  );
  it("rejects oversized responses and malformed JSON", async () => {
    const tooBig = new OpenChargeMapProvider(
      "test",
      async () =>
        new Response("[]", { headers: { "Content-Length": "5000000" } }),
    );
    await expect(
      tooBig.getLocations(DEFAULT_CHARGING_BOUNDS),
    ).rejects.toMatchObject({ code: "invalid_response" });
    const invalid = new OpenChargeMapProvider(
      "test",
      async () => new Response("not-json"),
    );
    await expect(invalid.getLocations(DEFAULT_CHARGING_BOUNDS)).rejects.toThrow(
      ChargingProviderError,
    );
  });
  it("refuses nationwide, antimeridian, invalid and oversized ID queries before network work", async () => {
    const fetcher = fetchFixture();
    const provider = new OpenChargeMapProvider("test", fetcher);
    await expect(
      provider.getLocations({ north: 60, south: 50, east: 2, west: -5 }),
    ).rejects.toMatchObject({ code: "invalid_query" });
    await expect(provider.getLocationsNear(91, 0, 10)).rejects.toMatchObject({
      code: "invalid_query",
    });
    await expect(provider.getLocationsNear(51, 0, 51)).rejects.toMatchObject({
      code: "invalid_query",
    });
    await expect(
      provider.getStatuses(Array(101).fill("openchargemap:1")),
    ).rejects.toMatchObject({ code: "invalid_query" });
    await expect(provider.getTariffs(["bad"])).rejects.toMatchObject({
      code: "invalid_query",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("falls back as a clearly demo whole batch, never overwrites an empty external region", async () => {
    expect(
      await locationsWithFallback(null, DEFAULT_CHARGING_BOUNDS),
    ).toMatchObject({
      provider: "mock",
      fallbackReason: "missing_configuration",
    });
    const failed = new OpenChargeMapProvider("test", async () => {
      throw new Error("offline");
    });
    expect(
      await locationsWithFallback(failed, DEFAULT_CHARGING_BOUNDS),
    ).toMatchObject({
      provider: "mock",
      fallbackReason: "provider_unavailable",
    });
    const empty = new OpenChargeMapProvider("test", async () =>
      Response.json([]),
    );
    expect(
      await locationsWithFallback(empty, DEFAULT_CHARGING_BOUNDS),
    ).toMatchObject({ provider: "openchargemap", locations: [] });
  });
});

describe("freshness and consumer-safe projection", () => {
  it("uses source observations and fetch age separately, not 'fetched just now = live'", () => {
    const p = external().provenance;
    expect(dataState({ ...p, observedAt: "2020-01-01T00:00:00Z" }, now)).toBe(
      "stale",
    );
    expect(dataState({ ...p, fetchedAt: "2020-01-01T00:00:00Z" }, now)).toBe(
      "stale",
    );
    expect(dataState({ ...p, observedAt: null }, now)).toBe("unknown");
    expect(dataState({ ...p, observedAt: "garbage" }, now)).toBe("unknown");
    expect(dataState({ ...p, observedAt: "2099-01-01T00:00:00Z" }, now)).toBe(
      "unknown",
    );
    expect(dataState({ ...p, kind: "live" }, now)).toBe("live");
    expect(dataState({ ...p, kind: "demo", observedAt: null }, now)).toBe(
      "demo",
    );
  });
  it("renders unknown pricing/reliability/availability, doesn't attribute whole-site stalls to each connector group", () => {
    const chargers = presentChargingSites(
      [external()],
      DEFAULT_CHARGING_BOUNDS,
      now,
    );
    expect(chargers).toHaveLength(2);
    expect(
      chargers.every(
        (c) =>
          c.pricePencePerKwh === null &&
          c.availableStalls === null &&
          c.reliabilityPercent === null &&
          c.status === "Unknown" &&
          !c.isDemo,
      ),
    ).toBe(true);
    expect(recommendedChargers(vehicles[0], chargers).cheapest).toBeUndefined();
    expect(hasUsableTariff(chargers[0])).toBe(false);
    expect(() => estimateCharge(vehicles[0], chargers[0])).toThrow("tariff");
  });
  it("allows true zero pricing with a current structured tariff, but suppresses stale/free-text/missing fees", () => {
    const site = external();
    site.tariff = {
      ...site.tariff,
      pricePerKwh: 0,
      connectionFee: 0,
      currency: "GBP",
      provenance: { ...site.provenance, observedAt: fetchedAt },
    };
    const charger = presentChargingSites(
      [site],
      DEFAULT_CHARGING_BOUNDS,
      now,
    )[0];
    expect(charger.pricePencePerKwh).toBe(0);
    const stale = {
      ...site,
      tariff: {
        ...site.tariff,
        provenance: {
          ...site.tariff.provenance,
          observedAt: "2020-01-01T00:00:00Z",
        },
      },
    };
    expect(
      presentChargingSites([stale], DEFAULT_CHARGING_BOUNDS, now)[0]
        .pricePencePerKwh,
    ).toBeNull();
    expect(() =>
      readChargingSnapshot({
        ...site,
        tariff: { ...site.tariff, pricePerKwh: -1 },
      }),
    ).toThrow(ChargingProviderError);
  });
});

describe("bounded ingestion", () => {
  it("skips private and source-prohibited imports without losing their read-only source metadata", async () => {
    const forbidden = {
      ...examplePoint,
      ID: 12346,
      DataProvider: { ...examplePoint.DataProvider, IsApprovedImport: false },
    };
    const privateSite = {
      ...examplePoint,
      ID: 12347,
      UsageType: { ID: 2, Title: "Private" },
    };
    const provider = new OpenChargeMapProvider(
      "test",
      async () => Response.json([examplePoint, forbidden, privateSite]),
      () => now,
    );
    const repository = { importSites: vi.fn(async () => 1) };
    expect(
      await importChargingRegion(provider, repository, DEFAULT_CHARGING_BOUNDS),
    ).toMatchObject({ received: 3, updated: 1, skipped: 2 });
    expect(repository.importSites).toHaveBeenCalledWith("openchargemap", [
      external(),
    ]);
    expect(normaliseOpenChargeMap(forbidden, fetchedAt)?.canImport).toBe(false);
    expect(
      normaliseOpenChargeMap(
        { ...examplePoint, DataProvider: { Title: "Unknown licence" } },
        fetchedAt,
      )?.canImport,
    ).toBe(false);
  });
  it("writes only validated external public locations and reports truncation instead of deleting absent data", async () => {
    const provider = new OpenChargeMapProvider(
      "test",
      fetchFixture(),
      () => now,
    );
    const repository = { importSites: vi.fn(async () => 1) };
    expect(
      await importChargingRegion(provider, repository, DEFAULT_CHARGING_BOUNDS),
    ).toMatchObject({
      provider: "openchargemap",
      received: 1,
      updated: 1,
      mayBeTruncated: false,
    });
    expect(repository.importSites).toHaveBeenCalledWith("openchargemap", [
      external(),
    ]);
  });
  it("never imports mocks or writes after provider failure", async () => {
    const repository = { importSites: vi.fn(async () => 0) };
    await expect(
      importChargingRegion(
        new MockChargingProvider(),
        repository,
        DEFAULT_CHARGING_BOUNDS,
      ),
    ).rejects.toMatchObject({ code: "not_configured" });
    const provider = new OpenChargeMapProvider("test", async () => {
      throw new Error("offline");
    });
    await expect(
      importChargingRegion(provider, repository, DEFAULT_CHARGING_BOUNDS),
    ).rejects.toThrow(ChargingProviderError);
    expect(repository.importSites).not.toHaveBeenCalled();
  });
});
