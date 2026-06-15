import type { EventTag, HermesEvent } from "@/types/event";

export type EventThemeMotif =
  | "circles"
  | "food"
  | "grid"
  | "lines"
  | "neutral"
  | "upward"
  | "wave";

export interface EventTheme {
  accentTextClassName: string;
  glowClassName: string;
  label: string;
  mediaClassName: string;
  motif: EventThemeMotif;
  tagClassName: string;
}

const neutralTheme: EventTheme = {
  accentTextClassName: "text-blue-200",
  glowClassName: "bg-blue-400/25",
  label: "Campus event",
  mediaClassName: "from-blue-500/30 via-indigo-500/15 to-zinc-950",
  motif: "neutral",
  tagClassName: "border-blue-300/25 bg-blue-400/15 text-blue-100",
};

const themes = {
  "free-food": {
    accentTextClassName: "text-amber-200",
    glowClassName: "bg-orange-400/30",
    label: "Free food",
    mediaClassName: "from-orange-500/40 via-amber-500/20 to-zinc-950",
    motif: "food",
    tagClassName: "border-orange-300/30 bg-orange-400/15 text-orange-100",
  },
  "hack-dev": {
    accentTextClassName: "text-cyan-200",
    glowClassName: "bg-cyan-400/30",
    label: "Hack & dev",
    mediaClassName: "from-cyan-500/35 via-indigo-500/20 to-zinc-950",
    motif: "grid",
    tagClassName: "border-cyan-300/30 bg-cyan-400/15 text-cyan-100",
  },
  "career-coop": {
    accentTextClassName: "text-emerald-200",
    glowClassName: "bg-emerald-400/25",
    label: "Career & co-op",
    mediaClassName: "from-emerald-500/30 via-blue-500/20 to-zinc-950",
    motif: "lines",
    tagClassName: "border-emerald-300/30 bg-emerald-400/15 text-emerald-100",
  },
  "chill-social": {
    accentTextClassName: "text-violet-200",
    glowClassName: "bg-violet-400/30",
    label: "Chill & social",
    mediaClassName: "from-violet-500/35 via-rose-500/15 to-zinc-950",
    motif: "circles",
    tagClassName: "border-violet-300/30 bg-violet-400/15 text-violet-100",
  },
  music: {
    accentTextClassName: "text-fuchsia-200",
    glowClassName: "bg-fuchsia-400/30",
    label: "Music",
    mediaClassName: "from-fuchsia-500/35 via-purple-500/20 to-zinc-950",
    motif: "wave",
    tagClassName: "border-fuchsia-300/30 bg-fuchsia-400/15 text-fuchsia-100",
  },
  reels: {
    accentTextClassName: "text-fuchsia-200",
    glowClassName: "bg-fuchsia-400/30",
    label: "Reels & media",
    mediaClassName: "from-fuchsia-500/35 via-purple-500/20 to-zinc-950",
    motif: "wave",
    tagClassName: "border-fuchsia-300/30 bg-fuchsia-400/15 text-fuchsia-100",
  },
  "startup-pitch": {
    accentTextClassName: "text-lime-200",
    glowClassName: "bg-lime-400/25",
    label: "Startup & pitch",
    mediaClassName: "from-orange-500/35 via-lime-500/15 to-zinc-950",
    motif: "upward",
    tagClassName: "border-lime-300/30 bg-lime-400/15 text-lime-100",
  },
} as const satisfies Record<EventTag, EventTheme>;

export function getEventTheme(primaryTag?: string | null): EventTheme {
  return primaryTag && primaryTag in themes
    ? themes[primaryTag as EventTag]
    : neutralTheme;
}

export function getEventThemeForEvent(event: HermesEvent): EventTheme {
  return getEventTheme(event.primaryTag ?? event.tags[0]);
}
