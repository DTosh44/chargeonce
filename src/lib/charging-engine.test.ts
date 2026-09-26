import { describe, expect, it } from "vitest";
import type {
  CalculationVehicle,
  ChargingInput,
  ChargingCurveBand,
} from "../domain/charging";
import {
  batteryEnergyRequired,
  billedEnergyRequired,
  calculateChargingQuote,
  calculatorQuote,
  ChargingInputError,
  costToAdd100Miles,
  estimateChargingSession,
  rangeAdded,
} from "./charging-engine";
import { parseChargingCurve } from "./charging-curves";
import {
  approximateMiles,
  approximateMinutes,
  approximatePounds,
  calculationVehicle,
  estimateCharge,
  pounds,
} from "./charging";
import { estimateJourneyCharging } from "./journey-charging";
import { vehicles, chargers } from "../data/demo";
const curve: ChargingCurveBand[] = [
  { fromSocPercent: 0, toSocPercent: 50, powerKw: 150 },
  { fromSocPercent: 50, toSocPercent: 80, powerKw: 100 },
  { fromSocPercent: 80, toSocPercent: 90, powerKw: 50 },
  { fromSocPercent: 90, toSocPercent: 100, powerKw: 10 },
];
const car: CalculationVehicle = {
  usableBatteryKwh: 77.4,
  efficiencyMilesPerKwh: 3.8,
  maxAcKw: 11,
  maxDcKw: 150,
  chargingCurve: curve,
};
const input: ChargingInput = {
  vehicle: car,
  charger: { mode: "dc", powerKw: 350, pricePerKwhPounds: 0.7 },
  currentSocPercent: 30,
  targetSocPercent: 80,
  lossPercent: 0,
};

describe("consumer charging calculations", () => {
  it("matches the requested 3.8 miles/kWh example without rounding intermediate energy", () => {
    const quote = costToAdd100Miles(3.8, 0.7, 0);
    expect(quote.batteryEnergyKwh).toBeCloseTo(26.31578947);
    expect(quote.costPounds).toBeCloseTo(18.42105263);
    expect(pounds(quote.costPounds)).toBe("£18.42");
    expect(costToAdd100Miles(3.8, 0.7).costPounds).toBeCloseTo(
      18.42105263 / 0.9,
    );
  });
  it("uses usable capacity and separates stored, billed and lost energy", () => {
    const vehicle = { ...car, grossBatteryKwh: 84.8 };
    const result = estimateChargingSession({
      ...input,
      vehicle,
      lossPercent: 10,
    });
    expect(result.batteryEnergyKwh).toBeCloseTo(38.7);
    expect(result.billedEnergyKwh).toBeCloseTo(43);
    expect(result.lossEnergyKwh).toBeCloseTo(4.3);
    expect(result.totalCostPounds).toBeCloseTo(30.1);
    expect(result.milesAdded).toBeCloseTo(147.06);
  });
  it.each([
    [39, 3.85, 0.42],
    [60, 4.5, 0.7],
    [64, 4, 0],
    [77.4, 3.8, 0.79],
    [100, 3.2, 1.2],
  ])(
    "supports different cars/tariffs: %s kWh at %s miles/kWh and £%s",
    (battery, efficiency, rate) => {
      const result = estimateChargingSession({
        ...input,
        vehicle: {
          ...car,
          usableBatteryKwh: battery,
          efficiencyMilesPerKwh: efficiency,
        },
        charger: { ...input.charger, pricePerKwhPounds: rate },
      });
      expect(result.batteryEnergyKwh).toBeCloseTo(battery * 0.5);
      expect(result.milesAdded).toBeCloseTo(battery * 0.5 * efficiency);
      expect(result.totalCostPounds).toBeCloseTo(battery * 0.5 * rate);
    },
  );
  it.each([
    [0, 100],
    [0, 10],
    [10, 20],
    [25, 55],
    [30, 80],
    [80, 100],
    [95, 100],
    [99.9, 100],
  ])(
    "integrates clipped SOC bands from %s to %s without gaps",
    (start, target) => {
      const result = estimateChargingSession({
        ...input,
        currentSocPercent: start,
        targetSocPercent: target,
      });
      expect(result.batteryEnergyKwh).toBeCloseTo(
        (77.4 * (target - start)) / 100,
      );
      expect(
        result.segments.reduce((sum, band) => sum + band.batteryEnergyKwh, 0),
      ).toBeCloseTo(result.batteryEnergyKwh);
      expect(result.segments[0].fromSocPercent).toBe(start);
      expect(result.segments.at(-1)?.toSocPercent).toBe(target);
      expect(Number.isFinite(result.timeMinutes)).toBe(true);
    },
  );
  it("sums each SOC band's duration rather than applying the peak across the session", () => {
    const result = estimateChargingSession(input);
    expect(result.timeMinutes).toBeCloseTo((15.48 / 150 + 23.22 / 100) * 60);
    expect(result.timeMinutes).toBeGreaterThan((38.7 / 150) * 60);
    expect(result.averagePowerKw).toBeLessThan(result.peakPowerKw);
  });
  it("charges the same stored-energy interval much slower above 80%", () => {
    const low = estimateChargingSession({
      ...input,
      currentSocPercent: 50,
      targetSocPercent: 70,
    });
    const high = estimateChargingSession({
      ...input,
      currentSocPercent: 80,
      targetSocPercent: 100,
    });
    expect(high.batteryEnergyKwh).toBeCloseTo(low.batteryEnergyKwh);
    expect(high.timeMinutes).toBeCloseTo((7.74 / 50 + 7.74 / 10) * 60);
    expect(high.timeMinutes).toBeGreaterThan(low.timeMinutes * 4);
  });
  it.each([3.6, 7, 22, 50, 75, 150, 350])(
    "caps every rapid/slow band at %s kW and the car limit",
    (powerKw) => {
      const result = estimateChargingSession({
        ...input,
        charger: { ...input.charger, powerKw },
        currentSocPercent: 0,
        targetSocPercent: 100,
      });
      expect(
        result.segments.every(
          (band) =>
            band.effectivePowerKw <= powerKw && band.effectivePowerKw <= 150,
        ),
      ).toBe(true);
      expect(result.timeMinutes).toBeGreaterThanOrEqual(
        (result.billedEnergyKwh / Math.min(powerKw, 150)) * 60 - 1e-9,
      );
    },
  );
  it("caps even an overoptimistic imported curve at the car's DC maximum", () => {
    const result = estimateChargingSession({
      ...input,
      vehicle: {
        ...car,
        maxDcKw: 50,
        chargingCurve: [
          { fromSocPercent: 0, toSocPercent: 100, powerKw: 1000 },
        ],
      },
    });
    expect(result.peakPowerKw).toBe(50);
    expect(result.timeMinutes).toBeCloseTo((38.7 / 50) * 60);
  });
  it("uses AC limits and a labelled AC model, never the vehicle's DC profile", () => {
    const result = estimateChargingSession({
      ...input,
      charger: { ...input.charger, mode: "ac", powerKw: 22 },
    });
    expect(result.peakPowerKw).toBe(11);
    expect(result.timeMinutes).toBeCloseTo((38.7 / 11) * 60);
    expect(result.assumptions.curveSource).toBe("fallback_ac");
    const slow = estimateChargingSession({
      ...input,
      charger: { ...input.charger, mode: "ac", powerKw: 7 },
    });
    expect(slow.peakPowerKw).toBe(7);
    expect(slow.timeMinutes).toBeGreaterThan(result.timeMinutes);
  });
  it("includes losses in both billed cost and charging-input time exactly once", () => {
    const zero = estimateChargingSession(input);
    const lossy = estimateChargingSession({ ...input, lossPercent: 10 });
    expect(lossy.totalCostPounds).toBeCloseTo(zero.totalCostPounds / 0.9);
    expect(lossy.timeMinutes).toBeCloseTo(zero.timeMinutes / 0.9);
    expect(lossy.milesAdded).toBe(zero.milesAdded);
    expect(billedEnergyRequired(10, 20)).toBe(12.5);
  });
  it("computes the 80% alternative independently, or reports no charging above 80%", () => {
    const result = calculateChargingQuote({ ...input, targetSocPercent: 100 });
    expect(result.to80.totalCostPounds).toBeCloseTo(38.7 * 0.7);
    expect(result.session.totalCostPounds).toBeGreaterThan(
      result.to80.totalCostPounds,
    );
    const high = calculateChargingQuote({
      ...input,
      currentSocPercent: 90,
      targetSocPercent: 100,
    });
    expect(high.alreadyAt80).toBe(true);
    expect(high.to80.batteryEnergyKwh).toBe(0);
    expect(high.to80.timeMinutes).toBe(0);
  });
  it("does not charge a connection fee for a zero-energy session or a consumption benchmark", () => {
    const quote = calculateChargingQuote({
      ...input,
      charger: { ...input.charger, connectionFeePounds: 2 },
      currentSocPercent: 100,
      targetSocPercent: 100,
    });
    expect(quote.session.totalCostPounds).toBe(0);
    expect(quote.session.segments).toEqual([]);
    expect(quote.session.timeMinutes).toBe(0);
    expect(quote.hundredMiles.costPounds).toBeCloseTo(18.42105263);
    expect(
      estimateChargingSession({
        ...input,
        charger: { ...input.charger, connectionFeePounds: 2 },
      }).totalCostPounds,
    ).toBeCloseTo(38.7 * 0.7 + 2);
  });
  it("keeps a 100-mile comparison valid even when it exceeds a small battery's range", () => {
    const result = calculateChargingQuote({
      ...input,
      vehicle: { ...car, usableBatteryKwh: 10, efficiencyMilesPerKwh: 3 },
    });
    expect(result.hundredMiles.batteryEnergyKwh).toBeGreaterThan(10);
    expect(result.session.batteryEnergyKwh).toBe(5);
  });
  it("uses saved efficiency overrides consistently in costs and range", () => {
    const base = calculationVehicle(vehicles[0]);
    const original = calculateChargingQuote({ ...input, vehicle: base });
    const personal = calculateChargingQuote({
      ...input,
      vehicle: {
        ...base,
        efficiencyMilesPerKwh: 3,
        efficiencySource: "personal",
      },
    });
    expect(personal.session.assumptions.efficiencySource).toBe("personal");
    expect(personal.hundredMiles.costPounds).toBeGreaterThan(
      original.hundredMiles.costPounds,
    );
    expect(personal.session.milesAdded).toBeLessThan(
      original.session.milesAdded,
    );
    expect(personal.session.timeMinutes).toBe(original.session.timeMinutes);
  });
});

describe("curve quality and safe fallbacks", () => {
  it("normalises an unsorted complete band curve", () => {
    expect(parseChargingCurve([...curve].reverse())).toEqual({
      bands: curve,
      issue: null,
    });
  });
  it.each(
    [
      [{ fromSocPercent: 10, toSocPercent: 100, powerKw: 50 }],
      [{ fromSocPercent: 0, toSocPercent: 90, powerKw: 50 }],
      [
        { fromSocPercent: 0, toSocPercent: 50, powerKw: 50 },
        { fromSocPercent: 40, toSocPercent: 100, powerKw: 20 },
      ],
      [
        { fromSocPercent: 0, toSocPercent: 50, powerKw: 50 },
        { fromSocPercent: 60, toSocPercent: 100, powerKw: 20 },
      ],
      [{ fromSocPercent: 0, toSocPercent: 100, powerKw: 0 }],
      [{ fromSocPercent: 0, toSocPercent: 100, powerKw: NaN }],
      [{ fromSocPercent: 0, toSocPercent: 100, powerKw: Infinity }],
      [{ fromSocPercent: -1, toSocPercent: 100, powerKw: 50 }],
    ].map((bands) => ({ bands })),
  )(
    "labels invalid/partial/overlapping curves as fallback: %j",
    ({ bands }) => {
      const parsed = parseChargingCurve(bands);
      expect(parsed.issue).toBe("invalid");
    },
  );
  it("recognises legacy points without pretending they cover the full SOC range", () => {
    expect(parseChargingCurve([{ batteryPercent: 20, powerKw: 150 }])).toEqual({
      bands: [],
      issue: "legacy_points",
    });
    expect(parseChargingCurve([]).issue).toBe("missing");
    expect(parseChargingCurve({}).issue).toBe("invalid");
  });
  it("makes fallback reasons visible and retains finite 100% estimates", () => {
    const invalid = [{ fromSocPercent: 0, toSocPercent: 100, powerKw: 0 }];
    const result = estimateChargingSession({
      ...input,
      vehicle: { ...car, chargingCurve: invalid },
      targetSocPercent: 100,
    });
    expect(result.assumptions).toMatchObject({
      curveSource: "fallback_dc",
      curveIssue: "invalid",
    });
    expect(Number.isFinite(result.timeMinutes)).toBe(true);
    const noCurve = estimateChargingSession({
      ...input,
      vehicle: { ...car, chargingCurve: [] },
      targetSocPercent: 100,
    });
    expect(noCurve.assumptions.curveIssue).toBe("missing");
    const upper = estimateChargingSession({
      ...input,
      vehicle: { ...car, chargingCurve: [] },
      currentSocPercent: 80,
      targetSocPercent: 100,
    });
    const lower = estimateChargingSession({
      ...input,
      vehicle: { ...car, chargingCurve: [] },
      currentSocPercent: 50,
      targetSocPercent: 70,
    });
    expect(upper.timeMinutes).toBeGreaterThan(lower.timeMinutes);
  });
});

describe("invalid calculator inputs", () => {
  it.each([NaN, Infinity, -1, 101])(
    "rejects invalid SOC %s instead of silently clamping",
    (soc) => {
      expect(() => batteryEnergyRequired(77.4, soc, 100)).toThrow(
        ChargingInputError,
      );
      expect(() => batteryEnergyRequired(77.4, 0, soc)).toThrow(
        ChargingInputError,
      );
    },
  );
  it.each([0, -1, NaN, Infinity])(
    "rejects invalid capacity/efficiency/power %s",
    (value) => {
      expect(() => batteryEnergyRequired(value, 0, 80)).toThrow();
      expect(() => costToAdd100Miles(value, 0.7)).toThrow();
      expect(() => rangeAdded(10, value)).toThrow();
      expect(() =>
        estimateChargingSession({
          ...input,
          charger: { ...input.charger, powerKw: value },
        }),
      ).toThrow();
    },
  );
  it.each([-1, NaN, Infinity])("rejects invalid tariffs/fees %s", (value) => {
    expect(() => costToAdd100Miles(3.8, value)).toThrow();
    expect(() =>
      estimateChargingSession({
        ...input,
        charger: { ...input.charger, connectionFeePounds: value },
      }),
    ).toThrow();
  });
  it.each([-1, 100, NaN, Infinity])(
    "rejects invalid loss percentage %s",
    (loss) => {
      expect(() => billedEnergyRequired(10, loss)).toThrow();
    },
  );
  it("rejects reversed SOC and unsupported DC without false free/instant quotes", () => {
    expect(() =>
      estimateChargingSession({
        ...input,
        currentSocPercent: 90,
        targetSocPercent: 80,
      }),
    ).toThrow();
    expect(() =>
      estimateChargingSession({ ...input, vehicle: { ...car, maxDcKw: 0 } }),
    ).toThrow();
    expect(() =>
      estimateChargingSession({
        ...input,
        vehicle: { ...car, supportedModes: ["ac"] },
      }),
    ).toThrow();
  });
  it("reports empty, non-numeric and invalid fields gracefully", () => {
    const fields = {
      current: "30",
      target: "80",
      pricePence: "70",
      powerKw: "150",
      lossPercent: "10",
      mode: "dc" as const,
    };
    for (const field of [
      "current",
      "target",
      "pricePence",
      "powerKw",
      "lossPercent",
    ] as const)
      for (const value of ["", "not-a-number"])
        expect(
          calculatorQuote(car, { ...fields, [field]: value }).quote,
        ).toBeNull();
    expect(calculatorQuote(car, { ...fields, current: "90" }).error).toContain(
      "Target battery",
    );
    expect(
      calculatorQuote(car, { ...fields, lossPercent: "51" }).quote,
    ).toBeNull();
    expect(
      calculatorQuote(car, { ...fields, pricePence: "0" }).quote?.session
        .totalCostPounds,
    ).toBe(0);
  });
  it("rejects numeric overflow instead of returning Infinity", () => {
    expect(() => costToAdd100Miles(Number.MIN_VALUE, 0.7)).toThrow();
  });
});

describe("journey and consumer presentation integration", () => {
  it("uses the same band model and losses for a partial journey top-up", () => {
    const vehicle = vehicles[0];
    const charger = chargers[0];
    const journey = estimateJourneyCharging(vehicle, charger, 100, 10);
    const expected = estimateCharge(
      vehicle,
      charger,
      10,
      10 + (100 / (270 / 60) / 60) * 100,
    );
    expect(journey.chargingCost).toBeCloseTo(expected.costToTarget);
    expect(journey.stopMinutes).toBeCloseTo(expected.timeToTargetMinutes);
    expect(journey.requiredTopUps).toBe(1);
  });
  it("charges connection fees once per modelled session, including multi-stop journeys", () => {
    const vehicle = { ...vehicles[0], efficiencyMilesPerKwh: 4 };
    const charger = { ...chargers[0], connectionFeePence: 200 };
    const journey = estimateJourneyCharging(vehicle, charger, 336, 10);
    const session = estimateCharge(vehicle, charger, 10, 80);
    expect(journey.requiredTopUps).toBe(2);
    expect(journey.chargingCost).toBeCloseTo(session.costToTarget * 2);
    expect(journey.stopMinutes).toBeCloseTo(session.timeToTargetMinutes * 2);
    expect(
      estimateJourneyCharging(vehicle, undefined, 336, 10).chargingCost,
    ).toBeNull();
    expect(
      estimateJourneyCharging(vehicle, charger, 10, 100).chargingCost,
    ).toBe(0);
  });
  it("rounds uncertain headline estimates while retaining exact arithmetic internally", () => {
    expect(approximatePounds(24.37)).toBe("£24");
    expect(approximatePounds(0.06)).toBe("£0.10");
    expect(approximateMinutes(27.8)).toBe("About 30 min");
    expect(approximateMinutes(0.5)).toBe("Less than a minute");
    expect(approximateMiles(147.06)).toBe("About 145 miles");
  });
});
