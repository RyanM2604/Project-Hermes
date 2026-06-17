import { load } from "cheerio";

import { createSourceFingerprint } from "@/lib/events/adapters";
import { resolveEventLocation } from "@/lib/events/location";
import type {
  NormalizationResult,
  NormalizedEventCandidate,
} from "@/lib/events/adapters";

import type { IngestionSource } from "../types";
import { deriveTags, toAbsoluteHttpUrl, zonedDateTimeToIso } from "./utils";
import { instagramAccounts, type InstagramAccount } from "./instagram-accounts";

interface InstagramProfilePost {
  shortcode: string;
  caption: string;
  postedAt?: string;
  title?: string;
  imageUrl?: string;
  locationName?: string;
}

const SOURCE = "instagram-clubs";
const SOURCE_URL = "https://www.instagram.com/";
const EVENT_SIGNAL =
  /\b(event|rsvp|join|workshop|talk|social|hangout|meeting|screening|mixer|tournament|info session|free food|free pizza|pizza|games)\b/i;
const MONTHS: Readonly<Record<string, number>> = {
  January: 1,
  February: 2,
  March: 3,
  April: 4,
  May: 5,
  June: 6,
  July: 7,
  August: 8,
  September: 9,
  October: 10,
  November: 11,
  December: 12,
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstString(...values: unknown[]): string | undefined {
  return values.find(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  )?.trim();
}

function shortcodeFromUrl(value: string): string | undefined {
  const match = /\/(p|reel|tv)\/([^/?#]+)/.exec(value);

  return match?.[2];
}

function isoFromTimestamp(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value * 1000).toISOString();
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = new Date(value);

    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }

  return undefined;
}

function parseJsonFragment(raw: string): unknown | null {
  const trimmed = raw.trim();

  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    // continue
  }

  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) {
    try {
      return JSON.parse(trimmed.slice(objectStart, objectEnd + 1));
    } catch {
      // continue
    }
  }

  const arrayStart = trimmed.indexOf("[");
  const arrayEnd = trimmed.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    try {
      return JSON.parse(trimmed.slice(arrayStart, arrayEnd + 1));
    } catch {
      // continue
    }
  }

  return null;
}

function collectScriptPayloads(raw: string): unknown[] {
  const $ = load(raw);

  return $("script")
    .map((_, element) => parseJsonFragment($(element).text()))
    .get()
    .filter((payload): payload is unknown => payload !== null);
}

function postFromNode(node: Record<string, unknown>): InstagramProfilePost | null {
  const shortcode = firstString(
    node.shortcode,
    node.code,
    node.id,
    typeof node.url === "string" ? shortcodeFromUrl(node.url) : undefined,
    typeof node.permalink === "string" ? shortcodeFromUrl(node.permalink) : undefined,
    isRecord(node.shortcode_media)
      ? firstString(
          node.shortcode_media.shortcode,
          node.shortcode_media.code,
          node.shortcode_media.id,
          typeof node.shortcode_media.url === "string"
            ? shortcodeFromUrl(node.shortcode_media.url)
            : undefined,
          typeof node.shortcode_media.permalink === "string"
            ? shortcodeFromUrl(node.shortcode_media.permalink)
            : undefined,
        )
      : undefined,
  );

  if (!shortcode) {
    return null;
  }

  const nested = isRecord(node.shortcode_media) ? node.shortcode_media : undefined;

  const caption = firstString(
    node.caption,
    node.description,
    node.text,
    node.accessibility_caption,
    nested?.caption,
    nested?.description,
    nested?.text,
    nested?.accessibility_caption,
    isRecord(node.edge_media_to_caption)
      ? firstString(
          Array.isArray(node.edge_media_to_caption.edges)
            ? node.edge_media_to_caption.edges
                .map((edge) =>
                  isRecord(edge) && isRecord(edge.node)
                    ? firstString(edge.node.text)
                    : undefined,
                )
                .find((text) => Boolean(text))
            : undefined,
        )
      : undefined,
    isRecord(nested?.edge_media_to_caption)
      ? firstString(
          Array.isArray(nested.edge_media_to_caption.edges)
            ? nested.edge_media_to_caption.edges
                .map((edge) =>
                  isRecord(edge) && isRecord(edge.node)
                    ? firstString(edge.node.text)
                    : undefined,
                )
                .find((text) => Boolean(text))
            : undefined,
        )
      : undefined,
    firstString(node.title, nested?.title, node.name, nested?.name),
  ) ?? "";

  if (!caption) {
    return null;
  }

  const postedAt = firstString(
    node.postedAt,
    node.datePublished,
    node.date_published,
    node.created_time,
    isoFromTimestamp(node.taken_at_timestamp),
    node.taken_at_time,
    nested ? firstString(nested.datePublished, nested.taken_at_time) : undefined,
    nested ? isoFromTimestamp(nested.taken_at_timestamp) : undefined,
  );

  const imageUrl = firstString(
    node.imageUrl,
    node.display_url,
    node.thumbnail_src,
    node.thumbnail_url,
    nested?.display_url,
    nested?.thumbnail_src,
    nested?.thumbnail_url,
    typeof node.url === "string" ? node.url : undefined,
    typeof nested?.url === "string" ? nested.url : undefined,
  );

  const locationName = firstString(
    node.locationName,
    node.place_name,
    isRecord(node.location)
      ? firstString(node.location.name, node.location.street_address)
      : undefined,
    nested?.locationName,
    nested?.place_name,
    isRecord(nested?.location)
      ? firstString(nested.location.name, nested.location.street_address)
      : undefined,
  );

  return {
    shortcode,
    caption,
    ...(postedAt ? { postedAt } : {}),
    ...(titleFromCaption(caption) ? { title: titleFromCaption(caption) } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(locationName ? { locationName } : {}),
  };
}

function titleFromCaption(caption?: string): string | undefined {
  if (!caption) {
    return undefined;
  }

  return normalizeWhitespace(caption.split(/[.\n|•-]/)[0] ?? "");
}

function collectPostsFromValue(value: unknown, posts: InstagramProfilePost[]): void {
  if (Array.isArray(value)) {
    value.forEach((item) => collectPostsFromValue(item, posts));
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  const directPost = postFromNode(value);

  if (directPost) {
    posts.push(directPost);
  }

  if (Array.isArray(value.posts)) {
    value.posts.forEach((item) => collectPostsFromValue(item, posts));
  }

  if (isRecord(value.graphql)) {
    collectPostsFromValue(value.graphql, posts);
  }

  if (isRecord(value.entry_data)) {
    collectPostsFromValue(value.entry_data, posts);
  }

  if (isRecord(value.user)) {
    collectPostsFromValue(value.user, posts);
  }

  if (isRecord(value.shortcode_media)) {
    collectPostsFromValue(value.shortcode_media, posts);
  }

  if (
    isRecord(value.edge_owner_to_timeline_media) &&
    Array.isArray(value.edge_owner_to_timeline_media.edges)
  ) {
    value.edge_owner_to_timeline_media.edges.forEach((edge) =>
      collectPostsFromValue(edge, posts),
    );
  }

  if (isRecord(value.node)) {
    collectPostsFromValue(value.node, posts);
  }

  for (const nestedValue of Object.values(value)) {
    if (Array.isArray(nestedValue) || isRecord(nestedValue)) {
      collectPostsFromValue(nestedValue, posts);
    }
  }
}

function extractStructuredPosts(raw: string): InstagramProfilePost[] {
  const posts: InstagramProfilePost[] = [];

  collectScriptPayloads(raw).forEach((payload) => {
    collectPostsFromValue(payload, posts);
  });

  const seen = new Set<string>();

  return posts.filter((post) => {
    if (seen.has(post.shortcode)) {
      return false;
    }

    seen.add(post.shortcode);
    return true;
  });
}

function extractFallbackPosts(raw: string): InstagramProfilePost[] {
  const $ = load(raw);

  return $("article")
    .map((_, element) => {
      const article = $(element);
      const link = article.find('a[href*="/p/"], a[href*="/reel/"], a[href*="/tv/"]').first();
      const shortcode = link
        .attr("href")
        ?.split("/")
        .filter(Boolean)
        .find((part) => part !== "p" && part !== "reel" && part !== "tv");

      if (!shortcode) {
        return null;
      }

      const caption = normalizeWhitespace(
        article.find("p").first().text() || article.text(),
      );
      const title = normalizeWhitespace(
        article.find("h1, h2, h3").first().text(),
      );
      const postedAt =
        article.find("time[datetime]").first().attr("datetime") ?? undefined;
      const imageUrl =
        article.find("img").first().attr("src")?.trim() || undefined;
      const locationName = normalizeWhitespace(
        article.find("[data-location]").first().text(),
      );

      return {
        shortcode,
        caption,
        ...(title ? { title } : {}),
        ...(postedAt ? { postedAt } : {}),
        ...(imageUrl ? { imageUrl } : {}),
        ...(locationName ? { locationName } : {}),
      };
    })
    .get()
    .filter((post): post is InstagramProfilePost => post !== null);
}

function extractPosts(raw: string): InstagramProfilePost[] {
  const structured = extractStructuredPosts(raw);

  if (structured.length > 0) {
    return structured;
  }

  return extractFallbackPosts(raw);
}

function parseCaptionDateTime(
  caption: string,
  postedAt?: string,
): { startTime: string; endTime: string } | null {
  const fallbackYear = postedAt
    ? new Date(postedAt).getUTCFullYear()
    : new Date().getUTCFullYear();

  const dateTimeRange =
    /\b(?:on\s+)?(?:\w+,\s*)?(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:,\s*(\d{4}))?(?:\s+at\s+|\s+)(\d{1,2})(?::(\d{2}))?\s*(am|pm)(?:\s*[-–to]+\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm))?/i.exec(
      caption,
    );

  if (!dateTimeRange) {
    return null;
  }

  const month = MONTHS[dateTimeRange[1]];

  if (!month) {
    return null;
  }

  const year = Number(dateTimeRange[3] ?? fallbackYear);
  const startTime = zonedDateTimeToIso({
    year,
    month,
    day: Number(dateTimeRange[2]),
    hour: Number(dateTimeRange[4]) % 12 + (dateTimeRange[6].toLowerCase() === "pm" ? 12 : 0),
    minute: Number(dateTimeRange[5] ?? 0),
  });

  if (!startTime) {
    return null;
  }

  const explicitEndHour = dateTimeRange[7];
  const explicitEndPeriod = dateTimeRange[9];

  if (explicitEndHour && explicitEndPeriod) {
    const endTime = zonedDateTimeToIso({
      year,
      month,
      day: Number(dateTimeRange[2]),
      hour:
        Number(explicitEndHour) % 12 +
        (explicitEndPeriod.toLowerCase() === "pm" ? 12 : 0),
      minute: Number(dateTimeRange[8] ?? 0),
    });

    return endTime ? { startTime, endTime } : null;
  }

  return {
    startTime,
    endTime: new Date(new Date(startTime).getTime() + 2 * 60 * 60 * 1000).toISOString(),
  };
}

function normalizePost(
  account: InstagramAccount,
  post: InstagramProfilePost,
): NormalizationResult {
  const title = normalizeWhitespace(
    post.title ?? titleFromCaption(post.caption) ?? "",
  );
  const caption = normalizeWhitespace(post.caption);

  if (!post.shortcode || !title || !caption || !EVENT_SIGNAL.test(`${title} ${caption}`)) {
    return {
      ok: false,
      rejection: {
        source: SOURCE,
        ...(post.shortcode ? { recordId: post.shortcode } : {}),
        reason: "missing-required-field",
      },
    };
  }

  const times = parseCaptionDateTime(caption, post.postedAt);

  if (!times) {
    return {
      ok: false,
      rejection: {
        source: SOURCE,
        recordId: post.shortcode,
        reason: "invalid-date",
      },
    };
  }

  const sourceUrl = `https://www.instagram.com/p/${post.shortcode}/`;
  const fingerprint = createSourceFingerprint(
    SOURCE,
    `${account.instagramHandle}:${post.shortcode}`,
  );

  if (!fingerprint) {
    return {
      ok: false,
      rejection: {
        source: SOURCE,
        recordId: post.shortcode,
        reason: "missing-required-field",
      },
    };
  }

  const resolvedLocation = resolveEventLocation({
    description: caption,
    locationName: post.locationName ?? "Location not provided",
  });
  const tags = deriveTags(title, caption, account.clubName);
  const imageUrl = post.imageUrl
    ? toAbsoluteHttpUrl(post.imageUrl, SOURCE_URL) ?? undefined
    : undefined;

  const event: NormalizedEventCandidate = {
    source: SOURCE,
    sourceUrl,
    sourceFingerprint: fingerprint,
    title,
    description: caption,
    clubName: account.clubName,
    startTime: times.startTime,
    endTime: times.endTime,
    locationName: resolvedLocation.locationName,
    ...(resolvedLocation.buildingCode ? { buildingCode: resolvedLocation.buildingCode } : {}),
    tags,
    ...(imageUrl ? { imageUrl } : {}),
    isFreeFood: tags.includes("free-food"),
  };

  return { ok: true, event };
}

function parseForAccount(account: InstagramAccount, raw: string): NormalizationResult[] {
  return extractPosts(raw).map((post) => normalizePost(account, post));
}

export function createInstagramSource(account: InstagramAccount): IngestionSource {
  return {
    id: SOURCE,
    url: account.profileUrl,
    acceptedContentTypes: ["text/html"],
    parse(raw: string) {
      return parseForAccount(account, raw);
    },
  };
}

export const instagramPublicSources = instagramAccounts
  .filter((account) => account.active)
  .map(createInstagramSource);
