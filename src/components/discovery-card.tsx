import type { ChargingSite } from "@/domain/charging-data";
import { dataState, dataStateLabels } from "@/domain/charging-data";
import type { Vehicle } from "@/domain/types";
import {
  discoveryEstimate,
  directionsUrl,
  distanceMiles,
  facilityLabels,
  markerStatus,
  statusLabels,
  statusSymbols,
  usablePrice,
  type SearchPlace,
} from "@/lib/discovery";
import { minutes, pounds } from "@/lib/charging";
import { Badge, Card } from "./ui";

export function DiscoveryCard({
  site,
  vehicle,
  origin,
  selected,
}: {
  site: ChargingSite;
  vehicle: Vehicle;
  origin: SearchPlace;
  selected: boolean;
}) {
  const estimate = discoveryEstimate(site, vehicle);
  const state = markerStatus(site);
  const demo = site.provenance.kind === "demo";
  const directions = directionsUrl(site);
  const availability = dataState(site.status.provenance);
  const free =
    state === "unknown" || state === "offline"
      ? null
      : site.status.availableConnectors;
  return (
    <Card
      className={`charger-card discovery-card ${selected ? "discovery-selected" : ""}`}
    >
      <div className="charger-title-row">
        <h3>{site.name}</h3>
        <Badge>{dataStateLabels[dataState(site.provenance)]}</Badge>
      </div>
      <p>
        {site.operator.name} · {site.address} {site.postcode}
      </p>
      <p className="discovery-status">
        <strong>
          {statusSymbols[state]} · {statusLabels[state]}
        </strong>{" "}
        · {distanceMiles(site, origin).toFixed(1)} mi from {origin.label}{" "}
        (straight-line{demo ? ", demo" : ""})
      </p>
      <div className="charger-metrics">
        <div>
          <small>Estimated / 100 miles</small>
          <strong>
            {estimate?.cost100 != null
              ? pounds(estimate.cost100)
              : "Price unknown"}
          </strong>
        </div>
        <div>
          <small>Estimated to 80%</small>
          <strong>
            {estimate?.cost80 != null
              ? `About £${Math.round(estimate.cost80)}`
              : "Price / fees unknown"}
          </strong>
        </div>
        <div>
          <small>Estimated charging time</small>
          <strong>
            {estimate ? minutes(estimate.session.timeMinutes) : "Not estimable"}
          </strong>
        </div>
      </div>
      <p>
        <strong>Up to {estimate?.usefulKw ?? 0} kW useful for your car</strong>{" "}
        · {site.connectors.map((c) => c.description).join(" / ")}
      </p>
      <p>
        {free !== null
          ? `${free}${site.status.totalConnectors !== null ? ` / ${site.status.totalConnectors}` : ""} connectors available${demo ? " (demo)" : ""}`
          : "Available charger count unknown"}
        .{" "}
        {availability === "live"
          ? "Live availability"
          : demo
            ? "Not live availability"
            : `Live availability unavailable · ${dataStateLabels[availability]}`}
      </p>
      <p className="subtle">
        {usablePrice(site)
          ? `${Math.round(site.tariff.pricePerKwh! * 100)}p/kWh${site.tariff.connectionFee === null ? " · connection fee unknown" : ` · ${pounds(site.tariff.connectionFee)} connection fee`}`
          : "No current structured GBP price"}
        {site.tariff.description ? ` · ${site.tariff.description}` : ""}
      </p>
      <p className="subtle">
        20–80% battery estimate · 10% charging losses ·{" "}
        {estimate?.session.assumptions.curveSource === "vehicle"
          ? "vehicle charging curve"
          : "fallback charging-time model"}
        . Excludes parking, idle fees and subscriptions.{" "}
        {vehicle.isDemo
          ? "Vehicle specifications are development estimates."
          : ""}
      </p>
      <p className="subtle">
        {site.facilities?.length
          ? site.facilities.map((f) => facilityLabels[f]).join(" · ")
          : site.facilities
            ? "No listed facilities"
            : "Facilities unverified"}
      </p>
      <div className="discovery-card-footer">
        {directions ? (
          <a
            className="button button-secondary"
            href={directions}
            target="_blank"
            rel="noopener noreferrer"
          >
            Directions ↗
            <span className="sr-only">
              {" "}
              to {site.name} in Google Maps (new tab)
            </span>
          </a>
        ) : (
          <span>Directions disabled for fictional demo locations.</span>
        )}
        <span className="subtle">
          {site.provenance.attribution.url ? (
            <a
              href={site.provenance.attribution.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {site.provenance.attribution.name} ↗
            </a>
          ) : (
            site.provenance.attribution.name
          )}
          {site.provenance.attribution.licence
            ? ` · ${site.provenance.attribution.licence}`
            : ""}
        </span>
      </div>
    </Card>
  );
}
