# ChargeOnce

A mobile-first UK EV charging decision helper. Development works with explicitly labelled **demo** data; optional providers supply external location records. External records are not automatically live occupancy or verified prices. There is no charging, payment, wallet, roaming or RFID functionality.

## Run locally

Requires Node.js 20.9+ and pnpm.

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000. No API keys or database are needed: Supabase credentials are optional and the public catalogue gracefully falls back to seeded demo data.

## Supabase data architecture

All 17 core tables plus an external-source snapshot table, RLS policies, constraints and development seeds are defined under `supabase/`. When configured, the screens read the persisted catalogue through typed adapters. Thirteen illustrative EV variants across eleven UK-market brands and five explicitly marked demo charging locations are included. This is not a complete vehicle database. Demo prices/availability are not live.

See [database setup and security documentation](docs/database.md) for migrations, seeding, type generation, units, ownership rules, fallback behaviour and integration boundaries. No hosted database is modified automatically.

See [authentication and My Cars setup](docs/authentication.md) for email/password, magic links, cookie sessions, email templates and the hosted smoke-test checklist.

## Charging-data providers

`ChargingDataProvider` exposes bounded/nearby locations, individual locations, operators, statuses and tariffs. `MockChargingProvider`, server-only `OpenChargeMapProvider` and RLS-scoped `StoredChargingProvider` return ChargeOnce domain objects; raw OCM fields never reach React. An `OCPIProvider` contract prepares future direct feeds. Vehicles use a separate `VehicleService`.

Set server-only `OPEN_CHARGE_MAP_API_KEY` to enable OCM in default `CHARGING_DATA_PROVIDER=auto` mode. No key means Supabase/local demo fallback. `mock` forces seeds; `database` reads imported snapshots without upstream page-load requests. Errors fall back to an explicitly demo batch, never invented live prices or availability. OCM operational status and free-text prices are not treated as real-time occupancy or structured tariffs. Cards distinguish demo, external/live, unknown and stale data.

Optional ingestion uses server-only `SUPABASE_SERVICE_ROLE_KEY` and a random `CHARGING_INGESTION_SECRET` (32+ characters). Apply the new migration, then run `pnpm charging:import 51.5 51.65 -0.95 -0.65` against the app origin in `CHARGEONCE_SITE_URL` (local default: localhost). Imports atomically upsert public regional snapshots; page loads never import nationwide data. The protected POST endpoint is ready for a future scheduler, but no job is enabled automatically.

To add a provider, implement the interface, normalise into internal models with honest nulls/provenance, register the server adapter and add contract tests—no vendor-specific UI changes. See [provider architecture, environment variables, fallback, ingestion and extension guide](docs/charging-providers.md).

## Quality checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## What works

- Home: pick a demo car and see best, cheapest and fastest recommendations.
- Find a charger: search, filter and sort compatible demo/external regional records, with explicit source confidence; costs require a current structured tariff.
- Plan a journey: try example UK routes, change starting battery and view a reserve-aware stop estimate.
- Charging calculator: consumer-first cost, approximate time, range added, cost per 100 miles and an 80% alternative; configurable losses, explicit SOC curves/fallbacks and a band-by-band breakdown.
- My cars: authenticated multi-car garage with add/remove, nicknames, default/current selection and optional efficiency overrides. Manufacturer/model/variant selection previews specifications before saving.
- Account: email/password and magic-link sign-in, confirmed sign-up, profile editing and sign-out. Account forms are disabled when Supabase is not configured.
- Shared vehicle selector: database current car for signed-in users, local-browser demo selection for anonymous visitors. All charging calculations use that car.

## Estimate assumptions

`src/lib/charging-engine.ts` contains the reusable calculation engine. It uses usable battery capacity, typical real-world efficiency and configurable losses (visible default: 10% of billed energy). Time is integrated over SOC bands, capped by the car and charger, with clearly labelled fallback curves when data is missing or invalid. Costs per 100 miles exclude fixed session fees; non-zero session estimates include any provided connection fee. Calculator headlines are deliberately approximate rather than falsely precise. See [engine formulas, curve JSON contract, assumptions and tests](docs/charging-engine.md). Bundled demo records/curves and persistent seeds remain explicitly illustrative.

## Architecture and next integrations

- `src/domain`: vehicle/charger types.
- `src/data`: clearly labelled seed/demo records.
- `src/lib`: calculations and formatting.
- `src/providers`: provider-neutral charging adapters, bounded snapshot ingestion and vehicle/account repositories.
- `src/config`: application identity, locale and feature flags.
- `src/components`: reusable UI and interactive features.
- `src/app`: App Router pages and metadata.

The app is Vercel-compatible. Supabase is optional for demo use; provider configuration is in `.env.example`. Before selling a live directory, verify source licensing/coverage and add maintained real-time availability/tariff feeds, geocoding and real route geometry. OCM external data alone is not live stall availability or verified pricing. Live accounts require a dedicated configured Supabase project and production email delivery. Never expose server-side API keys through `NEXT_PUBLIC_` variables.
