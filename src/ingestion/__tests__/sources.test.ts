import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { uwaterlooHtmlSource } from "../sources/uwaterloo-html";
import { wusaIcsSource } from "../sources/wusa-ics";

const uwFixture = readFileSync(
  new URL("../__fixtures__/uwaterloo-events.html", import.meta.url),
  "utf8",
);
const wusaFixture = readFileSync(
  new URL("../__fixtures__/wusa-events.ics", import.meta.url),
  "utf8",
);

describe("wusaIcsSource", () => {
  const results = wusaIcsSource.parse(wusaFixture);

  it("normalizes live-feed fields, folded text, tags, and Toronto time", () => {
    expect(results[0]).toMatchObject({
      ok: true,
      event: {
        source: "wusa-events",
        title: "UW Entomology Club - Buzz & Mingle: Free Food",
        description:
          "Free pizza, crafts, and drinks for students. This description is folded across two lines.",
        clubName: "UW Entomology Club",
        startTime: "2026-06-18T21:00:00.000Z",
        endTime: "2026-06-18T23:00:00.000Z",
        locationName: "QNC 2501",
        buildingCode: "QNC",
        tags: ["free-food", "arts-crafts", "chill-social", "hangout"],
        isFreeFood: true,
      },
    });
  });

  it("uses explicit fallbacks for omitted optional feed fields", () => {
    expect(results[1]).toMatchObject({
      ok: true,
      event: {
        clubName: "Waterloo Undergraduate Student Association",
        locationName: "See source for location",
        startTime: "2026-06-19T23:00:00.000Z",
      },
    });
    expect(results[1].ok && results[1].event.imageUrl).toBeUndefined();
  });

  it("returns a structured rejection for malformed dates", () => {
    expect(results[2]).toEqual({
      ok: false,
      rejection: {
        source: "wusa-events",
        recordId: "wusa-bad-date@wusa.ca",
        reason: "invalid-date",
      },
    });
  });

  it("isolates unsupported timezones to one rejected event", () => {
    const withUnsupportedTimezone = wusaFixture.replace(
      "DTSTART;TZID=America/Toronto:20260618T170000",
      "DTSTART;TZID=Unsupported/Timezone:20260618T170000",
    );

    expect(() => wusaIcsSource.parse(withUnsupportedTimezone)).not.toThrow();
    expect(wusaIcsSource.parse(withUnsupportedTimezone)[0]).toMatchObject({
      ok: false,
      rejection: {
        source: "wusa-events",
        recordId: "wusa-free-food-1@wusa.ca",
        reason: "invalid-date",
      },
    });
    expect(wusaIcsSource.parse(withUnsupportedTimezone)[1]).toMatchObject({
      ok: true,
    });
  });

  it("rejects impossible calendar dates", () => {
    const withImpossibleDate = wusaFixture.replace(
      "DTSTART;TZID=America/Toronto:20260618T170000",
      "DTSTART;TZID=America/Toronto:20260230T170000",
    );

    expect(wusaIcsSource.parse(withImpossibleDate)[0]).toMatchObject({
      ok: false,
      rejection: {
        source: "wusa-events",
        recordId: "wusa-free-food-1@wusa.ca",
        reason: "invalid-date",
      },
    });
  });
});

describe("uwaterlooHtmlSource", () => {
  const results = uwaterlooHtmlSource.parse(uwFixture);

  it("normalizes a timed listing event", () => {
    expect(results[0]).toMatchObject({
      ok: true,
      event: {
        source: "uwaterloo-events",
        sourceUrl:
          "https://uwaterloo.ca/events/events/future-cities-innovation-challenge",
        title: "Future Cities Innovation Challenge",
        description: "Pitch ideas that improve future cities.",
        clubName: "University of Waterloo",
        startTime: "2026-06-15T17:30:00.000Z",
        endTime: "2026-06-15T19:00:00.000Z",
        locationName: "See source for location",
        tags: ["startup-pitch"],
      },
    });
  });

  it("normalizes all-day listing events", () => {
    expect(results[1]).toMatchObject({
      ok: true,
      event: {
        title: "Campus Music Showcase",
        startTime: "2026-06-20T04:00:00.000Z",
        endTime: "2026-06-21T03:59:59.999Z",
        tags: ["music", "reels"],
      },
    });
  });

  it("rejects malformed listing dates", () => {
    expect(results[2]).toMatchObject({
      ok: false,
      rejection: {
        source: "uwaterloo-events",
        reason: "invalid-date",
      },
    });
  });
});
