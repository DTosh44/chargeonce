import type { Row } from "../../lib/supabase/database.types";
import type { Charger, Vehicle } from "../../domain/types";
import {
  mapConnector,
  mapEvse,
  mapLocation,
  mapOperator,
  mapTariff,
  mapVehicle,
} from "./mappers";

export interface CatalogueRows {
  vehicles: Row<"vehicles">[];
  locations: Row<"charging_locations">[];
  evses: Row<"evses">[];
  connectors: Row<"connectors">[];
  operators: Row<"operators">[];
  tariffs: Row<"tariffs">[];
}
const metadataNumber = (
  metadata: Record<string, unknown>,
  key: string,
  fallback: number,
) =>
  typeof metadata[key] === "number" && Number.isFinite(metadata[key])
    ? metadata[key]
    : fallback;

/** Adapt persistent records to the existing presentation models. This UI is demo-only. */
export function projectDemoCatalogue(
  rows: CatalogueRows,
  now = Date.now(),
): { vehicles: Vehicle[]; chargers: Charger[] } {
  const vehicles = rows.vehicles
    .map(mapVehicle)
    .filter((vehicle) => vehicle.isDemo)
    .map((vehicle, index): Vehicle => ({
      id: vehicle.id,
      make: vehicle.manufacturer,
      model: vehicle.model,
      trim: [vehicle.variant, vehicle.modelYear].filter(Boolean).join(" · "),
      batteryKwh: vehicle.usableBatteryKwh,
      estimatedRangeMiles: vehicle.estimatedRangeMiles,
      efficiencyMilesPerKwh: vehicle.efficiencyMilesPerKwh,
      maxDcKw: vehicle.maxDcKw,
      maxAcKw: vehicle.maxAcKw,
      connectors: vehicle.connectorTypes,
      imageTone: (["blue", "mint", "violet"] as const)[index % 3],
      isDemo: true,
    }));
  const locations = rows.locations
    .map(mapLocation)
    .filter(
      (location) =>
        location.isDemo && location.isPublic && !location.isCommunity,
    );
  const operators = new Map(
    rows.operators.map(mapOperator).map((operator) => [operator.id, operator]),
  );
  const evses = rows.evses.map(mapEvse);
  const connectors = rows.connectors.map(mapConnector);
  const tariffs = rows.tariffs
    .map(mapTariff)
    .filter(
      (tariff) =>
        tariff.isDemo &&
        tariff.currency === "GBP" &&
        (!tariff.validFrom || Date.parse(tariff.validFrom) <= now) &&
        (!tariff.validTo || Date.parse(tariff.validTo) > now) &&
        !tariff.parkingFee,
    )
    .sort(
      (a, b) =>
        (b.validFrom ?? "").localeCompare(a.validFrom ?? "") ||
        a.id.localeCompare(b.id),
    );
  const chargers: Charger[] = locations.flatMap((location) => {
    const demoNumbers = ["distanceMiles", "reliabilityPercent", "x", "y"].map(
      (key) => location.demoMetadata[key],
    );
    if (
      demoNumbers.some(
        (value) =>
          typeof value !== "number" || !Number.isFinite(value) || value < 0,
      )
    )
      return [];
    if (
      demoNumbers
        .slice(1)
        .some((value) => typeof value === "number" && value > 100)
    )
      return [];
    const tariff = tariffs.find(
      (item) =>
        item.locationId === location.id &&
        item.operatorId === location.operatorId,
    );
    const operator = operators.get(location.operatorId);
    if (!tariff || !operator) return []; // Never invent a zero-price quote for missing tariffs.
    const locationEvses = evses.filter(
      (evse) => evse.locationId === location.id,
    );
    const locationEvseIds = new Set(locationEvses.map((evse) => evse.id));
    const locationConnectors = connectors.filter((connector) =>
      locationEvseIds.has(connector.evseId),
    );
    const types = [
      ...new Set(
        locationConnectors.map((connector) => connector.connectorType),
      ),
    ];
    return types.map((connectorType): Charger => {
      const group = locationConnectors.filter(
        (connector) => connector.connectorType === connectorType,
      );
      const groupIds = new Set(group.map((connector) => connector.evseId));
      const groupEvses = locationEvses.filter((evse) => groupIds.has(evse.id));
      const available = groupEvses.filter(
        (evse) => evse.status === "available",
      ).length;
      const fullyKnown = groupEvses.every((evse) =>
        ["available", "charging", "occupied"].includes(evse.status),
      );
      return {
        id:
          types.length === 1
            ? location.externalId
            : `${location.externalId}-${connectorType}`,
        locationId: location.id,
        name: location.name.startsWith("DEMO")
          ? location.name
          : `DEMO — ${location.name}`,
        network: operator.name,
        location: location.address,
        postcode: location.postcode,
        distanceMiles: metadataNumber(
          location.demoMetadata,
          "distanceMiles",
          0,
        ),
        maxKw: Math.max(...group.map((connector) => connector.maxPowerKw)),
        connector: connectorType,
        pricePencePerKwh: tariff.pricePerKwh * 100,
        connectionFeePence: (tariff.connectionFee ?? 0) * 100,
        status: available ? "Available" : fullyKnown ? "Busy" : "Unknown",
        reliabilityPercent: metadataNumber(
          location.demoMetadata,
          "reliabilityPercent",
          0,
        ),
        stalls: groupEvses.length,
        availableStalls: fullyKnown ? available : null,
        x: metadataNumber(location.demoMetadata, "x", 50),
        y: metadataNumber(location.demoMetadata, "y", 50),
        isDemo: true,
      };
    });
  });
  return { vehicles, chargers };
}
