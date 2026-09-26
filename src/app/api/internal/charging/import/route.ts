import { timingSafeEqual } from "node:crypto";
import { externalChargingProvider } from "@/providers/charging/factory.server";
import { importChargingRegion } from "@/providers/charging/ingestion";
import { chargingImportRepository } from "@/providers/charging/ingestion.server";
import {
  ChargingProviderError,
  validateBounds,
} from "@/providers/charging/provider";
import type { GeoBounds } from "@/domain/charging-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Intended for a trusted scheduler/admin script, never a browser or page-load side effect. */
export async function POST(request: Request) {
  const secret = process.env.CHARGING_INGESTION_SECRET;
  if (!secret || secret.length < 32)
    return json({ error: "Charging ingestion is not configured." }, 503);
  const supplied = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const providedBytes = Buffer.from(supplied),
    expectedBytes = Buffer.from(expected);
  if (
    providedBytes.length !== expectedBytes.length ||
    !timingSafeEqual(providedBytes, expectedBytes)
  )
    return json({ error: "Unauthorised." }, 401);
  try {
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      return json({ error: "Send JSON bounds." }, 415);
    const reader = request.body?.getReader();
    if (!reader) return json({ error: "Bounds are required." }, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2048) {
        await reader.cancel();
        return json({ error: "Import request is too large." }, 413);
      }
      chunks.push(value);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
      bounds?: GeoBounds;
    };
    const bounds = body?.bounds;
    if (!bounds || typeof bounds !== "object")
      return json({ error: "Explicit regional bounds are required." }, 400);
    validateBounds(bounds);
    const provider = externalChargingProvider();
    if (!provider)
      return json(
        { error: "External charging provider is not configured." },
        503,
      );
    return json(
      await importChargingRegion(provider, chargingImportRepository(), bounds),
    );
  } catch (error) {
    if (
      error instanceof SyntaxError ||
      (error instanceof ChargingProviderError && error.code === "invalid_query")
    )
      return json({ error: "Invalid regional bounds." }, 400);
    if (
      error instanceof ChargingProviderError &&
      error.code === "not_configured"
    )
      return json({ error: "Ingestion persistence is not configured." }, 503);
    return json(
      { error: "Charging import failed. No partial batch was saved." },
      502,
    );
  }
}
