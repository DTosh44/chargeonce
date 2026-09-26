// POST to the protected server endpoint. No direct database or provider credentials are transmitted.
const [south, north, west, east] = process.argv.slice(2).map(Number);
const origin = process.env.CHARGEONCE_SITE_URL || "http://localhost:3000";
const secret = process.env.CHARGING_INGESTION_SECRET;
try {
  const url = new URL("/api/internal/charging/import", origin);
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    )
  )
    throw new Error("Use HTTPS or a local development server.");
  if (
    process.argv.length !== 6 ||
    [south, north, west, east].some((n) => !Number.isFinite(n))
  )
    throw new Error(
      "Usage: pnpm charging:import <south> <north> <west> <east>",
    );
  if (!secret || secret.length < 32)
    throw new Error(
      "Set a server-side CHARGING_INGESTION_SECRET of at least 32 characters.",
    );
  const response = await fetch(url, {
    method: "POST",
    redirect: "error",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ bounds: { south, north, west, east } }),
    signal: AbortSignal.timeout(30000),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      typeof result.error === "string" ? result.error : "Import failed.",
    );
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : "Import failed.");
  process.exitCode = 1;
}
