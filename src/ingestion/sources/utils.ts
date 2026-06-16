import type { BuildingCode, EventTag } from "@/types/event";

const BUILDING_CODES = [
  "AL",
  "DC",
  "E5",
  "EC5",
  "E7",
  "FED",
  "MC",
  "PAC",
  "QNC",
  "SCH",
  "SLC",
  "TC",
] as const satisfies readonly BuildingCode[];

export function deriveBuildingCode(location: string): BuildingCode | undefined {
  return BUILDING_CODES.find((code) =>
    new RegExp(`\\b${code}\\b`, "i").test(location),
  );
}

export function deriveTags(...values: string[]): EventTag[] {
  const text = values.join(" ").toLowerCase();
  const tags: EventTag[] = [];

  if (
    /\bfree (food|pizza|snacks?|drinks?|dinner|lunch)\b/.test(text) ||
    /\bfood event\b/.test(text)
  ) {
    tags.push("free-food");
  }
  if (/\b(hackathon|hack[- ]?dev|developer|development|coding|code|software|programming)\b/.test(text)) {
    tags.push("hack-dev");
  }
  if (
    /\b(career fair|co-op|coop|internship|intern|resume|résumé|job|jobs|hiring|recruit(?:ing)?|networking|interview|employer|professional development)\b/.test(
      text,
    )
  ) {
    tags.push("career-coop");
  }
  if (
    /\b(board games?|game night|cards?|uno|catan|trivia|poker)\b/.test(text)
  ) {
    tags.push("games");
    tags.push("chill-social");
  }
  if (/\b(paint night|crafts?|arts?|diy|bake|make and take)\b/.test(text)) {
    tags.push("arts-crafts");
    tags.push("chill-social");
  }
  if (/\b(hangout|mingle|social hour|casual meetup)\b/.test(text)) {
    tags.push("hangout");
    tags.push("chill-social");
  }
  if (/\b(hike|hiking|outdoor|picnic|trail walk)\b/.test(text)) {
    tags.push("outdoors");
    tags.push("chill-social");
  }
  if (/\b(party|club night|pub crawl|night out)\b/.test(text)) {
    tags.push("nightlife");
    tags.push("chill-social");
  }
  if (/\b(yoga|meditation|wellness|mindfulness)\b/.test(text)) {
    tags.push("wellness");
    tags.push("chill-social");
  }
  if (/\b(movie night|movie|tv watch|watch party|film screening)\b/.test(text)) {
    tags.push("movie-tv");
    tags.push("chill-social");
  }
  if (
    /\b(social hour|social event|social night|social mixer|mingle|bonfire)\b/.test(
      text,
    )
  ) {
    tags.push("chill-social");
  }
  if (/\b(music|concert|performance|dj)\b/.test(text)) {
    tags.push("music");
  }
  if (/\b(reels?|film|video|showcase)\b/.test(text)) {
    tags.push("reels");
  }
  if (/\b(startup|start-up|pitch|founder|founders|venture|demo day|investor|incubator)\b/.test(text)) {
    tags.push("startup-pitch");
  }

  return [...new Set(tags)];
}

export function zonedDateTimeToIso(
  parts: {
    year: number;
    month: number;
    day: number;
    hour?: number;
    minute?: number;
    second?: number;
    millisecond?: number;
  },
  timeZone = "America/Toronto",
): string | null {
  const hour = parts.hour ?? 0;
  const minute = parts.minute ?? 0;
  const second = parts.second ?? 0;
  const millisecond = parts.millisecond ?? 0;
  const daysInMonth = new Date(
    Date.UTC(parts.year, parts.month, 0),
  ).getUTCDate();

  if (
    parts.month < 1 ||
    parts.month > 12 ||
    parts.day < 1 ||
    parts.day > daysInMonth ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59 ||
    millisecond < 0 ||
    millisecond > 999
  ) {
    return null;
  }

  const targetUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    hour,
    minute,
    second,
    millisecond,
  );

  if (Number.isNaN(targetUtc)) {
    return null;
  }

  try {
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
    let guess = targetUtc;

    for (let iteration = 0; iteration < 2; iteration += 1) {
      const formatted = Object.fromEntries(
        formatter
          .formatToParts(new Date(guess))
          .filter((part) => part.type !== "literal")
          .map((part) => [part.type, Number(part.value)]),
      );
      const representedUtc = Date.UTC(
        formatted.year,
        formatted.month - 1,
        formatted.day,
        formatted.hour,
        formatted.minute,
        formatted.second,
      );

      guess += targetUtc - representedUtc;
    }

    return new Date(guess).toISOString();
  } catch {
    return null;
  }
}

export function toAbsoluteHttpUrl(
  value: string,
  baseUrl: string,
): string | null {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  try {
    const url = new URL(trimmedValue, baseUrl);

    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}
