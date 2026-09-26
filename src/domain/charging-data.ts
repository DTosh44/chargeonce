import type { AccessType, EvseStatus } from "./models";
import type { Connector } from "./types";

export interface GeoBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}
export type DataState = "demo" | "external" | "live" | "unknown" | "stale";
/** fetchedAt is NOT evidence that a source observation is recent. */
export interface DataProvenance {
  source: string;
  kind: "demo" | "external" | "live";
  observedAt: string | null;
  fetchedAt: string;
  staleAfterSeconds: number;
  attribution: { name: string; url: string | null; licence: string | null };
}
export interface ChargingOperator {
  id: string;
  name: string;
  slug: string;
  website: string | null;
  logoUrl: string | null;
}
export interface ConnectorSummary {
  id: string;
  type: Connector | null;
  description: string;
  maxPowerKw: number | null;
  quantity: number | null;
}
export interface LocationStatus {
  locationId: string;
  status: EvseStatus;
  availableConnectors: number | null;
  totalConnectors: number | null;
  provenance: DataProvenance;
}
export interface LocationTariff {
  locationId: string;
  pricePerKwh: number | null; // major units; null is unknown, not free
  connectionFee: number | null;
  currency: string | null;
  description: string | null;
  provenance: DataProvenance;
}
/** Normalised source snapshot. Connections may be aggregates, not individually addressable EVSEs. */
export interface ChargingSite {
  id: string;
  /** Set only after persistence; external source identity is not a database FK. */
  persistedLocationId?: string;
  externalId: string;
  provider: string;
  /** Source explicitly permits import; does not replace a commercial licence review. */
  canImport: boolean;
  name: string;
  address: string;
  postcode: string;
  latitude: number;
  longitude: number;
  accessType: AccessType;
  isPublic: boolean;
  operator: ChargingOperator;
  connectors: ConnectorSummary[];
  status: LocationStatus;
  tariff: LocationTariff;
  provenance: DataProvenance;
}
export interface LocationBatch {
  locations: ChargingSite[];
  provider: string;
  fetchedAt: string;
  /** A full page is conservatively treated as potentially truncated. */
  mayBeTruncated: boolean;
  fallbackReason?: "missing_configuration" | "provider_unavailable";
}

export function dataState(
  provenance: DataProvenance,
  now = Date.now(),
): DataState {
  if (provenance.kind === "demo") return "demo";
  const fetched = Date.parse(provenance.fetchedAt);
  const observed = provenance.observedAt
    ? Date.parse(provenance.observedAt)
    : NaN;
  if (
    !Number.isFinite(observed) ||
    !Number.isFinite(fetched) ||
    observed > now + 300000 ||
    fetched > now + 300000
  )
    return "unknown";
  if (
    !Number.isFinite(provenance.staleAfterSeconds) ||
    provenance.staleAfterSeconds <= 0
  )
    return "unknown";
  const oldest = Math.min(observed, fetched);
  if (now - oldest > provenance.staleAfterSeconds * 1000) return "stale";
  return provenance.kind;
}
export const dataStateLabels: Record<DataState, string> = {
  demo: "DEMO DATA",
  external: "EXTERNAL DATA",
  live: "LIVE DATA",
  unknown: "UNKNOWN DATA",
  stale: "STALE DATA",
};
