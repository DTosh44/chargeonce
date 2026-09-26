"use client";

import {
  createContext,
  useContext,
  useSyncExternalStore,
  useOptimistic,
  useState,
  useTransition,
} from "react";
import type { AuthState } from "@/domain/auth";
import { toCalculationVehicle, type GarageState } from "@/domain/vehicles";
import { setCurrentCar } from "@/app/cars/actions";
import Link from "next/link";
import type { ChargingCatalogue } from "@/domain/catalogue";
import type { Vehicle } from "@/domain/types";
import { Select } from "@/components/ui";

const STORAGE_KEY = "chargeonce-demo-vehicle";
const VehicleContext = createContext<
  | ({
      vehicle: Vehicle;
      setVehicleId: (id: string) => void;
      auth: AuthState;
      garage: GarageState;
      selectionId: string;
      selectionPending: boolean;
      selectionError: string | null;
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
  auth,
  garage,
}: {
  children: React.ReactNode;
  catalogue: ChargingCatalogue;
  auth: AuthState;
  garage: GarageState;
}) {
  const { vehicles } = catalogue;
  const vehicleId = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const currentId =
    garage.cars.find((car) => car.saved.isDefault)?.saved.id ??
    garage.cars[0]?.saved.id ??
    "";
  const [optimisticId, setOptimisticId] = useOptimistic(currentId);
  const [selectionPending, startTransition] = useTransition();
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const usesGarage = auth.status === "authenticated" && garage.cars.length > 0;
  const currentCar =
    garage.cars.find((car) => car.saved.id === optimisticId) ?? garage.cars[0];
  const selectVehicle = (id: string) => {
    if (usesGarage) {
      if (!garage.cars.some((car) => car.saved.id === id) || selectionPending)
        return;
      setSelectionError(null);
      startTransition(async () => {
        setOptimisticId(id);
        try {
          const result = await setCurrentCar(id);
          if (result.status === "error") setSelectionError(result.message);
        } catch {
          setSelectionError(
            "Your current car couldn’t be saved. Please try again.",
          );
        }
      });
      return;
    }
    if (!vehicles.some((car) => car.id === id)) return;
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
        auth,
        garage,
        selectionPending,
        selectionError,
        selectionId: usesGarage
          ? (currentCar?.saved.id ?? "")
          : (vehicles.find((car) => car.id === vehicleId)?.id ??
            vehicles[0].id),
        vehicle:
          usesGarage && currentCar
            ? toCalculationVehicle(
                currentCar.specification,
                currentCar.saved.efficiencyOverride,
              )
            : (vehicles.find((vehicle) => vehicle.id === vehicleId) ??
              vehicles[0]),
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
  label = "Which car are you driving?",
  id = "vehicle-select",
}: {
  label?: string;
  id?: string;
}) {
  const {
    vehicles,
    setVehicleId,
    auth,
    garage,
    selectionId,
    selectionPending,
    selectionError,
  } = useVehicle();
  const usesGarage = auth.status === "authenticated" && garage.cars.length > 0;
  return (
    <div>
      <label className="field-label" htmlFor={id}>
        {label}
        <Select
          id={id}
          value={selectionId}
          disabled={
            selectionPending || !!garage.error || auth.status === "unavailable"
          }
          onChange={(event) => setVehicleId(event.target.value)}
        >
          {usesGarage
            ? garage.cars.map(({ saved, specification }) => (
                <option key={saved.id} value={saved.id}>
                  {saved.nickname ? `${saved.nickname} · ` : ""}
                  {specification.manufacturer} {specification.model} ·{" "}
                  {specification.variant}
                  {saved.isDefault ? " (current)" : ""}
                </option>
              ))
            : vehicles.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.make} {option.model} · {option.trim}
                </option>
              ))}
        </Select>
      </label>
      {selectionPending && <small role="status">Saving current car…</small>}
      {selectionError && (
        <p className="form-feedback error" role="alert">
          {selectionError} Your previous current car is still selected.
        </p>
      )}
      {garage.error && (
        <p className="form-feedback error" role="alert">
          {garage.error} Demo estimates are shown until your saved car can be
          loaded.
        </p>
      )}
      {auth.status === "unavailable" && (
        <p className="form-feedback error" role="alert">
          Account connection unavailable. Demo estimates are shown; refresh to
          load your saved car.
        </p>
      )}
      {auth.status === "authenticated" &&
        !garage.cars.length &&
        !garage.error && (
          <small>
            Demo selection for now.{" "}
            <Link href="/cars">Add your first saved car</Link>.
          </small>
        )}
    </div>
  );
}
