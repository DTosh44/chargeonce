"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import { vehicles } from "@/data/demo";
import type { Vehicle } from "@/domain/types";
import { Select } from "@/components/ui";

const STORAGE_KEY = "chargeonce-demo-vehicle";
const VehicleContext = createContext<{
  vehicle: Vehicle;
  setVehicleId: (id: string) => void;
} | null>(null);
const CHANGE_EVENT = "chargeonce-vehicle-change";
const subscribe = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
};
const getSnapshot = () =>
  window.localStorage.getItem(STORAGE_KEY) ?? vehicles[0].id;
const getServerSnapshot = () => vehicles[0].id;

export function VehicleProvider({ children }: { children: React.ReactNode }) {
  const vehicleId = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const selectVehicle = (id: string) => {
    window.localStorage.setItem(STORAGE_KEY, id);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };
  return (
    <VehicleContext.Provider
      value={{
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
  const { vehicle, setVehicleId } = useVehicle();
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
