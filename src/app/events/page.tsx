import Link from "next/link";
import { EventFeed, EventFilters, StartingSoonCarousel } from "@/components/feed";
import { HermesMotion } from "@/components/motion/HermesMotion";
import { filterEventsByTag, parseEventTag } from "@/lib/events";
import { eventFeedHref, parseEventPeriod } from "@/lib/events/feed-period";
import { loadFreshEvents } from "@/lib/events/load-events";
import { loadEventGoingCounts } from "@/lib/events/rsvp-summary";

export default async function EventsPage({ searchParams }: PageProps<"/events">) {
  const params = await searchParams;
  const period = parseEventPeriod(params.view);
  const events = await loadFreshEvents({ period });
  const selectedTag = parseEventTag(params.tag);
  const filteredEvents = filterEventsByTag(events, selectedTag);
  const goingCounts = period === "past" ? {} : await loadEventGoingCounts(events.map((event) => event.id));

  return (
    <HermesMotion variant="events">
      <main className="hm-events-page hm-events-browse">
        <div className="hermes-container">
          <header className="hm-events-hero" data-motion="events-heading">
            <h1>{period === "past" ? "See what happened on campus." : "Find something worth showing up for."}</h1>
            <p>{period === "past" ? "Browse past events and their original sources." : "Events, free food, clubs, and opportunities happening around campus."}</p>
          </header>
          <nav className="hm-event-period" aria-label="Event dates">
            <Link href={eventFeedHref("upcoming", selectedTag).replace("#event-feed", "")} aria-current={period === "upcoming" ? "page" : undefined}>Upcoming</Link>
            <Link href={eventFeedHref("past", selectedTag).replace("#event-feed", "")} aria-current={period === "past" ? "page" : undefined}>Past events</Link>
          </nav>
          <EventFilters events={events} selectedTag={selectedTag} period={period} />
          {period === "upcoming" && <StartingSoonCarousel events={events.slice(0, 5)} goingCounts={goingCounts} />}
          <div id="event-feed" className="hm-events-feed-anchor">
            <EventFeed events={filteredEvents} goingCounts={goingCounts} period={period} />
          </div>
        </div>
      </main>
    </HermesMotion>
  );
}
