# ChargeOnce

A mobile-first UK EV charging decision helper. This first release is a polished, interactive **demo**, not a live charger directory: locations, tariffs, availability, reliability and vehicle specifications are illustrative. There is no charging, payment, wallet, roaming or RFID functionality.

## Run locally

Requires Node.js 20.9+ and pnpm.

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000. No API keys or database are needed.

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
- My cars: choose one of three demo EVs; the choice is retained in local storage and used throughout the app.
- Account: honest preview of planned functionality; no non-functional sign-in form or credential collection.

## Estimate assumptions

`src/lib/charging.ts` contains the pure calculation logic and tests. Cost per 100 miles is based on battery capacity divided by estimated range, multiplied by the tariff; it excludes any fixed connection fee. Cost to target includes energy and a connection fee, when applicable. Charge time uses the lower of the vehicle or charger power, with a simplified 0.78 average-power factor for tapering. This is deliberately approximate; weather, battery temperature, charging curves, traffic and real-world range will affect results. All demo data is in `src/data/demo.ts`.

## Architecture and next integrations

- `src/domain`: vehicle/charger types.
- `src/data`: clearly labelled seed/demo records.
- `src/lib`: calculations and formatting.
- `src/providers`: data-provider boundary for a future licensed live feed.
- `src/config`: application identity, locale and feature flags.
- `src/components`: reusable UI and interactive features.
- `src/app`: App Router pages and metadata.

The app is Vercel-compatible. Optional future integration placeholders are documented in `.env.example`; there are no required environment variables. Before representing results as live, integrate a properly licensed and maintained charging-location/availability/tariff source, geocoding and real route geometry, current vehicle data, freshness timestamps, provider failure handling, and robust coverage/accuracy testing. Account features would require a secure auth and data store. Do not expose server-side API keys through `NEXT_PUBLIC_` variables.
