# Live Event Ingestion Design

## Goal

Fetch public UW-area event data, normalize it into Hermes event candidates,
validate it, deduplicate it, and produce a verified non-persistent run result.
The result contract must be suitable for a later Prisma persistence sink.

## Scope

The first live ingestion milestone covers:

- WUSA's public iCalendar feed at `https://wusa.ca/events/?ical=1`.
- The University of Waterloo's public events listing at
  `https://uwaterloo.ca/events/`.
- Safe HTTP fetching with timeouts, response-size limits, and content-type
  validation.
- Source-specific parsing, shared Zod validation, cross-source deduplication,
  structured rejections, and a command-line runner.

Database models, database writes, scheduling, authenticated sources, and
third-party/social scraping are deliberately deferred.

## Architecture

`src/ingestion/sources/` owns source-specific parsing. Each source implements a
small `IngestionSource` contract containing its identifier, public URL,
accepted content types, and parser. Parsers return the existing
`NormalizationResult` contract so malformed records are isolated and reported.

`src/ingestion/fetch-source.ts` retrieves only a configured source URL. It
applies a timeout, checks the response status and content type, enforces a
maximum response size, and returns text without logging raw payloads.

`src/ingestion/run-ingestion.ts` coordinates sources independently. It validates
normalized candidates with Zod, accumulates structured source results, and
continues when one source fails. It then runs deterministic deduplication over
all accepted candidates.

`src/ingestion/cli.ts` prints the structured run result as JSON. It does not
read secrets or write to the database.

## Data Contracts

The existing `NormalizedEventCandidate` remains the normalized source contract.
A Zod schema validates its runtime shape before a candidate can leave the
pipeline.

An ingestion run contains:

- Start and completion timestamps.
- Per-source status, counts, accepted candidates, structured rejections, and a
  non-sensitive error code when a source fails.
- Deduplicated event candidates.
- Duplicate records describing which source fingerprints were retained and
  discarded.

The later Prisma sink will consume this run result. It will not need to know
about HTTP fetching or source-specific parsing.

## Source Behavior

### WUSA ICS

Parse `VEVENT` records, including folded lines and escaped iCalendar text.
Use UID as the source identifier. Extract title, description, start/end,
location, categories, URL, organizer, and image attachment. Events with missing
locations or organizers receive explicit non-empty fallbacks because the WUSA
feed legitimately omits those fields.

### UW Events HTML

Parse event teaser cards from the public listing. Use the canonical event URL
as the source identifier. Extract title, description, displayed date text,
tags, and image when available. The listing does not consistently include
organizer or location, so candidates use explicit source-level fallbacks.

## Deduplication

First deduplicate exact source fingerprints. Then deduplicate cross-source
records by a normalized signature of title, start time, and location. Source
registry order determines which duplicate is retained, making output
deterministic and allowing future source-priority tuning.

## Error Handling

- One malformed event does not stop its source.
- One failed source does not stop the ingestion run.
- Fetch errors expose only source ID and a constrained error code.
- Raw source payloads, emails, authentication values, and event descriptions
  are never logged as errors.
- Validation failures become structured `invalid-candidate` rejections.

## Testing

Focused fixtures cover representative UW HTML and WUSA ICS without copying
entire live pages. Tests cover:

- ICS parsing, folded lines, escaped text, timezone conversion, and fallbacks.
- UW listing parsing and malformed date rejection.
- Zod candidate validation.
- Fetch timeout/status/content-type/response-size handling.
- Exact and cross-source deduplication.
- Partial-source failure behavior in the full pipeline.

Verification commands:

- `npm test`
- `npm run lint`
- `npx tsc --noEmit --pretty false`
- `npm run build`
- `npm run ingest:events`

## Future Prisma Persistence

The next milestone should add a persistence sink behind the ingestion result,
with canonical event, source-record, and ingestion-run models. It should upsert
by source fingerprint, preserve source provenance, and keep database concerns
out of source parsers and fetch code.
