# Automatic event geocoding

Approved direction: preserve source coordinates, resolve known venues, geocode
unfamiliar locations during ingestion, persist results, and reject ambiguous or
outside-city matches. Page rendering performs no external location lookups.

## Implementation

1. Add a private `event_geocodes` table linked to canonical events. Store the
   input fingerprint, normalized query, coordinates, result name, provenance,
   status, retry date, and check timestamp. Reuse provider results across events
   with the same query. Changed location inputs invalidate old results.
2. Preserve explicit source GEO/microdata/JSON-LD coordinates through normalized
   candidates and publication. Coordinates must be a finite valid pair.
3. Resolve source/registry data before external search. Check points against
   the City of Waterloo's public boundary polygon. Never use a city centroid as
   an event location.
4. Add one sequential geocoding stage to the existing worker, respecting source
   scope, dry-run, and the processing deadline. Add `--backfill-locations` for
   existing active events without collecting social posts or running AI.
5. Use configurable Nominatim search (`GEOCODING_BASE_URL`) with an identifying
   user agent (`GEOCODING_USER_AGENT`). The low-volume public default uses a
   single active worker, database advisory locking, caching, and at least 15.1
   seconds between completed requests (no more than four per minute). Do not
   expose a generic address-search API or perform browser-side geocoding.
6. Cache unresolved results for seven days, transient failures for one hour,
   and respect provider throttling before retry. Leave event publication usable
   when geocoding fails. Ambiguous matches remain unlocated.
7. The map joins saved resolutions to its event snapshot and preserves the
   registry fallback. Keep assigned venue text visible and include OSM attribution.
8. Validate parsing, scope, stale-cache protection, ambiguity, throttling,
   source-coordinate persistence, dry-run isolation, and CLI integration. Apply
   the additive migration only after checks; backfill existing events and verify
   the live map API.

References: https://operations.osmfoundation.org/policies/nominatim/ and
https://nominatim.org/release-docs/latest/api/Search/ . Public-service use is for
small cached event-location lookups, not distributed or bulk address searching.
Configure a hosted/self-hosted compatible endpoint if volume grows.

Boundary source: City of Waterloo public GIS, Public_Base/MapServer/0, retrieved
November 14, 2026; only geometry is included in the checked-in JSON.

## Verification and rollout

- Applied the migration to isolated Postgres and verified source-coordinate
  persistence, shared-query caching, RLS, and denied anonymous table access.
- 413 unit tests passed; one location integration test passed separately.
  Production build, TypeScript, targeted lint, and whitespace checks passed.
- Applied `20261114150000_event_geocodes` to the connected database.
- Completed the current-event backfill: 54 resolved, 24 outside Waterloo,
  21 unresolved, zero failures (99 active events at completion).
- Fixed tenant-plus-address searches by using the civic address; both current
  Revive events now resolve to the same building. Extract UW Drupal event-map
  coordinates only from the event location's own map, excluding footer data.
- Restarted the local dev server to load the generated Prisma model. Verified
  the live API includes six located entries out of nine remaining today,
  including both Revive events; the three remaining entries lack a precise venue.
