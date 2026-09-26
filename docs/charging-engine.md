# ChargeOnce charging engine

The calculator leads with **estimated pounds, time and miles**, not the technical tariff. The underlying arithmetic stays unrounded; uncertain session headlines use whole pounds, roughly five-minute increments and roughly five-mile range increments. Pence/kWh and detailed model values are supporting information, not a guaranteed bill.

## Units and formulas

All engine costs use **GBP pounds**, energy uses kWh, power uses kW, range uses miles and efficiency uses **battery-side miles/kWh**. SOC and losses are percentages (0–100, not 0–1).

- Battery energy = usable battery kWh × (target SOC − current SOC) / 100. **Gross capacity is not used.**
- Billed energy = battery energy / (1 − loss percent / 100).
- Energy cost = billed energy × price per kWh in pounds.
- Range added = battery energy × typical real-world efficiency.
- Battery energy for 100 miles = 100 / efficiency; apply the same losses and tariff to estimate its cost. This consumption benchmark excludes connection/session fees and may exceed a small battery's range. It is not a promise that 100 miles fits in one charge.
- Connection fees are added once for a non-zero charging session, never for a zero-energy session or the 100-mile benchmark. Calculator inputs currently model energy-only tariffs; parking, idle, subscription, minimum-spend and time-based fees are excluded explicitly.

The user's example, with losses set to 0%, is `100 / 3.8 × £0.70 = £18.4210526…`, displayed as **£18.42 / 100 miles**. With the default 10% loss assumption it is **£20.47 / 100 miles**. A 77.4 kWh usable battery from 30–80% stores 38.7 kWh; at 10% losses it bills 43 kWh, costing £30.10 at £0.70/kWh. Range added at 3.8 miles/kWh is 147.06 miles, shown approximately.

## Charging losses and efficiency

The visible, configurable default is **10% of metered/billed energy** not reaching the battery, not a 10% surcharge on stored energy. It is an engineering assumption, not a measurement or universal constant. ADAC's primary tests report roughly 5–10% for wallbox charging, and differing DC losses depending on conditions; those variations are why the setting is visible and editable. See [ADAC wallbox loss measurements](https://presse.adac.de/meldungen/adac-ev/technik/ladeverluste-bei-e-autos.html) and [ADAC DC charging-loss study](https://presse.adac.de/meldungen/adac-ev/technik/e-auto-am-schnelllader-so-viel-energie-geht-zwischen-ladesaeule-und-akku-verloren.html).

Count only losses between the charger's **billing meter** and stored battery energy. Do not add upstream transformer/charger losses that are not billed. This simplified setting also scales model time consistently with accepted charging-input power; it does not separately simulate battery heating, HVAC or balancing. Real conditions can be different, particularly cold/slow charging.

Efficiency must represent battery-side driving consumption. Do not import an efficiency figure already based on wall-meter energy and then apply charging losses again. Personal overrides from My Cars take precedence over catalogue estimates, and affect range and cost per mile—not battery capacity or charging-power limits. The compatibility adapter can derive efficiency from usable capacity and estimated range for older UI records; that source is explicitly marked `derived` rather than pretending it is a personal measurement.

The engine accepts losses from 0% up to (but not including) 100%; the consumer calculator limits entry to 0–50% to avoid implausible settings. Zero-price tariffs are valid; blank price fields are not treated as free charging.

## SOC-band JSON contract

`vehicles.charging_curve` is already a JSONB array, so **no schema migration is required**. The application now reads complete DC band profiles such as:

```json
[
  { "fromSocPercent": 0, "toSocPercent": 10, "powerKw": 70 },
  { "fromSocPercent": 10, "toSocPercent": 20, "powerKw": 130 },
  { "fromSocPercent": 20, "toSocPercent": 30, "powerKw": 170 },
  { "fromSocPercent": 30, "toSocPercent": 40, "powerKw": 155 },
  { "fromSocPercent": 40, "toSocPercent": 50, "powerKw": 135 },
  { "fromSocPercent": 50, "toSocPercent": 60, "powerKw": 110 },
  { "fromSocPercent": 60, "toSocPercent": 70, "powerKw": 85 },
  { "fromSocPercent": 70, "toSocPercent": 80, "powerKw": 60 },
  { "fromSocPercent": 80, "toSocPercent": 90, "powerKw": 35 },
  { "fromSocPercent": 90, "toSocPercent": 100, "powerKw": 12 }
]
```

This example is **synthetic demo data**, not a measured Model 3 curve. Band widths need not be 10%: a provider may supply narrower bands, including 90–95% and 95–100%, as long as the array covers 0–100% exactly without overlaps/gaps. `powerKw` is estimated power accepted at the vehicle charging input, **before** the modelled losses; an importer must normalise any battery-net measurement to this convention or revise the model explicitly. Power must be finite and greater than zero. The maximum is still capped by the car and charger. Do not append a zero-power point at 100%; an equal start/target has zero time and energy without needing such a point.

For each intersecting band:

1. Clip the band to the requested current/target SOC.
2. Calculate the stored energy and billed energy for that fraction of usable capacity.
3. Effective power = minimum of band accepted power, vehicle maximum DC power and charger maximum power.
4. Time in minutes = billed band energy / effective input power × 60.
5. Sum all band durations. Never apply the charger's advertised peak to the whole session.

The result includes clipped segments, total/peak/average power, energy, loss/source assumptions and time. The calculator offers a readable band table in its disclosure section.

## Missing, invalid and AC curve data

Curve parsing is all-or-nothing. Unsorted complete profiles are normalised; gaps, overlaps, invalid endpoints, non-finite/zero powers and oversized profiles are rejected as a whole. The page then identifies a **fallback estimation model** rather than silently substituting or retaining a partial curve.

Legacy `{ batteryPercent, powerKw }` point arrays are recognised as `legacy_points` and use the labelled fallback. They are not silently extrapolated to cover SOC ranges the source never specified. Existing hosted rows remain untouched; reseeding a deliberately designated development/demo database replaces only the deterministic demo profiles.

- DC fallback: an explicit generic SOC taper, with lower power above 80% and a low-but-positive final 95–100% band. The heuristic is not a measured curve and does not guarantee a physical full-charge time.
- AC fallback: capped by the car's AC limit and charger rating, approximately steady to 90%, then a simple end-of-charge taper. DC profiles are **never** reused for AC estimates. There is currently no imported AC curve dataset.
- A 100% target is supported and produces finite estimates, with clear temperature/balancing caveats. Invalid input (e.g. negative power, reversed SOC, invalid efficiency, 100% losses) is rejected rather than clamped to a free or instantaneous result.

Five existing seeded cars have illustrative band profiles in both `src/data/charging-curves.ts` and `supabase/seed.sql`. Other seed cars intentionally exercise the fallback. No actual charger data, authenticated garage records or hosted database were changed by this work.

## Reuse and integration

- `src/domain/charging.ts`: provider-independent inputs, band models, results and assumptions.
- `src/lib/charging-engine.ts`: pure reusable energy, billed energy, range, 100-mile cost, session and 80% quote calculations; input validation and graceful calculator results.
- `src/lib/charging-curves.ts`: strict JSON normalisation and named fallback profiles.
- `src/lib/charging.ts`: compatibility adapter for existing vehicle/charger UI models and consumer formatters. Existing cards/recommendations now use the same engine and default losses.
- `src/lib/journey-charging.ts`: illustrative repeated 10–80% stop allowance, using the engine for full/partial windows and per-stop connection fees. Journey geometry and charger accessibility remain demo-only; it is not a production route planner.
- Supabase mappers and VehicleService carry curve data into the shared vehicle selector, including saved-car efficiency overrides. Components render results and handle input state; charging formulas do not live in React components.

## Quality

Run `pnpm test`, `pnpm lint`, `pnpm build`, then `pnpm typecheck`. Tests cover different batteries/efficiencies/tariffs, partial SOC bands, slow/rapid/AC charging, both car/charger limits, over-80% taper, 100% targets, losses, fees, invalid/legacy/partial curves, empty/invalid inputs, numerical overflow, personal overrides, journey reuse and database/fallback seed parity. Real curve calibration, temperature/voltage limitations, power sharing and tariff fee models are future work before marketing time estimates as measured or live.
