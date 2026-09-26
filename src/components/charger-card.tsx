import { ArrowUpRight, MapPin, PlugZap, ShieldCheck } from "lucide-react";
import type { Charger, Vehicle } from "@/domain/types";
import {
  estimateCharge,
  hasUsableTariff,
  hasCurrentAvailability,
  minutes,
  pounds,
} from "@/lib/charging";
import { Badge, Card, StatusBadge } from "@/components/ui";
import { ChargingDataBadge } from "./charging-data-badge";
import { dataState, dataStateLabels } from "@/domain/charging-data";

export function ChargerCard({
  charger,
  vehicle,
  tag,
  compact = false,
}: {
  charger: Charger;
  vehicle: Vehicle;
  tag?: string;
  compact?: boolean;
}) {
  const estimate = hasUsableTariff(charger)
    ? estimateCharge(vehicle, charger)
    : null;
  const availabilityCurrent = hasCurrentAvailability(charger);
  return (
    <Card className={`charger-card ${compact ? "compact" : ""}`}>
      <div className="charger-top">
        <div className="charger-icon">
          <PlugZap size={22} aria-hidden="true" />
        </div>
        <div className="charger-title">
          <div className="charger-title-row">
            <h3>{charger.name}</h3>
            <ChargingDataBadge charger={charger} />
            {tag && <Badge>{tag}</Badge>}
          </div>
          <p>
            {charger.network} · {charger.location}
          </p>
        </div>
        <StatusBadge
          status={availabilityCurrent ? charger.status : "Unknown"}
        />
      </div>
      <div className="charger-details">
        <span>
          <MapPin size={16} aria-hidden="true" />{" "}
          {charger.distanceMiles === null
            ? "Distance unknown"
            : `${charger.distanceMiles} mi ${charger.isDemo ? "away (demo)" : "from area centre"}`}
        </span>
        <span>
          <PlugZap size={16} aria-hidden="true" /> {charger.maxKw} kW ·{" "}
          {charger.connector}
        </span>
        <span>
          <ShieldCheck size={16} aria-hidden="true" />{" "}
          {charger.reliabilityPercent === null
            ? "Reliability not rated"
            : `${charger.reliabilityPercent}% reliability (demo)`}
        </span>
      </div>
      <div className="charger-metrics">
        <div>
          <small>Cost / 100 miles</small>
          <strong>
            {estimate ? pounds(estimate.costPer100Miles) : "Unknown tariff"}
          </strong>
        </div>
        <div>
          <small>20–80% charge</small>
          <strong>
            {estimate ? pounds(estimate.costToTarget) : "Unknown tariff"}
          </strong>
        </div>
        <div>
          <small>Likely time</small>
          <strong>
            {estimate
              ? minutes(estimate.timeToTargetMinutes)
              : "Use calculator"}
          </strong>
        </div>
      </div>
      {!compact && (
        <div className="charger-foot">
          <span>
            {estimate ? (
              <>
                Estimates include 10% charging losses ·{" "}
                {estimate.details.session.assumptions.curveSource === "vehicle"
                  ? vehicle.isDemo
                    ? "demo SOC curve"
                    : "vehicle SOC curve"
                  : "fallback time model"}{" "}
                ·{" "}
              </>
            ) : (
              "No verified structured tariff — no cost quote · "
            )}
            {charger.availableStalls === null || !availabilityCurrent
              ? "Availability not known"
              : `${charger.availableStalls} of ${charger.stalls} connectors available`}{" "}
            {estimate && (
              <>
                {" "}
                · {charger.pricePencePerKwh}p/kWh
                {charger.connectionFeePence
                  ? ` + ${charger.connectionFeePence}p fee`
                  : ""}
              </>
            )}
            {charger.availabilityProvenance &&
              ` · Availability: ${dataStateLabels[dataState(charger.availabilityProvenance)]}`}
            {charger.tariffProvenance &&
              ` · Pricing: ${dataStateLabels[dataState(charger.tariffProvenance)]}`}
            {charger.provenance && (
              <>
                {" "}
                · Source:{" "}
                {charger.provenance.attribution.url ? (
                  <a
                    href={charger.provenance.attribution.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {charger.provenance.attribution.name}
                  </a>
                ) : (
                  charger.provenance.attribution.name
                )}
                {charger.provenance.observedAt
                  ? ` · Source observation: ${charger.provenance.observedAt.slice(0, 10)}`
                  : " · Source observation unknown"}
                {charger.provenance.attribution.licence &&
                  ` · ${charger.provenance.attribution.licence}`}
              </>
            )}
            {charger.tariffDescription && (
              <span>
                {" "}
                · Provider price note (not a quote): {charger.tariffDescription}
              </span>
            )}
          </span>
          <ArrowUpRight size={17} aria-hidden="true" />
        </div>
      )}
    </Card>
  );
}
