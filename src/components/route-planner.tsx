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
import { VehicleSelector, useVehicle } from "@/components/vehicle-context";
import { Card, Metric, PageHeader, Select } from "@/components/ui";
import { minutes, pounds, recommendedChargers } from "@/lib/charging";
import { useState } from "react";
import { estimateJourneyCharging } from "@/lib/journey-charging";

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
  const { vehicle, chargers } = useVehicle();
  const [routeId, setRouteId] = useState("manchester");
  const [startingCharge, setStartingCharge] = useState(40);
  const route = routes.find((item) => item.id === routeId) ?? routes[0];
  const stop = recommendedChargers(vehicle, chargers).best;
  const {
    usableMiles,
    energyAtStop,
    requiredTopUps,
    effectiveKw,
    stopMinutes,
    chargingCost,
    drivingMinutes,
    needsStop,
  } = estimateJourneyCharging(vehicle, stop, route.miles, startingCharge);

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
              value={
                needsStop && !stop
                  ? "Unknown"
                  : minutes(drivingMinutes + (stopMinutes ?? 0))
              }
            />
            <Metric
              label="Estimated charging"
              value={
                needsStop && !stop
                  ? "Unknown"
                  : needsStop
                    ? pounds(chargingCost ?? 0)
                    : "£0.00"
              }
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
                ? `Starting at ${startingCharge}%, your estimated usable range with a 10% arrival reserve is ${Math.round(usableMiles)} miles. Roughly ${Math.round(energyAtStop)} kWh of additional energy across ${requiredTopUps} charging stop${requiredTopUps === 1 ? "" : "s"} would cover the remaining distance, using a 10–80% charging window.`
                : `Your estimated usable range with a 10% arrival reserve is ${Math.round(usableMiles)} miles—enough for this example route.`}
            </p>
            {needsStop && stop && (
              <div className="route-stop">
                <span className="stop-number">
                  {requiredTopUps === 1 ? "1" : `1–${requiredTopUps}`}
                </span>
                <div>
                  <h4>Illustrative charging allowance · DEMO DATA</h4>
                  <p>
                    Example tariff: {stop.pricePencePerKwh}p/kWh · up to{" "}
                    {effectiveKw} kW for your car
                  </p>
                  <strong>
                    <Zap size={13} aria-hidden="true" /> Approx.{" "}
                    {minutes(stopMinutes ?? 0)} · {pounds(chargingCost ?? 0)}
                  </strong>
                </div>
              </div>
            )}
            <div className="notice">
              <Clock3 size={16} aria-hidden="true" />
              <span>
                {needsStop &&
                  !stop &&
                  "No compatible charger is present in this demo catalogue. "}
                Planning estimate only, including 10% charging losses and
                SOC-band charging time. Real-world range, traffic, weather,
                topography, charger access and battery temperature can change
                the result.
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
