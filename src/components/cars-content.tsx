"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { CarFront, CheckCircle2 } from "lucide-react";
import { useVehicle, VehicleSelector } from "@/components/vehicle-context";
import {
  Button,
  Card,
  Input,
  Select,
  PageHeader,
  Badge,
  buttonStyles,
} from "@/components/ui";
import { FormFeedback } from "@/components/auth-forms";
import { initialFormResult } from "@/domain/auth";
import type { GarageCar, VehicleCatalogue } from "@/domain/vehicles";
import type { VehicleModel } from "@/domain/models";
import { manageCar } from "@/app/cars/actions";

function Specifications({ specification }: { specification: VehicleModel }) {
  return (
    <div className="spec-list">
      <div>
        <small>Usable battery</small>
        <strong>{specification.usableBatteryKwh} kWh</strong>
      </div>
      <div>
        <small>Maximum DC charging</small>
        <strong>{specification.maxDcKw} kW</strong>
      </div>
      <div>
        <small>Maximum AC charging</small>
        <strong>{specification.maxAcKw} kW</strong>
      </div>
      <div>
        <small>Connectors</small>
        <strong>{specification.connectorTypes.join(" + ")}</strong>
      </div>
      <div>
        <small>Estimated efficiency</small>
        <strong>
          {specification.efficiencyMilesPerKwh.toFixed(2)} miles/kWh
        </strong>
      </div>
      <div>
        <small>Estimated range</small>
        <strong>{Math.round(specification.estimatedRangeMiles)} miles</strong>
      </div>
    </div>
  );
}
function CarDetailsFields({
  car,
  prefix,
}: {
  car?: GarageCar;
  prefix: string;
}) {
  return (
    <>
      <label className="field-label" htmlFor={`${prefix}-nickname`}>
        Nickname (optional)
        <Input
          id={`${prefix}-nickname`}
          name="nickname"
          maxLength={100}
          defaultValue={car?.saved.nickname ?? ""}
          placeholder="e.g. Family car"
        />
      </label>
      <details className="advanced-options">
        <summary>Advanced: real-world efficiency</summary>
        <label className="field-label" htmlFor={`${prefix}-efficiency`}>
          Typical efficiency (miles/kWh)
          <Input
            id={`${prefix}-efficiency`}
            name="efficiency"
            type="number"
            min="0.5"
            max="10"
            step="0.01"
            defaultValue={car?.saved.efficiencyOverride ?? ""}
            placeholder="Use catalogue estimate"
          />
        </label>
        <small>
          Use your usual driving efficiency for range, cost and journey
          calculations. Leave blank to use the vehicle estimate. Charging speed
          and battery capacity stay unchanged.
        </small>
      </details>
    </>
  );
}
function AddCarForm({
  catalogue,
  enabled,
}: {
  catalogue: VehicleCatalogue;
  enabled: boolean;
}) {
  const [selectedId, setSelectedId] = useState(catalogue.vehicles[0].id);
  const specification =
    catalogue.vehicles.find((car) => car.id === selectedId) ??
    catalogue.vehicles[0];
  const manufacturers = [
    ...new Set(catalogue.vehicles.map((car) => car.manufacturer)),
  ].sort();
  const models = [
    ...new Set(
      catalogue.vehicles
        .filter((car) => car.manufacturer === specification.manufacturer)
        .map((car) => car.model),
    ),
  ].sort();
  const variants = catalogue.vehicles.filter(
    (car) =>
      car.manufacturer === specification.manufacturer &&
      car.model === specification.model,
  );
  const [result, action, pending] = useActionState(
    manageCar,
    initialFormResult,
  );
  return (
    <Card className="garage-panel">
      <h2>Add a vehicle</h2>
      <p>
        Choose the exact variant, then check its specification before adding it.
      </p>
      <form action={action} className="stack-form">
        <input type="hidden" name="operation" value="add" />
        <input type="hidden" name="id" value={specification.id} />
        <fieldset disabled={pending} className="form-fields">
          <label className="field-label" htmlFor="manufacturer">
            Manufacturer
            <Select
              id="manufacturer"
              value={specification.manufacturer}
              onChange={(event) =>
                setSelectedId(
                  catalogue.vehicles.find(
                    (car) => car.manufacturer === event.target.value,
                  )!.id,
                )
              }
            >
              {manufacturers.map((manufacturer) => (
                <option key={manufacturer}>{manufacturer}</option>
              ))}
            </Select>
          </label>
          <label className="field-label" htmlFor="model">
            Model
            <Select
              id="model"
              value={specification.model}
              onChange={(event) =>
                setSelectedId(
                  catalogue.vehicles.find(
                    (car) =>
                      car.manufacturer === specification.manufacturer &&
                      car.model === event.target.value,
                  )!.id,
                )
              }
            >
              {models.map((model) => (
                <option key={model}>{model}</option>
              ))}
            </Select>
          </label>
          <label className="field-label" htmlFor="variant">
            Variant
            <Select
              id="variant"
              value={specification.id}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              {variants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.variant}
                  {variant.modelYear ? ` · ${variant.modelYear}` : ""}
                </option>
              ))}
            </Select>
          </label>
          {specification.isDemo && (
            <Badge tone="amber">Illustrative demo specification</Badge>
          )}
          <Specifications specification={specification} />
          {enabled && <CarDetailsFields prefix="new-car" />}
          <Button type="submit" disabled={!enabled}>
            {pending
              ? "Adding car…"
              : enabled
                ? "Add to My Cars"
                : "Saving requires a configured account"}
          </Button>
        </fieldset>
        <FormFeedback result={result} />
      </form>
    </Card>
  );
}
function SavedCar({ car }: { car: GarageCar }) {
  const { selectionId, setVehicleId, selectionPending } = useVehicle();
  const [editResult, editAction, editing] = useActionState(
    manageCar,
    initialFormResult,
  );
  const [removeResult, removeAction, removing] = useActionState(
    manageCar,
    initialFormResult,
  );
  const current = selectionId === car.saved.id;
  const title =
    car.saved.nickname ??
    `${car.specification.manufacturer} ${car.specification.model}`;
  return (
    <Card className={`garage-panel saved-car ${current ? "selected" : ""}`}>
      <div className="garage-car-heading">
        <span className="vehicle-art blue">
          <CarFront size={30} aria-hidden="true" />
        </span>
        <div>
          <h3>{title}</h3>
          <p>
            {car.specification.manufacturer} {car.specification.model} ·{" "}
            {car.specification.variant}
            {car.specification.modelYear
              ? ` · ${car.specification.modelYear}`
              : ""}
          </p>
        </div>
      </div>
      {current ? (
        <Badge tone="green">
          <CheckCircle2 size={14} aria-hidden="true" /> Current / default car
        </Badge>
      ) : (
        <Button
          type="button"
          variant="secondary"
          disabled={selectionPending || editing || removing}
          onClick={() => setVehicleId(car.saved.id)}
        >
          Drive this car / make default
        </Button>
      )}
      {car.saved.efficiencyOverride !== null && (
        <p>
          Personal efficiency: {car.saved.efficiencyOverride} miles/kWh ·
          estimated range{" "}
          {Math.round(
            car.specification.usableBatteryKwh * car.saved.efficiencyOverride,
          )}{" "}
          miles
        </p>
      )}
      <details className="advanced-options">
        <summary>Specification and car settings</summary>
        <Specifications specification={car.specification} />
        <form action={editAction} className="stack-form">
          <input type="hidden" name="operation" value="edit" />
          <input type="hidden" name="id" value={car.saved.id} />
          <fieldset disabled={editing || removing} className="form-fields">
            <CarDetailsFields
              key={car.saved.updatedAt}
              car={car}
              prefix={car.saved.id}
            />
            <Button type="submit" variant="secondary">
              {editing ? "Saving…" : "Save car settings"}
            </Button>
          </fieldset>
          <FormFeedback result={editResult} />
        </form>
      </details>
      <details className="advanced-options">
        <summary>Remove this car</summary>
        <form action={removeAction} className="stack-form">
          <input type="hidden" name="operation" value="remove" />
          <input type="hidden" name="id" value={car.saved.id} />
          <label>
            <input
              name="confirm"
              type="checkbox"
              required
              disabled={removing}
            />{" "}
            Remove {title} from my garage. If current, another saved car will
            become current.
          </label>
          <Button
            type="submit"
            variant="quiet"
            disabled={removing || editing || selectionPending}
          >
            {removing ? "Removing…" : "Confirm removal"}
          </Button>
          <FormFeedback result={removeResult} />
        </form>
      </details>
    </Card>
  );
}
export function CarsContent({ catalogue }: { catalogue: VehicleCatalogue }) {
  const { auth, garage } = useVehicle();
  const enabled =
    auth.status === "authenticated" &&
    !garage.error &&
    catalogue.source === "database";
  return (
    <div className="shell page-section">
      <PageHeader
        eyebrow="My cars"
        title="Every EV. One garage."
        description="Save your cars, give them a nickname and switch your current car wherever your journey takes you."
      />
      <p className="notice">
        This is a starter catalogue, not a complete UK vehicle database. Seeded
        vehicle specifications are illustrative estimates, not certified
        manufacturer data. Charger prices and availability remain DEMO DATA.
      </p>
      {auth.status !== "authenticated" && (
        <p className="notice">
          <span>
            Accounts aren’t configured here yet. Preview the vehicle catalogue
            below; demo car selection stays in this browser. No personal garage
            records are saved. <Link href="/sign-in">Sign in</Link>
          </span>
        </p>
      )}
      {garage.error && (
        <p className="form-feedback error" role="alert">
          {garage.error}
        </p>
      )}
      {catalogue.source === "seeded" && auth.status === "authenticated" && (
        <p className="form-feedback error" role="alert">
          The database vehicle catalogue is unavailable or empty. You can
          inspect the starter catalogue, but adding cars is disabled until the
          catalogue is restored and seeded.
        </p>
      )}
      <div className="cars-layout garage-layout">
        <div className="garage-list">
          <Card className="garage-panel">
            <VehicleSelector id="garage-current-car" />
          </Card>
          {garage.cars.map((car) => (
            <SavedCar key={car.saved.id} car={car} />
          ))}
          {auth.status === "authenticated" &&
            !garage.cars.length &&
            !garage.error && (
              <Card className="garage-panel">
                <h2>Your garage is ready.</h2>
                <p>
                  Add your first EV to make it your current car. You can save
                  more than one car, including multiple cars of the same model.
                </p>
              </Card>
            )}
          <Link href="/map" className={buttonStyles("secondary")}>
            Find chargers for your current car
          </Link>
        </div>
        <AddCarForm catalogue={catalogue} enabled={enabled} />
      </div>
    </div>
  );
}
