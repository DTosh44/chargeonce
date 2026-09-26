import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Intentionally refuses remote hosts; this script can only seed a local dev DB.
const connection =
  process.env.CHARGEONCE_DATABASE_URL ||
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
let parsed;
try {
  parsed = new URL(connection);
} catch {
  console.error("CHARGEONCE_DATABASE_URL must be a PostgreSQL URL.");
  process.exit(1);
}
if (
  !["postgres:", "postgresql:"].includes(parsed.protocol) ||
  !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)
) {
  console.error(
    "Refusing to seed a remote database. Use a local, dedicated ChargeOnce development DB.",
  );
  process.exit(1);
}
try {
  // Put credentials in the child environment, not command arguments or logs.
  execFileSync(
    "psql",
    [
      "--no-psqlrc",
      "--set",
      "ON_ERROR_STOP=1",
      "--file",
      fileURLToPath(new URL("../supabase/seed.sql", import.meta.url)),
    ],
    {
      env: {
        ...process.env,
        PGHOST: parsed.hostname.replace(/^\[|\]$/g, ""),
        PGPORT: parsed.port || "5432",
        PGDATABASE: decodeURIComponent(parsed.pathname.slice(1)),
        PGUSER: decodeURIComponent(parsed.username),
        PGPASSWORD: decodeURIComponent(parsed.password),
        PGSSLMODE: "disable",
      },
      stdio: "inherit",
    },
  );
  console.log("Local ChargeOnce DEMO DATA seeded. No auth users were created.");
} catch {
  console.error(
    "Seed failed. Install psql, start local Supabase and apply the migrations first.",
  );
  process.exit(1);
}
