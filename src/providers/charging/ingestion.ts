import type { ChargingSite, GeoBounds } from "../../domain/charging-data";
import {
  ChargingProviderError,
  validateBounds,
  type ChargingDataProvider,
} from "./provider";
import { readChargingSnapshot } from "./snapshot";

export interface ChargingImportRepository {
  importSites(provider: string, sites: ChargingSite[]): Promise<number>;
}
/** Scheduler-ready orchestration; no page component calls this. No writes on fetch failure. */
export async function importChargingRegion(
  provider: ChargingDataProvider,
  repository: ChargingImportRepository,
  bounds: GeoBounds,
) {
  validateBounds(bounds);
  if (["mock", "database"].includes(provider.id))
    throw new ChargingProviderError("not_configured");
  const batch = await provider.getLocations(bounds);
  if (
    batch.locations.length > 200 ||
    batch.provider !== provider.id ||
    batch.fallbackReason ||
    batch.locations.some(
      (site) =>
        site.provider !== provider.id || site.provenance.kind === "demo",
    )
  )
    throw new ChargingProviderError("invalid_response");
  const sites = batch.locations
    .map(readChargingSnapshot)
    .filter(
      (site) => site.canImport && site.isPublic && site.accessType === "public",
    );
  const updated = sites.length
    ? await repository.importSites(provider.id, sites)
    : 0;
  return {
    provider: provider.id,
    received: batch.locations.length,
    updated,
    skipped: batch.locations.length - sites.length,
    mayBeTruncated: batch.mayBeTruncated,
    fetchedAt: batch.fetchedAt,
  };
}
