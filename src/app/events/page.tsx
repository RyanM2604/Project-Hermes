import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Home, Map, Plus, UserRound } from "lucide-react";

import { EventFeed, EventFilters, StartingSoonCarousel } from "@/components/feed";
import { filterEventsByTag, mockEvents, parseEventTag } from "@/lib/events";

const sortedEvents = [...mockEvents].sort(
  (left, right) =>
    new Date(left.startTime).getTime() - new Date(right.startTime).getTime(),
);

export default async function EventsPage({ searchParams }: PageProps<"/events">) {
  const selectedTag = parseEventTag((await searchParams).tag);
  const filteredEvents = filterEventsByTag(sortedEvents, selectedTag);

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/55 px-5 py-4 backdrop-blur-xl sm:px-8">
        <nav className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Hermes landing page">
            <span className="flex h-9 w-12 items-center justify-center">
              <Image
                src="/hermes-logo.png"
                alt=""
                width={56}
                height={31}
                className="scale-[1.8] brightness-0 invert"
                priority
              />
            </span>
            <span className="text-lg font-bold tracking-tight">Hermes</span>
          </Link>

          <div className="hidden items-center gap-1 rounded-full border border-white/20 bg-white/[0.06] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] md:flex">
            <Link
              href="/events"
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black"
            >
              Events
            </Link>
            <a
              href="#event-feed"
              className="rounded-full px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-white/10 hover:text-white"
            >
              Browse
            </a>
          </div>

          <span className="hidden text-sm font-medium text-zinc-500 sm:block">
            Waterloo campus feed
          </span>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-32 pt-10 sm:px-8 sm:pt-14">
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

        <StartingSoonCarousel events={sortedEvents.slice(0, 5)} />

        <div id="event-feed" className="mt-16 scroll-mt-28">
          <EventFilters selectedTag={selectedTag} />
          <EventFeed events={filteredEvents} />
        </div>
      </main>

      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-4 bottom-4 z-50 grid grid-cols-4 rounded-3xl border border-white/15 bg-black/75 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl md:hidden"
      >
        {[
          { label: "Home", href: "/events", icon: Home },
          { label: "Map", href: "#map", icon: Map },
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
