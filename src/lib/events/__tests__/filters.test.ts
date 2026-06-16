import { describe, expect, it } from "vitest";

import type { HermesEvent } from "@/types/event";

import {
  filterEventsByTag,
  getEventTagCounts,
  getVisibleSocialSubTags,
  parseEventTag,
} from "../filters";

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

const makeEvent = (tags: HermesEvent["tags"]): HermesEvent => ({
  id: "event-a",
  title: "Social Event",
  description: "Hang out with friends.",
  clubName: "Campus Social Club",
  startTime: "2026-06-15T23:00:00.000Z",
  endTime: "2026-06-16T01:00:00.000Z",
  locationName: "SLC",
  tags,
  sourceUrl: "https://example.com/social",
  isFreeFood: false,
  createdAt: "2026-06-15T00:00:00.000Z",
});

describe("event filters", () => {
  it("parses supported tags from the URL", () => {
    expect(parseEventTag("free-food")).toBe("free-food");
    expect(parseEventTag("hack-dev")).toBe("hack-dev");
    expect(parseEventTag("games")).toBe("games");
    expect(parseEventTag("general")).toBe("general");
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

  it("filters chill-social events by parent bucket or sub-tag", () => {
    const socialEvents = [
      makeEvent(["games"]),
      makeEvent(["chill-social"]),
      makeEvent(["free-food"]),
    ];

    expect(filterEventsByTag(socialEvents, "chill-social")).toHaveLength(2);
    expect(filterEventsByTag(socialEvents, "games")).toHaveLength(1);
  });

  it("filters general events by the neutral bucket", () => {
    const generalEvents = [makeEvent(["general"]), makeEvent(["free-food"])];

    expect(filterEventsByTag(generalEvents, "general")).toHaveLength(1);
  });

  it("returns all events when no tag is selected", () => {
    expect(filterEventsByTag(events, undefined)).toBe(events);
  });

  it("counts tags for the visible feed", () => {
    expect(getEventTagCounts(events)).toMatchObject({
      all: 1,
      "career-coop": 0,
      "chill-social": 0,
      "free-food": 1,
      "hack-dev": 0,
      music: 0,
      "startup-pitch": 0,
      games: 0,
    });
  });

  it("shows parent and sub-tag counts without showing empty social chips", () => {
    const counts = getEventTagCounts([
      makeEvent(["games"]),
      makeEvent(["free-food"]),
    ]);

    expect(counts).toMatchObject({
      "chill-social": 1,
      games: 1,
      "free-food": 1,
    });
  });

  it("keeps selected sub-tags visible even when the count is zero", () => {
    const visible = getVisibleSocialSubTags({}, "games");
    expect(visible).toEqual(["games"]);
  });
});
