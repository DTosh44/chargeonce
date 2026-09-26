import type { GeoBounds, LocationBatch } from "../../domain/charging-data";
import { MockChargingProvider } from "./mock";
import {
  ChargingProviderError,
  validateBounds,
  type ChargingDataProvider,
} from "./provider";

/** Never mix demo prices/availability into external locations. Fall back as a whole batch. */
export async function locationsWithFallback(
  provider: ChargingDataProvider | null,
  bounds: GeoBounds,
): Promise<LocationBatch> {
  validateBounds(bounds);
  if (provider) {
    try {
      return await provider.getLocations(bounds);
    } catch (error) {
      if (
        error instanceof ChargingProviderError &&
        error.code === "invalid_query"
      )
        throw error;
    }
  }
  return {
    ...(await new MockChargingProvider().getLocations(bounds)),
    fallbackReason: provider ? "provider_unavailable" : "missing_configuration",
  };
}
