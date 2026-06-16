import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock("@/ingestion/refresh-canonical-events.server", () => ({
  canonicalEventRefreshCoordinator: {
    refresh: routeMocks.refresh,
  },
}));

describe("cron refresh route", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("rejects unauthorized requests", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");
    const { GET } = await import("./route");

    const response = await GET(new Request("https://example.com/api/cron/refresh-events"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(routeMocks.refresh).not.toHaveBeenCalled();
  });

  it("accepts bearer-token requests when CRON_SECRET is configured", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");
    routeMocks.refresh.mockResolvedValueOnce({
      startedAt: "2026-06-15T00:00:00.000Z",
      completedAt: "2026-06-15T00:00:10.000Z",
      sources: [{ source: "wusa-events", status: "succeeded" }],
      events: [{ id: "event-1" }],
      duplicates: [],
      persistedEventIds: ["event-1"],
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
    });
    const { GET } = await import("./route");

    const response = await GET(
      new Request("https://example.com/api/cron/refresh-events", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );

    expect(routeMocks.refresh).toHaveBeenCalledWith({ force: true });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      startedAt: "2026-06-15T00:00:00.000Z",
      completedAt: "2026-06-15T00:00:10.000Z",
      skipped: false,
      eventCount: 1,
      duplicateCount: 0,
      persistedCount: 1,
      sourceCount: 1,
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

  it("accepts x-vercel-cron when no secret is configured", async () => {
    routeMocks.refresh.mockResolvedValueOnce({
      startedAt: "2026-06-15T00:00:00.000Z",
      completedAt: "2026-06-15T00:00:10.000Z",
      sources: [],
      events: [],
      duplicates: [],
      persistedEventIds: [],
      skipped: true,
    });
    const { GET } = await import("./route");

    const response = await GET(
      new Request("https://example.com/api/cron/refresh-events", {
        headers: { "x-vercel-cron": "1" },
      }),
    );

    expect(response.status).toBe(200);
    expect(routeMocks.refresh).toHaveBeenCalledWith({ force: true });
  });

  it("returns a constrained service error when refresh fails", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");
    routeMocks.refresh.mockRejectedValueOnce(
      new Error("database unavailable at db.internal.example:5432"),
    );
    const { GET } = await import("./route");

    const response = await GET(
      new Request("https://example.com/api/cron/refresh-events", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Unable to refresh events",
    });
  });
});
