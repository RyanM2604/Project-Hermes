import { describe, expect, it } from "vitest";

import { buildCliOutput } from "../cli-output";
import type { CanonicalEventRefreshResult } from "../types";
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

const refreshRun: CanonicalEventRefreshResult = {
  ...run,
  persistedEventIds: ["event-a"],
  skipped: false,
  classification: {
    attemptedCount: 1,
    classifiedCount: 1,
    fallbackCount: 0,
    skippedCount: 0,
    failedCount: 0,
    diagnostics: {
      invalidOutputCount: 0,
      unavailable: {},
      unexpectedErrorCount: 0,
    },
  },
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

  it("includes classification counts when refresh output is available", () => {
    const output = buildCliOutput(refreshRun);

    expect(output).toMatchObject({
      classification: {
        attemptedCount: 1,
        classifiedCount: 1,
        fallbackCount: 0,
        skippedCount: 0,
        failedCount: 0,
        diagnostics: {
          invalidOutputCount: 0,
          unavailable: {},
          unexpectedErrorCount: 0,
        },
      },
    });
  });
});
