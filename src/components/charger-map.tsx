"use client";
import { useEffect, useRef, useState } from "react";
import type { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { ChargingSite, GeoBounds } from "@/domain/charging-data";
import { markerStatus, statusSymbols, type SearchPlace } from "@/lib/discovery";
function points(sites: ChargingSite[]) {
  return {
    type: "FeatureCollection" as const,
    features: sites.map((site) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [site.longitude, site.latitude],
      },
      properties: {
        id: site.id,
        status: markerStatus(site),
        symbol: statusSymbols[markerStatus(site)],
      },
    })),
  };
}
export function ChargerMap({
  token,
  sites,
  destination,
  onBounds,
  onSelect,
}: {
  token: string | null;
  sites: ChargingSite[];
  destination: SearchPlace;
  onBounds: (bounds: GeoBounds) => void;
  onSelect: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapboxMap | null>(null);
  const latest = useRef({ sites, onBounds, onSelect, destination });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    latest.current = { sites, onBounds, onSelect, destination };
  });
  useEffect(() => {
    if (!token || !container.current) return;
    let cancelled = false;
    let instance: MapboxMap | null = null;
    let observer: ResizeObserver | null = null;
    const fail = () =>
      setError(
        "The street map is unavailable. Search and the complete results list still work.",
      );
    import("mapbox-gl")
      .then(({ default: mapboxgl }) => {
        if (cancelled || !container.current) return;
        try {
          instance = new mapboxgl.Map({
            container: container.current,
            accessToken: token,
            style: "mapbox://styles/mapbox/streets-v12",
            center: [
              latest.current.destination.longitude,
              latest.current.destination.latitude,
            ],
            zoom: 11.5,
            minZoom: 3,
            maxZoom: 18,
          });
          map.current = instance;
          instance
            .getCanvas()
            .setAttribute(
              "aria-label",
              "Charger map. The same locations are available in the results list.",
            );
          instance.addControl(
            new mapboxgl.NavigationControl({ showCompass: false }),
            "top-right",
          );
          instance.on("error", fail);
          observer = new ResizeObserver(() => instance?.resize());
          observer.observe(container.current);
          const currentMap = instance;
          currentMap.on("load", () => {
            if (cancelled) return;
            setError(null);
            currentMap.jumpTo({
              center: [
                latest.current.destination.longitude,
                latest.current.destination.latitude,
              ],
            });
            currentMap.addSource("chargers", {
              type: "geojson",
              data: points(latest.current.sites),
              cluster: true,
              clusterMaxZoom: 13,
              clusterRadius: 48,
            });
            currentMap.addLayer({
              id: "clusters",
              type: "circle",
              source: "chargers",
              filter: ["has", "point_count"],
              paint: {
                "circle-color": "#1568e8",
                "circle-radius": 23,
                "circle-stroke-width": 3,
                "circle-stroke-color": "white",
              },
            });
            currentMap.addLayer({
              id: "cluster-count",
              type: "symbol",
              source: "chargers",
              filter: ["has", "point_count"],
              layout: {
                "text-field": ["get", "point_count_abbreviated"],
                "text-size": 14,
              },
              paint: { "text-color": "white" },
            });
            currentMap.addLayer({
              id: "locations",
              type: "circle",
              source: "chargers",
              filter: ["!", ["has", "point_count"]],
              paint: {
                "circle-color": [
                  "match",
                  ["get", "status"],
                  "available",
                  "#087b53",
                  "partial",
                  "#1568e8",
                  "busy",
                  "#945500",
                  "offline",
                  "#aa233e",
                  "#57657b",
                ],
                "circle-radius": 17,
                "circle-stroke-width": 3,
                "circle-stroke-color": "white",
              },
            });
            currentMap.addLayer({
              id: "location-symbol",
              type: "symbol",
              source: "chargers",
              filter: ["!", ["has", "point_count"]],
              layout: {
                "text-field": ["get", "symbol"],
                "text-size": 14,
                "text-allow-overlap": true,
              },
              paint: { "text-color": "white" },
            });
            currentMap.on("click", "clusters", (event) => {
              const feature = event.features?.[0];
              if (!feature || feature.geometry.type !== "Point") return;
              const coordinates = feature.geometry.coordinates as [
                number,
                number,
              ];
              (
                currentMap.getSource("chargers") as GeoJSONSource
              ).getClusterExpansionZoom(
                Number(feature.properties?.cluster_id),
                (err, zoom) => {
                  if (!err && zoom != null && !cancelled)
                    currentMap.easeTo({ center: coordinates, zoom });
                },
              );
            });
            currentMap.on("click", "locations", (event) => {
              const id = event.features?.[0]?.properties?.id;
              if (typeof id === "string") latest.current.onSelect(id);
            });
            for (const layer of ["clusters", "locations"]) {
              currentMap.on("mouseenter", layer, () => {
                currentMap.getCanvas().style.cursor = "pointer";
              });
              currentMap.on("mouseleave", layer, () => {
                currentMap.getCanvas().style.cursor = "";
              });
            }
            const report = () => {
              // Hidden mobile maps have no meaningful viewport; do not erase the list.
              if (
                !container.current?.clientWidth ||
                !container.current.clientHeight
              )
                return;
              const b = currentMap.getBounds();
              if (b)
                latest.current.onBounds({
                  north: b.getNorth(),
                  south: b.getSouth(),
                  east: b.getEast(),
                  west: b.getWest(),
                });
            };
            currentMap.on("moveend", report);
            report();
          });
        } catch {
          fail();
        }
      })
      .catch(fail);
    return () => {
      cancelled = true;
      observer?.disconnect();
      instance?.remove();
      map.current = null;
    };
  }, [token]);
  useEffect(() => {
    const source = map.current?.getSource("chargers") as
      GeoJSONSource | undefined;
    source?.setData(points(sites));
  }, [sites]);
  useEffect(() => {
    map.current?.flyTo({
      center: [destination.longitude, destination.latitude],
      zoom: 12,
      essential: false,
    });
  }, [destination]);
  return (
    <div className="discovery-map-wrap">
      <div ref={container} className="discovery-map" aria-label="Street map" />
      {(!token || error) && (
        <div className="discovery-map-fallback">
          <strong>
            {token ? "Map unavailable" : "Street map not configured"}
          </strong>
          <p>
            {error ??
              "Add a public Mapbox token to enable the map and UK location search. The demo results list and filters work now."}
          </p>
        </div>
      )}
    </div>
  );
}
