import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import type { BuildingCode, EventTag, HermesEvent } from "@/types/event";

import { mockEvents } from "./mock-events";

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
      orderBy: { startTime: "asc" };
      where: { endTime: { gte: Date } };
    }): Promise<PersistedEventRecord[]>;
    findUnique(args: {
      where: { id: string };
      include?: { classification: true };
      select?: { id: true };
    }): Promise<PersistedEventRecord | { id: string } | null>;
  };
}

interface CreatePrismaEventRepositoryOptions {
  allowFallbackEvents?: boolean;
  client: EventReadClient;
  fallbackEvents: readonly HermesEvent[];
  now?: () => Date;
}

const eventTags = new Set<EventTag>([
  "free-food",
  "hack-dev",
  "career-coop",
  "chill-social",
  "music",
  "reels",
  "startup-pitch",
]);

const buildingCodes = new Set<BuildingCode>([
  "AL",
  "DC",
  "E5",
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
const requestAvailabilityCodes = new Set(["P1008", "P1017", "P2024"]);

function hasDatabaseUrl(): boolean {
  if (process.env.NODE_ENV === "test") {
    return true;
  }

  return Boolean(process.env.DATABASE_URL?.trim());
}

function fallbackEventExists(
  fallbackEvents: readonly HermesEvent[],
  eventId: string,
): boolean {
  return fallbackEvents.some((event) => event.id === eventId);
}

export function isDatabaseUnavailableError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return (
      typeof error.errorCode === "string" &&
      initializationAvailabilityCodes.has(error.errorCode)
    );
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
  const classificationTags = classification
    ? validTags(classification.tags)
    : [];
  const primaryTag = classification
    ? parseEventTag(classification.primaryTag)
    : undefined;
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
        : validTags(record.sourceTags),
    // Source tags have no persisted primary-tag intent, so they are not used here.
    ...(primaryTag ? { primaryTag } : {}),
    ...(record.imageUrl ? { imageUrl: record.imageUrl } : {}),
    sourceUrl: record.sourceUrl,
    isFreeFood: record.isFreeFood,
    createdAt: record.createdAt.toISOString(),
  };
}

function upcomingFallbackEvents(
  fallbackEvents: readonly HermesEvent[],
  now: Date,
): HermesEvent[] {
  return fallbackEvents
    .filter((event) => new Date(event.endTime) >= now)
    .sort(
      (left, right) =>
        new Date(left.startTime).getTime() -
        new Date(right.startTime).getTime(),
    );
}

export function createPrismaEventRepository({
  allowFallbackEvents = process.env.NODE_ENV !== "production",
  client,
  fallbackEvents,
  now = () => new Date(),
}: CreatePrismaEventRepositoryOptions) {
  async function getEvents(): Promise<HermesEvent[]> {
    const currentTime = now();

    if (!hasDatabaseUrl()) {
      return allowFallbackEvents
        ? upcomingFallbackEvents(fallbackEvents, currentTime)
        : [];
    }

    let records: PersistedEventRecord[];

    try {
      records = await client.event.findMany({
        include: { classification: true },
        orderBy: { startTime: "asc" },
        where: { endTime: { gte: currentTime } },
      });
    } catch (error) {
      if (isDatabaseUnavailableError(error)) {
        return allowFallbackEvents
          ? upcomingFallbackEvents(fallbackEvents, currentTime)
          : [];
      }

      throw error;
    }

    return records.map(toHermesEvent);
  }

  async function getEventById(
    eventId: string,
  ): Promise<HermesEvent | undefined> {
    if (!hasDatabaseUrl()) {
      return allowFallbackEvents
        ? fallbackEvents.find((event) => event.id === eventId)
        : undefined;
    }

    let record: PersistedEventRecord | null;

    try {
      record = (await client.event.findUnique({
        include: { classification: true },
        where: { id: eventId },
      })) as PersistedEventRecord | null;
    } catch (error) {
      if (isDatabaseUnavailableError(error)) {
        return allowFallbackEvents
          ? fallbackEvents.find((event) => event.id === eventId)
          : undefined;
      }

      throw error;
    }

    return record ? toHermesEvent(record) : undefined;
  }

  async function eventExists(eventId: string): Promise<boolean> {
    if (!hasDatabaseUrl()) {
      return allowFallbackEvents && fallbackEventExists(fallbackEvents, eventId);
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
        return allowFallbackEvents && fallbackEventExists(fallbackEvents, eventId);
      }

      throw error;
    }
  }

  return { getEvents, getEventById, eventExists };
}

const repository = createPrismaEventRepository({
  client: prisma,
  fallbackEvents: mockEvents,
});

export const { eventExists, getEventById, getEvents } = repository;
