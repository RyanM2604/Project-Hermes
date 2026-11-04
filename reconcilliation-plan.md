# Event ingestion and Events page reconciliation plan

**Branch:** `fix/event-ingestion-events-reconciliation`  
**Scope:** Audit and implementation plan. No ingestion or UI behavior has been changed yet.

## Desired result

Hermes should keep a dependable, current feed of real upcoming events from every approved source. Source failures must be visible to operators, isolated from other sources, and safe to retry. The Events page should show the latest persisted data, explain its freshness, and never claim that a failed refresh means there are no events.

The initial approved-source inventory in this repository is WUSA's public iCalendar feed, University of Waterloo's events listing, and configured public club Instagram accounts. Confirm additional desired sources with the product owner before adding adapters; “all sources” cannot be inferred from the current registry alone.

## What is wrong today

| Area | Confirmed code finding | Effect |
| --- | --- | --- |
| Source coverage | `src/ingestion/sources/registry.ts` registers WUSA ICS, one UW listing page, and Instagram profiles. `instagram-accounts.ts` contains only `uwcheeseclub`. A `wusa-clubs` adapter exists under `src/lib/events/adapters/` but is not registered in live ingestion. | Most clubs and any other intended feeds are absent. The legacy adapter should be assessed before deciding whether it belongs in production. |
| Source completeness | The UW adapter parses cards from one HTML response and has no pagination or detail-page enrichment. WUSA ICS requires a per-event `URL`. | Later listing pages and valid feed entries without that field can be missed. Parsing also relies on fragile page markup. |
| Instagram | Each configured profile runs a synchronous Apify actor request. `fetch-apify.ts` has no explicit timeout or bounded retry, and `instagram-public.ts` recognizes a narrow set of caption date formats. | A slow actor can hold the whole run; valid announcements can be rejected or assigned the wrong date. Apify credentials and quotas are deployment dependencies. |
| Scheduling | `vercel.json` schedules `/api/cron/refresh-events` once daily at 13:00 UTC. The five minute freshness window in `refresh-canonical-events.ts` is only process-local. | “Five minutes” does not mean the feed updates every five minutes. Runs are not coordinated across server instances. |
| Request path | `load-events.ts` starts an unawaited refresh after reading a nonempty store. The current response remains stale, there is no client update, and that promise is not attached to a supported post-response lifecycle. | A visit does not reliably produce or display newly ingested events. An empty store instead makes the visitor wait for the entire ingestion run. |
| Run health | The refresh coordinator marks a run fresh if **any** source succeeded and persistence had zero failures. A source that parsed zero events counts as succeeded. The cron handler returns success without checking per-source failures. | Partial or unexpectedly empty runs can look healthy and stop retries until the next window; monitoring cannot distinguish a healthy run from silent data loss. |
| Reconciliation | Persistence upserts candidates by source fingerprint, but there is no source-record/run table, `lastSeenAt`, cancellation state, or reconciliation of missing records. Cross-source deduplication happens only within one run. | Removed/cancelled events remain visible until their stored end time. The same event can appear twice if a second source discovers it in a later run. |
| Feed UX | The repository filters expired events, but the “Starting soon” carousel is simply the first five records; no near-term cutoff or relative time appears. The empty state says “No events in this corner yet” for both an empty filter and an empty/broken store. | Students can see distant events labelled as starting soon and receive a misleading explanation when ingestion is unhealthy. Source freshness is not surfaced despite `PRODUCT.md` requiring it. |

These are code findings, not proof that the deployed database or live sites currently have these exact failures. A read-only production diagnostic pass is required before assigning severity to each source.

## Recommended approach

Use scheduled ingestion as the primary refresh mechanism, with database-backed run and source state. Keep page requests fast and read-only. Preserve stable event IDs during migration so saves, RSVPs, and interactions remain linked. Source-specific parsers continue to normalize into one validated candidate contract; reconciliation happens after source fetches and before publishing canonical records.

A page-triggered refresh with a shorter process-local window is simpler, but still depends on traffic and server lifetime. A new third-party workflow system would add operations and cost before the existing cron, Prisma, and source adapters are made reliable. Start with the current stack and add an external worker only if actual execution duration or scheduler limits require it.

## Implementation sequence

### 1. Establish a source contract and baseline

- List every intended source with owner, URL/API, access method, content type, paging behavior, rate limit, expected update cadence, and whether it provides cancellations. Decide explicitly whether WUSA Clubs is a live source. Store enabled sources in one reviewed registry/configuration, with stable source IDs and per-source settings.
- Run a **read-only** diagnostic against each source and the current database: HTTP status/content type, item count, accepted/rejected counts by reason, oldest/newest upcoming event, duplicate examples, and last successful run. Do not log credentials, full captions, or private payloads. Record the baseline beside the implementation work.
- Check the current deployment's `DATABASE_URL`, `DIRECT_URL`, `CRON_SECRET`, `APIFY_TOKEN`/`APIFY_API_TOKEN`, scheduler entitlement, and function duration through secret-preserving checks. Treat absent credentials as an explicit source failure.
- Add representative fixtures from each approved source and contract tests that detect zero-card pages, changed selectors, pagination, missing optional fields, timezone changes, and malformed records.

### 2. Make adapters complete and bounded

- Update `src/ingestion/sources/uwaterloo-html.ts` to traverse all relevant listing pages within a configured page/time budget; enrich event details where the listing omits required fields. A structural parser failure must not be reported as a healthy empty source.
- Update `src/ingestion/sources/wusa-ics.ts` to use a safe source-backed fallback URL when an event has no `URL`; correctly handle recurring instances, cancellations, all-day events, and timezone rules before promoting records. Keep UID plus recurrence identity stable.
- Expand `src/ingestion/sources/instagram-accounts.ts` only with approved club accounts. Bound Apify calls with timeout, retry/backoff, concurrency and result limits; parse explicit dates conservatively and quarantine ambiguous captions for review rather than inventing an event time. Add fixtures for year rollover, Toronto timezone, relative dates, reels/carousels, and missing fields.
- Keep each source independent. A timeout, rate limit, parser drift, or missing token must produce a structured source status and must not prevent other sources from persisting.

### 3. Persist run state and reconcile safely

- Add Prisma migrations for `IngestionRun`, `SourceRun`, and `EventSourceRecord` (or equivalent) with run status, timestamps, source identity, counts, last seen time, source URL, source fingerprint, and canonical event link. Add a lease/lock so overlapping cron invocations cannot race across instances. Backfill links for existing rows before changing identity logic.
- Make `run-ingestion.ts` apply per-source time budgets, explicit outcomes (`success`, `partial`, `failed`, `suspicious-empty`), and bounded candidate URL checks. Persist source results even if another source fails. A source is healthy only when its fetch, parse, validation, and persistence checks complete; define expected-count thresholds from baseline data, not arbitrary global numbers.
- Deduplicate across **stored source records**, not only candidates in the current run. Match strong IDs first, then normalized title/start/place with a documented tolerance and manual-review path for ambiguous matches. Choose a canonical record by source quality; keep every source record as provenance. Never merge solely because titles match.
- Mark a source record missing only after a **complete, healthy** run for that source. Require a grace period or consecutive healthy misses before hiding a canonical event; never delete on a failed, partial, or suspicious-empty run. Handle explicit cancellation immediately. Preserve event IDs and linked user activity during merges.
- Write run completion and freshness to the database. A failed classification should be recorded and retried independently of source fetching; it should not falsely make source data fresh or prevent valid events from appearing.

### 4. Schedule and serve fresh data

- Change `vercel.json` from daily to an **hourly target** (or the fastest sustainable cadence supported by the actual deployment plan and provider quotas). Use a secure, idempotent cron endpoint. If a full run exceeds the platform duration, split sources into separately scheduled bounded jobs or move ingestion to a worker; do not rely on a longer page request.
- Make `/api/cron/refresh-events` report an appropriate non-2xx status for a completely failed run, include safe per-source outcomes, and expose a distinct partial-success state. Record every run durably and alert on missed runs, repeated source failures, suspicious zero counts, and freshness older than the agreed service target.
- Make `/events` and `/events/[id]` read the canonical store and its published freshness status. Remove the unawaited page refresh. If a manual refresh is needed for operators, put it behind an authenticated endpoint and the same database lock.
- Use a short page data lifetime or explicit client polling only if students need updates while keeping the tab open. Set the cadence deliberately and verify it with this installed Next.js version's `node_modules/next/dist/docs/` guidance. The scheduler must keep data current even with zero visitors.

### 5. Reconcile the Events page

- Keep the feed ordered by start time, but define “Starting soon” by an actual near-term window and exclude events already underway unless labelled accordingly. Decide how all-day events appear.
- Distinguish “no upcoming events,” “no matches for this filter,” and “the feed is temporarily unavailable.” Show the last successful update time and source link/provenance on cards or detail pages, with accessible wording.
- Keep filters/counts in sync with the visible canonical set. Verify mobile and keyboard flows, source links, Toronto date/time formatting, loading behavior, and the event detail page after merges or cancellations.

## Verification and rollout

1. Add focused unit tests for each source fixture, source outcomes, cross-run deduplication, safe missing-record handling, and stable ID migration. Add an integration test covering one source failure alongside another successful source and checking the resulting Events page data.
2. Run `npm test`, `npm run lint`, and `npm run build`; fix any failures caused by the change. Use the installed Next.js docs before writing route/page code because this project uses Next 16 with changed conventions.
3. Run a dry-run diagnostic against live sources, then one controlled ingestion in staging. Compare source counts and sample events with source pages; verify no duplicate, expired, cancelled, or fictional items are published.
4. Deploy migrations before switching readers/writers. Backfill source records, check save/RSVP continuity, enable the new schedule, and observe at least two scheduled cycles. Keep the prior canonical rows available for rollback until reconciliation is verified.
5. Acceptance: each approved source has a recorded health result; a single source failure leaves other sources available; an unexpectedly empty response cannot erase events or count as a healthy refresh; repeated runs are idempotent; duplicates across days resolve to one canonical event; cancelled/removed events disappear only under the stated policy; the page accurately shows feed and freshness state. Measure actual end-to-end freshness after deployment and adjust the hourly target if provider or platform limits require it.

## Decisions needed before implementation

- Confirm the full approved source list, especially whether WUSA Clubs should be ingested and which additional Instagram accounts matter.
- Confirm the desired freshness target and allowed Apify spend. The plan uses hourly as a starting target, not a guarantee until deployment limits and live run duration are measured.
- Confirm the policy for ambiguous Instagram announcements and for events that disappear from an otherwise healthy source.
