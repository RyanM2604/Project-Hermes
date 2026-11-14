# Waterloo Event Map Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task inline. Apply engineering-suite-ponytail:ponytail in full mode throughout. Steps use checkbox (`- [ ]`) syntax for tracking. Do not delegate unless requested.

**Goal:** Replace `/map` with today's Waterloo events, live Going counts, a weighted heatmap, and an accessible companion list.

**Architecture:** Reuse the canonical event repository, server-side RSVP aggregation, existing Supabase clients, and RSVP button. Resolve locations through a checked-in venue registry. Serve public aggregate snapshots; use one identity-free database revision row as a realtime invalidation signal, with periodic recovery.

**Tech Stack:** Existing Next.js 16, React 19, TypeScript, Prisma, Supabase, Vitest, and CSS; add only `maplibre-gl` for map rendering and native heat layers. Use the OpenFreeMap Liberty basemap with its attribution visible.

**Specification:** `docs/superpowers/specs/2026-11-14-waterloo-event-map-design.md` (approved in conversation).

---

## Constraints and decisions

- Ponytail full mode is explicitly requested. No map wrapper, geocoding service, new state library, generalized provider layer, location tracking, or venue management UI.
- A versioned TypeScript array is the persistent venue registry for launch. It fulfills stable IDs, aliases, verified coordinates, and provenance without a new Prisma table or ingestion rewrite. Add entries when real incoming venues need them; unknown venues remain unlocated.
- The public revision row is a notification, not a materialized count cache. Authoritative counts remain in the existing aggregation flow.
- Existing working-tree changes predate this work. Preserve them. Stage only reviewed map-related hunks; never blanket-stage the repository.
- Before implementation, re-read relevant `node_modules/next/dist/docs/` guides. Already inspected: route handlers and lazy loading. Do not use `ssr: false` in a Server Component.
- Implement in the existing project conventions. Read the Impeccable skill before map UI work because this is a new frontend surface. No GSAP animations are needed.
- No external database migration, provider account creation, paid subscription, or deployment is part of preparing the code. Validate the migration locally; apply to an external environment only within established authorization.

## File ownership

Create:

- `src/lib/events/map.ts`: public map types, Toronto day membership, filtering, venue grouping, GeoJSON construction.
- `src/lib/events/map-venues.ts`: verified, versioned venue entries and exact alias/building resolution.
- `src/lib/events/map-snapshot.ts`: server-only snapshot assembly and explicit availability state.
- `src/lib/events/__tests__/map.test.ts`: meaningful temporal, location, grouping, and zero-weight checks.
- `src/lib/events/__tests__/map-snapshot.test.ts`: public snapshot and failure contract.
- `src/lib/events/__tests__/rsvp-summary.test.ts`: canonical aggregation and unavailable-count checks.
- `src/app/api/map/route.ts`: public no-store JSON endpoint.
- `src/components/map/EventMap.tsx`: client state, filters, list, preview, and refresh lifecycle.
- `src/components/map/MapCanvas.tsx`: MapLibre initialization, source/layer updates, pin selection, cleanup.
- `supabase/migrations/20261114000000_create_event_map_revision.sql`: public identity-free notification row and RSVP trigger.

Modify:

- `src/app/map/page.tsx`: replace placeholder, obtain authentication state, render client map shell.
- `src/app/hermes.css`: map layout and responsive styles using current tokens.
- `src/components/events/RSVPButton.tsx`: optional success callback; preserve all current callers.
- `src/lib/events/rsvp-summary.ts`: optional strict failures, complete row retrieval, reuse alias deduplication.
- `src/lib/events/repository.ts` and its current tests: optional strict availability handling and upper start-time bound.
- `package.json`, `package-lock.json`: one mapping dependency.
- `docs/architecture.md`: map data flow, venue maintenance, realtime setup, known limits.

## Task 1: Venue registry and shared map model

- [ ] Read the current `HermesEvent`, location helpers, filters, repository, RSVP aggregation, and existing Vitest configuration completely. Reuse `filterEventsByTag` and existing labels; do not reuse feed links that navigate away from `/map`.
- [ ] Create the shared contracts in `map.ts`:

```ts
import type { HermesEvent } from "@/types/event";
export interface MapVenue {
  id: string;
  name: string;
  aliases: readonly string[];
  buildingCodes: readonly string[];
  coordinates: readonly [number, number]; // longitude, latitude
  city: "Waterloo" | "outside";
  verifiedFrom: string;
}
export type MapEvent = HermesEvent & {
  venue: MapVenue | null;
  goingCount: number | null;
  locationStatus: "located" | "unlocated" | "online";
};
export interface MapSnapshot {
  events: MapEvent[];
  serverTime: string;
  refreshedAt: string;
  countsAvailable: boolean;
}
```

- [ ] Verify coordinates and city membership against official UW campus maps for supported buildings and authoritative address/map records for off-campus venues represented in real events. Record a source URL for every entry. Seed all currently supported building codes including EC5; do not invent coordinates or build a bulk geocoding pipeline.
- [ ] Write a resolver in `map-venues.ts`: normalize case/whitespace, match exact curated aliases, then recognized building-code tokens. Resolve the venue from `locationName` before falling back to `buildingCode`; refuse contradictory venue/city evidence. Preserve original room/location text. Online/virtual labels resolve as online. Verified outside-city venues are excluded; unknown venues remain unlocated.
- [ ] Use `Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date)` to create a canonical `YYYY-MM-DD` key. Do not depend on output ordering or hardcode UTC offsets.
- [ ] Define Today membership as `end > now && localDate(start) <= localDate(now)`. The repository supplies active/future events only. Define Happening now as `start <= now && end > now`. Preserve `endTimeEstimated` in previews.
- [ ] For a coarse database bound, use UTC now plus 48 hours as `startsBefore`; filter exactly by Toronto date afterward. This is a query bound, not a day boundary, and safely covers both daylight-saving transitions.
- [ ] Add one compact suite covering: an ongoing event from yesterday; an event ending exactly now; next-day exclusion; spring/fall daylight-saving dates; a non-Toronto browser timezone; exact venue alias vs unknown venue; online/out-of-scope behavior; zero-count pins; two events sharing a venue. Run `npm test -- src/lib/events/__tests__/map.test.ts`, first to expose the missing behavior, then after implementation. Expect all cases to pass.
- [ ] Build venue-grouped GeoJSON from filtered events. One point per venue carries `venueId`, summed `going`, and event count. Unknown counts yield no heat contribution. Group IDs select all matching events in the list/preview.

## Task 2: Reliable snapshot and count aggregation

- [ ] Extend repository `getEvents` options with `throwOnUnavailable?: boolean` and `startsBefore?: Date`. Default callers retain current behavior; the map opts into throwing on missing configuration or unavailable database. Add the optional Prisma condition `startTime: { lt: startsBefore }` while retaining canonical-event and end-time conditions. Update `EventReadClient` types and existing tests accordingly.
- [ ] Extend `loadEventGoingCounts(eventIds, options?: { throwOnUnavailable?: boolean })`. In its existing catch block, rethrow when strict mode is requested; otherwise preserve the current `{}` fallback for existing pages. Do not copy aggregation into the map module.
- [ ] Retrieve all matching RSVP rows with deterministic pagination instead of accepting Supabase's default row cap. Use stable `id` ordering and `.range(offset, offset + 499)` until an empty page; retain a Set of user IDs for each canonical event. Chunk event-ID filters if needed to keep request URLs bounded. Resolve superseded chains without double counting, including chains longer than one hop; detect cycles rather than looping forever.
- [ ] Add focused mocked tests for same-user canonical/alias deduplication, multi-hop aliases, two distinct users, pagination past the first batch, failure propagation in strict mode, and existing best-effort behavior. Run `npm test -- src/lib/events/__tests__/rsvp-summary.test.ts src/lib/events/__tests__/repository.test.ts` and confirm success.
- [ ] In `map-snapshot.ts`, read `getEvents({ throwOnUnavailable: true, startsBefore })`, apply Today membership, resolve locations, exclude confirmed out-of-city events, and obtain strict Going counts for included IDs. On count failure only, return `countsAvailable: false` and `goingCount: null`; never manufacture zero. Let event-store failures reach the endpoint as unavailable.
- [ ] Keep only event discovery data in the DTO; never include `user_id`, private Supabase rows, or service-role configuration. Use `serverTime` from snapshot assembly and `refreshedAt` when assembly completes. Anonymous requests receive the same aggregate data as authenticated requests.
- [ ] Add `GET /api/map`. This endpoint returns all of Today's candidate events; category/free-food/Now filters are local so all views derive from one snapshot. Query parameters are not needed in this version. Return `Cache-Control: no-store`. Return status 503 and `{ error: "Event data is unavailable right now." }` on event-store failure, without provider error details.
- [ ] Add `map-snapshot.test.ts` for valid empty data vs store outage, count failure with visible events, zero actual RSVPs, outside-city exclusion, and absence of identity fields. Run it with the other targeted tests before moving on.

## Task 3: Identity-free realtime invalidation

- [ ] Create a singleton public table and explicitly remove client writes. Core migration:

```sql
create table public.event_map_revision (
  id boolean primary key default true check (id),
  revision bigint not null default 0
);
insert into public.event_map_revision (id) values (true);
alter table public.event_map_revision enable row level security;
revoke all on public.event_map_revision from anon, authenticated;
grant select on public.event_map_revision to anon, authenticated;
create policy "Public map revision is readable"
  on public.event_map_revision for select to anon, authenticated
  using (true);

create function public.bump_event_map_revision()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  -- ponytail: one row serializes RSVP notifications; use per-event signals
  -- if measured write contention makes this unsuitable.
  update public.event_map_revision set revision = revision + 1 where id;
  return null;
end;
$$;
revoke all on function public.bump_event_map_revision() from public;
create trigger event_rsvp_map_revision
after insert or update or delete on public.event_rsvps
for each statement execute function public.bump_event_map_revision();
alter publication supabase_realtime add table public.event_map_revision;
```

- [ ] Leave `event_rsvps` RLS and publication membership unchanged. Only the identity-free revision table is subscribed to by the map. Notifications can be conservative: Interested writes may trigger a harmless refetch but never add heat.
- [ ] Validate in local Supabase or an isolated test database: migration applies; anonymous SELECT of revision works; anonymous UPDATE fails; authenticated users cannot update it; a real RSVP mutation increments revision; existing RSVP ownership rules still hold. Roll back test RSVP data. Do not claim realtime is verified without running this check.
- [ ] Document the migration as required infrastructure. If no test database exists, report that verification gap explicitly; do not silently substitute polling for the agreed realtime behavior.

## Task 4: MapLibre canvas with native layers

- [ ] Install `maplibre-gl` and inspect its installed version's integration guide/types. Import `maplibre-gl/dist/maplibre-gl.css` at the map route. No React map wrapper or separate heatmap package.
- [ ] Create `MapCanvas.tsx` as a Client Component. Initialize MapLibre once in an effect with OpenFreeMap Liberty, Waterloo center, city-scale initial zoom, built-in attribution and navigation controls. Import it dynamically from `EventMap.tsx` with `ssr: false`; never directly from the server page with that option.
- [ ] Add one GeoJSON source and these native layers, then update only source data on snapshots/filters:

```ts
map.addSource("events", { type: "geojson", data: collection });
map.addLayer({
  id: "event-heat", type: "heatmap", source: "events",
  paint: {
    "heatmap-weight": ["/", ["get", "going"], 50],
    "heatmap-intensity": 1,
    "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 11, 24, 16, 48],
    "heatmap-opacity": 0.65,
  },
});
map.addLayer({
  id: "event-pins", type: "circle", source: "events",
  paint: { "circle-radius": 7, "circle-color": "#187b70",
    "circle-stroke-width": 2, "circle-stroke-color": "#ffffff" },
});
```

- [ ] Add a deliberate transparent-to-warm `heatmap-color` ramp and low/high legend. Fifty RSVPs is an initial visual calibration constant, not a count cap. Keep it fixed between filters; test with 0, 1, 10, 50, and 200 Going counts, plus nearby venues. With counts unavailable, omit heat while retaining pins.
- [ ] Select by venue ID through `queryRenderedFeatures` on circle clicks. List buttons invoke the same selection state and optionally `easeTo` respecting reduced-motion preferences. Never inject event HTML into MapLibre popups; React renders previews.
- [ ] Listen for failed style/network/WebGL initialization and expose retry while preserving the list. Use `ResizeObserver` to call `map.resize()` when the mobile panel changes dimensions. On unmount disconnect observers, remove listeners, and call `map.remove()`; verify strict-mode remounts do not leak duplicate maps.

## Task 5: Discovery UI and existing RSVP integration

- [ ] In the server map page, obtain the user through the existing Supabase server client and pass `isAuthenticated` to `EventMap`. Public browsing remains available when signed out. Fetch initial event data in the client so endpoint failures produce the agreed recoverable state.
- [ ] In `EventMap.tsx`, keep snapshot, error/loading state, selected venue, Today/Now, selected category, and free-food toggle in local React state. Compute visible events with existing category helpers, then derive groups, GeoJSON, and list from those exact events. No duplicated map-specific tag taxonomy.
- [ ] Build a desktop map/list split and mobile collapsible panel in `hermes.css`, reusing site typography, colors, spacing, and theme tokens. Use native buttons/selects, visible focus styles, readable labels, and `aria-expanded` on the panel. Give the canvas an accessible label and provide every event through the list.
- [ ] List items show time, organizer, venue, and count; the selected-venue preview lists every filtered event at that venue, room text, estimated-end indication, event detail link, and one existing `RSVPButton` per selected event. Unlocated and online events have their own labeled list sections and never produce map points.
- [ ] Add an optional `onSuccess?: () => void` prop to `RSVPButton` and call it only after a confirmed successful write. In the map pass the snapshot refresh function. Preserve current detail-page behavior and login redirect. Wrap network failures so the control exits loading and reports its existing error state rather than leaving an unhandled rejection.
- [ ] Display different initial loading, empty results, unknown-location-only results, unavailable event data, unavailable counts, stale snapshot, and failed-basemap states. Retry actions call the same refresh/initialization path. Do not clear a successful snapshot when a later refresh fails.
- [ ] Check 390px and 1440px widths in a real browser; confirm filters, previews, attribution, focus indicators, and RSVP sign-in remain reachable. No animation library is necessary.

## Task 6: Refresh lifecycle and time boundaries

- [ ] Create one refresh effect in `EventMap.tsx`. Fetch `/api/map` with `{ cache: "no-store" }`, validate the response's top-level shape, and use an `AbortController` on unmount. Coalesce overlapping refresh requests and queue a follow-up if a signal arrives during a fetch so a late RSVP is not lost.
- [ ] Subscribe using the existing browser Supabase client:

```ts
const channel = supabase.channel("event-map-revision").on(
  "postgres_changes",
  { event: "UPDATE", schema: "public", table: "event_map_revision" },
  () => requestRefresh(),
).subscribe((status) => {
  setRealtimeConnected(status === "SUBSCRIBED");
  if (status === "SUBSCRIBED") requestRefresh();
});
```

- [ ] Derive the displayed clock from server time plus elapsed client time, preventing browser clock skew from prematurely removing events. Reevaluate filters every second while visible, but refetch snapshots only on notifications, explicit success, foreground/reconnect, and the 30-second fallback. This avoids writing a custom timezone-midnight scheduler; date-key membership naturally changes at midnight. Trigger an immediate refresh when the date key changes.
- [ ] Pause polling while hidden. On visibility regain and network reconnect, refresh and update the clock. Remove the channel, interval, browser listeners, and pending request in effect cleanup. If Supabase setup/subscription fails, preserve polling and show that live connection is unavailable.
- [ ] Show “Live” only with a healthy subscription and fresh snapshot. After a failed request or more than 45 seconds without success, show the last-updated timestamp; never imply stale counts are current. On initial setup, subscribe and then refetch to close the fetch/subscription race.
- [ ] Verify with two browser sessions: Going raises counts/heat within five seconds under healthy connection; cancellation lowers them; Interested contributes nothing; repeat status is idempotent. Disconnect, mutate in the other session, reconnect, and confirm recovery. Force a server error and verify retained data and stale status. Navigate away/back and check for duplicate subscriptions.

## Task 7: Verification and handoff

- [ ] Run targeted map, snapshot, RSVP summary, repository, and existing RSVP handler tests. Then run `npm test`, `npm run lint`, and `npm run build`. Record failures that already existed separately from failures introduced by the map; fix map regressions before claiming completion.
- [ ] In browser QA, verify spring/fall Toronto time membership with deterministic test clocks, automatic start/end changes, grouped venues, unknown locations, zero-count pins, filter agreement, mobile panel behavior, keyboard event selection, map-resource failure, and anonymous sign-in flow.
- [ ] Inspect anonymous `/api/map` JSON and realtime payloads. Confirm no user IDs, privileged keys, or raw RSVP rows appear. Confirm logged-out aggregate reads do not require widening RSVP permissions.
- [ ] Update `docs/architecture.md` with the snapshot flow, checked-in venue maintenance, required migration, native heat weighting, current external provider, aggregate-count semantics, and the healthy-connection update target. Add `ponytail:` comments for the singleton signal's contention ceiling and any deliberate full-snapshot refresh ceiling; introduce caching/broadcast fanout only after measurements justify it.
- [ ] Review only the map diff for unused abstractions/dependencies and accidental changes to pre-existing work. Commit reviewed changes with focused path/hunk staging after verification. Report what passed and any unverified infrastructure step; do not deploy automatically.

## Primary references checked during planning

- Next.js installed guides: `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` and `node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md`.
- [MapLibre native heatmap example](https://maplibre.org/maplibre-gl-js/docs/examples/create-a-heatmap-layer/) — source, heat weighting, and layer APIs.
- [OpenFreeMap quick start](https://openfreemap.org/quick_start/) — Liberty style and attribution. Its Vite-specific worker example must not be copied into Next.js.
- [Supabase Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes) — publication, subscription, and row-level security behavior.

## Plan self-review

The tasks cover the approved city scope, Toronto Today default, exact Going counts, canonical deduplication, live invalidation/recovery, verified venues, shared filters, grouped selection, accessible list, distinct failure states, and privacy. Venue data and infrastructure are validated during execution rather than fabricated in this plan. No application code, dependency installation, or external database changes were performed while writing this plan.

## Execution record — November 14, 2026

- Implemented map snapshots, verified venue registry, native MapLibre heat/pins, event previews, category/free-food/Now filters, mobile list controls, refresh recovery, and realtime invalidation.
- Added MapLibre 5.24.1; reused existing RSVP, auth, Supabase, repository, filter, and styling code.
- Extended aggregation to paginate complete responses and resolve multi-hop canonical aliases. The latest user response across merged event IDs wins, including cancellation, with canonical rows breaking timestamp ties.
- `npm test`: 389 passed, nine existing integration tests skipped. `npx tsc --noEmit`: passed. `npm run build`: passed with network access for the project's existing Google Fonts. Repository-wide lint completed with zero errors and existing warnings; targeted map lint is clean. `git diff --check`: passed.
- Local PostgreSQL verified migration syntax, trigger increments on RSVP insert/update, public read-only revision access, authenticated ownership isolation, and denial of anonymous RSVP reads.
- Applied the migration to the connected Supabase database after approval. Two independent browser tabs reached Live and both refetched after a single revision signal, with requests starting approximately 1.5ms apart. No person's RSVP was changed for this live verification.
- Browser checks covered real event selection, desktop/mobile layout, no horizontal overflow, category/free-food empty states, mobile list collapse, and count failure. A browser-only mocked snapshot verified increased Going counts and heat without writing fake attendance to the database.
- Fixed a detected CSS precedence conflict that collapsed the map canvas; confirmed a nonzero canvas height and visible basemap at both viewports. Final screenshots are in ignored `output/playwright/`.
- Changes remain in the existing working tree; pre-existing changes were preserved. No merge, push, PR, or deployment was performed. The temporary local database server was stopped after verification.

Known data limits: unresolved venues stay in the companion list until verified. Event inclusion follows persisted start/end dates; long-running source series are not expanded into individual recurrences by this feature. Previews show full dates so those ranges remain visible.
