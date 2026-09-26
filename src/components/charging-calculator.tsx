"use client";
import { BatteryCharging, Info } from "lucide-react";
import { useState } from "react";
import { VehicleSelector, useVehicle } from "@/components/vehicle-context";
import { Card, Input, Metric, PageHeader, Select } from "@/components/ui";
import {
  approximateMiles,
  approximateMinutes,
  approximatePounds,
  calculationVehicle,
  pounds,
} from "@/lib/charging";
import {
  calculatorQuote,
  DEFAULT_CHARGING_LOSS_PERCENT,
} from "@/lib/charging-engine";
import type { ChargingMode } from "@/domain/charging";

export function ChargingCalculator() {
  const { vehicle } = useVehicle();
  const [current, setCurrent] = useState("20");
  const [target, setTarget] = useState("80");
  const [pricePence, setPrice] = useState("70");
  const [powerKw, setPower] = useState("150");
  const [lossPercent, setLoss] = useState(
    String(DEFAULT_CHARGING_LOSS_PERCENT),
  );
  const [mode, setMode] = useState<ChargingMode>("dc");
  const result = calculatorQuote(calculationVehicle(vehicle), {
    current,
    target,
    pricePence,
    powerKw,
    lossPercent,
    mode,
  });
  const quote = result.quote;
  const session = quote?.session;
  return (
    <div className="shell page-section">
      <PageHeader
        eyebrow="Charging calculator"
        title="Know the likely cost before you plug in."
        description="Choose your car and battery levels. We’ll turn the tariff into pounds, miles and an approximate charging time."
      />
      <div className="calculator-layout">
        <Card className="form-card">
          <h2>Your charging session</h2>
          <div className="form-stack">
            <VehicleSelector id="calc-vehicle" />
            <label className="field-label" htmlFor="current-charge">
              Current battery (%)
              <Input
                id="current-charge"
                type="number"
                min="0"
                max="100"
                step="1"
                value={current}
                onChange={(event) => setCurrent(event.target.value)}
              />
            </label>
            <label className="field-label" htmlFor="target-charge">
              Target battery (%)
              <Input
                id="target-charge"
                type="number"
                min="0"
                max="100"
                step="1"
                value={target}
                onChange={(event) => setTarget(event.target.value)}
              />
            </label>
            <label className="field-label" htmlFor="charging-type">
              Charging type
              <Select
                id="charging-type"
                value={mode}
                onChange={(event) =>
                  setMode(event.target.value as ChargingMode)
                }
              >
                <option value="dc">DC · rapid / ultra-rapid</option>
                <option value="ac">AC · home / destination</option>
              </Select>
            </label>
            <label className="field-label" htmlFor="power">
              Charger power (kW)
              <Input
                id="power"
                type="number"
                min="0.1"
                step="0.1"
                value={powerKw}
                onChange={(event) => setPower(event.target.value)}
              />
              <small>
                We cap this at your car’s limit and adjust for its battery
                level.
              </small>
            </label>
            <label className="field-label" htmlFor="tariff">
              Price per kWh (pence)
              <Input
                id="tariff"
                type="number"
                min="0"
                step="0.1"
                value={pricePence}
                onChange={(event) => setPrice(event.target.value)}
              />
              <small>
                Supporting tariff detail—not the price of a journey.
              </small>
            </label>
            <details className="advanced-options" open>
              <summary>Charging assumptions</summary>
              <label className="field-label" htmlFor="charging-losses">
                Charging losses (%)
                <Input
                  id="charging-losses"
                  type="number"
                  min="0"
                  max="50"
                  step="1"
                  value={lossPercent}
                  onChange={(event) => setLoss(event.target.value)}
                />
                <small>
                  Default: 10% of billed energy does not reach the battery.
                  Adjust from 0–50% if you have better data.
                </small>
              </label>
              <p className="calculation-small">
                No connection, parking, idle or subscription fees are included
                in this calculator.
              </p>
            </details>
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
                {session
                  ? session.batteryEnergyKwh === 0
                    ? "You’re already at the target."
                    : `About ${approximatePounds(session.totalCostPounds)} to reach ${session.targetSocPercent}%`
                  : "Let’s check those details."}
              </h2>
            </div>
            <BatteryCharging color="#1568e8" aria-hidden="true" />
          </div>
          {result.error && (
            <p role="alert" className="form-feedback error">
              {result.error} Estimates will return when the inputs are valid.
            </p>
          )}
          {quote && session && (
            <>
              <div className="calc-grid" aria-live="polite" aria-atomic="true">
                <Metric
                  prominent
                  label="Estimated cost"
                  value={
                    session.batteryEnergyKwh === 0
                      ? "£0"
                      : `About ${approximatePounds(session.totalCostPounds)}`
                  }
                  detail={`From ${session.currentSocPercent}% to ${session.targetSocPercent}% · losses included`}
                />
                <Metric
                  label="Estimated charging time"
                  value={approximateMinutes(session.timeMinutes)}
                  detail="SOC-band estimate, not peak power all the way"
                />
                <Metric
                  label="Approximate miles added"
                  value={approximateMiles(session.milesAdded)}
                  detail={`${vehicle.efficiencyMilesPerKwh?.toFixed(2) ?? "Derived"} miles/kWh · driving estimate`}
                />
                <Metric
                  label="Estimated cost per 100 miles"
                  value={`${pounds(quote.hundredMiles.costPounds)} / 100 miles`}
                  detail="Charging losses included · session fees excluded"
                />
              </div>
              <p className="calc-explanation">
                {quote.alreadyAt80
                  ? "You’re already at or above 80%, so no extra charge is needed to reach 80%."
                  : `To reach 80% from ${current}%: about ${approximatePounds(quote.to80.totalCostPounds)} · ${approximateMinutes(quote.to80.timeMinutes).toLowerCase()} · ${approximateMiles(quote.to80.milesAdded).toLowerCase()} added.`}
              </p>
              <div className="calc-grid calculation-energy">
                <Metric
                  label="Energy stored in your battery"
                  value={`${session.batteryEnergyKwh.toFixed(1)} kWh`}
                  detail={`${vehicle.batteryKwh} kWh usable battery—not gross capacity`}
                />
                <Metric
                  label="Estimated energy billed"
                  value={`${session.billedEnergyKwh.toFixed(1)} kWh`}
                  detail={`${session.lossEnergyKwh.toFixed(1)} kWh lost · ${lossPercent}% loss assumption`}
                />
              </div>
              <div className="notice">
                <Info size={16} aria-hidden="true" />
                <span>
                  {session.assumptions.curveSource === "vehicle"
                    ? vehicle.isDemo
                      ? "Illustrative demo charging curve: this is not measured data for your car."
                      : "Vehicle SOC-band curve used; actual accepted power can differ."
                    : session.assumptions.curveSource === "fallback_ac"
                      ? "Fallback AC estimation model: steady power with an end-of-charge taper. No measured AC curve is available."
                      : `Fallback DC estimation model: a generic taper is used because the vehicle curve is ${session.assumptions.curveIssue === "invalid" ? "invalid or incomplete" : session.assumptions.curveIssue === "legacy_points" ? "a legacy point profile, not a complete SOC-band curve" : "unavailable"}.`}
                </span>
              </div>
              <p className="calculation-small">
                {session.assumptions.efficiencySource === "personal"
                  ? "Using your saved real-world efficiency override."
                  : "Using the catalogue efficiency estimate; save your typical real-world efficiency in My Cars for a more personal estimate."}{" "}
                Battery temperature, weather, shared charger power, battery
                condition and charging overhead can change the result. These are
                estimates, not quotes or guaranteed arrival ranges.
              </p>
              <details className="advanced-options calculation-breakdown">
                <summary>See the calculation and SOC-band breakdown</summary>
                <p>
                  {session.batteryEnergyKwh.toFixed(2)} kWh stored ÷ (1 −{" "}
                  {lossPercent}% losses) = {session.billedEnergyKwh.toFixed(2)}{" "}
                  kWh billed. At {pricePence}p/kWh the detailed model estimate
                  is {pounds(session.energyCostPounds)}.
                </p>
                <p>
                  For 100 miles:{" "}
                  {quote.hundredMiles.batteryEnergyKwh.toFixed(2)} kWh stored,{" "}
                  {quote.hundredMiles.billedEnergyKwh.toFixed(2)} kWh billed.
                  Billed energy × the tariff ={" "}
                  {pounds(quote.hundredMiles.costPounds)}.
                </p>
                <p>
                  Accepted charging-input power is capped by the car, charger
                  and each SOC band. Time = the sum of billed energy ÷ effective
                  input power across bands. This already accounts for the
                  selected losses.
                </p>
                {session.segments.length > 0 && (
                  <div className="calculation-table-wrap">
                    <table className="calculation-table">
                      <caption>Charging bands used for this estimate</caption>
                      <thead>
                        <tr>
                          <th scope="col">Battery level</th>
                          <th scope="col">Effective power</th>
                          <th scope="col">Billed energy</th>
                          <th scope="col">Model time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {session.segments.map((segment) => (
                          <tr key={segment.fromSocPercent}>
                            <td>
                              {segment.fromSocPercent}–{segment.toSocPercent}%
                            </td>
                            <td>{segment.effectivePowerKw.toFixed(1)} kW</td>
                            <td>{segment.billedEnergyKwh.toFixed(2)} kWh</td>
                            <td>{segment.minutes.toFixed(1)} min</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p>
                  Average accepted power in this model:{" "}
                  {session.averagePowerKw.toFixed(1)} kW. Peak accepted power in
                  this interval: {session.peakPowerKw.toFixed(1)} kW. A 100-mile
                  comparison is a consumption benchmark; a smaller battery may
                  need more than one charging session.
                </p>
              </details>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
