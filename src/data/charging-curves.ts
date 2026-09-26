import type { ChargingCurveBand } from "../domain/charging";
/** Synthetic starter profiles for demonstration, NOT measured manufacturer curves. */
const illustrativePowers: Record<string, number[]> = {
  "10000000-0000-4000-8000-000000000001": [
    70, 130, 170, 155, 135, 110, 85, 60, 35, 12,
  ],
  "10000000-0000-4000-8000-000000000002": [
    55, 95, 120, 110, 95, 80, 65, 50, 30, 10,
  ],
  "10000000-0000-4000-8000-000000000003": [
    45, 70, 100, 95, 85, 75, 60, 45, 28, 9,
  ],
  "10000000-0000-4000-8000-000000000004": [
    150, 210, 240, 240, 225, 210, 160, 95, 55, 18,
  ],
  "10000000-0000-4000-8000-000000000005": [
    24, 40, 50, 47, 44, 40, 34, 28, 20, 8,
  ],
};
export const demoChargingCurves: Record<string, ChargingCurveBand[]> =
  Object.fromEntries(
    Object.entries(illustrativePowers).map(([id, powers]) => [
      id,
      powers.map((powerKw, index) => ({
        fromSocPercent: index * 10,
        toSocPercent: (index + 1) * 10,
        powerKw,
      })),
    ]),
  );
