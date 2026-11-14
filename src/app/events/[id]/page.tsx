import Link from "next/link";
import { ArrowLeft, ArrowUpRight, CalendarDays, Clock3, MapPin } from "lucide-react";
import { RSVPButton, SaveEventButton } from "@/components/events";
import { EventAttendeeStack } from "@/components/events/EventAttendeeStack";
import { getEventThemeForEvent } from "@/lib/events/event-theme";
import { formatEventLocation } from "@/lib/events";
import { hasEventEnded } from "@/lib/events/format";
import { loadEventGoingCounts } from "@/lib/events/rsvp-summary";
import { formatEventTagLabel, getEventSocialSubTag } from "@/lib/events/social-tags";
import { getEventById } from "@/lib/events/repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { HermesEvent } from "@/types/event";
import { HermesMotion } from "@/components/motion/HermesMotion";

const dateFormatter = new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "America/Toronto" });
const timeFormatter = new Intl.DateTimeFormat("en-CA", { hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" });
function visibleTags(tags: HermesEvent["tags"]) { const socialSubTag = getEventSocialSubTag(tags); return tags.filter((tag) => tag !== "chill-social" || socialSubTag === undefined); }

export default async function EventDetailPage({ params }: PageProps<"/events/[id]">) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const [event, { data: { user } }, goingCounts] = await Promise.all([getEventById(id), supabase.auth.getUser(), loadEventGoingCounts([id])]);
  if (!event) return <main className="hm-detail-page"><div className="hermes-container hm-not-found"><h1>This event is no longer available.</h1><Link href="/events" className="hermes-button hermes-button-gold">Back to events</Link></div></main>;

  const start = new Date(event.startTime);
  const end = new Date(event.endTime);
  const theme = getEventThemeForEvent(event);
  return <HermesMotion variant="detail"><main className="hm-detail-page"><div className="hermes-container"><Link href="/events" className="hm-back-link"><ArrowLeft size={17}/> All events</Link><article className="hm-detail" data-category={event.primaryTag ?? event.tags[0] ?? "general"}>
    <header className="hm-detail-header"><div className="hm-detail-heading" data-motion="detail-heading"><span className="hm-small-label">{theme.label} / {event.clubName}</span><h1>{event.title}</h1><div className="hm-detail-tags">{visibleTags(event.tags).map((tag) => <span key={tag}>{formatEventTagLabel(tag)}</span>)}{event.isFreeFood && <span>Free food</span>}</div></div><div className="hm-detail-stamp"><span>YOUR NEXT</span><strong>good<br/>plan.</strong><ArrowUpRight size={27}/></div></header>
    <div className="hm-detail-body"><div className="hm-detail-story"><h2>About this event</h2><p>{event.description}</p><a href={event.sourceUrl} target="_blank" rel="noreferrer" className="hermes-text-link">View original source <ArrowUpRight size={17}/></a></div><aside className="hm-detail-aside" data-motion="detail-aside"><h2>The details</h2><dl><div><CalendarDays size={18}/><span><dt>Date</dt><dd>{dateFormatter.format(start)}</dd></span></div><div><Clock3 size={18}/><span><dt>Time</dt><dd><time dateTime={event.startTime}>{timeFormatter.format(start)}</time> – <time dateTime={event.endTime}>{timeFormatter.format(end)}</time>{event.endTimeEstimated && <span> (estimated end)</span>}</dd></span></div><div><MapPin size={18}/><span><dt>Where</dt><dd>{formatEventLocation(event)}</dd></span></div></dl>{goingCounts[event.id] > 0 && <div className="hm-detail-going"><EventAttendeeStack goingCount={goingCounts[event.id]}/></div>}<div className="hm-detail-actions">{hasEventEnded(event.endTime) ? <p>This event has ended.</p> : <RSVPButton eventId={event.id} isAuthenticated={Boolean(user)}/>}<SaveEventButton eventId={event.id}/></div></aside></div>
  </article></div></main></HermesMotion>;
}
