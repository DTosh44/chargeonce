import { chargers } from "../../data/demo";
import type { ChargingSite, GeoBounds } from "../../domain/charging-data";
import {
  distanceKm,
  inBounds,
  validateBounds,
  validateIds,
  validatePoint,
  validateRadius,
  type ChargingDataProvider,
} from "./provider";

const demoCoordinates = [
  [51.571, -0.776],
  [51.522, -0.721],
  [51.558, -0.709],
  [51.562, -0.789],
  [51.537, -0.904],
];
const demoDate = "2026-09-26T00:00:00.000Z";
export class MockChargingProvider implements ChargingDataProvider {
  readonly id = "mock";
  constructor(private readonly now: () => number = Date.now) {}
  private sites(): ChargingSite[] {
    return chargers.map((charger, index) => {
      const id = charger.locationId!;
      const provenance = {
        source: this.id,
        kind: "demo" as const,
        observedAt: demoDate,
        fetchedAt: new Date(this.now()).toISOString(),
        staleAfterSeconds: 86400,
        attribution: {
          name: "ChargeOnce seeded development data",
          url: null,
          licence: null,
        },
      };
      return {
        id,
        persistedLocationId: charger.locationId,
        externalId: charger.id,
        provider: this.id,
        canImport: false,
        name: charger.name,
        address: charger.location,
        postcode: charger.postcode,
        latitude: demoCoordinates[index][0],
        longitude: demoCoordinates[index][1],
        accessType: "public",
        isPublic: true,
        operator: {
          id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
          name: charger.network,
          slug: charger.network.toLowerCase().replaceAll(" ", "-"),
          website: null,
          logoUrl: null,
        },
        connectors: [
          {
            id: `${id}-connector`,
            type: charger.connector,
            description: charger.connector,
            maxPowerKw: charger.maxKw,
            quantity: charger.stalls,
          },
        ],
        status: {
          locationId: id,
          status:
            charger.status === "Available"
              ? "available"
              : charger.status === "Busy"
                ? "occupied"
                : "unknown",
          availableConnectors: charger.availableStalls,
          totalConnectors: charger.stalls,
          provenance,
        },
        tariff: {
          locationId: id,
          pricePerKwh:
            charger.pricePencePerKwh == null
              ? null
              : charger.pricePencePerKwh / 100,
          connectionFee:
            charger.connectionFeePence == null
              ? null
              : charger.connectionFeePence / 100,
          currency: "GBP",
          description: "DEMO DATA — illustrative pricing only",
          provenance,
        },
        provenance,
      };
    });
  }
  private batch(locations: ChargingSite[]) {
    return {
      locations,
      provider: this.id,
      fetchedAt: new Date(this.now()).toISOString(),
      mayBeTruncated: false,
    };
  }
  async getLocations(bounds: GeoBounds) {
    validateBounds(bounds);
    return this.batch(this.sites().filter((site) => inBounds(site, bounds)));
  }
  async getLocationsNear(
    latitude: number,
    longitude: number,
    radiusKm: number,
  ) {
    validatePoint(latitude, longitude);
    validateRadius(radiusKm);
    return this.batch(
      this.sites().filter(
        (site) =>
          distanceKm(latitude, longitude, site.latitude, site.longitude) <=
          radiusKm,
      ),
    );
  }
  async getLocation(id: string) {
    validateIds([id]);
    return this.sites().find((site) => site.id === id) ?? null;
  }
  async getOperators() {
    return this.sites().map((site) => site.operator);
  }
  async getStatuses(ids: string[]) {
    validateIds(ids);
    return this.sites()
      .filter((site) => ids.includes(site.id))
      .map((site) => site.status);
  }
  async getTariffs(ids: string[]) {
    validateIds(ids);
    return this.sites()
      .filter((site) => ids.includes(site.id))
      .map((site) => site.tariff);
  }
}
