import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { getEventThemeForEvent } from "@/lib/events/event-theme";
import type { HermesEvent } from "@/types/event";

const timeFormatter = new Intl.DateTimeFormat("en-CA", { hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" });

export function StartingSoonCarousel({ events }: { events: HermesEvent[]; goingCounts?: Record<string, number> }) {
  if (!events.length) return null;
  return <section className="hm-soon" aria-labelledby="starting-soon-heading"><div className="hm-section-heading"><h2 id="starting-soon-heading">Starting soon</h2><span>Make a last minute plan</span></div><div className="hm-soon-rail" data-motion="soon-rail">{events.map((event) => <Link key={event.id} href={`/events/${event.id}`} className="hm-soon-item" data-category={event.primaryTag ?? event.tags[0] ?? "general"}><div><span>{timeFormatter.format(new Date(event.startTime))}</span><ArrowUpRight size={20}/></div><span className="hm-soon-tag">{getEventThemeForEvent(event).label}</span><strong>{event.title}</strong><small>{event.clubName}</small></Link>)}</div></section>;
}
