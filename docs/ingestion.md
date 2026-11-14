# Event ingestion

The feed reads persisted events only. Collection runs daily at 13:17 UTC in
`.github/workflows/ingest-events.yml`, or manually through the CLI/workflow.
GitHub schedules can be delayed; ingestion is not a real-time service.

## Setup and rollout

1. Use Node 22 and run `npm ci`.
2. Review and deploy the additive Prisma migration with `npx prisma migrate deploy`.
   Existing installations must have their original canonical-events migration
   recorded before deployment; do not reset or recreate an existing database.
   The new migration also enables RLS on private processing tables and provisions
   `event-images` when Supabase Storage is present.
3. Configure `DATABASE_URL`, `DIRECT_URL`, `APIFY_TOKEN`, `OPENAI_API_KEY`,
   `NEXT_PUBLIC_SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` locally and as
   GitHub Actions repository secrets. Never use a browser-exposed service key.
   `APIFY_API_TOKEN` remains supported locally as a legacy token alias.
   Workers prefer `DIRECT_URL` (a direct/session connection), falling back to
   `DATABASE_URL`. The app and worker automatically add `pgbouncer=true` for
   Supabase transaction-pooler URLs on port 6543 to disable incompatible prepared
   statements. See [Supabase troubleshooting](https://supabase.com/docs/guides/database/prisma/prisma-troubleshooting).
4. Run `npm run ingest:events -- --setup-storage` to create/verify the public
   image bucket. `EVENT_IMAGES_BUCKET` defaults to `event-images`; the migration
   provisions the default only. Custom buckets need this setup command.
5. Start with `npm run ingest:events -- --account uwcheeseclub --dry-run`.
   This calls paid collection/AI providers, but makes no database or bucket writes.
   Check extracted outcomes against original posts before a live account run.
6. Run `npm run ingest:events -- --account uwcheeseclub`, inspect the result and
   card image URLs, then enable the scheduled workflow on the default branch.
   Manual workflow runs default to dry-run. Set `account` to `uwcheeseclub` for a
   small first test; leave it empty for all sources. The former Vercel ingestion cron is
   removed to avoid overlapping schedules.

The worker loads `src/ingestion/sources/instagram-accounts.json`, copied from
`hermes_instagram_sources.json`. It contains 59 active campus and regional
accounts, including Cheese Club. Edit this repository JSON to change the list;
the original Downloads file is not read at runtime. Lower priority numbers run
first, and `active: false` disables an account. There is no 25-account cap;
concurrency and the shared run-time budget bound each run, with collected work
remaining in the durable queue. Each collection fetches the latest 12 posts
including pinned posts. Older edited posts outside that window require a
source configuration/backfill change; they are not continuously monitored.

`OPENAI_EXTRACTION_MODEL` defaults to `gpt-4o-mini`; classification uses its
existing `OPENAI_CLASSIFICATION_MODEL` setting. Extraction prompt/schema versions
are independent. Model-reported evidence is not an independent proof of facts:
fixture evaluation and source comparisons remain necessary when changing models.

## Commands

```sh
npm run ingest:events                              # Official sources + Instagram
npm run ingest:events -- --social                  # Active Instagram accounts
npm run ingest:events -- --official                # Official sources only
npm run ingest:events -- --account uwcheeseclub     # One configured account
npm run ingest:events -- --inspect                 # Status, evidence, held reasons
npm run ingest:events -- --account uwcheeseclub --inspect
npm run ingest:events -- --retry                    # Retry held/failed saved posts
npm run ingest:events -- --reextract                # Explicitly re-extract saved posts
npm run ingest:events -- --reclassify               # Classification only
npm run ingest:events -- --backfill-images          # Upcoming event source images
npm run ingest:events -- --social --backfill-images # Social images only
npm run ingest:events -- --backfill-images --dry-run
```

Retry/re-extraction work from saved posts without another Apify collection.
`--reclassify` runs classification only. These three state-changing operations
cannot be combined with dry-run. Inspection does not start ingestion.
Account/source scopes also constrain image backfill and classification recovery.

## Processing guarantees

- `social_posts` stores source content, extraction, model/version/token usage,
  state, retries, and leases. `social_media` stores source identity and bucket
  metadata. `social_event_mappings` preserves per-post event identities.
- Unchanged completed posts skip extraction, classification, and uploads.
  Changing CDN query strings or Instagram CDN shard hosts does not invalidate a
  successfully processed post.
  Source paths and caption changes do. Upload keys are SHA-256 WebP hashes.
- Caption and up to ten ordered images feed strict structured extraction.
  Incomplete or oversized carousels are held, not silently scanned partially.
  A failed image download may still permit a caption-supported event; that
  partial extraction is not cached, and imagery is retried.
- Publish requires supported title, date/time, and location, with no unresolved
  conflicts. Valid completed events are archived too: `/events` shows upcoming
  events and `/events?view=past` shows completed events, newest first. Relative
  dates use the post timestamp in America/Toronto. Ambiguous
  DST times and missing dates/locations are held. Missing end times use two hours,
  with `endTimeEstimated` persisted and labeled in event details.
- One post can produce multiple cards, each with its matching image. Existing
  mappings survive model ordering changes and uniquely identifiable reschedules.
  Ambiguous title/identity changes are held rather than attached to an old ID.
  An old posting-time/location placeholder can be corrected in place when exactly
  one validated event belongs to that same source post.
  Identical gatherings repeated across slides collapse to one candidate; different
  titles sharing one time and venue are held as ambiguous detail-slide splits.
- Official events take precedence. Later official imports can adopt an existing
  social event ID. Reconciliation hides pre-existing duplicates using aliases,
  migrates save/RSVP/interaction references, and preserves old event links.
  This reconciliation is skipped in an account-scoped run.
- Images are JPEG/PNG/WebP inputs up to 10 MB / 40 million pixels. HTTPS fetching
  pins a validated public IP and revalidates redirects. Derivatives are uncropped
  WebP, at most 1600 pixels per edge. Only the selected images are uploaded.
- An upload failure preserves existing imagery or the placeholder. After three
  failed processing/image attempts, the post remains failed until explicit retry
  or changed content. A processing restart reuses saved successful extraction.
- Database leases fence stale workers. GitHub concurrency prevents overlapping
  scheduled jobs; database fencing also protects manual concurrent runs.
- A shared 35-minute deadline reserves two minutes for classification. Unclaimed
  work remains durable. Collection and AI processing each have concurrency two.
  A single account failure does not stop other sources. Nonzero exits indicate
  failed, image-pending, or unfinished stages; held/ignored posts are reported
  separately and do not by themselves fail the run.

Instagram stories, video/audio transcription, automatic account discovery,
Facebook, and a review dashboard are not included. Reels use their caption and
cover image. Cancellations/conflicting updates are held for inspection rather
than automatically withdrawing an already published event. Existing valid
published data remains available when an update fails validation.

## Verification

```sh
npm test
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

Repository integration tests require a separate **local** Postgres database whose
name ends in `_test`. Apply the Prisma schema and existing Supabase table schemas
there first, then run:

```sh
HERMES_TEST_DATABASE_URL=postgresql://USER@127.0.0.1:55487/hermes_ingestion_test \
  npx vitest run src/ingestion/social/repository.integration.test.ts
```

Never point integration tests at production: they intentionally clear test rows.
Unit tests use fixtures and injected API/storage clients and incur no provider
costs. Live fixture evaluation should include caption-only announcements,
poster-only details, weekly schedules, conflicting dates, and non-event posts.

## Rollback

Disable the GitHub workflow first. Existing feed reads continue from persisted
Event rows and stored images. Revert ingestion code only if its generated Prisma
client remains compatible with the additive database schema. Do not drop the
processing tables or bucket as a rollback step: they contain resume state and
published image URLs. Stop and inspect `--inspect` plus job summaries when a run
fails; do not expose credentials or signed upstream URLs in public logs.

## Automatic map locations

Normal ingestion resolves active canonical events after publication. Source GEO /
Event structured data (including UW Drupal event maps) wins, followed by known venues, the official UW campus
building index, and Nominatim for unfamiliar names or addresses. City centroids,
ambiguous matches, and outside-Waterloo points never become Waterloo pins.
Saved source text is preserved. A location input change invalidates old coordinates.

Backfill current events without collecting posts, running AI, or uploading images:

```sh
npm run ingest:events -- --backfill-locations --dry-run
npm run ingest:events -- --backfill-locations
```

The usual source/account scope flags apply. A manual batch has five minutes;
rerun if `complete: false` to continue using its saved progress. Normal ingestion
reserves at most two minutes. Classification-only and image backfill skip locations.
Apply `20261114150000_event_geocodes` before enabling this worker.

`GEOCODING_BASE_URL` defaults to `https://nominatim.openstreetmap.org/` and can be
switched to a compatible HTTPS provider. `GEOCODING_USER_AGENT` identifies the app;
set a contact URL/email for your deployment. The public service is for low-volume
use: [Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/).
One database lock serializes batches; requests run at most four per minute and
share cached queries across events. Do not add parallel workers or periodic bulk
re-geocoding against that service. Use a hosted/self-hosted provider as volume grows.
Location results use OpenStreetMap data, attributed on the map.

Provider matches refresh after 30 days, misses after seven days, failures after
one hour, and HTTP 429 honors Retry-After and stops the batch. Refresh failures
retain the previous coordinates only when the location input is unchanged.
The cache is private (RLS enabled, no browser-role access); public snapshots expose
only venue points and aggregate Going counts. Dry runs make no location requests
and write nothing.

## Diagnosing partial ingestion runs

The workflow now accepts an optional `account` handle. Start with one account in
dry-run mode, then run all sources with dry-run off to publish. To retry **saved**
failed/held posts after a live run, check `retry_failed` and turn dry-run off;
this skips paid Apify recollection and reuses valid saved extraction. A dry-run
saves no posts, so it cannot be resumed with `retry_failed`.

Progress lines show account collection and extraction totals every ten processed
posts. The final `outcome` is `completed`, `completed_with_warnings`, or
`incomplete`. GitHub's summary includes unavailable accounts and budget status.

Apify `not_found` / `no_items` responses are visible account-availability warnings,
not global provider failures. The account stays configured and is checked again
on future collection runs. Private/empty accounts cannot be repaired by changing
API keys. Unknown provider failures, timeouts after retry, invalid output,
pending images, and unfinished processing still return nonzero exits.

Extraction allows 45 seconds per attempt, with one additional attempt only for a
timeout or an invalid slide index. The shared worker deadline bounds retries.
Invalid indices are never used to select a photograph. Dry-run extraction uses
two workers, matching live extraction; it still makes paid AI/image requests.
A deadline that leaves work unevaluated now sets `budgetExhausted: true`.
Missing or conflicting date/location evidence remains held, never guessed.

On November 14, 2026 the failed dry-run's existing Apify datasets showed six
`not_found` handles and one `no_items` handle. Corrected sources:

| Previous | Verified handle | Reference |
| --- | --- | --- |
| `mathsocuw` | `uwmathsoc` | [MathSoc's mathNEWS introduction](https://mathnews.uwaterloo.ca/wp-content/uploads/2024/09/mathNEWS-156-0-divide.pdf) |
| `uwaterloo_ess` | `uw_ess` | [ESS homepage Instagram link](https://uwaterloo.ca/environment-students-society/) |
| `cityofwaterloo` | `citywaterloo` | [City social accounts](https://www.waterloo.ca/news-and-service-updates/follow-the-city-on-social-media/) |
| `uwdsc` | `uwaterloodsc` | [DSC's January 2026 mathNEWS column](https://mathnews.uwaterloo.ca/wp-content/uploads/2026/01/mathNEWS-160-1.pdf) |
| `uwux` | `uw_ux` | [UW/UX's Instagram link](https://linktr.ee/uwux) |

`thingstodoinkw` had no verified replacement, and `whynotrunclub` was empty/private;
they remain visible availability warnings instead of silently disappearing.
