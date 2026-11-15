# Production deployment

## Vercel

The GitHub repository is `RyanM2604/Project-Hermes`; the existing production URL
redirects to `https://hermes-uw.vercel.app`.

In the project's Settings, check:

| Setting | Value |
| --- | --- |
| Framework preset | Next.js |
| Root directory | Repository root (`.`) |
| Production branch | `main` |
| Node.js version | 22.x |
| Install command | `npm ci` (keep lifecycle scripts enabled) |
| Build command | `npm run build` |
| Output directory | Next.js default; no custom override |

The install's `postinstall` generates Prisma Client. Do not run ingestion in the
build command. Git pushes to the connected production branch trigger deployment.

Set these environment variables for **Production**, and for **Preview** if you
want preview deployments to access the same services:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Matching project's public anon key |
| `NEXT_PUBLIC_APP_URL` | `https://hermes-uw.vercel.app` (or your final custom domain) |
| `SUPABASE_SERVICE_ROLE_KEY` | Matching project's server-only service-role key, required to aggregate Going counts |
| `DATABASE_URL` | Matching Supabase Postgres connection URL; use transaction pooling on port 6543 for Vercel functions |
| `DIRECT_URL` | Direct/session Postgres connection URL on port 5432, used for migrations |
| `CRON_SECRET` | Long random secret to protect the retained legacy refresh endpoint |

Only the `NEXT_PUBLIC_` variables go to the browser. Keep database URLs, the
service-role key, and `CRON_SECRET` server-only. The connection helper adds `pgbouncer=true` for the
Supabase transaction pooler automatically. Environment variable changes require
a new deployment; public values are embedded during the build. For previews,
set `NEXT_PUBLIC_APP_URL` to the intended preview origin if testing auth there.

The web app reads persisted events. It needs the service-role key server-side to
aggregate Going counts; Apify/OpenAI keys belong to the separate ingestion worker
in GitHub Actions.
No map provider API key or PostHog configuration is needed.

## Supabase

Use the same Supabase project for all keys and database connections.

- Under Authentication → URL Configuration, set Site URL to the production URL
  and allow `https://hermes-uw.vercel.app/auth/callback`. Add the
  corresponding callback for a custom domain or preview domain you actually use.
- Prisma migrations must be applied with `npx prisma migrate deploy` before the
  new worker runs. They are not applied by `npm run build`. Existing connected
  database migrations were verified up to date on November 14, 2026.
- Apply the separate Supabase SQL migration
  `supabase/migrations/20261114000000_create_event_map_revision.sql` once, and
  ensure `event_map_revision` is published in `supabase_realtime`. This was
  previously applied to the connected database. Do not re-run its CREATE TABLE
  script on a database where it already exists. This signal allows live RSVP
  count updates; the map also has 30-second recovery polling.
- The `event-images` bucket must be public for uploaded event images to display.
  The ingestion migration/setup command provisions it.

## GitHub Actions ingestion

Vercel's old ingestion schedule is removed (`vercel.json` is empty). The
`Ingest events` workflow runs daily at **13:17 UTC** (08:17 EST / 09:17 EDT), and
can be started manually. The first scheduled run requires repository Actions
secrets at Settings → Secrets and variables → Actions:

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APIFY_TOKEN`
- `OPENAI_API_KEY`

No Actions secrets were listed at deployment preparation; add these before
expecting scheduled ingestion to succeed. The service-role key belongs in trusted
server environments (the worker and the Vercel server). Do not prefix it `NEXT_PUBLIC_`.

Optional repository variables: `APIFY_MAX_RUN_USD` (default `0.50`),
`APIFY_MAX_MONTH_USD` (default `15`), `OPENAI_EXTRACTION_MODEL` (default `gpt-4o-mini`),
`GEOCODING_BASE_URL` (default public Nominatim), and `GEOCODING_USER_AGENT`
(prefer an app identifier with a contact URL/email). Public geocoding is cached
and limited to a single worker/four requests per minute; use a hosted or
self-hosted compatible provider if volume grows.

Run the workflow manually with dry-run enabled and `account=uwcheeseclub` first.
Dry-run previews cached extraction and makes no paid requests. An empty cache is
expected before the first live collection. Then run with dry-run off to
publish. Details and local retry commands are in [ingestion.md](ingestion.md).

## Verify a deployment

Open `/`, `/events`, `/map`, and an event detail page. Confirm map locations,
images, Supabase signup/login redirects, saving, and Going RSVP updates. The
`/api/map` endpoint should return current events and counts without user IDs.

References: [Vercel Git deployments](https://vercel.com/docs/git),
[Vercel environment variables](https://vercel.com/docs/environment-variables),
[Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).

## Initial production check

The November 14 deployment built successfully and `/` and `/map` returned HTTP
200. `/api/map` returned HTTP 503 (`Event data is unavailable right now.`).
Check the production `DATABASE_URL` and Vercel Function logs for the actual
connection error before treating the map as ready. Verify the database URL,
public Supabase URL/anon key, and service-role key all refer to the same project.
The checked local database is migrated, but Vercel's environment values have not
been inspected or changed. GitHub's repository homepage still lists the older
`project-hermes-eight.vercel.app` alias, which redirects to `hermes-uw.vercel.app`.
