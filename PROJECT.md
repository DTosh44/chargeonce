# ChargeOnce — project status

Last reviewed: 1 October 2026

## Purpose

Help UK EV drivers compare charging options using their actual car characteristics, transparent assumptions and honest source confidence.

## Current state

The application has a substantial Next.js implementation with demo data, provider abstractions, optional Supabase persistence/auth, OpenChargeMap integration support, Mapbox map/search support and a reusable charging calculation engine.

A production launch with trusted live charger availability/tariffs is **not yet evidenced**.

## What works

- Demo-car recommendations.
- Charger search/filter/sort with explicit provenance.
- Map/list interface.
- Journey-planning examples.
- Charging cost/time/range calculator.
- Authenticated multi-car garage.
- Shared current-car selection.
- Provider abstraction for mock, stored and OpenChargeMap data.
- Regional ingestion foundations.
- Supabase schema/RLS foundations.
- Charging-engine tests and technical documentation.

## Live / deployment status

The app is Vercel-compatible, but no production launch with fully configured live providers/accounts is currently evidenced.

## Current milestone

**Prove the real-data experience in a controlled hosted environment while preserving honest provenance.**

## Key decisions

- No payment/wallet/roaming/RFID functionality in the current product.
- Unknown/stale source data must not be turned into fake precision.
- OCM operational status/free-text pricing is not equivalent to real-time stall occupancy or verified structured tariffs.
- Vehicle and charger providers remain replaceable behind interfaces.

## Current blockers / dependencies

- Hosted Supabase configuration and production email delivery.
- Real provider API credentials and licensing/coverage review.
- Mapbox token/configuration and live visual smoke testing.
- Reliable structured price/availability sources for stronger recommendations.
- Real route geometry remains separate from current approximate/demo journey logic.

## Next actions

1. Configure a controlled hosted Supabase environment.
2. Configure a restricted Mapbox public token.
3. Configure an approved charger-data provider.
4. Run live search/map/list smoke tests.
5. Verify account + My Cars flows in the hosted environment.
6. Audit which tariff/availability fields can genuinely be trusted.
7. Decide what minimum real-data quality is required before public launch.

## Deferred / out of scope for this milestone

- charging payments;
- wallet balances;
- roaming;
- RFID;
- driveway sharing;
- nationwide ingestion without a bounded/provider-safe design.

## Handoff notes

Prioritise evidence quality and real-provider validation over feature breadth. Never make demo/external data look more authoritative than it is.
