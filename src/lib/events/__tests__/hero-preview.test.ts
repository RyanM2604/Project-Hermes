import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({ prisma: { event: {} } }));
import { loadHeroEvents } from "../hero-preview";
describe("homepage event preview", () => {
  it("reads only two future events with images and exposes display data", async () => {
    const now = new Date("2026-11-05T12:00:00Z");
    const row = { id: "one", title: "Club night", clubName: "Club", locationName: "SLC", startTime: new Date("2026-11-06T00:00:00Z"), imageUrl: "https://example.com/poster.webp" };
    const findMany = vi.fn(async () => [row]);
    const client = { event: { findMany } } as unknown as Pick<PrismaClient, "event">;
    expect(await loadHeroEvents({ client, now })).toEqual([{ ...row, startTime: row.startTime.toISOString() }]);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 2, where: expect.objectContaining({ startTime: { gte: now }, endTime: { gte: now }, imageUrl: { not: null }, supersededById: null }) }));
  });
  it("keeps the homepage available without making up preview events when the database is unavailable", async () => {
    const client = { event: { findMany: async () => { throw new Error("database down"); } } } as unknown as Pick<PrismaClient, "event">;
    expect(await loadHeroEvents({ client })).toEqual([]);
  });
});
