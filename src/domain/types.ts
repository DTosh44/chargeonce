export type Connector = "CCS" | "Type 2" | "CHAdeMO";
export type ChargerStatus = "Available" | "Busy" | "Unknown";

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
}

export interface Charger {
  id: string;
  name: string;
  network: string;
  location: string;
  postcode: string;
  distanceMiles: number;
  maxKw: number;
  connector: Connector;
  pricePencePerKwh: number;
  connectionFeePence: number;
  status: ChargerStatus;
  reliabilityPercent: number;
  stalls: number;
  availableStalls: number | null;
  x: number;
  y: number;
}

export interface ChargingEstimate {
  costPer100Miles: number;
  costToTarget: number;
  timeToTargetMinutes: number;
  effectiveKw: number;
  energyNeededKwh: number;
}
