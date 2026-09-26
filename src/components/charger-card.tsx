import { ArrowUpRight, MapPin, PlugZap, ShieldCheck } from "lucide-react";
import type { Charger, Vehicle } from "@/domain/types";
import { estimateCharge, minutes, pounds } from "@/lib/charging";
import { Badge, Card, StatusBadge } from "@/components/ui";

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
  const estimate = estimateCharge(vehicle, charger);
  return (
    <Card className={`charger-card ${compact ? "compact" : ""}`}>
      <div className="charger-top">
        <div className="charger-icon">
          <PlugZap size={22} aria-hidden="true" />
        </div>
        <div className="charger-title">
          <div className="charger-title-row">
            <h3>{charger.name}</h3>
            {tag && <Badge>{tag}</Badge>}
          </div>
          <p>
            {charger.network} · {charger.location}
          </p>
        </div>
        <StatusBadge status={charger.status} />
      </div>
      <div className="charger-details">
        <span>
          <MapPin size={16} aria-hidden="true" /> {charger.distanceMiles} mi
          away
        </span>
        <span>
          <PlugZap size={16} aria-hidden="true" /> {charger.maxKw} kW ·{" "}
          {charger.connector}
        </span>
        <span>
          <ShieldCheck size={16} aria-hidden="true" />{" "}
          {charger.reliabilityPercent}% reliability
        </span>
      </div>
      <div className="charger-metrics">
        <div>
          <small>Cost / 100 miles</small>
          <strong>{pounds(estimate.costPer100Miles)}</strong>
        </div>
        <div>
          <small>20–80% charge</small>
          <strong>{pounds(estimate.costToTarget)}</strong>
        </div>
        <div>
          <small>Likely time</small>
          <strong>{minutes(estimate.timeToTargetMinutes)}</strong>
        </div>
      </div>
      {!compact && (
        <div className="charger-foot">
          <span>
            Estimates include 10% charging losses ·{" "}
            {estimate.details.session.assumptions.curveSource === "vehicle"
              ? vehicle.isDemo
                ? "demo SOC curve"
                : "vehicle SOC curve"
              : "fallback time model"}{" "}
            ·{charger.isDemo && "DEMO DATA · "}
            {charger.availableStalls === null
              ? "Availability not known"
              : `${charger.availableStalls} of ${charger.stalls} connectors available`}{" "}
            · {charger.pricePencePerKwh}p/kWh
            {charger.connectionFeePence
              ? ` + ${charger.connectionFeePence}p fee`
              : ""}
          </span>
          <ArrowUpRight size={17} aria-hidden="true" />
        </div>
      )}
    </Card>
  );
}
