import type { Charger, Vehicle } from "../domain/types";
import { calculationCharger, calculationVehicle } from "./charging";
import { ChargingInputError, estimateChargingSession } from "./charging-engine";

/** Illustrative 10–80% stop allowance, not a route/geospatial charger planner. */
export function estimateJourneyCharging(
  vehicle: Vehicle,
  charger: Charger | undefined,
  distanceMiles: number,
  startingSocPercent: number,
) {
  if (
    !Number.isFinite(distanceMiles) ||
    distanceMiles < 0 ||
    !Number.isFinite(startingSocPercent) ||
    startingSocPercent < 10 ||
    startingSocPercent > 100
  )
    throw new ChargingInputError(
      "Enter a valid journey distance and starting battery between 10% and 100%.",
    );
  const car = calculationVehicle(vehicle);
  if (
    !Number.isFinite(car.efficiencyMilesPerKwh) ||
    car.efficiencyMilesPerKwh <= 0 ||
    !Number.isFinite(car.usableBatteryKwh) ||
    car.usableBatteryKwh <= 0
  )
    throw new ChargingInputError(
      "This vehicle has invalid battery or efficiency data.",
    );
  const usableMiles =
    car.usableBatteryKwh *
    car.efficiencyMilesPerKwh *
    ((startingSocPercent - 10) / 100);
  const deficitMiles = Math.max(0, distanceMiles - usableMiles);
  const energyAtStop = deficitMiles / car.efficiencyMilesPerKwh;
  const windowEnergy = car.usableBatteryKwh * 0.7;
  const fullStops = Math.floor(energyAtStop / windowEnergy);
  // Avoid inventing a tiny extra stop from floating-point round-off at a full window.
  const remainder = energyAtStop - fullStops * windowEnergy;
  const hasPartial = remainder > 1e-9;
  const requiredTopUps = fullStops + (hasPartial ? 1 : 0);
  const needsStop = energyAtStop > 1e-9;
  let chargingCost: number | null = needsStop && !charger ? null : 0;
  let stopMinutes: number | null = needsStop && !charger ? null : 0;
  let effectiveKw = 0;
  if (needsStop && charger) {
    const input = {
      vehicle: car,
      charger: calculationCharger(charger),
      currentSocPercent: 10,
      targetSocPercent: 80,
    };
    const full = estimateChargingSession(input);
    const partial = hasPartial
      ? estimateChargingSession({
          ...input,
          targetSocPercent: Math.min(
            80,
            10 + (remainder / car.usableBatteryKwh) * 100,
          ),
        })
      : null;
    chargingCost =
      full.totalCostPounds * fullStops + (partial?.totalCostPounds ?? 0);
    stopMinutes = full.timeMinutes * fullStops + (partial?.timeMinutes ?? 0);
    effectiveKw =
      fullStops > 0 ? full.peakPowerKw : (partial?.peakPowerKw ?? 0);
  }
  return {
    usableMiles,
    deficitMiles,
    energyAtStop,
    requiredTopUps,
    effectiveKw,
    stopMinutes,
    chargingCost,
    drivingMinutes: (distanceMiles / 55) * 60,
    needsStop,
  };
}
