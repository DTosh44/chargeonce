"use client";

import { BatteryCharging, Info } from "lucide-react";
import { useState } from "react";
import { VehicleSelector, useVehicle } from "@/components/vehicle-context";
import { Card, Input, Metric, PageHeader, Select } from "@/components/ui";
import { estimateCharge, minutes, pounds } from "@/lib/charging";
import type { Charger } from "@/domain/types";

export function ChargingCalculator() {
  const { vehicle } = useVehicle();
  const [start, setStart] = useState(20);
  const [target, setTarget] = useState(80);
  const [tariff, setTariff] = useState(69);
  const [power, setPower] = useState(150);
  const charger: Charger = {
    id: "custom",
    name: "Custom charger",
    network: "Your estimate",
    location: "",
    postcode: "",
    distanceMiles: 0,
    maxKw: power,
    connector: power <= 22 ? "Type 2" : "CCS",
    pricePencePerKwh: tariff,
    connectionFeePence: 0,
    status: "Unknown",
    reliabilityPercent: 0,
    stalls: 0,
    availableStalls: null,
    x: 0,
    y: 0,
  };
  const estimate = estimateCharge(vehicle, charger, start, target);
  return (
    <div className="shell page-section">
      <PageHeader
        eyebrow="Charging calculator"
        title="Know the likely cost before you plug in."
        description="Adjust your car, battery level and tariff to get an easy-to-understand estimate in pounds and minutes."
      />
      <div className="calculator-layout">
        <Card className="form-card">
          <h2>Your charging session</h2>
          <div className="form-stack">
            <VehicleSelector id="calc-vehicle" />
            <label className="field-label" htmlFor="current-charge">
              Current battery
              <Select
                id="current-charge"
                value={start}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setStart(value);
                  if (value > target) setTarget(value);
                }}
              >
                {Array.from({ length: 21 }, (_, index) => index * 5).map(
                  (value) => (
                    <option key={value} value={value}>
                      {value}%
                    </option>
                  ),
                )}
              </Select>
            </label>
            <label className="field-label" htmlFor="target-charge">
              Charge up to
              <Select
                id="target-charge"
                value={target}
                onChange={(event) => setTarget(Number(event.target.value))}
              >
                {Array.from({ length: 21 }, (_, index) => index * 5)
                  .filter((value) => value >= start)
                  .map((value) => (
                    <option key={value} value={value}>
                      {value}%
                    </option>
                  ))}
              </Select>
            </label>
            <label className="field-label" htmlFor="tariff">
              Tariff (p/kWh)
              <Input
                id="tariff"
                type="number"
                min="0"
                max="300"
                step="1"
                value={tariff}
                onChange={(event) =>
                  setTariff(
                    Math.max(0, Math.min(300, Number(event.target.value) || 0)),
                  )
                }
              />
            </label>
            <label className="field-label" htmlFor="power">
              Charger power
              <Select
                id="power"
                value={power}
                onChange={(event) => setPower(Number(event.target.value))}
              >
                <option value="7">7 kW · AC</option>
                <option value="22">22 kW · AC</option>
                <option value="50">50 kW · rapid</option>
                <option value="75">75 kW · rapid</option>
                <option value="150">150 kW · ultra-rapid</option>
                <option value="300">300 kW · ultra-rapid</option>
              </Select>
            </label>
          </div>
        </Card>
        <Card className="calculator-results">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Your estimate</span>
              <h2
                className="section-title"
                style={{ fontSize: 28, margin: "10px 0 0" }}
              >
                Charging, in real terms.
              </h2>
            </div>
            <BatteryCharging color="#1568e8" aria-hidden="true" />
          </div>
          <div className="calc-grid">
            <Metric
              prominent
              label={`Cost from ${start}% to ${target}%`}
              value={pounds(estimate.costToTarget)}
              detail="Energy cost; no connection fee"
            />
            <Metric
              label="Cost per 100 miles"
              value={pounds(estimate.costPer100Miles)}
              detail="Based on estimated range"
            />
            <Metric
              label="Likely charging time"
              value={minutes(estimate.timeToTargetMinutes)}
              detail="Includes a simple speed taper"
            />
            <Metric
              label="Energy added"
              value={`${estimate.energyNeededKwh.toFixed(1)} kWh`}
              detail={`Up to ${estimate.effectiveKw} kW effective power`}
            />
          </div>
          <p className="calc-explanation">
            A {vehicle.make} {vehicle.model} needs approximately{" "}
            {estimate.energyNeededKwh.toFixed(1)} kWh to go from {start}% to{" "}
            {target}%. At {tariff}p/kWh, that is about{" "}
            {pounds(estimate.costToTarget)}. Per-100-mile cost excludes session
            fees.
          </p>
          <div className="notice" style={{ marginTop: 20 }}>
            <Info size={16} aria-hidden="true" />
            <span>
              Estimates use nominal battery capacity, official-style range and a
              simplified charging curve. Actual bills and charge times vary.
              Enter the current charger tariff before relying on a quote.
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}
