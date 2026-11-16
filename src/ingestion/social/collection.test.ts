import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { collectionWindow, createIncrementalCollector } from "./collection";
const now = new Date("2026-11-15T12:00:00Z");
describe("collection windows", () => {
  it("bootstraps a bounded week, then overlaps the last successful observation by six hours", () => {
    expect(collectionWindow(null, null, now).since.toISOString()).toBe("2026-11-08T12:00:00.000Z");
    expect(collectionWindow(new Date("2026-11-14T12:00:00Z"), new Date("2026-11-14T12:00:00Z"), now)).toEqual({ review: false, since: new Date("2026-11-14T06:00:00Z") });
    expect(collectionWindow(new Date("2026-11-14T12:00:00Z"), new Date("2026-11-01T12:00:00Z"), now)).toEqual({ review: true, since: new Date("2026-11-08T12:00:00Z") });
    expect(collectionWindow(new Date("2026-11-01T12:00:00Z"), null, now).since.toISOString()).toBe("2026-11-01T06:00:00.000Z");
  });
});

describe("fresh media recovery", () => {
  const account = { instagramHandle: "club", clubName: "Club", profileUrl: "https://www.instagram.com/club/", active: true };
  function setup(refreshMedia: boolean, overrides: { leaseUntil?: Date; monthBudgetUsd?: string } = {}) {
    const oldPost = new Date("2026-10-27T12:00:00Z");
    const state = { nextCheckAt: new Date(+now + 86400000), leaseUntil: overrides.leaseUntil ?? null, lastSuccessAt: now, lastReviewAt: now, resultsLimit: 12 };
    const tx = { $executeRaw: vi.fn(), socialCollectionState: { upsert: vi.fn(async () => state), update: vi.fn() }, apifyCollectionRun: { findFirst: vi.fn(async () => null), findMany: vi.fn(async () => []), create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => data), update: vi.fn() } };
    const findFirst = vi.fn(async () => ({ postedAt: oldPost }));
    const client = { ...tx, socialPost: { findFirst }, $transaction: async (run: (value: typeof tx) => unknown) => run(tx) } as unknown as PrismaClient;
    const fetchCollection = vi.fn<NonNullable<Parameters<typeof createIncrementalCollector>[1]["fetchCollection"]>>(async () => ({ posts: [], received: 0, costSettled: true, run: { id: "run", status: "SUCCEEDED", defaultDatasetId: "dataset", usageTotalUsd: 0.001 } }));
    return { tx, findFirst, fetchCollection, collector: createIncrementalCollector(client, { refreshMedia, deadline: +now + 60000, nowMs: () => +now, fetchCollection, runBudgetUsd: "0.50", monthBudgetUsd: overrides.monthBudgetUsd ?? "15" }) };
  }
  it("refreshes before the next scheduled check and includes older failed posts", async () => {
    const { collector, fetchCollection, findFirst } = setup(true);
    await collector.collectAccount(account);
    expect(fetchCollection).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ onlyPostsNewerThan: "2026-10-27T06:00:00.000Z", resultsLimit: 96, maxTotalChargeUsd: expect.any(Number) }));
    expect(fetchCollection.mock.calls[0][1].maxTotalChargeUsd).toBeLessThanOrEqual(0.50);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ accountHandle: "club", status: { in: ["pending", "failed"] } }) }));
  });
  it("leaves normal collection on its existing schedule", async () => {
    const { collector, fetchCollection } = setup(false);
    await expect(collector.collectAccount(account)).rejects.toMatchObject({ code: "not-due" });
    expect(fetchCollection).not.toHaveBeenCalled();
  });
  it("keeps the collection lease and shared spending limits during recovery", async () => {
    for (const options of [{ leaseUntil: new Date(+now + 60000) }, { monthBudgetUsd: "0" }]) {
      const { collector, fetchCollection } = setup(true, options);
      await expect(collector.collectAccount(account)).rejects.toMatchObject({ code: options.leaseUntil ? "collection-busy" : "budget-limit" });
      expect(fetchCollection).not.toHaveBeenCalled();
    }
  });
});
