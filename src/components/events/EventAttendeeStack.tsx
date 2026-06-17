interface EventAttendeeStackProps {
  goingCount: number;
}

const avatarTones = [
  "from-emerald-400 to-cyan-400",
  "from-fuchsia-400 to-rose-400",
  "from-amber-300 to-orange-400",
  "from-sky-400 to-blue-500",
  "from-violet-400 to-indigo-500",
  "from-lime-300 to-emerald-400",
];

const initials = "ABCDEFGHJKLMNPQRSTUVWXYZ";

function hashSeed(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

function getPlaceholderInitials(seed: string, index: number) {
  const hash = hashSeed(`${seed}:${index}`);
  const first = initials[hash % initials.length];
  const second = initials[Math.floor(hash / initials.length) % initials.length];
  return `${first}${second}`;
}

function getToneClass(seed: string, index: number) {
  return avatarTones[hashSeed(`${seed}:tone:${index}`) % avatarTones.length];
}

export function EventAttendeeStack({ goingCount }: EventAttendeeStackProps) {
  if (goingCount <= 0) {
    return null;
  }

  const visibleAvatars = Math.min(goingCount, 3);
  const overflowCount = Math.max(goingCount - visibleAvatars, 0);

  return (
    <div
      className="inline-flex items-center rounded-full border border-white/10 bg-black/35 px-2 py-1 backdrop-blur-md"
      aria-label={`${goingCount} people going`}
      title={`${goingCount} people going`}
    >
      <div className="flex items-center -space-x-2">
        {Array.from({ length: visibleAvatars }, (_, index) => {
          const isOverflowMarker = overflowCount > 0 && index === visibleAvatars - 1;
          const seed = `going:${goingCount}`;

          if (isOverflowMarker) {
            return (
              <span
                key="more"
                className="flex h-8 min-w-8 items-center justify-center rounded-full border border-white/15 bg-white/12 px-2 text-[10px] font-bold text-white shadow-[0_0_0_2px_rgba(0,0,0,0.35)]"
              >
                +{overflowCount}
              </span>
            );
          }

          return (
            <span
              key={index}
              className={`flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-gradient-to-br text-[10px] font-bold tracking-wide text-white shadow-[0_0_0_2px_rgba(0,0,0,0.35)] ${getToneClass(
                seed,
                index,
              )}`}
            >
              {getPlaceholderInitials(seed, index)}
            </span>
          );
        })}
      </div>

      <span className="ml-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
        going
      </span>
    </div>
  );
}
