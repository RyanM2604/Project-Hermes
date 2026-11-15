import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createIncrementalCollector } from "./collection";
const url = process.env.HERMES_TEST_DATABASE_URL;
const client = new PrismaClient({ datasourceUrl: url ?? "postgresql://127.0.0.1/hermes_costs_test" });
let clock = Date.parse("2030-11-15T12:00:00Z");
const account = { instagramHandle: "cost-test-club", clubName: "Test club", profileUrl: "https://www.instagram.com/cost-test-club/", active: true, priority: 0 };
function provider() {
  const started = new Set<string>();
  const fetchCollection = vi.fn<NonNullable<Parameters<typeof createIncrementalCollector>[1]["fetchCollection"]>>(async (_source, options) => {
    const run = { id: options.runId ?? randomUUID(), status: "SUCCEEDED", defaultDatasetId: "dataset", usageTotalUsd: 0.0023, finishedAt: new Date(clock - 20_000).toISOString() };
    if (!options.runId) { started.add(run.id); await options.onStarted(run); }
    return { run, posts: [{ shortCode: "one", caption: "Saved caption", timestamp: "2030-11-15T10:00:00Z" }], received: 1, costSettled: true };
  });
  const readRun = vi.fn(async (id: string) => ({ id, status: "SUCCEEDED", defaultDatasetId: "dataset", usageTotalUsd: 0.0023, finishedAt: new Date(clock - 20_000).toISOString() }));
  return { started, fetchCollection, readRun };
}
(url ? describe : describe.skip)("incremental collection against isolated Postgres", () => {
  beforeAll(() => { const target = new URL(url!); if (target.hostname !== "127.0.0.1" || !target.pathname.endsWith("_test")) throw new Error("isolated-local-test-database-required"); });
  beforeEach(async () => { clock = Date.parse("2030-11-15T12:00:00Z"); await client.apifyCollectionRun.deleteMany(); await client.socialCollectionState.deleteMany(); await client.socialPost.deleteMany({ where: { accountHandle: { startsWith: "cost-test-" } } }); });
  afterAll(async () => { await client.$disconnect(); });
  function collector(p = provider(), runBudgetUsd = "0.50", monthBudgetUsd = "15") {
    return { ...p, ...createIncrementalCollector(client, { ...p, nowMs: () => clock, deadline: clock + 30 * 60_000, runBudgetUsd, monthBudgetUsd }) };
  }
  it("persists raw posts before advancing a checkpoint and skips an immediate repeat", async () => {
    const c = collector(); await c.collectAccount(account);
    expect(await client.socialPost.count({ where: { accountHandle: account.instagramHandle } })).toBe(1);
    expect(await client.socialCollectionState.findUnique({ where: { accountHandle: account.instagramHandle } })).toMatchObject({ lastSuccessAt: new Date(clock) });
    await expect(c.collectAccount(account)).rejects.toMatchObject({ code: "not-due" }); expect(c.fetchCollection).toHaveBeenCalledTimes(1);
  });
  it("enforces a workflow cap after earlier charges settle", async () => {
    const c = collector(provider(), "0.04");
    await c.collectAccount(account);
    await c.collectAccount({ ...account, instagramHandle: "cost-test-second", profileUrl: "https://www.instagram.com/cost-test-second/" });
    await expect(c.collectAccount({ ...account, instagramHandle: "cost-test-third", profileUrl: "https://www.instagram.com/cost-test-third/" })).rejects.toMatchObject({ code: "budget-limit" });
    expect(c.fetchCollection).toHaveBeenCalledTimes(2);
  });
  it("keeps collection state and billing data inaccessible to browser roles", async () => {
    expect(await client.$queryRaw`SELECT bool_and(relrowsecurity) AS protected FROM pg_class WHERE oid IN ('public.social_collection_state'::regclass, 'public.apify_collection_runs'::regclass)`).toEqual([{ protected: true }]);
    expect(await client.$queryRaw`SELECT has_table_privilege('anon', 'public.social_collection_state', 'SELECT') OR has_table_privilege('authenticated', 'public.apify_collection_runs', 'SELECT') AS readable`).toEqual([{ readable: false }]);
  });
  it("checks shared monthly limits before starting paid work", async () => {
    await client.apifyCollectionRun.create({ data: { id: randomUUID(), workflowId: "other", accountHandle: "other", reservedMicros: 30000, chargedMicros: 30000, createdAt: new Date(clock) } });
    const c = collector(provider(), "0.50", "0.04");
    await expect(c.collectAccount(account)).rejects.toMatchObject({ code: "budget-limit" }); expect(c.fetchCollection).not.toHaveBeenCalled();
  });
  it("serializes reservations across simultaneous collectors", async () => {
    const p = provider(); let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; }); const original = p.fetchCollection.getMockImplementation()!;
    p.fetchCollection.mockImplementation(async (...args) => { await gate; return original(...args); });
    const c = collector(p, "0.50", "0.04"); const other = collector(p, "0.50", "0.04"); const first = c.collectAccount(account);
    await vi.waitFor(() => expect(p.fetchCollection).toHaveBeenCalledTimes(1));
    await expect(other.collectAccount({ ...account, instagramHandle: "cost-test-other", profileUrl: "https://www.instagram.com/cost-test-other/" })).rejects.toMatchObject({ code: "budget-limit" });
    release(); await first; expect(p.fetchCollection).toHaveBeenCalledTimes(1);
  });
  it("resumes paid results after persistence fails without paying for another actor", async () => {
    const c = collector();
    await client.$executeRawUnsafe(`CREATE FUNCTION public.cost_test_reject_post() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'temporary-write-error'; END $$`);
    await client.$executeRawUnsafe(`CREATE TRIGGER cost_test_reject_post BEFORE INSERT ON public.social_posts FOR EACH ROW EXECUTE FUNCTION public.cost_test_reject_post()`);
    try { await expect(c.collectAccount(account)).rejects.toThrow(); }
    finally { await client.$executeRawUnsafe(`DROP TRIGGER cost_test_reject_post ON public.social_posts`); await client.$executeRawUnsafe(`DROP FUNCTION public.cost_test_reject_post()`); }
    expect((await client.socialCollectionState.findUniqueOrThrow({ where: { accountHandle: account.instagramHandle } })).lastSuccessAt).toBeNull();
    clock += 3600_001; const resumed = collector(c);
    await resumed.collectAccount(account);
    expect(c.started.size).toBe(1); expect(c.fetchCollection.mock.calls[1][1].runId).toBeTruthy();
    expect(await client.socialPost.count({ where: { accountHandle: account.instagramHandle } })).toBe(1);
  });
  it("orders never-collected sources ahead of recently checked accounts", async () => {
    const c = collector(); await c.collectAccount(account);
    const newAccount = { ...account, instagramHandle: "cost-test-new", priority: 2 };
    expect((await c.orderAccounts([account, newAccount])).map(a => a.instagramHandle)).toEqual(["cost-test-new", account.instagramHandle]);
  });
  it("retains reservations for an ambiguous provider failure", async () => {
    const { ApifyStartRejectedError } = await import("../fetch-apify");
    const p = provider(); p.fetchCollection.mockRejectedValue(new ApifyStartRejectedError(500));
    const c = collector(p); await expect(c.collectAccount(account)).rejects.toThrow();
    expect((await client.apifyCollectionRun.findFirstOrThrow()).chargedMicros).toBeNull();
    expect((await client.socialCollectionState.findUniqueOrThrow({ where: { accountHandle: account.instagramHandle } })).lastSuccessAt).toBeNull();
  });
  it("does not advance a saturated incremental window", async () => {
    const old = new Date(clock - 24 * 3600_000);
    await client.socialCollectionState.create({ data: { accountHandle: account.instagramHandle, lastSuccessAt: old, lastReviewAt: old, nextCheckAt: new Date(0) } });
    const p = provider(); const original = p.fetchCollection.getMockImplementation()!; p.fetchCollection.mockImplementation(async (...args) => ({ ...await original(...args), received: 12 }));
    const c = collector(p); await c.collectAccount(account);
    expect(await client.socialCollectionState.findUniqueOrThrow({ where: { accountHandle: account.instagramHandle } })).toMatchObject({ lastSuccessAt: old, resultsLimit: 24 });
    expect(c.summary.partial).toBe(1);
  });
});
