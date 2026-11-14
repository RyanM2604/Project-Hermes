import { Prisma } from "@prisma/client";

import { createFallbackClassification } from "@/lib/classification/fallback";
import { prisma } from "@/lib/db/prisma";
import type { EventPeriod } from "./feed-period";
import type { BuildingCode, EventTag, HermesEvent } from "@/types/event";

export interface PersistedEventRecord {
  id: string;
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
  endTimeEstimated?: boolean;
  supersededById?: string | null;
  isFreeFood: boolean;
  createdAt: Date;
  classificationStatus: "pending" | "classified" | "fallback" | "retry";
  classification: {
    primaryTag: string;
    tags: string[];
  } | null;
}

interface EventReadClient {
  event: {
    findMany(args: {
      include: { classification: true };
      orderBy: { startTime: "asc" | "desc" };
      where: { endTime: { gte: Date } | { lt: Date }; supersededById: null; startTime?: { lt: Date } };
    }): Promise<PersistedEventRecord[]>;
    findUnique(args: {
      where: { id: string };
      include?: { classification: true };
      select?: { id: true };
    }): Promise<PersistedEventRecord | { id: string } | null>;
  };
}

interface CreatePrismaEventRepositoryOptions {
  client: EventReadClient;
  now?: () => Date;
}

const eventTags = new Set<EventTag>([
  "free-food",
  "hack-dev",
  "career-coop",
  "general",
  "chill-social",
  "music",
  "reels",
  "startup-pitch",
]);

const buildingCodes = new Set<BuildingCode>([
  "AL",
  "DC",
  "E5",
  "EC5",
  "E7",
  "FED",
  "MC",
  "PAC",
  "QNC",
  "SCH",
  "SLC",
  "TC",
]);

const initializationAvailabilityCodes = new Set(["P1001", "P1002"]);
const requestAvailabilityCodes = new Set(["P1008", "P1017", "P2021", "P2024"]);
const missingDatabaseUrlMessage = "Environment variable not found: DATABASE_URL";

function hasDatabaseUrl(): boolean {
  if (process.env.NODE_ENV === "test") {
    return true;
  }

  return Boolean(process.env.DATABASE_URL?.trim());
}

export function isDatabaseUnavailableError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return (
      typeof error.errorCode === "string" &&
      initializationAvailabilityCodes.has(error.errorCode)
    );
  }

  if (
    error instanceof Prisma.PrismaClientValidationError &&
    error.message.includes(missingDatabaseUrlMessage)
  ) {
    return true;
  }

  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    requestAvailabilityCodes.has(error.code)
  );
}

function parseEventTag(value: string): EventTag | undefined {
  return eventTags.has(value as EventTag) ? (value as EventTag) : undefined;
}

function parseBuildingCode(value: string | null): BuildingCode | undefined {
  return value && buildingCodes.has(value as BuildingCode)
    ? (value as BuildingCode)
    : undefined;
}

function validTags(values: string[]): EventTag[] {
  return values.flatMap((value) => {
    const tag = parseEventTag(value);
    return tag ? [tag] : [];
  });
}

export function toHermesEvent(record: PersistedEventRecord): HermesEvent {
  const classification =
    record.classificationStatus === "classified" ||
    record.classificationStatus === "fallback"
      ? record.classification
      : null;
  const fallbackClassification = createFallbackClassification({
    title: record.title,
    description: record.description,
    clubName: record.clubName,
    locationName: record.locationName,
    sourceTags: [],
  });
  const classificationTags = classification
    ? validTags(classification.tags)
    : [];
  const primaryTag = classification
    ? parseEventTag(classification.primaryTag) ?? fallbackClassification.primaryTag
    : fallbackClassification.primaryTag;
  const buildingCode = parseBuildingCode(record.buildingCode);

  return {
    id: record.id,
    title: record.title,
    description: record.description,
    clubName: record.clubName,
    startTime: record.startTime.toISOString(),
    endTime: record.endTime.toISOString(),
    locationName: record.locationName,
    ...(buildingCode ? { buildingCode } : {}),
    tags:
      classificationTags.length > 0
        ? classificationTags
        : fallbackClassification.tags,
    ...(primaryTag ? { primaryTag } : {}),
    ...(record.imageUrl ? { imageUrl: record.imageUrl } : {}),
    ...(record.endTimeEstimated ? { endTimeEstimated: true } : {}),
    sourceUrl: record.sourceUrl,
    isFreeFood: record.isFreeFood,
    createdAt: record.createdAt.toISOString(),
  };
}

export function createPrismaEventRepository({
  client,
  now = () => new Date(),
}: CreatePrismaEventRepositoryOptions) {
  async function getEvents(options: { period?: EventPeriod; startsBefore?: Date; throwOnUnavailable?: boolean } = {}): Promise<HermesEvent[]> {
    const currentTime = now();

    if (!hasDatabaseUrl()) {
      if (options.throwOnUnavailable) throw new Error("Event database is not configured");
      return [];
    }

    let records: PersistedEventRecord[];

    try {
      records = await client.event.findMany({
        include: { classification: true },
        orderBy: { startTime: options.period === "past" ? "desc" : "asc" },
        where: { endTime: options.period === "past" ? { lt: currentTime } : { gte: currentTime }, supersededById: null,
          ...(options.startsBefore ? { startTime: { lt: options.startsBefore } } : {}) },
      });
    } catch (error) {
      if (isDatabaseUnavailableError(error) && !options.throwOnUnavailable) {
        return [];
      }

      throw error;
    }

    return records.map(toHermesEvent);
  }

  async function getEventById(
    eventId: string,
  ): Promise<HermesEvent | undefined> {
    if (!hasDatabaseUrl()) {
      return undefined;
    }

    let record: PersistedEventRecord | null;

    try {
      record = (await client.event.findUnique({
        include: { classification: true },
        where: { id: eventId },
      })) as PersistedEventRecord | null;
    } catch (error) {
      if (isDatabaseUnavailableError(error)) {
        return undefined;
      }

      throw error;
    }

    const visited = new Set<string>();
    while (record?.supersededById && !visited.has(record.id)) {
      visited.add(record.id);
      record = await client.event.findUnique({ where: { id: record.supersededById }, include: { classification: true } }) as PersistedEventRecord | null;
    }
    return record && !record.supersededById ? toHermesEvent(record) : undefined;
  }

  async function eventExists(eventId: string): Promise<boolean> {
    if (!hasDatabaseUrl()) {
      return false;
    }

    try {
      return Boolean(
        await client.event.findUnique({
          select: { id: true },
          where: { id: eventId },
        }),
      );
    } catch (error) {
      if (isDatabaseUnavailableError(error)) {
        return false;
      }

      throw error;
    }
  }

  return { getEvents, getEventById, eventExists };
}

const repository = createPrismaEventRepository({
  client: prisma,
});

export const { eventExists, getEventById, getEvents } = repository;
