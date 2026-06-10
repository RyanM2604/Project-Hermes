import Link from "next/link";

import type { HermesEvent } from "@/types/event";

interface StartingSoonCarouselProps {
  events: HermesEvent[];
}

const timeFormatter = new Intl.DateTimeFormat("en-CA", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Toronto",
});

export function StartingSoonCarousel({ events }: StartingSoonCarouselProps) {
  return (
    <section aria-labelledby="starting-soon-heading">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">
            Up next
          </p>
          <h2
            id="starting-soon-heading"
            className="text-2xl font-bold tracking-tight text-white sm:text-3xl"
          >
            Starting Soon
          </h2>
        </div>
        <p className="hidden text-sm text-zinc-500 sm:block">
          Swipe to explore
        </p>
      </div>

      <div className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-3 sm:-mx-8 sm:px-8 lg:mx-0 lg:px-0">
        {events.map((event) => (
          <Link
            key={event.id}
            href={`/events/${event.id}`}
            className="group relative min-h-44 w-[82vw] max-w-sm shrink-0 snap-start overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-blue-500/25 via-white/[0.05] to-zinc-950 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_20px_60px_rgba(0,0,0,0.25)] backdrop-blur-xl transition hover:-translate-y-1 hover:border-white/20 sm:w-80"
          >
            <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-blue-400/20 blur-3xl" />
            <div className="relative flex h-full flex-col justify-between gap-8">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-blue-200">
                  {timeFormatter.format(new Date(event.startTime))}
                </span>
                {event.isFreeFood && (
                  <span className="rounded-full border border-orange-300/30 bg-orange-400/15 px-3 py-1 text-xs font-semibold text-orange-100">
                    🍕 Free Food
                  </span>
                )}
              </div>

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-zinc-400">
                  {event.clubName}
                </p>
                <h3 className="text-xl font-bold leading-tight text-white">
                  {event.title}
                </h3>
                <p className="mt-3 text-sm text-zinc-400">
                  {event.locationName}, {event.buildingCode}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
