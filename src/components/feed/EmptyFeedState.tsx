import Link from "next/link";

export function EmptyFeedState() {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] px-6 py-10 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl sm:px-10 sm:py-12">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-300">
        Nothing here yet
      </p>
      <h3 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">
        That filter came up empty.
      </h3>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-zinc-400 sm:text-base">
        Try another vibe, or check back later when more campus events are
        posted.
      </p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link
          href="/events"
          className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
        >
          Try another vibe
        </Link>
        <span className="text-sm text-zinc-500">
          New events are added throughout the week.
        </span>
      </div>
    </div>
  );
}
