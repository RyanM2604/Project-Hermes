import { describe, expect, it } from "vitest";

import { classificationSchema } from "../schema";

const classification = {
  primaryTag: "hack-dev",
  tags: ["hack-dev", "career-coop"],
  vibes: ["focused", "professional"],
  audiences: ["technical", "career-focused"],
  format: "workshop",
  confidence: 0.85,
  rationale: "A technical career workshop.",
};

describe("classificationSchema", () => {
  it("accepts a valid classification and trims its rationale", () => {
    expect(
      classificationSchema.parse({
        ...classification,
        rationale: "  A technical career workshop.  ",
      }),
    ).toEqual(classification);
  });

  it("deduplicates supported tags at the validation boundary", () => {
    expect(
      classificationSchema.parse({
        ...classification,
        tags: ["hack-dev", "career-coop", "hack-dev"],
      }).tags,
    ).toEqual(["hack-dev", "career-coop"]);
  });

  it("rejects unsupported tags and empty or oversized tag lists", () => {
    expect(
      classificationSchema.safeParse({
        ...classification,
        tags: ["not-supported"],
      }).success,
    ).toBe(false);
    expect(
      classificationSchema.safeParse({ ...classification, tags: [] }).success,
    ).toBe(false);
    expect(
      classificationSchema.safeParse({
        ...classification,
        tags: [
          "free-food",
          "hack-dev",
          "career-coop",
          "chill-social",
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects unsupported metadata and more than three values", () => {
    expect(
      classificationSchema.safeParse({
        ...classification,
        vibes: ["focused", "social", "creative", "energetic"],
      }).success,
    ).toBe(false);
    expect(
      classificationSchema.safeParse({
        ...classification,
        audiences: ["not-supported"],
      }).success,
    ).toBe(false);
    expect(
      classificationSchema.safeParse({
        ...classification,
        format: "conference",
      }).success,
    ).toBe(false);
  });

  it("rejects confidence outside zero through one and long rationales", () => {
    expect(
      classificationSchema.safeParse({
        ...classification,
        confidence: -0.01,
      }).success,
    ).toBe(false);
    expect(
      classificationSchema.safeParse({
        ...classification,
        confidence: 1.01,
      }).success,
    ).toBe(false);
    expect(
      classificationSchema.safeParse({
        ...classification,
        rationale: "x".repeat(241),
      }).success,
    ).toBe(false);
  });
});
