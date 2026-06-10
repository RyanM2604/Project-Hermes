import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { createSourceFingerprint } from "../utils";
import { wusaEventsAdapter } from "../wusa-events";

const fixture = readFileSync(
  new URL("../__fixtures__/wusa-events.html", import.meta.url),
  "utf8",
);

describe("wusaEventsAdapter", () => {
  const records = wusaEventsAdapter.parseRaw(fixture);

  it("parses every WUSA event independently", () => {
    expect(records).toHaveLength(3);
    expect(records.map((record) => record.sourceId)).toEqual([
      "wusa-201",
      "wusa-202",
      "wusa-bad",
    ]);
  });

  it("normalizes a complete free-food social", () => {
    expect(wusaEventsAdapter.normalize(records[0])).toEqual({
      ok: true,
      event: {
        source: "wusa-events",
        sourceUrl: "https://wusa.ca/events/free-food-social",
        sourceFingerprint: wusaEventsAdapter.sourceFingerprint(records[0]),
        title: "Free Food Social",
        description: "Meet new people over dinner.",
        clubName: "Waterloo Undergraduate Student Association",
        startTime: "2026-06-18T22:00:00.000Z",
        endTime: "2026-06-19T00:00:00.000Z",
        locationName: "SLC Great Hall",
        buildingCode: "SLC",
        tags: ["free-food", "chill-social"],
        imageUrl: "https://wusa.ca/events/free-food-social.jpg",
        isFreeFood: true,
      },
    });
  });

  it("normalizes optional blank fields with explicit fallbacks", () => {
    expect(wusaEventsAdapter.normalize(records[1])).toEqual({
      ok: true,
      event: {
        source: "wusa-events",
        sourceUrl: "https://wusa.ca/events/career-connections",
        sourceFingerprint: wusaEventsAdapter.sourceFingerprint(records[1]),
        title: "Career Connections",
        description: "No description provided.",
        clubName: "WUSA Clubs",
        startTime: "2026-06-19T21:00:00.000Z",
        endTime: "2026-06-19T22:30:00.000Z",
        locationName: "TC 2218",
        buildingCode: "TC",
        tags: ["career-coop"],
        isFreeFood: false,
      },
    });
  });

  it("rejects a blank title without preventing valid records from normalizing", () => {
    const results = records.map(wusaEventsAdapter.normalize);

    expect(results).toHaveLength(3);
    expect(results.filter((result) => result.ok)).toHaveLength(2);
    expect(results[2]).toEqual({
      ok: false,
      rejection: {
        source: "wusa-events",
        recordId: "wusa-bad",
        reason: "missing-required-field",
      },
    });
  });

  it("normalizes records when passed directly as an array callback", () => {
    expect(() => records.map(wusaEventsAdapter.normalize)).not.toThrow();
    expect(records.map(wusaEventsAdapter.normalize)).toHaveLength(3);
  });

  it("creates stable source-namespaced fingerprints", () => {
    const fingerprint = wusaEventsAdapter.sourceFingerprint(records[0]);

    expect(fingerprint).toBe(wusaEventsAdapter.sourceFingerprint(records[0]));
    expect(fingerprint).not.toBe(
      createSourceFingerprint("uwaterloo-events", records[0].sourceId),
    );
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns a structured rejection for a blank source ID without throwing", () => {
    const record = { ...records[0], sourceId: " \n\t" };

    expect(wusaEventsAdapter.sourceFingerprint(record)).toBeNull();
    expect(() => wusaEventsAdapter.normalize(record)).not.toThrow();
    expect(wusaEventsAdapter.normalize(record)).toEqual({
      ok: false,
      rejection: {
        source: "wusa-events",
        reason: "missing-required-field",
      },
    });
  });

  it.each(["title", "organizer", "url", "location"] as const)(
    "rejects a blank required %s",
    (field) => {
      const record = { ...records[0], [field]: " \n\t" };

      expect(wusaEventsAdapter.normalize(record)).toEqual({
        ok: false,
        rejection: {
          source: "wusa-events",
          recordId: "wusa-201",
          reason: "missing-required-field",
        },
      });
    },
  );

  it("rejects non-http source URLs as missing required fields", () => {
    const record = { ...records[0], url: "javascript:alert('unsafe')" };

    expect(wusaEventsAdapter.normalize(record)).toEqual({
      ok: false,
      rejection: {
        source: "wusa-events",
        recordId: "wusa-201",
        reason: "missing-required-field",
      },
    });
  });

  it("ignores non-http image URLs", () => {
    const record = { ...records[0], image: "javascript:alert('unsafe')" };
    const result = wusaEventsAdapter.normalize(record);

    expect(result).toMatchObject({ ok: true });
    expect(result.ok && result.event.imageUrl).toBeUndefined();
  });

  it("rejects malformed dates without affecting valid records", () => {
    const malformed = { ...records[0], start: "unknown" };
    const results = [records[1], malformed].map(wusaEventsAdapter.normalize);

    expect(results[0]).toMatchObject({ ok: true });
    expect(results[1]).toEqual({
      ok: false,
      rejection: {
        source: "wusa-events",
        recordId: "wusa-201",
        reason: "invalid-date",
      },
    });
  });
});
