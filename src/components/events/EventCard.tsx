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
  return (
    <article className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_24px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.06]">
      <div className="relative flex aspect-[16/9] items-end overflow-hidden border-b border-white/10 bg-gradient-to-br from-blue-500/30 via-indigo-500/15 to-zinc-950 p-5">
        <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-blue-400/20 blur-3xl" />
        <div className="absolute -bottom-16 -left-8 h-36 w-36 rounded-full bg-indigo-500/20 blur-3xl" />

        <div className="relative flex w-full items-end justify-between gap-3">
          <span className="rounded-full border border-white/15 bg-black/35 px-3 py-1 text-xs font-semibold text-zinc-200 backdrop-blur-md">
            {event.buildingCode}
          </span>
          {event.isFreeFood && (
            <span className="rounded-full border border-orange-300/30 bg-orange-400/15 px-3 py-1 text-xs font-semibold text-orange-100 backdrop-blur-md">
              🍕 Free Food
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <div>
          <p className="mb-2 text-sm font-medium text-blue-300">
            {event.clubName}
          </p>
          <h2 className="text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl">
            {event.title}
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
            <dd>
              {event.locationName}, {event.buildingCode}
            </dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-2">
          {event.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-medium text-zinc-300"
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
