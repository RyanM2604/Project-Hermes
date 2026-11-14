"use client";

import { ArrowUpRight, MapPin, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { getEventThemeForEvent } from "@/lib/events/event-theme";
import { formatEventLocation } from "@/lib/events/format";
import { formatEventTagLabel, getEventSocialSubTag } from "@/lib/events/social-tags";
import { logClientInteraction } from "@/lib/interactions/log-client-interaction";
import type { HermesEvent } from "@/types/event";

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Toronto",
});

const pastDateFormatter = new Intl.DateTimeFormat("en-CA", {
  weekday: "short", year: "numeric", month: "short", day: "numeric",
  hour: "numeric", minute: "2-digit", timeZone: "America/Toronto",
});

export function EventCard({
  event,
  goingCount = 0,
  isPast = false,
}: {
  event: HermesEvent;
  goingCount?: number;
  isPast?: boolean;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const imageUrl = event.imageUrl?.trim();
  const showImage = Boolean(imageUrl && imageUrl !== failedImageUrl);
  const theme = getEventThemeForEvent(event);
  const socialSubTag = getEventSocialSubTag(event.tags);
  const visibleTags = event.tags.filter(
    (tag) => tag !== "chill-social" || !socialSubTag,
  );

  function logOpen() {
    logClientInteraction({
      action: "open",
      eventId: event.id,
      metadata: { surface: "event_feed" },
    });
  }

  function dismiss() {
    setDismissed(true);
    logClientInteraction({
      action: "dismiss",
      eventId: event.id,
      metadata: { surface: "event_feed" },
    });
  }

  if (dismissed) return null;

  return (
    <article
      className="hm-event-card"
      data-category={event.primaryTag ?? event.tags[0] ?? "general"}
    >
      <div className="hm-event-media">
        {showImage && imageUrl ? (
          <Image
            key={imageUrl}
            src={imageUrl}
            alt={event.title}
            fill
            unoptimized
            loading="lazy"
            className="hm-event-image"
            referrerPolicy="no-referrer"
            onError={() => setFailedImageUrl(imageUrl)}
          />
        ) : (
          <>
            <span className="hm-event-media-label">{theme.label}</span>
            <span className="hm-event-media-mark" aria-hidden="true">
              {event.buildingCode ?? theme.label.slice(0, 1)}
            </span>
          </>
        )}
        {event.isFreeFood && <span className="hm-event-food">Free food</span>}
      </div>
      <button
        type="button"
        className="hm-event-dismiss"
        onClick={dismiss}
        aria-label={"Hide " + event.title}
      >
        <X size={16} aria-hidden="true" />
      </button>
      <div className="hm-event-body">
        <p className="hm-event-organizer">{event.clubName}</p>
        <h3>
          <Link href={"/events/" + event.id} onClick={logOpen}>
            {event.title}
          </Link>
        </h3>
        <div className="hm-event-facts">
          {isPast && <span>Ended</span>}
          <time dateTime={event.startTime}>
            {(isPast ? pastDateFormatter : dateFormatter).format(new Date(event.startTime))}
          </time>
          <span>
            <MapPin size={15} aria-hidden="true" />
            {formatEventLocation(event)}
          </span>
        </div>
        <div className="hm-event-tags">
          {visibleTags.slice(0, 3).map((tag) => (
            <span key={tag}>{formatEventTagLabel(tag)}</span>
          ))}
        </div>
        <div className="hm-event-bottom">
          {goingCount > 0 && <span>{goingCount} going</span>}
          <a href={event.sourceUrl} target="_blank" rel="noreferrer">
            Original source <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        </div>
      </div>
    </article>
  );
}
