import { describe, expect, it } from "vitest";
import { parseCarDetails, toCalculationVehicle } from "./vehicles";
import { safeReturnPath, validEmail } from "./auth";
import {
  createVehicleService,
  seededVehicleModels,
} from "../providers/vehicle-service";
import { estimateCharge } from "../lib/charging";
import { chargers } from "../data/demo";

describe("garage domain and catalogue boundary", () => {
  it("covers all requested brands with explicitly illustrative starter models", async () => {
    const catalogue = await createVehicleService(null).listCatalogue();
    expect(catalogue.source).toBe("seeded");
    expect(catalogue.vehicles).toHaveLength(13);
    expect(new Set(catalogue.vehicles.map((car) => car.manufacturer))).toEqual(
      new Set([
        "Tesla",
        "Kia",
        "Hyundai",
        "BMW",
        "Volkswagen",
        "Audi",
        "MG",
        "Nissan",
        "Polestar",
        "Volvo",
        "Skoda",
      ]),
    );
    expect(
      catalogue.vehicles.every(
        (car) => car.isDemo && car.source === "chargeonce_demo",
      ),
    ).toBe(true);
    await expect(createVehicleService(null).listGarage()).rejects.toThrow(
      "requires a configured Supabase",
    );
  });
  it("uses real-world overrides in range and cost without changing battery or power", () => {
    const car = toCalculationVehicle(seededVehicleModels[0], 3);
    expect(car.efficiencyMilesPerKwh).toBe(3);
    expect(car.estimatedRangeMiles).toBe(180);
    expect(car.batteryKwh).toBe(60);
    expect(car.maxDcKw).toBe(170);
    expect(
      estimateCharge(car, { ...chargers[0], pricePencePerKwh: 60 })
        .costPer100Miles,
    ).toBeCloseTo(20);
    expect(
      toCalculationVehicle(seededVehicleModels[0]).estimatedRangeMiles,
    ).toBe(270);
  });
  it("validates optional nickname and efficiency without accepting non-finite inputs", () => {
    const form = new FormData();
    expect(parseCarDetails(form)).toEqual({
      nickname: null,
      efficiencyOverride: null,
    });
    form.set("nickname", "  Family car ");
    form.set("efficiency", "3.45");
    expect(parseCarDetails(form)).toEqual({
      nickname: "Family car",
      efficiencyOverride: 3.45,
    });
    for (const value of ["NaN", "Infinity", "0", "10.1", "-2"]) {
      form.set("efficiency", value);
      expect(() => parseCarDetails(form)).toThrow();
    }
    form.set("efficiency", "");
    form.set("nickname", "x".repeat(101));
    expect(() => parseCarDetails(form)).toThrow();
  });
  it("prevents open redirects and accepts only email-shaped values", () => {
    for (const value of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "/sign-in",
      "/auth/callback",
      null,
      "/\nevil",
    ])
      expect(safeReturnPath(value)).toBe("/cars");
    expect(safeReturnPath("/calculator?battery=50")).toBe(
      "/calculator?battery=50",
    );
    expect(validEmail("driver@example.com")).toBe(true);
    expect(validEmail("driver@example com")).toBe(false);
  });
});
