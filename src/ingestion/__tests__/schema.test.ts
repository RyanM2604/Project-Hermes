import { describe, expect, it } from "vitest";

import { normalizedEventCandidateSchema } from "../schema";

const candidate = {
  source: "wusa-events",
  sourceUrl: "https://wusa.ca/event/test/",
  sourceFingerprint: "a".repeat(64),
  title: "Test Event",
  description: "A useful event.",
  clubName: "Test Club",
  startTime: "2026-06-18T21:00:00.000Z",
  endTime: "2026-06-18T23:00:00.000Z",
  locationName: "QNC 2501",
  buildingCode: "QNC",
  tags: ["free-food", "chill-social"],
  imageUrl: "https://wusa.ca/test.png",
  isFreeFood: true,
};

describe("normalizedEventCandidateSchema", () => {
  it("accepts a valid normalized event candidate", () => {
    expect(normalizedEventCandidateSchema.parse(candidate)).toEqual(candidate);
  });

  it("rejects unsafe URLs and invalid time ranges", () => {
    const result = normalizedEventCandidateSchema.safeParse({
      ...candidate,
      sourceUrl: "javascript:alert(1)",
      endTime: "2026-06-18T20:00:00.000Z",
    });

    expect(result.success).toBe(false);
  });
});
