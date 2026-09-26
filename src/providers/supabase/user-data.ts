import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/supabase/database.types";
import {
  AuthenticationRequiredError,
  PersistenceUnavailableError,
  type UserDataRepository,
} from "../../domain/user-data";
import {
  mapFavourite,
  mapJourney,
  mapProfile,
  mapReport,
  mapUserVehicle,
} from "./mappers";

/** Inject a cookie/session-scoped client. RLS enforces ownership independently of this adapter. */
export function createUserDataRepository(
  client: SupabaseClient<Database> | null,
): UserDataRepository {
  async function session() {
    if (!client) throw new PersistenceUnavailableError();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) throw new AuthenticationRequiredError();
    return { db: client, userId: data.user.id };
  }
  const failure = (error: unknown) => {
    if (error)
      throw new Error(
        "The database operation failed. No success has been reported.",
        { cause: error },
      );
  };
  return {
    async getProfile() {
      const { db, userId } = await session();
      const { data, error } = await db
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      failure(error);
      if (!data) throw new Error("Profile not found");
      return mapProfile(data);
    },
    async updateProfile(input) {
      const { db, userId } = await session();
      const { data, error } = await db
        .from("profiles")
        .update({
          display_name: input.displayName,
          ...(input.postcode !== undefined ? { postcode: input.postcode } : {}),
        })
        .eq("id", userId)
        .select("*")
        .single();
      failure(error);
      if (!data) throw new Error("Profile not found");
      return mapProfile(data);
    },
    async listVehicles() {
      const { db, userId } = await session();
      const { data, error } = await db
        .from("user_vehicles")
        .select("*")
        .eq("user_id", userId)
        .order("created_at");
      failure(error);
      return (data ?? []).map(mapUserVehicle);
    },
    async addVehicle(input) {
      const { db, userId } = await session();
      const { data, error } = await db
        .from("user_vehicles")
        .insert({
          user_id: userId,
          vehicle_id: input.vehicleId,
          nickname: input.nickname,
          registration: input.registration,
          efficiency_override: input.efficiencyOverride,
        })
        .select("*")
        .single();
      failure(error);
      if (!data) throw new Error("Vehicle was not saved");
      return mapUserVehicle(data);
    },
    async removeVehicle(id) {
      const { db } = await session();
      const { error } = await db.rpc("remove_user_vehicle", {
        p_user_vehicle_id: id,
      });
      failure(error);
    },
    async updateVehicle(id, input) {
      const { db, userId } = await session();
      const { data, error } = await db
        .from("user_vehicles")
        .update({
          nickname: input.nickname,
          efficiency_override: input.efficiencyOverride,
        })
        .eq("id", id)
        .eq("user_id", userId)
        .select("*")
        .single();
      failure(error);
      if (!data) throw new Error("The car was not updated");
      return mapUserVehicle(data);
    },
    async setDefaultVehicle(id) {
      const { db } = await session();
      const { error } = await db.rpc("set_default_user_vehicle", {
        p_user_vehicle_id: id,
      });
      failure(error);
    },
    async listFavourites() {
      const { db, userId } = await session();
      const { data, error } = await db
        .from("favourites")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      failure(error);
      return (data ?? []).map(mapFavourite);
    },
    async addFavourite(locationId) {
      const { db, userId } = await session();
      const { data, error } = await db
        .from("favourites")
        .upsert(
          { user_id: userId, location_id: locationId },
          { onConflict: "user_id,location_id" },
        )
        .select("*")
        .single();
      failure(error);
      if (!data) throw new Error("Favourite was not saved");
      return mapFavourite(data);
    },
    async removeFavourite(locationId) {
      const { db, userId } = await session();
      const { error } = await db
        .from("favourites")
        .delete()
        .eq("user_id", userId)
        .eq("location_id", locationId);
      failure(error);
    },
    async createReport(input) {
      const { db, userId } = await session();
      const { data, error } = await db
        .from("user_reports")
        .insert({
          user_id: userId,
          location_id: input.locationId,
          evse_id: input.evseId,
          report_type: input.reportType,
          comment: input.comment,
        })
        .select("*")
        .single();
      failure(error);
      if (!data) throw new Error("Report was not saved");
      return mapReport(data);
    },
    async listJourneys() {
      const { db, userId } = await session();
      const { data, error } = await db
        .from("journeys")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      failure(error);
      return (data ?? []).map(mapJourney);
    },
    async createJourney(input) {
      const { db, userId } = await session();
      const { data, error } = await db
        .from("journeys")
        .insert({
          user_id: userId,
          vehicle_id: input.vehicleId,
          origin: { ...input.origin },
          destination: { ...input.destination },
          starting_battery_percent: input.startingBatteryPercent,
          minimum_arrival_percent: input.minimumArrivalPercent,
          route_mode: input.routeMode,
        })
        .select("*")
        .single();
      failure(error);
      if (!data) throw new Error("Journey was not saved");
      return mapJourney(data);
    },
  };
}
