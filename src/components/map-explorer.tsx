"use client";

import { useMemo, useState } from "react";
import { Info, Search, SlidersHorizontal } from "lucide-react";
import { ChargerCard } from "@/components/charger-card";
import { VehicleSelector, useVehicle } from "@/components/vehicle-context";
import { Input, PageHeader, Select } from "@/components/ui";
import { isCompatible } from "@/lib/charging";

export function MapExplorer() {
  const { vehicle, chargers } = useVehicle();
  const [search, setSearch] = useState("");
  const [speed, setSpeed] = useState("all");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [sort, setSort] = useState("distance");
  const [selected, setSelected] = useState<string | null>(null);
  const filtered = useMemo(
    () =>
      chargers
        .filter((charger) => {
          const query = search.toLowerCase().trim();
          return (
            isCompatible(vehicle, charger) &&
            (!query ||
              `${charger.name} ${charger.location} ${charger.postcode} ${charger.network}`
                .toLowerCase()
                .includes(query)) &&
            (speed === "all" ||
              (speed === "rapid" ? charger.maxKw >= 50 : charger.maxKw < 50)) &&
            (!availableOnly || charger.status === "Available")
          );
        })
        .sort((a, b) =>
          sort === "price"
            ? a.pricePencePerKwh - b.pricePencePerKwh
            : sort === "speed"
              ? b.maxKw - a.maxKw
              : a.distanceMiles - b.distanceMiles,
        ),
    [search, speed, availableOnly, sort, vehicle, chargers],
  );

  return (
    <div className="shell page-section">
      <PageHeader
        eyebrow="Find a charger"
        title="Find the right stop."
        description="Compare illustrative chargers by what matters most: likely cost, time, availability and how well they suit your car."
      />
      <div className="explorer-grid">
        <aside className="card filter-panel">
          <h2>
            <SlidersHorizontal size={17} aria-hidden="true" /> Search & filters
          </h2>
          <div className="filter-stack">
            <VehicleSelector id="map-vehicle" />
            <label className="field-label" htmlFor="charger-search">
              Place, postcode or charger
              <Input
                id="charger-search"
                placeholder="Try Marlow or SL7"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <label className="field-label" htmlFor="speed-filter">
              Charging speed
              <Select
                id="speed-filter"
                value={speed}
                onChange={(event) => setSpeed(event.target.value)}
              >
                <option value="all">All speeds</option>
                <option value="rapid">Rapid · 50 kW+</option>
                <option value="standard">Standard · under 50 kW</option>
              </Select>
            </label>
            <label className="filter-check">
              <input
                type="checkbox"
                checked={availableOnly}
                onChange={(event) => setAvailableOnly(event.target.checked)}
              />{" "}
              Available only
            </label>
            <label className="field-label" htmlFor="sort-chargers">
              Sort by
              <Select
                id="sort-chargers"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="distance">Nearest first</option>
                <option value="price">Lowest tariff first</option>
                <option value="speed">Highest power first</option>
              </Select>
            </label>
            <div className="notice">
              <Info size={16} aria-hidden="true" />
              <span>
                Demo locations, prices and availability are illustrative. Do not
                navigate to a charger based on this preview.
              </span>
            </div>
          </div>
        </aside>
        <div>
          <div
            className="map-panel"
            role="group"
            aria-label="Illustrative map showing demo chargers near Marlow"
          >
            <div className="map-river" />
            <div className="map-road" />
            <div className="map-current" />
            {filtered.map((charger) => (
              <button
                type="button"
                key={charger.id}
                className={`map-pin ${charger.status !== "Available" ? "muted" : ""}`}
                style={{ left: `${charger.x}%`, top: `${charger.y}%` }}
                aria-label={`Show ${charger.name}`}
                onClick={() => {
                  setSelected(charger.id);
                  document
                    .getElementById(`charger-${charger.id}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
              >
                {charger.maxKw} kW
              </button>
            ))}
            <span className="map-caption">Illustrative map · Marlow area</span>
          </div>
          <div className="results-header">
            <strong>
              <Search size={15} aria-hidden="true" /> {filtered.length}{" "}
              compatible charger{filtered.length === 1 ? "" : "s"}
            </strong>
            <span className="subtle">
              Estimates for {vehicle.make} {vehicle.model}
            </span>
          </div>
          <div className="results-stack">
            {filtered.length ? (
              filtered.map((charger) => (
                <div
                  key={charger.id}
                  id={`charger-${charger.id}`}
                  style={{
                    outline:
                      selected === charger.id ? "2px solid #1568e8" : "none",
                    borderRadius: 18,
                  }}
                >
                  <ChargerCard charger={charger} vehicle={vehicle} />
                </div>
              ))
            ) : (
              <div className="card empty-state">
                No chargers match these filters. Try another place, speed or
                availability setting.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
