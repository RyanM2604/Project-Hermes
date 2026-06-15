import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { loadFreshEvents } from "../load-events";
import type { CanonicalEventRefreshResult } from "@/ingestion/types";
import type { HermesEvent } from "@/types/event";

const event: HermesEvent = {
  id: "event-a",
  title: "Canonical Event",
  description: "Read from canonical data.",
  clubName: "Hermes",
  startTime: "2026-06-18T21:00:00.000Z",
  endTime: "2026-06-18T23:00:00.000Z",
  locationName: "SLC",
  tags: [],
  sourceUrl: "https://example.com/events/canonical",
  isFreeFood: false,
  createdAt: "2026-06-13T22:00:00.000Z",
};

const events = [event];

const refreshResult: CanonicalEventRefreshResult = {
  startedAt: "2026-06-13T22:00:00.000Z",
  completedAt: "2026-06-13T22:00:01.000Z",
  sources: [],
  events: [],
  duplicates: [],
  persistedEventIds: [],
  skipped: true,
};

describe("loadFreshEvents", () => {
  it("serves canonical events before a background refresh when data already exists", async () => {
    const refresh = vi.fn(async () => refreshResult);
    const getEvents = vi.fn(async () => events);

    await expect(loadFreshEvents({ refresh, getEvents })).resolves.toEqual(
      events,
    );

    expect(getEvents.mock.invocationCallOrder[0]).toBeLessThan(
      refresh.mock.invocationCallOrder[0],
    );
  });

  it("refreshes and re-reads when the canonical store is initially empty", async () => {
    const refresh = vi.fn(async () => ({
      ...refreshResult,
      skipped: false,
    }));
    const getEvents = vi
      .fn<() => Promise<HermesEvent[]>>()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(events);

    await expect(loadFreshEvents({ refresh, getEvents })).resolves.toEqual(
      events,
    );

    expect(getEvents).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("serves canonical events when refresh fails", async () => {
    const refresh = vi.fn(async () => {
      throw new Error("source unavailable");
    });
    const getEvents = vi.fn(async () => events);

    await expect(loadFreshEvents({ refresh, getEvents })).resolves.toEqual(
      events,
    );
  });
});
