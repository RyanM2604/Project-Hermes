import type { IngestionSource } from "./types";

export class ApifyAccountUnavailableError extends Error {
  constructor(readonly code: "account-not-found" | "account-empty-or-private") { super(code); }
}

const APIFY_ACTOR_ID = "apify/instagram-post-scraper";
const APIFY_RUN_SYNC_DATASET_ITEMS_ENDPOINT = `https://api.apify.com/v2/actors/${APIFY_ACTOR_ID.replace(
  "/",
  "~",
)}/run-sync-get-dataset-items`;

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface FetchApifyOptions {
  apiToken?: string;
  fetchImpl?: FetchLike;
  resultsLimit?: number;
  skipPinnedPosts?: boolean;
  onlyPostsNewerThan?: string;
  dataDetailLevel?: "basicData" | "detailedData";
  timeoutMs?: number;
}

export interface ApifyInstagramPost {
  shortCode?: string;
  shortcode?: string;
  caption?: string;
  firstComment?: string;
  timestamp?: string;
  createdAt?: string;
  postedAt?: string;
  locationName?: string;
  displayUrl?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  url?: string;
  ownerUsername?: string;
  ownerFullName?: string;
  title?: string;
  type?: string;
  childPosts?: unknown[];
  images?: string[];
  [key: string]: unknown;
}

function readToken(explicitToken?: string): string {
  return (
    explicitToken ??
    process.env.APIFY_TOKEN ??
    process.env.APIFY_API_TOKEN ??
    ""
  ).trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function postFromValue(value: unknown): ApifyInstagramPost | null {
  if (!isRecord(value)) {
    return null;
  }

  const shortCode = asString(
    value.shortCode ?? value.shortcode ?? value.id ?? value.code,
  );

  if (!shortCode) {
    return null;
  }

  const post: ApifyInstagramPost = {
    shortCode,
  };

  for (const key of [
    "caption",
    "firstComment",
    "timestamp",
    "createdAt",
    "postedAt",
    "locationName",
    "displayUrl",
    "thumbnailUrl",
    "imageUrl",
    "url",
    "ownerUsername",
    "ownerFullName",
    "title",
    "type",
  ] as const) {
    const valueText = asString(value[key]);

    if (valueText) {
      post[key] = valueText;
    }
  }

  if (Array.isArray(value.images)) post.images = value.images.filter((image): image is string => typeof image === "string");

  if (Array.isArray(value.childPosts)) {
    post.childPosts = value.childPosts;
  }

  return post;
}

function parseActorItems(raw: string): ApifyInstagramPost[] {
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { throw new Error("Invalid Apify dataset JSON"); }
  if (!Array.isArray(payload)) throw new Error("Invalid Apify dataset envelope");
  if (payload.length === 1 && isRecord(payload[0])) {
    if (payload[0].error === "not_found") throw new ApifyAccountUnavailableError("account-not-found");
    if (payload[0].error === "no_items") throw new ApifyAccountUnavailableError("account-empty-or-private");
  }
  const seen = new Set<string>();
  const posts: ApifyInstagramPost[] = [];
  for (const item of payload) {
    if (!isRecord(item) || item.error || item.errorDescription) throw new Error("Apify dataset contains an upstream error");
    const post = postFromValue(item);
    if (!post) throw new Error("Invalid Apify post record");
    const key = post.shortCode!;
    if (!seen.has(key)) { seen.add(key); posts.push(post); }
  }
  return posts;
}

async function fetchApifyDatasetItems(
  profileUrl: string,
  sourceId: string,
  options: FetchApifyOptions = {},
): Promise<ApifyInstagramPost[]> {
  const token = readToken(options.apiToken);

  if (!token) {
    throw new Error(`Missing APIFY_TOKEN for ${sourceId}`);
  }

  const endpoint = new URL(APIFY_RUN_SYNC_DATASET_ITEMS_ENDPOINT);
  endpoint.searchParams.set("format", "json");

  const response = await (options.fetchImpl ?? fetch)(endpoint, {
    method: "POST",
    signal: AbortSignal.timeout(options.timeoutMs ?? 120_000),
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      username: [profileUrl],
      resultsLimit: options.resultsLimit ?? 12,
      skipPinnedPosts: options.skipPinnedPosts ?? true,
      ...(options.onlyPostsNewerThan
        ? { onlyPostsNewerThan: options.onlyPostsNewerThan }
        : {}),
      dataDetailLevel: options.dataDetailLevel ?? "basicData",
    }),
  });

  if (!response.ok) {
    throw new Error(`Apify request failed for ${sourceId} with ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.toLowerCase().includes("json")
    ? JSON.stringify(await response.json())
    : await response.text();

  const items = parseActorItems(body);

  if (items.length === 0) {
    if (body.trim().length === 0) {
      throw new Error(`Apify response missing content for ${sourceId}`);
    }

    return [];
  }

  return items;
}

export async function fetchApifyInstagramPosts(
  source: IngestionSource,
  options: FetchApifyOptions = {},
): Promise<ApifyInstagramPost[]> {
  return fetchApifyDatasetItems(source.url, source.id, options);
}

export class ApifyCollectionDeferredError extends Error {
  constructor(readonly code: "not-due" | "budget-limit" | "collection-busy" | "provider-unavailable") { super(code); }
}
export class ApifyStartRejectedError extends Error {
  constructor(readonly status: number) { super(`apify-start-rejected-${status}`); }
}
export interface ApifyRun {
  id: string; status: string; defaultDatasetId: string; finishedAt?: string | null; usageTotalUsd?: number | null;
}
function actorRun(value: unknown): ApifyRun {
  const data = isRecord(value) && isRecord(value.data) ? value.data : null;
  if (!data || typeof data.id !== "string" || !/^[\w-]+$/.test(data.id) || typeof data.status !== "string" || typeof data.defaultDatasetId !== "string" || !/^[\w-]+$/.test(data.defaultDatasetId)) throw new Error("invalid-apify-run");
  return { id: data.id, status: data.status, defaultDatasetId: data.defaultDatasetId,
    ...(typeof data.finishedAt === "string" ? { finishedAt: data.finishedAt } : {}),
    ...(typeof data.usageTotalUsd === "number" && Number.isFinite(data.usageTotalUsd) && data.usageTotalUsd >= 0 ? { usageTotalUsd: data.usageTotalUsd } : {}),
  };
}
export async function getApifyRun(id: string, options: FetchApifyOptions = {}, waitForFinish = 0): Promise<ApifyRun> {
  if (!/^[\w-]+$/.test(id)) throw new Error("invalid-apify-run-id");
  const response = await (options.fetchImpl ?? fetch)(`https://api.apify.com/v2/actor-runs/${id}?waitForFinish=${Math.min(60, Math.max(0, waitForFinish))}`, {
    headers: { Authorization: `Bearer ${readToken(options.apiToken)}` }, signal: AbortSignal.timeout(options.timeoutMs ?? 70_000), redirect: "error",
  });
  if (!response.ok) throw new Error("apify-run-unavailable");
  return actorRun(await response.json());
}

/** Start exactly once; never repeat a paid POST after an uncertain response. */
export async function fetchApifyCollection(source: IngestionSource, options: FetchApifyOptions & {
  maxTotalChargeUsd: number; deadline?: number; runId?: string; onStarted: (run: ApifyRun) => Promise<void>;
}) {
  const token = readToken(options.apiToken);
  if (!token) throw new Error("missing-apify-token");
  if (!Number.isFinite(options.maxTotalChargeUsd) || options.maxTotalChargeUsd < 0.005) throw new Error("invalid-apify-charge-limit");
  const deadline = Math.min(options.deadline ?? Infinity, Date.now() + (options.timeoutMs ?? 120_000));
  const remaining = () => Math.max(1, deadline - Date.now());
  if (remaining() < 1000) throw new Error("apify-deadline");
  const url = new URL("https://api.apify.com/v2/actors/apify~instagram-post-scraper/runs");
  url.search = new URLSearchParams({ waitForFinish: "60", timeout: "120", maxTotalChargeUsd: String(options.maxTotalChargeUsd) }).toString();
  let run: ApifyRun;
  if (options.runId) run = await getApifyRun(options.runId, { ...options, timeoutMs: remaining() });
  else {
    const response = await (options.fetchImpl ?? fetch)(url, { method: "POST", redirect: "error", signal: AbortSignal.timeout(remaining()),
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ username: [source.url], resultsLimit: options.resultsLimit ?? 12, skipPinnedPosts: true,
        onlyPostsNewerThan: options.onlyPostsNewerThan, dataDetailLevel: "detailedData" }),
    });
    if (!response.ok) throw new ApifyStartRejectedError(response.status);
    run = actorRun(await response.json());
    await options.onStarted(run);
  }
  while (["READY", "RUNNING", "TIMING-OUT", "ABORTING"].includes(run.status) && Date.now() < deadline) {
    run = await getApifyRun(run.id, { ...options, timeoutMs: remaining() }, Math.min(60, Math.floor(remaining() / 1000)));
  }
  if (run.status !== "SUCCEEDED") throw new Error("apify-run-incomplete");
  const dataset = await (options.fetchImpl ?? fetch)(`https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items?format=json&clean=true`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(remaining()), redirect: "error",
  });
  if (!dataset.ok) throw new Error("apify-dataset-unavailable");
  const raw = await dataset.text();
  const delay = run.finishedAt ? Math.max(0, +new Date(run.finishedAt) + 10_000 - Date.now()) : 0;
  if (run.finishedAt && remaining() > delay + 5000) {
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    try { run = await getApifyRun(run.id, { ...options, timeoutMs: remaining() }); } catch { /* Keep the maximum reservation. */ }
  }
  const costSettled = !!run.finishedAt && +new Date(run.finishedAt) <= Date.now() - 10_000 && run.usageTotalUsd !== undefined && run.usageTotalUsd !== null;
  const posts = parseActorItems(raw);
  return { posts, run, costSettled, received: (JSON.parse(raw) as unknown[]).length };
}
