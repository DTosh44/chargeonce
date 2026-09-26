import type { Charger, Connector } from "../../domain/types";
import {
  dataState,
  type ChargingSite,
  type GeoBounds,
} from "../../domain/charging-data";
import { distanceKm } from "./provider";

/** Adapter to the existing UI model. No external DTOs or invented pricing/reliability. */
export function presentChargingSites(
  sites: ChargingSite[],
  bounds: GeoBounds,
  now = Date.now(),
): Charger[] {
  return sites
    .filter((site) => site.isPublic && site.accessType === "public")
    .flatMap((site) => {
      const connectorTypes = [
        ...new Set(
          site.connectors
            .map((connector) => connector.type)
            .filter((type): type is Connector => type !== null),
        ),
      ];
      const availabilityState = dataState(site.status.provenance, now),
        tariffState = dataState(site.tariff.provenance, now);
      const pricingKnown =
        ["demo", "external", "live"].includes(tariffState) &&
        site.tariff.currency === "GBP";
      const availabilityKnown = ["demo", "external", "live"].includes(
        availabilityState,
      );
      return connectorTypes.flatMap((type) => {
        const group = site.connectors.filter(
          (connector) =>
            connector.type === type && connector.maxPowerKw !== null,
        );
        if (!group.length) return [];
        return [
          {
            id: `${site.id}:${type}`,
            locationId: site.persistedLocationId,
            name: site.name,
            network: site.operator.name,
            location: site.address,
            postcode: site.postcode,
            // The reference point is the displayed search area, not the user's private location.
            distanceMiles:
              Math.round(
                (distanceKm(
                  (bounds.north + bounds.south) / 2,
                  (bounds.east + bounds.west) / 2,
                  site.latitude,
                  site.longitude,
                ) /
                  1.609344) *
                  10,
              ) / 10,
            maxKw: Math.max(...group.map((connector) => connector.maxPowerKw!)),
            connector: type,
            pricePencePerKwh:
              pricingKnown && site.tariff.pricePerKwh !== null
                ? site.tariff.pricePerKwh * 100
                : null,
            connectionFeePence:
              pricingKnown && site.tariff.connectionFee !== null
                ? site.tariff.connectionFee * 100
                : null,
            status:
              availabilityKnown && site.status.status === "available"
                ? ("Available" as const)
                : availabilityKnown &&
                    ["occupied", "charging"].includes(site.status.status)
                  ? ("Busy" as const)
                  : availabilityKnown &&
                      ["unavailable", "faulted"].includes(site.status.status)
                    ? ("Unavailable" as const)
                    : ("Unknown" as const),
            reliabilityPercent: null,
            // A site-wide occupancy count cannot be ascribed to a connector group.
            stalls: group.every((connector) => connector.quantity !== null)
              ? group.reduce((sum, c) => sum + c.quantity!, 0)
              : null,
            availableStalls:
              connectorTypes.length === 1 && availabilityKnown
                ? site.status.availableConnectors
                : null,
            x: Math.max(
              4,
              Math.min(
                96,
                ((site.longitude - bounds.west) / (bounds.east - bounds.west)) *
                  100,
              ),
            ),
            y: Math.max(
              4,
              Math.min(
                96,
                ((bounds.north - site.latitude) /
                  (bounds.north - bounds.south)) *
                  100,
              ),
            ),
            isDemo: site.provenance.kind === "demo",
            provenance: site.provenance,
            availabilityProvenance: site.status.provenance,
            tariffProvenance: site.tariff.provenance,
            tariffDescription: site.tariff.description,
          },
        ];
      });
    });
}
