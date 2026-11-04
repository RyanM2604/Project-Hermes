import { EventFeed, EventFilters, StartingSoonCarousel } from "@/components/feed";
import { HermesMotion } from "@/components/motion/HermesMotion";
import { filterEventsByTag, parseEventTag } from "@/lib/events";
import { loadFreshEvents } from "@/lib/events/load-events";
import { loadEventGoingCounts } from "@/lib/events/rsvp-summary";

export default async function EventsPage({ searchParams }: PageProps<"/events">) {
  const [params, events] = await Promise.all([searchParams, loadFreshEvents()]);
  const selectedTag = parseEventTag(params.tag);
  const filteredEvents = filterEventsByTag(events, selectedTag);
  const goingCounts = await loadEventGoingCounts(events.map((event) => event.id));

  return (
    <HermesMotion variant="events">
      <main className="hm-events-page hm-events-browse">
        <div className="hermes-container">
          <header className="hm-events-hero" data-motion="events-heading">
            <h1>Find something worth showing up for.</h1>
            <p>Events, free food, clubs, and opportunities happening around campus.</p>
          </header>
          <EventFilters events={events} selectedTag={selectedTag} />
          <StartingSoonCarousel events={events.slice(0, 5)} goingCounts={goingCounts} />
          <div id="event-feed" className="hm-events-feed-anchor">
            <EventFeed events={filteredEvents} goingCounts={goingCounts} />
          </div>
        </div>
      </main>
    </HermesMotion>
  );
}
