/** Hand-maintained PostgREST schema contract. Regenerate with `pnpm db:types` after migrations. */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
export type ConnectorType = "CCS" | "Type 2" | "CHAdeMO";
export type EvseStatus =
  "available" | "charging" | "occupied" | "unavailable" | "faulted" | "unknown";
export type ReportType =
  | "working"
  | "not_working"
  | "queue"
  | "payment_problem"
  | "slow_charging"
  | "blocked_bay"
  | "incorrect_availability";
type Timestamped = { created_at: string; updated_at: string };
type Table<Row, Required extends keyof Row> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>;
  Update: Partial<Row>;
  Relationships: [];
};
export type ProfileRow = Timestamped & {
  id: string;
  display_name: string;
  postcode: string | null;
};
export type VehicleRow = Timestamped & {
  id: string;
  manufacturer: string;
  model: string;
  variant: string;
  model_year: number | null;
  usable_battery_kwh: number;
  gross_battery_kwh: number | null;
  max_ac_kw: number;
  max_dc_kw: number;
  connector_types: ConnectorType[];
  efficiency_miles_per_kwh: number;
  estimated_range_miles: number;
  charging_curve: Json;
  source: string;
  is_demo: boolean;
};
export type UserVehicleRow = Timestamped & {
  id: string;
  user_id: string;
  vehicle_id: string;
  nickname: string | null;
  registration: string | null;
  is_default: boolean;
  efficiency_override: number | null;
};
export type OperatorRow = Timestamped & {
  id: string;
  name: string;
  slug: string;
  website: string | null;
  logo_url: string | null;
};
export type LocationRow = Timestamped & {
  id: string;
  external_id: string;
  provider: string;
  operator_id: string;
  name: string;
  address: string;
  postcode: string;
  latitude: number;
  longitude: number;
  access_type: "public" | "customers" | "restricted" | "private";
  opening_hours: Json;
  is_public: boolean;
  is_community: boolean;
  is_demo: boolean;
  demo_metadata: Json;
  last_updated: string;
};
export type EvseRow = Timestamped & {
  id: string;
  location_id: string;
  external_id: string;
  status: EvseStatus;
  last_status_update: string;
};
export type ConnectorRow = Timestamped & {
  id: string;
  evse_id: string;
  connector_type: ConnectorType;
  max_power_kw: number;
  voltage: number | null;
  amperage: number | null;
};
export type TariffRow = Timestamped & {
  id: string;
  location_id: string;
  operator_id: string;
  price_per_kwh: number;
  connection_fee: number | null;
  parking_fee: number | null;
  parking_fee_unit: "per_hour" | "per_session";
  currency: string;
  valid_from: string | null;
  valid_to: string | null;
  is_demo: boolean;
};
export type FacilityRow = { id: string; code: string; display_name: string };
export type LocationFacilityRow = { location_id: string; facility_id: string };
export type HistoryRow = {
  id: string;
  evse_id: string;
  status: EvseStatus;
  recorded_at: string;
};
export type FavouriteRow = {
  user_id: string;
  location_id: string;
  created_at: string;
};
export type ReportRow = {
  id: string;
  user_id: string | null;
  location_id: string;
  evse_id: string | null;
  report_type: ReportType;
  comment: string | null;
  created_at: string;
};
export type JourneyRow = Timestamped & {
  id: string;
  user_id: string;
  vehicle_id: string;
  origin: Json;
  destination: Json;
  starting_battery_percent: number;
  minimum_arrival_percent: number;
  route_mode: "balanced" | "cheapest" | "fastest";
};
export type JourneyStopRow = {
  journey_id: string;
  location_id: string;
  sequence: number;
  arrival_battery_percent: number;
  departure_battery_percent: number;
  estimated_minutes: number;
  estimated_cost: number;
  currency: string;
};
export type CommunityChargerRow = Timestamped & {
  id: string;
  owner_id: string;
  location_id: string;
  description: string | null;
  is_active: boolean;
};
export type CommunityAvailabilityRow = Timestamped & {
  id: string;
  community_charger_id: string;
  starts_at: string;
  ends_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, "id">;
      vehicles: Table<
        VehicleRow,
        | "manufacturer"
        | "model"
        | "usable_battery_kwh"
        | "max_ac_kw"
        | "max_dc_kw"
        | "connector_types"
        | "efficiency_miles_per_kwh"
        | "estimated_range_miles"
        | "source"
      >;
      user_vehicles: Table<UserVehicleRow, "user_id" | "vehicle_id">;
      operators: Table<OperatorRow, "name" | "slug">;
      charging_locations: Table<
        LocationRow,
        | "external_id"
        | "provider"
        | "operator_id"
        | "name"
        | "address"
        | "postcode"
        | "latitude"
        | "longitude"
      >;
      evses: Table<EvseRow, "location_id" | "external_id">;
      connectors: Table<
        ConnectorRow,
        "evse_id" | "connector_type" | "max_power_kw"
      >;
      tariffs: Table<
        TariffRow,
        "location_id" | "operator_id" | "price_per_kwh"
      >;
      facilities: Table<FacilityRow, "code" | "display_name">;
      location_facilities: Table<
        LocationFacilityRow,
        "location_id" | "facility_id"
      >;
      charger_status_history: Table<HistoryRow, "evse_id" | "status">;
      favourites: Table<FavouriteRow, "user_id" | "location_id">;
      user_reports: Table<ReportRow, "location_id" | "report_type">;
      journeys: Table<
        JourneyRow,
        | "user_id"
        | "vehicle_id"
        | "origin"
        | "destination"
        | "starting_battery_percent"
      >;
      journey_stops: Table<
        JourneyStopRow,
        | "journey_id"
        | "location_id"
        | "sequence"
        | "arrival_battery_percent"
        | "departure_battery_percent"
        | "estimated_minutes"
        | "estimated_cost"
      >;
      community_chargers: Table<
        CommunityChargerRow,
        "owner_id" | "location_id"
      >;
      community_availability: Table<
        CommunityAvailabilityRow,
        "community_charger_id" | "starts_at" | "ends_at"
      >;
    };
    Views: { [_ in never]: never };
    Functions: {
      set_default_user_vehicle: {
        Args: { p_user_vehicle_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      connector_type: ConnectorType;
      evse_status: EvseStatus;
      report_type: ReportType;
      access_type: "public" | "customers" | "restricted" | "private";
      parking_fee_unit: "per_hour" | "per_session";
      route_mode: "balanced" | "cheapest" | "fastest";
    };
    CompositeTypes: { [_ in never]: never };
  };
};
export type Row<Name extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][Name]["Row"];
