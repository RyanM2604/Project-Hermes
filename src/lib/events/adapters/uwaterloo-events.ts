import { load } from "cheerio";

import type { BuildingCode } from "@/types/event";

import type {
  EventSourceAdapter,
  NormalizationResult,
} from "./types";
import { createSourceFingerprint, parseRequiredDate } from "./utils";

export interface UWaterlooEventRecord {
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

const BUILDING_CODES = ["QNC", "TC", "SLC"] as const satisfies BuildingCode[];

function deriveBuildingCode(location: string): BuildingCode | undefined {
  return BUILDING_CODES.find((code) =>
    new RegExp(`\\b${code}\\b`, "i").test(location),
  );
}

function missingRequiredField(record: UWaterlooEventRecord): boolean {
  return [record.sourceId, record.title, record.organizer, record.url, record.location]
    .some((value) => !value.trim());
}

export const uwaterlooEventsAdapter: EventSourceAdapter<UWaterlooEventRecord> = {
  source: "uwaterloo-events",

  parseRaw(raw) {
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
  },

  normalize(record): NormalizationResult {
    const recordId = record.sourceId.trim() || undefined;

    if (missingRequiredField(record)) {
      return {
        ok: false,
        rejection: {
          source: this.source,
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
          source: this.source,
          recordId,
          reason: "invalid-date",
        },
      };
    }

    const sourceFingerprint = this.sourceFingerprint(record);

    if (!sourceFingerprint) {
      return {
        ok: false,
        rejection: {
          source: this.source,
          ...(recordId ? { recordId } : {}),
          reason: "missing-required-field",
        },
      };
    }

    const locationName = record.location.trim();
    const description = record.description.trim();
    const imageUrl = record.image?.trim();
    const buildingCode = deriveBuildingCode(locationName);

    return {
      ok: true,
      event: {
        source: this.source,
        sourceUrl: record.url.trim(),
        sourceFingerprint,
        title: record.title.trim(),
        description: description || "No description provided.",
        clubName: record.organizer.trim(),
        startTime,
        endTime,
        locationName,
        ...(buildingCode ? { buildingCode } : {}),
        tags: [],
        ...(imageUrl ? { imageUrl } : {}),
        isFreeFood: false,
      },
    };
  },

  sourceFingerprint(record) {
    return createSourceFingerprint(this.source, record.sourceId);
  },
};
