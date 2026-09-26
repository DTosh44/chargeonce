import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site-shell";
import { VehicleProvider } from "@/components/vehicle-context";
import { getChargingCatalogue } from "@/providers/catalogue.server";
import { getAuthState } from "@/lib/auth.server";
import { getGarage, getVehicleCatalogue } from "@/providers/garage.server";
import { toCalculationVehicle } from "@/domain/vehicles";
import "./globals.css";

// Every page includes request-specific identity/current-car state. Never prerender it.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "ChargeOnce — Charge smarter, travel further",
    template: "%s | ChargeOnce",
  },
  description:
    "Compare EV charging cost, speed and reliability for your car. Plan a smarter electric journey with ChargeOnce.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [catalogue, vehicleCatalogue, auth, garage] = await Promise.all([
    getChargingCatalogue(),
    getVehicleCatalogue(),
    getAuthState(),
    getGarage(),
  ]);
  return (
    <html lang="en-GB">
      <body>
        <VehicleProvider
          key={auth.user?.id ?? "anonymous"}
          catalogue={{
            ...catalogue,
            vehicles: vehicleCatalogue.vehicles.map((spec) =>
              toCalculationVehicle(spec),
            ),
          }}
          auth={auth}
          garage={garage}
        >
          <a className="skip-link" href="#main-content">
            Skip to content
          </a>
          <SiteHeader />
          <main id="main-content">{children}</main>
          <SiteFooter />
        </VehicleProvider>
      </body>
    </html>
  );
}
