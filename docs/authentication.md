# Authentication and My Cars

Email/password, email-confirmed sign-up and one-time magic-link sign-in use Supabase Auth with server-side cookie sessions. `/account` is protected. `/cars` is protected when Supabase is configured; without credentials it presents an explicitly unsaved catalogue preview. Public charging pages remain available without an account. This implementation does not select or modify a hosted Supabase project automatically.

## Configure a dedicated ChargeOnce project

1. Apply all four checked-in migrations to the **ChargeOnce** project using your normal Supabase migration deployment process. Do not use the previous VisitMade project. The fourth migration adds automatic first-car selection, garage repair and transactional removal/default replacement. Existing overrides outside 0.5–10 miles/kWh are preserved by a `NOT VALID` constraint, but new/updated values must meet it; review any legacy outliers before validating the constraint.
2. Seed the illustrative vehicle/charger catalogue only in development or an explicitly labelled demo environment. See [database setup](database.md). For real production, import reviewed catalogue records through a trusted backend; the browser cannot insert vehicle specifications. `VehicleService` supports both demo and non-demo catalogue records. The starter set contains 13 variants across 11 brands; it is not an exhaustive or certified UK database.
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or legacy anon key). Never supply a service-role/secret key. Set the **server-only** `CHARGEONCE_SITE_URL` to the exact deployed origin, such as `https://your-domain.example`. Development defaults to `http://localhost:3000`; production deliberately does not default to localhost. Rebuild/restart after environment changes.
4. In Supabase Auth, enable Email/password, require email confirmation, and set Site URL to that same origin. Add `${origin}/auth/callback` and `${origin}/auth/callback?next=**` to the redirect allowlist (use the actual origin, not the literal placeholder). Add localhost equivalents only for local development, ideally using a separate development project. Do not add an unrestricted all-domain wildcard.
5. Configure the **Confirm signup** and **Magic link** email templates to call the token-hash endpoint, which supports opening the link on another device:

```html
<a
  href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=email&amp;next=/cars"
  >Continue to ChargeOnce</a
>
```

The recommended template deliberately returns to the garage and contains no access token in the URL. The app also accepts the standard PKCE `/auth/callback?code=...` flow (needed for future OAuth); that flow requires the requesting browser's verifier cookie. Invalid, expired or reused links produce a recoverable sign-in message. Never log complete callback/token-hash URLs in analytics or a reverse proxy.

Local Supabase configuration includes ready-to-use confirmation and magic-link templates in `supabase/templates/`, a 10-character minimum and email confirmation. Hosted projects require copying those templates into the dashboard; local config does not change hosted Auth settings. See the [official email-template configuration guide](https://supabase.com/docs/guides/local-development/customizing-email-templates).

6. Configure production SMTP and sender branding, email deliverability, Auth rate limits and abuse protection/CAPTCHA in Supabase before launching a public sign-up service. Built-in email sending is appropriate for development, not a production delivery guarantee. Match provider password policy to the UI minimum of 10 characters or stronger. Google and Apple remain disabled in `src/domain/auth.ts`; enabling them later requires provider credentials, redirect configuration and an OAuth initiation adapter, not just flipping the flag.

## Behaviour and boundaries

Authentication is server-action/route driven. Session and PKCE cookies are HTTP-only, SameSite=Lax, and Secure in production; no client SDK needs to read tokens. A future browser-side auth SDK would require reviewing that cookie strategy. Request-specific layout state is dynamic, not prerendered or shared between users.

- A verified `auth.getUser()` determines identity. No caller-supplied user ID grants access. RLS isolates profiles and saved cars; SSR Proxy refreshes cookies and marks responses private/no-store. Server actions recheck ownership through the repository and use normal user-scoped credentials, never an admin bypass.
- The first saved car becomes default/current. Switching persists via `set_default_user_vehicle`; removing a car uses `remove_user_vehicle`, which promotes the oldest remaining car if necessary. Both functions and insertion use the same per-owner transaction lock. The partial unique index prevents two defaults. Direct database deletes outside the application can leave no default; the UI selects the first remaining car defensively until a current car is persisted.
- Multiple saved cars can reference the same model. Selector values are **saved-car IDs**, not catalogue IDs, so nicknames and efficiency overrides remain distinct.
- Manufacturer → Model → Variant is followed by a specification preview before adding. Nicknames and efficiency can be edited later. An optional efficiency override changes effective range and energy/cost estimates, not battery size or AC/DC power limits. Blank resets to catalogue estimates.
- Anonymous selection uses local storage with an in-memory fallback when storage is blocked. Signed-in users with saved cars use their database current car. An empty authenticated garage explicitly labels any temporary public selection as demo until the first car is saved.
- Garage writes never fall back to fake local persistence. If a saved garage cannot load, controls show an error and the public tools explicitly identify their demo estimates. Database catalogue failures disable adding fallback IDs that might not exist in the database.
- Signing out affects this browser's session. `/account` edits display name and optional postcode; password reset/change, account deletion, provider linking and a full session-management screen are outside this task and remain follow-up release work.

## Verification

Run `pnpm lint`, `pnpm test`, `pnpm build`, then `pnpm typecheck` (build generates Next route types). Tests cover real migration/seed SQL and RLS in PostgreSQL/WASM, first-car/current/removal lifecycle, duplicate models, override bounds, seed parity, redirect validation, and mocked provider authentication failures. They do **not** assert hosted email delivery or a real Supabase Auth/PostgREST deployment.

Hosted smoke test after configuration: create and confirm two test accounts; sign in by password and magic link; add two cars (including two of the same variant); edit nicknames/efficiency; switch and reload each calculation page; confirm current selection on a second browser; remove the current car and then the last car; verify accounts cannot access each other's rows; sign out and verify protected routes; retry an expired/reused link. Check mobile and keyboard navigation. Do not use real customer passwords or production customer records for testing.
