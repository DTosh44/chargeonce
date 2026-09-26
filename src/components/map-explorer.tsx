"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GeoBounds, LocationBatch } from "@/domain/charging-data";
import type { Connector } from "@/domain/types";
import type { FacilityCode } from "@/domain/models";
import {
  DEFAULT_CHARGING_BOUNDS,
  inBounds,
} from "@/providers/charging/provider";
import {
  boundedViewport,
  boundsAround,
  distanceMiles,
  facilityLabels,
  filterSites,
  initialFilters,
  statusLabels,
  statusSymbols,
  usablePrice,
  usefulPower,
  type SearchPlace,
  type MarkerStatus,
} from "@/lib/discovery";
import { searchPlaces } from "@/lib/mapbox-search";
import { VehicleSelector, useVehicle } from "./vehicle-context";
import { Input, PageHeader, Select } from "./ui";
import { ChargerMap } from "./charger-map";
import { DiscoveryCard } from "./discovery-card";
const marlow: SearchPlace = {
  id: "marlow",
  label: "Marlow area centre",
  latitude: 51.557,
  longitude: -0.776,
};
export function MapExplorer({
  initial,
  mapToken,
}: {
  initial: LocationBatch;
  mapToken: string | null;
}) {
  const { vehicle } = useVehicle();
  const [batch, setBatch] = useState(initial);
  const [bounds, setBounds] = useState(DEFAULT_CHARGING_BOUNDS);
  const [origin, setOrigin] = useState(marlow);
  const [filters, setFilters] = useState(initialFilters);
  const [view, setView] = useState<"map" | "list">("list");
  const [sort, setSort] = useState("distance");
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<SearchPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const searchController = useRef<AbortController | null>(null);
  const geoGeneration = useRef(0);
  const updateBounds = useCallback((next: GeoBounds) => setBounds(next), []);
  useEffect(
    () => () => {
      searchController.current?.abort();
      geoGeneration.current++;
    },
    [],
  );
  useEffect(() => {
    if (!boundedViewport(bounds)) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const response = await fetch(
          `/api/charging/locations?${new URLSearchParams(Object.fromEntries(Object.entries(bounds).map(([key, value]) => [key, String(value)])))}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error();
        const result = (await response.json()) as LocationBatch;
        if (!controller.signal.aborted) setBatch(result);
      } catch {
        if (!controller.signal.aborted)
          setLoadError(
            "Could not refresh this area. Previous results are retained; they may be incomplete.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 450);
    return () => {
      clearTimeout(timer);
      controller.abort();
      setLoading(false);
    };
  }, [bounds, retry]);
  const choosePlace = (place: SearchPlace) => {
    geoGeneration.current++;
    setLocating(false);
    setOrigin(place);
    setBounds(boundsAround(place));
    setPlaces([]);
    setMessage(null);
  };
  const findPlace = async (event: React.FormEvent) => {
    event.preventDefault();
    searchController.current?.abort();
    const controller = new AbortController();
    searchController.current = controller;
    setSearching(true);
    setMessage(null);
    setPlaces([]);
    try {
      if (!mapToken) {
        if (/^(marlow|sl7(?:\s.*)?)$/i.test(query.trim())) {
          choosePlace(marlow);
          return;
        }
        throw new Error(
          "UK location search needs a Mapbox token. Try Marlow or SL7 to explore the demo area.",
        );
      }
      const results = await searchPlaces(query, mapToken, controller.signal);
      if (!controller.signal.aborted) {
        setPlaces(results);
        if (!results.length)
          setMessage(
            "No places found. Try a full postcode, town or destination address.",
          );
      }
    } catch (error) {
      if (!controller.signal.aborted)
        setMessage(
          error instanceof Error ? error.message : "Location search failed.",
        );
    } finally {
      if (!controller.signal.aborted) setSearching(false);
    }
  };
  const locate = () => {
    const generation = ++geoGeneration.current;
    setMessage(null);
    if (!navigator.geolocation) {
      setMessage(
        "Location is not supported here. Search by postcode or town instead.",
      );
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (generation !== geoGeneration.current) return;
        choosePlace({
          id: "current",
          label: "your location",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        if (generation !== geoGeneration.current) return;
        setLocating(false);
        setMessage(
          error.code === 1
            ? "Location permission was denied. You can still search by postcode or town."
            : "Could not find your location. Search by postcode or town instead.",
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  };
  const visible = useMemo(
    () =>
      filterSites(
        batch.locations.filter((s) => inBounds(s, bounds)),
        vehicle,
        filters,
      )
        .map((site) =>
          filters.connector === "all"
            ? site
            : {
                ...site,
                connectors: site.connectors.filter(
                  (c) => c.type === filters.connector,
                ),
              },
        )
        .sort((a, b) =>
          sort === "price"
            ? (usablePrice(a) ? a.tariff.pricePerKwh! : Infinity) -
              (usablePrice(b) ? b.tariff.pricePerKwh! : Infinity)
            : sort === "speed"
              ? usefulPower(b, vehicle) - usefulPower(a, vehicle)
              : distanceMiles(a, origin) - distanceMiles(b, origin),
        ),
    [batch, bounds, vehicle, filters, sort, origin],
  );
  const operators = [
    ...new Map(
      batch.locations.map((s) => [s.operator.id, s.operator]),
    ).values(),
  ];
  const selectSite = useCallback((id: string) => {
    setSelected(id);
    setView("list");
    setTimeout(() => {
      const item = document.getElementById(`discovery-${id}`);
      item?.focus({ preventScroll: true });
      item?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 80);
  }, []);
  const demo = batch.provider === "mock";
  return (
    <div className="shell page-section discovery">
      <PageHeader
        eyebrow="Find a charger"
        title="The right charger. For your car."
        description="Search a place, explore the map and compare what a charging stop could cost you."
      />
      <div className="card discovery-search">
        <VehicleSelector id="map-vehicle" />
        <form onSubmit={findPlace} className="discovery-search-form">
          <label className="field-label" htmlFor="place-search">
            Postcode, town or destination
            <Input
              id="place-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. SL7 1RG, Oxford or Heathrow"
              maxLength={256}
              required
            />
          </label>
          <button className="button button-primary" disabled={searching}>
            {searching ? "Searching…" : "Search"}
          </button>
          <button
            className="button button-secondary"
            type="button"
            onClick={locate}
            disabled={locating}
          >
            {locating ? "Locating…" : "Use my location"}
          </button>
        </form>
        <p className="subtle">
          Location permission is requested only when you choose “Use my
          location”. Your location is not saved to your account. Mapbox handles
          map and place searches.
        </p>
        {message && (
          <p role="status" className="notice">
            {message}
          </p>
        )}
        {places.length > 0 && (
          <ul className="discovery-places" aria-label="Choose a location">
            {places.map((p) => (
              <li key={p.id}>
                <button
                  className="button button-secondary"
                  onClick={() => choosePlace(p)}
                >
                  {p.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <details className="card discovery-filters">
        <summary>
          Filters · choose speed, connector, price and facilities
        </summary>
        <div className="discovery-filter-grid">
          <label className="filter-check">
            <input
              type="checkbox"
              checked={filters.available}
              onChange={(e) =>
                setFilters({ ...filters, available: e.target.checked })
              }
            />{" "}
            Available now{demo ? " (demo)" : ""}
          </label>
          <label className="field-label" htmlFor="connector-filter">
            Connector
            <Select
              id="connector-filter"
              value={filters.connector}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  connector: e.target.value as Connector | "all",
                })
              }
            >
              {["all", "CCS", "Type 2", "CHAdeMO"].map((c) => (
                <option key={c} value={c}>
                  {c === "all" ? "All compatible connectors" : c}
                </option>
              ))}
            </Select>
          </label>
          <label className="field-label" htmlFor="price-filter">
            Maximum price
            <Select
              id="price-filter"
              value={filters.price ?? "all"}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  price:
                    e.target.value === "all" ? null : Number(e.target.value),
                })
              }
            >
              <option value="all">Any / unknown price</option>
              {[0.4, 0.5, 0.6, 0.7, 0.8, 1].map((p) => (
                <option key={p} value={p}>
                  Up to {p * 100}p/kWh
                </option>
              ))}
            </Select>
          </label>
          <label className="field-label" htmlFor="network-filter">
            Network
            <Select
              id="network-filter"
              value={filters.operator}
              onChange={(e) =>
                setFilters({ ...filters, operator: e.target.value })
              }
            >
              <option value="all">All networks</option>
              {operators.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="field-label" htmlFor="access-filter">
            Public / community
            <Select
              id="access-filter"
              value={filters.access}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  access: e.target.value as typeof filters.access,
                })
              }
            >
              <option value="all">All published public-access chargers</option>
              <option value="public">Public networks</option>
              <option value="community">Community chargers</option>
            </Select>
          </label>
        </div>
        <fieldset className="discovery-powers">
          <legend>Minimum charger power</legend>
          {[0, 7, 22, 50, 100, 150, 250].map((power) => (
            <button
              type="button"
              key={power}
              aria-pressed={filters.power === power}
              onClick={() => setFilters({ ...filters, power })}
            >
              {power ? `${power}kW+` : "Any speed"}
            </button>
          ))}
        </fieldset>
        <fieldset className="discovery-facilities">
          <legend>Required facilities</legend>
          {Object.entries(facilityLabels).map(([code, label]) => (
            <label key={code}>
              <input
                type="checkbox"
                checked={filters.facilities.includes(code as FacilityCode)}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    facilities: e.target.checked
                      ? [...filters.facilities, code as FacilityCode]
                      : filters.facilities.filter((f) => f !== code),
                  })
                }
              />{" "}
              {label}
            </label>
          ))}
        </fieldset>
        <p className="subtle">
          Only verified matches pass availability, price and facility filters.
          Community results appear only when publicly published; private hosts
          are not exposed.
        </p>
        <button
          className="button button-secondary"
          onClick={() => setFilters(initialFilters)}
        >
          Reset filters
        </button>
      </details>
      <div className="notice" role="status">
        {demo
          ? "DEMO DATA — fictional chargers, availability and pricing. Do not travel using these records."
          : "EXTERNAL / LIVE DATA — source confidence is shown on every card. Check the operator before travelling."}
        {batch.fallbackReason === "provider_unavailable"
          ? " The provider is unavailable; demo fallback is shown."
          : ""}
        {batch.mayBeTruncated
          ? " Results are capped. Zoom in for more complete coverage."
          : ""}
        {!boundedViewport(bounds)
          ? " Zoom in to search more chargers. Only previously loaded locations are shown; this is not nationwide coverage."
          : ""}
      </div>
      <div className="results-header">
        <strong role="status" aria-live="polite">
          {loading ? "Refreshing… " : ""}
          {visible.length} compatible location{visible.length === 1 ? "" : "s"}
        </strong>
        <label className="field-label" htmlFor="discovery-sort">
          Sort
          <Select
            id="discovery-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="distance">Nearest to selected location</option>
            <option value="price">Lowest tariff first</option>
            <option value="speed">Highest useful power first</option>
          </Select>
        </label>
      </div>
      {loadError && (
        <p role="alert">
          {loadError}{" "}
          <button
            className="button button-secondary"
            onClick={() => setRetry(retry + 1)}
          >
            Retry
          </button>
        </p>
      )}
      <div className="discovery-view-switch" aria-label="Results view">
        <button aria-pressed={view === "list"} onClick={() => setView("list")}>
          List
        </button>
        <button aria-pressed={view === "map"} onClick={() => setView("map")}>
          Map
        </button>
      </div>
      <div className={`discovery-layout discovery-view-${view}`}>
        <section className="discovery-map-section" aria-label="Charger map">
          <ChargerMap
            token={mapToken}
            sites={visible}
            destination={origin}
            onBounds={updateBounds}
            onSelect={selectSite}
          />
          <ul className="discovery-legend" aria-label="Marker legend">
            {(Object.keys(statusLabels) as MarkerStatus[]).map((s) => (
              <li key={s}>
                <strong>{statusSymbols[s]}</strong> {statusLabels[s]}
              </li>
            ))}
          </ul>
          <p className="subtle">
            Numbered markers are clusters; select one to zoom in. All locations
            are also in the list.
          </p>
        </section>
        <section
          className="discovery-list-section"
          aria-label="Charger results"
          aria-busy={loading}
        >
          <h2 className="sr-only">Charging locations</h2>
          <ol className="discovery-list" role="list">
            {visible.map((site) => (
              <li
                role="listitem"
                tabIndex={-1}
                id={`discovery-${site.id}`}
                key={site.id}
              >
                <DiscoveryCard
                  site={site}
                  vehicle={vehicle}
                  origin={origin}
                  selected={selected === site.id}
                />
              </li>
            ))}
          </ol>
          {!visible.length && (
            <div className="card empty-state">
              <h2>No matching chargers in this area</h2>
              <p>
                {filters.access === "community"
                  ? "No matching community chargers are publicly published here."
                  : "Try resetting filters, searching another place or moving the map. Missing availability, price and facilities are never assumed."}
              </p>
              <button
                className="button button-secondary"
                onClick={() => setFilters(initialFilters)}
              >
                Reset filters
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
