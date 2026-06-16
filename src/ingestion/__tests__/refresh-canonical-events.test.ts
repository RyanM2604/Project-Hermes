import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  DEFAULT_EVENT_REFRESH_FRESHNESS_MS,
  createCanonicalEventRefreshCoordinator,
  parseEventRefreshFreshnessMs,
} from "../refresh-canonical-events";
import type { IngestionRunResult } from "../types";

const fixedNow = new Date("2026-06-14T12:00:00.000Z");

function createPersistence() {
  return {
    upsert: vi.fn(),
  };
}

function createClassificationRepository() {
  return {
    getClassificationCandidate: vi.fn(),
    saveClassification: vi.fn(),
  };
}

function createClassifier() {
  return {
    classify: vi.fn(),
  };
}

function createRunResult(
  overrides: Partial<IngestionRunResult> = {},
): IngestionRunResult {
  return {
    startedAt: fixedNow.toISOString(),
    completedAt: fixedNow.toISOString(),
    sources: [
      {
        source: "wusa-events" as const,
        sourceUrl: "https://wusa.ca/events/?ical=1",
        status: "succeeded" as const,
        acceptedCount: 1,
        rejectedCount: 0,
        rejections: [],
      },
    ],
    events: [],
    duplicates: [],
    persistence: {
      attemptedCount: 1,
      persistedCount: 1,
      changedCount: 1,
      failedCount: 0,
      failures: [],
      persistedEventIds: ["event-a"],
    },
    ...overrides,
  };
}

describe("createCanonicalEventRefreshCoordinator", () => {
  it("defaults freshness parsing when the env var is missing or invalid", () => {
    expect(parseEventRefreshFreshnessMs(undefined)).toBe(
      DEFAULT_EVENT_REFRESH_FRESHNESS_MS,
    );
    expect(parseEventRefreshFreshnessMs("")).toBe(
      DEFAULT_EVENT_REFRESH_FRESHNESS_MS,
    );
    expect(parseEventRefreshFreshnessMs("not-a-number")).toBe(
      DEFAULT_EVENT_REFRESH_FRESHNESS_MS,
    );
    expect(parseEventRefreshFreshnessMs("-1")).toBe(
      DEFAULT_EVENT_REFRESH_FRESHNESS_MS,
    );
  });

  it("parses a custom freshness window", () => {
    expect(parseEventRefreshFreshnessMs("120000")).toBe(120000);
  });

  it("uses EVENT_REFRESH_FRESHNESS_MS when present", async () => {
    vi.stubEnv("EVENT_REFRESH_FRESHNESS_MS", "1");
    try {
      let currentTime = fixedNow;
      const now = () => currentTime;
      const persistence = createPersistence();
      const runIngestion = vi.fn(async () => createRunResult());
      const classifyEvents = vi.fn(async () => ({
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
      }));
      const coordinator = createCanonicalEventRefreshCoordinator({
        databaseUrl: "postgres://test",
        now,
        persistence,
        runIngestion,
        classifyEvents,
      });

      await coordinator.refresh();
      currentTime = new Date(fixedNow.getTime() + 2);
      await coordinator.refresh();

      expect(runIngestion).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("refreshes stale data through persistence and classification", async () => {
    const persistence = createPersistence();
    const classificationRepository = createClassificationRepository();
    const classifier = createClassifier();
    const runIngestion = vi.fn(async () => createRunResult());
    const classifyEvents = vi.fn(async () => ({
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
    }));
    const coordinator = createCanonicalEventRefreshCoordinator({
      databaseUrl: "postgres://test",
      now: () => fixedNow,
      persistence,
      classificationRepository,
      classifier,
      runIngestion,
      classifyEvents,
    });

    const result = await coordinator.refresh();

    expect(runIngestion).toHaveBeenCalledWith(
      expect.objectContaining({ persistence }),
    );
    expect(classifyEvents).toHaveBeenCalledWith(
      expect.objectContaining({ eventIds: result.persistedEventIds }),
    );
  });

  it("passes reclassification requests to classification", async () => {
    const persistence = createPersistence();
    const classificationRepository = createClassificationRepository();
    const classifier = createClassifier();
    const runIngestion = vi.fn(async () => createRunResult());
    const classifyEvents = vi.fn(async () => ({
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
    }));
    const coordinator = createCanonicalEventRefreshCoordinator({
      databaseUrl: "postgres://test",
      now: () => fixedNow,
      persistence,
      classificationRepository,
      classifier,
      runIngestion,
      classifyEvents,
    });

    await coordinator.refresh({ reclassify: true });

    expect(classifyEvents).toHaveBeenCalledWith(
      expect.objectContaining({ reclassify: true }),
    );
  });


  it("skips refresh while canonical data is fresh", async () => {
    const persistence = createPersistence();
    const classificationRepository = createClassificationRepository();
    const classifier = createClassifier();
    const runIngestion = vi.fn(async () => createRunResult());
    const classifyEvents = vi.fn(async () => ({
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
    }));
    const coordinator = createCanonicalEventRefreshCoordinator({
      databaseUrl: "postgres://test",
      now: () => fixedNow,
      persistence,
      classificationRepository,
      classifier,
      runIngestion,
      classifyEvents,
    });

    await coordinator.refresh();
    await coordinator.refresh();

    expect(runIngestion).toHaveBeenCalledTimes(1);
  });

  it("coalesces concurrent refresh calls", async () => {
    const persistence = createPersistence();
    const classificationRepository = createClassificationRepository();
    const classifier = createClassifier();
    const runIngestion = vi.fn(async () => createRunResult());
    const classifyEvents = vi.fn(async () => ({
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
    }));
    const coordinator = createCanonicalEventRefreshCoordinator({
      databaseUrl: "postgres://test",
      now: () => fixedNow,
      persistence,
      classificationRepository,
      classifier,
      runIngestion,
      classifyEvents,
    });

    await Promise.all([coordinator.refresh(), coordinator.refresh()]);

    expect(runIngestion).toHaveBeenCalledTimes(1);
  });

  it("does not mark failed persistence as fresh", async () => {
    const persistence = createPersistence();
    const classificationRepository = createClassificationRepository();
    const classifier = createClassifier();
    const failedPersistenceRun = createRunResult({
      persistence: {
        attemptedCount: 1,
        persistedCount: 0,
        changedCount: 0,
        failedCount: 1,
        failures: [{ eventId: "event-a", code: "upsert-failed" as const }],
        persistedEventIds: [],
      },
    });
    const runIngestion = vi.fn(async () => failedPersistenceRun);
    const classifyEvents = vi.fn();
    const coordinator = createCanonicalEventRefreshCoordinator({
      databaseUrl: "postgres://test",
      now: () => fixedNow,
      persistence,
      classificationRepository,
      classifier,
      runIngestion,
      classifyEvents,
    });

    await coordinator.refresh();
    await coordinator.refresh();

    expect(runIngestion).toHaveBeenCalledTimes(2);
    expect(classifyEvents).not.toHaveBeenCalled();
  });
});
