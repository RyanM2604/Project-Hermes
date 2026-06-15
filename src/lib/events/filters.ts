import {
  isSocialSubTag,
  socialSubTagLabels,
  socialSubTags,
  type SocialSubTag,
} from "@/lib/events/social-tags";
import type { EventTag, HermesEvent } from "@/types/event";

export const eventTagFilters = [
  { tag: "free-food", label: "Free Food" },
  { tag: "hack-dev", label: "Hack + Dev" },
  { tag: "career-coop", label: "Career + Co-op" },
  { tag: "chill-social", label: "Chill + Social" },
  { tag: "music", label: "Music" },
  { tag: "startup-pitch", label: "Startup + Pitch" },
] as const satisfies ReadonlyArray<{ tag: EventTag; label: string }>;

export const socialSubTagFilters = socialSubTags.map((tag) => ({
  tag,
  label: socialSubTagLabels[tag],
})) satisfies ReadonlyArray<{ tag: SocialSubTag; label: string }>;

const filterTags = new Set<EventTag>([
  ...eventTagFilters.map(({ tag }) => tag),
  ...socialSubTags,
]);

function eventMatchesSocialBucket(event: HermesEvent): boolean {
  return (
    event.tags.includes("chill-social") ||
    event.tags.some((tag) => isSocialSubTag(tag))
  );
}

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
  if (!tag) {
    return events;
  }

  if (tag === "chill-social") {
    return events.filter((event) => eventMatchesSocialBucket(event));
  }

  return events.filter((event) => event.tags.includes(tag));
}

export function getEventTagCounts(events: HermesEvent[]) {
  const counts = Object.fromEntries(
    eventTagFilters.map(({ tag }) => [tag, 0]),
  ) as Record<(typeof eventTagFilters)[number]["tag"], number>;

  const subTagCounts = Object.fromEntries(
    socialSubTags.map((tag) => [tag, 0]),
  ) as Record<SocialSubTag, number>;

  for (const event of events) {
    if (eventMatchesSocialBucket(event)) {
      counts["chill-social"] += 1;
    }

    for (const tag of event.tags) {
      if (isSocialSubTag(tag)) {
        subTagCounts[tag] += 1;
        continue;
      }

      if (tag in counts && tag !== "chill-social") {
        counts[tag as keyof typeof counts] += 1;
      }
    }
  }

  return {
    all: events.length,
    ...counts,
    ...subTagCounts,
  };
}

export function getVisibleSocialSubTags(
  counts: Record<string, number>,
  selectedTag?: string,
) {
  return socialSubTagFilters
    .map((item) => item.tag)
    .filter((tag) => (counts[tag] ?? 0) > 0 || tag === selectedTag);
}
