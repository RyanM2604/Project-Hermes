export default function EventsLoading() {
  return (
    <main className="mx-auto min-h-screen max-w-6xl bg-[#050505] px-5 pb-32 pt-32 text-white sm:px-8 sm:pt-36">
      <div className="mb-12 max-w-2xl">
        <div className="mb-5 h-4 w-36 animate-pulse rounded-full bg-white/10" />
        <div className="h-12 w-full max-w-xl animate-pulse rounded-2xl bg-white/10" />
        <div className="mt-5 h-5 w-full max-w-lg animate-pulse rounded-full bg-white/[0.07]" />
      </div>

      <div className="mb-12 flex gap-3 overflow-hidden">
        {[0, 1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="h-10 w-28 shrink-0 animate-pulse rounded-full bg-white/[0.07]"
          />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-96 animate-pulse rounded-3xl border border-white/10 bg-white/[0.04]"
          />
        ))}
      </div>
    </main>
  );
}
