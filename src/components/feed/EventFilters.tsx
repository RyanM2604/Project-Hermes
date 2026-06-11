"use client";

import Link from "next/link";

import { eventTagFilters } from "@/lib/events/filters";
import { logClientInteraction } from "@/lib/interactions/log-client-interaction";
import type { EventTag } from "@/types/event";

interface EventFiltersProps {
  selectedTag?: EventTag;
}

export function EventFilters({ selectedTag }: EventFiltersProps) {
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
          All Events
        </Link>

        {eventTagFilters.map(({ tag, label }) => {
          const isSelected = selectedTag === tag;

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
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
