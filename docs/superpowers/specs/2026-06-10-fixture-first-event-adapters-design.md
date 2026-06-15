# Fixture-First Event Adapters Design

## Goal

Build a deterministic event-ingestion foundation for Project Hermes using saved
source fixtures. The framework will keep source-specific parsing isolated while
normalizing records into a stable shared contract.

Deliverable 2.1 will cover three public event sources:

- UWaterloo Events
- WUSA Events
- clubs.wusa.ca

Live fetching, scheduled ingestion, and database writes are outside this
deliverable.

## Architecture

Each source adapter owns its source-specific parsing and normalization logic.
Shared ingestion code depends only on the adapter interface and normalized event
contract.

An adapter exposes:

- `parseRaw`: converts a saved source fixture into source-specific records.
- `normalize`: converts one source-specific record into a normalized Hermes
  event candidate or a structured rejection.
- `sourceFingerprint`: returns a deterministic identifier used to recognize the
  same source event across repeated ingestion runs.

The framework will not use a generic HTML parser that attempts to understand all
sources. Source page structures and semantics differ, so keeping adapters
separate makes changes and failures easier to isolate.

## Contracts

The shared normalized event candidate will contain the fields required by the
current `HermesEvent` domain model, plus ingestion metadata needed before a
database-backed canonical model exists:

- Source identifier
- Source event URL
- Source fingerprint
- Title
- Description
- Organizer or club name
- Start and end time
- Location name
- Optional building code
- Tags
- Optional image URL
- Free-food indicator

Parsing and normalization failures will be returned as structured results rather
than silently discarded. Rejections will include the source, record identifier
when available, and a non-sensitive reason suitable for tests and future
observability.

## Fixtures

Each adapter will have a representative saved fixture checked into the
repository. Fixtures should be small enough to review while covering:

- A complete valid event
- An event with optional fields omitted
- A malformed or incomplete event that must be rejected

Fixtures are test inputs only. They must not contain authentication data,
personal data, or unnecessary copies of entire source pages.

## Adapter Subtasks

### Adapter Framework

Create the shared adapter interfaces, normalized event contract, structured
result types, and test command. Use Vitest for TypeScript test execution and
support for the repository's existing path aliases.

### UWaterloo Events Adapter

Implement and test parsing, normalization, and deterministic fingerprints using
a saved UWaterloo Events fixture.

### WUSA Events Adapter

Implement and test parsing, normalization, and deterministic fingerprints using
a saved WUSA Events fixture.

### clubs.wusa.ca Adapter

Implement and test parsing, normalization, and deterministic fingerprints using
a saved clubs.wusa.ca fixture.

Each subtask will be independently verified and committed.

## Data Flow

1. A test loads a saved fixture.
2. The source adapter parses it into source-specific records.
3. The adapter normalizes each record.
4. Valid records return normalized event candidates with stable fingerprints.
5. Invalid records return structured rejections.
6. Tests verify observable normalized values, rejected records, and fingerprint
   stability.

Future live-fetching code will supply raw source content to the same adapters
without changing their parsing or normalization contracts.

## Error Handling

- Missing required fields produce structured rejections.
- Malformed dates produce structured rejections.
- Optional fields use explicit fallback values or remain absent.
- Adapter errors must not include fixture contents or raw event payloads in
  logs.
- One malformed record must not prevent other records in the fixture from being
  normalized.

## Testing

Tests will cover:

- Valid fixture parsing
- Optional-field handling
- Missing required fields
- Malformed dates
- Stable source fingerprints
- Isolation of malformed records

Every subtask must pass:

- `npm test`
- `npm run lint`
- `npx tsc --noEmit --pretty false`
- `npm run build`

## Out Of Scope

- Live HTTP fetching
- Scheduled ingestion jobs
- Supabase or Postgres persistence
- Cross-source duplicate detection
- Search, radius filters, and club pages
- Ingestion dashboards or alerts
