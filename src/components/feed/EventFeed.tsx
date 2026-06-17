import { EventCard } from "@/components/events";
import type { HermesEvent } from "@/types/event";
import { EmptyFeedState } from "./EmptyFeedState";
import { TrackImpression } from "./TrackImpression";

interface EventFeedProps {
  events: HermesEvent[];
  goingCounts?: Record<string, number>;
}

export function EventFeed({ events, goingCounts = {} }: EventFeedProps) {
  if (events.length === 0) {
    return (
      <section aria-labelledby="event-feed-heading">
        <div className="mb-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">
            Explore campus
          </p>
          <h2
            id="event-feed-heading"
            className="text-2xl font-bold tracking-tight text-white sm:text-3xl"
          >
            All Events
          </h2>
        </div>

        <EmptyFeedState />
      </section>
    );
  }

  return (
    <section aria-labelledby="event-feed-heading">
      <div className="mb-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">
          Explore campus
        </p>
        <h2
          id="event-feed-heading"
          className="text-2xl font-bold tracking-tight text-white sm:text-3xl"
        >
          All Events
        </h2>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {events.map((event) => (
          <TrackImpression key={event.id} eventId={event.id}>
            <EventCard event={event} goingCount={goingCounts[event.id] ?? 0} />
          </TrackImpression>
        ))}
      </div>
    </section>
  );
}
