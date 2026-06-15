import { load } from "cheerio";

import type { EventTag } from "@/types/event";
import { resolveEventLocation } from "@/lib/events/location";

import type {
  EventSourceAdapter,
  NormalizationResult,
} from "./types";
import { createSourceFingerprint, parseRequiredDate } from "./utils";

interface WusaEventRecord {
  sourceId: string;
  url: string;
  title: string;
  description: string;
  organizer: string;
  start: string;
  end: string;
  location: string;
  categories: string[];
  image?: string;
}

const SOURCE = "wusa-events";
const CATEGORY_TAGS: Readonly<Record<string, EventTag>> = {
  "Free Food": "free-food",
  Social: "chill-social",
  Career: "career-coop",
};

function deriveTags(categories: string[]): EventTag[] {
  return [
    ...new Set(
      categories
        .map((category) => CATEGORY_TAGS[category.trim()])
        .filter((tag): tag is EventTag => Boolean(tag)),
    ),
  ];
}

function missingRequiredField(record: WusaEventRecord): boolean {
  return (
    [record.sourceId, record.title, record.organizer, record.location].some(
      (value) => !value.trim(),
    ) || !isHttpUrl(record.url)
  );
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function sourceFingerprint(record: WusaEventRecord): string | null {
  return createSourceFingerprint(SOURCE, record.sourceId);
}

function parseRaw(raw: string): WusaEventRecord[] {
  const $ = load(raw);

  return $(".wusa-event")
    .map((_, element) => {
      const event = $(element);
      const link = event.find(".title a").first();
      const image = event.find(".featured-image").first().attr("src")?.trim();
      const categories = event
        .find(".category")
        .map((_, category) => $(category).text())
        .get();

      return {
        sourceId: event.attr("data-id") ?? "",
        url: link.attr("href") ?? "",
        title: link.text(),
        description: event.find(".summary").first().text(),
        organizer: event.find(".host").first().text(),
        start: event.find(".starts-at").first().attr("datetime") ?? "",
        end: event.find(".ends-at").first().attr("datetime") ?? "",
        location: event.find(".venue").first().text(),
        categories,
        ...(image ? { image } : {}),
      };
    })
    .get();
}

function normalize(record: WusaEventRecord): NormalizationResult {
  const recordId = record.sourceId.trim() || undefined;

  if (missingRequiredField(record)) {
    return {
      ok: false,
      rejection: {
        source: SOURCE,
        ...(recordId ? { recordId } : {}),
        reason: "missing-required-field",
      },
    };
  }

  const startTime = parseRequiredDate(record.start.trim());
  const endTime = parseRequiredDate(record.end.trim());

  if (!startTime || !endTime) {
    return {
      ok: false,
      rejection: {
        source: SOURCE,
        recordId,
        reason: "invalid-date",
      },
    };
  }

  const fingerprint = sourceFingerprint(record);

  if (!fingerprint) {
    return {
      ok: false,
      rejection: {
        source: SOURCE,
        ...(recordId ? { recordId } : {}),
        reason: "missing-required-field",
      },
    };
  }

  const locationName = record.location.trim();
  const description = record.description.trim();
  const imageUrl = record.image?.trim();
  const resolvedLocation = resolveEventLocation({
    description,
    locationName,
  });
  const tags = deriveTags(record.categories);

  return {
    ok: true,
    event: {
      source: SOURCE,
      sourceUrl: record.url.trim(),
      sourceFingerprint: fingerprint,
      title: record.title.trim(),
      description: description || "No description provided.",
      clubName: record.organizer.trim(),
      startTime,
      endTime,
      locationName: resolvedLocation.locationName,
      ...(resolvedLocation.buildingCode
        ? { buildingCode: resolvedLocation.buildingCode }
        : {}),
      tags,
      ...(imageUrl && isHttpUrl(imageUrl) ? { imageUrl } : {}),
      isFreeFood: tags.includes("free-food"),
    },
  };
}

export const wusaEventsAdapter: EventSourceAdapter<WusaEventRecord> = {
  source: SOURCE,
  parseRaw,
  normalize,
  sourceFingerprint,
};
