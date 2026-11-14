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
