import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("../repository", () => ({ getEvents: vi.fn() }));
vi.mock("../rsvp-summary", () => ({ loadEventGoingCounts: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { eventGeocode: { findMany: vi.fn().mockResolvedValue([]) } } }));
import { prisma } from "@/lib/db/prisma";
import { locationKey } from "../geocoding";
import { getEvents } from "../repository";
import { loadEventGoingCounts } from "../rsvp-summary";
import { loadMapSnapshot } from "../map-snapshot";
import type { HermesEvent } from "@/types/event";

const now = new Date("2026-11-14T18:00:00Z");
const event: HermesEvent = { id: "event", title: "Meetup", description: "", clubName: "Club", startTime: "2026-11-14T20:00:00Z", endTime: "2026-11-14T22:00:00Z", locationName: "SLC", tags: [], isFreeFood: false, sourceUrl: "https://example.com", createdAt: now.toISOString() };
beforeEach(() => { vi.resetAllMocks(); vi.mocked(prisma.eventGeocode.findMany).mockResolvedValue([]); vi.mocked(getEvents).mockResolvedValue([event]); vi.mocked(loadEventGoingCounts).mockResolvedValue({ event: 0 }); });
describe("public map snapshot", () => {
  it("returns zero actual RSVPs, resolved venues and no RSVP identities", async () => {
    const snapshot = await loadMapSnapshot(now);
    expect(snapshot.events[0].goingCount).toBe(0);
    expect(snapshot.events[0].venue?.id).toBe("uw-slc");
    expect(snapshot.countsAvailable).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain("user_id");
    expect(getEvents).toHaveBeenCalledWith(expect.objectContaining({ throwOnUnavailable: true }));
  });
  it("uses saved coordinates for unfamiliar venues without exposing private cache fields", async () => {
    const unknown = { ...event, locationName: "New Venue" };
    vi.mocked(getEvents).mockResolvedValue([unknown]);
    vi.mocked(prisma.eventGeocode.findMany).mockResolvedValue([{ eventId: event.id, locationKey: locationKey(unknown), status: "resolved", latitude: 43.472, longitude: -80.54, displayName: "New Venue", source: "nominatim" }] as never);
    const snapshot = await loadMapSnapshot(now);
    expect(snapshot.events[0].venue?.coordinates).toEqual([-80.54, 43.472]);
    expect(JSON.stringify(snapshot)).not.toContain("locationKey");
  });
  it("keeps events with unknown counts on aggregation failure", async () => {
    vi.mocked(loadEventGoingCounts).mockRejectedValue(new Error("offline"));
    const snapshot = await loadMapSnapshot(now);
    expect(snapshot.countsAvailable).toBe(false);
    expect(snapshot.events[0].goingCount).toBeNull();
  });
  it("distinguishes a valid empty day from a store outage", async () => {
    vi.mocked(getEvents).mockResolvedValue([]);
    expect((await loadMapSnapshot(now)).events).toEqual([]);
    vi.mocked(getEvents).mockRejectedValue(new Error("offline"));
    await expect(loadMapSnapshot(now)).rejects.toThrow("offline");
  });
  it("excludes tomorrow and confirmed outside-city events but retains unknown locations", async () => {
    vi.mocked(getEvents).mockResolvedValue([event, { ...event, id: "outside", locationName: "Kitchener City Hall" }, { ...event, id: "unknown", locationName: "TBA" }, { ...event, id: "tomorrow", startTime: "2026-11-15T05:00:00Z", endTime: "2026-11-15T06:00:00Z" }]);
    expect((await loadMapSnapshot(now)).events.map(e => e.id)).toEqual(["event", "unknown"]);
  });
});
