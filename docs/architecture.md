# Project Hermes Architecture

## Event Data Flow

Hermes uses a canonical Prisma-backed event store:

1. `src/ingestion/` fetches the public WUSA ICS feed and UW Events HTML page.
2. Source parsers normalize and validate candidates before deduplication.
3. Ingestion probes event source URLs before persistence. Confirmed `404` and
   `410` pages are rejected, while transient failures remain retryable.
4. The canonical refresh coordinator upserts candidates into Postgres through
   Prisma using stable source fingerprints and content hashes.
5. New or changed events are classified with structured OpenAI output when
   configured. A deterministic classifier is persisted as the fallback.
6. `/events`, `/events/[id]`, save validation, and RSVP validation read through
   the canonical event repository.

The `/events` browse page performs a best-effort refresh before reading
canonical events. A process-local freshness window, five minutes by default,
prevents repeated source requests and coalesces concurrent refreshes. If a
refresh fails, Hermes serves the last available canonical data rather than
breaking discovery. When `DATABASE_URL` is absent or the database is
unavailable, development reads fall back to mock events.

Mock events are development and test fixtures only. Production never exposes
them, and mock cards do not display source links because they are illustrative
rather than source-backed.

`npm run ingest:events` forces the same canonical refresh pipeline regardless
of freshness. It reports source, deduplication, persistence, and classification
counts without exposing raw source payloads or provider errors.

Source fetching and parsing remain isolated in `src/ingestion/`; pages and
user-action handlers depend only on the event repository.
