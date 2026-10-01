# ChargeOnce — repository instructions

## Read first

Before significant work, read `AGENTS.md`, `PROJECT.md`, `README.md` and the relevant documents under `docs/`.

## Product boundary

ChargeOnce is a UK EV charging decision helper. It is not currently a charging-payment, roaming, RFID, wallet or booking product.

Do not silently expand into those areas.

## Data honesty

- Demo records must remain clearly labelled demo.
- External OpenChargeMap-style records must not be presented as verified live occupancy or verified structured tariff data when the source does not provide that.
- Unknown data stays unknown; do not fabricate prices, availability, facilities or route precision.
- Keep source/provenance distinctions visible.

## Security

- Never expose service-role/provider secret keys through `NEXT_PUBLIC_`.
- Preserve RLS and account isolation.
- Treat ingestion endpoints as privileged and secret-protected.
- Mapbox browser tokens must be public `pk.` tokens with appropriate restrictions; reject secret tokens in browser code.

## Engineering

Keep provider adapters replaceable. Avoid vendor-specific UI logic when a normalized domain model can express the behaviour.

Run `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` for material changes.

## Documentation is part of done

Update `PROJECT.md` when provider readiness, hosted-environment state, live-data quality, current milestone or product boundary changes.

Update specialist docs when provider/database/auth/calculation architecture changes.

## Handoff

Read `PROJECT.md` first and update it last.
