import { describe, expect, it } from "vitest";
import { eventFeedHref, parseEventPeriod } from "../feed-period";
describe("event history navigation", () => {
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
