import type { PrismaClient } from "@prisma/client";

import type { NormalizedEventCandidate } from "@/lib/events/adapters";

import { createEventContentHash } from "./content-hash";

export interface PersistedEventInput extends NormalizedEventCandidate {
  id: string;
  contentHash: string;
}

export interface EventPersistenceRepository {
  upsert(input: PersistedEventInput): Promise<{
    changed: boolean;
    eventId: string;
  }>;
}

export interface EventPersistenceResult {
  attemptedCount: number;
  persistedCount: number;
  changedCount: number;
  failedCount: number;
  persistedEventIds: string[];
  failures: {
    eventId: string;
    code: "upsert-failed";
  }[];
}

interface PrismaEventData {
  id: string;
  source: string;
  sourceFingerprint: string;
  sourceUrl: string;
  title: string;
  description: string;
  clubName: string;
  startTime: Date;
  endTime: Date;
  locationName: string;
  buildingCode: string | null;
  sourceTags: string[];
  imageUrl: string | null;
  isFreeFood: boolean;
  contentHash: string;
}

const MAX_TRANSACTION_ATTEMPTS = 3;

function eventData(input: PersistedEventInput): PrismaEventData {
  return {
    id: input.id,
    ...eventUpdateData(input),
  };
}

function eventUpdateData(
  input: PersistedEventInput,
): Omit<PrismaEventData, "id"> {
  return {
    source: input.source,
    sourceFingerprint: input.sourceFingerprint,
    sourceUrl: input.sourceUrl,
    title: input.title,
    description: input.description,
    clubName: input.clubName,
    startTime: new Date(input.startTime),
    endTime: new Date(input.endTime),
    locationName: input.locationName,
    buildingCode: input.buildingCode ?? null,
    sourceTags: input.tags,
    imageUrl: input.imageUrl ?? null,
    isFreeFood: input.isFreeFood,
    contentHash: input.contentHash,
  };
}

function isTransactionConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2034"
  );
}

export function createPrismaEventPersistenceRepository(
  client: Pick<PrismaClient, "$transaction">,
): EventPersistenceRepository {
  return {
    async upsert(input) {
      for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
        try {
          return await client.$transaction(
            async (transaction) => {
              const existing = await transaction.event.findUnique({
                where: { sourceFingerprint: input.sourceFingerprint },
                select: { contentHash: true },
              });
              const changed = existing?.contentHash !== input.contentHash;
              const data = eventData(input);
              const event = await transaction.event.upsert({
                where: { sourceFingerprint: input.sourceFingerprint },
                create: { ...data, classificationStatus: "pending" },
                update: {
                  ...eventUpdateData(input),
                  ...(changed ? { classificationStatus: "pending" } : {}),
                },
                select: { id: true },
              });

              return { changed, eventId: event.id };
            },
            { isolationLevel: "Serializable" },
          );
        } catch (error) {
          if (
            !isTransactionConflict(error) ||
            attempt === MAX_TRANSACTION_ATTEMPTS
          ) {
            throw error;
          }
        }
      }

      throw new Error("unreachable");
    },
  };
}

export async function persistEvents(
  events: readonly NormalizedEventCandidate[],
  repository: EventPersistenceRepository,
): Promise<EventPersistenceResult> {
  const result: EventPersistenceResult = {
    attemptedCount: events.length,
    persistedCount: 0,
    changedCount: 0,
    failedCount: 0,
    persistedEventIds: [],
    failures: [],
  };

  for (const candidate of events) {
    const input: PersistedEventInput = {
      ...candidate,
      id: `event-${candidate.sourceFingerprint}`,
      contentHash: createEventContentHash(candidate),
    };

    try {
      const persisted = await repository.upsert(input);
      result.persistedCount += 1;
      result.changedCount += Number(persisted.changed);
      result.persistedEventIds.push(persisted.eventId);
    } catch {
      result.failedCount += 1;
      result.failures.push({
        eventId: input.id,
        code: "upsert-failed",
      });
    }
  }

  return result;
}
