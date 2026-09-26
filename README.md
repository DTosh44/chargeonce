# ChargeOnce

A mobile-first UK EV charging decision helper. This first release is a polished, interactive **demo**, not a live charger directory: locations, tariffs, availability, reliability and vehicle specifications are illustrative. There is no charging, payment, wallet, roaming or RFID functionality.

## Run locally

Requires Node.js 20.9+ and pnpm.

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000. No API keys or database are needed: Supabase credentials are optional and the public catalogue gracefully falls back to seeded demo data.

## Supabase data architecture

All 17 core tables, RLS policies, constraints and development seeds are defined under `supabase/`. When configured, the existing screens read the persisted demo catalogue through a typed adapter. Five UK demo EVs and five explicitly marked demo charging locations use recognisable network names. Prices/availability are not live.

See [database setup and security documentation](docs/database.md) for migrations, seeding, type generation, units, ownership rules, fallback behaviour and integration boundaries. No hosted database is modified automatically.

## Quality checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## What works

- Home: pick a demo car and see best, cheapest and fastest recommendations.
- Find a charger: search, filter and sort compatible demo chargers; compare estimated cost, time and status.
- Plan a journey: try example UK routes, change starting battery and view a reserve-aware stop estimate.
- Charging calculator: change battery level, target, tariff and charger power for live estimates.
- My cars: choose one of five demo EVs; the choice is retained in local storage and used throughout the app.
- Account: honest preview of planned functionality; no non-functional sign-in form or credential collection.

## Estimate assumptions

`src/lib/charging.ts` contains the pure calculation logic and tests. Cost per 100 miles uses vehicle efficiency when supplied, or battery capacity divided by estimated range, multiplied by the tariff; it excludes any fixed connection fee. Cost to target includes energy and a connection fee, when applicable. Charge time uses the lower of the vehicle or charger power, with a simplified 0.78 average-power factor for tapering. This is deliberately approximate; weather, battery temperature, charging curves, traffic and real-world range will affect results. Bundled fallback data is in `src/data/demo.ts`; persistent development records are in `supabase/seed.sql`.

## Architecture and next integrations

- `src/domain`: vehicle/charger types.
- `src/data`: clearly labelled seed/demo records.
- `src/lib`: calculations and formatting.
- `src/providers`: data-provider boundary for a future licensed live feed.
- `src/config`: application identity, locale and feature flags.
- `src/components`: reusable UI and interactive features.
- `src/app`: App Router pages and metadata.

The app is Vercel-compatible. Supabase is optional; Mapbox and live-data provider placeholders are documented in `.env.example`. Before representing results as live, integrate a properly licensed and maintained charging-location/availability/tariff source, geocoding and real route geometry, current vehicle data, freshness timestamps and robust coverage/accuracy testing. Account features require wiring the prepared session-scoped repositories into a complete auth flow. Do not expose server-side API keys through `NEXT_PUBLIC_` variables.
