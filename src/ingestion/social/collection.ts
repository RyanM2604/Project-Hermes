import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { ApifyAccountUnavailableError, ApifyCollectionDeferredError, ApifyStartRejectedError, fetchApifyCollection, getApifyRun } from "../fetch-apify";
import { createInstagramSource } from "../sources/instagram-public";
import type { InstagramAccount } from "../sources/instagram-accounts";
import { createSocialRepository } from "./repository";
import { normalizeSocialPosts } from "./posts";
import { EXTRACTION_VERSION } from "./extraction";

const HOUR = 3600_000;
function budget(value: string | undefined, fallback: number) {
  const number = value === undefined || value === "" ? fallback : Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1000) throw new Error("invalid-apify-budget");
  return Math.floor(number * 1_000_000);
}
export function collectionWindow(lastSuccessAt: Date | null, lastReviewAt: Date | null, now: Date) {
  const review = !!lastSuccessAt && (!lastReviewAt || +now - +lastReviewAt >= 7 * 24 * HOUR);
  const checkpoint = lastSuccessAt ? +lastSuccessAt - 6 * HOUR : +now - 7 * 24 * HOUR;
  return { review, since: new Date(review ? Math.min(checkpoint, +now - 7 * 24 * HOUR) : checkpoint) };
}

export function createIncrementalCollector(client: PrismaClient, options: {
  deadline: number; nowMs?: () => number; fetchCollection?: typeof fetchApifyCollection; readRun?: typeof getApifyRun;
  runBudgetUsd?: string; monthBudgetUsd?: string;
}) {
  const nowMs = options.nowMs ?? Date.now;
  const workflowId = randomUUID();
  const runLimit = budget(options.runBudgetUsd ?? process.env.APIFY_MAX_RUN_USD, 0.50);
  const monthLimit = budget(options.monthBudgetUsd ?? process.env.APIFY_MAX_MONTH_USD, 15);
  const repository = createSocialRepository(client);
  const summary = { reservedUsd: 0, settledUsd: 0, calls: 0, budgetDeferred: 0, partial: 0 };
  let providerUnavailable = false;
  async function reconcile() {
    const pending = await client.apifyCollectionRun.findMany({ where: { chargedMicros: null, providerRunId: { not: null }, createdAt: { lt: new Date(nowMs() - 10_000) } }, take: 100 });
    for (const row of pending) {
      if (options.deadline - nowMs() < 9000) break;
      try {
        const run = await (options.readRun ?? getApifyRun)(row.providerRunId!, { timeoutMs: 8000 });
        // The provider documents a short delay before final costs stabilize.
        if (run.finishedAt && +new Date(run.finishedAt) <= nowMs() - 10_000 && run.usageTotalUsd !== undefined && run.usageTotalUsd !== null) {
          await client.apifyCollectionRun.update({ where: { id: row.id }, data: { chargedMicros: Math.ceil(run.usageTotalUsd * 1_000_000), ...(run.status !== "SUCCEEDED" ? { processedAt: new Date(nowMs()) } : {}) } });
        }
      } catch { /* Keep the full reservation until an authenticated cost read succeeds. */ }
    }
  }
  async function collectAccount(account: InstagramAccount) {
    if (providerUnavailable) throw new ApifyCollectionDeferredError("provider-unavailable");
    if (options.deadline - nowMs() < 5000) throw new ApifyCollectionDeferredError("collection-busy");
    await reconcile();
    if (options.deadline - nowMs() < 5000) throw new ApifyCollectionDeferredError("collection-busy");
    const now = new Date(nowMs());
    const reservation = await client.$transaction(async tx => {
      // ponytail: one short lock protects small quota/checkpoint writes; no network
      // work inside it. Split by billing account only if throughput warrants it.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(80411235)`;
      const state = await tx.socialCollectionState.upsert({ where: { accountHandle: account.instagramHandle }, create: { accountHandle: account.instagramHandle }, update: {} });
      if (+state.nextCheckAt > +now) throw new ApifyCollectionDeferredError("not-due");
      if (state.leaseUntil && +state.leaseUntil > +now) throw new ApifyCollectionDeferredError("collection-busy");
      const previous = await tx.apifyCollectionRun.findFirst({ where: { accountHandle: account.instagramHandle, processedAt: null, providerRunId: { not: null } }, orderBy: { createdAt: "desc" } });
      if (previous) {
        await tx.socialCollectionState.update({ where: { accountHandle: account.instagramHandle }, data: { leaseUntil: new Date(+now + 5 * 60_000) } });
        return { state, row: previous, micros: previous.reservedMicros };
      }
      const rows = await tx.apifyCollectionRun.findMany({ where: { OR: [{ createdAt: { gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)) } }, { workflowId }] } });
      const cost = (row: typeof rows[number]) => row.chargedMicros ?? row.reservedMicros;
      const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
      const monthSpent = rows.filter(row => +row.createdAt >= monthStart).reduce((sum, row) => sum + cost(row), 0);
      const runSpent = rows.filter(row => row.workflowId === workflowId).reduce((sum, row) => sum + cost(row), 0);
      // Conservative allowance for detailed posts; provider-side caps remain
      // authoritative if prices change. No subscription/other-actor charges here.
      const micros = Math.max(5000, Math.ceil(state.resultsLimit * 0.0027 * 1.15 * 1_000_000));
      if (micros > runLimit - runSpent || micros > monthLimit - monthSpent) { summary.budgetDeferred++; throw new ApifyCollectionDeferredError("budget-limit"); }
      const row = await tx.apifyCollectionRun.create({ data: { id: randomUUID(), workflowId, accountHandle: account.instagramHandle, reservedMicros: micros, resultsLimit: state.resultsLimit, createdAt: now } });
      await tx.socialCollectionState.update({ where: { accountHandle: account.instagramHandle }, data: { leaseUntil: new Date(+now + 5 * 60_000) } });
      return { state, row, micros };
    });
    const { state, row, micros } = reservation;
    if (!row.providerRunId) { summary.calls++; summary.reservedUsd += micros / 1_000_000; }
    const coveredUntil = row.createdAt;
    const window = collectionWindow(state.lastSuccessAt, state.lastReviewAt, coveredUntil);
    const finishState = async (data: Parameters<typeof client.socialCollectionState.update>[0]["data"]) => {
      await client.socialCollectionState.update({ where: { accountHandle: account.instagramHandle }, data: { ...data, leaseUntil: null } });
    };
    try {
      const result = await (options.fetchCollection ?? fetchApifyCollection)(createInstagramSource(account), {
        runId: row.providerRunId ?? undefined, resultsLimit: row.resultsLimit, onlyPostsNewerThan: window.since.toISOString(), maxTotalChargeUsd: micros / 1_000_000, deadline: options.deadline,
        onStarted: async run => { await client.apifyCollectionRun.update({ where: { id: row.id }, data: { providerRunId: run.id } }); },
      });
      if (result.costSettled) {
        const chargedMicros = Math.ceil(result.run.usageTotalUsd! * 1_000_000);
        await client.apifyCollectionRun.update({ where: { id: row.id }, data: { chargedMicros } });
        summary.settledUsd += chargedMicros / 1_000_000;
      }
      const posts = normalizeSocialPosts(result.posts, account);
      if (posts.length !== result.posts.length) throw new Error("apify-post-normalization-incomplete");
      for (const post of posts) await repository.collect(post, EXTRACTION_VERSION);
      const nearChargeLimit = (result.run.usageTotalUsd ?? 0) * 1_000_000 >= micros - 3000;
      const saturated = !!state.lastSuccessAt && result.received >= row.resultsLimit;
      if (!result.costSettled || nearChargeLimit || saturated) {
        summary.partial++;
        await finishState({ nextCheckAt: new Date(+now + 24 * HOUR), resultsLimit: nearChargeLimit || saturated ? Math.min(96, row.resultsLimit * 2) : row.resultsLimit });
      } else {
        await finishState({ lastSuccessAt: coveredUntil, ...(window.review || !state.lastSuccessAt ? { lastReviewAt: coveredUntil } : {}), nextCheckAt: new Date(+now + [24, 48, 72][Math.max(0, Math.min(2, Math.floor(account.priority ?? 2)))] * HOUR), resultsLimit: 12 });
      }
      if (result.costSettled) await client.apifyCollectionRun.update({ where: { id: row.id }, data: { processedAt: new Date(nowMs()) } });
      return posts;
    } catch (error) {
      if (error instanceof ApifyStartRejectedError) {
        if (error.status >= 400 && error.status < 500 && error.status !== 408) await client.apifyCollectionRun.update({ where: { id: row.id }, data: { chargedMicros: 0, processedAt: new Date(nowMs()) } });
        providerUnavailable ||= [401, 402, 403, 429].includes(error.status);
      }
      if (error instanceof ApifyAccountUnavailableError) await client.apifyCollectionRun.update({ where: { id: row.id }, data: { processedAt: new Date(nowMs()) } });
      await finishState({ nextCheckAt: new Date(+now + (error instanceof ApifyAccountUnavailableError ? 7 * 24 : 1) * HOUR) });
      throw error;
    }
  }
  async function orderAccounts(accounts: readonly InstagramAccount[]) {
    const states = new Map((await client.socialCollectionState.findMany({ where: { accountHandle: { in: accounts.map(account => account.instagramHandle) } } })).map(state => [state.accountHandle, +state.nextCheckAt]));
    // Oldest due / never collected first prevents a small budget starving sources.
    return [...accounts].sort((a, b) => (states.get(a.instagramHandle) ?? 0) - (states.get(b.instagramHandle) ?? 0) || (a.priority ?? 2) - (b.priority ?? 2));
  }
  return { collectAccount, orderAccounts, summary };
}
