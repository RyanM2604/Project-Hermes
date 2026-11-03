import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { EventFeed, EventFilters, StartingSoonCarousel } from "@/components/feed";
import { filterEventsByTag, parseEventTag } from "@/lib/events";
import { loadFreshEvents } from "@/lib/events/load-events";
import { loadEventGoingCounts } from "@/lib/events/rsvp-summary";
import { HermesMotion } from "@/components/motion/HermesMotion";

export default async function EventsPage({ searchParams }: PageProps<"/events">) {
  const [params, events] = await Promise.all([searchParams, loadFreshEvents()]);
  const selectedTag = parseEventTag(params.tag);
  const filteredEvents = filterEventsByTag(events, selectedTag);
  const goingCounts = await loadEventGoingCounts(events.map((event) => event.id));
  return <HermesMotion variant="events"><main className="hm-events-page"><div className="hermes-container"><div className="hm-events-hero" data-motion="events-heading"><div><span className="hm-small-label">The campus guide · Waterloo</span><h1>Find your<br/><em>next thing.</em></h1><p>Events, free food, clubs, and opportunities happening around campus.</p></div><Link href="/signup" className="hm-events-hero-link">Join Hermes <ArrowUpRight size={18}/></Link></div><EventFilters events={events} selectedTag={selectedTag}/><StartingSoonCarousel events={events.slice(0, 5)} goingCounts={goingCounts}/><div id="event-feed"><EventFeed events={filteredEvents} goingCounts={goingCounts}/></div></div></main></HermesMotion>;
}
