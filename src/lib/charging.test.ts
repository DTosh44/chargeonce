import { describe, expect, it } from "vitest";
import { chargers, vehicles } from "../data/demo";
import { estimateCharge, isCompatible, recommendedChargers } from "./charging";

describe("charging estimates", () => {
  it("calculates cost and time from the vehicle and charger", () => {
    const result = estimateCharge(vehicles[0], chargers[0]);
    expect(result.energyNeededKwh).toBe(36);
    expect(result.costToTarget).toBeCloseTo(24.84);
    expect(result.costPer100Miles).toBeCloseTo(15.33);
    expect(result.timeToTargetMinutes).toBeGreaterThan(18);
  });

  it("caps power at the vehicle limit and charges no energy for an already reached target", () => {
    expect(estimateCharge(vehicles[0], chargers[3]).effectiveKw).toBe(170);
    expect(estimateCharge(vehicles[0], chargers[4], 90, 80).costToTarget).toBe(
      0,
    );
  });

  it("uses AC limits for Type 2 and finds distinct recommendation criteria", () => {
    expect(estimateCharge(vehicles[0], chargers[2]).effectiveKw).toBe(11);
    expect(isCompatible(vehicles[0], chargers[2])).toBe(true);
    const picks = recommendedChargers(vehicles[0], chargers);
    expect(picks.cheapest.id).toBe("bravo");
    expect(picks.fastest.id).toBe("delta");
  });
});
