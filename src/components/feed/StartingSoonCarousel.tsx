import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { getEventThemeForEvent } from "@/lib/events/event-theme";
import { formatEventLocation } from "@/lib/events/format";
import type { HermesEvent } from "@/types/event";

const timeFormatter = new Intl.DateTimeFormat("en-CA", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Toronto",
});

export function StartingSoonCarousel({
  events,
  goingCounts = {},
}: {
  events: HermesEvent[];
  goingCounts?: Record<string, number>;
}) {
  if (events.length === 0) return null;

  return (
    <section className="hm-soon" aria-labelledby="starting-soon-heading">
      <div className="hm-section-heading">
        <h2 id="starting-soon-heading">Starting soon</h2>
        <span>Swipe to explore</span>
      </div>
      <div className="hm-soon-rail" data-motion="soon-rail">
        {events.map((event) => (
          <Link
            key={event.id}
            href={"/events/" + event.id}
            className="hm-soon-item"
            data-category={event.primaryTag ?? event.tags[0] ?? "general"}
          >
            <div className="hm-soon-topline">
              <time dateTime={event.startTime}>
                {timeFormatter.format(new Date(event.startTime))}
              </time>
              <ArrowUpRight size={19} aria-hidden="true" />
            </div>
            <div className="hm-soon-content">
              <span className="hm-soon-tag">{getEventThemeForEvent(event).label}</span>
              <h3>{event.title}</h3>
              <p>{event.clubName}</p>
              <small>{formatEventLocation(event)}</small>
              {(goingCounts[event.id] ?? 0) > 0 && (
                <span className="hm-soon-going">{goingCounts[event.id]} going</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
