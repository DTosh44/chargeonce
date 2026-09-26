import type {
  ChargingSite,
  GeoBounds,
  LocationBatch,
  ChargingOperator,
  LocationStatus,
  LocationTariff,
} from "../../domain/charging-data";

export interface ChargingDataProvider {
  readonly id: string;
  getLocations(bounds: GeoBounds): Promise<LocationBatch>;
  getLocationsNear(
    latitude: number,
    longitude: number,
    radiusKm: number,
  ): Promise<LocationBatch>;
  getLocation(id: string): Promise<ChargingSite | null>;
  getOperators(): Promise<ChargingOperator[]>;
  getStatuses(locationIds: string[]): Promise<LocationStatus[]>;
  getTariffs(locationIds: string[]): Promise<LocationTariff[]>;
}
export class ChargingProviderError extends Error {
  constructor(
    public readonly code:
      "invalid_query" | "unavailable" | "invalid_response" | "not_configured",
  ) {
    super(`Charging data ${code.replaceAll("_", " ")}.`);
    this.name = "ChargingProviderError";
  }
}
export function validatePoint(latitude: number, longitude: number) {
  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  )
    throw new ChargingProviderError("invalid_query");
}
export function validateRadius(radiusKm: number) {
  if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 50)
    throw new ChargingProviderError("invalid_query");
}
export function validateBounds(bounds: GeoBounds) {
  if (!bounds || typeof bounds !== "object")
    throw new ChargingProviderError("invalid_query");
  validatePoint(bounds.north, bounds.east);
  validatePoint(bounds.south, bounds.west);
  // Bounded regional reads only. Antimeridian queries should be split by a future map service.
  if (
    bounds.north <= bounds.south ||
    bounds.east <= bounds.west ||
    bounds.north - bounds.south > 0.6 ||
    bounds.east - bounds.west > 0.6
  )
    throw new ChargingProviderError("invalid_query");
}
export function validateIds(ids: string[]) {
  if (
    !Array.isArray(ids) ||
    ids.length > 100 ||
    ids.some((id) => typeof id !== "string" || !id || id.length > 100)
  )
    throw new ChargingProviderError("invalid_query");
}
export function distanceKm(a: number, b: number, c: number, d: number) {
  const radians = Math.PI / 180;
  const h =
    Math.sin(((c - a) * radians) / 2) ** 2 +
    Math.cos(a * radians) *
      Math.cos(c * radians) *
      Math.sin(((d - b) * radians) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function inBounds(site: ChargingSite, bounds: GeoBounds) {
  return (
    site.latitude >= bounds.south &&
    site.latitude <= bounds.north &&
    site.longitude >= bounds.west &&
    site.longitude <= bounds.east
  );
}
export const DEFAULT_CHARGING_BOUNDS: GeoBounds = {
  south: 51.5,
  north: 51.65,
  west: -0.95,
  east: -0.65,
};
