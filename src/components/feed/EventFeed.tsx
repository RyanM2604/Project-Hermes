import { EventCard } from "@/components/events";
import type { HermesEvent } from "@/types/event";

interface EventFeedProps {
  events: HermesEvent[];
}

export function EventFeed({ events }: EventFeedProps) {
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
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </section>
  );
}
