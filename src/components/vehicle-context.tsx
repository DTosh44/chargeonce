"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import type { ChargingCatalogue } from "@/domain/catalogue";
import type { Vehicle } from "@/domain/types";
import { Select } from "@/components/ui";

const STORAGE_KEY = "chargeonce-demo-vehicle";
const VehicleContext = createContext<
  | ({
      vehicle: Vehicle;
      setVehicleId: (id: string) => void;
    } & ChargingCatalogue)
  | null
>(null);
const CHANGE_EVENT = "chargeonce-vehicle-change";
const subscribe = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
};
let memoryVehicleId: string | null = null;
const legacyVehicleIds: Record<string, string> = {
  "model-3": "10000000-0000-4000-8000-000000000001",
  "id-3": "10000000-0000-4000-8000-000000000002",
  kona: "10000000-0000-4000-8000-000000000003",
};
const getSnapshot = () => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY) ?? memoryVehicleId;
    return stored ? (legacyVehicleIds[stored] ?? stored) : null;
  } catch {
    return memoryVehicleId;
  }
};
const getServerSnapshot = () => null;

export function VehicleProvider({
  children,
  catalogue,
}: {
  children: React.ReactNode;
  catalogue: ChargingCatalogue;
}) {
  const { vehicles } = catalogue;
  const vehicleId = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const selectVehicle = (id: string) => {
    memoryVehicleId = id;
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* Private browsing may disable storage. */
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };
  return (
    <VehicleContext.Provider
      value={{
        ...catalogue,
        vehicle:
          vehicles.find((vehicle) => vehicle.id === vehicleId) ?? vehicles[0],
        setVehicleId: selectVehicle,
      }}
    >
      {children}
    </VehicleContext.Provider>
  );
}

export function useVehicle() {
  const context = useContext(VehicleContext);
  if (!context)
    throw new Error("useVehicle must be used within VehicleProvider");
  return context;
}

export function VehicleSelector({
  label = "Your car",
  id = "vehicle-select",
}: {
  label?: string;
  id?: string;
}) {
  const { vehicle, vehicles, setVehicleId } = useVehicle();
  return (
    <label className="field-label" htmlFor={id}>
      {label}
      <Select
        id={id}
        value={vehicle.id}
        onChange={(event) => setVehicleId(event.target.value)}
      >
        {vehicles.map((option) => (
          <option key={option.id} value={option.id}>
            {option.make} {option.model} · {option.trim}
          </option>
        ))}
      </Select>
    </label>
  );
}
