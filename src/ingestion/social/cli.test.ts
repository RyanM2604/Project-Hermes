import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
vi.mock("../geocode-events", () => ({ backfillLocations: vi.fn(async () => ({ eligible: 0, resolved: 0, outside: 0, unresolved: 0, failed: 0, cached: 0, skipped: 0, complete: true, busy: false, dryRun: false })) }));
import { backfillLocations } from "../geocode-events";
import { backfillImages, createWorkerBudget, parseWorkerArgs, runWorkerCli, workerEventScope, workerExitCode } from "./cli";

describe("worker arguments", () => {
  it("supports scoped location backfill and rejects conflicting operations", () => {
    expect(parseWorkerArgs(["--backfill-locations", "--official", "--dry-run"])).toMatchObject({ backfillLocations: true, officialOnly: true, dryRun: true });
    expect(() => parseWorkerArgs(["--backfill-locations", "--backfill-images"])).toThrow();
    expect(() => parseWorkerArgs(["--backfill-locations", "--reextract"])).toThrow();
  });
  it("supports scoped dry-run and inspection without implicit writes", () => {
    expect(parseWorkerArgs(["--account", "@Club", "--dry-run", "--inspect"])).toMatchObject({ account: "club", dryRun: true, inspect: true, socialOnly: true });
  });
  it("makes retry and re-extraction social-only operations", () => {
    expect(parseWorkerArgs(["--retry"])).toMatchObject({ retry: true, socialOnly: true });
    expect(parseWorkerArgs(["--reextract"])).toMatchObject({ reextract: true, socialOnly: true });
  });
  it.each([
    ["--wrong"], ["--account"], ["--account", "https://instagram.com/club"],
    ["--official", "--account", "club"], ["--official", "--retry"],
    ["--inspect", "--retry"], ["--inspect", "--reclassify"],
    ["--backfill-images", "--reextract"], ["--backfill-images", "--reclassify"],
    ["--setup-storage", "--account", "club"], ["--setup-storage", "--social"],
    ["--retry", "--reextract"], ["--social", "--official"], ["--retry", "--reclassify"], ["--dry-run", "--retry"], ["--dry-run", "--reclassify"],
  ])("rejects incompatible or malformed options %o", (...args) => {
    expect(() => parseWorkerArgs(args)).toThrow();
  });
});

describe("shared worker deadline", () => {
  it("subtracts elapsed official/backfill work before social and reserves two minutes for classification", () => {
    const now = vi.fn().mockReturnValue(1_000);
    const budget = createWorkerBudget(now);
    expect(budget.processingRemainingMs()).toBe(33 * 60_000);
    now.mockReturnValue(1_000 + 20 * 60_000);
    expect(budget.processingRemainingMs()).toBe(13 * 60_000);
    expect(budget.remainingMs()).toBe(15 * 60_000);
    now.mockReturnValue(1_000 + 34 * 60_000);
    expect(budget.processingRemainingMs()).toBe(0);
    expect(budget.remainingMs()).toBe(60_000);
  });
});

describe("worker event scoping", () => {
  const accounts = [{ clubName: "Cheese Club", instagramHandle: "cheese", profileUrl: "https://instagram.com/cheese/", active: true }, { clubName: "Other Club", instagramHandle: "other", profileUrl: "https://instagram.com/other/", active: true }];
  it("limits account image backfill and classification recovery to its mappings and legacy records", () => {
    expect(workerEventScope(parseWorkerArgs(["--account", "cheese"]), ["linked-event"], accounts)).toEqual({ OR: [{ id: { in: ["linked-event"] } }, { source: "instagram-clubs", clubName: { in: ["Cheese Club"] } }] });
  });
  it("does not classify unrelated official events in social-only runs", () => {
    expect(workerEventScope(parseWorkerArgs(["--social"]), [], accounts)).toEqual({ OR: [{ id: { in: [] } }, { source: "instagram-clubs", clubName: { in: ["Cheese Club", "Other Club"] } }] });
  });
  it("restricts official-only backfill and recovery", () => {
    expect(workerEventScope(parseWorkerArgs(["--official"]), [], accounts)).toEqual({ source: { not: "instagram-clubs" } });
  });
});

describe("worker exit status", () => {
  it("does not report success for pending uploads or failed classification", () => {
    expect(workerExitCode({ social: { failed: 0, imagePending: 1, accounts: [] } })).toBe(1);
    expect(workerExitCode({ classificationFailed: 1 })).toBe(1);
    expect(workerExitCode({ social: { failed: 0, imagePending: 0, accounts: [{ handle: "cheese", collected: 0, failed: true }] } })).toBe(1);
    expect(workerExitCode({ social: { failed: 0, imagePending: 0, accounts: [] } })).toBe(0);
  });
});

const emptySocial = { accounts: [], processed: 0, published: 0, held: 0, ignored: 0, failed: 0, imagePending: 0, inputTokens: 0, outputTokens: 0, uploadedImages: 0, eventIds: [], reasons: {}, dryRun: false };
const classificationResult = { attemptedCount: 2, classifiedCount: 1, fallbackCount: 0, skippedCount: 0, failedCount: 1, diagnostics: { invalidOutputCount: 0, unavailable: {}, unexpectedErrorCount: 1 } };
const env = () => { vi.stubEnv("DATABASE_URL", "postgresql://test"); vi.stubEnv("GITHUB_STEP_SUMMARY", ""); vi.spyOn(console, "log").mockImplementation(() => {}); };
afterEach(() => { vi.clearAllMocks(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });
function fakeClient() {
  return { socialPost: { updateMany: vi.fn(), findMany: vi.fn().mockResolvedValue([]) }, socialEventMapping: { findMany: vi.fn().mockResolvedValue([{ eventId: "mapped-event" }]) }, event: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn().mockResolvedValue({ count: 1 }) }, $disconnect: vi.fn() };
}
describe("CLI orchestration", () => {
  it("backfills stored locations without collection, uploads, or classification", async () => {
    env(); const client = fakeClient(); const runOfficial = vi.fn(), runSocial = vi.fn(), classify = vi.fn();
    expect(await runWorkerCli(["--backfill-locations", "--official"], { createClient: () => client as unknown as PrismaClient, loadEnv: vi.fn(), runOfficial, runSocial, classify })).toBe(0);
    expect(backfillLocations).toHaveBeenCalledWith(client, expect.objectContaining({ where: { source: { not: "instagram-clubs" } }, dryRun: false }));
    expect(runOfficial).not.toHaveBeenCalled(); expect(runSocial).not.toHaveBeenCalled(); expect(classify).not.toHaveBeenCalled();
  });
  it("performs no database/bucket/classification stages during a normal dry run", async () => {
    env();
    const client = fakeClient();
    const runOfficial = vi.fn();
    const runSocial = vi.fn().mockResolvedValue({ ...emptySocial, dryRun: true });
    const classify = vi.fn();
    expect(await runWorkerCli(["--social", "--dry-run"], { createClient: () => client as unknown as PrismaClient, loadEnv: vi.fn(), nowMs: () => 0, runOfficial, runSocial, classify })).toBe(0);
    expect(runOfficial).not.toHaveBeenCalled();
    expect(client.socialPost.updateMany).not.toHaveBeenCalled();
    expect(client.socialEventMapping.findMany).not.toHaveBeenCalled();
    expect(client.event.findMany).not.toHaveBeenCalled();
    expect(classify).not.toHaveBeenCalled();
    expect(runSocial.mock.calls[0][0]).toMatchObject({ dryRun: true, budgetMs: 33 * 60_000 });
  });

  it("classifies failed pending work only within the selected account and exits unsuccessfully", async () => {
    env();
    const client = fakeClient();
    client.event.findMany.mockResolvedValueOnce([{ id: "mapped-event" }]).mockResolvedValueOnce([]);
    const classify = vi.fn().mockResolvedValue(classificationResult);
    const runSocial = vi.fn().mockResolvedValue(emptySocial);
    expect(await runWorkerCli(["--account", "uwcheeseclub"], { createClient: () => client as unknown as PrismaClient, loadEnv: vi.fn(), runSocial, classify })).toBe(1);
    expect(client.socialEventMapping.findMany.mock.calls[0][0].where.post.accountHandle.in).toEqual(["uwcheeseclub"]);
    expect(client.event.findMany.mock.calls[0][0].where.AND[0]).toEqual({ OR: [{ id: { in: ["mapped-event"] } }, { source: "instagram-clubs", clubName: { in: ["UW Cheese Club"] } }] });
    expect(classify).toHaveBeenCalledOnce();
    expect(runSocial.mock.calls[0][0].classify).toBeUndefined();
  });

  it("makes reclassification an explicit classification-only operation", async () => {
    env();
    const client = fakeClient();
    client.event.findMany.mockResolvedValueOnce([{ id: "mapped-event" }]).mockResolvedValueOnce([]);
    const runSocial = vi.fn(), runOfficial = vi.fn();
    const classify = vi.fn().mockResolvedValue({ ...classificationResult, failedCount: 0 });
    expect(await runWorkerCli(["--social", "--reclassify"], { createClient: () => client as unknown as PrismaClient, loadEnv: vi.fn(), runSocial, runOfficial, classify })).toBe(0);
    expect(runSocial).not.toHaveBeenCalled();
    expect(runOfficial).not.toHaveBeenCalled();
    expect(classify.mock.calls[0][0].reclassify).toBe(true);
    expect(client.event.findMany.mock.calls[0][0].where.AND[1].classificationStatus).toBeUndefined();
  });

  it("passes remaining shared time after official ingestion to social processing", async () => {
    env();
    const client = fakeClient();
    let time = 0;
    const runOfficial = vi.fn().mockImplementation(async () => { time = 20 * 60_000; return { sources: [{ status: "succeeded" }], events: [], duplicates: [] }; });
    const runSocial = vi.fn().mockResolvedValue(emptySocial);
    await runWorkerCli([], { createClient: () => client as unknown as PrismaClient, loadEnv: vi.fn(), nowMs: () => time, runOfficial, runSocial });
    expect(runSocial.mock.calls[0][0].budgetMs).toBe(13 * 60_000);
    expect(runOfficial.mock.calls[0][0].classifier).toBeUndefined();
  });

  it("retries scoped work without launching collection", async () => {
    env();
    const client = fakeClient();
    const runSocial = vi.fn().mockResolvedValue(emptySocial);
    await runWorkerCli(["--account", "uwcheeseclub", "--retry"], { createClient: () => client as unknown as PrismaClient, loadEnv: vi.fn(), runSocial });
    expect(client.socialPost.updateMany.mock.calls[0][0].where.accountHandle).toBe("uwcheeseclub");
    expect(runSocial.mock.calls[0][0]).toMatchObject({ account: "uwcheeseclub", collectPosts: false });
  });
});

describe("image backfill", () => {
  it("retrieves the original image and saves content metadata without re-fetching stored bucket images", async () => {
    env(); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    const client = fakeClient();
    client.event.findMany.mockResolvedValueOnce([{ id: "external", imageUrl: "https://old.example/image", sourceImageUrl: "https://source.example/image" }, { id: "stored", imageUrl: "https://project.supabase.co/storage/v1/object/public/event-images/hash.webp", sourceImageUrl: "https://source.example/stored" }]).mockResolvedValueOnce([]);
    const prepare = vi.fn().mockResolvedValue({ bytes: Buffer.from("image"), dataUrl: "data:image/webp;base64,aW1hZ2U=", contentHash: "hash" });
    const store = vi.fn().mockResolvedValue({ publicUrl: "https://project.supabase.co/storage/v1/object/public/event-images/hash.webp", storagePath: "hash.webp" });
    const result = await backfillImages(client as unknown as PrismaClient, { dryRun: false, deadline: Date.now() + 10000, where: { source: "instagram-clubs" }, prepare, store });
    expect(prepare).toHaveBeenCalledExactlyOnceWith("https://source.example/image");
    expect(result).toMatchObject({ uploaded: 1, complete: true });
    expect(client.event.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ imageContentHash: "hash" }) }));
  });
  it("does not download or upload images in dry-run backfill", async () => {
    const client = fakeClient();
    client.event.findMany.mockResolvedValueOnce([{ id: "external", imageUrl: "https://source.example/image", sourceImageUrl: null }]).mockResolvedValueOnce([]);
    const prepare = vi.fn(), store = vi.fn();
    const result = await backfillImages(client as unknown as PrismaClient, { dryRun: true, deadline: Date.now() + 10000, where: {}, prepare, store });
    expect(result).toMatchObject({ eligible: 1, uploaded: 0 });
    expect(prepare).not.toHaveBeenCalled(); expect(store).not.toHaveBeenCalled(); expect(client.event.updateMany).not.toHaveBeenCalled();
  });
});
