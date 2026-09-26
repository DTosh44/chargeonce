"use client";

import {
  ArrowDown,
  ArrowRight,
  Clock3,
  Info,
  MapPin,
  Route as RouteIcon,
  Zap,
} from "lucide-react";
import { chargers } from "@/data/demo";
import { VehicleSelector, useVehicle } from "@/components/vehicle-context";
import { Card, Metric, PageHeader, Select } from "@/components/ui";
import { minutes, pounds } from "@/lib/charging";
import { useState } from "react";

const routes = [
  {
    id: "bristol",
    from: "Marlow",
    to: "Bristol",
    miles: 112,
    label: "Marlow → Bristol · 112 miles",
  },
  {
    id: "oxford",
    from: "Marlow",
    to: "Oxford",
    miles: 38,
    label: "Marlow → Oxford · 38 miles",
  },
  {
    id: "birmingham",
    from: "Marlow",
    to: "Birmingham",
    miles: 105,
    label: "Marlow → Birmingham · 105 miles",
  },
  {
    id: "manchester",
    from: "Marlow",
    to: "Manchester",
    miles: 192,
    label: "Marlow → Manchester · 192 miles",
  },
];

export function RoutePlanner() {
  const { vehicle } = useVehicle();
  const [routeId, setRouteId] = useState("manchester");
  const [startingCharge, setStartingCharge] = useState(40);
  const route = routes.find((item) => item.id === routeId) ?? routes[0];
  const usableMiles = Math.max(
    0,
    (vehicle.estimatedRangeMiles * (startingCharge - 10)) / 100,
  );
  const deficitMiles = Math.max(0, route.miles - usableMiles);
  const stop = chargers.find((charger) => charger.id === "alpha")!;
  const energyAtStop =
    (deficitMiles / vehicle.estimatedRangeMiles) * vehicle.batteryKwh;
  const effectiveKw = Math.min(stop.maxKw, vehicle.maxDcKw);
  const stopMinutes = (energyAtStop / (effectiveKw * 0.78)) * 60;
  const chargingCost = (energyAtStop * stop.pricePencePerKwh) / 100;
  const drivingMinutes = (route.miles / 55) * 60;
  const needsStop = deficitMiles > 0;

  return (
    <div className="shell page-section">
      <PageHeader
        eyebrow="Plan a journey"
        title="Make the journey, not just the range."
        description="Try an example route to see when a top-up might help and what it could add to the trip."
      />
      <div className="route-layout">
        <Card className="form-card">
          <h2>Journey details</h2>
          <div className="form-stack">
            <VehicleSelector id="route-vehicle" />
            <label className="field-label" htmlFor="example-route">
              Example journey
              <Select
                id="example-route"
                value={routeId}
                onChange={(event) => setRouteId(event.target.value)}
              >
                {routes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </label>
            <div className="route-arrow">
              <ArrowDown size={19} aria-hidden="true" />
            </div>
            <label className="range-wrap" htmlFor="start-charge">
              <span className="range-head">
                <span>Starting battery</span>
                <strong>{startingCharge}%</strong>
              </span>
              <input
                id="start-charge"
                type="range"
                min="10"
                max="100"
                step="5"
                value={startingCharge}
                onChange={(event) =>
                  setStartingCharge(Number(event.target.value))
                }
              />
            </label>
            <div className="notice">
              <Info size={16} aria-hidden="true" />
              <span>
                Example road distances and a 55 mph average are used. The
                suggested stop is illustrative, not route-verified.
              </span>
            </div>
          </div>
        </Card>
        <Card className="route-summary">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Your journey</span>
              <h2
                className="section-title"
                style={{ fontSize: 29, margin: "9px 0 0" }}
              >
                {route.from} to {route.to}
              </h2>
            </div>
            <RouteIcon size={26} color="#1568e8" aria-hidden="true" />
          </div>
          <div className="route-line">
            <MapPin size={18} aria-hidden="true" />
            <strong>{route.from}</strong>
            <span className="subtle">────</span>
            <ArrowRight size={17} aria-hidden="true" />
            <span className="subtle">────</span>
            <strong>{route.to}</strong>
          </div>
          <div className="route-kpis">
            <Metric label="Distance" value={`${route.miles} mi`} />
            <Metric
              label="Likely travel time"
              value={minutes(drivingMinutes + stopMinutes)}
            />
            <Metric
              label="Estimated charging"
              value={needsStop ? pounds(chargingCost) : "£0.00"}
            />
          </div>
          <div className="route-results">
            <h3>
              {needsStop
                ? "A charging stop would help"
                : "No charging stop likely needed"}
            </h3>
            <p className="section-copy" style={{ fontSize: 13 }}>
              {needsStop
                ? `Starting at ${startingCharge}%, your estimated usable range with a 10% arrival reserve is ${Math.round(usableMiles)} miles. A top-up of roughly ${Math.round(energyAtStop)} kWh would cover the remaining distance.`
                : `Your estimated usable range with a 10% arrival reserve is ${Math.round(usableMiles)} miles—enough for this example route.`}
            </p>
            {needsStop && (
              <div className="route-stop">
                <span className="stop-number">1</span>
                <div>
                  <h4>Illustrative rapid charge</h4>
                  <p>
                    Example tariff: {stop.pricePencePerKwh}p/kWh · up to{" "}
                    {effectiveKw} kW for your car
                  </p>
                  <strong>
                    <Zap size={13} aria-hidden="true" /> Approx.{" "}
                    {minutes(stopMinutes)} · {pounds(chargingCost)}
                  </strong>
                </div>
              </div>
            )}
            <div className="notice">
              <Clock3 size={16} aria-hidden="true" />
              <span>
                Planning estimate only. Real-world range, traffic, weather,
                topography, charger access and charging curves can change the
                result.
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
