import { describe, expect, it } from "vitest";

import type { NormalizedEventCandidate } from "@/lib/events/adapters";

import { deduplicateEvents } from "../dedupe-events";

function candidate(
  sourceFingerprint: string,
  overrides: Partial<NormalizedEventCandidate> = {},
): NormalizedEventCandidate {
  return {
    source: "wusa-events",
    sourceUrl: `https://wusa.ca/event/${sourceFingerprint}`,
    sourceFingerprint,
    title: "Free Food Social",
    description: "Meet other students.",
    clubName: "WUSA",
    startTime: "2026-06-18T21:00:00.000Z",
    endTime: "2026-06-18T23:00:00.000Z",
    locationName: "SLC Great Hall",
    tags: ["free-food", "chill-social"],
    isFreeFood: true,
    ...overrides,
  };
}

describe("deduplicateEvents", () => {
  it("deduplicates repeated source fingerprints", () => {
    const result = deduplicateEvents([
      candidate("same"),
      candidate("same", { title: "Updated title" }),
    ]);

    expect(result.events).toHaveLength(1);
    expect(result.duplicates).toEqual([
      {
        keptSourceFingerprint: "same",
        discardedSourceFingerprint: "same",
        reason: "source-fingerprint",
      },
    ]);
  });

  it("deduplicates cross-source title, start time, and location matches", () => {
    const result = deduplicateEvents([
      candidate("wusa"),
      candidate("uw", {
        source: "uwaterloo-events",
        sourceUrl: "https://uwaterloo.ca/events/events/free-food-social",
        title: "  FREE food social! ",
        locationName: "SLC  Great Hall",
      }),
    ]);

    expect(result.events).toHaveLength(1);
    expect(result.events[0].sourceFingerprint).toBe("wusa");
    expect(result.duplicates[0]).toMatchObject({
      keptSourceFingerprint: "wusa",
      discardedSourceFingerprint: "uw",
      reason: "canonical-signature",
    });
  });
});
