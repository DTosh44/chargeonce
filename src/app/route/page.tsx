import type { Metadata } from "next";
import { RoutePlanner } from "@/components/route-planner";

export const metadata: Metadata = {
  title: "Plan a journey",
  description: "Explore an illustrative EV journey and charging estimate.",
};
export default function RoutePage() {
  return <RoutePlanner />;
}
