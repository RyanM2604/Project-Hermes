import type { EventThemeMotif } from "@/lib/events/event-theme";

interface EventThemeMotifProps {
  motif: EventThemeMotif;
}

export function EventThemeMotif({ motif }: EventThemeMotifProps) {
  if (motif === "grid") {
    return (
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(103,232,249,0.24)_1px,transparent_1px),linear-gradient(90deg,rgba(103,232,249,0.24)_1px,transparent_1px)] [background-size:28px_28px] [mask-image:linear-gradient(to_bottom,black,transparent)]"
      />
    );
  }

  if (motif === "lines") {
    return (
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden opacity-45">
        <div className="absolute -right-8 top-4 h-px w-2/3 rotate-[-18deg] bg-gradient-to-r from-transparent via-emerald-200 to-transparent" />
        <div className="absolute -right-4 top-16 h-px w-4/5 rotate-[-18deg] bg-gradient-to-r from-transparent via-blue-200 to-transparent" />
        <div className="absolute right-8 top-28 h-px w-1/2 rotate-[-18deg] bg-gradient-to-r from-transparent via-emerald-200 to-transparent" />
      </div>
    );
  }

  if (motif === "circles") {
    return (
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden opacity-40">
        <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full border border-violet-200/60" />
        <div className="absolute right-8 top-12 h-24 w-24 rounded-full border border-rose-200/50" />
        <div className="absolute right-20 top-24 h-12 w-12 rounded-full bg-violet-200/20" />
      </div>
    );
  }

  if (motif === "wave") {
    return (
      <div aria-hidden="true" className="absolute inset-x-0 top-8 flex h-24 items-center justify-end gap-2 pr-8 opacity-45">
        {[28, 52, 80, 44, 68, 36, 60, 24].map((height, index) => (
          <span
            key={`${height}-${index}`}
            className="w-1.5 rounded-full bg-fuchsia-100/70"
            style={{ height }}
          />
        ))}
      </div>
    );
  }

  if (motif === "upward") {
    return (
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden opacity-45">
        <div className="absolute right-8 top-12 h-20 w-20 rotate-45 border-l-2 border-t-2 border-lime-200/70" />
        <div className="absolute right-20 top-20 h-24 w-24 rotate-45 border-l border-t border-orange-200/60" />
      </div>
    );
  }

  if (motif === "food") {
    return (
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden opacity-50">
        <div className="absolute right-7 top-7 h-24 w-24 rounded-full border-[10px] border-amber-100/30" />
        <div className="absolute right-16 top-16 h-6 w-6 rounded-full bg-orange-200/50" />
        <div className="absolute right-4 top-24 h-16 w-1 rotate-45 rounded-full bg-amber-100/40" />
      </div>
    );
  }

  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden opacity-35">
      <div className="absolute right-8 top-8 h-24 w-24 rotate-12 rounded-3xl border border-blue-200/50" />
      <div className="absolute right-20 top-20 h-16 w-16 -rotate-12 rounded-full border border-indigo-200/50" />
    </div>
  );
}
