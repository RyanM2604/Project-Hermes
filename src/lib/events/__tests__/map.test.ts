import { describe, expect, it } from "vitest";
import { filterMapEvents, groupMapEvents, mapGeoJson, torontoDateKey, type MapEvent } from "../map";
import { resolveMapLocation } from "../map-venues";

const now = new Date("2026-11-14T18:00:00Z");
function event(overrides: Partial<MapEvent> = {}): MapEvent {
  return {
    id: "one", title: "Meetup", description: "", clubName: "Club",
    startTime: "2026-11-14T20:00:00Z", endTime: "2026-11-14T22:00:00Z",
    locationName: "SLC Great Hall", tags: ["chill-social"], isFreeFood: true,
    sourceUrl: "https://example.com", createdAt: "2026-11-01T12:00:00Z",
    ...resolveMapLocation({ locationName: "SLC Great Hall", buildingCode: "SLC" }),
    goingCount: 0, ...overrides,
  };
}

describe("Waterloo map", () => {
  it("uses Toronto dates on both daylight-saving transitions", () => {
    expect(torontoDateKey(new Date("2026-03-08T04:30:00Z"))).toBe("2026-03-07");
    expect(torontoDateKey(new Date("2026-03-08T07:30:00Z"))).toBe("2026-03-08");
    expect(torontoDateKey(new Date("2026-11-01T05:30:00Z"))).toBe("2026-11-01");
    expect(torontoDateKey(new Date("2026-11-01T06:30:00Z"))).toBe("2026-11-01");
  });
  it("keeps overnight events, removes ended events and tomorrow, and applies Now", () => {
    const overnight = event({ id: "overnight", startTime: "2026-11-14T04:00:00Z", endTime: "2026-11-14T19:00:00Z" });
    const ended = event({ id: "ended", endTime: now.toISOString() });
    const tomorrow = event({ id: "tomorrow", startTime: "2026-11-15T05:00:00Z", endTime: "2026-11-15T06:00:00Z" });
    const all = [event(), overnight, ended, tomorrow];
    expect(filterMapEvents(all, now).map(e => e.id)).toEqual(["one", "overnight"]);
    expect(filterMapEvents(all, now, { nowOnly: true }).map(e => e.id)).toEqual(["overnight"]);
    expect(filterMapEvents(all, now, { tag: "music" })).toEqual([]);
    expect(filterMapEvents([event({ isFreeFood: false })], now, { tag: "free-food" })).toEqual([]);
  });
  it("includes food-flagged and food-tagged events in the Free food category", () => {
    const events = [event(), event({ id: "tagged", isFreeFood: false, tags: ["free-food"] }), event({ id: "other", isFreeFood: false })];
    expect(filterMapEvents(events, now, { tag: "free-food" }).map(item => item.id)).toEqual(["one", "tagged"]);
  });
  it("resolves campus rooms but refuses ambiguous and contradictory locations", () => {
    expect(resolveMapLocation({ locationName: "Student Life Centre, Great Hall" }).venue?.id).toBe("uw-slc");
    expect(resolveMapLocation({ locationName: "EC5 1901" }).venue?.id).toBe("uw-ec5");
    expect(resolveMapLocation({ locationName: "DC 1350", buildingCode: "SLC" }).venue).toBeNull();
    expect(resolveMapLocation({ locationName: "SLC or DC" }).venue).toBeNull();
    expect(resolveMapLocation({ locationName: "TBA" }).locationStatus).toBe("unlocated");
    expect(resolveMapLocation({ locationName: "Online via Zoom" }).locationStatus).toBe("online");
    expect(resolveMapLocation({ locationName: "Downtown Kitchener", buildingCode: "SLC" }).locationStatus).toBe("outside");
    expect(resolveMapLocation({ locationName: "SLC nightclub in Toronto" }).venue).toBeNull();
  });
  it("maps assigned off-campus venues and explicit venues behind city-only locations", () => {
    expect(resolveMapLocation({ locationName: "The Culinary Studio, 19-105 Lexington Rd, Waterloo, ON, N2J 4R7" }).venue?.id).toBe("waterloo-culinary-studio");
    expect(resolveMapLocation({ locationName: "105 Lexington Road, Unit 19, Waterloo" }).venue?.id).toBe("waterloo-culinary-studio");
    expect(resolveMapLocation({ locationName: "Waterloo", description: "The Etsy Holiday Market at RIM Park in Waterloo." }).venue?.id).toBe("waterloo-rim-park");
    expect(resolveMapLocation({ locationName: "Waterloo", description: "Meet at RIM Park or SLC." }).venue).toBeNull();
  });
  it("keeps verified out-of-city venues out of the Waterloo map", () => {
    for (const locationName of ["Cowan Recreation Centre at RBJ Schlegel Park", "Builder’s Club, 165 King St. W, Waterloo, N2G 1A7", "Elora", "St. Marys"]) {
      expect(resolveMapLocation({ locationName }).locationStatus).toBe("outside");
    }
  });
  it("groups shared venues, keeps zero-count pins and excludes unknown heat", () => {
    const groups = groupMapEvents([event(), event({ id: "two", goingCount: 12 }), event({ id: "unknown", venue: null })]);
    expect(groups).toHaveLength(1);
    expect(groups[0].events).toHaveLength(2);
    expect(mapGeoJson(groups).features[0].properties.going).toBe(12);
    expect(mapGeoJson(groupMapEvents([event()])).features).toHaveLength(1);
    expect(mapGeoJson(groupMapEvents([event({ goingCount: null })])).features[0].properties.going).toBe(0);
  });
});
