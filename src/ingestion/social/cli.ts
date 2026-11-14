import { appendFile } from "node:fs/promises";
import { Prisma, PrismaClient } from "@prisma/client";
import { loadEnvConfig } from "@next/env";
import { createPrismaEventPersistenceRepository } from "@/lib/events/persistence";
import { classifyEvents, type ClassifyEventsResult } from "@/lib/classification/classify-events";
import { createOpenAIClassifier } from "@/lib/classification/openai-classifier";
import { createPrismaClassificationRepository } from "@/lib/classification/prisma-repository";
import { runIngestion } from "../run-ingestion";
import { prismaConnectionUrl } from "@/lib/db/connection-url";
import { createSocialRepository, reconcileCanonicalEvents, updateEventImage } from "./repository";
import { runSocialIngestion, type SocialRunSummary } from "./worker";
import { prepareImage, storeImage, createEventImageBucket } from "./media";
import { instagramAccounts, type InstagramAccount } from "../sources/instagram-accounts";
import { backfillLocations } from "../geocode-events";

export interface WorkerArgs { account?: string; dryRun: boolean; inspect: boolean; retry: boolean; reextract: boolean; reclassify: boolean; backfillImages: boolean; backfillLocations: boolean; setupStorage: boolean; socialOnly: boolean; officialOnly: boolean; help: boolean }
export function parseWorkerArgs(args: string[]): WorkerArgs {
  const result: WorkerArgs = { dryRun: false, inspect: false, retry: false, reextract: false, reclassify: false, backfillImages: false, backfillLocations: false, setupStorage: false, socialOnly: false, officialOnly: false, help: false };
  const flags: Record<string, keyof WorkerArgs> = { "--dry-run": "dryRun", "--inspect": "inspect", "--retry": "retry", "--reextract": "reextract", "--reclassify": "reclassify", "--backfill-images": "backfillImages", "--backfill-locations": "backfillLocations", "--setup-storage": "setupStorage", "--social": "socialOnly", "--official": "officialOnly", "--help": "help" };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--account") {
      if (result.account) throw new Error("duplicate-account-option");
      const account = args[++i]?.replace(/^@/, "").toLowerCase();
      if (!account || !/^[a-z0-9_.]{1,30}$/.test(account)) throw new Error("invalid-account");
      result.account = account;
    } else if (flags[args[i]]) Object.assign(result, { [flags[args[i]]]: true });
    else throw new Error(`unknown-option:${args[i]}`);
  }
  if (result.socialOnly && result.officialOnly) throw new Error("conflicting-source-options");
  if (result.account && result.officialOnly) throw new Error("account-requires-social-source");
  if ([result.inspect, result.backfillImages, result.backfillLocations, result.setupStorage].filter(Boolean).length > 1) throw new Error("conflicting-operation-options");
  if ([result.retry, result.reextract, result.reclassify].filter(Boolean).length > 1) throw new Error("conflicting-reprocessing-options");
  if (result.dryRun && (result.retry || result.reextract || result.reclassify)) throw new Error("dry-run-requires-collection-or-read-only-operation");
  if ((result.retry || result.reextract) && result.officialOnly) throw new Error("retry-requires-social-source");
  if ((result.inspect || result.backfillImages || result.backfillLocations || result.setupStorage) && (result.retry || result.reextract || result.reclassify)) throw new Error("operation-does-not-process-events");
  if (result.inspect && result.officialOnly) throw new Error("inspection-requires-social-source");
  if (result.setupStorage && (result.account || result.socialOnly || result.officialOnly)) throw new Error("storage-setup-has-no-source-scope");
  if (result.help && args.length > 1) throw new Error("help-does-not-accept-other-options");
  if (result.account || result.retry || result.reextract || result.inspect) result.socialOnly = true;
  return result;
}

export function createWorkerBudget(nowMs: () => number = Date.now) {
  const deadline = nowMs() + 35 * 60_000;
  const processingDeadline = deadline - 2 * 60_000;
  return { deadline, processingDeadline, remainingMs: () => Math.max(0, deadline - nowMs()), processingRemainingMs: () => Math.max(0, processingDeadline - nowMs()) };
}

/** Apply the same source/account scope to backfill and classification recovery. */
export function workerEventScope(options: WorkerArgs, mappedEventIds: string[], accounts: readonly InstagramAccount[] = instagramAccounts): Prisma.EventWhereInput {
  if (options.officialOnly) return { source: { not: "instagram-clubs" } };
  const names = accounts.filter((account) => account.active && (!options.account || account.instagramHandle.toLowerCase() === options.account)).map((account) => account.clubName);
  const social: Prisma.EventWhereInput[] = [{ id: { in: mappedEventIds } }, { source: "instagram-clubs", clubName: { in: names } }];
  return { OR: options.socialOnly ? social : [{ source: { not: "instagram-clubs" } }, ...social] };
}
export function workerExitCode(input: { officialFailed?: boolean; imagesFailed?: number; classificationFailed?: number; budgetExhausted?: boolean; social?: Pick<SocialRunSummary, "failed" | "imagePending" | "accounts"> | null }): number {
  return input.officialFailed || input.imagesFailed || input.classificationFailed || input.budgetExhausted || (input.social && (input.social.failed || input.social.imagePending || input.social.accounts.some((account) => account.failed))) ? 1 : 0;
}

interface WorkerCliDependencies {
  createClient?: () => PrismaClient;
  nowMs?: () => number;
  runOfficial?: typeof runIngestion;
  runSocial?: typeof runSocialIngestion;
  classify?: typeof classifyEvents;
  reconcile?: typeof reconcileCanonicalEvents;
  prepare?: typeof prepareImage;
  store?: typeof storeImage;
  loadEnv?: typeof loadEnvConfig;
  geocode?: typeof backfillLocations;
}

async function scopedEventIds(client: PrismaClient, options: WorkerArgs): Promise<string[]> {
  if (options.officialOnly) return [];
  const handles = instagramAccounts.filter((account) => account.active && (!options.account || account.instagramHandle.toLowerCase() === options.account)).map((account) => account.instagramHandle.toLowerCase());
  const mappings = await client.socialEventMapping.findMany({ where: { post: { accountHandle: { in: handles } }, eventId: { not: null } }, select: { eventId: true }, distinct: ["eventId"] });
  return mappings.flatMap(({ eventId }) => eventId ? [eventId] : []);
}

export async function backfillImages(client: PrismaClient, options: { dryRun: boolean; deadline: number; where: Prisma.EventWhereInput; nowMs?: () => number; prepare?: typeof prepareImage; store?: typeof storeImage }) {
  const nowMs = options.nowMs ?? Date.now;
  const prefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "")}/storage/v1/object/public/${process.env.EVENT_IMAGES_BUCKET ?? "event-images"}/`;
  let cursor: string | undefined;
  let uploaded = 0, failed = 0, eligible = 0;
  let complete = false;
  while (nowMs() < options.deadline) {
    const events = await client.event.findMany({ where: { AND: [options.where, { endTime: { gte: new Date(nowMs()) }, supersededById: null, OR: [{ sourceImageUrl: { not: null } }, { imageUrl: { not: null } }] }, ...(cursor ? [{ id: { gt: cursor } }] : [])] }, orderBy: { id: "asc" }, take: 50, select: { id: true, imageUrl: true, sourceImageUrl: true } });
    if (!events.length) { complete = true; break; }
    for (const event of events) {
      if (nowMs() >= options.deadline) break;
      cursor = event.id;
      const sourceUrl = event.sourceImageUrl ?? event.imageUrl;
      if (!sourceUrl || event.imageUrl?.startsWith(prefix)) continue;
      eligible++;
      if (options.dryRun) continue;
      try {
        const image = await (options.prepare ?? prepareImage)(sourceUrl);
        const stored = await (options.store ?? storeImage)(image);
        const updated = await updateEventImage(client, event.id, event.imageUrl, stored.publicUrl, image.contentHash);
        if (updated.count) uploaded++;
      } catch { failed++; }
    }
  }
  return { eligible, uploaded, failed, dryRun: options.dryRun, complete };
}

function aggregateClassifications(results: ClassifyEventsResult[]): ClassifyEventsResult | null {
  if (!results.length) return null;
  const total: ClassifyEventsResult = { attemptedCount: 0, classifiedCount: 0, fallbackCount: 0, skippedCount: 0, failedCount: 0, diagnostics: { invalidOutputCount: 0, unavailable: {}, unexpectedErrorCount: 0 } };
  for (const result of results) {
    for (const key of ["attemptedCount", "classifiedCount", "fallbackCount", "skippedCount", "failedCount"] as const) total[key] += result[key];
    total.diagnostics.invalidOutputCount += result.diagnostics.invalidOutputCount;
    total.diagnostics.unexpectedErrorCount += result.diagnostics.unexpectedErrorCount;
    for (const [code, count] of Object.entries(result.diagnostics.unavailable)) {
      const key = code as keyof typeof total.diagnostics.unavailable;
      total.diagnostics.unavailable[key] = (total.diagnostics.unavailable[key] ?? 0) + (count ?? 0);
    }
  }
  return total;
}

export async function runWorkerCli(argv = process.argv.slice(2), dependencies: WorkerCliDependencies = {}): Promise<number> {
  const options = parseWorkerArgs(argv);
  if (options.help) {
    console.log("Usage: npm run ingest:events -- [--social|--official] [--account HANDLE] [--dry-run] [--inspect] [--retry|--reextract] [--reclassify] [--backfill-images|--backfill-locations] [--setup-storage]");
    return 0;
  }
  if (options.account && !instagramAccounts.some((account) => account.active && account.instagramHandle.toLowerCase() === options.account)) throw new Error("unknown-account");
  (dependencies.loadEnv ?? loadEnvConfig)(process.cwd());
  if (options.setupStorage) {
    if (!options.dryRun) await createEventImageBucket();
    console.log(JSON.stringify({ operation: "setup-storage", dryRun: options.dryRun, bucket: process.env.EVENT_IMAGES_BUCKET ?? "event-images" }));
    return 0;
  }
  if (!process.env.DATABASE_URL && (!options.dryRun || options.inspect || options.backfillImages || options.backfillLocations)) throw new Error("missing-database-url");
  const client = (dependencies.createClient ?? (() => new PrismaClient({ datasources: { db: { url: prismaConnectionUrl(process.env.DIRECT_URL || process.env.DATABASE_URL) } } })))();
  const nowMs = dependencies.nowMs ?? Date.now;
  const budget = createWorkerBudget(nowMs);
  try {
    const postScope = options.account ? { accountHandle: options.account } : { accountHandle: { in: instagramAccounts.filter((account) => account.active).map((account) => account.instagramHandle.toLowerCase()) } };
    if (options.inspect) {
      const posts = await client.socialPost.findMany({ where: postScope, orderBy: { updatedAt: "desc" }, take: 100, select: { id: true, accountHandle: true, sourceUrl: true, status: true, lastError: true, attempts: true, nextRetryAt: true, extractionVersion: true, extractionModel: true, extraction: true, inputTokens: true, outputTokens: true, events: { select: { slot: true, eventId: true, imagePending: true } } } });
      console.log(JSON.stringify({ posts }, null, 2)); return 0;
    }
    if (options.backfillImages) {
      const where = workerEventScope(options, await scopedEventIds(client, options));
      const result = await backfillImages(client, { dryRun: options.dryRun, deadline: budget.processingDeadline, nowMs, where, prepare: dependencies.prepare, store: dependencies.store });
      console.log(JSON.stringify(result)); return result.failed || !result.complete ? 1 : 0;
    }
    if (options.backfillLocations) {
      const where = workerEventScope(options, await scopedEventIds(client, options));
      const result = await (dependencies.geocode ?? backfillLocations)(client, { dryRun: options.dryRun, deadline: Math.min(budget.processingDeadline, nowMs() + 5 * 60_000), nowMs, where });
      console.log(JSON.stringify({ operation: "backfill-locations", ...result }));
      return result.failed || !result.complete ? 1 : 0;
    }
    if ((options.retry || options.reextract) && !options.dryRun) {
      await client.socialPost.updateMany({ where: { ...postScope, ...(options.reextract ? {} : { status: { in: ["failed", "held", "pending"] } }), OR: [{ leaseUntil: null }, { leaseUntil: { lte: new Date(nowMs()) } }] }, data: { status: "pending", attempts: 0, nextRetryAt: null, lastError: null, leaseToken: null, leaseUntil: null, ...(options.reextract ? { extraction: Prisma.DbNull } : {}) } });
    }
    let official: unknown = null;
    let officialFailed = false;
    let imagesFailed = 0;
    let budgetExhausted = false;
    if (!options.socialOnly && !options.reclassify) {
      if (budget.processingRemainingMs() === 0) budgetExhausted = true;
      else {
        // Classification happens once, after all publication stages, with its own reserved time.
        const result = await (dependencies.runOfficial ?? runIngestion)({ ...(options.dryRun ? {} : { persistence: createPrismaEventPersistenceRepository(client) }) });
        official = { sources: result.sources, persisted: result.persistence?.persistedEventIds.length ?? 0 };
        officialFailed = !result.sources.length || result.sources.every((source) => source.status === "failed") || !!result.persistence?.failedCount;
        if (!options.dryRun && budget.processingRemainingMs() > 0) {
          const images = await backfillImages(client, { dryRun: false, deadline: budget.processingDeadline, nowMs, where: { source: { not: "instagram-clubs" } }, prepare: dependencies.prepare, store: dependencies.store });
          official = { ...official as object, images };
          imagesFailed = images.failed;
          budgetExhausted ||= !images.complete;
        }
      }
    }
    let reconciled = 0;
    if (!options.dryRun && !options.account && !options.reclassify && budget.processingRemainingMs() > 0) reconciled = await (dependencies.reconcile ?? reconcileCanonicalEvents)(client);
    let social: SocialRunSummary | null = null;
    if (!options.officialOnly && !options.reclassify) {
      if (budget.processingRemainingMs() === 0) budgetExhausted = true;
      else social = await (dependencies.runSocial ?? runSocialIngestion)({ repository: createSocialRepository(client), account: options.account, dryRun: options.dryRun, budgetMs: budget.processingRemainingMs(), collectPosts: !(options.retry || options.reextract), onProgress: progress => console.log(JSON.stringify(progress)) });
      budgetExhausted ||= social?.complete === false;
    }
    let locations: Awaited<ReturnType<typeof backfillLocations>> | null = null;
    if (!options.dryRun && !options.reclassify && budget.processingRemainingMs() >= 9000) {
      try {
        const where = workerEventScope(options, await scopedEventIds(client, options));
        locations = await (dependencies.geocode ?? backfillLocations)(client, { where, nowMs, deadline: Math.min(budget.processingDeadline, nowMs() + 120_000) });
      } catch {
        locations = { eligible: 0, resolved: 0, outside: 0, unresolved: 0, failed: 1, cached: 0, skipped: 0, complete: false, busy: false, dryRun: false };
      }
    }
    const classificationResults: ClassifyEventsResult[] = [];
    if (!options.dryRun) {
      const scope = workerEventScope(options, await scopedEventIds(client, options));
      const classifier = createOpenAIClassifier({ timeoutMs: 15_000 });
      const repository = createPrismaClassificationRepository(client);
      let cursor: string | undefined;
      while (budget.remainingMs() >= 30_000) {
        const events = await client.event.findMany({ where: { AND: [scope, { supersededById: null, ...(options.reclassify ? {} : { classificationStatus: { in: ["pending", "retry"] } }) }, ...(cursor ? [{ id: { gt: cursor } }] : [])] }, orderBy: { id: "asc" }, take: 2, select: { id: true } });
        if (!events.length) break;
        cursor = events[events.length - 1].id;
        classificationResults.push(await (dependencies.classify ?? classifyEvents)({ classifier, repository, eventIds: events.map(({ id }) => id), reclassify: options.reclassify }));
      }
      if (budget.remainingMs() < 30_000) budgetExhausted = true;
    }
    const classification = aggregateClassifications(classificationResults);
    const exitCode = workerExitCode({ officialFailed, imagesFailed, classificationFailed: classification?.failedCount, budgetExhausted, social }) || (locations?.failed ? 1 : 0);
    const unavailable = social?.accounts.filter(account => account.skipped) ?? [];
    const outcome = exitCode ? "incomplete" : unavailable.length ? "completed_with_warnings" : "completed";
    for (const account of unavailable) console.warn(`::warning::Instagram account ${account.handle}: ${account.reason}`);
    console.log(JSON.stringify({ outcome, dryRun: options.dryRun, official, social, classification, locations, reconciled, budgetExhausted }, null, 2));
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `## Event ingestion\n\n- Mode: ${options.dryRun ? "dry run (nothing published)" : "publish"}\n- Outcome: ${outcome}\n- Unavailable accounts: ${unavailable.map(account => `${account.handle} (${account.reason})`).join(", ") || "none"}\n- Budget exhausted: ${budgetExhausted}\n- Processed social posts: ${social?.processed ?? 0}\n- Published/upserted events: ${social?.published ?? 0}\n- Held posts: ${social?.held ?? 0}\n- Failed posts: ${social?.failed ?? 0}\n- Uploaded images: ${social?.uploadedImages ?? 0}\n- Pending images: ${social?.imagePending ?? 0}\n- Classification failures: ${classification?.failedCount ?? 0}\n- Extraction tokens: ${(social?.inputTokens ?? 0) + (social?.outputTokens ?? 0)}\n- Result: ${exitCode ? "partial failure or unfinished work; inspect logs" : "success"}\n`);
    return exitCode;
  } finally { await client.$disconnect(); }
}
