import { describe, expect, it } from "vitest";

import type { IngestionSource } from "../types";
import { runIngestion } from "../run-ingestion";

const validEvent = {
  source: "wusa-events" as const,
  sourceUrl: "https://wusa.ca/event/test/",
  sourceFingerprint: "a".repeat(64),
  title: "Test Event",
  description: "Description",
  clubName: "WUSA",
  startTime: "2026-06-18T21:00:00.000Z",
  endTime: "2026-06-18T23:00:00.000Z",
  locationName: "SLC",
  buildingCode: "SLC" as const,
  tags: [],
  isFreeFood: false,
};

const successfulSource: IngestionSource = {
  id: "wusa-events",
  url: "https://wusa.ca/events/?ical=1",
  acceptedContentTypes: ["text/calendar"],
  parse: () => [
    { ok: true, event: validEvent },
    {
      ok: true,
      event: { ...validEvent, sourceFingerprint: "invalid" },
    },
  ],
};
const failedSource: IngestionSource = {
  id: "uwaterloo-events",
  url: "https://uwaterloo.ca/events/",
  acceptedContentTypes: ["text/html"],
  parse: () => [],
};

describe("runIngestion", () => {
  it("isolates source failures and rejects invalid normalized candidates", async () => {
    const result = await runIngestion({
      sources: [successfulSource, failedSource],
      fetchText: async (source) => {
        if (source.id === "uwaterloo-events") {
          throw Object.assign(new Error("private payload must not leak"), {
            code: "http-error",
          });
        }
        return "raw";
      },
      now: () => new Date("2026-06-13T22:00:00.000Z"),
    });

    expect(result.events).toEqual([validEvent]);
    expect(result.sources).toMatchObject([
      {
        source: "wusa-events",
        status: "succeeded",
        acceptedCount: 1,
        rejectedCount: 1,
      },
      {
        source: "uwaterloo-events",
        status: "failed",
        acceptedCount: 0,
        rejectedCount: 0,
        errorCode: "http-error",
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("private payload");
  });
});
