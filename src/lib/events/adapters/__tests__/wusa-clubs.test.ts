import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { createSourceFingerprint } from "../utils";
import { wusaClubsAdapter } from "../wusa-clubs";

const fixture = readFileSync(
  new URL("../__fixtures__/wusa-clubs.html", import.meta.url),
  "utf8",
);

describe("wusaClubsAdapter", () => {
  const records = wusaClubsAdapter.parseRaw(fixture);

  it("parses every club event independently", () => {
    expect(records).toHaveLength(3);
    expect(records.map((record) => record.sourceId)).toEqual([
      "club-301",
      "club-302",
      "club-bad",
    ]);
  });

  it("normalizes a complete developer workshop with deduplicated tags", () => {
    expect(wusaClubsAdapter.normalize(records[0])).toEqual({
      ok: true,
      event: {
        source: "wusa-clubs",
        sourceUrl: "https://clubs.wusa.ca/events/developer-workshop",
        sourceFingerprint: wusaClubsAdapter.sourceFingerprint(records[0]),
        title: "Developer Workshop",
        description: "Build and deploy your first club website.",
        clubName: "Tech Club",
        startTime: "2026-06-22T22:00:00.000Z",
        endTime: "2026-06-23T00:00:00.000Z",
        locationName: "E5 6004",
        buildingCode: "E5",
        tags: ["hack-dev"],
        imageUrl: "https://clubs.wusa.ca/events/developer-workshop.jpg",
        isFreeFood: false,
      },
    });
  });

  it("normalizes a valid social without an optional image", () => {
    expect(wusaClubsAdapter.normalize(records[1])).toEqual({
      ok: true,
      event: {
        source: "wusa-clubs",
        sourceUrl: "https://clubs.wusa.ca/events/social-night",
        sourceFingerprint: wusaClubsAdapter.sourceFingerprint(records[1]),
        title: "Social Night",
        description: "No description provided.",
        clubName: "Campus Social Club",
        startTime: "2026-06-23T23:00:00.000Z",
        endTime: "2026-06-24T01:00:00.000Z",
        locationName: "SLC Great Hall",
        buildingCode: "SLC",
        tags: ["chill-social", "music", "reels"],
        isFreeFood: false,
      },
    });
  });

  it("rejects a missing organizer without preventing valid records from normalizing", () => {
    const results = records.map(wusaClubsAdapter.normalize);

    expect(results).toHaveLength(3);
    expect(results.filter((result) => result.ok)).toHaveLength(2);
    expect(results[2]).toEqual({
      ok: false,
      rejection: {
        source: "wusa-clubs",
        recordId: "club-bad",
        reason: "missing-required-field",
      },
    });
  });

  it("normalizes records with a detached receiver-independent method", () => {
    const { normalize } = wusaClubsAdapter;

    expect(() => records.map(normalize)).not.toThrow();
    expect(records.map(normalize)).toHaveLength(3);
  });

  it("creates stable source-namespaced fingerprints", () => {
    const fingerprint = wusaClubsAdapter.sourceFingerprint(records[0]);

    expect(fingerprint).toBe(wusaClubsAdapter.sourceFingerprint(records[0]));
    expect(fingerprint).not.toBe(
      createSourceFingerprint("wusa-events", records[0].sourceId),
    );
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns a structured rejection for a blank source ID without throwing", () => {
    const record = { ...records[0], sourceId: " \n\t" };

    expect(wusaClubsAdapter.sourceFingerprint(record)).toBeNull();
    expect(() => wusaClubsAdapter.normalize(record)).not.toThrow();
    expect(wusaClubsAdapter.normalize(record)).toEqual({
      ok: false,
      rejection: {
        source: "wusa-clubs",
        reason: "missing-required-field",
      },
    });
  });

  it.each(["title", "organizer", "url", "location"] as const)(
    "rejects a blank required %s",
    (field) => {
      const record = { ...records[0], [field]: " \n\t" };

      expect(wusaClubsAdapter.normalize(record)).toEqual({
        ok: false,
        rejection: {
          source: "wusa-clubs",
          recordId: "club-301",
          reason: "missing-required-field",
        },
      });
    },
  );

  it("rejects non-http source URLs as missing required fields", () => {
    const record = { ...records[0], url: "javascript:alert('unsafe')" };

    expect(wusaClubsAdapter.normalize(record)).toEqual({
      ok: false,
      rejection: {
        source: "wusa-clubs",
        recordId: "club-301",
        reason: "missing-required-field",
      },
    });
  });

  it("ignores non-http image URLs", () => {
    const record = { ...records[0], image: "javascript:alert('unsafe')" };
    const result = wusaClubsAdapter.normalize(record);

    expect(result).toMatchObject({ ok: true });
    expect(result.ok && result.event.imageUrl).toBeUndefined();
  });

  it("rejects malformed dates without affecting valid records", () => {
    const malformed = { ...records[0], end: "unknown" };
    const results = [records[1], malformed].map(wusaClubsAdapter.normalize);

    expect(results[0]).toMatchObject({ ok: true });
    expect(results[1]).toEqual({
      ok: false,
      rejection: {
        source: "wusa-clubs",
        recordId: "club-301",
        reason: "invalid-date",
      },
    });
  });
});
