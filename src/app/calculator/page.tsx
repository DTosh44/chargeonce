import type { Metadata } from "next";
import { ChargingCalculator } from "@/components/charging-calculator";

export const metadata: Metadata = {
  title: "Charging calculator",
  description: "Estimate EV charging cost, time and energy for your car.",
};
export default function CalculatorPage() {
  return <ChargingCalculator />;
}
