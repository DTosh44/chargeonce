"use server";
import { revalidatePath } from "next/cache";
import { createSessionClient } from "@/lib/supabase/server";
import { createUserDataRepository } from "@/providers/supabase/user-data";
import { isUUID, parseCarDetails } from "@/domain/vehicles";
import type { FormResult } from "@/domain/auth";

export async function manageCar(
  _previous: FormResult,
  form: FormData,
): Promise<FormResult> {
  const id = String(form.get("id") ?? "");
  const operation = String(form.get("operation") ?? "");
  if (operation === "remove" && form.get("confirm") !== "on")
    return {
      status: "error",
      message: "Confirm that you want to remove this car first.",
    };
  if (!isUUID(id) || !["add", "edit", "remove", "current"].includes(operation))
    return { status: "error", message: "Choose a valid car and try again." };
  let details: ReturnType<typeof parseCarDetails> | undefined;
  try {
    if (operation === "add" || operation === "edit")
      details = parseCarDetails(form);
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Check your car details.",
    };
  }
  try {
    const repository = createUserDataRepository(await createSessionClient());
    if (operation === "add")
      await repository.addVehicle({
        vehicleId: id,
        nickname: details?.nickname ?? undefined,
        efficiencyOverride: details?.efficiencyOverride ?? undefined,
      });
    else if (operation === "edit" && details)
      await repository.updateVehicle(id, details);
    else if (operation === "remove") await repository.removeVehicle(id);
    else if (operation === "current") await repository.setDefaultVehicle(id);
  } catch {
    return {
      status: "error",
      message:
        "We couldn’t save that change. Check that you’re signed in, then try again. No success has been reported.",
    };
  }
  revalidatePath("/", "layout");
  return {
    status: "success",
    message:
      operation === "remove"
        ? "Car removed. Your next saved car becomes current if needed."
        : operation === "add"
          ? "Car added to your garage."
          : operation === "current"
            ? "Current car updated for all your charging calculations."
            : "Car details saved.",
  };
}

export async function setCurrentCar(id: string): Promise<FormResult> {
  const form = new FormData();
  form.set("id", id);
  form.set("operation", "current");
  return manageCar({ status: "idle", message: "" }, form);
}
