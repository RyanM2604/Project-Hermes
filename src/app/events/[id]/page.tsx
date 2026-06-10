import Link from "next/link";
import { ArrowLeft, CalendarDays, Clock, MapPin } from "lucide-react";

import { mockEvents } from "@/lib/events";
import type { HermesEvent } from "@/types/event";

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "America/Toronto",
});

const timeFormatter = new Intl.DateTimeFormat("en-CA", {
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

export function generateStaticParams() {
  return mockEvents.map((event) => ({ id: event.id }));
}

export default async function EventDetailPage({
  params,
}: PageProps<"/events/[id]">) {
  const { id } = await params;
  const event = mockEvents.find((candidate) => candidate.id === id);

  if (!event) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] px-5 text-white">
        <div className="max-w-md text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-blue-300">
            Event not found
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            This event is no longer available.
          </h1>
          <Link
            href="/events"
            className="mt-8 inline-flex rounded-full border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white"
          >
            Back to events
          </Link>
        </div>
      </main>
    );
  }

  const startTime = new Date(event.startTime);
  const endTime = new Date(event.endTime);

  return (
    <main className="min-h-screen bg-[#050505] px-5 pb-8 pt-32 text-white sm:px-8 sm:pb-12 sm:pt-36">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/events"
          className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-zinc-400 transition hover:text-white"
        >
          <ArrowLeft size={16} />
          Back to events
        </Link>

        <article className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="relative min-h-64 overflow-hidden border-b border-white/10 bg-gradient-to-br from-blue-500/30 via-indigo-500/15 to-zinc-950 p-6 sm:min-h-80 sm:p-10">
            <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-blue-400/20 blur-3xl" />
            <div className="absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-indigo-500/20 blur-3xl" />

            <div className="relative flex h-full min-h-52 flex-col justify-between gap-10 sm:min-h-60">
              <div className="flex flex-wrap items-center gap-2">
                {event.isFreeFood && (
                  <span className="rounded-full border border-orange-300/30 bg-orange-400/15 px-3 py-1 text-sm font-semibold text-orange-100">
                    🍕 Free Food
                  </span>
                )}
                <span className="rounded-full border border-white/15 bg-black/35 px-3 py-1 text-sm font-semibold text-zinc-200">
                  {event.buildingCode}
                </span>
              </div>

              <div>
                <p className="mb-3 text-sm font-semibold text-blue-200">
                  {event.clubName}
                </p>
                <h1 className="max-w-4xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
                  {event.title}
                </h1>
              </div>
            </div>
          </div>

          <div className="grid gap-10 p-6 sm:p-10 lg:grid-cols-[1fr_18rem]">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
                About this event
              </h2>
              <p className="mt-4 max-w-3xl text-lg leading-8 text-zinc-300">
                {event.description}
              </p>

              <div className="mt-8 flex flex-wrap gap-2">
                {event.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-sm font-medium text-zinc-300"
                  >
                    {formatTag(tag)}
                  </span>
                ))}
              </div>

              <a
                href={event.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-8 inline-flex text-sm font-semibold text-white underline decoration-white/30 underline-offset-4 transition hover:decoration-white"
              >
                View original source
              </a>
            </div>

            <aside className="h-fit rounded-3xl border border-white/10 bg-black/25 p-5">
              <dl className="grid gap-5 text-sm">
                <div className="flex gap-3">
                  <CalendarDays className="mt-0.5 shrink-0 text-blue-300" size={18} />
                  <div>
                    <dt className="font-semibold text-zinc-500">Date</dt>
                    <dd className="mt-1 text-zinc-200">
                      {dateFormatter.format(startTime)}
                    </dd>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Clock className="mt-0.5 shrink-0 text-blue-300" size={18} />
                  <div>
                    <dt className="font-semibold text-zinc-500">Time</dt>
                    <dd className="mt-1 text-zinc-200">
                      <time dateTime={event.startTime}>
                        {timeFormatter.format(startTime)}
                      </time>
                      {" - "}
                      <time dateTime={event.endTime}>
                        {timeFormatter.format(endTime)}
                      </time>
                    </dd>
                  </div>
                </div>
                <div className="flex gap-3">
                  <MapPin className="mt-0.5 shrink-0 text-blue-300" size={18} />
                  <div>
                    <dt className="font-semibold text-zinc-500">Location</dt>
                    <dd className="mt-1 text-zinc-200">
                      {event.locationName}, {event.buildingCode}
                    </dd>
                  </div>
                </div>
              </dl>

              <button
                type="button"
                disabled
                className="mt-6 w-full cursor-not-allowed rounded-2xl bg-white px-4 py-3 text-sm font-bold text-black opacity-50"
              >
                Login to RSVP
              </button>
            </aside>
          </div>
        </article>
      </div>
    </main>
  );
}
