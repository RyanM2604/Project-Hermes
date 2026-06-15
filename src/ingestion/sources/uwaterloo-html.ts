import { load } from "cheerio";

import { createSourceFingerprint } from "@/lib/events/adapters";
import { resolveEventLocation } from "@/lib/events/location";
import type {
  NormalizationResult,
  NormalizedEventCandidate,
} from "@/lib/events/adapters";

import type { IngestionSource } from "../types";
import { deriveTags, toAbsoluteHttpUrl, zonedDateTimeToIso } from "./utils";

const SOURCE = "uwaterloo-events";
const SOURCE_URL = "https://uwaterloo.ca/events/";
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

function parseHour(value: string, meridiem: string): number {
  const hour = Number(value) % 12;
  return meridiem.toLowerCase() === "pm" ? hour + 12 : hour;
}

function parseDisplayedDate(
  value: string,
): { startTime: string; endTime: string } | null {
  const normalized = value.replace(/\s+/g, " ").trim();
  const allDay =
    /^(?:\w+,\s+)?(\w+)\s+(\d{1,2}),\s+(\d{4})\s+\(all day\)$/i.exec(
      normalized,
    );

  if (allDay) {
    const month = MONTHS[allDay[1]];
    if (!month) return null;

    const startTime = zonedDateTimeToIso({
      year: Number(allDay[3]),
      month,
      day: Number(allDay[2]),
    });
    const nextDay = new Date(
      Date.UTC(Number(allDay[3]), month - 1, Number(allDay[2]) + 1),
    );
    const exclusiveEnd = zonedDateTimeToIso({
      year: nextDay.getUTCFullYear(),
      month: nextDay.getUTCMonth() + 1,
      day: nextDay.getUTCDate(),
    });

    if (!startTime || !exclusiveEnd) return null;

    return {
      startTime,
      endTime: new Date(new Date(exclusiveEnd).getTime() - 1).toISOString(),
    };
  }

  const timed =
    /^(?:\w+,\s+)?(\w+)\s+(\d{1,2}),\s+(\d{4})\s+(\d{1,2}):(\d{2})\s*(am|pm)\s*[-–]\s*(\d{1,2}):(\d{2})\s*(am|pm)/i.exec(
      normalized,
    );

  if (!timed) return null;

  const month = MONTHS[timed[1]];
  if (!month) return null;

  const base = {
    year: Number(timed[3]),
    month,
    day: Number(timed[2]),
  };
  const startTime = zonedDateTimeToIso({
    ...base,
    hour: parseHour(timed[4], timed[6]),
    minute: Number(timed[5]),
  });
  const endTime = zonedDateTimeToIso({
    ...base,
    hour: parseHour(timed[7], timed[9]),
    minute: Number(timed[8]),
  });

  return startTime && endTime ? { startTime, endTime } : null;
}

function parse(raw: string): NormalizationResult[] {
  const $ = load(raw);

  return $(".card__teaser--event")
    .map((_, element): NormalizationResult => {
      const card = $(element);
      const titleLink = card.find(".card__title a").first();
      const title = titleLink.text().replace(/\s+/g, " ").trim();
      const sourceUrl = toAbsoluteHttpUrl(
        titleLink.attr("href") ?? "",
        SOURCE_URL,
      );
      const recordId = sourceUrl ?? undefined;
      const fingerprint = sourceUrl
        ? createSourceFingerprint(SOURCE, sourceUrl)
        : null;

      if (!title || !sourceUrl || !fingerprint) {
        return {
          ok: false,
          rejection: {
            source: SOURCE,
            ...(recordId ? { recordId } : {}),
            reason: "missing-required-field",
          },
        };
      }

      const times = parseDisplayedDate(card.find(".uw-date").first().text());

      if (!times) {
        return {
          ok: false,
          rejection: { source: SOURCE, recordId, reason: "invalid-date" },
        };
      }

      const description =
        card.find(".card__content").first().text().replace(/\s+/g, " ").trim() ||
        "No description provided.";
      const sourceTags = card
        .find(".card__tags .tag")
        .map((_, tag) => $(tag).text())
        .get();
      const tags = deriveTags(title, description, ...sourceTags);
      const resolvedLocation = resolveEventLocation({
        description,
        locationName: "Location not provided",
      });
      const imageUrl = toAbsoluteHttpUrl(
        card.find(".card__image img").first().attr("src") ?? "",
        SOURCE_URL,
      );
      const event: NormalizedEventCandidate = {
        source: SOURCE,
        sourceUrl,
        sourceFingerprint: fingerprint,
        title,
        description,
        clubName: "University of Waterloo",
        ...times,
        locationName: resolvedLocation.locationName,
        ...(resolvedLocation.buildingCode ? { buildingCode: resolvedLocation.buildingCode } : {}),
        tags,
        ...(imageUrl ? { imageUrl } : {}),
        isFreeFood: tags.includes("free-food"),
      };

      return { ok: true, event };
    })
    .get();
}

export const uwaterlooHtmlSource: IngestionSource = {
  id: SOURCE,
  url: SOURCE_URL,
  acceptedContentTypes: ["text/html"],
  parse,
};
