import "server-only";
import type { ChargingSite, GeoBounds } from "../../../domain/charging-data";
import {
  ChargingProviderError,
  distanceKm,
  inBounds,
  validateBounds,
  validateIds,
  validatePoint,
  validateRadius,
  type ChargingDataProvider,
} from "../provider";
import {
  normaliseLocationResponse,
  normaliseOperator,
  object,
} from "./normalise";

export const OPEN_CHARGE_MAP_BASE_URL = "https://api.openchargemap.io/v3/";
const PAGE_SIZE = 200;
const CACHE_TTL_MS = 15 * 60 * 1000;

/** Only this server module knows the remote protocol and the API key. */
export class OpenChargeMapProvider implements ChargingDataProvider {
  readonly id = "openchargemap";
  private readonly cache = new Map<
    string,
    {
      expires: number;
      promise: Promise<{ payload: unknown; fetchedAt: string }>;
    }
  >();
  constructor(
    private readonly apiKey: string,
    private readonly fetcher: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {
    if (!apiKey.trim()) throw new ChargingProviderError("not_configured");
  }
  private async request(path: string, parameters: Record<string, string>) {
    const url = new URL(path, OPEN_CHARGE_MAP_BASE_URL);
    for (const [key, value] of Object.entries(parameters))
      url.searchParams.set(key, value);
    const cacheKey = url.toString();
    const hit = this.cache.get(cacheKey);
    if (hit && hit.expires > this.now()) return hit.promise;
    if (this.cache.size >= 64)
      this.cache.delete(this.cache.keys().next().value!);
    const promise = (async () => {
      try {
        const response = await this.fetcher(url, {
          headers: {
            "X-API-Key": this.apiKey,
            "User-Agent":
              "ChargeOnce/0.1 (+https://github.com/DTosh44/chargeonce)",
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(8000),
          redirect: "error",
          // Next's shared server cache also deduplicates queries across warm instances.
          next: { revalidate: 900 },
        });
        if (!response.ok) throw new ChargingProviderError("unavailable");
        // Bounded body protects against an unexpectedly large upstream response.
        if (Number(response.headers.get("content-length")) > 4_000_000)
          throw new ChargingProviderError("invalid_response");
        const reader = response.body?.getReader();
        if (!reader) throw new ChargingProviderError("invalid_response");
        const chunks: Uint8Array[] = [];
        let size = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 4_000_000) {
            await reader.cancel();
            throw new ChargingProviderError("invalid_response");
          }
          chunks.push(value);
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.length;
        }
        const responseDate = Date.parse(response.headers.get("date") ?? "");
        return {
          payload: JSON.parse(new TextDecoder().decode(bytes)) as unknown,
          fetchedAt: new Date(
            Number.isFinite(responseDate) && responseDate <= this.now()
              ? responseDate
              : this.now(),
          ).toISOString(),
        };
      } catch (error) {
        // Never echo upstream error bodies, URLs or credentials to consumers/logs.
        this.cache.delete(cacheKey);
        throw error instanceof ChargingProviderError
          ? error
          : new ChargingProviderError("unavailable");
      }
    })();
    this.cache.set(cacheKey, { expires: this.now() + CACHE_TTL_MS, promise });
    return promise;
  }
  private async points(parameters: Record<string, string>) {
    const { payload, fetchedAt } = await this.request("poi/", {
      output: "json",
      compact: "false",
      verbose: "false",
      opendata: "true",
      maxresults: String(PAGE_SIZE),
      ...parameters,
    });
    let locations: ChargingSite[];
    try {
      locations = normaliseLocationResponse(payload, fetchedAt);
    } catch (error) {
      this.cache.clear();
      throw error;
    }
    return {
      locations,
      provider: this.id,
      fetchedAt,
      mayBeTruncated: Array.isArray(payload) && payload.length >= PAGE_SIZE,
    };
  }
  async getLocations(bounds: GeoBounds) {
    validateBounds(bounds);
    const batch = await this.points({
      boundingbox: `(${bounds.north},${bounds.west}),(${bounds.south},${bounds.east})`,
    });
    return {
      ...batch,
      locations: batch.locations.filter((site) => inBounds(site, bounds)),
    };
  }
  async getLocationsNear(
    latitude: number,
    longitude: number,
    radiusKm: number,
  ) {
    validatePoint(latitude, longitude);
    validateRadius(radiusKm);
    const batch = await this.points({
      latitude: String(latitude),
      longitude: String(longitude),
      distance: String(radiusKm),
      distanceunit: "km",
    });
    return {
      ...batch,
      locations: batch.locations.filter(
        (site) =>
          distanceKm(latitude, longitude, site.latitude, site.longitude) <=
          radiusKm,
      ),
    };
  }
  async getLocation(id: string): Promise<ChargingSite | null> {
    validateIds([id]);
    if (!/^openchargemap:[1-9]\d{0,14}$/.test(id)) return null;
    const batch = await this.points({
      chargepointid: id.split(":")[1],
      maxresults: "1",
    });
    return batch.locations.find((site) => site.id === id) ?? null;
  }
  async getOperators() {
    const { payload: raw } = await this.request("referencedata/", {
      output: "json",
    });
    const payload = object(raw);
    if (!Array.isArray(payload.Operators) || payload.Operators.length > 10000)
      throw new ChargingProviderError("invalid_response");
    return payload.Operators.map(normaliseOperator);
  }
  async getStatuses(ids: string[]) {
    validateIds(ids);
    const sites = await this.forIds(ids);
    return sites.map((site) => site.status);
  }
  async getTariffs(ids: string[]) {
    validateIds(ids);
    const sites = await this.forIds(ids);
    return sites.map((site) => site.tariff);
  }
  private async forIds(ids: string[]) {
    if (!ids.length) return [];
    if (ids.some((id) => !/^openchargemap:[1-9]\d{0,14}$/.test(id)))
      throw new ChargingProviderError("invalid_query");
    // One batched request; these methods never trigger one request per location.
    return (
      await this.points({
        chargepointid: [...new Set(ids)]
          .map((id) => id.split(":")[1])
          .join(","),
      })
    ).locations.filter((site) => ids.includes(site.id));
  }
}
