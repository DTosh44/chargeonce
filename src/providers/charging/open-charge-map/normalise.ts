import type {
  ChargingSite,
  ChargingOperator,
  DataProvenance,
} from "../../../domain/charging-data";
import type { Connector } from "../../../domain/types";
import { ChargingProviderError } from "../provider";

type RecordValue = Record<string, unknown>;
export const object = (value: unknown): RecordValue =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : {};
const text = (value: unknown, fallback = "") =>
  typeof value === "string" ? value.trim().slice(0, 2000) : fallback;
const number = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
const positive = (value: unknown) => {
  const n = number(value);
  return n !== null && n > 0 ? n : null;
};
const count = (value: unknown) => {
  const n = number(value);
  return n !== null && Number.isSafeInteger(n) && n > 0 ? n : null;
};
const date = (value: unknown) => {
  const s = text(value);
  // OCM unzoned ISO timestamps represent UTC; never let the server's local TZ reinterpret them.
  const utc = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)
    ? `${s}Z`
    : s;
  return utc && Number.isFinite(Date.parse(utc))
    ? new Date(utc).toISOString()
    : null;
};
const url = (value: unknown) => {
  try {
    const u = new URL(text(value));
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
};
const sourceId = (value: unknown) => {
  const n = count(value);
  return n === null ? null : String(n);
};

export function normaliseOperator(value: unknown): ChargingOperator {
  const raw = object(value);
  const id = sourceId(raw.ID) ?? "unknown";
  return {
    id: `openchargemap-operator:${id}`,
    slug: `openchargemap-operator-${id}`,
    name: text(raw.Title, "Unknown operator"),
    website: url(raw.WebsiteURL),
    logoUrl: null,
  };
}
function connectorType(value: unknown): Connector | null {
  switch (value) {
    case 33:
      return "CCS";
    case 2:
      return "CHAdeMO";
    case 25:
    case 103:
      return "Type 2";
    default:
      return null;
  }
}

export function normaliseOpenChargeMap(
  rawValue: unknown,
  fetchedAt: string,
): ChargingSite | null {
  const raw = object(rawValue),
    address = object(raw.AddressInfo);
  const externalId = sourceId(raw.ID),
    latitude = number(address.Latitude),
    longitude = number(address.Longitude);
  if (
    !externalId ||
    latitude === null ||
    longitude === null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180 ||
    !text(address.Title)
  )
    return null;
  const id = `openchargemap:${externalId}`,
    dataProvider = object(raw.DataProvider);
  const provenance: DataProvenance = {
    source: "openchargemap",
    kind: "external",
    observedAt: date(raw.DateLastVerified) ?? date(raw.DateLastStatusUpdate),
    fetchedAt,
    staleAfterSeconds: 30 * 86400,
    attribution: {
      name: text(dataProvider.Title, "Open Charge Map"),
      url: `https://openchargemap.org/site/poi/details/${externalId}`,
      licence: text(dataProvider.License) || null,
    },
  };
  const usage = object(raw.UsageType);
  const usageTitle = text(usage.Title).toLowerCase();
  const isPublic = usageTitle.startsWith("public");
  const accessType = usageTitle.includes("private")
    ? "private"
    : usageTitle.includes("customer")
      ? "customers"
      : isPublic
        ? "public"
        : "restricted";
  const connections = Array.isArray(raw.Connections) ? raw.Connections : [];
  const connectors = connections.slice(0, 200).map((value, index) => {
    const connection = object(value),
      type = object(connection.ConnectionType);
    return {
      id: `${id}:connection:${sourceId(connection.ID) ?? index}`,
      type: connectorType(type.ID ?? connection.ConnectionTypeID),
      description: text(type.Title, "Unrecognised connector"),
      maxPowerKw: positive(connection.PowerKW),
      quantity: count(connection.Quantity),
    };
  });
  const statusInfo = object(raw.StatusType);
  const unavailable = statusInfo.IsOperational === false;
  // Operational condition is NOT a real-time occupancy count. Never turn it into "Available".
  const status = {
    locationId: id,
    status: unavailable ? ("unavailable" as const) : ("unknown" as const),
    availableConnectors: null,
    // NumberOfPoints may count equipment/EVSEs, not independently usable connectors.
    totalConnectors: null,
    provenance: {
      ...provenance,
      observedAt: unavailable ? date(raw.DateLastStatusUpdate) : null,
      staleAfterSeconds: 900,
    },
  };
  return {
    id,
    externalId,
    provider: "openchargemap",
    canImport:
      dataProvider.IsApprovedImport !== false &&
      dataProvider.IsOpenDataLicensed === true,
    name: text(address.Title),
    address: [
      address.AddressLine1,
      address.AddressLine2,
      address.Town,
      address.StateOrProvince,
    ]
      .map((v) => text(v))
      .filter(Boolean)
      .join(", "),
    postcode: text(address.Postcode),
    latitude,
    longitude,
    accessType,
    isPublic,
    operator: normaliseOperator(raw.OperatorInfo),
    connectors,
    status,
    tariff: {
      locationId: id,
      pricePerKwh: null,
      connectionFee: null,
      currency: null,
      description: text(raw.UsageCost) || null,
      provenance: { ...provenance, observedAt: null, staleAfterSeconds: 86400 },
    },
    provenance,
  };
}
export function normaliseLocationResponse(payload: unknown, fetchedAt: string) {
  if (!Array.isArray(payload) || payload.length > 200)
    throw new ChargingProviderError("invalid_response");
  const sites = payload
    .map((value) => normaliseOpenChargeMap(value, fetchedAt))
    .filter((value): value is ChargingSite => value !== null);
  if (payload.length && !sites.length)
    throw new ChargingProviderError("invalid_response");
  return [...new Map(sites.map((site) => [site.id, site])).values()];
}
