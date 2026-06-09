import { EventCard } from "@/components/events";
import { mockEvents } from "@/lib/events";

export default function EventsPage() {
  return (
    <main className="min-h-screen bg-[#050505] px-5 py-16 text-white sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 max-w-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-blue-300">
            Campus feed
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            What&apos;s happening at Waterloo
          </h1>
          <p className="mt-4 text-base leading-7 text-zinc-400 sm:text-lg">
            Discover events, meetups, food, music, and opportunities happening
            across campus.
          </p>
        </div>

        <section
          aria-label="Upcoming campus events"
          className="grid gap-6 md:grid-cols-2 xl:grid-cols-3"
        >
          {mockEvents.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </section>
      </div>
    </main>
  );
}
