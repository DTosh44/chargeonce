import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/supabase/database.types";
import type { GeoBounds } from "../../domain/charging-data";
import {
  ChargingProviderError,
  distanceKm,
  validateBounds,
  validateIds,
  validatePoint,
  validateRadius,
  type ChargingDataProvider,
} from "./provider";
import { readChargingSnapshot } from "./snapshot";
import { mapOperator } from "../supabase/mappers";

/** Read-only public RLS client. Page loads do not write or refresh external feeds. */
export class StoredChargingProvider implements ChargingDataProvider {
  readonly id = "database";
  constructor(private readonly client: SupabaseClient<Database>) {}
  async getLocations(bounds: GeoBounds) {
    validateBounds(bounds);
    return this.readWindow(bounds);
  }
  private async readWindow(bounds: GeoBounds) {
    const { data, error } = await this.client
      .from("charging_source_snapshots")
      .select("*")
      .gte("latitude", bounds.south)
      .lte("latitude", bounds.north)
      .gte("longitude", bounds.west)
      .lte("longitude", bounds.east)
      .order("location_id")
      .limit(200)
      .abortSignal(AbortSignal.timeout(5000));
    if (error) throw new ChargingProviderError("unavailable");
    const locations = (data ?? []).map((row) => ({
      ...readChargingSnapshot(row.snapshot),
      persistedLocationId: row.location_id,
    }));
    return {
      locations,
      provider: this.id,
      fetchedAt: new Date().toISOString(),
      mayBeTruncated: locations.length === 200,
    };
  }
  async getLocationsNear(
    latitude: number,
    longitude: number,
    radiusKm: number,
  ) {
    validatePoint(latitude, longitude);
    validateRadius(radiusKm);
    // Radius is capped at 50 km, independently of the stricter viewport box limit.
    const latDelta = radiusKm / 110.5,
      lonDelta = radiusKm / (111.32 * Math.cos((latitude * Math.PI) / 180));
    if (
      !Number.isFinite(lonDelta) ||
      longitude - lonDelta < -180 ||
      longitude + lonDelta > 180
    )
      throw new ChargingProviderError("invalid_query");
    const batch = await this.readWindow({
      north: Math.min(90, latitude + latDelta),
      south: Math.max(-90, latitude - latDelta),
      east: longitude + lonDelta,
      west: longitude - lonDelta,
    });
    return {
      ...batch,
      locations: batch.locations.filter(
        (site) =>
          distanceKm(latitude, longitude, site.latitude, site.longitude) <=
          radiusKm,
      ),
    };
  }
  async getLocation(id: string) {
    return (await this.byIds([id]))[0] ?? null;
  }
  private async byIds(ids: string[]) {
    validateIds(ids);
    if (!ids.length) return [];
    const { data, error } = await this.client
      .from("charging_source_snapshots")
      .select("snapshot,location_id")
      .in("snapshot->>id", ids)
      .limit(100)
      .abortSignal(AbortSignal.timeout(5000));
    if (error) throw new ChargingProviderError("unavailable");
    return (data ?? []).map((row) => ({
      ...readChargingSnapshot(row.snapshot),
      persistedLocationId: row.location_id,
    }));
  }
  async getOperators() {
    const { data, error } = await this.client
      .from("operators")
      .select("*")
      .order("name")
      .limit(1000)
      .abortSignal(AbortSignal.timeout(5000));
    if (error) throw new ChargingProviderError("unavailable");
    return (data ?? []).map(mapOperator);
  }
  async getStatuses(ids: string[]) {
    return (await this.byIds(ids)).map((site) => site.status);
  }
  async getTariffs(ids: string[]) {
    return (await this.byIds(ids)).map((site) => site.tariff);
  }
}
