import type {
  ChargingCurveBand,
  CurveIssue,
  ChargingQuote,
  EfficiencySource,
} from "./charging";
import type { DataProvenance } from "./charging-data";
export type Connector = "CCS" | "Type 2" | "CHAdeMO";
export type ChargerStatus = "Available" | "Busy" | "Unavailable" | "Unknown";

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  trim: string;
  batteryKwh: number;
  estimatedRangeMiles: number;
  maxDcKw: number;
  maxAcKw: number;
  connectors: Connector[];
  imageTone: "blue" | "mint" | "violet";
  efficiencyMilesPerKwh?: number;
  efficiencySource?: EfficiencySource;
  chargingCurve?: ChargingCurveBand[];
  chargingCurveIssue?: CurveIssue;
  isDemo?: boolean;
}

export interface Charger {
  id: string;
  name: string;
  network: string;
  location: string;
  postcode: string;
  distanceMiles: number | null;
  maxKw: number;
  connector: Connector;
  pricePencePerKwh: number | null;
  connectionFeePence: number | null;
  status: ChargerStatus;
  reliabilityPercent: number | null;
  stalls: number | null;
  availableStalls: number | null;
  x: number;
  y: number;
  locationId?: string;
  isDemo?: boolean;
  provenance?: DataProvenance;
  availabilityProvenance?: DataProvenance;
  tariffProvenance?: DataProvenance;
  tariffDescription?: string | null;
}

export interface ChargingEstimate {
  details: ChargingQuote;
  costPer100Miles: number;
  costToTarget: number;
  timeToTargetMinutes: number;
  effectiveKw: number;
  energyNeededKwh: number;
}
