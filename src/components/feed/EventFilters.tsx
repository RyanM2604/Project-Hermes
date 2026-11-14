"use client";

import Link from "next/link";
import { eventFeedHref, type EventPeriod } from "@/lib/events/feed-period";
import {
  eventTagFilters,
  getEventTagCounts,
  getVisibleSocialSubTags,
  socialSubTagFilters,
} from "@/lib/events/filters";
import { isSocialSubTag } from "@/lib/events/social-tags";
import { logClientInteraction } from "@/lib/interactions/log-client-interaction";
import type { EventTag, HermesEvent } from "@/types/event";

export function EventFilters({
  events,
  selectedTag,
  period = "upcoming",
}: {
  events: HermesEvent[];
  selectedTag?: EventTag;
  period?: EventPeriod;
}) {
  const counts = getEventTagCounts(events);
  const showSocial = selectedTag === "chill-social" ||
    (selectedTag !== undefined && isSocialSubTag(selectedTag));
  const visibleSocial = getVisibleSocialSubTags(counts, selectedTag);

  function logClick(tag: EventTag | "all") {
    logClientInteraction({
      action: "filter_click",
      eventId: "event-feed",
      metadata: { tag },
    });
  }

  return (
    <nav className="hm-filter" aria-label="Filter events by category">
      <div className="hm-filter-scroll">
        <Link
          href={eventFeedHref(period)}
          onClick={() => logClick("all")}
          aria-current={!selectedTag ? "page" : undefined}
        >
          All events <span>{counts.all}</span>
        </Link>
        {eventTagFilters.map(({ tag, label }) => {
          const active = selectedTag === tag ||
            (tag === "chill-social" && selectedTag !== undefined && isSocialSubTag(selectedTag));
          if (counts[tag] === 0 && !active) return null;
          return (
            <Link
              key={tag}
              href={eventFeedHref(period, tag)}
              onClick={() => logClick(tag)}
              aria-current={active ? "page" : undefined}
            >
              {label} <span>{counts[tag]}</span>
            </Link>
          );
        })}
      </div>
      {showSocial && visibleSocial.length > 0 && (
        <div className="hm-filter-scroll hm-filter-sub">
          {socialSubTagFilters
            .filter(({ tag }) => visibleSocial.includes(tag))
            .map(({ tag, label }) => (
              <Link
                key={tag}
                href={eventFeedHref(period, tag)}
                onClick={() => logClick(tag)}
                aria-current={selectedTag === tag ? "page" : undefined}
              >
                {label} <span>{counts[tag] ?? 0}</span>
              </Link>
            ))}
        </div>
      )}
    </nav>
  );
}
