import type { Metadata } from "next";
import { CarsContent } from "@/components/cars-content";
import { getAuthState, requireAccount } from "@/lib/auth.server";
import { getVehicleCatalogue } from "@/providers/garage.server";

export const metadata: Metadata = {
  title: "My cars",
  description:
    "Save multiple EVs and choose your current car for personalised charging comparisons.",
  robots: { index: false, follow: false },
};
export default async function CarsPage() {
  const auth = await getAuthState();
  if (auth.status !== "unconfigured") await requireAccount("/cars");
  return <CarsContent catalogue={await getVehicleCatalogue()} />;
}
