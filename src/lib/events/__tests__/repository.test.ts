import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { HermesEvent } from "@/types/event";

vi.mock("@/lib/db/prisma", () => ({ prisma: { event: {} } }));

import {
  createPrismaEventRepository,
  isDatabaseUnavailableError,
  toHermesEvent,
  type PersistedEventRecord,
} from "../repository";

const classification = {
  primaryTag: "career-coop",
  tags: ["career-coop", "hack-dev"],
};
const fixedNow = new Date("2026-06-14T12:00:00.000Z");

function persistedEvent(
  overrides: Partial<PersistedEventRecord> = {},
): PersistedEventRecord {
  return {
    id: "event-canonical",
    sourceUrl: "https://example.com/events/canonical",
    title: "Canonical Event",
    description: "Read from the canonical event store.",
    clubName: "Hermes",
    startTime: new Date("2026-06-18T21:00:00.000Z"),
    endTime: new Date("2026-06-18T23:00:00.000Z"),
    locationName: "SLC Great Hall",
    buildingCode: "SLC",
    sourceTags: ["free-food", "chill-social"],
    imageUrl: "https://example.com/canonical.png",
    isFreeFood: true,
    createdAt: new Date("2026-06-13T22:00:01.000Z"),
    classificationStatus: "classified",
    classification,
    ...overrides,
  };
}

function inProgressEvent(
  overrides: Partial<PersistedEventRecord> = {},
): PersistedEventRecord {
  return persistedEvent({
    id: "event-in-progress",
    startTime: new Date("2026-06-14T10:00:00.000Z"),
    endTime: new Date("2026-06-14T13:00:00.000Z"),
    ...overrides,
  });
}

const fallbackEvent: HermesEvent = {
  id: "event-fallback",
  title: "Fallback Event",
  description: "Available when the database cannot be read.",
  clubName: "Hermes",
  startTime: "2026-06-20T17:00:00.000Z",
  endTime: "2026-06-20T18:00:00.000Z",
  locationName: "SLC",
  buildingCode: "SLC",
  tags: [],
  sourceUrl: "https://example.com/events/fallback",
  isFreeFood: false,
  createdAt: "2026-06-01T00:00:00.000Z",
};

const pastFallbackEvent: HermesEvent = {
  ...fallbackEvent,
  id: "event-past-fallback",
  title: "Past Fallback Event",
  startTime: "2026-06-13T17:00:00.000Z",
  endTime: "2026-06-13T18:00:00.000Z",
};

function createClient(records: PersistedEventRecord[] = []) {
  return {
    event: {
      findMany: vi.fn(async () => records),
      findUnique: vi.fn(
        async ({
          where,
        }: {
          where: { id: string };
          include?: { classification: true };
          select?: { id: true };
        }) => records.find(({ id }) => id === where.id) ?? null,
      ),
    },
  };
}

function databaseUnavailableError() {
  return new Prisma.PrismaClientKnownRequestError("private database details", {
    clientVersion: "test",
    code: "P2024",
  });
}

describe("isDatabaseUnavailableError", () => {
  it.each(["P1001", "P1002"])(
    "recognizes Prisma initialization availability code %s",
    (code) => {
      const error = new Prisma.PrismaClientInitializationError(
        "private database details",
        "test",
        code,
      );

      expect(isDatabaseUnavailableError(error)).toBe(true);
    },
  );

  it.each(["P1008", "P1017", "P2024"])(
    "recognizes Prisma request availability code %s",
    (code) => {
      const error = new Prisma.PrismaClientKnownRequestError(
        "private database details",
        { clientVersion: "test", code },
      );

      expect(isDatabaseUnavailableError(error)).toBe(true);
    },
  );

  it.each([
    new Error("programming error"),
    new Prisma.PrismaClientValidationError("private validation details", {
      clientVersion: "test",
    }),
    new Prisma.PrismaClientInitializationError(
      "private authentication details",
      "test",
      "P1000",
    ),
    new Prisma.PrismaClientKnownRequestError("private query details", {
      clientVersion: "test",
      code: "P2002",
    }),
  ])("does not recognize non-availability errors", (error) => {
    expect(isDatabaseUnavailableError(error)).toBe(false);
  });
});

describe("toHermesEvent", () => {
  it("maps persisted dates and valid classification tags", () => {
    const record = persistedEvent();

    expect(toHermesEvent(record)).toEqual({
      id: record.id,
      title: record.title,
      description: record.description,
      clubName: record.clubName,
      startTime: record.startTime.toISOString(),
      endTime: record.endTime.toISOString(),
      locationName: record.locationName,
      buildingCode: record.buildingCode,
      tags: classification.tags,
      primaryTag: classification.primaryTag,
      imageUrl: record.imageUrl,
      sourceUrl: record.sourceUrl,
      isFreeFood: record.isFreeFood,
      createdAt: record.createdAt.toISOString(),
    });
  });

  it("omits invalid classification tags instead of exposing them", () => {
    const event = toHermesEvent(
      persistedEvent({
        classification: {
          primaryTag: "not-a-tag",
          tags: ["music", "not-a-tag", "reels"],
        },
      }),
    );

    expect(event.tags).toEqual(["music", "reels"]);
    expect(event.primaryTag).toBeUndefined();
  });

  it("uses valid source tags only when classification is absent", () => {
    const event = toHermesEvent(
      persistedEvent({
        classification: null,
        sourceTags: ["free-food", "not-a-tag", "chill-social"],
      }),
    );

    expect(event.tags).toEqual(["free-food", "chill-social"]);
    expect(event.primaryTag).toBeUndefined();
  });

  it("uses valid source tags when classification has no valid tags", () => {
    const event = toHermesEvent(
      persistedEvent({
        classification: {
          primaryTag: "not-a-tag",
          tags: ["not-a-tag", "also-not-a-tag"],
        },
        sourceTags: ["free-food", "not-a-tag", "chill-social"],
      }),
    );

    expect(event.tags).toEqual(["free-food", "chill-social"]);
    expect(event.primaryTag).toBeUndefined();
  });

  it.each(["pending", "retry"] as const)(
    "ignores stale classification when status is %s",
    (classificationStatus) => {
      const event = toHermesEvent(
        persistedEvent({
          classificationStatus,
          classification,
          sourceTags: ["free-food", "chill-social"],
        }),
      );

      expect(event.tags).toEqual(["free-food", "chill-social"]);
      expect(event.primaryTag).toBeUndefined();
    },
  );

  it.each(["classified", "fallback"] as const)(
    "uses current classification when status is %s",
    (classificationStatus) => {
      const event = toHermesEvent(
        persistedEvent({
          classificationStatus,
          classification,
          sourceTags: ["free-food", "chill-social"],
        }),
      );

      expect(event.tags).toEqual(classification.tags);
      expect(event.primaryTag).toBe(classification.primaryTag);
    },
  );
});

describe("createPrismaEventRepository", () => {
  it("queries upcoming events in chronological order", async () => {
    const client = createClient([persistedEvent()]);
    const repository = createPrismaEventRepository({
      client,
      fallbackEvents: [fallbackEvent],
      now: () => fixedNow,
    });

    await repository.getEvents();

    expect(client.event.findMany).toHaveBeenCalledWith({
      include: { classification: true },
      orderBy: { startTime: "asc" },
      where: { endTime: { gte: fixedNow } },
    });
  });

  it("includes events that have started but not ended", async () => {
    const record = inProgressEvent();
    const client = createClient([record]);
    const repository = createPrismaEventRepository({
      client,
      fallbackEvents: [fallbackEvent],
      now: () => fixedNow,
    });

    await expect(repository.getEvents()).resolves.toEqual([toHermesEvent(record)]);
  });

  it("reads an event by id from Prisma", async () => {
    const record = persistedEvent();
    const client = createClient([record]);
    const repository = createPrismaEventRepository({
      client,
      fallbackEvents: [fallbackEvent],
      now: () => fixedNow,
    });

    await expect(repository.getEventById(record.id)).resolves.toEqual(
      toHermesEvent(record),
    );
    expect(client.event.findUnique).toHaveBeenCalledWith({
      include: { classification: true },
      where: { id: record.id },
    });
  });

  it("checks canonical event existence directly without mock fallback", async () => {
    const record = persistedEvent();
    const client = createClient([record]);
    const repository = createPrismaEventRepository({
      client,
      fallbackEvents: [fallbackEvent],
      now: () => fixedNow,
    });

    await expect(repository.eventExists(record.id)).resolves.toBe(true);
    await expect(repository.eventExists("missing")).resolves.toBe(false);
    await expect(repository.eventExists(fallbackEvent.id)).resolves.toBe(false);
    expect(client.event.findUnique).toHaveBeenCalledWith({
      select: { id: true },
      where: { id: record.id },
    });
  });

  it("rejects canonical existence checks when Prisma is unavailable", async () => {
    const client = createClient();
    client.event.findUnique.mockRejectedValue(
      new Error("database unavailable"),
    );
    const repository = createPrismaEventRepository({
      client,
      fallbackEvents: [fallbackEvent],
      now: () => fixedNow,
    });

    await expect(repository.eventExists(fallbackEvent.id)).rejects.toThrow(
      "database unavailable",
    );
  });

  it("does not replace mapping failures with fallback events", async () => {
    const client = createClient([
      persistedEvent({
        startTime: "malformed" as unknown as Date,
      }),
    ]);
    const repository = createPrismaEventRepository({
      client,
      fallbackEvents: [fallbackEvent],
      now: () => fixedNow,
    });

    await expect(repository.getEvents()).rejects.toThrow();
  });

  it("falls back for browsing and detail reads when the database is unavailable", async () => {
    const client = createClient();
    client.event.findMany.mockRejectedValue(databaseUnavailableError());
    client.event.findUnique.mockRejectedValue(databaseUnavailableError());
    const repository = createPrismaEventRepository({
      client,
      fallbackEvents: [fallbackEvent, pastFallbackEvent],
      now: () => fixedNow,
    });

    await expect(repository.getEvents()).resolves.toEqual([fallbackEvent]);
    await expect(
      repository.getEventById(pastFallbackEvent.id),
    ).resolves.toEqual(pastFallbackEvent);
    await expect(repository.getEventById(fallbackEvent.id)).resolves.toEqual(
      fallbackEvent,
    );
    await expect(repository.getEventById("missing")).resolves.toBeUndefined();
  });

  it("uses fallback events immediately when DATABASE_URL is missing", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("NODE_ENV", "development");

    try {
      const client = createClient();
      const inProgressFallbackEvent: HermesEvent = {
        ...fallbackEvent,
        id: "event-in-progress-fallback",
        startTime: "2026-06-14T10:00:00.000Z",
        endTime: "2026-06-14T13:00:00.000Z",
      };
      const repository = createPrismaEventRepository({
        client,
        fallbackEvents: [inProgressFallbackEvent, pastFallbackEvent],
        now: () => fixedNow,
      });

      await expect(repository.getEvents()).resolves.toEqual([
        inProgressFallbackEvent,
      ]);
      await expect(
        repository.getEventById(inProgressFallbackEvent.id),
      ).resolves.toEqual(inProgressFallbackEvent);
      await expect(repository.eventExists(fallbackEvent.id)).resolves.toBe(
        false,
      );
      expect(client.event.findMany).not.toHaveBeenCalled();
      expect(client.event.findUnique).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("propagates unrecognized query errors instead of returning fallback events", async () => {
    const queryError = new Prisma.PrismaClientValidationError(
      "private validation details",
      { clientVersion: "test" },
    );
    const client = createClient();
    client.event.findMany.mockRejectedValue(queryError);
    client.event.findUnique.mockRejectedValue(queryError);
    const repository = createPrismaEventRepository({
      client,
      fallbackEvents: [fallbackEvent],
      now: () => fixedNow,
    });

    await expect(repository.getEvents()).rejects.toBe(queryError);
    await expect(repository.getEventById(fallbackEvent.id)).rejects.toBe(
      queryError,
    );
  });

  it("does not expose fallback events in production when DATABASE_URL is missing", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("NODE_ENV", "production");

    try {
      const repository = createPrismaEventRepository({
        allowFallbackEvents: false,
        client: createClient(),
        fallbackEvents: [fallbackEvent],
        now: () => fixedNow,
      });

      await expect(repository.getEvents()).resolves.toEqual([]);
      await expect(
        repository.getEventById(fallbackEvent.id),
      ).resolves.toBeUndefined();
      await expect(repository.eventExists(fallbackEvent.id)).resolves.toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("does not expose fallback events in production when the database is unavailable", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://configured");
    vi.stubEnv("NODE_ENV", "production");

    try {
      const client = createClient();
      client.event.findMany.mockRejectedValue(databaseUnavailableError());
      client.event.findUnique.mockRejectedValue(databaseUnavailableError());
      const repository = createPrismaEventRepository({
        allowFallbackEvents: false,
        client,
        fallbackEvents: [fallbackEvent],
        now: () => fixedNow,
      });

      await expect(repository.getEvents()).resolves.toEqual([]);
      await expect(
        repository.getEventById(fallbackEvent.id),
      ).resolves.toBeUndefined();
      await expect(repository.eventExists(fallbackEvent.id)).resolves.toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
