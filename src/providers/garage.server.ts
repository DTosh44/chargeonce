import "server-only";
import { cache } from "react";
import { getAuthState } from "@/lib/auth.server";
import {
  createCatalogueClient,
  createSessionClient,
} from "@/lib/supabase/server";
import { createVehicleService } from "./vehicle-service";
import type { GarageState } from "@/domain/vehicles";

export const getVehicleCatalogue = cache(async () =>
  createVehicleService(createCatalogueClient()).listCatalogue(),
);
export const getGarage = cache(async (): Promise<GarageState> => {
  const auth = await getAuthState();
  if (auth.status !== "authenticated") return { cars: [], error: null };
  try {
    return {
      cars: await createVehicleService(
        await createSessionClient(),
      ).listGarage(),
      error: null,
    };
  } catch {
    return {
      cars: [],
      error:
        "Your saved cars couldn’t be loaded. Please refresh to try again. No saved data has been changed.",
    };
  }
});
