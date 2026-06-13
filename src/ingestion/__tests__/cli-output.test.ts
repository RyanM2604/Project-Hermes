import { describe, expect, it } from "vitest";

import { buildCliOutput } from "../cli-output";
import type { IngestionRunResult } from "../types";

const run: IngestionRunResult = {
  startedAt: "2026-06-13T22:00:00.000Z",
  completedAt: "2026-06-13T22:00:01.000Z",
  sources: [
    {
      source: "wusa-events",
      sourceUrl: "https://wusa.ca/events/?ical=1",
      status: "succeeded",
      acceptedCount: 1,
      rejectedCount: 1,
      rejections: [
        {
          source: "wusa-events",
          recordId: "contact@example.com",
          reason: "invalid-candidate",
        },
      ],
    },
  ],
  events: [
    {
      source: "wusa-events",
      sourceUrl: "https://wusa.ca/event/test/",
      sourceFingerprint: "a".repeat(64),
      title: "Test event",
      description: "Contact contact@example.com for details.",
      clubName: "Test Club",
      startTime: "2026-06-18T21:00:00.000Z",
      endTime: "2026-06-18T23:00:00.000Z",
      locationName: "SLC",
      tags: [],
      isFreeFood: false,
    },
  ],
  duplicates: [],
};

describe("buildCliOutput", () => {
  it("reports useful summaries without descriptions or rejection identifiers", () => {
    const output = buildCliOutput(run);
    const serialized = JSON.stringify(output);

    expect(output).toMatchObject({
      eventCount: 1,
      duplicateCount: 0,
      sources: [
        {
          source: "wusa-events",
          status: "succeeded",
          acceptedCount: 1,
          rejectedCount: 1,
          rejectionReasons: ["invalid-candidate"],
        },
      ],
      events: [{ title: "Test event", locationName: "SLC" }],
    });
    expect(serialized).not.toContain("description");
    expect(serialized).not.toContain("contact@example.com");
  });
});
