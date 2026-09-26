"use client";

import Link from "next/link";
import {
  ArrowRight,
  BatteryCharging,
  Check,
  Clock3,
  Gauge,
  MapPin,
  Route,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { recommendedChargers } from "@/lib/charging";
import { VehicleSelector, useVehicle } from "@/components/vehicle-context";
import { Badge, Card, Progress, buttonStyles } from "@/components/ui";
import { ChargerCard } from "@/components/charger-card";

export function HomeContent() {
  const { vehicle, chargers } = useVehicle();
  const picks = recommendedChargers(vehicle, chargers);
  return (
    <>
      <section className="hero">
        <div className="shell hero-copy">
          <span className="eyebrow">A smarter way to charge</span>
          <h1>
            Find the right EV charger.
            <br />
            <span>Not just the nearest one.</span>
          </h1>
          <p className="hero-sub">
            Compare charging cost, speed, availability and reliability —
            personalised to your car.
          </p>
          <div className="hero-actions">
            <Link href="/map" className={buttonStyles()}>
              Find a charger <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link href="/route" className={buttonStyles("secondary")}>
              Plan a journey <Route size={17} aria-hidden="true" />
            </Link>
          </div>
          <p className="hero-proof">Understand the cost before you plug in.</p>
        </div>
      </section>
      <section
        className="shell recommendations-section"
        aria-labelledby="recommendations-heading"
      >
        <div className="recommendations-heading">
          <div>
            <Badge>DEMO PREVIEW</Badge>
            <h2 id="recommendations-heading">
              A better match for your next charge.
            </h2>
            <p>Three ways to choose. One clear comparison.</p>
          </div>
          <VehicleSelector
            id="home-vehicle"
            label="Which car are you driving?"
          />
        </div>
        <div className="recommendations-grid">
          {(["best", "cheapest", "fastest"] as const).map((type) =>
            picks[type] ? (
              <ChargerCard
                key={type}
                charger={picks[type]!}
                vehicle={vehicle}
                tag={type.toUpperCase()}
              />
            ) : (
              <Card key={type} className="empty-state">
                No compatible demo charger is available for this recommendation.
              </Card>
            ),
          )}
        </div>
        <p className="recommendations-note">
          Illustrative locations, tariffs, reliability and availability.
          Estimates assume a 20–80% charge and include 10% charging losses, with
          illustrative SOC curves or a generic fallback model. Recommendations
          consider available, compatible demo chargers.
        </p>
      </section>
      <div className="shell stat-strip">
        <div>
          <BatteryCharging size={25} aria-hidden="true" />
          <span>
            <b>Costs in pounds,</b> not just p/kWh
          </span>
        </div>
        <div>
          <Gauge size={25} aria-hidden="true" />
          <span>
            <b>Speed matched</b> to your car
          </span>
        </div>
        <div>
          <ShieldCheck size={25} aria-hidden="true" />
          <span>
            <b>More confidence</b> at every stop
          </span>
        </div>
      </div>
      <section className="shell how-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">How it works</span>
            <h2 className="section-title">Charging decisions, made simple.</h2>
            <p>
              Everything you need to know before you arrive—without the jargon.
            </p>
          </div>
          <Link href="/calculator" className={buttonStyles("secondary")}>
            Try the calculator <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <div className="steps">
          <Card className="step">
            <div className="step-icon">
              <Zap aria-hidden="true" />
            </div>
            <h3>1. Choose your car</h3>
            <p>
              We factor in your battery size, range and maximum charging speed.
              A charger is only fast if your car can use it.
            </p>
          </Card>
          <Card className="step">
            <div className="step-icon">
              <MapPin aria-hidden="true" />
            </div>
            <h3>2. Compare your options</h3>
            <p>
              See likely cost per 100 miles, cost to 80%, charging time and
              connector fit side by side.
            </p>
          </Card>
          <Card className="step">
            <div className="step-icon">
              <Route aria-hidden="true" />
            </div>
            <h3>3. Make your move</h3>
            <p>
              Pick the stop that works for your journey, your budget and your
              time—not just the closest pin.
            </p>
          </Card>
        </div>
      </section>
      <section className="feature-band">
        <div className="shell feature-grid">
          <div>
            <span className="eyebrow">Better information</span>
            <h2 className="section-title">
              Charging prices shouldn’t require a calculator.
            </h2>
            <p className="section-copy">
              ChargeOnce translates technical tariffs into estimated journey
              costs: what 100 miles might cost, how much a top-up to 80% could
              be, and how long you’ll likely wait. A low tariff isn’t always the
              best stop—we make the trade-offs easier to see.
            </p>
            <div className="feature-points">
              <span>
                <Check size={18} aria-hidden="true" /> Realistic charging time
                estimates
              </span>
              <span>
                <Check size={18} aria-hidden="true" /> Vehicle-specific cost
                comparison
              </span>
              <span>
                <Check size={18} aria-hidden="true" /> Clear availability and
                reliability context
              </span>
            </div>
          </div>
          <Card className="feature-visual">
            <div className="feature-visual-head">
              <strong>Compare at a glance</strong>
              <Badge tone="blue">
                <Sparkles size={12} aria-hidden="true" /> PERSONALISED
              </Badge>
            </div>
            <div className="comparison-bars">
              <div className="comparison-bar">
                <label>
                  <span>Overall fit</span>
                  <b>Excellent</b>
                </label>
                <Progress value={88} label="Overall fit 88 percent" />
              </div>
              <div className="comparison-bar">
                <label>
                  <span>Price</span>
                  <b>Good value</b>
                </label>
                <Progress value={72} label="Price score 72 percent" />
              </div>
              <div className="comparison-bar">
                <label>
                  <span>Charging speed</span>
                  <b>Fast</b>
                </label>
                <Progress value={81} label="Charging speed score 81 percent" />
              </div>
            </div>
            <div className="feature-foot">
              Example illustration; not a live charger rating.
            </div>
          </Card>
        </div>
      </section>
      <section className="shell how-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Built for every kind of stop</span>
            <h2 className="section-title">
              One place to understand every charger.
            </h2>
            <p>
              Public, rapid and destination charging today in this
              demo—community charging is planned for the future.
            </p>
          </div>
          <Link href="/map" className={buttonStyles()}>
            Explore chargers <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
        <div className="steps">
          <Card className="step">
            <div className="step-icon">
              <MapPin aria-hidden="true" />
            </div>
            <h3>Public & destination charging</h3>
            <p>
              Compare a quick top-up with a longer stay at a lower-power
              charger.
            </p>
            <Link href="/map" className="text-link">
              Explore map →
            </Link>
          </Card>
          <Card className="step">
            <div className="step-icon">
              <Clock3 aria-hidden="true" />
            </div>
            <h3>Rapid charging on the road</h3>
            <p>See how a charging stop could fit into a longer journey.</p>
            <Link href="/route" className="text-link">
              Plan route →
            </Link>
          </Card>
          <Card className="step">
            <div className="step-icon">
              <BatteryCharging aria-hidden="true" />
            </div>
            <h3>Community charging, later</h3>
            <p>
              A future release will explore trusted access to community
              chargers. For now, run the numbers on your next top-up.
            </p>
            <Link href="/calculator" className="text-link">
              Open calculator →
            </Link>
          </Card>
        </div>
      </section>
    </>
  );
}
