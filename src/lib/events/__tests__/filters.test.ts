import { describe, expect, it } from "vitest";

import type { HermesEvent } from "@/types/event";

import { filterEventsByTag, parseEventTag } from "../filters";

const events = [
  {
    id: "event-source-backed",
    title: "Source-backed event",
    description: "Test fixture",
    clubName: "Test organiser",
    startTime: "2026-06-18T21:00:00.000Z",
    endTime: "2026-06-18T23:00:00.000Z",
    locationName: "SLC",
    tags: ["free-food"],
    sourceUrl: "https://example.com/event",
    isFreeFood: true,
    createdAt: "2026-06-13T22:00:00.000Z",
  },
] satisfies HermesEvent[];

describe("event filters", () => {
  it("parses supported tags from the URL", () => {
    expect(parseEventTag("free-food")).toBe("free-food");
    expect(parseEventTag("hack-dev")).toBe("hack-dev");
  });

  it("ignores unsupported or repeated tag parameters", () => {
    expect(parseEventTag("not-a-tag")).toBeUndefined();
    expect(parseEventTag(["free-food", "hack-dev"])).toBeUndefined();
    expect(parseEventTag(undefined)).toBeUndefined();
  });

  it("filters events by the selected tag", () => {
    const filteredEvents = filterEventsByTag(events, "free-food");

    expect(filteredEvents).toHaveLength(1);
    expect(
      filteredEvents.every((event) => event.tags.includes("free-food")),
    ).toBe(true);
  });

  it("returns all events when no tag is selected", () => {
    expect(filterEventsByTag(events, undefined)).toBe(events);
  });
});
