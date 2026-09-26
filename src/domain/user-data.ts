import type {
  Favourite,
  Journey,
  JourneyPlace,
  Profile,
  ReportType,
  RouteMode,
  UserReport,
  UserVehicle,
  UUID,
} from "./models";

export interface AddUserVehicleInput {
  vehicleId: UUID;
  nickname?: string;
  registration?: string;
  efficiencyOverride?: number;
}
export interface ReportInput {
  locationId: UUID;
  evseId?: UUID;
  reportType: ReportType;
  comment?: string;
}
export interface JourneyInput {
  vehicleId: UUID;
  origin: JourneyPlace;
  destination: JourneyPlace;
  startingBatteryPercent: number;
  minimumArrivalPercent?: number;
  routeMode?: RouteMode;
}

/** Authentication identity is resolved by the repository, never supplied by the UI. */
export interface UserDataRepository {
  getProfile(): Promise<Profile>;
  updateProfile(input: {
    displayName: string;
    postcode?: string | null;
  }): Promise<Profile>;
  listVehicles(): Promise<UserVehicle[]>;
  addVehicle(input: AddUserVehicleInput): Promise<UserVehicle>;
  removeVehicle(id: UUID): Promise<void>;
  setDefaultVehicle(id: UUID): Promise<void>;
  listFavourites(): Promise<Favourite[]>;
  addFavourite(locationId: UUID): Promise<Favourite>;
  removeFavourite(locationId: UUID): Promise<void>;
  createReport(input: ReportInput): Promise<UserReport>;
  listJourneys(): Promise<Journey[]>;
  createJourney(input: JourneyInput): Promise<Journey>;
}

export class PersistenceUnavailableError extends Error {
  constructor() {
    super(
      "Persistent user data requires a configured Supabase project. No data has been saved.",
    );
    this.name = "PersistenceUnavailableError";
  }
}
export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Sign in before accessing private records.");
    this.name = "AuthenticationRequiredError";
  }
}
