import type { Metadata } from "next";
import { CarsContent } from "@/components/cars-content";

export const metadata: Metadata = {
  title: "My cars",
  description: "Choose a demo EV for personalised charging comparisons.",
};
export default function CarsPage() {
  return <CarsContent />;
}
