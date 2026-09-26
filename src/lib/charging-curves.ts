import type { ChargingCurveBand, CurveIssue } from "../domain/charging";

/** Reject a whole malformed/partial curve rather than quietly inventing missing bands. */
export function parseChargingCurve(value: unknown): {
  bands: ChargingCurveBand[];
  issue: CurveIssue | null;
} {
  if (value == null || (Array.isArray(value) && value.length === 0))
    return { bands: [], issue: "missing" };
  if (!Array.isArray(value) || value.length > 1000)
    return { bands: [], issue: "invalid" };
  if (
    value.every(
      (point) =>
        point &&
        typeof point === "object" &&
        "batteryPercent" in point &&
        !("fromSocPercent" in point),
    )
  )
    return { bands: [], issue: "legacy_points" };
  const bands: ChargingCurveBand[] = [];
  for (const point of value) {
    if (!point || typeof point !== "object")
      return { bands: [], issue: "invalid" };
    const { fromSocPercent, toSocPercent, powerKw } = point;
    if (
      ![fromSocPercent, toSocPercent, powerKw].every(
        (number) => typeof number === "number" && Number.isFinite(number),
      ) ||
      fromSocPercent < 0 ||
      toSocPercent > 100 ||
      fromSocPercent >= toSocPercent ||
      powerKw <= 0
    )
      return { bands: [], issue: "invalid" };
    bands.push({ fromSocPercent, toSocPercent, powerKw });
  }
  bands.sort((a, b) => a.fromSocPercent - b.fromSocPercent);
  if (
    bands[0].fromSocPercent !== 0 ||
    bands.at(-1)!.toSocPercent !== 100 ||
    bands.some(
      (band, index) =>
        index > 0 && band.fromSocPercent !== bands[index - 1].toSocPercent,
    )
  )
    return { bands: [], issue: "invalid" };
  return { bands, issue: null };
}

/** Explicit heuristic, NOT a measured curve for the selected vehicle. */
export function fallbackChargingCurve(
  mode: "ac" | "dc",
  maximumKw: number,
): ChargingCurveBand[] {
  const bands =
    mode === "ac"
      ? [
          [0, 90, 1],
          [90, 95, 0.8],
          [95, 100, 0.5],
        ]
      : [
          [0, 10, 0.65],
          [10, 20, 0.9],
          [20, 30, 1],
          [30, 40, 0.9],
          [40, 50, 0.8],
          [50, 60, 0.65],
          [60, 70, 0.5],
          [70, 80, 0.35],
          [80, 90, 0.22],
          [90, 95, 0.12],
          [95, 100, 0.05],
        ];
  return bands.map(([fromSocPercent, toSocPercent, factor]) => ({
    fromSocPercent,
    toSocPercent,
    powerKw: maximumKw * factor,
  }));
}
