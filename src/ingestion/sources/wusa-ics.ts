import { createSourceFingerprint } from "@/lib/events/adapters";
import { resolveEventLocation } from "@/lib/events/location";
import type {
  NormalizationResult,
  NormalizedEventCandidate,
} from "@/lib/events/adapters";

import type { IngestionSource } from "../types";
import {
  deriveTags,
  toAbsoluteHttpUrl,
  zonedDateTimeToIso,
} from "./utils";

interface IcalProperty {
  name: string;
  params: Record<string, string>;
  value: string;
}

const SOURCE = "wusa-events";
const SOURCE_URL = "https://wusa.ca/events/?ical=1";

function unfoldLines(raw: string): string[] {
  return raw.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
}

function parseProperty(line: string): IcalProperty | null {
  const separator = line.indexOf(":");

  if (separator < 1) {
    return null;
  }

  const [name, ...rawParams] = line.slice(0, separator).split(";");
  const params = Object.fromEntries(
    rawParams.map((param) => {
      const [key, ...value] = param.split("=");
      return [key.toUpperCase(), value.join("=").replace(/^"|"$/g, "")];
    }),
  );

  return {
    name: name.toUpperCase(),
    params,
    value: line.slice(separator + 1),
  };
}

function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .replace(/\s+/g, " ")
    .trim();
}

function parseIcalDate(property?: IcalProperty): string | null {
  if (!property) {
    return null;
  }

  const value = property.value.trim();
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(value);

  if (dateOnly) {
    return zonedDateTimeToIso({
      year: Number(dateOnly[1]),
      month: Number(dateOnly[2]),
      day: Number(dateOnly[3]),
    });
  }

  const dateTime =
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(value);

  if (!dateTime) {
    return null;
  }

  if (dateTime[7] === "Z") {
    return new Date(
      Date.UTC(
        Number(dateTime[1]),
        Number(dateTime[2]) - 1,
        Number(dateTime[3]),
        Number(dateTime[4]),
        Number(dateTime[5]),
        Number(dateTime[6]),
      ),
    ).toISOString();
  }

  return zonedDateTimeToIso(
    {
      year: Number(dateTime[1]),
      month: Number(dateTime[2]),
      day: Number(dateTime[3]),
      hour: Number(dateTime[4]),
      minute: Number(dateTime[5]),
      second: Number(dateTime[6]),
    },
    property.params.TZID ?? "America/Toronto",
  );
}

function first(
  properties: readonly IcalProperty[],
  name: string,
): IcalProperty | undefined {
  return properties.find((property) => property.name === name);
}

function normalizeEvent(properties: IcalProperty[]): NormalizationResult {
  const uid = unescapeText(first(properties, "UID")?.value ?? "");
  const fingerprint = createSourceFingerprint(SOURCE, uid);
  const title = unescapeText(first(properties, "SUMMARY")?.value ?? "");
  const sourceUrl = toAbsoluteHttpUrl(
    first(properties, "URL")?.value ?? "",
    SOURCE_URL,
  );

  if (!uid || !fingerprint || !title || !sourceUrl) {
    return {
      ok: false,
      rejection: {
        source: SOURCE,
        ...(uid ? { recordId: uid } : {}),
        reason: "missing-required-field",
      },
    };
  }

  const startTime = parseIcalDate(first(properties, "DTSTART"));
  const endTime = parseIcalDate(first(properties, "DTEND")) ?? startTime;

  if (!startTime || !endTime) {
    return {
      ok: false,
      rejection: { source: SOURCE, recordId: uid, reason: "invalid-date" },
    };
  }

  const description =
    unescapeText(first(properties, "DESCRIPTION")?.value ?? "") ||
    "No description provided.";
  const locationName = unescapeText(first(properties, "LOCATION")?.value ?? "");
  const organizer =
    unescapeText(first(properties, "ORGANIZER")?.params.CN ?? "") ||
    "Waterloo Undergraduate Student Association";
  const categories = properties
    .filter((property) => property.name === "CATEGORIES")
    .flatMap((property) => property.value.split(","))
    .map(unescapeText);
  const tags = deriveTags(title, description, ...categories);
  const resolvedLocation = resolveEventLocation({
    description,
    locationName: locationName || "Location not provided",
  });
  const imageUrl = toAbsoluteHttpUrl(
    first(properties, "ATTACH")?.value ?? "",
    SOURCE_URL,
  );
  const event: NormalizedEventCandidate = {
    source: SOURCE,
    sourceUrl,
    sourceFingerprint: fingerprint,
    title,
    description,
    clubName: organizer,
    startTime,
    endTime,
    locationName: resolvedLocation.locationName,
    ...(resolvedLocation.buildingCode ? { buildingCode: resolvedLocation.buildingCode } : {}),
    tags,
    ...(imageUrl ? { imageUrl } : {}),
    isFreeFood: tags.includes("free-food"),
  };

  return { ok: true, event };
}

function normalizeEventSafely(properties: IcalProperty[]): NormalizationResult {
  try {
    return normalizeEvent(properties);
  } catch {
    const recordId = unescapeText(first(properties, "UID")?.value ?? "");

    return {
      ok: false,
      rejection: {
        source: SOURCE,
        ...(recordId ? { recordId } : {}),
        reason: "invalid-date",
      },
    };
  }
}

function parse(raw: string): NormalizationResult[] {
  const events: IcalProperty[][] = [];
  let current: IcalProperty[] | null = null;

  for (const line of unfoldLines(raw)) {
    if (line === "BEGIN:VEVENT") {
      current = [];
      continue;
    }
    if (line === "END:VEVENT") {
      if (current) {
        events.push(current);
      }
      current = null;
      continue;
    }
    if (current) {
      const property = parseProperty(line);
      if (property) {
        current.push(property);
      }
    }
  }

  return events.map(normalizeEventSafely);
}

export const wusaIcsSource: IngestionSource = {
  id: SOURCE,
  url: SOURCE_URL,
  acceptedContentTypes: ["text/calendar"],
  parse,
};
