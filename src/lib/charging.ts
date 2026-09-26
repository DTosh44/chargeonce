import type { Charger, ChargingEstimate, Vehicle } from "@/domain/types";
import { siteConfig } from "../config/site";
import type {
  CalculationVehicle,
  CalculationCharger,
  ChargingMode,
} from "../domain/charging";
import { calculateChargingQuote } from "./charging-engine";

export function isCompatible(vehicle: Vehicle, charger: Charger): boolean {
  return (
    vehicle.connectors.includes(charger.connector) &&
    (charger.connector === "Type 2" ? vehicle.maxAcKw > 0 : vehicle.maxDcKw > 0)
  );
}

export function calculationVehicle(vehicle: Vehicle): CalculationVehicle {
  return {
    usableBatteryKwh: vehicle.batteryKwh,
    efficiencyMilesPerKwh:
      vehicle.efficiencyMilesPerKwh ??
      vehicle.estimatedRangeMiles / vehicle.batteryKwh,
    efficiencySource:
      vehicle.efficiencyMilesPerKwh == null
        ? "derived"
        : (vehicle.efficiencySource ?? "catalogue"),
    maxAcKw: vehicle.maxAcKw,
    maxDcKw: vehicle.maxDcKw,
    chargingCurve: vehicle.chargingCurve,
    chargingCurveIssue: vehicle.chargingCurveIssue,
    supportedModes: [
      ...(vehicle.connectors.includes("Type 2") ? ["ac" as ChargingMode] : []),
      ...(vehicle.connectors.some((connector) => connector !== "Type 2")
        ? ["dc" as ChargingMode]
        : []),
    ],
    isDemo: vehicle.isDemo,
  };
}
export function calculationCharger(charger: Charger): CalculationCharger {
  return {
    powerKw: charger.maxKw,
    mode: charger.connector === "Type 2" ? "ac" : "dc",
    pricePerKwhPounds: charger.pricePencePerKwh / 100,
    connectionFeePounds: charger.connectionFeePence / 100,
  };
}

export function estimateCharge(
  vehicle: Vehicle,
  charger: Charger,
  currentPercent = 20,
  targetPercent = 80,
  options: { lossPercent?: number } = {},
): ChargingEstimate {
  if (!isCompatible(vehicle, charger))
    throw new Error("This charger is not compatible with the selected car.");
  const details = calculateChargingQuote({
    vehicle: calculationVehicle(vehicle),
    charger: calculationCharger(charger),
    currentSocPercent: currentPercent,
    targetSocPercent: targetPercent,
    lossPercent: options.lossPercent,
  });
  return {
    details,
    costPer100Miles: details.hundredMiles.costPounds,
    costToTarget: details.session.totalCostPounds,
    timeToTargetMinutes: details.session.timeMinutes,
    effectiveKw: details.session.peakPowerKw,
    energyNeededKwh: details.session.batteryEnergyKwh,
  };
}

export const pounds = (amount: number) =>
  new Intl.NumberFormat(siteConfig.locale, {
    style: "currency",
    currency: siteConfig.currency,
    maximumFractionDigits: 2,
  }).format(amount);
export const minutes = (amount: number) => {
  const rounded = Math.round(amount);
  return rounded >= 60
    ? `${Math.floor(rounded / 60)}h ${String(rounded % 60).padStart(2, "0")}m`
    : `${rounded} min`;
};

/** Round uncertain session estimates, not the underlying calculations. */
export function approximatePounds(amount: number) {
  if (amount === 0) return "£0";
  if (amount < 1) return pounds(Math.max(0.1, Math.round(amount * 10) / 10));
  return new Intl.NumberFormat(siteConfig.locale, {
    style: "currency",
    currency: siteConfig.currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
export function approximateMinutes(amount: number) {
  if (amount === 0) return "No charging needed";
  if (amount < 1) return "Less than a minute";
  return `About ${minutes(amount < 5 ? Math.ceil(amount) : Math.round(amount / 5) * 5)}`;
}
export function approximateMiles(amount: number) {
  if (amount === 0) return "0 miles";
  if (amount < 1) return "Less than 1 mile";
  return `About ${amount < 5 ? Math.round(amount) : Math.max(5, Math.round(amount / 5) * 5)} miles`;
}

export function recommendedChargers(vehicle: Vehicle, options: Charger[]) {
  const compatible = options.filter((charger) =>
    isCompatible(vehicle, charger),
  );
  const available = compatible.filter(
    (charger) => charger.status === "Available",
  );
  const pool = available.length ? available : compatible;
  return {
    best: [...pool].sort((a, b) => score(b, vehicle) - score(a, vehicle)).at(0),
    cheapest: [...pool]
      .sort(
        (a, b) =>
          estimateCharge(vehicle, a).costToTarget -
          estimateCharge(vehicle, b).costToTarget,
      )
      .at(0),
    fastest: [...pool]
      .sort(
        (a, b) =>
          estimateCharge(vehicle, a).timeToTargetMinutes -
          estimateCharge(vehicle, b).timeToTargetMinutes,
      )
      .at(0),
  };
}

function score(charger: Charger, vehicle: Vehicle) {
  const estimate = estimateCharge(vehicle, charger);
  return (
    charger.reliabilityPercent * 0.45 -
    estimate.costToTarget * 0.35 -
    estimate.timeToTargetMinutes * 0.16 -
    charger.distanceMiles * 0.5
  );
}
