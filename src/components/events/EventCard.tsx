"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { EventThemeMotif } from "@/components/events/EventThemeMotif";
import { getEventThemeForEvent } from "@/lib/events/event-theme";
import { formatEventLocation } from "@/lib/events/format";
import { logClientInteraction } from "@/lib/interactions/log-client-interaction";
import type { HermesEvent } from "@/types/event";

interface EventCardProps {
  event: HermesEvent;
}

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Toronto",
});

function formatTag(tag: HermesEvent["tags"][number]) {
  return tag
    .split("-")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

export function EventCard({ event }: EventCardProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const theme = getEventThemeForEvent(event);
  const themedTag = event.primaryTag ?? event.tags[0];

  function logOpen() {
    logClientInteraction({
      action: "open",
      eventId: event.id,
      metadata: { surface: "event_feed" },
    });
  }

  function dismissEvent() {
    setIsDismissed(true);
    logClientInteraction({
      action: "dismiss",
      eventId: event.id,
      metadata: { surface: "event_feed" },
    });
  }

  if (isDismissed) {
    return null;
  }

  return (
    <article className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_24px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.06]">
      <button
        type="button"
        onClick={dismissEvent}
        aria-label={`Hide ${event.title}`}
        className="absolute right-4 top-4 z-10 rounded-full border border-white/15 bg-black/55 p-2 text-zinc-300 backdrop-blur-md transition hover:border-white/30 hover:bg-black/75 hover:text-white"
      >
        <X size={16} />
      </button>

      <Link
        href={`/events/${event.id}`}
        onClick={logOpen}
        aria-label={`View ${event.title}`}
        className={`relative flex aspect-[16/9] items-end overflow-hidden border-b border-white/10 bg-gradient-to-br p-5 ${theme.mediaClassName}`}
      >
        <div
          className={`absolute -right-10 -top-12 h-40 w-40 rounded-full blur-3xl ${theme.glowClassName}`}
        />
        <div className="absolute -bottom-16 -left-8 h-36 w-36 rounded-full bg-indigo-500/20 blur-3xl" />
        <EventThemeMotif motif={theme.motif} />

        <span
          className={`absolute left-4 top-4 rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur-md ${theme.tagClassName}`}
        >
          {theme.label}
        </span>

        <div className="relative flex w-full items-end justify-between gap-3">
          {event.buildingCode ? (
            <span className="rounded-full border border-white/15 bg-black/35 px-3 py-1 text-xs font-semibold text-zinc-200 backdrop-blur-md">
              {event.buildingCode}
            </span>
          ) : (
            <span />
          )}
          {event.isFreeFood && (
            <span className="rounded-full border border-orange-300/30 bg-orange-400/15 px-3 py-1 text-xs font-semibold text-orange-100 backdrop-blur-md">
              🍕 Free Food
            </span>
          )}
        </div>
      </Link>

      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <div>
          <p className={`mb-2 text-sm font-medium ${theme.accentTextClassName}`}>
            {event.clubName}
          </p>
          <h2>
            <Link
              href={`/events/${event.id}`}
              onClick={logOpen}
              className="text-2xl font-bold leading-tight tracking-tight text-white transition-colors hover:text-blue-200 sm:text-3xl"
            >
              {event.title}
            </Link>
          </h2>
        </div>

        <dl className="grid gap-3 text-sm text-zinc-300">
          <div className="grid grid-cols-[4.5rem_1fr] gap-3">
            <dt className="font-semibold text-zinc-500">When</dt>
            <dd>
              <time dateTime={event.startTime}>
                {dateFormatter.format(new Date(event.startTime))}
              </time>
            </dd>
          </div>
          <div className="grid grid-cols-[4.5rem_1fr] gap-3">
            <dt className="font-semibold text-zinc-500">Where</dt>
            <dd>{formatEventLocation(event)}</dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-2">
          {event.tags.map((tag) => (
            <span
              key={tag}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                tag === themedTag
                  ? theme.tagClassName
                  : "border-white/10 bg-white/[0.05] text-zinc-300"
              }`}
            >
              {formatTag(tag)}
            </span>
          ))}
        </div>

        <a
          href={event.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="w-fit text-sm font-semibold text-white underline decoration-white/30 underline-offset-4 transition hover:decoration-white"
        >
          View source
          <span aria-hidden="true"> -&gt;</span>
        </a>
      </div>
    </article>
  );
}
