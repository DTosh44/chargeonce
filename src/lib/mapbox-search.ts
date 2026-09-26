import type { SearchPlace } from "./discovery";
/** Provider response stays behind this adapter. Results are ephemeral, never persisted. */
export function normaliseSearchResults(value: unknown): SearchPlace[] {
  if (
    !value ||
    typeof value !== "object" ||
    !("features" in value) ||
    !Array.isArray(value.features)
  )
    return [];
  return value.features.slice(0, 5).flatMap((feature: unknown, index) => {
    if (!feature || typeof feature !== "object") return [];
    const f = feature as {
      geometry?: { coordinates?: unknown[] };
      properties?: {
        name?: unknown;
        full_address?: unknown;
        place_formatted?: unknown;
      };
    };
    const coords = f.geometry?.coordinates;
    if (
      !coords ||
      typeof coords[0] !== "number" ||
      typeof coords[1] !== "number" ||
      !Number.isFinite(coords[0]) ||
      !Number.isFinite(coords[1]) ||
      Math.abs(coords[0]) > 180 ||
      Math.abs(coords[1]) > 90
    )
      return [];
    const p = f.properties;
    if (!p || typeof p.name !== "string") return [];
    const label =
      typeof p.full_address === "string"
        ? p.full_address
        : [
            p.name,
            typeof p.place_formatted === "string" ? p.place_formatted : "",
          ]
            .filter(Boolean)
            .join(", ");
    return [
      { id: String(index), label, longitude: coords[0], latitude: coords[1] },
    ];
  });
}
export async function searchPlaces(
  query: string,
  token: string,
  signal: AbortSignal,
): Promise<SearchPlace[]> {
  if (!query.trim() || query.length > 256)
    throw new Error(
      "Enter a postcode, town or destination (up to 256 characters).",
    );
  const url = new URL("https://api.mapbox.com/search/searchbox/v1/forward");
  url.search = new URLSearchParams({
    q: query.trim(),
    access_token: token,
    country: "gb",
    language: "en",
    limit: "5",
  }).toString();
  const response = await fetch(url, { signal, cache: "no-store" });
  if (!response.ok)
    throw new Error(
      "Location search is unavailable. Try again or use the current area.",
    );
  return normaliseSearchResults(await response.json());
}
