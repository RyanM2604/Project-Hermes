import { zonedDateTimeToIso } from "@/ingestion/sources/utils";
import type { EventTag } from "@/types/event";
export type EventPeriod = "upcoming" | "past";
export function parseEventPeriod(value: string | string[] | undefined): EventPeriod {
  return value === "past" ? "past" : "upcoming";
}
export function eventFeedHref(period: EventPeriod, tag?: EventTag): string {
  const params = new URLSearchParams();
  if (period === "past") params.set("view", "past");
  if (tag) params.set("tag", tag);
  return `/events${params.size ? `?${params}` : ""}#event-feed`;
}

/** Calendar-day boundaries are Toronto-local, including daylight-saving changes. */
export function torontoDayStart(now: Date): Date {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now).map(part => [part.type, part.value]));
  return new Date(zonedDateTimeToIso({ year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) })!);
}

export function startingSoon<T extends { startTime: string }>(events: readonly T[], now = new Date()): T[] {
  return events.filter(event => +new Date(event.startTime) >= +now).slice(0, 5);
}
