import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { uwaterlooEventsAdapter } from "../uwaterloo-events";

const fixture = readFileSync(
  new URL("../__fixtures__/uwaterloo-events.html", import.meta.url),
  "utf8",
);

describe("uwaterlooEventsAdapter", () => {
  const records = uwaterlooEventsAdapter.parseRaw(fixture);

  it("parses every event card independently", () => {
    expect(records).toHaveLength(3);
    expect(records.map((record) => record.sourceId)).toEqual([
      "uw-101",
      "uw-102",
      "uw-bad",
    ]);
  });

  it("normalizes a complete event", () => {
    expect(uwaterlooEventsAdapter.normalize(records[0])).toEqual({
      ok: true,
      event: {
        source: "uwaterloo-events",
        sourceUrl: "https://uwaterloo.ca/events/quantum-workshop",
        sourceFingerprint: uwaterlooEventsAdapter.sourceFingerprint(records[0]),
        title: "Quantum Workshop",
        description: "A hands-on introduction to quantum computing.",
        clubName: "Institute for Quantum Computing",
        startTime: "2026-06-15T22:00:00.000Z",
        endTime: "2026-06-16T00:00:00.000Z",
        locationName: "QNC 0101",
        buildingCode: "QNC",
        tags: [],
        imageUrl: "https://uwaterloo.ca/events/quantum.jpg",
        isFreeFood: false,
      },
    });
  });

  it("normalizes optional blank fields with explicit fallbacks", () => {
    expect(uwaterlooEventsAdapter.normalize(records[1])).toEqual({
      ok: true,
      event: {
        source: "uwaterloo-events",
        sourceUrl: "https://uwaterloo.ca/events/career-panel",
        sourceFingerprint: uwaterlooEventsAdapter.sourceFingerprint(records[1]),
        title: "Career Panel",
        description: "No description provided.",
        clubName: "Co-operative Education",
        startTime: "2026-06-16T21:00:00.000Z",
        endTime: "2026-06-16T22:00:00.000Z",
        locationName: "TC 2218",
        buildingCode: "TC",
        tags: [],
        isFreeFood: false,
      },
    });
  });

  it("rejects malformed dates without preventing other records from normalizing", () => {
    const results = records.map((record) =>
      uwaterlooEventsAdapter.normalize(record),
    );

    expect(results).toHaveLength(3);
    expect(results.filter((result) => result.ok)).toHaveLength(2);
    expect(results[2]).toEqual({
      ok: false,
      rejection: {
        source: "uwaterloo-events",
        recordId: "uw-bad",
        reason: "invalid-date",
      },
    });
  });

  it("normalizes records when passed directly as an array callback", () => {
    expect(() => records.map(uwaterlooEventsAdapter.normalize)).not.toThrow();
    expect(records.map(uwaterlooEventsAdapter.normalize)).toHaveLength(3);
  });

  it("creates stable source fingerprints", () => {
    const fingerprint = uwaterlooEventsAdapter.sourceFingerprint(records[0]);

    expect(fingerprint).toBe(uwaterlooEventsAdapter.sourceFingerprint(records[0]));
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns a structured rejection for a blank source ID without throwing", () => {
    const record = { ...records[0], sourceId: " \n\t" };

    expect(uwaterlooEventsAdapter.sourceFingerprint(record)).toBeNull();
    expect(() => uwaterlooEventsAdapter.normalize(record)).not.toThrow();
    expect(uwaterlooEventsAdapter.normalize(record)).toEqual({
      ok: false,
      rejection: {
        source: "uwaterloo-events",
        reason: "missing-required-field",
      },
    });
  });

  it.each(["title", "organizer", "url", "location"] as const)(
    "rejects a blank required %s",
    (field) => {
      const record = { ...records[0], [field]: " \n\t" };

      expect(uwaterlooEventsAdapter.normalize(record)).toEqual({
        ok: false,
        rejection: {
          source: "uwaterloo-events",
          recordId: "uw-101",
          reason: "missing-required-field",
        },
      });
    },
  );

  it("rejects non-http source URLs as missing required fields", () => {
    const record = { ...records[0], url: "javascript:alert('unsafe')" };

    expect(uwaterlooEventsAdapter.normalize(record)).toEqual({
      ok: false,
      rejection: {
        source: "uwaterloo-events",
        recordId: "uw-101",
        reason: "missing-required-field",
      },
    });
  });

  it("ignores non-http image URLs", () => {
    const record = { ...records[0], image: "javascript:alert('unsafe')" };
    const result = uwaterlooEventsAdapter.normalize(record);

    expect(result).toMatchObject({ ok: true });
    expect(result.ok && result.event.imageUrl).toBeUndefined();
  });
});
