"use client";

import Link from "next/link";

import {
  eventTagFilters,
  getEventTagCounts,
  getVisibleSocialSubTags,
  socialSubTagFilters,
} from "@/lib/events/filters";
import { isSocialSubTag } from "@/lib/events/social-tags";
import { logClientInteraction } from "@/lib/interactions/log-client-interaction";
import type { EventTag, HermesEvent } from "@/types/event";

interface EventFiltersProps {
  events: HermesEvent[];
  selectedTag?: EventTag;
}

export function EventFilters({ events, selectedTag }: EventFiltersProps) {
  const counts = getEventTagCounts(events);
  const showSocialSubFilters =
    selectedTag === "chill-social" ||
    (selectedTag !== undefined && isSocialSubTag(selectedTag));
  const visibleSocialSubTags = getVisibleSocialSubTags(counts, selectedTag);

  function logFilterClick(tag: EventTag | "all") {
    logClientInteraction({
      action: "filter_click",
      eventId: "event-feed",
      metadata: { tag },
    });
  }

  return (
    <nav aria-label="Filter events by vibe" className="mb-8">
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8 lg:mx-0 lg:px-0">
        <Link
          href="/events#event-feed"
          onClick={() => logFilterClick("all")}
          aria-current={selectedTag ? undefined : "page"}
          className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
            selectedTag
              ? "border-white/10 bg-white/[0.04] text-zinc-400 hover:border-white/20 hover:text-white"
              : "border-white bg-white text-black"
          }`}
        >
          All Events <span className="ml-1 text-zinc-500">{counts.all}</span>
        </Link>

        {eventTagFilters.map(({ tag, label }) => {
          const isSelected =
            selectedTag === tag ||
            (tag === "chill-social" &&
              selectedTag !== undefined &&
              isSocialSubTag(selectedTag));
          const count = counts[tag];

          if (count === 0 && !isSelected) {
            return null;
          }

          return (
            <Link
              key={tag}
              href={`/events?tag=${tag}#event-feed`}
              onClick={() => logFilterClick(tag)}
              aria-current={isSelected ? "page" : undefined}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                isSelected
                  ? "border-blue-300 bg-blue-300 text-black"
                  : "border-white/10 bg-white/[0.04] text-zinc-400 hover:border-white/20 hover:text-white"
              }`}
            >
              {label} <span className="ml-1 text-zinc-500">{count}</span>
            </Link>
          );
        })}
      </div>

      {showSocialSubFilters && visibleSocialSubTags.length > 0 ? (
        <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8 lg:mx-0 lg:px-0">
          {socialSubTagFilters
            .filter(({ tag }) => visibleSocialSubTags.includes(tag))
            .map(({ tag, label }) => {
              const isSelected = selectedTag === tag;
              const count = counts[tag] ?? 0;

              return (
                <Link
                  key={tag}
                  href={`/events?tag=${tag}#event-feed`}
                  onClick={() => logFilterClick(tag)}
                  aria-current={isSelected ? "page" : undefined}
                  className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    isSelected
                      ? "border-violet-300 bg-violet-300 text-black"
                      : "border-white/10 bg-white/[0.04] text-zinc-400 hover:border-white/20 hover:text-white"
                  }`}
                >
                  {label}{" "}
                  <span className="ml-1 text-zinc-500">{count}</span>
                </Link>
              );
            })}
        </div>
      ) : null}
    </nav>
  );
}
