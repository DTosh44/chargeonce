import type {
  CalculationVehicle,
  ChargingInput,
  ChargingQuote,
  HundredMileEstimate,
  SessionEstimate,
} from "../domain/charging";
import { fallbackChargingCurve, parseChargingCurve } from "./charging-curves";

/** Engineering assumption, not a measured loss for a particular car or charger. */
export const DEFAULT_CHARGING_LOSS_PERCENT = 10;
export class ChargingInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChargingInputError";
  }
}
function finite(value: number, label: string, minimum = 0, maximum = Infinity) {
  if (!Number.isFinite(value) || value < minimum || value > maximum)
    throw new ChargingInputError(
      `${label} must be a finite number between ${minimum} and ${maximum === Infinity ? "a sensible positive value" : maximum}.`,
    );
  return value;
}
function positive(value: number, label: string) {
  finite(value, label);
  if (value === 0)
    throw new ChargingInputError(`${label} must be greater than zero.`);
  return value;
}
function efficiency(vehicle: CalculationVehicle) {
  return positive(vehicle.efficiencyMilesPerKwh, "Efficiency (miles/kWh)");
}
function retention(lossPercent: number) {
  finite(lossPercent, "Charging losses (%)", 0, 100);
  if (lossPercent === 100)
    throw new ChargingInputError("Charging losses must be less than 100%.");
  return 1 - lossPercent / 100;
}
function ensureFiniteResult(...values: number[]) {
  if (values.some((value) => !Number.isFinite(value)))
    throw new ChargingInputError(
      "These inputs are outside the supported calculation range.",
    );
}

export function batteryEnergyRequired(
  usableBatteryKwh: number,
  currentSocPercent: number,
  targetSocPercent: number,
): number {
  positive(usableBatteryKwh, "Usable battery (kWh)");
  finite(currentSocPercent, "Current battery (%)", 0, 100);
  finite(targetSocPercent, "Target battery (%)", 0, 100);
  if (targetSocPercent < currentSocPercent)
    throw new ChargingInputError(
      "Target battery must be at least the current battery level.",
    );
  const energy =
    usableBatteryKwh * ((targetSocPercent - currentSocPercent) / 100);
  ensureFiniteResult(energy);
  return energy;
}
export function billedEnergyRequired(
  batteryEnergyKwh: number,
  lossPercent = DEFAULT_CHARGING_LOSS_PERCENT,
): number {
  finite(batteryEnergyKwh, "Battery energy (kWh)");
  const energy = batteryEnergyKwh / retention(lossPercent);
  ensureFiniteResult(energy);
  return energy;
}
export function rangeAdded(
  batteryEnergyKwh: number,
  efficiencyMilesPerKwh: number,
): number {
  finite(batteryEnergyKwh, "Battery energy (kWh)");
  positive(efficiencyMilesPerKwh, "Efficiency (miles/kWh)");
  const miles = batteryEnergyKwh * efficiencyMilesPerKwh;
  ensureFiniteResult(miles);
  return miles;
}
/** Consumption benchmark, excluding session fees. It is not a promise that 100 miles fits in one charge. */
export function costToAdd100Miles(
  efficiencyMilesPerKwh: number,
  pricePerKwhPounds: number,
  lossPercent = DEFAULT_CHARGING_LOSS_PERCENT,
): HundredMileEstimate {
  positive(efficiencyMilesPerKwh, "Efficiency (miles/kWh)");
  finite(pricePerKwhPounds, "Price per kWh (£)");
  const batteryEnergyKwh = 100 / efficiencyMilesPerKwh;
  const billedEnergyKwh = billedEnergyRequired(batteryEnergyKwh, lossPercent);
  const costPounds = billedEnergyKwh * pricePerKwhPounds;
  ensureFiniteResult(batteryEnergyKwh, costPounds);
  return { batteryEnergyKwh, billedEnergyKwh, costPounds };
}

export function estimateChargingSession(input: ChargingInput): SessionEstimate {
  const { vehicle, charger, currentSocPercent, targetSocPercent } = input;
  const lossPercent = input.lossPercent ?? DEFAULT_CHARGING_LOSS_PERCENT;
  const batteryEnergyKwh = batteryEnergyRequired(
    vehicle.usableBatteryKwh,
    currentSocPercent,
    targetSocPercent,
  );
  const billedEnergyKwh = billedEnergyRequired(batteryEnergyKwh, lossPercent);
  efficiency(vehicle);
  if (charger.mode !== "ac" && charger.mode !== "dc")
    throw new ChargingInputError("Choose AC or DC charging.");
  finite(vehicle.maxAcKw, "Vehicle maximum AC power (kW)");
  finite(vehicle.maxDcKw, "Vehicle maximum DC power (kW)");
  if (vehicle.supportedModes && !vehicle.supportedModes.includes(charger.mode))
    throw new ChargingInputError(
      `This car does not support ${charger.mode.toUpperCase()} charging. Choose a compatible charging type.`,
    );
  const maximumKw = positive(
    charger.mode === "ac" ? vehicle.maxAcKw : vehicle.maxDcKw,
    "Vehicle charging power (kW)",
  );
  positive(charger.powerKw, "Charger power (kW)");
  finite(charger.pricePerKwhPounds, "Price per kWh (£)");
  const fee = finite(charger.connectionFeePounds ?? 0, "Connection fee (£)");
  const parsed = parseChargingCurve(vehicle.chargingCurve);
  const useVehicleCurve = charger.mode === "dc" && parsed.bands.length > 0;
  const curve = useVehicleCurve
    ? parsed.bands
    : fallbackChargingCurve(charger.mode, maximumKw);
  const segments = curve.flatMap((band) => {
    const fromSocPercent = Math.max(currentSocPercent, band.fromSocPercent);
    const toSocPercent = Math.min(targetSocPercent, band.toSocPercent);
    if (toSocPercent <= fromSocPercent) return [];
    const effectivePowerKw = Math.min(band.powerKw, maximumKw, charger.powerKw);
    const stored = batteryEnergyRequired(
      vehicle.usableBatteryKwh,
      fromSocPercent,
      toSocPercent,
    );
    const billed = billedEnergyRequired(stored, lossPercent);
    return [
      {
        ...band,
        fromSocPercent,
        toSocPercent,
        effectivePowerKw,
        batteryEnergyKwh: stored,
        billedEnergyKwh: billed,
        minutes: (billed / effectivePowerKw) * 60,
      },
    ];
  });
  const timeMinutes = segments.reduce(
    (sum, segment) => sum + segment.minutes,
    0,
  );
  const energyCostPounds = billedEnergyKwh * charger.pricePerKwhPounds;
  const connectionFeePounds = batteryEnergyKwh > 0 ? fee : 0;
  const totalCostPounds = energyCostPounds + connectionFeePounds;
  const milesAdded = rangeAdded(
    batteryEnergyKwh,
    vehicle.efficiencyMilesPerKwh,
  );
  const peakPowerKw = segments.reduce(
    (peak, segment) => Math.max(peak, segment.effectivePowerKw),
    0,
  );
  const averagePowerKw =
    timeMinutes > 0 ? billedEnergyKwh / (timeMinutes / 60) : 0;
  ensureFiniteResult(timeMinutes, totalCostPounds, averagePowerKw);
  return {
    batteryEnergyKwh,
    billedEnergyKwh,
    lossEnergyKwh: billedEnergyKwh - batteryEnergyKwh,
    currentSocPercent,
    targetSocPercent,
    milesAdded,
    energyCostPounds,
    connectionFeePounds,
    totalCostPounds,
    timeMinutes,
    peakPowerKw,
    averagePowerKw,
    segments,
    assumptions: {
      lossPercent,
      curveSource: useVehicleCurve
        ? "vehicle"
        : charger.mode === "ac"
          ? "fallback_ac"
          : "fallback_dc",
      curveIssue:
        charger.mode === "ac" || useVehicleCurve
          ? null
          : (vehicle.chargingCurveIssue ?? parsed.issue),
      efficiencySource: vehicle.efficiencySource ?? "catalogue",
      isDemo: vehicle.isDemo ?? false,
    },
  };
}
export function calculateChargingQuote(input: ChargingInput): ChargingQuote {
  const session = estimateChargingSession(input);
  return {
    session,
    to80: estimateChargingSession({
      ...input,
      targetSocPercent: Math.max(80, input.currentSocPercent),
    }),
    hundredMiles: costToAdd100Miles(
      input.vehicle.efficiencyMilesPerKwh,
      input.charger.pricePerKwhPounds,
      input.lossPercent,
    ),
    alreadyAt80: input.currentSocPercent >= 80,
  };
}

export function parseCalculatorNumber(value: string, label: string): number {
  if (!value.trim()) throw new ChargingInputError(`Enter ${label}.`);
  const number = Number(value);
  if (!Number.isFinite(number))
    throw new ChargingInputError(`Enter a valid number for ${label}.`);
  return number;
}

/** Empty/invalid fields are errors, never silent zero-price or zero-time quotes. */
export function calculatorQuote(
  vehicle: CalculationVehicle,
  values: {
    current: string;
    target: string;
    pricePence: string;
    powerKw: string;
    lossPercent: string;
    mode: "ac" | "dc";
  },
): { quote: ChargingQuote; error: null } | { quote: null; error: string } {
  try {
    const pricePence = parseCalculatorNumber(
      values.pricePence,
      "the price per kWh",
    );
    const lossPercent = parseCalculatorNumber(
      values.lossPercent,
      "charging losses",
    );
    finite(lossPercent, "Calculator charging losses (%)", 0, 50);
    return {
      quote: calculateChargingQuote({
        vehicle,
        charger: {
          mode: values.mode,
          powerKw: parseCalculatorNumber(values.powerKw, "charger power"),
          pricePerKwhPounds: pricePence / 100,
        },
        currentSocPercent: parseCalculatorNumber(
          values.current,
          "the current battery percentage",
        ),
        targetSocPercent: parseCalculatorNumber(
          values.target,
          "the target battery percentage",
        ),
        lossPercent,
      }),
      error: null,
    };
  } catch (error) {
    return {
      quote: null,
      error:
        error instanceof ChargingInputError
          ? error.message
          : "We couldn’t calculate this estimate. Please check your inputs.",
    };
  }
}
