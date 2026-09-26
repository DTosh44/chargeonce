# ChargeOnce persistent data

The existing UI is unchanged. Supabase now supplies its **demo catalogue** when configured and seeded; otherwise the application uses its bundled development seeds. This is not a live charger feed. Recognisable UK network names are used as illustrative labels only, with no affiliation or assertion about real charger locations, prices or availability.

## Setup: dedicated development database

Do not apply these migrations to the VisitMade project or another app's database. No remote database has been selected or modified by this implementation.

Install the Supabase CLI and Docker using their official installation instructions, then from this repository:

```bash
pnpm db:start
pnpm db:reset
```

**`db:reset` deletes and rebuilds only your local Supabase development database.** It applies the three migrations and loads `supabase/seed.sql`. Do not use it for a database whose contents you need to preserve. The seeds create no auth users, passwords or private user records.

Copy `.env.example` to `.env.local`, then use the local project's URL and public key shown by `supabase status`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_public_key
# Or NEXT_PUBLIC_SUPABASE_ANON_KEY for the CLI's legacy anon JWT.
```

Restart the development server after changing credentials; rebuild/redeploy production builds when changing environment variables. Missing, invalid, incomplete, unseeded or unreachable configurations fall back to the bundled demo catalogue. Queries time out after five seconds. The model context exposes `source` and `fallbackReason` for future diagnostics; credentials and detailed database errors are not sent to the browser.

To reapply just the idempotent seeds without resetting the database, install PostgreSQL's `psql` and run:

```bash
pnpm db:seed
```

The seed script only accepts localhost PostgreSQL URLs. `CHARGEONCE_DATABASE_URL` can point it at another **local dedicated development DB**. Remote hosts are refused, and passwords are passed in the child environment rather than command arguments or logs. Seed identifiers are deterministic. Seeding updates only the supplied development records, not user data.

For a hosted **ChargeOnce development project**, review the migration SQL, link the Supabase CLI to that exact project, and apply migrations through your normal deployment process. Seeds are not part of the schema migrations and must be deliberately applied only to a development/demo environment. Never enable automatic demo seeding against production.

## Schema

| Area                       | Tables                                                              |
| -------------------------- | ------------------------------------------------------------------- |
| Identity and garage        | `profiles`, `vehicles`, `user_vehicles`                             |
| Charger catalogue          | `operators`, `charging_locations`, `evses`, `connectors`, `tariffs` |
| Amenities and history      | `facilities`, `location_facilities`, `charger_status_history`       |
| Personal records           | `favourites`, `user_reports`, `journeys`, `journey_stops`           |
| Reserved community feature | `community_chargers`, `community_availability`                      |

Locations contain EVSEs (charging units/stalls), and EVSEs contain connectors. Availability is counted per EVSE, not per plug. Facilities are an extensible dictionary and many-to-many relationship, including toilets, café, restaurant, shop, Wi-Fi, 24-hour access, accessible toilet and lighting.

All tables have RLS enabled. Foreign keys and indexes cover ownership, location relations, tariff validity, coordinates, report history and journey ordering. Numeric bounds reject invalid power, capacity, costs, coordinates and battery percentages. Composite foreign keys prevent a tariff from referring to the wrong operator or mixing demo/live flags, and prevent reports from attaching an EVSE at a different location.

### Units and estimates

- Tariff `price_per_kwh`, `connection_fee` and `parking_fee` are **major currency units** (e.g. `0.69 GBP`), never pence. The adapter converts to the existing UI's secondary pence fields.
- Battery energy is kWh; charger power is kW; range/distance is miles; efficiency is **miles per kWh**; battery percentages are 0–100.
- Parking fee units are explicitly hourly or per-session. This initial quote projection omits records with parking fees, non-GBP tariffs, missing or expired tariffs; it never substitutes a zero price.
- Vehicle `charging_curve` stores `{ batteryPercent, powerKw }` points for future curve-aware estimates. The existing simplified taper-based time calculation is preserved. Seed specifications are illustrative, not authoritative vehicle data.
- The demo map's positions, distance and reliability are explicit `demo_metadata`, not calculated geospatial or reliability claims.

### Public and private access

- Anonymous/authenticated visitors can **read** the public catalogue. They cannot edit prices, vehicle specifications, facilities, status or history. Catalogue ingestion belongs in a trusted backend later.
- Private and community locations are excluded from public reads, including their EVSEs, connectors, tariffs, facilities and history. Coordinate indexes support future bounding-box searches; PostGIS/live routing is not required now.
- Profiles are created automatically from Supabase Auth. Every user's profile, garage, favourites, journeys and journey stops is isolated by their authenticated identity. Client-supplied user IDs cannot grant access.
- Reports are private to their author; browser submissions require authentication. Nullable user IDs support trusted ingestion and account-deletion unlinking, **not anonymous public writes**. Comments are length-limited; moderation/rate limits are needed before exposing report submission UI.
- Account deletion cascades profiles, garage, favourites and journeys/stops. Provisioned private community locations and their child records are removed too. Reports retain only operational information: user links and free-text comments are removed. Historical journey stops restrict deletion of referenced catalogue locations. Vehicle and operator deletion is restricted while referenced.
- A partial unique index permits **at most one default car per user**. `set_default_user_vehicle` switches the default in one transaction, serialised per user and protected by RLS. It rejects cars outside that user's garage. New garages can have no default until a car is chosen; deleting a default does not arbitrarily pick another one.
- EVSE insert/status updates automatically append immutable history. Historical retention/pruning should be established before high-volume live ingestion.
- Community tables are prepared, not exposed in the UI. Users can only read their own provisioned records; browser writes are disabled. Trusted provisioning must create a private community location first. No booking, payment, roaming or charging-session feature is enabled.

## Code boundaries

`src/lib/supabase/database.types.ts` is the checked-in, hand-maintained flat-row contract for all 17 tables. Once local Supabase is running, `pnpm db:types` safely regenerates exact schema and relationship types from the **local** database. The script keeps existing types on generation failure. Commit the generated changes with migrations and run typecheck.

`src/domain/models.ts` defines provider-independent camelCase entity models. `src/domain/types.ts` retains the existing compact UI models. `src/providers/supabase/mappers.ts` and `catalogue.ts` adapt records rather than making components understand raw snake_case tables.

`src/providers/catalogue.server.ts` selects the configured Supabase provider or seeded fallback. Server Components load and pass only presentation data to the existing shared vehicle context. `src/providers/supabase/user-data.ts` prepares session-scoped profile, garage, favourite, report and journey metadata operations. The repository derives identity from `auth.getUser()`; it accepts no arbitrary user ID from UI callers.

No service-role/admin key is used by the app. Catalogue reads use a public key and RLS. Configuration rejects secret keys and legacy service-role JWTs. Session clients are `server-only`, use cookie-scoped credentials and RLS, and have no global user-data cache. Private operations explicitly fail when Supabase/authentication is unavailable—**they never silently pretend to save locally**.

The demo vehicle selection remains local-browser state while account/sign-in features are disabled. Wiring sign-in, saved garage/favourites and journey management into the UI is a separate task; when enabling auth, add the Supabase SSR token-refresh Proxy and callback handlers before release. Do not use a public catalogue client to perform private writes.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Tests execute the actual migration and seed SQL in PostgreSQL/WASM (PGlite) with minimal Supabase Auth fixtures. They cover idempotent seeding, constraints, demo projection, RLS ownership, private locations, default-car switching, report/location integrity, history, community isolation and account-deletion privacy. This does not replace a deployment smoke test against a selected hosted Supabase project and its real Auth/PostgREST services.
