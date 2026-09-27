Serverless API notes

This `api/` folder contains Vercel-style serverless functions used for OAuth flows and authenticated health-data ingest.

Security model
- OAuth provider secrets and refresh/access tokens stay server-side.
- OAuth callbacks validate a short-lived, HttpOnly state cookie and never return token values to the browser.
- Personal health and OAuth-token tables are locked behind Row Level Security and revoked from `anon` / `authenticated`; only the server-side service role may access them.
- Browser code must not query private Supabase health tables directly.
- Health Connect sync and admin diagnostics require `HEALTHLENS_SYNC_SECRET` as a Bearer token.
- Strava status requires the same server-side secret.
- The AI proxy accepts only a caller-supplied provider key; it never falls back to server-owned AI keys.
- Fitbit webhook processing is disabled unless `FITBIT_WEBHOOK_ENABLED=true`. Do not enable it until provider-authenticated callback validation is implemented.
- Strava webhook POSTs require the configured `STRAVA_SUBSCRIPTION_ID` and a matching connected Strava owner.

Required server-side environment variables
- `BASE_URL`
- `SUPABASE_URL` (or the existing server-only URL fallback)
- `SUPABASE_SERVICE_ROLE_KEY`
- `HEALTHLENS_SYNC_SECRET`
- provider client IDs/secrets for connectors you actually enable

Database
Apply all files in `supabase/migrations/`, including `004_harden_private_tables.sql`, to the production Supabase database before treating hosted health data as protected.

Never commit real credentials, token dumps, database URLs containing passwords, or exported health data.
