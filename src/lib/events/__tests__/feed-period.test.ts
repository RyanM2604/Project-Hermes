import { describe, expect, it } from "vitest";
import { eventFeedHref, parseEventPeriod, torontoDayStart, startingSoon } from "../feed-period";
describe("event history navigation", () => {
  it("uses the current Toronto day rather than the server UTC date", () => {
    expect(torontoDayStart(new Date("2026-11-15T02:00:00Z")).toISOString()).toBe("2026-11-14T05:00:00.000Z");
    expect(torontoDayStart(new Date("2026-07-15T02:00:00Z")).toISOString()).toBe("2026-07-14T04:00:00.000Z");
  });
  it("keeps already-started events out of Starting soon", () => {
    const events = [{ startTime: "2026-11-14T12:00:00Z" }, { startTime: "2026-11-14T22:00:00Z" }];
    expect(startingSoon(events, new Date("2026-11-14T20:00:00Z"))).toEqual([events[1]]);
  });
  it("defaults to upcoming and accepts an explicit past view", () => {
    expect(parseEventPeriod(undefined)).toBe("upcoming");
    expect(parseEventPeriod("past")).toBe("past");
    expect(parseEventPeriod(["past", "upcoming"])).toBe("upcoming");
  });
  it("preserves the selected time period when filtering categories", () => {
    expect(eventFeedHref("past", "free-food")).toBe("/events?view=past&tag=free-food#event-feed");
    expect(eventFeedHref("past")).toBe("/events?view=past#event-feed");
    expect(eventFeedHref("upcoming")).toBe("/events#event-feed");
  });
});
