/** Power is accepted at the vehicle's charging input, before modelled charging losses. */
export interface ChargingCurveBand {
  fromSocPercent: number;
  toSocPercent: number;
  powerKw: number;
}
export type CurveIssue = "missing" | "invalid" | "legacy_points";
export type ChargingMode = "ac" | "dc";
export type EfficiencySource = "personal" | "catalogue" | "derived";
export interface CalculationVehicle {
  usableBatteryKwh: number;
  efficiencyMilesPerKwh: number;
  maxAcKw: number;
  maxDcKw: number;
  chargingCurve?: ChargingCurveBand[];
  chargingCurveIssue?: CurveIssue;
  efficiencySource?: EfficiencySource;
  supportedModes?: ChargingMode[];
  isDemo?: boolean;
}
export interface CalculationCharger {
  powerKw: number;
  mode: ChargingMode;
  pricePerKwhPounds: number;
  connectionFeePounds?: number;
}
export interface ChargingInput {
  vehicle: CalculationVehicle;
  charger: CalculationCharger;
  currentSocPercent: number;
  targetSocPercent: number;
  lossPercent?: number;
}
export interface ChargingSegment extends ChargingCurveBand {
  effectivePowerKw: number;
  batteryEnergyKwh: number;
  billedEnergyKwh: number;
  minutes: number;
}
export interface ChargingAssumptions {
  lossPercent: number;
  curveSource: "vehicle" | "fallback_dc" | "fallback_ac";
  curveIssue: CurveIssue | null;
  efficiencySource: EfficiencySource;
  isDemo: boolean;
}
export interface SessionEstimate {
  currentSocPercent: number;
  targetSocPercent: number;
  batteryEnergyKwh: number;
  billedEnergyKwh: number;
  lossEnergyKwh: number;
  milesAdded: number;
  energyCostPounds: number;
  connectionFeePounds: number;
  totalCostPounds: number;
  timeMinutes: number;
  peakPowerKw: number;
  averagePowerKw: number;
  segments: ChargingSegment[];
  assumptions: ChargingAssumptions;
}
export interface HundredMileEstimate {
  batteryEnergyKwh: number;
  billedEnergyKwh: number;
  costPounds: number;
}
export interface ChargingQuote {
  session: SessionEstimate;
  to80: SessionEstimate;
  hundredMiles: HundredMileEstimate;
  alreadyAt80: boolean;
}
