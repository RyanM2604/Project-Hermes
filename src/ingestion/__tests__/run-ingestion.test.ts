import { describe, expect, it, vi } from "vitest";

import { createInstagramSource } from "../sources/instagram-public";
import type { IngestionSource } from "../types";
import { runIngestion } from "../run-ingestion";

const fetchApifyInstagramPosts = vi.hoisted(() => vi.fn());

vi.mock("../fetch-apify", () => ({
  fetchApifyInstagramPosts,
}));

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

const instagramSource = createInstagramSource({
  clubName: "UW Cheese Club",
  instagramHandle: "uwcheeseclub",
  profileUrl: "https://www.instagram.com/uwcheeseclub/",
  active: true,
  priority: 1,
});

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
      validateSourceUrl: async () => true,
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

  it("rejects confirmed dead event source URLs before persistence", async () => {
    const upsert = vi.fn(async () => ({
      changed: true,
      eventId: `event-${validEvent.sourceFingerprint}`,
    }));

    const result = await runIngestion({
      sources: [successfulSource],
      fetchText: async () => "raw",
      validateSourceUrl: async (url) => url !== validEvent.sourceUrl,
      persistence: { upsert },
      now: () => new Date("2026-06-13T22:00:00.000Z"),
    });

    expect(result.events).toEqual([]);
    expect(result.sources[0]).toMatchObject({
      acceptedCount: 0,
      rejectedCount: 2,
      rejections: expect.arrayContaining([
        expect.objectContaining({
          recordId: validEvent.sourceFingerprint,
          reason: "dead-source-url",
        }),
      ]),
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("routes instagram-clubs through the Apify fetch helper", async () => {
    fetchApifyInstagramPosts.mockResolvedValue([
      {
        shortCode: "DZpt0I1ESPa",
        caption:
          "UW Cheese Club Fall Social\nJoin us on June 20, 2026 at 7 PM in SLC for free pizza and games.",
        timestamp: "2026-06-20T19:00:00.000Z",
        locationName: "SLC Great Hall",
        url: "https://www.instagram.com/p/DZpt0I1ESPa/",
      },
    ]);

    const result = await runIngestion({
      sources: [instagramSource],
      validateSourceUrl: async () => true,
      now: () => new Date("2026-06-13T22:00:00.000Z"),
    });

    expect(fetchApifyInstagramPosts).toHaveBeenCalledWith(instagramSource);
    expect(result.sources[0]).toMatchObject({
      source: "instagram-clubs",
      status: "succeeded",
      acceptedCount: 1,
      rejectedCount: 0,
    });
    expect(result.events).toHaveLength(1);
  });
});
