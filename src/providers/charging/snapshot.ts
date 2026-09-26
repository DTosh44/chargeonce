import type { ChargingSite } from "../../domain/charging-data";
import { ChargingProviderError, validatePoint } from "./provider";

/** Validate the persisted domain envelope. Reject corrupt data rather than rendering raw JSON. */
export function readChargingSnapshot(value: unknown): ChargingSite {
  const site = value as ChargingSite;
  try {
    if (
      !site ||
      typeof site !== "object" ||
      typeof site.id !== "string" ||
      !site.id ||
      typeof site.externalId !== "string" ||
      typeof site.provider !== "string" ||
      typeof site.canImport !== "boolean" ||
      typeof site.name !== "string" ||
      typeof site.address !== "string" ||
      typeof site.postcode !== "string" ||
      typeof site.isPublic !== "boolean" ||
      !["public", "customers", "restricted", "private"].includes(
        site.accessType,
      )
    )
      throw new Error();
    validatePoint(site.latitude, site.longitude);
    const operator = site.operator;
    if (
      !operator ||
      [operator.id, operator.name, operator.slug].some(
        (v) => typeof v !== "string" || !v,
      )
    )
      throw new Error();
    for (const url of [operator.website, operator.logoUrl])
      if (
        url !== null &&
        (typeof url !== "string" || !url.startsWith("https://"))
      )
        throw new Error();
    if (!Array.isArray(site.connectors) || site.connectors.length > 200)
      throw new Error();
    for (const c of site.connectors) {
      if (
        !c ||
        typeof c.id !== "string" ||
        typeof c.description !== "string" ||
        (c.type !== null && !["CCS", "Type 2", "CHAdeMO"].includes(c.type)) ||
        (c.maxPowerKw !== null &&
          (!Number.isFinite(c.maxPowerKw) || c.maxPowerKw <= 0)) ||
        (c.quantity !== null &&
          (!Number.isSafeInteger(c.quantity) || c.quantity <= 0))
      )
        throw new Error();
    }
    if (
      !site.status ||
      site.status.locationId !== site.id ||
      ![
        "available",
        "charging",
        "occupied",
        "unavailable",
        "faulted",
        "unknown",
      ].includes(site.status.status)
    )
      throw new Error();
    for (const n of [
      site.status.availableConnectors,
      site.status.totalConnectors,
    ])
      if (n !== null && (!Number.isSafeInteger(n) || n < 0)) throw new Error();
    if (
      site.status.availableConnectors !== null &&
      site.status.totalConnectors !== null &&
      site.status.availableConnectors > site.status.totalConnectors
    )
      throw new Error();
    if (
      !site.tariff ||
      site.tariff.locationId !== site.id ||
      (site.tariff.currency !== null &&
        !/^[A-Z]{3}$/.test(site.tariff.currency)) ||
      (site.tariff.description !== null &&
        typeof site.tariff.description !== "string")
    )
      throw new Error();
    for (const n of [site.tariff.pricePerKwh, site.tariff.connectionFee])
      if (n !== null && (!Number.isFinite(n) || n < 0)) throw new Error();
    for (const p of [
      site.provenance,
      site.status.provenance,
      site.tariff.provenance,
    ]) {
      if (
        !p ||
        typeof p.source !== "string" ||
        !["demo", "external", "live"].includes(p.kind) ||
        !Number.isFinite(Date.parse(p.fetchedAt)) ||
        (p.observedAt !== null && !Number.isFinite(Date.parse(p.observedAt))) ||
        !Number.isFinite(p.staleAfterSeconds) ||
        p.staleAfterSeconds <= 0 ||
        !p.attribution ||
        typeof p.attribution.name !== "string"
      )
        throw new Error();
      if (
        p.attribution.url !== null &&
        (typeof p.attribution.url !== "string" ||
          !p.attribution.url.startsWith("https://"))
      )
        throw new Error();
      if (
        p.attribution.licence !== null &&
        typeof p.attribution.licence !== "string"
      )
        throw new Error();
    }
    return site;
  } catch {
    throw new ChargingProviderError("invalid_response");
  }
}
