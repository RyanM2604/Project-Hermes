import "server-only";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { HermesEvent } from "@/types/event";

export type HeroPreviewEvent = Pick<HermesEvent, "id" | "title" | "clubName" | "locationName" | "imageUrl" | "startTime">;

/** Keep the marketing preview small and independent of scraping or AI services. */
export async function loadHeroEvents({ client = prisma, now = new Date() }: { client?: Pick<PrismaClient, "event">; now?: Date } = {}): Promise<HeroPreviewEvent[]> {
  try {
    const events = await client.event.findMany({
      where: { startTime: { gte: now }, endTime: { gte: now }, supersededById: null, imageUrl: { not: null } },
      orderBy: { startTime: "asc" },
      take: 2,
      select: { id: true, title: true, clubName: true, locationName: true, imageUrl: true, startTime: true },
    });
    return events.map((event) => ({ ...event, imageUrl: event.imageUrl ?? undefined, startTime: event.startTime.toISOString() }));
  } catch {
    // The main discovery CTA remains available during a database outage.
    return [];
  }
}
