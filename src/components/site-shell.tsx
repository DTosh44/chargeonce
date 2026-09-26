"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Menu, Zap } from "lucide-react";
import { useVehicle } from "@/components/vehicle-context";

const links = [
  { href: "/map", label: "Find a charger" },
  { href: "/route", label: "Plan a journey" },
  { href: "/calculator", label: "Charging calculator" },
  { href: "/cars", label: "My cars" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { auth } = useVehicle();
  const accountLink =
    auth.status === "authenticated"
      ? { href: "/account", label: "Account" }
      : { href: "/sign-in", label: "Sign in" };
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link href="/" className="brand" aria-label="ChargeOnce home">
          <span className="brand-mark">
            <Zap
              size={19}
              fill="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
            />
          </span>
          <span>
            charge<span className="brand-accent">once</span>
          </span>
        </Link>
        <nav className="desktop-nav" aria-label="Main navigation">
          {links.slice(0, 3).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/cars"
          className="header-cars"
          aria-current={pathname === "/cars" ? "page" : undefined}
        >
          My cars
        </Link>
        <Link href={accountLink.href} className="header-signin">
          {accountLink.label} <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
        <details className="mobile-nav">
          <summary aria-label="Open menu">
            <Menu size={23} aria-hidden="true" />
          </summary>
          <nav aria-label="Mobile navigation">
            {[...links, accountLink].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={pathname === link.href ? "page" : undefined}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </details>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-inner">
        <div>
          <Link href="/" className="brand footer-brand">
            <span className="brand-mark">
              <Zap
                size={17}
                fill="currentColor"
                strokeWidth={1.5}
                aria-hidden="true"
              />
            </span>
            <span>
              charge<span className="brand-accent">once</span>
            </span>
          </Link>
          <p>Clarity for every electric journey.</p>
        </div>
        <div className="footer-links">
          <Link href="/map">Find a charger</Link>
          <Link href="/route">Plan a journey</Link>
          <Link href="/calculator">Calculator</Link>
          <Link href="/cars">My cars</Link>
        </div>
      </div>
      <div className="shell footer-bottom">
        © {new Date().getFullYear()} ChargeOnce. Demo prices, locations and
        availability are illustrative—not live charging data.
      </div>
    </footer>
  );
}
