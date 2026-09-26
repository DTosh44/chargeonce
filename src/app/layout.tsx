import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site-shell";
import { VehicleProvider } from "@/components/vehicle-context";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ChargeOnce — Charge smarter, travel further",
    template: "%s | ChargeOnce",
  },
  description:
    "Compare EV charging cost, speed and reliability for your car. Plan a smarter electric journey with ChargeOnce.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB">
      <body>
        <VehicleProvider>
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
