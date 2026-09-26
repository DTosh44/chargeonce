import {
  dataState,
  type ChargingSite,
  type GeoBounds,
} from "@/domain/charging-data";
import type { Connector, Vehicle } from "@/domain/types";
import type { FacilityCode } from "@/domain/models";
import { distanceKm, validateBounds } from "@/providers/charging/provider";
import { costToAdd100Miles, estimateChargingSession } from "./charging-engine";
import { calculationVehicle } from "./charging";

export interface SearchPlace {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
}
export const facilityLabels: Record<FacilityCode, string> = {
  toilets: "Toilets",
  cafe: "Café",
  restaurant: "Restaurant",
  shop: "Shop",
  wifi: "Wi-Fi",
  "24_hour": "24-hour access",
  accessible_toilet: "Accessible toilet",
  lighting: "Lighting",
};
export type MarkerStatus =
  "available" | "partial" | "busy" | "offline" | "unknown";
export const statusLabels: Record<MarkerStatus, string> = {
  available: "Available",
  partial: "Partially busy",
  busy: "Full / busy",
  offline: "Out of service",
  unknown: "Availability unknown",
};
export const statusSymbols: Record<MarkerStatus, string> = {
  available: "A",
  partial: "P",
  busy: "B",
  offline: "X",
  unknown: "?",
};
const current = (state: string) => ["demo", "external", "live"].includes(state);
export function markerStatus(
  site: ChargingSite,
  now = Date.now(),
): MarkerStatus {
  if (!current(dataState(site.status.provenance, now))) return "unknown";
  const {
    status,
    availableConnectors: free,
    totalConnectors: total,
  } = site.status;
  if (status === "unavailable" || status === "faulted") return "offline";
  if (free !== null && free > 0)
    return total !== null && free < total ? "partial" : "available";
  if (free === 0 || status === "occupied" || status === "charging")
    return "busy";
  return status === "available" ? "available" : "unknown";
}
export function compatibleConnectors(site: ChargingSite, car: Vehicle) {
  return site.connectors.filter(
    (c) =>
      c.type &&
      car.connectors.includes(c.type) &&
      c.maxPowerKw !== null &&
      c.maxPowerKw > 0 &&
      (c.type === "Type 2" ? car.maxAcKw : car.maxDcKw) > 0,
  );
}
export function usefulPower(site: ChargingSite, car: Vehicle) {
  return Math.max(
    0,
    ...compatibleConnectors(site, car).map((c) =>
      Math.min(c.maxPowerKw!, c.type === "Type 2" ? car.maxAcKw : car.maxDcKw),
    ),
  );
}
export function usablePrice(site: ChargingSite, now = Date.now()) {
  return (
    current(dataState(site.tariff.provenance, now)) &&
    site.tariff.currency === "GBP" &&
    site.tariff.pricePerKwh !== null &&
    Number.isFinite(site.tariff.pricePerKwh) &&
    site.tariff.pricePerKwh >= 0
  );
}
export function discoveryEstimate(
  site: ChargingSite,
  car: Vehicle,
  currentSoc = 20,
) {
  const compatible = compatibleConnectors(site, car);
  if (!compatible.length) return null;
  const estimates = compatible.map((c) =>
    estimateChargingSession({
      vehicle: calculationVehicle(car),
      // Zero is solely a placeholder for the time model; unknown costs are NEVER returned.
      charger: {
        powerKw: c.maxPowerKw!,
        mode: c.type === "Type 2" ? "ac" : "dc",
        pricePerKwhPounds: 0,
      },
      currentSocPercent: currentSoc,
      targetSocPercent: 80,
    }),
  );
  const session = estimates.sort((a, b) => a.timeMinutes - b.timeMinutes)[0];
  const knownPrice = usablePrice(site);
  const fee = site.tariff.connectionFee;
  return {
    session,
    usefulKw: usefulPower(site, car),
    cost100: knownPrice
      ? costToAdd100Miles(
          car.efficiencyMilesPerKwh ?? car.estimatedRangeMiles / car.batteryKwh,
          site.tariff.pricePerKwh!,
        ).costPounds
      : null,
    cost80:
      knownPrice && fee !== null && Number.isFinite(fee) && fee >= 0
        ? session.billedEnergyKwh * site.tariff.pricePerKwh! + fee
        : null,
  };
}
export interface DiscoveryFilters {
  available: boolean;
  connector: Connector | "all";
  power: number;
  price: number | null;
  operator: string;
  access: "all" | "public" | "community";
  facilities: FacilityCode[];
}
export const initialFilters: DiscoveryFilters = {
  available: false,
  connector: "all",
  power: 0,
  price: null,
  operator: "all",
  access: "all",
  facilities: [],
};
export function filterSites(
  sites: ChargingSite[],
  car: Vehicle,
  filters: DiscoveryFilters,
  now = Date.now(),
) {
  return sites.filter((site) => {
    if (!site.isPublic || site.accessType !== "public") return false;
    const connectors = compatibleConnectors(site, car).filter(
      (c) => filters.connector === "all" || c.type === filters.connector,
    );
    if (!connectors.some((c) => c.maxPowerKw! >= filters.power)) return false;
    if (
      filters.available &&
      !["available", "partial"].includes(markerStatus(site, now))
    )
      return false;
    if (
      filters.price !== null &&
      (!usablePrice(site, now) || site.tariff.pricePerKwh! > filters.price)
    )
      return false;
    if (filters.operator !== "all" && site.operator.id !== filters.operator)
      return false;
    if (filters.access === "community" && !site.isCommunity) return false;
    if (filters.access === "public" && site.isCommunity) return false;
    return filters.facilities.every((f) => site.facilities?.includes(f));
  });
}
export function distanceMiles(
  site: ChargingSite,
  origin: Pick<SearchPlace, "latitude" | "longitude">,
) {
  return (
    distanceKm(
      origin.latitude,
      origin.longitude,
      site.latitude,
      site.longitude,
    ) * 0.621371
  );
}
export function boundedViewport(bounds: GeoBounds) {
  try {
    validateBounds(bounds);
    return true;
  } catch {
    return false;
  }
}
export function boundsAround(
  place: Pick<SearchPlace, "latitude" | "longitude">,
): GeoBounds {
  return {
    north: place.latitude + 0.08,
    south: place.latitude - 0.08,
    east: place.longitude + 0.12,
    west: place.longitude - 0.12,
  };
}
export function directionsUrl(site: ChargingSite) {
  if (site.provenance.kind === "demo") return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${site.latitude},${site.longitude}&travelmode=driving`;
}
