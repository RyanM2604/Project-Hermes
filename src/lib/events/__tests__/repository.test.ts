import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

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

  it("recognizes Prisma missing-table request errors during setup", () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      "The table public.events does not exist in the current database.",
      { clientVersion: "test", code: "P2021" },
    );

    expect(isDatabaseUnavailableError(error)).toBe(true);
  });

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

  it("recognizes Prisma validation errors caused by missing DATABASE_URL", () => {
    const error = new Prisma.PrismaClientValidationError(
      "Invalid invocation. Environment variable not found: DATABASE_URL",
      { clientVersion: "test" },
    );

    expect(isDatabaseUnavailableError(error)).toBe(true);
  });
});

describe("strict map reads", () => {
  it("surfaces an outage and bounds the start time without changing feed defaults", async () => {
    const client = createClient();
    const repository = createPrismaEventRepository({ client, now: () => fixedNow });
    const startsBefore = new Date("2026-06-16T12:00:00Z");
    await repository.getEvents({ startsBefore, throwOnUnavailable: true });
    expect(client.event.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ startTime: { lt: startsBefore }, supersededById: null }),
    }));
    client.event.findMany.mockRejectedValue(databaseUnavailableError());
    await expect(repository.getEvents({ throwOnUnavailable: true })).rejects.toThrow();
    await expect(repository.getEvents()).resolves.toEqual([]);
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
    expect(event.primaryTag).toBe("general");
  });

  it("uses a sanitized fallback when classification is absent", () => {
    const event = toHermesEvent(
      persistedEvent({
        classification: null,
        sourceTags: ["free-food", "not-a-tag", "chill-social"],
      }),
    );

    expect(event.tags).toEqual(["general"]);
    expect(event.primaryTag).toBe("general");
  });

  it("uses a sanitized fallback when classification has no valid tags", () => {
    const event = toHermesEvent(
      persistedEvent({
        classification: {
          primaryTag: "not-a-tag",
          tags: ["not-a-tag", "also-not-a-tag"],
        },
        sourceTags: ["free-food", "not-a-tag", "chill-social"],
      }),
    );

    expect(event.tags).toEqual(["general"]);
    expect(event.primaryTag).toBe("general");
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

      expect(event.tags).toEqual(["general"]);
      expect(event.primaryTag).toBe("general");
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
      now: () => fixedNow,
    });

    await repository.getEvents();

    expect(client.event.findMany).toHaveBeenCalledWith({
      include: { classification: true },
      orderBy: { startTime: "asc" },
      where: { endTime: { gte: fixedNow }, supersededById: null },
    });
  });

  it("excludes earlier-started ranges from Upcoming while retaining today's ongoing events", async () => {
    const client = createClient();
    const repository = createPrismaEventRepository({ client, now: () => fixedNow });
    await repository.getEvents({ period: "upcoming" });
    expect(client.event.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { endTime: { gte: fixedNow }, startTime: { gte: new Date("2026-06-14T04:00:00Z") }, supersededById: null } }));
  });
  it("queries past events newest first with no overlap at the end-time boundary", async () => {
    const client = createClient([persistedEvent()]);
    const repository = createPrismaEventRepository({ client, now: () => fixedNow });
    await repository.getEvents({ period: "past" });
    expect(client.event.findMany).toHaveBeenCalledWith({ include: { classification: true }, orderBy: { startTime: "desc" }, where: { OR: [{ endTime: { lt: fixedNow } }, { startTime: { lt: new Date("2026-06-14T04:00:00Z") } }], supersededById: null } });
  });

  it("includes events that have started but not ended", async () => {
    const record = inProgressEvent();
    const client = createClient([record]);
    const repository = createPrismaEventRepository({
      client,
      now: () => fixedNow,
    });

    await expect(repository.getEvents()).resolves.toEqual([toHermesEvent(record)]);
  });

  it("reads an event by id from Prisma", async () => {
    const record = persistedEvent();
    const client = createClient([record]);
    const repository = createPrismaEventRepository({
      client,
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

  it("checks canonical event existence directly", async () => {
    const record = persistedEvent();
    const client = createClient([record]);
    const repository = createPrismaEventRepository({
      client,
      now: () => fixedNow,
    });

    await expect(repository.eventExists(record.id)).resolves.toBe(true);
    await expect(repository.eventExists("missing")).resolves.toBe(false);
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
      now: () => fixedNow,
    });

    await expect(repository.eventExists("event-missing")).rejects.toThrow(
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
      now: () => fixedNow,
    });

    await expect(repository.getEvents()).rejects.toThrow();
  });

  it("returns no events when the database is unavailable", async () => {
    const client = createClient();
    client.event.findMany.mockRejectedValue(databaseUnavailableError());
    client.event.findUnique.mockRejectedValue(databaseUnavailableError());
    const repository = createPrismaEventRepository({
      client,
      now: () => fixedNow,
    });

    await expect(repository.getEvents()).resolves.toEqual([]);
    await expect(repository.getEventById("missing")).resolves.toBeUndefined();
    await expect(repository.eventExists("missing")).resolves.toBe(false);
  });

  it("returns no events when Prisma throws missing DATABASE_URL validation errors", async () => {
    const envValidationError = new Prisma.PrismaClientValidationError(
      "Invalid invocation. Environment variable not found: DATABASE_URL",
      { clientVersion: "test" },
    );
    const client = createClient();
    client.event.findMany.mockRejectedValue(envValidationError);
    client.event.findUnique.mockRejectedValue(envValidationError);
    const repository = createPrismaEventRepository({
      client,
      now: () => fixedNow,
    });

    await expect(repository.getEvents()).resolves.toEqual([]);
    await expect(repository.getEventById("missing")).resolves.toBeUndefined();
    await expect(repository.eventExists("missing")).resolves.toBe(false);
  });

  it("returns no events immediately when DATABASE_URL is missing", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("NODE_ENV", "development");

    try {
      const client = createClient();
      const repository = createPrismaEventRepository({
        client,
        now: () => fixedNow,
      });

      await expect(repository.getEvents()).resolves.toEqual([]);
      await expect(repository.getEventById("missing")).resolves.toBeUndefined();
      await expect(repository.eventExists("missing")).resolves.toBe(false);
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
      now: () => fixedNow,
    });

    await expect(repository.getEvents()).rejects.toBe(queryError);
    await expect(repository.getEventById("event-missing")).rejects.toBe(
      queryError,
    );
  });

});
