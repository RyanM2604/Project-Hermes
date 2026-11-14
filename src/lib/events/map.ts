import type { FeatureCollection, Point } from "geojson";
import type { EventTag, HermesEvent } from "@/types/event";
import { filterEventsByTag } from "./filters";

export interface MapVenue {
  id: string;
  name: string;
  aliases: readonly string[];
  buildingCodes: readonly string[];
  coordinates: readonly [number, number];
  city: "Waterloo" | "outside";
  verifiedFrom: string;
}

export type MapLocation = {
  venue: MapVenue | null;
  locationStatus: "located" | "unlocated" | "online" | "outside";
};
export type MapEvent = HermesEvent & MapLocation & { goingCount: number | null };
export interface MapSnapshot {
  events: MapEvent[];
  serverTime: string;
  refreshedAt: string;
  countsAvailable: boolean;
}
export interface MapGroup {
  venue: MapVenue;
  events: MapEvent[];
}
export type MapGeoJson = FeatureCollection<Point, { venueId: string; name: string; going: number; eventCount: number }>;

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit",
});

export function torontoDateKey(date: Date): string {
  const parts = dayFormatter.formatToParts(date);
  return ["year", "month", "day"].map(type => parts.find(part => part.type === type)!.value).join("-");
}

export function filterMapEvents(
  events: MapEvent[], now: Date,
  filters: { nowOnly?: boolean; tag?: EventTag } = {},
): MapEvent[] {
  const categorized = filters.tag === "free-food"
    ? events.filter(event => event.isFreeFood || event.tags.includes("free-food"))
    : filterEventsByTag(events, filters.tag);
  const tagged = new Set(categorized.map(event => event.id));
  const today = torontoDateKey(now);
  return events.filter(event => {
    const start = new Date(event.startTime);
    const end = new Date(event.endTime);
    return Number.isFinite(+start) && Number.isFinite(+end) && +end > +now &&
      torontoDateKey(start) <= today && (!filters.nowOnly || +start <= +now) &&
      tagged.has(event.id) && event.locationStatus !== "outside";
  });
}

export function groupMapEvents(events: MapEvent[]): MapGroup[] {
  const groups = new Map<string, MapGroup>();
  for (const event of events) {
    if (!event.venue || event.locationStatus !== "located") continue;
    let group = groups.get(event.venue.id);
    if (!group) {
      group = { venue: event.venue, events: [] };
      groups.set(event.venue.id, group);
    }
    group.events.push(event);
  }
  return [...groups.values()];
}

export function mapGeoJson(groups: MapGroup[]): MapGeoJson {
  return {
    type: "FeatureCollection",
    features: groups.map(({ venue, events }) => ({
      type: "Feature", geometry: { type: "Point", coordinates: [...venue.coordinates] },
      properties: { venueId: venue.id, name: venue.name, eventCount: events.length,
        going: events.reduce((total, event) => total + (event.goingCount ?? 0), 0) },
    })),
  };
}
