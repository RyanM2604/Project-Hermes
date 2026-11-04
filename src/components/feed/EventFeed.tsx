import { EventCard } from "@/components/events";
import type { HermesEvent } from "@/types/event";
import { EmptyFeedState } from "./EmptyFeedState";
import { TrackImpression } from "./TrackImpression";

export function EventFeed({
  events,
  goingCounts = {},
}: {
  events: HermesEvent[];
  goingCounts?: Record<string, number>;
}) {
  return (
    <section className="hm-feed" aria-labelledby="event-feed-heading">
      <div className="hm-section-heading">
        <h2 id="event-feed-heading">All events</h2>
        <span>{events.length} things to explore</span>
      </div>
      {events.length > 0 ? (
        <div className="hm-feed-list">
          {events.map((event) => (
            <TrackImpression key={event.id} eventId={event.id}>
              <EventCard event={event} goingCount={goingCounts[event.id] ?? 0} />
            </TrackImpression>
          ))}
        </div>
      ) : (
        <EmptyFeedState />
      )}
    </section>
  );
}
