# Canonical Event Refresh Design

## Goal

Make the Hermes event pipeline work end to end and ensure `/events` loads recent
event data without fetching public sources or calling OpenAI on every request.

## Scope

This change will:

- Fetch the live WUSA ICS feed and UWaterloo Events HTML page.
- Validate, normalize, and deduplicate event candidates.
- Upsert canonical events through Prisma.
- Classify new or changed events using OpenAI when configured.
- Persist deterministic fallback classifications when OpenAI is unavailable or
  returns invalid output.
- Refresh stale canonical data when `/events` loads.
- Reuse the same refresh coordinator from the ingestion CLI.
- Serve existing canonical data if a refresh fails.

This change will not:

- Add new ingestion sources.
- Scrape individual UWaterloo event detail pages.
- Delete or mark events missing from a source as stale.
- Run OpenAI during ordinary event reads when canonical data is fresh.
- Change the event-card UI.

## Architecture

### Canonical Refresh Coordinator

A server-only refresh coordinator will own the complete ingestion operation:

1. Check when the most recent successful refresh completed.
2. Return immediately when data is less than five minutes old.
3. Reuse an in-flight refresh promise when concurrent requests arrive.
4. Fetch and normalize all registered live sources.
5. Deduplicate normalized candidates.
6. Upsert candidates using the Prisma event persistence repository.
7. Classify eligible persisted events.
8. Record the successful refresh time only after persistence completes without
   failures.

The freshness timestamp and in-flight promise will be process-local. This is
appropriate for the current deployment stage and prevents repeated work within
one running app instance. A future distributed deployment can replace this
state with a database-backed ingestion-run record or distributed lock.

### Page Loading

The `/events` page will call the refresh coordinator before reading events from
the canonical repository.

- A fresh canonical store adds no live-source request to page loading.
- A stale canonical store waits for one refresh so the rendered page includes
  current data.
- A failed refresh does not break the page. The page reads and serves the last
  available canonical events.
- When `DATABASE_URL` is absent, refresh is skipped and the existing mock-event
  fallback remains available.

Event detail pages will continue reading canonical data without triggering a
refresh. The browse page is the refresh boundary.

### Persistence

The existing Prisma persistence repository remains responsible for idempotent
event upserts:

- `sourceFingerprint` identifies the source record.
- Stable event IDs are derived from the fingerprint.
- A classification-relevant content hash identifies changed event content.
- New or changed events receive `classificationStatus = pending`.
- Unchanged events retain their current classification.

Persistence failures remain isolated per event. A refresh with any persistence
failure is not marked successful, allowing a later request or CLI run to retry.

### Classification

A classification orchestrator will process persisted events whose status is
`pending` or `retry`.

- At most two classifier calls run concurrently.
- OpenAI receives only approved public event fields.
- Structured output is validated using the existing Zod classification schema.
- Valid OpenAI output is persisted with status `classified`.
- Missing API keys, provider failures, timeouts, and invalid output produce and
  persist a deterministic fallback classification with status `fallback`.
- Classification failures do not discard successfully persisted event data.
- Unchanged events with a current classification are skipped.

The application reads only persisted classifications. Page requests never call
OpenAI directly.

### CLI

`npm run ingest:events` will use the same refresh operation with freshness
bypassed, so manual runs always attempt a live refresh.

The CLI will:

- Report source, deduplication, persistence, and classification counts.
- Exit non-zero when all sources fail or any persistence operation fails.
- Keep classification provider failures non-fatal because fallback
  classification is expected behavior.
- Avoid printing raw source payloads, credentials, or provider errors.

## Error Handling

- Source failures remain isolated so one source cannot block another.
- Invalid candidates remain structured rejections.
- Prisma upsert failures remain constrained to event IDs and error codes.
- Refresh failures are caught at the page boundary and canonical reads proceed.
- The refresh coordinator clears its in-flight state after success or failure.
- Only a refresh with successful persistence advances the freshness timestamp.

## Testing

Tests will prove:

- The CLI supplies the Prisma persistence repository.
- The refresh coordinator skips fresh data and coalesces concurrent refreshes.
- A forced CLI refresh bypasses freshness.
- New and changed events are classified.
- Missing OpenAI configuration persists fallback classifications.
- Unchanged classified events are skipped.
- Persistence failures prevent the refresh from being marked successful.
- Page-load refresh failures do not prevent canonical events from rendering.
- Existing ingestion, repository, and classification tests continue to pass.

## Operational Notes

- `DATABASE_URL` is required for canonical refresh and reads.
- `OPENAI_API_KEY` is optional because fallback classification is always
  available.
- The five-minute freshness window limits public-source traffic while keeping
  the browse page current enough for campus discovery.
- A scheduled ingestion workflow remains a future improvement; page-load
  refresh and the CLI are sufficient for the current deployment stage.
