import type { Prisma, PrismaClient } from "@prisma/client";
import { coordinates, isInWaterloo, locationKey, geocodingQuery } from "./geocoding";

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
  sourceImageUrl?: string | null;
  imageContentHash?: string | null;
  endTimeEstimated?: boolean;
  isFreeFood: boolean;
  contentHash: string;
}

const MAX_TRANSACTION_ATTEMPTS = 3;

export async function persistSourceLocation(client: Pick<Prisma.TransactionClient, "eventGeocode">, eventId: string, input: NormalizedEventCandidate) {
  const point = coordinates(input.latitude, input.longitude);
  if (!point) return;
  const data = { locationKey: locationKey(input), query: geocodingQuery(input) ?? input.locationName,
    status: isInWaterloo(point) ? "resolved" : "outside", latitude: point[1], longitude: point[0],
    displayName: input.locationName, source: "source", checkedAt: new Date(), retryAfter: null };
  await client.eventGeocode.upsert({ where: { eventId }, create: { eventId, ...data }, update: data });
}

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
    ...(input.endTimeEstimated !== undefined ? { endTimeEstimated: input.endTimeEstimated } : {}),
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
              if (input.source !== "instagram-clubs" && transaction.$executeRaw) await transaction.$executeRaw`SELECT pg_advisory_xact_lock(80411233)`;
              const existing = await transaction.event.findUnique({
                where: { sourceFingerprint: input.sourceFingerprint },
                select: { id: true, contentHash: true, imageUrl: true, sourceImageUrl: true, imageContentHash: true },
              });
              const changed = existing?.contentHash !== input.contentHash;
              const data = eventData(input);
              const incomingImage = input.imageUrl ?? null;
              function identity(url: string | null | undefined) { try { const value = new URL(url ?? ""); return value.origin + value.pathname; } catch { return url; } }
              const preserved = existing?.imageUrl && (!incomingImage || (existing.sourceImageUrl && identity(existing.sourceImageUrl) === identity(incomingImage)));
              const imageData = { ...(input.source !== "instagram-clubs" ? { endTimeEstimated: input.endTimeEstimated ?? false } : {}), sourceImageUrl: incomingImage ?? existing?.sourceImageUrl ?? null, imageUrl: preserved ? existing.imageUrl : incomingImage, imageContentHash: preserved ? existing.imageContentHash : null };
              // Official records arriving later adopt an existing social event ID.
              // This keeps existing RSVP/save references valid and prevents a duplicate card.
              if (!existing && input.source !== "instagram-clubs" && transaction.event.findMany) {
                const possible = await transaction.event.findMany({ where: { source: "instagram-clubs", supersededById: null, startTime: new Date(input.startTime) }, orderBy: { createdAt: "asc" } });
                const key = (value: string) => value.normalize("NFKD").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
                const social = possible.find((event) => key(event.title) === key(input.title) && key(event.locationName) === key(input.locationName));
                if (social) {
                  const event = await transaction.event.update({ where: { id: social.id }, data: { ...eventUpdateData(input), ...imageData, ...(social.imageUrl?.includes("/storage/v1/object/public/") ? { imageUrl: social.imageUrl } : {}), classificationStatus: "pending" }, select: { id: true } });
                  await persistSourceLocation(transaction, event.id, input);
                  return { changed: true, eventId: event.id };
                }
              }
              const event = await transaction.event.upsert({
                where: { sourceFingerprint: input.sourceFingerprint },
                create: { ...data, ...imageData, classificationStatus: "pending" },
                update: {
                  ...eventUpdateData(input),
                  ...imageData,
                  ...(changed ? { classificationStatus: "pending" } : {}),
                },
                select: { id: true },
              });

              await persistSourceLocation(transaction, event.id, input);
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
