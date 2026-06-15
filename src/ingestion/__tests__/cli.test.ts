import { describe, expect, it, vi } from "vitest";

import type { CanonicalEventRefreshResult } from "../types";

function createRefreshResult(
  overrides: Partial<CanonicalEventRefreshResult> = {},
): CanonicalEventRefreshResult {
  return {
    startedAt: "2026-06-13T22:00:00.000Z",
    completedAt: "2026-06-13T22:00:01.000Z",
    sources: [
      {
        source: "wusa-events",
        sourceUrl: "https://wusa.ca/events/?ical=1",
        status: "succeeded" as const,
        acceptedCount: 1,
        rejectedCount: 0,
        rejections: [],
      },
    ],
    events: [],
    duplicates: [],
    persistedEventIds: ["event-a"],
    skipped: false,
    classification: {
      attemptedCount: 1,
      classifiedCount: 1,
      fallbackCount: 0,
      skippedCount: 0,
      failedCount: 0,
    },
    ...overrides,
  };
}

describe("runCli", () => {
  it("does not execute main when imported", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    try {
      vi.resetModules();
      await import("../cli");
      expect(log).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  it("forces refresh before producing output", async () => {
    vi.resetModules();
    const { runCli } = await import("../cli");
    const refresh = vi.fn(async () => createRefreshResult());
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    try {
      await expect(runCli({ refresh })).resolves.toBe(0);
      expect(refresh).toHaveBeenCalledWith({ force: true });
      expect(log).toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  it("returns a non-zero exit code when persistence fails", async () => {
    vi.resetModules();
    const { runCli } = await import("../cli");
    const refresh = vi.fn(async () =>
      createRefreshResult({
        persistence: {
          attemptedCount: 1,
          persistedCount: 0,
          changedCount: 0,
          failedCount: 1,
          persistedEventIds: [],
          failures: [{ eventId: "event-a", code: "upsert-failed" }],
        },
      }),
    );
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    try {
      await expect(runCli({ refresh })).resolves.toBe(1);
      expect(refresh).toHaveBeenCalledWith({ force: true });
      expect(log).toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  it("returns a non-zero exit code when all sources fail", async () => {
    vi.resetModules();
    const { runCli } = await import("../cli");
    const refresh = vi.fn(async () =>
      createRefreshResult({
        sources: [
          {
            source: "wusa-events",
            sourceUrl: "https://wusa.ca/events/?ical=1",
            status: "failed",
            acceptedCount: 0,
            rejectedCount: 0,
            rejections: [],
            errorCode: "http-error",
          },
        ],
        persistence: undefined,
        persistedEventIds: [],
        classification: undefined,
      }),
    );
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    try {
      await expect(runCli({ refresh })).resolves.toBe(1);
      expect(refresh).toHaveBeenCalledWith({ force: true });
      expect(log).toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });
});
