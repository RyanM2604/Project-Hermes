import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { backfillLocations } from "../geocode-events";
import { persistSourceLocation } from "@/lib/events/persistence";
import type { NormalizedEventCandidate } from "@/lib/events/adapters";
const url = process.env.HERMES_TEST_DATABASE_URL;
const client = new PrismaClient({ datasources: { db: { url: url ?? "postgresql://127.0.0.1/hermes_geocoding_test" } } });
const candidate: NormalizedEventCandidate = { source: "wusa-events", sourceFingerprint: "b".repeat(64), sourceUrl: "https://wusa.ca/event/geocode-test", title: "Location test", description: "Meet up", clubName: "Test", locationName: "New Venue", startTime: "2030-11-14T18:00:00Z", endTime: "2030-11-14T20:00:00Z", tags: [], isFreeFood: false, latitude: 43.472, longitude: -80.54 };
(url ? describe : describe.skip)("location cache against isolated Postgres", () => {
  beforeAll(() => {
    const target = new URL(url!);
    if (target.hostname !== "127.0.0.1" || !target.pathname.endsWith("_test")) throw new Error("integration-test-requires-isolated-local-database");
  });
  afterAll(async () => {
    if (url && new URL(url).hostname === "127.0.0.1" && new URL(url).pathname.endsWith("_test")) await client.event.deleteMany({ where: { id: { startsWith: "geo-test-" } } });
    await client.$disconnect();
  });
  it("persists source facts, reuses venue lookups, and keeps the cache private", async () => {
    for (const id of ["geo-test-source", "geo-test-one", "geo-test-two"]) {
      await client.event.create({ data: { id, source: candidate.source, sourceFingerprint: id, sourceUrl: candidate.sourceUrl, title: candidate.title, description: candidate.description, clubName: candidate.clubName, startTime: new Date(candidate.startTime), endTime: new Date(candidate.endTime), locationName: candidate.locationName, contentHash: id } });
    }
    await persistSourceLocation(client, "geo-test-source", candidate);
    const search = vi.fn().mockResolvedValue({ status: "resolved", latitude: 43.472, longitude: -80.54, displayName: "New Venue" });
    expect(await backfillLocations(client, { where: { id: { startsWith: "geo-test-" } }, search, sourceLookup: async () => null })).toMatchObject({ resolved: 2, cached: 1, skipped: 1, complete: true });
    expect(search).toHaveBeenCalledTimes(1);
    expect(await client.eventGeocode.findUnique({ where: { eventId: "geo-test-source" } })).toMatchObject({ source: "source", latitude: 43.472, status: "resolved" });
    expect(await client.$queryRaw`SELECT relrowsecurity AS enabled FROM pg_class WHERE oid = 'public.event_geocodes'::regclass`).toEqual([{ enabled: true }]);
    expect(await client.$queryRaw`SELECT has_table_privilege('anon', 'public.event_geocodes', 'SELECT') AS readable`).toEqual([{ readable: false }]);
  });
});
