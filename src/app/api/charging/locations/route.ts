import { configuredChargingProvider } from "@/providers/charging/factory.server";
import { locationsWithFallback } from "@/providers/charging/service";
import { validateBounds } from "@/providers/charging/provider";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const headers = { "Cache-Control": "no-store" };
  try {
    const fields = ["north", "south", "east", "west"] as const;
    if (fields.some((f) => !p.get(f)?.trim())) throw new Error();
    const bounds = {
      north: Number(p.get("north")),
      south: Number(p.get("south")),
      east: Number(p.get("east")),
      west: Number(p.get("west")),
    };
    validateBounds(bounds);
    try {
      return Response.json(
        await locationsWithFallback(configuredChargingProvider(), bounds),
        { headers },
      );
    } catch {
      return Response.json(
        { error: "Charging discovery is temporarily unavailable. Try again." },
        { status: 503, headers },
      );
    }
  } catch {
    return Response.json(
      { error: "Search a smaller valid map area. Zoom in and try again." },
      { status: 400, headers },
    );
  }
}
