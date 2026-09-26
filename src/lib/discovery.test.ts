import { describe, expect, it } from "vitest";
import { vehicles } from "@/data/demo";
import { MockChargingProvider } from "@/providers/charging/mock";
import { DEFAULT_CHARGING_BOUNDS } from "@/providers/charging/provider";
import {
  boundedViewport,
  boundsAround,
  directionsUrl,
  discoveryEstimate,
  distanceMiles,
  filterSites,
  initialFilters,
  markerStatus,
  usefulPower,
} from "./discovery";
import { normaliseSearchResults } from "./mapbox-search";
import { readChargingSnapshot } from "@/providers/charging/snapshot";
const sites = (
  await new MockChargingProvider().getLocations(DEFAULT_CHARGING_BOUNDS)
).locations;
const car = vehicles[0];
describe("charger discovery", () => {
  it("uses symbols for all five statuses and does not infer live availability", () => {
    const site = structuredClone(sites[0]);
    expect(markerStatus(site)).toBe("partial");
    site.status.availableConnectors = site.status.totalConnectors;
    expect(markerStatus(site)).toBe("available");
    site.status.availableConnectors = 0;
    expect(markerStatus(site)).toBe("busy");
    site.status.status = "faulted";
    expect(markerStatus(site)).toBe("offline");
    site.status.provenance = {
      ...site.status.provenance,
      kind: "external",
      observedAt: null,
    };
    expect(markerStatus(site)).toBe("unknown");
  });
  it("excludes unknown and stale availability from Available now", () => {
    expect(
      filterSites(sites, car, { ...initialFilters, available: true }),
    ).toHaveLength(3);
    const stale = structuredClone(sites[0]);
    stale.status.provenance.kind = "live";
    stale.status.provenance.observedAt = "2000-01-01T00:00:00Z";
    expect(
      filterSites([stale], car, { ...initialFilters, available: true }),
    ).toEqual([]);
  });
  it("filters connectors, rated speed, network and price without inventing missing prices", () => {
    expect(
      filterSites(sites, car, { ...initialFilters, connector: "Type 2" }),
    ).toHaveLength(1);
    for (const power of [7, 22, 50, 100, 150, 250])
      expect(
        filterSites(sites, car, { ...initialFilters, power }).every((s) =>
          s.connectors.some((c) => c.maxPowerKw! >= power),
        ),
      ).toBe(true);
    expect(
      filterSites(sites, car, {
        ...initialFilters,
        operator: sites[0].operator.id,
      }),
    ).toHaveLength(1);
    expect(
      filterSites(sites, car, { ...initialFilters, price: 0.6 }),
    ).toHaveLength(2);
    const unknown = {
      ...sites[0],
      tariff: { ...sites[0].tariff, pricePerKwh: null },
    };
    expect(
      filterSites([unknown], car, { ...initialFilters, price: 1 }),
    ).toEqual([]);
  });
  it("filters verified facilities and published community only", () => {
    expect(
      filterSites(sites, car, { ...initialFilters, facilities: ["cafe"] }),
    ).toHaveLength(2);
    expect(
      filterSites([{ ...sites[0], facilities: null }], car, {
        ...initialFilters,
        facilities: ["cafe"],
      }),
    ).toEqual([]);
    expect(
      filterSites(sites, car, { ...initialFilters, access: "community" }),
    ).toEqual([]);
    expect(
      filterSites([{ ...sites[0], isCommunity: true }], car, {
        ...initialFilters,
        access: "community",
      }),
    ).toHaveLength(1);
    expect(
      filterSites([{ ...sites[0], isPublic: false, isCommunity: true }], car, {
        ...initialFilters,
        access: "community",
      }),
    ).toEqual([]);
  });
  it("caps useful AC/DC power for this car and honours incompatible cars", () => {
    expect(usefulPower(sites[3], car)).toBe(car.maxDcKw);
    expect(usefulPower(sites[2], car)).toBe(car.maxAcKw);
    expect(
      discoveryEstimate(sites[0], { ...car, connectors: ["CHAdeMO"] }),
    ).toBeNull();
  });
  it("uses SOC curves and personal efficiency; time survives missing tariffs", () => {
    const estimate = discoveryEstimate(sites[0], car)!;
    expect(estimate.session.timeMinutes).toBeGreaterThan(18);
    expect(estimate.cost80).toBeCloseTo(((car.batteryKwh * 0.6) / 0.9) * 0.69);
    const unknown = {
      ...sites[0],
      tariff: { ...sites[0].tariff, pricePerKwh: null },
    };
    const result = discoveryEstimate(unknown, car)!;
    expect(result.cost100).toBeNull();
    expect(result.cost80).toBeNull();
    expect(result.session.timeMinutes).toBe(estimate.session.timeMinutes);
    expect(
      discoveryEstimate(sites[0], { ...car, efficiencyMilesPerKwh: 5 })!
        .cost100,
    ).toBeLessThan(estimate.cost100!);
    expect(
      discoveryEstimate(
        { ...sites[0], tariff: { ...sites[0].tariff, connectionFee: null } },
        car,
      )!.cost80,
    ).toBeNull();
  });
  it("rejects nationwide reads, measures straight-line distance and disables demo navigation", () => {
    expect(boundedViewport(DEFAULT_CHARGING_BOUNDS)).toBe(true);
    expect(boundedViewport({ north: 60, south: 50, east: 2, west: -5 })).toBe(
      false,
    );
    expect(boundedViewport(boundsAround(sites[0]))).toBe(true);
    expect(distanceMiles(sites[0], sites[0])).toBe(0);
    expect(directionsUrl(sites[0])).toBeNull();
    expect(
      directionsUrl({
        ...sites[0],
        provenance: { ...sites[0].provenance, kind: "external" },
      }),
    ).toContain(`destination=${sites[0].latitude},${sites[0].longitude}`);
  });
  it("validates optional snapshot fields while supporting legacy snapshots", () => {
    expect(readChargingSnapshot(sites[0]).facilities).toContain("cafe");
    expect(() =>
      readChargingSnapshot({ ...sites[0], facilities: ["made_up"] }),
    ).toThrow();
    expect(() =>
      readChargingSnapshot({ ...sites[0], isCommunity: "true" }),
    ).toThrow();
    const old = { ...sites[0] };
    delete old.facilities;
    delete old.isCommunity;
    expect(readChargingSnapshot(old).id).toBe(old.id);
  });
  it("normalises place results and rejects invalid external coordinates", () => {
    expect(
      normaliseSearchResults({
        features: [
          {
            geometry: { coordinates: [-0.1, 51.5] },
            properties: { name: "London", place_formatted: "UK" },
          },
        ],
      }),
    ).toEqual([
      { id: "0", label: "London, UK", latitude: 51.5, longitude: -0.1 },
    ]);
    expect(
      normaliseSearchResults({
        features: [
          {
            geometry: { coordinates: [500, NaN] },
            properties: { name: "Invalid" },
          },
        ],
      }),
    ).toEqual([]);
    expect(normaliseSearchResults(null)).toEqual([]);
  });
});
