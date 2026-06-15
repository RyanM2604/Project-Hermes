import { load } from "cheerio";

import { resolveEventLocation } from "@/lib/events/location";

import type {
  EventSourceAdapter,
  NormalizationResult,
} from "./types";
import { createSourceFingerprint, parseRequiredDate } from "./utils";

interface UWaterlooEventRecord {
  sourceId: string;
  url: string;
  title: string;
  description: string;
  organizer: string;
  start: string;
  end: string;
  location: string;
  image?: string;
}

const SOURCE = "uwaterloo-events";

function missingRequiredField(record: UWaterlooEventRecord): boolean {
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

function sourceFingerprint(record: UWaterlooEventRecord): string | null {
  return createSourceFingerprint(SOURCE, record.sourceId);
}

function parseRaw(raw: string): UWaterlooEventRecord[] {
  const $ = load(raw);

  return $(".event-card")
    .map((_, element) => {
      const card = $(element);
      const link = card.find(".event-link").first();
      const image = card.find(".event-image").first().attr("src")?.trim();

      return {
        sourceId: card.attr("data-event-id") ?? "",
        url: link.attr("href") ?? "",
        title: link.text(),
        description: card.find(".event-description").first().text(),
        organizer: card.find(".event-organizer").first().text(),
        start: card.find(".event-start").first().attr("datetime") ?? "",
        end: card.find(".event-end").first().attr("datetime") ?? "",
        location: card.find(".event-location").first().text(),
        ...(image ? { image } : {}),
      };
    })
    .get();
}

function normalize(record: UWaterlooEventRecord): NormalizationResult {
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
      ...(resolvedLocation.buildingCode ? { buildingCode: resolvedLocation.buildingCode } : {}),
      tags: [],
      ...(imageUrl && isHttpUrl(imageUrl) ? { imageUrl } : {}),
      isFreeFood: false,
    },
  };
}

export const uwaterlooEventsAdapter: EventSourceAdapter<UWaterlooEventRecord> = {
  source: SOURCE,
  parseRaw,
  normalize,
  sourceFingerprint,
};
