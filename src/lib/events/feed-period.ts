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
