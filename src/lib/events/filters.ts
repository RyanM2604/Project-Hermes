import type { EventTag, HermesEvent } from "@/types/event";

export const eventTagFilters = [
  { tag: "free-food", label: "Free Food" },
  { tag: "hack-dev", label: "Hack + Dev" },
  { tag: "career-coop", label: "Career + Co-op" },
  { tag: "chill-social", label: "Chill + Social" },
  { tag: "music", label: "Music" },
  { tag: "startup-pitch", label: "Startup + Pitch" },
] as const satisfies ReadonlyArray<{ tag: EventTag; label: string }>;

const filterTags = new Set<EventTag>(eventTagFilters.map(({ tag }) => tag));

export function parseEventTag(
  value: string | string[] | undefined,
): EventTag | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  return filterTags.has(value as EventTag) ? (value as EventTag) : undefined;
}

export function filterEventsByTag(
  events: HermesEvent[],
  tag: EventTag | undefined,
) {
  return tag ? events.filter((event) => event.tags.includes(tag)) : events;
}
