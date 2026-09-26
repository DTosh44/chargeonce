import type { Metadata } from "next";
import { MapExplorer } from "@/components/map-explorer";
import { configuredChargingProvider } from "@/providers/charging/factory.server";
import { locationsWithFallback } from "@/providers/charging/service";
import { DEFAULT_CHARGING_BOUNDS } from "@/providers/charging/provider";

export const metadata: Metadata = {
  title: "Find a charger",
  description:
    "Compare compatible EV chargers by estimated cost, charging time and more.",
};
export default async function MapPage() {
  const initial = await locationsWithFallback(
    configuredChargingProvider(),
    DEFAULT_CHARGING_BOUNDS,
  );
  // Only a public token may reach the browser. Secret tokens are rejected.
  const configured = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim();
  const mapToken = configured?.startsWith("pk.") ? configured : null;
  return <MapExplorer initial={initial} mapToken={mapToken} />;
}
