import { describe, it, expect, vi, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ChargerCard } from "./charger-card";
import { normaliseOpenChargeMap } from "../providers/charging/open-charge-map/normalise";
import { examplePoint } from "../providers/charging/open-charge-map/fixtures";
import { presentChargingSites } from "../providers/charging/presentation";
import { DEFAULT_CHARGING_BOUNDS } from "../providers/charging/provider";
import { chargers, vehicles } from "../data/demo";

const now = new Date("2026-09-26T12:00:00Z");
afterEach(() => vi.useRealTimers());
describe("consumer data confidence on cards", () => {
  it("keeps demo availability explicitly demo, including compact cards", () => {
    const html = renderToStaticMarkup(
      <ChargerCard charger={chargers[0]} vehicle={vehicles[0]} compact />,
    );
    expect(html).toContain("DEMO DATA");
    expect(html).toContain("Available");
    expect(html).not.toContain("LIVE DATA");
  });
  it("shows external location/unknown categories and never creates a zero-price quote from notes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const site = normaliseOpenChargeMap(examplePoint, now.toISOString())!;
    const charger = presentChargingSites([site], DEFAULT_CHARGING_BOUNDS)[0];
    const html = renderToStaticMarkup(
      <ChargerCard charger={charger} vehicle={vehicles[0]} />,
    );
    expect(html).toContain("EXTERNAL DATA");
    expect(html).toContain("UNKNOWN DATA");
    expect(html).toContain("Unknown tariff");
    expect(html).toContain("Reliability not rated");
    expect(html).toContain("Source observation:");
    expect(html).toContain("Example test licence");
    expect(html).not.toContain("£0.00");
    expect(html).not.toContain(">Available<");
  });
  it("marks stale source records while hiding an expired available badge/tariff", () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const site = normaliseOpenChargeMap(
      { ...examplePoint, DateLastVerified: "2020-01-01T00:00:00Z" },
      now.toISOString(),
    )!;
    const charger = presentChargingSites([site], DEFAULT_CHARGING_BOUNDS)[0];
    const html = renderToStaticMarkup(
      <ChargerCard charger={charger} vehicle={vehicles[0]} />,
    );
    expect(html).toContain("STALE DATA");
    expect(html).toContain("Unknown tariff");
    expect(html).not.toContain(">Available<");
  });
});
