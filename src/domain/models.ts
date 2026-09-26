/** Application models: camelCase, provider-independent, and safe to pass to UI. */
import type { Connector } from "./types";
import type { ChargingCurveBand, CurveIssue } from "./charging";

export type UUID = string;
export type ISODateTime = string;
export type EvseStatus =
  "available" | "charging" | "occupied" | "unavailable" | "faulted" | "unknown";
export type AccessType = "public" | "customers" | "restricted" | "private";
export type ReportType =
  | "working"
  | "not_working"
  | "queue"
  | "payment_problem"
  | "slow_charging"
  | "blocked_bay"
  | "incorrect_availability";
export type RouteMode = "balanced" | "cheapest" | "fastest";
export type ParkingFeeUnit = "per_hour" | "per_session";
export type FacilityCode =
  | "toilets"
  | "cafe"
  | "restaurant"
  | "shop"
  | "wifi"
  | "24_hour"
  | "accessible_toilet"
  | "lighting";
export type StructuredData = { [key: string]: unknown };
export interface Timestamps {
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
export interface Profile extends Timestamps {
  id: UUID;
  displayName: string;
  postcode: string | null;
}
export interface VehicleModel extends Timestamps {
  id: UUID;
  manufacturer: string;
  model: string;
  variant: string;
  modelYear: number | null;
  usableBatteryKwh: number;
  grossBatteryKwh: number | null;
  maxAcKw: number;
  maxDcKw: number;
  connectorTypes: Connector[];
  efficiencyMilesPerKwh: number;
  estimatedRangeMiles: number;
  chargingCurve: ChargingCurveBand[];
  chargingCurveIssue?: CurveIssue;
  source: string;
  isDemo: boolean;
}
export interface UserVehicle extends Timestamps {
  id: UUID;
  userId: UUID;
  vehicleId: UUID;
  nickname: string | null;
  registration: string | null;
  isDefault: boolean;
  efficiencyOverride: number | null;
}
export interface Operator extends Timestamps {
  id: UUID;
  name: string;
  slug: string;
  website: string | null;
  logoUrl: string | null;
}
export interface ChargingLocation extends Timestamps {
  id: UUID;
  externalId: string;
  provider: string;
  operatorId: UUID;
  name: string;
  address: string;
  postcode: string;
  latitude: number;
  longitude: number;
  accessType: AccessType;
  openingHours: StructuredData;
  isPublic: boolean;
  isCommunity: boolean;
  isDemo: boolean;
  demoMetadata: StructuredData;
  lastUpdated: ISODateTime;
}
export interface Evse extends Timestamps {
  id: UUID;
  locationId: UUID;
  externalId: string;
  status: EvseStatus;
  lastStatusUpdate: ISODateTime;
}
export interface ChargingConnector extends Timestamps {
  id: UUID;
  evseId: UUID;
  connectorType: Connector;
  maxPowerKw: number;
  voltage: number | null;
  amperage: number | null;
}
export interface Tariff extends Timestamps {
  id: UUID;
  locationId: UUID;
  operatorId: UUID;
  pricePerKwh: number;
  connectionFee: number | null;
  parkingFee: number | null;
  parkingFeeUnit: ParkingFeeUnit;
  currency: string;
  validFrom: ISODateTime | null;
  validTo: ISODateTime | null;
  isDemo: boolean;
}
export interface Facility {
  id: UUID;
  code: string;
  displayName: string;
}
export interface LocationFacility {
  locationId: UUID;
  facilityId: UUID;
}
export interface ChargerStatusHistory {
  id: UUID;
  evseId: UUID;
  status: EvseStatus;
  recordedAt: ISODateTime;
}
export interface Favourite {
  userId: UUID;
  locationId: UUID;
  createdAt: ISODateTime;
}
export interface UserReport {
  id: UUID;
  userId: UUID | null;
  locationId: UUID;
  evseId: UUID | null;
  reportType: ReportType;
  comment: string | null;
  createdAt: ISODateTime;
}
export interface JourneyPlace {
  label: string;
  latitude?: number;
  longitude?: number;
}
export interface Journey extends Timestamps {
  id: UUID;
  userId: UUID;
  vehicleId: UUID;
  origin: JourneyPlace;
  destination: JourneyPlace;
  startingBatteryPercent: number;
  minimumArrivalPercent: number;
  routeMode: RouteMode;
}
export interface JourneyStop {
  journeyId: UUID;
  locationId: UUID;
  sequence: number;
  arrivalBatteryPercent: number;
  departureBatteryPercent: number;
  estimatedMinutes: number;
  estimatedCost: number;
  currency: string;
}
export interface CommunityCharger extends Timestamps {
  id: UUID;
  ownerId: UUID;
  locationId: UUID;
  description: string | null;
  isActive: boolean;
}
export interface CommunityAvailability extends Timestamps {
  id: UUID;
  communityChargerId: UUID;
  startsAt: ISODateTime;
  endsAt: ISODateTime;
}
