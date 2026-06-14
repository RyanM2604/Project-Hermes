import type { LucideIcon } from "lucide-react";
import { ArrowRight, Bell, Sparkles } from "lucide-react";
import Link from "next/link";

interface ComingSoonPageProps {
  accent: "cyan" | "violet";
  description: string;
  eyebrow: string;
  highlights: {
    description: string;
    icon: LucideIcon;
    title: string;
  }[];
  title: string;
  visual: "clubs" | "map";
}

const accentClasses = {
  cyan: {
    badge: "border-cyan-300/25 bg-cyan-400/10 text-cyan-100",
    glow: "bg-cyan-400/20",
    line: "from-cyan-300/0 via-cyan-300/70 to-cyan-300/0",
    text: "text-cyan-200",
  },
  violet: {
    badge: "border-violet-300/25 bg-violet-400/10 text-violet-100",
    glow: "bg-violet-400/20",
    line: "from-violet-300/0 via-violet-300/70 to-violet-300/0",
    text: "text-violet-200",
  },
} as const;

function ClubsVisual({ line }: { line: string }) {
  const nodes = [
    { label: "Tech", position: "left-[13%] top-[22%]" },
    { label: "Arts", position: "right-[11%] top-[16%]" },
    { label: "Culture", position: "left-[20%] bottom-[18%]" },
    { label: "Social", position: "right-[16%] bottom-[22%]" },
  ];

  return (
    <div className="relative h-full min-h-80 overflow-hidden rounded-[2rem] border border-white/10 bg-black/30">
      <div className="absolute inset-0 [background-image:radial-gradient(rgba(255,255,255,0.16)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(circle_at_center,black,transparent_80%)]" />
      <div
        className={`absolute left-[18%] top-1/2 h-px w-[64%] -rotate-12 bg-gradient-to-r ${line}`}
      />
      <div
        className={`absolute left-1/2 top-[16%] h-px w-[54%] -translate-x-1/2 rotate-[58deg] bg-gradient-to-r ${line}`}
      />
      <div className="absolute left-1/2 top-1/2 flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-white/10 text-center text-lg font-bold text-white shadow-[0_0_70px_rgba(255,255,255,0.15)] backdrop-blur-xl">
        Find your
        <br />
        people
      </div>
      {nodes.map(({ label, position }) => (
        <span
          key={label}
          className={`absolute ${position} flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-black/55 text-xs font-semibold text-zinc-200 backdrop-blur-md`}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function MapVisual({ line }: { line: string }) {
  return (
    <div className="relative h-full min-h-80 overflow-hidden rounded-[2rem] border border-white/10 bg-black/30">
      <div className="absolute inset-0 opacity-45 [background-image:linear-gradient(rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:52px_52px] [mask-image:radial-gradient(circle_at_center,black,transparent_82%)]" />
      <div className="absolute left-[12%] top-[18%] h-24 w-36 rotate-6 rounded-xl border border-white/15 bg-white/[0.04]" />
      <div className="absolute bottom-[15%] right-[11%] h-28 w-40 -rotate-6 rounded-xl border border-white/15 bg-white/[0.04]" />
      <div
        className={`absolute left-[17%] top-1/2 h-1 w-[66%] -rotate-[22deg] rounded-full bg-gradient-to-r ${line}`}
      />
      <div className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />
      <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25" />
      <div className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-white/15 text-sm font-bold text-white shadow-[0_0_70px_rgba(255,255,255,0.2)] backdrop-blur-xl">
        You
      </div>
      {["MC", "SLC", "E7"].map((building, index) => (
        <span
          key={building}
          className={`absolute rounded-full border border-white/20 bg-black/65 px-3 py-1 text-xs font-bold text-zinc-200 backdrop-blur-md ${
            index === 0
              ? "left-[16%] top-[30%]"
              : index === 1
                ? "right-[18%] top-[25%]"
                : "bottom-[22%] left-[24%]"
          }`}
        >
          {building}
        </span>
      ))}
    </div>
  );
}

export function ComingSoonPage({
  accent,
  description,
  eyebrow,
  highlights,
  title,
  visual,
}: ComingSoonPageProps) {
  const colors = accentClasses[accent];

  return (
    <main className="relative flex min-h-screen overflow-hidden bg-[#050505] px-5 pb-20 pt-32 text-white sm:px-8 sm:pt-40">
      <div
        aria-hidden="true"
        className={`absolute left-1/2 top-1/3 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full blur-[150px] ${colors.glow}`}
      />
      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-14 lg:grid-cols-[0.9fr_1.1fr]">
        <section>
          <div
            className={`mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${colors.badge}`}
          >
            <Sparkles size={14} />
            {eyebrow}
          </div>
          <h1 className="max-w-xl text-5xl font-bold leading-[0.98] tracking-[-0.05em] sm:text-6xl lg:text-7xl">
            {title}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-zinc-400 sm:text-lg">
            {description}
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/events"
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
            >
              Explore events
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/signup"
              className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              <Bell size={16} />
              Get notified
            </Link>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {highlights.map(({ description: itemDescription, icon: Icon, title: itemTitle }) => (
              <div
                key={itemTitle}
                className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 backdrop-blur-xl"
              >
                <Icon className={colors.text} size={18} />
                <h2 className="mt-4 text-sm font-semibold text-white">
                  {itemTitle}
                </h2>
                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  {itemDescription}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section aria-label={`${eyebrow} preview`} className="min-h-80 lg:min-h-[34rem]">
          {visual === "clubs" ? (
            <ClubsVisual line={colors.line} />
          ) : (
            <MapVisual line={colors.line} />
          )}
        </section>
      </div>
    </main>
  );
}
