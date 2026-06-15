"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

interface DiscoveryMode {
  icon: LucideIcon;
  label: string;
  title: string;
  description: string;
  detail: string;
}

interface DiscoveryCardStackProps {
  modes: readonly DiscoveryMode[];
}

interface DiscoveryCardProps {
  mode: DiscoveryMode;
  index: number;
  total: number;
  progress: ReturnType<typeof useScroll>["scrollYProgress"];
}

function DiscoveryCard({
  mode: { icon: Icon, label, title, description, detail },
  index,
  total,
  progress,
}: DiscoveryCardProps) {
  const reduceMotion = useReducedMotion();
  const targetScale = Math.max(0.88, 1 - (total - index - 1) * 0.04);
  const rangeStart = index / total;
  const scale = useTransform(
    progress,
    [rangeStart, 1],
    reduceMotion ? [1, 1] : [1, targetScale],
  );

  return (
    <motion.div
      className="signal-discovery-card-motion"
      style={{
        scale,
        top: `calc(var(--signal-discovery-sticky-top) + ${index * 1.75}rem)`,
        zIndex: index + 1,
      }}
    >
      <Link
        href="/events"
        className={`signal-discovery-card signal-discovery-card-${index + 1}`}
      >
        <div className="signal-discovery-visual" aria-hidden="true">
          <span className="signal-discovery-orbit signal-discovery-orbit-large" />
          <span className="signal-discovery-orbit signal-discovery-orbit-small" />
          <span className="signal-discovery-card-icon">
            <Icon size={30} />
          </span>
          <span className="signal-discovery-chip signal-discovery-chip-primary">
            {label}
          </span>
          <span className="signal-discovery-chip signal-discovery-chip-secondary">
            {index === 0
              ? "Starting soon"
              : index === 1
                ? "MC · SLC · E7"
                : "Near you"}
          </span>
          <span className="signal-discovery-signal signal-discovery-signal-1" />
          <span className="signal-discovery-signal signal-discovery-signal-2" />
          <span className="signal-discovery-signal signal-discovery-signal-3" />
        </div>

        <div className="signal-discovery-card-copy">
          <span className="signal-discovery-index">0{index + 1}</span>
          <p>{label}</p>
          <h3>{title}</h3>
          <span>{description}</span>
          <small>{detail}</small>
          <span className="signal-discovery-card-link">
            Explore events
            <ArrowRight size={17} />
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

export function DiscoveryCardStack({ modes }: DiscoveryCardStackProps) {
  const container = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: container,
    offset: ["start start", "end end"],
  });

  return (
    <div ref={container} className="signal-discovery-stack">
      {modes.map((mode, index) => (
        <DiscoveryCard
          key={mode.label}
          mode={mode}
          index={index}
          total={modes.length}
          progress={scrollYProgress}
        />
      ))}
    </div>
  );
}
