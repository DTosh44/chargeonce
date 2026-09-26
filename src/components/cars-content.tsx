"use client";

import Link from "next/link";
import { ArrowRight, CarFront, CheckCircle2, Info } from "lucide-react";
import { useVehicle } from "@/components/vehicle-context";
import { Card, PageHeader, buttonStyles } from "@/components/ui";

export function CarsContent() {
  const { vehicle, vehicles, setVehicleId } = useVehicle();
  return (
    <div className="shell page-section">
      <PageHeader
        eyebrow="My cars"
        title="Your car changes everything."
        description="Pick a demo vehicle and see personalised estimates across ChargeOnce. Your choice stays in this browser."
      />
      <div className="cars-layout">
        <div
          className="vehicle-list"
          role="group"
          aria-label="Choose your demo car"
        >
          {vehicles.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={option.id === vehicle.id}
              className={`card vehicle-card ${option.id === vehicle.id ? "selected" : ""}`}
              onClick={() => setVehicleId(option.id)}
            >
              <span className={`vehicle-art ${option.imageTone}`}>
                <CarFront size={32} aria-hidden="true" />
              </span>
              <span className="vehicle-text">
                <strong>
                  {option.make} {option.model}
                </strong>
                <small>{option.trim}</small>
              </span>
              {option.id === vehicle.id && (
                <CheckCircle2 size={20} color="#1568e8" aria-label="Selected" />
              )}
            </button>
          ))}
          <div className="notice">
            <Info size={16} aria-hidden="true" />
            <span>
              These are illustrative specifications. A live vehicle database and
              personal garage can be connected in a later release.
            </span>
          </div>
        </div>
        <Card className="vehicle-specs">
          <span className="eyebrow">Selected vehicle</span>
          <h2 style={{ marginTop: 13 }}>
            {vehicle.make} {vehicle.model}
          </h2>
          <p>{vehicle.trim} · demo specification</p>
          <div className="spec-list">
            <div>
              <small>Battery capacity</small>
              <strong>{vehicle.batteryKwh} kWh</strong>
            </div>
            <div>
              <small>Estimated range</small>
              <strong>{vehicle.estimatedRangeMiles} miles</strong>
            </div>
            <div>
              <small>Maximum DC speed</small>
              <strong>{vehicle.maxDcKw} kW</strong>
            </div>
            <div>
              <small>Maximum AC speed</small>
              <strong>{vehicle.maxAcKw} kW</strong>
            </div>
            <div>
              <small>Connectors</small>
              <strong>{vehicle.connectors.join(" + ")}</strong>
            </div>
            <div>
              <small>Energy / 100 miles</small>
              <strong>
                {(
                  (vehicle.batteryKwh / vehicle.estimatedRangeMiles) *
                  100
                ).toFixed(1)}{" "}
                kWh
              </strong>
            </div>
          </div>
          <Link href="/map" className={buttonStyles()}>
            Find chargers for this car{" "}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </Card>
      </div>
    </div>
  );
}
