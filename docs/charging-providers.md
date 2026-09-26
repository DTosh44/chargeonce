# Charging-data providers

React receives only ChargeOnce domain objects, not vendor DTOs or credentials. Missing prices/counts are `null`, not free or zero availability.

## Architecture

- `src/domain/charging-data.ts`: sites, connector summaries, operators, status, tariffs, bounds and separate provenance for locations/availability/pricing.
- `src/providers/charging/provider.ts`: `ChargingDataProvider` supports `getLocations(bounds)`, `getLocationsNear(latitude, longitude, radiusKm)`, `getLocation(id)`, `getOperators()`, `getStatuses(locationIds)` and `getTariffs(locationIds)`.
- `MockChargingProvider`: seeded development data; every category is explicitly demo.
- `OpenChargeMapProvider`: server-only HTTP client plus a pure normaliser. Raw property names stay in this adapter and its synthetic fixtures.
- `StoredChargingProvider`: public, RLS-scoped snapshot reads. No upstream refresh or admin credential on page loads.
- `OCPIProvider`: future incremental-feed contract, not an implemented feed, roaming or payments feature.
- `presentation.ts`: internal domain-to-card projection, retaining unknown prices, reliability and availability.
- `importChargingRegion`: provider-independent ingestion orchestration with an injected repository.

The earlier combined demo interface is now `ChargingCatalogueProvider`. Vehicles remain behind their separate `VehicleService`.

Source IDs are opaque/provider-scoped (e.g. `openchargemap:12345`), **not database foreign keys**. Stored reads supply `persistedLocationId` with the real location UUID. Future favourite/report actions must require this persisted ID. Imports use deterministic provider-scoped UUIDs plus the existing `(provider, external_id)` unique key.

## Server configuration

Copy `.env.example` into `.env.local`, then restart or redeploy. None of these names may have a `NEXT_PUBLIC_` prefix:

| Variable                    | Purpose                                                                |
| --------------------------- | ---------------------------------------------------------------------- |
| `OPEN_CHARGE_MAP_API_KEY`   | OCM key, sent in `X-API-Key`, never URLs/page props.                   |
| `CHARGING_DATA_PROVIDER`    | `auto` (default), `mock`, `openchargemap`, or `database`.              |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional trusted ingestion only, not normal catalogue/session clients. |
| `CHARGING_INGESTION_SECRET` | Optional random admin/scheduler bearer secret, at least 32 characters. |
| `CHARGEONCE_SITE_URL`       | Import-script app origin: deployed HTTPS or local development HTTP.    |

`auto` selects OCM if a key exists. Without it, the existing Supabase demo catalogue/local demo seeds keep working. `mock` forces local seeds. `database` reads previously imported records using the normal Supabase public URL/publishable key; it does not need an OCM key for reads.

A missing configuration/migration or failed provider produces a **whole demo batch**, clearly labelled, never demo prices grafted onto external locations. Healthy empty external regions stay empty. No key/account has been created and no hosted database changes happen automatically.

## OCM semantics and limits

The adapter follows the [official API documentation](https://openchargemap.org/develop/api) and [published schema](https://github.com/openchargemap/ocm-docs/blob/master/Model/schema/ocm-openapi-spec.yaml). The account owner must register a key and accept service terms. Open-data filtering is enabled and contributor attribution/licence text is retained; review applicable commercial redistribution obligations before release.

An operational charger is **not necessarily an available stall**. OCM availability counts remain unknown. A recent non-operational observation may be shown as unavailable, not busy/available. Free-text pricing is displayed as a provider note, not converted into a numeric tariff or free quote. Reliability is not invented. The current UK connector catalogue recognises CCS Type 2, Type 2 and CHAdeMO; unsupported standards (including CCS Type 1) remain unrecognised rather than claiming a physical fit.

Bounds span at most 0.6° per axis; radius queries allow up to 50 km; lists cap at 200 sites; ID queries cap at 100. Full pages are marked potentially truncated, not complete. Antimeridian boxes are refused. HTTP has an 8-second timeout, 4 MB body limit and no redirects. A bounded 15-minute in-process cache coalesces duplicate reads, with Next server fetch caching too. Cached observation/fetch timestamps are preserved. Failures expose safe errors, never upstream bodies or keys.

The existing map initially loads **only the Marlow region**. Text search filters displayed records, not nationwide geocoding. External pins use a labelled schematic, not the fake demo streets/river. Distance is from the search-area centre, not the user's private location. A real map/geocoder and coverage testing remain release work.

## Data confidence

Each category carries source kind, source observation date, fetched date, stale threshold and attribution.

- **DEMO DATA**: always illustrative, even when read from Supabase. Demo “Available” is not live.
- **EXTERNAL DATA**: a sufficiently recent external observation, not automatically real-time.
- **LIVE DATA**: reserved for a future adapter with verified live observations.
- **UNKNOWN DATA**: missing/invalid/future observations, tariffs or occupancy.
- **STALE DATA**: the observation or fetched snapshot is too old; re-fetching an old record cannot make it fresh.

OCM policy thresholds: 30 days for location observations, 15 minutes for operational condition, 24 hours for structured tariffs from future adapters. These are product policies, not source guarantees. OCM counts/free-text prices remain unknown regardless of fetch time. Cards show category confidence, source observation dates and attribution. Stale tariffs produce no costs; stale availability cannot satisfy “Available only”; known non-operational chargers are excluded from recommendations. Refresh the page to re-evaluate source freshness.

## Importing and future scheduling

Apply `20260926000500_charging_ingestion.sql` to a **dedicated ChargeOnce project**, alongside existing migrations. It adds RLS-protected `charging_source_snapshots` and the service-role-only `import_charging_sites` RPC. Operators, locations and the normalised snapshot are upserted atomically. Aggregate equipment is not fabricated into individually addressable EVSEs, and unknown prices create no zero-priced tariff records.

The importer rejects demo/fallback/malformed records, accepts only public locations permitted for import and does not write after upstream failure. OCM records require an explicitly open-data-licensed contributor flag and no import prohibition; records with unknown/forbidden import permissions are skipped. This safeguard does not replace a commercial licence review. PostgreSQL serialises provider batches, prevents old retries from regressing newer snapshots, protects demo/community locations and rolls back malformed batches completely. Empty/truncated pages never delete missing locations.

Configure the OCM key, Supabase public configuration, service key and ingestion secret. Start the app, then explicitly run (Node 22.9+ for the optional environment-file flag; Node 24 LTS recommended for this script):

```bash
pnpm charging:import 51.5 51.65 -0.95 -0.65
```

This posts only bounds and the ingestion bearer secret to `/api/internal/charging/import` and prints counts/truncation. Provider/database keys are not sent by the script. Use `CHARGING_DATA_PROVIDER=database` for snapshot-only page reads; imports still use the configured OCM adapter independently.

A future trusted scheduler can invoke the same protected **POST** with `Authorization: Bearer <CHARGING_INGESTION_SECRET>` and JSON `{ "bounds": { "south": 51.5, "north": 51.65, "west": -0.95, "east": -0.65 } }`. GET does not perform writes. No recurring job is enabled here. Add run history/alerts, backoff, incremental cursors and a conservative licensed refresh cadence before scheduling production ingestion; use a mirror/export for large-scale ingestion rather than nationwide refreshes on page loads.

## Add another provider

1. Implement `ChargingDataProvider` in a server-only adapter. Keep its protocol DTOs/credentials isolated.
2. Map to the internal models. Preserve unknowns, provider-scoped IDs and separate observation/fetch timestamps. Do not label crowdsourced data live.
3. Preserve attribution/licensing; only public sites may enter public ingestion.
4. Register it in the server read factory and trusted ingestion dispatcher. No vendor-specific React or calculation-engine change is required.
5. Add synthetic contract tests for connector identity, unknown/stale/free tariffs, credentials, empty coverage, failures and truncation. Direct OCPI feeds will need EVSE-aware persistence and full tariff components: do not collapse complex fees into a guessed kWh price.

Tests include provider methods, normalisation, caches/errors, fallback isolation, projection, endpoint authorisation and actual PostgreSQL RLS/transaction/idempotency checks. They require no real API key and make no live-data accuracy claim.
