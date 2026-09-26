import type { Json, Row } from "../../lib/supabase/database.types";
import { parseChargingCurve } from "../../lib/charging-curves";
import type {
  ChargingLocation,
  Evse,
  ChargingConnector,
  Tariff,
  Operator,
  VehicleModel,
  Profile,
  UserVehicle,
  Favourite,
  UserReport,
  Journey,
  JourneyPlace,
  JourneyStop,
} from "../../domain/models";

const timestamps = (row: { created_at: string; updated_at: string }) => ({
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
const object = (value: Json) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

export function mapVehicle(row: Row<"vehicles">): VehicleModel {
  const curve = parseChargingCurve(row.charging_curve);
  return {
    ...timestamps(row),
    id: row.id,
    manufacturer: row.manufacturer,
    model: row.model,
    variant: row.variant,
    modelYear: row.model_year,
    usableBatteryKwh: row.usable_battery_kwh,
    grossBatteryKwh: row.gross_battery_kwh,
    maxAcKw: row.max_ac_kw,
    maxDcKw: row.max_dc_kw,
    connectorTypes: row.connector_types,
    efficiencyMilesPerKwh: row.efficiency_miles_per_kwh,
    estimatedRangeMiles: row.estimated_range_miles,
    chargingCurve: curve.bands,
    chargingCurveIssue: curve.issue ?? undefined,
    source: row.source,
    isDemo: row.is_demo,
  };
}
export const mapLocation = (
  row: Row<"charging_locations">,
): ChargingLocation => ({
  ...timestamps(row),
  id: row.id,
  externalId: row.external_id,
  provider: row.provider,
  operatorId: row.operator_id,
  name: row.name,
  address: row.address,
  postcode: row.postcode,
  latitude: row.latitude,
  longitude: row.longitude,
  accessType: row.access_type,
  openingHours: object(row.opening_hours),
  isPublic: row.is_public,
  isCommunity: row.is_community,
  isDemo: row.is_demo,
  demoMetadata: object(row.demo_metadata),
  lastUpdated: row.last_updated,
});
export const mapEvse = (row: Row<"evses">): Evse => ({
  ...timestamps(row),
  id: row.id,
  locationId: row.location_id,
  externalId: row.external_id,
  status: row.status,
  lastStatusUpdate: row.last_status_update,
});
export const mapConnector = (row: Row<"connectors">): ChargingConnector => ({
  ...timestamps(row),
  id: row.id,
  evseId: row.evse_id,
  connectorType: row.connector_type,
  maxPowerKw: row.max_power_kw,
  voltage: row.voltage,
  amperage: row.amperage,
});
export const mapTariff = (row: Row<"tariffs">): Tariff => ({
  ...timestamps(row),
  id: row.id,
  locationId: row.location_id,
  operatorId: row.operator_id,
  pricePerKwh: row.price_per_kwh,
  connectionFee: row.connection_fee,
  parkingFee: row.parking_fee,
  parkingFeeUnit: row.parking_fee_unit,
  currency: row.currency,
  validFrom: row.valid_from,
  validTo: row.valid_to,
  isDemo: row.is_demo,
});
export const mapOperator = (row: Row<"operators">): Operator => ({
  ...timestamps(row),
  id: row.id,
  name: row.name,
  slug: row.slug,
  website: row.website,
  logoUrl: row.logo_url,
});
export const mapProfile = (row: Row<"profiles">): Profile => ({
  ...timestamps(row),
  id: row.id,
  displayName: row.display_name,
  postcode: row.postcode,
});
export const mapUserVehicle = (row: Row<"user_vehicles">): UserVehicle => ({
  ...timestamps(row),
  id: row.id,
  userId: row.user_id,
  vehicleId: row.vehicle_id,
  nickname: row.nickname,
  registration: row.registration,
  isDefault: row.is_default,
  efficiencyOverride: row.efficiency_override,
});
export const mapFavourite = (row: Row<"favourites">): Favourite => ({
  userId: row.user_id,
  locationId: row.location_id,
  createdAt: row.created_at,
});
export const mapReport = (row: Row<"user_reports">): UserReport => ({
  id: row.id,
  userId: row.user_id,
  locationId: row.location_id,
  evseId: row.evse_id,
  reportType: row.report_type,
  comment: row.comment,
  createdAt: row.created_at,
});
function place(value: Json): JourneyPlace {
  const data = object(value);
  if (typeof data.label !== "string" || !data.label.trim())
    throw new Error("Journey place requires a label");
  return {
    label: data.label,
    ...(typeof data.latitude === "number" ? { latitude: data.latitude } : {}),
    ...(typeof data.longitude === "number"
      ? { longitude: data.longitude }
      : {}),
  };
}
export const mapJourney = (row: Row<"journeys">): Journey => ({
  ...timestamps(row),
  id: row.id,
  userId: row.user_id,
  vehicleId: row.vehicle_id,
  origin: place(row.origin),
  destination: place(row.destination),
  startingBatteryPercent: row.starting_battery_percent,
  minimumArrivalPercent: row.minimum_arrival_percent,
  routeMode: row.route_mode,
});
export const mapJourneyStop = (row: Row<"journey_stops">): JourneyStop => ({
  journeyId: row.journey_id,
  locationId: row.location_id,
  sequence: row.sequence,
  arrivalBatteryPercent: row.arrival_battery_percent,
  departureBatteryPercent: row.departure_battery_percent,
  estimatedMinutes: row.estimated_minutes,
  estimatedCost: row.estimated_cost,
  currency: row.currency,
});
