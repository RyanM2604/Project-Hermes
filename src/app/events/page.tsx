import { CalendarDays, Home, Map, Plus, UserRound } from "lucide-react";

import { EventFeed, EventFilters, StartingSoonCarousel } from "@/components/feed";
import { filterEventsByTag, parseEventTag } from "@/lib/events";
import { getEvents } from "@/lib/events/repository";

export default async function EventsPage({ searchParams }: PageProps<"/events">) {
  const [params, events] = await Promise.all([searchParams, getEvents()]);
  const selectedTag = parseEventTag(params.tag);
  const filteredEvents = filterEventsByTag(events, selectedTag);
  const startingSoonEvents = events.slice(0, 5);

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <main className="mx-auto max-w-6xl px-5 pb-32 pt-32 sm:px-8 sm:pt-36">
        <div className="mb-12 max-w-2xl">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-blue-300">
            <CalendarDays size={16} />
            Today at Waterloo
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Find something worth showing up for.
          </h1>
          <p className="mt-4 text-base leading-7 text-zinc-400 sm:text-lg">
            Events, free food, clubs, and opportunities happening around campus.
          </p>
        </div>

        <EventFilters selectedTag={selectedTag} />

        <StartingSoonCarousel events={startingSoonEvents} />

        <div id="event-feed" className="mt-16 scroll-mt-28">
          <EventFeed events={filteredEvents} />
        </div>
      </main>

      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-4 bottom-4 z-50 grid grid-cols-4 rounded-3xl border border-white/15 bg-black/75 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl md:hidden"
      >
        {[
          { label: "Home", href: "/events", icon: Home },
          { label: "Map", href: "/map", icon: Map },
          { label: "Post", href: "#post", icon: Plus },
          { label: "Profile", href: "#profile", icon: UserRound },
        ].map(({ label, href, icon: Icon }, index) => (
          <a
            key={label}
            href={href}
            className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium ${
              index === 0 ? "bg-white text-black" : "text-zinc-400"
            }`}
          >
            <Icon size={18} />
            {label}
          </a>
        ))}
      </nav>
    </div>
  );
}
