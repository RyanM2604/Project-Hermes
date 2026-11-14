# Waterloo live event map

Status: Product direction approved in conversation; written specification ready for review.

## Purpose and scope

Replace `/map`'s coming-soon page with a Waterloo event discovery map. Show where events take place and use the number of Hermes users who RSVP **Going** to reveal popular areas. These counts describe planned attendance, not verified physical attendance.

Launch geography is the City of Waterloo, Ontario, including UW and off-campus venues. This interprets “Waterloo” as the city rather than the broader Waterloo Region. Kitchener and Cambridge are outside the initial event scope. The basemap may show surrounding areas when panned.

No check-ins, attendee tracking, directions engine, external-platform attendance imports, or organizer analytics are included in this version.

## Agreed user experience

- Default to **Today**, evaluated in `America/Toronto`, independently of the browser timezone.
- Include ongoing events and events starting before the next local midnight. Exclude events whose end time has passed. An event that began yesterday and is still ongoing qualifies.
- Offer **Happening now**, category, and free-food filters. All filters apply equally to the heatmap, pins, and accompanying list.
- Show a pin for every qualifying event with a confirmed in-scope location, even when its Going count is zero.
- Display a heat layer beneath pins. Higher Going totals produce stronger hotspots. Nearby events contribute to the same hotspot; zooming in reveals venue-level detail.
- Selecting a venue opens a preview showing event title, organizer, time, venue/room, Going count, RSVP control, and event-detail link. Multiple events at the same venue are listed together rather than hidden behind overlapping pins.
- On desktop, pair the map with a scrollable event list. On mobile, use a collapsible list/preview panel that leaves map controls reachable. The list provides keyboard-accessible discovery without requiring interaction with the map canvas.
- Unlocated events remain discoverable in a clearly labeled section of the list. Never place them at an invented coordinate.
- Render confirmed out-of-city events outside this view; unresolved physical venues stay in the unlocated section until their geography is known. Explicitly online events have no physical pin or heat contribution and are labeled online in the list.

## Heat and count semantics

Only `status = going` contributes. Interested, cancelled, and saved events contribute zero. Display “N going,” with a short explanation that counts come from Hermes RSVPs.

Count each user once per canonical event, including RSVPs stored against superseded event IDs. Reuse the canonical/alias behavior in `src/lib/events/rsvp-summary.ts`. A user going to two distinct events contributes once to each; venue totals are event RSVP totals, not a deduplicated census of people in the area.

Use raw Going counts as heat weights. Keep the intensity scale stable across filter changes at the same zoom; do not normalize each result set so its busiest event always looks equally hot. Tune a fixed count-to-intensity curve against representative counts during implementation and include a low-to-high legend. Event pins and previews carry exact counts; heat is a visual summary. Zero-count events produce no heat but retain their pins.

## Existing project integration

- `/map` currently renders `ComingSoonPage`.
- `HermesEvent` contains venue text and optional building code, but no coordinates.
- The canonical Prisma event repository already resolves superseded events. `loadFreshEvents` reads persisted data; ingestion is worker-driven.
- Supabase stores user-specific RSVP rows, protected by row-level security. The server already calculates aggregate Going counts with its service-role client.
- Keep existing RSVP authentication and write behavior. Public map responses contain only aggregate counts, never RSVP user IDs. Service-role credentials remain server-only.

## Location resolution

Introduce a persistent venue registry with stable venue IDs, display name, aliases, coordinates, city/scope classification, and verification provenance. Resolve recognized campus building codes through verified registry entries; resolve off-campus venues through verified address/name aliases. Preserve room text separately in the event preview.

Do not geocode during map rendering or on every refresh. Populate and verify venue coordinates during venue setup or ingestion, and reuse them. Ambiguous matches remain unresolved. Building-level coordinates are acceptable and must not imply room-level precision. Changing a venue coordinate should update all events resolved to that venue.

Select the basemap/rendering provider and coordinate verification source during implementation planning, checking current APIs, attribution, usage limits, and cost. No provider account, paid service, or dependency is created by this specification.

## Data flow and live updates

1. A server-only map query reads canonical events, applies the Waterloo/time filters, resolves venues, and obtains aggregate Going counts.
2. A public snapshot endpoint returns the eligible event summaries, venue coordinates, aggregate counts, server time, and refresh timestamp. It does not expose the RSVP table.
3. The client derives pins, venue groups, list results, and heat from one snapshot so all views agree.
4. A public aggregate-only Supabase Realtime notification signals that the snapshot needs refreshing after an RSVP change. Notifications contain no user identities; clients refetch authoritative counts instead of incrementing them locally.
5. A successful RSVP mutation refreshes the current client's snapshot immediately. Reconnection and returning to the foreground also trigger a refresh. A 30-second visible-tab fallback refresh recovers missed notifications and discovers newly ingested or updated events.
6. Reevaluate time membership at event start/end boundaries and local midnight, including when no RSVP notification arrives.

Target normal RSVP propagation within five seconds after the write succeeds when the realtime connection is healthy. Label disconnected or stale results accurately rather than continuing to claim they are live. Realtime notification setup must preserve existing RSVP row-level security.

This is live relative to data stored in Hermes. New events from external sources appear after ingestion discovers them; this feature does not make external source ingestion instantaneous.

## Loading, failure, and empty states

- Show a loading state while obtaining the initial snapshot and map assets.
- A failed refresh retains the last successful snapshot with its last-updated time and a retry action.
- Count retrieval failure must return an unavailable status, not fabricated zero counts. Pins/list remain usable and affected heat is withheld until counts recover. The current helper's catch-to-empty behavior needs an explicit map-facing failure signal.
- If the basemap fails, retain the event list and show a retry action for the map.
- Distinguish no matching events, only unlocated events, and unavailable event data. Do not present a database outage as a confirmed empty day.

## Build sequence

1. Establish verified venue resolution and the filtered map snapshot contract.
2. Build the map, stable heat layer, grouped pins, accessible companion list, filters, and previews using snapshots.
3. Connect aggregate realtime notifications, refresh recovery, and time-boundary updates.

## Acceptance checks

- Events that span midnight, Toronto daylight-saving transitions, and users in other timezones receive the correct Today membership.
- All views reflect identical category/free-food/time filters; ended events disappear automatically.
- Zero-count pins remain visible. Going changes heat/counts; Interested and cancelled do not contribute.
- Superseded event aliases cannot double-count a user's RSVP for the same canonical event.
- Shared venues expose all matching events; unknown locations never produce guessed pins.
- Two browser sessions observe RSVP/cancellation changes without manual reload; reconnect recovers missed changes.
- Anonymous map responses and realtime notifications contain no RSVP user identities or privileged credentials.
- Loading, stale data, count failure, basemap failure, and empty results have distinct usable states.
- Desktop and mobile layouts support event selection, keyboard navigation, RSVP sign-in, and readable exact counts without relying on heat colors alone.

## Written review checkpoint

Review this specification before generating the detailed implementation plan. The next step is planning, not implementation or deployment.
