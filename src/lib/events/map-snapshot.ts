import "server-only";
import { getEvents } from "./repository";
import { loadEventGoingCounts } from "./rsvp-summary";
import { filterMapEvents, type MapEvent, type MapSnapshot } from "./map";
import { resolveMapLocation } from "./map-venues";
import { prisma } from "@/lib/db/prisma";
import { mapSavedLocation, type SavedGeocode } from "./geocoding";
import { isPlaceholderLocation } from "./location";

export async function loadMapSnapshot(now = new Date()): Promise<MapSnapshot> {
  const events = await getEvents({ throwOnUnavailable: true, startsBefore: new Date(+now + 48 * 60 * 60 * 1000) });
  let saved = new Map<string, SavedGeocode>();
  if (events.length) {
    try {
      const rows = await prisma.eventGeocode.findMany({ where: { eventId: { in: events.map(event => event.id) } } });
      saved = new Map(rows.map(row => [row.eventId, row]));
    } catch { /* Registry pins remain available during a cache outage or migration rollout. */ }
  }
  const candidates: MapEvent[] = events.map(event => {
    const location = mapSavedLocation(event, saved.get(event.id)) ?? resolveMapLocation(event);
    return { ...event, ...location, goingCount: null,
      ...(location.venue && isPlaceholderLocation(event.locationName) ? { locationName: location.venue.name } : {}) };
  });
  const today = filterMapEvents(candidates, now);
  let counts: Record<string, number> = {};
  let countsAvailable = true;
  try {
    counts = await loadEventGoingCounts(today.map(event => event.id), { throwOnUnavailable: true });
  } catch {
    countsAvailable = false;
  }
  return {
    events: today.map(event => ({ ...event, goingCount: countsAvailable ? counts[event.id] ?? 0 : null })),
    serverTime: now.toISOString(), refreshedAt: new Date().toISOString(), countsAvailable,
  };
}
