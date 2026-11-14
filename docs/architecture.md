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
breaking discovery. If `DATABASE_URL` is absent or the database is unavailable,
the event repository returns no events instead of displaying fictional data.

`npm run ingest:events` forces the same canonical refresh pipeline regardless
of freshness. It reports source, deduplication, persistence, and classification
counts without exposing raw source payloads or provider errors.

Source fetching and parsing remain isolated in `src/ingestion/`; pages and
user-action handlers depend only on the event repository.

## Waterloo event map

`/map` reads public, uncached snapshots from `/api/map`. Snapshots contain today's
ongoing/upcoming canonical events, resolved venue coordinates, and aggregate
Hermes **Going** counts. Today uses `America/Toronto`; ended events disappear
without requiring another RSVP. Category, free-food, and Happening now filters
derive the map, heat, venue groups, and companion list from the same snapshot.

`src/lib/events/map-venues.ts` is the launch venue registry. Coordinates were
verified against the point layer linked by the University of Waterloo's official
campus map on November 14, 2026. Each entry records its source feature URL. Keep
stable IDs, verify new names/aliases and city membership before adding a point,
and retain original event room text. Registry entries include known outside-city
campuses so their events are excluded rather than misplaced. Unknown physical
venues and explicitly online events remain labeled in the list without heat.
Ingestion also resolves unfamiliar venues automatically: source coordinates first,
known venues and the official UW building index next, then cached address/venue
lookup. Private `event_geocodes` rows hold input fingerprints, coordinates,
provenance, and retry state. The map reads these rows without calling providers.
Changed location inputs invalidate saved pins; ambiguous results stay unlocated.
The checked-in official City of Waterloo polygon excludes outside-city matches.
The registry includes The Culinary Studio and RIM Park using map links published
by the venue and City of Waterloo. For city-only or placeholder location fields,
an unambiguous registered venue in the description may supply the map location.
An explicit assigned location is preserved even if its coordinates are unknown;
the UI labels that state “Not on the map yet,” not “awaiting a venue.” Verified
Kitchener venues such as Cowan Recreation Centre and Builders Club remain outside
the City of Waterloo view even when imported city text is incomplete or incorrect.

MapLibre renders an OpenFreeMap Positron basemap (Dark in the app's dark theme)
with provider attribution. Its
native heat layer weights each venue by the sum of Going RSVPs across its visible
events. A fixed visual scale is used across filters, and zero-count pins remain
visible. Exact counts appear in the list/preview. Counts are planned attendance,
not check-ins or a deduplicated population estimate across different events.
The heat layer uses broad, overlapping blue/cyan/green/yellow/orange/red patches;
small gatherings remain visible and larger Going counts produce warmer cores.
Heat sits below street labels, and the initial camera frames located events once
without recentering on subsequent RSVP updates. A zero-RSVP notice distinguishes
an empty heat layer from a broken map.
The discovery interface uses a compact city/date heading, grouped filters,
source-image thumbnails, readable Going counts, and separate unlocated results.
On mobile the map keeps its height independently of the collapsible event list.
Theme changes rebuild the native map layers using the latest event snapshot.

Apply `supabase/migrations/20261114000000_create_event_map_revision.sql` to enable
realtime invalidation. It publishes a singleton `event_map_revision` row that
changes after RSVP writes; public clients can only read it. The existing RSVP
table stays private under its existing ownership policies. No attendee identity
is included in a snapshot or revision notification. Canonical count aggregation
deduplicates superseded IDs and paginates RSVP reads to avoid row-cap undercounts.
When a user has responses on merged IDs, their latest response wins, so a newer
cancellation or Interested response cannot be overridden by an old Going row.

The client refetches authoritative snapshots after revision updates, its own
successful RSVP, reconnection/foregrounding, local midnight, and every 30 seconds
while visible. Normal connected RSVP propagation targets five seconds. The UI
only labels results Live after confirming that the revision source is readable;
without the migration or a working subscription it uses the labeled 30-second
refresh. The revision singleton and full-snapshot refresh are deliberate launch
simplifications; replace them with per-event signals/patches only if measured
write contention or request traffic justifies it.

Event-store outages return 503 rather than a fictional empty day. Count outages
produce null counts and withhold heat while preserving event locations. Failed
refreshes retain the previous snapshot with a last-updated message. A failed
basemap preserves the accessible event list. External source freshness still
depends on the existing ingestion workers.
Event inclusion follows persisted start/end ranges. Recurring source series must
provide individual occurrences for precise day-by-day schedules; the map does not
invent recurrence rules. Previews display full dates for the stored range.
