import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { NormalizedEventCandidate } from "@/lib/events/adapters";
import { buildCliOutput } from "@/ingestion/cli-output";
import { runIngestion } from "@/ingestion/run-ingestion";
import type { IngestionSource } from "@/ingestion/types";

import { createEventContentHash } from "../content-hash";
import {
  createPrismaEventPersistenceRepository,
  persistEvents,
  type EventPersistenceRepository,
  type PersistedEventInput,
} from "../persistence";

const candidate: NormalizedEventCandidate = {
  source: "wusa-events",
  sourceUrl: "https://wusa.ca/event/free-food-social",
  sourceFingerprint: "a".repeat(64),
  title: "Free Food Social",
  description: "Meet other students.",
  clubName: "WUSA",
  startTime: "2026-06-18T21:00:00.000Z",
  endTime: "2026-06-18T23:00:00.000Z",
  locationName: "SLC Great Hall",
  buildingCode: "SLC",
  tags: ["free-food", "chill-social"],
  imageUrl: "https://wusa.ca/images/free-food-social.png",
  isFreeFood: true,
};

function persistedInput(
  overrides: Partial<PersistedEventInput> = {},
): PersistedEventInput {
  return {
    ...candidate,
    id: `event-${candidate.sourceFingerprint}`,
    contentHash: createEventContentHash(candidate),
    ...overrides,
  };
}

function prismaRepositoryHarness(existingContentHash: string | null) {
  const upsert = vi.fn(async () => ({
    id: `event-${candidate.sourceFingerprint}`,
  }));
  const transactionEvent = {
    findUnique: vi.fn(async () =>
      existingContentHash === null
        ? null
        : { contentHash: existingContentHash },
    ),
    upsert,
  };
  const client = {
    $transaction: vi.fn(
      async (operation: (transaction: typeof transactionClient) => unknown) =>
        operation(transactionClient),
    ),
  };
  const transactionClient = { event: transactionEvent };

  return {
    client,
    repository: createPrismaEventPersistenceRepository(
      client as unknown as Pick<PrismaClient, "$transaction">,
    ),
    transactionEvent,
    upsert,
  };
}

describe("persistEvents", () => {
  it("passes a stable event id and content hash to the repository", async () => {
    const upsert = vi.fn<EventPersistenceRepository["upsert"]>(
      async (input) => ({ changed: true, eventId: input.id }),
    );

    const result = await persistEvents([candidate], { upsert });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: `event-${candidate.sourceFingerprint}`,
        contentHash: createEventContentHash(candidate),
      }),
    );
    expect(result).toEqual({
      attemptedCount: 1,
      persistedCount: 1,
      changedCount: 1,
      failedCount: 0,
      persistedEventIds: [`event-${candidate.sourceFingerprint}`],
      failures: [],
    });
  });

  it("isolates failures and never exposes exception messages", async () => {
    const laterCandidate = {
      ...candidate,
      sourceFingerprint: "b".repeat(64),
      title: "Later event",
    };
    const attemptedIds: string[] = [];
    const repository: EventPersistenceRepository = {
      upsert: async (input) => {
        attemptedIds.push(input.id);
        if (input.sourceFingerprint === candidate.sourceFingerprint) {
          throw new Error("private database details");
        }
        return { changed: false, eventId: input.id };
      },
    };

    const result = await persistEvents([candidate, laterCandidate], repository);

    expect(attemptedIds).toEqual([
      `event-${candidate.sourceFingerprint}`,
      `event-${laterCandidate.sourceFingerprint}`,
    ]);
    expect(result).toEqual({
      attemptedCount: 2,
      persistedCount: 1,
      changedCount: 0,
      failedCount: 1,
      persistedEventIds: [`event-${laterCandidate.sourceFingerprint}`],
      failures: [
        {
          eventId: `event-${candidate.sourceFingerprint}`,
          code: "upsert-failed",
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("private database details");
  });
});

describe("createPrismaEventPersistenceRepository", () => {
  it("retains classification status when content is unchanged", async () => {
    const input = persistedInput();
    const { client, repository, upsert } = prismaRepositoryHarness(
      input.contentHash,
    );

    await expect(repository.upsert(input)).resolves.toEqual({
      changed: false,
      eventId: input.id,
    });

    expect(client.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.not.objectContaining({
          classificationStatus: expect.anything(),
        }),
      }),
    );
  });

  it("sets classification status to pending when content changes", async () => {
    const input = persistedInput();
    const { repository, upsert } = prismaRepositoryHarness("old-content-hash");

    await expect(repository.upsert(input)).resolves.toEqual({
      changed: true,
      eventId: input.id,
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ classificationStatus: "pending" }),
        update: expect.objectContaining({ classificationStatus: "pending" }),
      }),
    );
  });

  it("retries serializable transaction conflicts", async () => {
    const input = persistedInput();
    const harness = prismaRepositoryHarness(input.contentHash);
    harness.client.$transaction
      .mockRejectedValueOnce({ code: "P2034" })
      .mockImplementationOnce(async (operation) =>
        operation({ event: harness.transactionEvent }),
      );

    await expect(harness.repository.upsert(input)).resolves.toEqual({
      changed: false,
      eventId: input.id,
    });
    expect(harness.client.$transaction).toHaveBeenCalledTimes(2);
  });
});

describe("ingestion persistence", () => {
  it("omits persistence from the run result and CLI output when not configured", async () => {
    const source: IngestionSource = {
      id: "wusa-events",
      url: "https://wusa.ca/events/?ical=1",
      acceptedContentTypes: ["text/calendar"],
      parse: () => [{ ok: true, event: candidate }],
    };

    const result = await runIngestion({
      sources: [source],
      fetchText: async () => "raw",
      now: () => new Date("2026-06-13T22:00:00.000Z"),
    });
    const output = buildCliOutput(result);

    expect(result).not.toHaveProperty("persistence");
    expect(output).not.toHaveProperty("persistence");
  });

  it("includes persistence counts and constrained failures in run and CLI output", async () => {
    const source: IngestionSource = {
      id: "wusa-events",
      url: "https://wusa.ca/events/?ical=1",
      acceptedContentTypes: ["text/calendar"],
      parse: () => [{ ok: true, event: candidate }],
    };
    const persistence: EventPersistenceRepository = {
      upsert: async () => {
        throw new Error("private database details");
      },
    };

    const result = await runIngestion({
      sources: [source],
      fetchText: async () => "raw",
      persistence,
      now: () => new Date("2026-06-13T22:00:00.000Z"),
    });
    const output = buildCliOutput(result);

    expect(result.persistence).toEqual({
      attemptedCount: 1,
      persistedCount: 0,
      changedCount: 0,
      failedCount: 1,
      persistedEventIds: [],
      failures: [
        {
          eventId: `event-${candidate.sourceFingerprint}`,
          code: "upsert-failed",
        },
      ],
    });
    expect(output).toMatchObject({ persistence: result.persistence });
    expect(JSON.stringify({ result, output })).not.toContain(
      "private database details",
    );
  });
});
