import { load } from "cheerio";

import type { BuildingCode, EventTag } from "@/types/event";

import type {
  EventSourceAdapter,
  NormalizationResult,
} from "./types";
import { createSourceFingerprint, parseRequiredDate } from "./utils";

interface WusaClubEventRecord {
  sourceId: string;
  url: string;
  title: string;
  description: string;
  organizer: string;
  start: string;
  end: string;
  location: string;
  labels: string[];
  image?: string;
}

const SOURCE = "wusa-clubs";
const BUILDING_CODES = [
  "AL",
  "DC",
  "E5",
  "E7",
  "FED",
  "MC",
  "PAC",
  "QNC",
  "SCH",
  "SLC",
  "TC",
] as const satisfies BuildingCode[];
const LABEL_TAGS: Readonly<Record<string, readonly EventTag[]>> = {
  Developer: ["hack-dev"],
  Music: ["music", "reels"],
  Social: ["chill-social"],
  Startup: ["startup-pitch"],
};

function deriveBuildingCode(location: string): BuildingCode | undefined {
  return BUILDING_CODES.find((code) =>
    new RegExp(`\\b${code}\\b`, "i").test(location),
  );
}

function deriveTags(labels: string[]): EventTag[] {
  return [
    ...new Set(
      labels.flatMap((label) => LABEL_TAGS[label.trim()] ?? []),
    ),
  ];
}

function missingRequiredField(record: WusaClubEventRecord): boolean {
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

function sourceFingerprint(record: WusaClubEventRecord): string | null {
  return createSourceFingerprint(SOURCE, record.sourceId);
}

function parseRaw(raw: string): WusaClubEventRecord[] {
  const $ = load(raw);

  return $(".club-event")
    .map((_, element) => {
      const event = $(element);
      const link = event.find(".club-event__title a").first();
      const image = event.find(".club-event__image").first().attr("src")?.trim();
      const labels = event
        .find(".club-event__labels")
        .map((_, label) => $(label).text())
        .get();

      return {
        sourceId: event.attr("data-event") ?? "",
        url: link.attr("href") ?? "",
        title: link.text(),
        description: event.find(".club-event__description").first().text(),
        organizer: event.find(".club-name").first().text(),
        start: event.find(".club-event__start").first().attr("datetime") ?? "",
        end: event.find(".club-event__end").first().attr("datetime") ?? "",
        location: event.find(".club-event__location").first().text(),
        labels,
        ...(image ? { image } : {}),
      };
    })
    .get();
}

function normalize(record: WusaClubEventRecord): NormalizationResult {
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
  const buildingCode = deriveBuildingCode(locationName);
  const tags = deriveTags(record.labels);

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
      locationName,
      ...(buildingCode ? { buildingCode } : {}),
      tags,
      ...(imageUrl && isHttpUrl(imageUrl) ? { imageUrl } : {}),
      isFreeFood: tags.includes("free-food"),
    },
  };
}

export const wusaClubsAdapter: EventSourceAdapter<WusaClubEventRecord> = {
  source: SOURCE,
  parseRaw,
  normalize,
  sourceFingerprint,
};
