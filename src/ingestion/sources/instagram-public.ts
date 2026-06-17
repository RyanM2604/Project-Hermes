import { createSourceFingerprint } from "@/lib/events/adapters";
import { resolveEventLocation } from "@/lib/events/location";
import type {
  NormalizationResult,
  NormalizedEventCandidate,
} from "@/lib/events/adapters";

import type { IngestionSource } from "../types";
import { deriveTags, toAbsoluteHttpUrl, zonedDateTimeToIso } from "./utils";
import { instagramAccounts, type InstagramAccount } from "./instagram-accounts";

interface ApifyInstagramPost {
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
  title?: string;
  text?: string;
  description?: string;
  childPosts?: unknown[];
  [key: string]: unknown;
}

const SOURCE = "instagram-clubs";
const SOURCE_URL = "https://www.instagram.com/";
const EVENT_SIGNAL =
  /\b(event|rsvp|join|workshop|talk|social|hangout|meetup|meeting|screening|mixer|tournament|info session|free food|free pizza|pizza|games|study night|movie night|watch party|picnic|bbq|bonfire)\b/i;
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

function toLocalDateParts(date: Date): {
  year: number;
  month: number;
  day: number;
} {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function toTimeZoneParts(
  date: Date,
  timeZone = "America/Toronto",
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<string, number>;

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

function addDaysUtc(dateParts: {
  year: number;
  month: number;
  day: number;
}, days: number): { year: number; month: number; day: number } {
  const date = new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day));
  date.setUTCDate(date.getUTCDate() + days);

  return toLocalDateParts(date);
}

function parseClockTime(
  caption: string,
): { hour: number; minute: number; endHour?: number; endMinute?: number } | null {
  const range =
    /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*[-–to]+\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i.exec(
      caption,
    );

  if (range) {
    return {
      hour: Number(range[1]) % 12 + (range[3].toLowerCase() === "pm" ? 12 : 0),
      minute: Number(range[2] ?? 0),
      endHour: Number(range[4]) % 12 + (range[6].toLowerCase() === "pm" ? 12 : 0),
      endMinute: Number(range[5] ?? 0),
    };
  }

  const single =
    /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i.exec(caption);

  if (!single) {
    return null;
  }

  return {
    hour: Number(single[1]) % 12 + (single[3].toLowerCase() === "pm" ? 12 : 0),
    minute: Number(single[2] ?? 0),
  };
}

function parseJson(raw: string): unknown | null {
  const trimmed = raw.trim();

  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function postFromNode(node: Record<string, unknown>): ApifyInstagramPost | null {
  const shortCode = firstString(
    node.shortCode,
    node.shortcode,
    node.id,
    node.code,
    typeof node.url === "string" ? shortcodeFromUrl(node.url) : undefined,
    typeof node.inputUrl === "string" ? shortcodeFromUrl(node.inputUrl) : undefined,
  );

  const caption = firstString(
    node.caption,
    node.firstComment,
    node.title,
    node.text,
    node.description,
  );

  if (!shortCode || !caption) {
    return null;
  }

  const post: ApifyInstagramPost = {
    shortCode,
    caption,
  };

  for (const key of [
    "timestamp",
    "createdAt",
    "postedAt",
    "locationName",
    "displayUrl",
    "thumbnailUrl",
    "imageUrl",
    "url",
    "title",
    "text",
    "description",
  ] as const) {
    const valueText = firstString(node[key]);

    if (valueText) {
      post[key] = valueText;
    }
  }

  if (Array.isArray(node.childPosts)) {
    post.childPosts = node.childPosts;
  }

  return post;
}

function collectPosts(value: unknown, posts: ApifyInstagramPost[]): void {
  if (Array.isArray(value)) {
    value.forEach((item) => collectPosts(item, posts));
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  const directPost = postFromNode(value);

  if (directPost) {
    posts.push(directPost);
  }

  for (const nestedValue of Object.values(value)) {
    if (Array.isArray(nestedValue) || isRecord(nestedValue)) {
      collectPosts(nestedValue, posts);
    }
  }
}

function extractPosts(raw: string): ApifyInstagramPost[] {
  const payload = parseJson(raw);

  if (!payload) {
    return [];
  }

  const posts: ApifyInstagramPost[] = [];
  collectPosts(payload, posts);

  const seen = new Set<string>();

  return posts.filter((post) => {
    const key = post.shortCode ?? post.shortcode;

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function titleFromCaption(caption?: string): string | undefined {
  if (!caption) {
    return undefined;
  }

  return normalizeWhitespace(caption.split(/[.\n|•-]/)[0] ?? "");
}

function parseCaptionDateTime(
  caption: string,
  postedAt?: string,
): { startTime: string; endTime: string } | null {
  const fallbackDate = postedAt ? new Date(postedAt) : new Date();
  const fallbackYear = fallbackDate.getUTCFullYear();
  const fallbackMonth = fallbackDate.getUTCMonth() + 1;
  const fallbackDay = fallbackDate.getUTCDate();

  const dateTimeRange =
    /\b(?:on\s+)?(?:\w+,\s*)?(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:,\s*(\d{4}))?(?:\s+at\s+|\s+)(\d{1,2})(?::(\d{2}))?\s*(am|pm)(?:\s*[-–to]+\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm))?/i.exec(
      caption,
    );

  if (!dateTimeRange) {
    const relativeCue =
      /\b(today|tonight|tomorrow|this week)\b/i.exec(caption);

    if (!relativeCue) {
      return null;
    }

    const dateParts =
      relativeCue[1].toLowerCase() === "tomorrow"
        ? addDaysUtc(toTimeZoneParts(fallbackDate), 1)
        : {
            ...toTimeZoneParts(fallbackDate),
          };
    const time = parseClockTime(caption);

    const startTime = zonedDateTimeToIso({
      ...dateParts,
      hour: time?.hour ?? toTimeZoneParts(fallbackDate).hour,
      minute: time?.minute ?? toTimeZoneParts(fallbackDate).minute,
      second: time ? 0 : toTimeZoneParts(fallbackDate).second,
    });

    if (!startTime) {
      return null;
    }

    if (time?.endHour !== undefined) {
      const endTime = zonedDateTimeToIso({
        ...dateParts,
        hour: time.endHour,
        minute: time.endMinute ?? 0,
        second: 0,
      });

      return endTime ? { startTime, endTime } : null;
    }

    return {
      startTime,
      endTime: new Date(new Date(startTime).getTime() + 2 * 60 * 60 * 1000).toISOString(),
    };
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

function hasRelativeDateCue(caption: string): boolean {
  return /\b(today|tonight|tomorrow|this week)\b/i.test(caption);
}

function hasClockCue(caption: string): boolean {
  return /\b\d{1,2}(?::\d{2})?\s*(am|pm)\b/i.test(caption);
}

function hasLocationCue(caption: string, locationName?: string): boolean {
  return Boolean(locationName?.trim()) || /\b(QNC|SLC|MC|EC5|E7|DC|PAC|FED|AL|SCH|TC)\b/i.test(caption);
}

function normalizePost(
  account: InstagramAccount,
  post: ApifyInstagramPost,
): NormalizationResult {
  const title = normalizeWhitespace(
    post.title ?? titleFromCaption(post.caption) ?? "",
  );
  const caption = normalizeWhitespace(post.caption ?? "");

  if (
    !post.shortCode ||
    !title ||
    !caption ||
    !(
      EVENT_SIGNAL.test(`${title} ${caption}`) ||
      (hasRelativeDateCue(caption) &&
        (hasClockCue(caption) || hasLocationCue(caption, post.locationName)))
    )
  ) {
    return {
      ok: false,
      rejection: {
        source: SOURCE,
        ...(post.shortCode ? { recordId: post.shortCode } : {}),
        reason: "missing-required-field",
      },
    };
  }

  const postedAt = firstString(
    post.postedAt,
    post.timestamp,
    post.createdAt,
    isoFromTimestamp(post.timestamp),
  );
  const times = parseCaptionDateTime(caption, postedAt);

  if (!times) {
    return {
      ok: false,
      rejection: {
        source: SOURCE,
        recordId: post.shortCode,
        reason: "invalid-date",
      },
    };
  }

  const sourceUrl =
    toAbsoluteHttpUrl(post.url ?? "", SOURCE_URL) ??
    `https://www.instagram.com/p/${post.shortCode}/`;
  const fingerprint = createSourceFingerprint(
    SOURCE,
    `${account.instagramHandle}:${post.shortCode}`,
  );

  if (!fingerprint) {
    return {
      ok: false,
      rejection: {
        source: SOURCE,
        recordId: post.shortCode,
        reason: "missing-required-field",
      },
    };
  }

  const resolvedLocation = resolveEventLocation({
    description: caption,
    locationName: post.locationName ?? "Location not provided",
  });
  const tags = deriveTags(title, caption, account.clubName);
  const imageUrl = firstString(
    post.displayUrl,
    post.thumbnailUrl,
    post.imageUrl,
  )
    ? toAbsoluteHttpUrl(
        firstString(post.displayUrl, post.thumbnailUrl, post.imageUrl) ?? "",
        SOURCE_URL,
      ) ?? undefined
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
    acceptedContentTypes: ["application/json", "text/plain"],
    parse(raw: string) {
      return parseForAccount(account, raw);
    },
  };
}

export const instagramPublicSources = instagramAccounts
  .filter((account) => account.active)
  .sort((left, right) => (left.priority ?? Number.MAX_SAFE_INTEGER) - (right.priority ?? Number.MAX_SAFE_INTEGER))
  .map((account) => createInstagramSource(account));
