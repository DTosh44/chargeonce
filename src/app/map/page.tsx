import type { Metadata } from "next";
import { MapExplorer } from "@/components/map-explorer";

export const metadata: Metadata = {
  title: "Find a charger",
  description:
    "Compare compatible EV chargers by estimated cost, charging time and more.",
};
export default function MapPage() {
  return <MapExplorer />;
}
