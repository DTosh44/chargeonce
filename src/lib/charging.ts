import type { Charger, ChargingEstimate, Vehicle } from "@/domain/types";
import { siteConfig } from "../config/site";

const TAPER_FACTOR = 0.78;

export function isCompatible(vehicle: Vehicle, charger: Charger): boolean {
  return vehicle.connectors.includes(charger.connector);
}

export function estimateCharge(
  vehicle: Vehicle,
  charger: Charger,
  currentPercent = 20,
  targetPercent = 80,
): ChargingEstimate {
  const current = Math.max(0, Math.min(100, currentPercent));
  const target = Math.max(current, Math.min(100, targetPercent));
  const energyNeededKwh = (vehicle.batteryKwh * (target - current)) / 100;
  const vehicleLimit =
    charger.connector === "Type 2" ? vehicle.maxAcKw : vehicle.maxDcKw;
  const effectiveKw = Math.min(vehicleLimit, charger.maxKw);
  const rate = charger.pricePencePerKwh / 100;

  return {
    costPer100Miles:
      (vehicle.batteryKwh / vehicle.estimatedRangeMiles) * 100 * rate,
    costToTarget:
      energyNeededKwh * rate +
      (energyNeededKwh > 0 ? charger.connectionFeePence / 100 : 0),
    timeToTargetMinutes:
      effectiveKw > 0
        ? (energyNeededKwh / (effectiveKw * TAPER_FACTOR)) * 60
        : 0,
    effectiveKw,
    energyNeededKwh,
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

export function recommendedChargers(vehicle: Vehicle, options: Charger[]) {
  const compatible = options.filter((charger) =>
    isCompatible(vehicle, charger),
  );
  const available = compatible.filter(
    (charger) => charger.status === "Available",
  );
  const pool = available.length ? available : compatible;
  return {
    best: [...pool].sort((a, b) => score(b, vehicle) - score(a, vehicle))[0],
    cheapest: [...pool].sort(
      (a, b) =>
        estimateCharge(vehicle, a).costToTarget -
        estimateCharge(vehicle, b).costToTarget,
    )[0],
    fastest: [...pool].sort(
      (a, b) =>
        estimateCharge(vehicle, a).timeToTargetMinutes -
        estimateCharge(vehicle, b).timeToTargetMinutes,
    )[0],
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
