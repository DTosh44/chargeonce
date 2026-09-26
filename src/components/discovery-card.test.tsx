import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { DiscoveryCard } from "./discovery-card";
import { MockChargingProvider } from "@/providers/charging/mock";
import { DEFAULT_CHARGING_BOUNDS } from "@/providers/charging/provider";
import { vehicles } from "@/data/demo";
const site = (
  await new MockChargingProvider().getLocations(DEFAULT_CHARGING_BOUNDS)
).locations[0];
const origin = {
  id: "test",
  label: "selected area",
  latitude: 51.557,
  longitude: -0.776,
};
describe("discovery cards", () => {
  it("clearly labels demos, assumptions and prohibits fictional navigation", () => {
    const html = renderToStaticMarkup(
      createElement(DiscoveryCard, {
        site,
        vehicle: vehicles[0],
        origin,
        selected: false,
      }),
    );
    expect(html).toContain("DEMO DATA");
    expect(html).toContain("Directions disabled");
    expect(html).toContain("10% charging losses");
    expect(html).toContain("straight-line");
    expect(html).not.toContain("google.com/maps");
  });
  it("does not fabricate unavailable prices or live availability; retains estimated time and external directions", () => {
    const external = structuredClone(site);
    for (const p of [
      external.provenance,
      external.tariff.provenance,
      external.status.provenance,
    ]) {
      p.kind = "external";
      p.observedAt = null;
    }
    external.tariff.pricePerKwh = null;
    external.tariff.description = null;
    external.status.status = "unknown";
    external.status.availableConnectors = null;
    external.facilities = null;
    const html = renderToStaticMarkup(
      createElement(DiscoveryCard, {
        site: external,
        vehicle: vehicles[0],
        origin,
        selected: false,
      }),
    );
    expect(html).toContain("Price unknown");
    expect(html).toContain("Live availability unavailable");
    expect(html).toContain("Estimated charging time");
    expect(html).toContain("Facilities unverified");
    expect(html).toContain("google.com/maps/dir/");
    expect(html).not.toContain("69p/kWh");
  });
});
