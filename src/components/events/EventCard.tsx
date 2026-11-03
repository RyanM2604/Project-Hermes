"use client";

import { ArrowUpRight, MapPin, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { getEventThemeForEvent } from "@/lib/events/event-theme";
import { formatEventLocation } from "@/lib/events/format";
import { logClientInteraction } from "@/lib/interactions/log-client-interaction";
import type { HermesEvent } from "@/types/event";

const dayFormatter = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", timeZone: "America/Toronto" });
const timeFormatter = new Intl.DateTimeFormat("en-CA", { hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" });

export function EventCard({ event, goingCount = 0 }: { event: HermesEvent; goingCount?: number }) {
  const [dismissed, setDismissed] = useState(false);
  const theme = getEventThemeForEvent(event);
  const start = new Date(event.startTime);
  if (dismissed) return null;

  function logOpen() { logClientInteraction({ action: "open", eventId: event.id, metadata: { surface: "event_feed" } }); }
  function dismiss() { setDismissed(true); logClientInteraction({ action: "dismiss", eventId: event.id, metadata: { surface: "event_feed" } }); }

  return <article className="hm-event-card" data-category={event.primaryTag ?? event.tags[0] ?? "general"}>
    <div className="hm-event-date"><strong>{dayFormatter.format(start)}</strong><span>{timeFormatter.format(start)}</span></div>
    <div className="hm-event-body"><div className="hm-event-meta"><span>{theme.label}</span>{event.isFreeFood && theme.label !== "Free food" && <span>Free food</span>}</div><h3><Link href={`/events/${event.id}`} onClick={logOpen}>{event.title}</Link></h3><p className="hm-event-organizer">{event.clubName}</p><div className="hm-event-bottom"><span><MapPin size={15}/>{formatEventLocation(event)}</span>{goingCount > 0 && <span>{goingCount} going</span>}<a href={event.sourceUrl} target="_blank" rel="noreferrer">Original source ↗</a></div></div>
    <div className="hm-event-actions"><button type="button" onClick={dismiss} aria-label={`Hide ${event.title}`}><X size={17}/></button><Link href={`/events/${event.id}`} onClick={logOpen} aria-label={`View ${event.title}`}><ArrowUpRight size={20}/></Link></div>
  </article>;
}
